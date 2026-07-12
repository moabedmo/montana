-- ════════════════════════════════════════════════════════════
-- Per-governorate shipping + booking-confirmation deposit flow
-- ════════════════════════════════════════════════════════════
-- Adds: shipping_rates (public read / admin write, same shape as
-- categories), orders.governorate/payment_status/payment_proof_url/
-- deposit_amount, an extended create_guest_order RPC, a new
-- get_order_status(order_number, phone) RPC (also becomes the real
-- data source for tracking.html, previously a static mockup), the
-- "montana" storage bucket (referenced by crm-api.js but never
-- actually created — storage.buckets was empty), and a public
-- upload-only policy for payment-proofs/.
-- ════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 1. Shipping rates per governorate
-- ───────────────────────────────────────────────
create table if not exists shipping_rates (
  id          serial primary key,
  governorate text unique not null,
  cost        numeric not null default 0,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);

alter table shipping_rates enable row level security;

drop policy if exists shipping_rates_public_read on shipping_rates;
drop policy if exists shipping_rates_admin_write on shipping_rates;
create policy shipping_rates_public_read on shipping_rates for select to public using (true);
create policy shipping_rates_admin_write on shipping_rates for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

insert into shipping_rates (governorate, cost, sort_order) values
('القاهرة', 50, 1), ('الجيزة', 50, 2), ('الإسكندرية', 60, 3),
('القليوبية', 60, 4), ('الشرقية', 65, 5), ('الدقهلية', 65, 6),
('الغربية', 65, 7), ('المنوفية', 60, 8), ('البحيرة', 65, 9),
('كفر الشيخ', 70, 10), ('دمياط', 70, 11), ('بورسعيد', 70, 12),
('الإسماعيلية', 70, 13), ('السويس', 70, 14), ('الفيوم', 65, 15),
('بني سويف', 70, 16), ('المنيا', 75, 17), ('أسيوط', 80, 18),
('سوهاج', 85, 19), ('قنا', 90, 20), ('الأقصر', 100, 21),
('أسوان', 110, 22), ('البحر الأحمر', 120, 23), ('الوادي الجديد', 130, 24),
('مطروح', 110, 25), ('شمال سيناء', 130, 26), ('جنوب سيناء', 120, 27)
on conflict (governorate) do nothing;

-- ───────────────────────────────────────────────
-- 2. Orders: governorate + deposit/payment-proof tracking
-- ───────────────────────────────────────────────
alter table orders add column if not exists governorate text;
alter table orders add column if not exists payment_status text not null default 'pending';
alter table orders add column if not exists payment_proof_url text;
alter table orders add column if not exists deposit_amount numeric not null default 0;

-- ───────────────────────────────────────────────
-- 3. create_guest_order — extended with governorate + proof
--    (new params appended with defaults so this replaces, not
--    overloads, the existing function; old callers unaffected)
-- ───────────────────────────────────────────────
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
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if coalesce(p_customer->>'name', '') = '' or coalesce(p_customer->>'phone', '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

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
    insert into order_items (order_id, product_id, product_name, product_image, price, quantity, total)
    values (
      v_order_id,
      (v_item->>'id')::int,
      v_item->>'name',
      v_item->>'image',
      (v_item->>'price')::numeric,
      (v_item->>'qty')::int,
      (v_item->>'price')::numeric * (v_item->>'qty')::int
    );
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
      'created_at', now()
    ),
    'items', v_items_json
  );
end $$;

grant execute on function create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric, text, text, numeric) to anon, authenticated;

-- ───────────────────────────────────────────────
-- 4. get_order_status — order_number + phone act as a lightweight
--    "token" so a customer can check status without any account/
--    bearer-token system; this is also tracking.html's real data
--    source now.
-- ───────────────────────────────────────────────
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

-- ───────────────────────────────────────────────
-- 5. Storage: the "montana" bucket is referenced by crm-api.js
--    (crm-materials/, crm-visits/) but storage.buckets was
--    completely empty — it was never actually created, so every
--    upload attempt there has been failing silently. Creating it
--    here (public, so getPublicUrl()'d images/screenshots are
--    directly viewable) fixes that AND enables the new
--    payment-proofs/ prefix used by checkout.html.
-- ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('montana', 'montana', true)
on conflict (id) do nothing;

drop policy if exists payment_proofs_upload on storage.objects;
create policy payment_proofs_upload on storage.objects
  for insert to public
  with check (bucket_id = 'montana' and name like 'payment-proofs/%');

-- ───────────────────────────────────────────────
-- 6. Transfer number shown to the customer during checkout —
--    placeholder values, editable from the admin settings page.
-- ───────────────────────────────────────────────
insert into site_settings (key, value) values
('instapay_wallet_number', '01000000000'),
('instapay_wallet_name', 'Montana Naturals')
on conflict (key) do nothing;
