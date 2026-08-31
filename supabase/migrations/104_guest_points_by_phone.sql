-- Guest checkout: recognize + redeem loyalty points by phone (no login).
-- Also force free shipping store-wide (matches storefront UI).
-- Fix get_customer_points_by_phone to use Egyptian phone normalization.

create or replace function get_customer_points_by_phone(p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_digits text;
  v_total int;
begin
  v_digits := normalize_eg_phone(p_phone);
  if v_digits is null then
    return json_build_object('found', false, 'points', 0, 'error', 'invalid_phone');
  end if;

  select coalesce(sum(points), 0)::int into v_total
  from customers
  where normalize_eg_phone(phone) = v_digits;

  return json_build_object('found', true, 'phone', v_digits, 'points', v_total);
end $$;

revoke all on function get_customer_points_by_phone(text) from public, anon, authenticated;
grant execute on function get_customer_points_by_phone(text) to service_role;

drop function if exists create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric, text, text, numeric, int, text, text);

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
  p_points_redeemed   int default 0,
  p_chat_session_id   text default null,
  p_chat_channel      text default null
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
  v_product_price numeric;
  v_uid uuid := auth.uid();
  v_auth_customer customers%rowtype;
  v_points_discount numeric := 0;
  v_user_points int := 0;
  v_expected_total numeric;
  v_computed_subtotal numeric := 0;
  v_computed_shipping numeric := 0;
  v_computed_discount numeric := 0;
  v_coupon_result json;
  v_coupon record;
  v_image_url text;
  v_phone_norm text;
  v_remain int;
  v_take int;
  v_cust record;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if coalesce(p_customer->>'name', '') = '' or coalesce(p_customer->>'phone', '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

  v_phone_norm := normalize_eg_phone(p_customer->>'phone');

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'id')::int;
    v_qty := coalesce((v_item->>'qty')::int, 1);
    if v_qty < 1 then raise exception 'Invalid quantity for product %', v_pid; end if;
    select stock, name, price into v_stock, v_pname, v_product_price
      from products where id = v_pid and is_active;
    if not found then raise exception 'Product % not available', v_pid; end if;
    if v_stock < v_qty then raise exception 'Insufficient stock for %', v_pname; end if;
    v_computed_subtotal := v_computed_subtotal + (v_product_price * v_qty);
  end loop;

  -- Store-wide free shipping
  v_computed_shipping := 0;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    v_coupon_result := validate_coupon(p_coupon_code, v_computed_subtotal);
    if coalesce((v_coupon_result->>'valid')::boolean, false) is not true then
      raise exception '%', coalesce(v_coupon_result->>'message', 'Invalid coupon');
    end if;
    select * into v_coupon from coupons where upper(code) = upper(p_coupon_code) and is_active limit 1;
    if v_coupon.discount_type = 'percent' then
      v_computed_discount := round(v_computed_subtotal * v_coupon.discount_value / 100.0, 2);
    else
      v_computed_discount := v_coupon.discount_value;
    end if;
    v_computed_discount := least(v_computed_discount, v_computed_subtotal);
  end if;

  if coalesce(p_points_redeemed, 0) > 0 then
    if v_uid is not null then
      select * into v_auth_customer from customers where auth_user_id = v_uid limit 1;
      if not found then raise exception 'Customer profile not found'; end if;
      v_user_points := coalesce(v_auth_customer.points, 0);
    else
      if v_phone_norm is null then
        raise exception 'Valid Egyptian mobile required to redeem points';
      end if;
      select coalesce(sum(points), 0)::int into v_user_points
      from customers
      where normalize_eg_phone(phone) = v_phone_norm;
    end if;

    if p_points_redeemed > v_user_points then raise exception 'Not enough points'; end if;
    if p_points_redeemed % 10 <> 0 then raise exception 'Points must be multiples of 10'; end if;
    -- 10 points = 1 EGP
    v_points_discount := least(p_points_redeemed / 10.0, v_computed_subtotal - v_computed_discount);
  end if;

  v_expected_total := greatest(0, v_computed_subtotal + v_computed_shipping - v_computed_discount - v_points_discount);

  v_payment_status := case
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
    payment_status, payment_proof_url, deposit_amount,
    chat_session_id, chat_channel
  ) values (
    v_order_number, v_customer_id, p_customer->>'name', p_customer->>'phone', nullif(p_customer->>'email',''),
    p_customer->>'address', p_customer->>'city', p_governorate,
    v_computed_subtotal, v_computed_shipping, v_computed_discount + v_points_discount, v_expected_total,
    p_coupon_code, p_payment_method, p_delivery_method, 'pending', p_notes,
    v_payment_status, p_payment_proof_url, p_deposit_amount,
    nullif(p_chat_session_id, ''), nullif(p_chat_channel, '')
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'id')::int;
    v_qty := coalesce((v_item->>'qty')::int, 1);
    select name, price, image_url into v_pname, v_product_price, v_image_url
      from products where id = v_pid;
    insert into order_items (order_id, product_id, product_name, product_image, price, quantity, total)
    values (
      v_order_id, v_pid, v_pname, v_image_url,
      v_product_price, v_qty,
      v_product_price * v_qty
    );
    update products set stock = greatest(0, stock - v_qty) where id = v_pid;
  end loop;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    update coupons set used_count = coalesce(used_count, 0) + 1 where upper(code) = upper(p_coupon_code);
  end if;

  if coalesce(p_points_redeemed, 0) > 0 then
    if v_uid is not null then
      update customers set points = greatest(0, coalesce(points, 0) - p_points_redeemed)
      where auth_user_id = v_uid;
    elsif v_phone_norm is not null then
      v_remain := p_points_redeemed;
      for v_cust in
        select id, coalesce(points, 0) as pts
        from customers
        where normalize_eg_phone(phone) = v_phone_norm
          and coalesce(points, 0) > 0
        order by points desc
      loop
        exit when v_remain <= 0;
        v_take := least(v_cust.pts, v_remain);
        update customers set points = greatest(0, coalesce(points, 0) - v_take)
        where id = v_cust.id;
        v_remain := v_remain - v_take;
      end loop;
    end if;
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
      'subtotal', v_computed_subtotal,
      'shipping_cost', v_computed_shipping,
      'discount', v_computed_discount + v_points_discount,
      'points_redeemed', coalesce(p_points_redeemed, 0),
      'total', v_expected_total,
      'payment_method', p_payment_method,
      'delivery_method', p_delivery_method,
      'status', 'pending',
      'payment_status', v_payment_status,
      'payment_proof_url', p_payment_proof_url,
      'deposit_amount', p_deposit_amount,
      'chat_session_id', p_chat_session_id,
      'chat_channel', p_chat_channel,
      'created_at', now()
    ),
    'items', v_items_json
  );
end $$;

grant execute on function create_guest_order(jsonb, jsonb, text, text, text, text, numeric, numeric, numeric, numeric, text, text, numeric, int, text, text) to anon, authenticated;
