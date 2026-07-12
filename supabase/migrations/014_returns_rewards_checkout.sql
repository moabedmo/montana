-- ════════════════════════════════════════════════════════════
-- Returns, rewards redemption, auth-linked checkout
-- Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════

-- ── Return requests ──
create table if not exists return_requests (
  id serial primary key,
  order_number text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table return_requests enable row level security;

drop policy if exists return_requests_admin_all on return_requests;
create policy return_requests_admin_all on return_requests
  for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

create or replace function submit_return_request(
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_reason text default null,
  p_details text default null
) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_order_number), '') = '' or coalesce(trim(p_customer_name), '') = ''
     or coalesce(trim(p_customer_phone), '') = '' or coalesce(trim(p_reason), '') = '' then
    raise exception 'Required fields missing';
  end if;

  insert into return_requests (order_number, customer_name, customer_phone, customer_email, reason, details)
  values (
    trim(p_order_number),
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_customer_email, '')), ''),
    trim(p_reason),
    nullif(trim(coalesce(p_details, '')), '')
  );

  return json_build_object('ok', true, 'message', 'تم استلام طلب الإرجاع');
end $$;

grant execute on function submit_return_request(text, text, text, text, text, text) to anon, authenticated;

-- ── Profile update ──
create or replace function update_customer_profile(
  p_name text,
  p_phone text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row customers%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;

  select * into v_row from customers where auth_user_id = v_uid limit 1;
  if not found then
    return upsert_customer_from_auth(p_name, p_phone);
  end if;

  update customers set
    name = trim(p_name),
    phone = coalesce(nullif(trim(p_phone), ''), phone)
  where id = v_row.id
  returning * into v_row;

  return json_build_object(
    'id', v_row.id, 'name', v_row.name, 'email', v_row.email,
    'phone', v_row.phone, 'points', v_row.points, 'tier', v_row.tier
  );
end $$;

grant execute on function update_customer_profile(text, text) to authenticated;

-- ── Rewards balance for checkout ──
create or replace function get_my_rewards_balance()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_points int;
begin
  if v_uid is null then return json_build_object('points', 0); end if;
  select coalesce(points, 0) into v_points from customers where auth_user_id = v_uid limit 1;
  return json_build_object('points', coalesce(v_points, 0), 'rate', 10);
end $$;

grant execute on function get_my_rewards_balance() to authenticated;

-- ── Checkout: auth link + points redemption ──
drop function if exists create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric, text, text, numeric);

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
  p_deposit_amount    numeric default 0,
  p_points_redeemed   int default 0
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
  v_uid uuid := auth.uid();
  v_auth_customer customers%rowtype;
  v_points_discount numeric := 0;
  v_user_points int := 0;
  v_expected_total numeric;
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
    if not found then raise exception 'Product % not available', v_pid; end if;
    if v_stock < v_qty then raise exception 'Insufficient stock for %', v_pname; end if;
  end loop;

  if coalesce(p_points_redeemed, 0) > 0 then
    if v_uid is null then raise exception 'Login required to redeem points'; end if;
    select * into v_auth_customer from customers where auth_user_id = v_uid limit 1;
    if not found then raise exception 'Customer profile not found'; end if;
    v_user_points := coalesce(v_auth_customer.points, 0);
    if p_points_redeemed > v_user_points then raise exception 'Insufficient points'; end if;
    if p_points_redeemed % 10 <> 0 then raise exception 'Points must be in multiples of 10'; end if;
    v_points_discount := floor(p_points_redeemed / 10.0);
  end if;

  v_expected_total := greatest(0, p_subtotal + p_shipping_cost - p_discount - v_points_discount);
  if abs(v_expected_total - p_total) > 0.02 then
    raise exception 'Order total mismatch';
  end if;

  v_payment_status := case
    when p_payment_method = 'card' then 'pending'
    when p_payment_proof_url is not null then 'awaiting_review'
    else 'pending'
  end;

  if v_uid is not null then
    select * into v_auth_customer from customers where auth_user_id = v_uid limit 1;
    if found then
      update customers set
        name = coalesce(p_customer->>'name', name),
        phone = coalesce(p_customer->>'phone', phone),
        email = coalesce(nullif(p_customer->>'email', ''), email),
        address_1 = coalesce(p_customer->>'address', address_1),
        city = coalesce(p_customer->>'city', city)
      where id = v_auth_customer.id
      returning id into v_customer_id;
    else
      insert into customers (name, email, phone, address_1, city, auth_user_id, points, tier)
      values (
        p_customer->>'name',
        coalesce(nullif(p_customer->>'email', ''), (select email from auth.users where id = v_uid)),
        p_customer->>'phone',
        p_customer->>'address',
        p_customer->>'city',
        v_uid, 0, 'bronze'
      )
      returning id into v_customer_id;
    end if;
  else
    insert into customers (name, email, phone, address_1, city)
    values (
      p_customer->>'name',
      nullif(p_customer->>'email', ''),
      p_customer->>'phone',
      p_customer->>'address',
      p_customer->>'city'
    )
    returning id into v_customer_id;
  end if;

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
    p_customer->>'address', p_customer->>'city', p_governorate,
    p_subtotal, p_shipping_cost, p_discount + v_points_discount, p_total,
    p_coupon_code, p_payment_method, p_delivery_method, 'pending', p_notes,
    v_payment_status, p_payment_proof_url, p_deposit_amount
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'id')::int;
    v_qty := (v_item->>'qty')::int;
    insert into order_items (order_id, product_id, product_name, product_image, price, quantity, total)
    values (
      v_order_id, v_pid, v_item->>'name', v_item->>'image',
      (v_item->>'price')::numeric, v_qty,
      (v_item->>'price')::numeric * v_qty
    );
    update products set stock = greatest(0, stock - v_qty) where id = v_pid;
  end loop;

  if p_coupon_code is not null then
    update coupons set used_count = coalesce(used_count, 0) + 1 where upper(code) = upper(p_coupon_code);
  end if;

  if coalesce(p_points_redeemed, 0) > 0 and v_uid is not null then
    update customers set points = greatest(0, coalesce(points, 0) - p_points_redeemed)
    where auth_user_id = v_uid;
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
      'discount', p_discount + v_points_discount,
      'points_redeemed', coalesce(p_points_redeemed, 0),
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

grant execute on function create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric, text, text, numeric, int) to anon, authenticated;
