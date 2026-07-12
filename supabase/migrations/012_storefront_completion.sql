-- ════════════════════════════════════════════════════════════
-- Storefront completion: contact, newsletter, reviews RPC,
-- stock validation on checkout, customer auth link
-- Safe to re-run (idempotent where possible).
-- ════════════════════════════════════════════════════════════

-- ── Customer auth link (store accounts, separate from CRM) ──
alter table customers add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- ── Contact messages ──
create table if not exists contact_messages (
  id          bigserial primary key,
  name        text not null,
  email       text not null,
  order_number text,
  subject     text not null default 'استفسار عام',
  message     text not null,
  created_at  timestamptz default now()
);

alter table contact_messages enable row level security;

drop policy if exists contact_messages_public_insert on contact_messages;
create policy contact_messages_public_insert on contact_messages
  for insert to public with check (true);

drop policy if exists contact_messages_admin_all on contact_messages;
create policy contact_messages_admin_all on contact_messages
  for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

-- ── Newsletter ──
create table if not exists newsletter_subscribers (
  id         bigserial primary key,
  email      text unique not null,
  created_at timestamptz default now()
);

alter table newsletter_subscribers enable row level security;

drop policy if exists newsletter_public_insert on newsletter_subscribers;
-- No direct insert — use subscribe_newsletter() RPC only

drop policy if exists newsletter_admin_all on newsletter_subscribers;
create policy newsletter_admin_all on newsletter_subscribers
  for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

-- ── Link authenticated user → customers row ──
create or replace function upsert_customer_from_auth(
  p_name  text,
  p_phone text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row customers%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_row from customers where auth_user_id = v_uid limit 1;
  if found then
    update customers set
      name = coalesce(nullif(trim(p_name), ''), name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      email = coalesce(v_email, email)
    where id = v_row.id
    returning * into v_row;
  else
    insert into customers (name, email, phone, auth_user_id, points, tier)
    values (
      coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1)),
      v_email,
      nullif(trim(p_phone), ''),
      v_uid,
      0,
      'bronze'
    )
    returning * into v_row;
  end if;

  return json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'email', v_row.email,
    'phone', v_row.phone,
    'points', v_row.points,
    'tier', v_row.tier
  );
end $$;

grant execute on function upsert_customer_from_auth(text, text) to authenticated;

-- ── Contact form RPC (no direct SELECT for anon) ──
create or replace function submit_contact_message(
  p_name text,
  p_email text,
  p_subject text,
  p_message text,
  p_order_number text default null
) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Name and email required';
  end if;
  if coalesce(trim(p_message), '') = '' then
    raise exception 'Message required';
  end if;

  insert into contact_messages (name, email, subject, message, order_number)
  values (
    trim(p_name),
    trim(p_email),
    coalesce(nullif(trim(p_subject), ''), 'استفسار عام'),
    trim(p_message),
    nullif(trim(p_order_number), '')
  );

  return json_build_object('ok', true);
end $$;

grant execute on function submit_contact_message(text, text, text, text, text) to anon, authenticated;

-- ── Newsletter subscribe ──
create or replace function subscribe_newsletter(p_email text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_email), '') = '' or position('@' in p_email) = 0 then
    return json_build_object('ok', false, 'message', 'بريد غير صالح');
  end if;

  insert into newsletter_subscribers (email)
  values (lower(trim(p_email)))
  on conflict (email) do nothing;

  return json_build_object('ok', true, 'message', 'تم الاشتراك بنجاح');
end $$;

grant execute on function subscribe_newsletter(text) to anon, authenticated;

