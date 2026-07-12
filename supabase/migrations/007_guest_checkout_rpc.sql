-- ════════════════════════════════════════════════════════════
-- Guest checkout via a single SECURITY DEFINER RPC
-- ════════════════════════════════════════════════════════════
-- Discovered while wiring the real checkout flow: Postgres applies
-- a table's SELECT policies to the RETURNING clause of an INSERT
-- (supabase-js's .insert().select() relies on RETURNING). Since
-- anon deliberately has NO select policy on customers/orders/
-- order_items (that's what makes order-enumeration/IDOR
-- structurally impossible), a direct client-side
-- `insert(...).select()` from the anon role fails outright — the
-- whole statement rolls back, so no orphaned rows are left behind,
-- but no order can be created either.
--
-- Fix: one SECURITY DEFINER function that does all three inserts
-- (customers → orders → order_items) in a single transaction and
-- hands back exactly the JSON the checkout page needs. This is
-- also strictly better than three separate anon inserts: it's
-- atomic (no half-created orders), and it generates a
-- collision-checked human order_number server-side.
-- ════════════════════════════════════════════════════════════

create or replace function create_guest_order(
  p_customer     jsonb,   -- {name, email, phone, address, city}
  p_items        jsonb,   -- [{id, name, image, price, qty}]
  p_payment_method  text default 'cod',
  p_delivery_method text default 'standard',
  p_coupon_code     text default null,
  p_notes           text default null,
  p_subtotal        numeric default 0,
  p_shipping_cost   numeric default 0,
  p_discount        numeric default 0,
  p_total           numeric default 0
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_order_id    int;
  v_order_number text;
  v_item jsonb;
  v_items_json json;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if coalesce(p_customer->>'name', '') = '' or coalesce(p_customer->>'phone', '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

  insert into customers (name, email, phone, address_1, city)
  values (
    p_customer->>'name',
    nullif(p_customer->>'email', ''),
    p_customer->>'phone',
    p_customer->>'address',
    p_customer->>'city'
  )
  returning id into v_customer_id;

  -- MON-XXXXX, regenerated on the rare collision
  loop
    v_order_number := 'MON-' || (10000 + floor(random() * 90000))::int;
    exit when not exists (select 1 from orders where order_number = v_order_number);
  end loop;

  insert into orders (
    order_number, customer_id, customer_name, customer_phone, customer_email,
    address, city, subtotal, shipping_cost, discount, total,
    coupon_code, payment_method, delivery_method, status, notes
  ) values (
    v_order_number, v_customer_id, p_customer->>'name', p_customer->>'phone', nullif(p_customer->>'email',''),
    p_customer->>'address', p_customer->>'city', p_subtotal, p_shipping_cost, p_discount, p_total,
    p_coupon_code, p_payment_method, p_delivery_method, 'pending', p_notes
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

  -- bump the coupon's used_count if one was applied
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
      'subtotal', p_subtotal,
      'shipping_cost', p_shipping_cost,
      'discount', p_discount,
      'total', p_total,
      'payment_method', p_payment_method,
      'delivery_method', p_delivery_method,
      'status', 'pending',
      'created_at', now()
    ),
    'items', v_items_json
  );
end $$;

-- anon needs to be able to call this function (the function's own
-- SECURITY DEFINER body does the actual writes with elevated
-- privilege — the direct table INSERT policies from 005 stay in
-- place too as a secondary path/safety net, but the RPC is the
-- one that actually works end-to-end given the RETURNING/RLS
-- interaction above).
grant execute on function create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric) to anon, authenticated;