-- ── Product reviews (public submit + update product stats) ──
create or replace function submit_product_review(
  p_product_id int,
  p_customer_name text,
  p_rating int,
  p_comment text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_avg numeric;
  v_cnt int;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1-5';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Name required';
  end if;
  if not exists (select 1 from products where id = p_product_id and is_active) then
    raise exception 'Product not found';
  end if;

  insert into reviews (product_id, customer_name, rating, comment, is_visible, is_verified)
  values (p_product_id, trim(p_customer_name), p_rating, nullif(trim(p_comment), ''), true, false);

  select round(avg(rating)::numeric, 1), count(*)::int
  into v_avg, v_cnt
  from reviews where product_id = p_product_id and is_visible;

  update products set rating = v_avg, review_count = v_cnt where id = p_product_id;

  return json_build_object('ok', true);
end $$;

grant execute on function submit_product_review(int, text, int, text) to anon, authenticated;

-- ── List visible reviews for a product ──
create or replace function list_product_reviews(p_product_id int)
returns json
language plpgsql stable security definer set search_path = public as $$
declare v_rows json;
begin
  select coalesce(json_agg(json_build_object(
    'customer_name', r.customer_name,
    'rating', r.rating,
    'comment', r.comment,
    'created_at', r.created_at
  ) order by r.created_at desc), '[]'::json)
  into v_rows
  from reviews r
  where r.product_id = p_product_id and r.is_visible;

  return v_rows;
end $$;

grant execute on function list_product_reviews(int) to anon, authenticated;

-- ── Stock validation in create_guest_order ──
create or replace function create_guest_order(
  p_customer     jsonb,
  p_items        jsonb,
  p_payment_method  text default 'cod',
  p_delivery_method text default 'standard',
  p_coupon_code     text default null,
  p_notes           text default null,
  p_subtotal        numeric default 0,
  p_shipping_cost   numeric default 0,
  p_discount        numeric default 0,
  p_total           numeric default 0,
  p_governorate       text default null,
  p_payment_proof_url text default null,
  p_deposit_amount    numeric default 0
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_order_id    int;
  v_order_number text;
  v_item jsonb;
  v_items_json json;
  v_payment_status text;
  v_pid int;
  v_qty int;
  v_stock int;
  v_pname text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if coalesce(p_customer->>'name', '') = '' or coalesce(p_customer->>'phone', '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'id')::int;
    v_qty := coalesce((v_item->>'qty')::int, 1);
    select stock, name into v_stock, v_pname from products where id = v_pid and is_active;
    if not found then
      raise exception 'Product % not available', v_pid;
    end if;
    if v_stock < v_qty then
      raise exception 'Insufficient stock for %', v_pname;
    end if;
  end loop;

  v_payment_status := case when p_payment_proof_url is not null then 'awaiting_review' else 'pending' end;

  insert into customers (name, email, phone, address_1, city)
  values (
    p_customer->>'name',
    nullif(p_customer->>'email', ''),
    p_customer->>'phone',
    p_customer->>'address',
    p_customer->>'city'
  )
  returning id into v_customer_id;

  loop
    v_order_number := 'MON-' || (10000 + floor(random() * 90000))::int;
    exit when not exists (select 1 from orders where order_number = v_order_number);
  end loop;

  insert into orders (
    order_number, customer_id, customer_name, customer_phone, customer_email,
    address, city, governorate, subtotal, shipping_cost, discount, total,
    coupon_code, payment_method, delivery_method, status, notes,
    payment_status, payment_proof_url, deposit_amount
  ) values (
    v_order_number, v_customer_id, p_customer->>'name', p_customer->>'phone', nullif(p_customer->>'email',''),
    p_customer->>'address', p_customer->>'city', p_governorate, p_subtotal, p_shipping_cost, p_discount, p_total,
    p_coupon_code, p_payment_method, p_delivery_method, 'pending', p_notes,
    v_payment_status, p_payment_proof_url, p_deposit_amount
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'id')::int;
    v_qty := (v_item->>'qty')::int;

    insert into order_items (order_id, product_id, product_name, product_image, price, quantity, total)
    values (
      v_order_id,
      v_pid,
      v_item->>'name',
      v_item->>'image',
      (v_item->>'price')::numeric,
      v_qty,
      (v_item->>'price')::numeric * v_qty
    );

    update products set stock = greatest(0, stock - v_qty) where id = v_pid;
  end loop;

  if p_coupon_code is not null then
    update coupons set used_count = coalesce(used_count, 0) + 1 where upper(code) = upper(p_coupon_code);
  end if;

  select json_agg(oi) into v_items_json from order_items oi where oi.order_id = v_order_id;

  return json_build_object(
    'order', json_build_object(
      'id', v_order_id,
      'order_number', v_order_number,
      'customer_name', p_customer->>'name',
      'customer_phone', p_customer->>'phone',
      'address', p_customer->>'address',
      'city', p_customer->>'city',
      'governorate', p_governorate,
      'subtotal', p_subtotal,
      'shipping_cost', p_shipping_cost,
      'discount', p_discount,
      'total', p_total,
      'payment_method', p_payment_method,
      'delivery_method', p_delivery_method,
      'status', 'pending',
      'payment_status', v_payment_status,
      'payment_proof_url', p_payment_proof_url,
      'deposit_amount', p_deposit_amount,
      'created_at', now()
    ),
    'items', v_items_json
  );
end $$;

grant execute on function create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric, text, text, numeric) to anon, authenticated;

-- Include customer_phone in tracking response
create or replace function get_order_status(p_order_number text, p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_items json;
begin
  select * into v_order from orders
    where order_number = p_order_number and customer_phone = p_phone
    limit 1;

  if not found then
    return json_build_object('found', false);
  end if;

  select json_agg(oi) into v_items from order_items oi where oi.order_id = v_order.id;

  return json_build_object(
    'found', true,
    'order_number', v_order.order_number,
    'customer_phone', v_order.customer_phone,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'delivery_method', v_order.delivery_method,
    'governorate', v_order.governorate,
    'city', v_order.city,
    'address', v_order.address,
    'subtotal', v_order.subtotal,
    'shipping_cost', v_order.shipping_cost,
    'discount', v_order.discount,
    'total', v_order.total,
    'created_at', v_order.created_at,
    'items', v_items
  );
end $$;

grant execute on function get_order_status(text, text) to anon, authenticated;
