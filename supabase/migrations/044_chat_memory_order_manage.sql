-- Chat bot memory (cart + conversation) + order cancel/modify by phone verification.

-- ── Persistent chat sessions (cart, history, wizards) ──
create table if not exists chat_bot_sessions (
  session_id   text primary key,
  cart_json    jsonb not null default '[]'::jsonb,
  history_json jsonb not null default '[]'::jsonb,
  customer_phone text,
  customer_name  text,
  checkout_wizard_json jsonb,
  order_wizard_json    jsonb,
  updated_at   timestamptz not null default now()
);

alter table chat_bot_sessions enable row level security;

-- No direct table access for anon — RPC only.

create or replace function get_chat_bot_session(p_session_id text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_row chat_bot_sessions%rowtype;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('found', false);
  end if;
  select * into v_row from chat_bot_sessions where session_id = p_session_id limit 1;
  if not found then
    return json_build_object('found', false);
  end if;
  return json_build_object(
    'found', true,
    'cart', coalesce(v_row.cart_json, '[]'::jsonb),
    'history', coalesce(v_row.history_json, '[]'::jsonb),
    'customer_phone', v_row.customer_phone,
    'customer_name', v_row.customer_name,
    'checkout_wizard', v_row.checkout_wizard_json,
    'order_wizard', v_row.order_wizard_json,
    'updated_at', v_row.updated_at
  );
end $$;

create or replace function save_chat_bot_session(
  p_session_id text,
  p_cart jsonb default null,
  p_history jsonb default null,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_checkout_wizard jsonb default null,
  p_order_wizard jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return;
  end if;
  insert into chat_bot_sessions (
    session_id, cart_json, history_json, customer_phone, customer_name,
    checkout_wizard_json, order_wizard_json, updated_at
  ) values (
    p_session_id,
    coalesce(p_cart, '[]'::jsonb),
    coalesce(p_history, '[]'::jsonb),
    nullif(p_customer_phone, ''),
    nullif(p_customer_name, ''),
    p_checkout_wizard,
    p_order_wizard,
    now()
  )
  on conflict (session_id) do update set
    cart_json = coalesce(p_cart, chat_bot_sessions.cart_json),
    history_json = coalesce(p_history, chat_bot_sessions.history_json),
    customer_phone = coalesce(nullif(p_customer_phone, ''), chat_bot_sessions.customer_phone),
    customer_name = coalesce(nullif(p_customer_name, ''), chat_bot_sessions.customer_name),
    checkout_wizard_json = p_checkout_wizard,
    order_wizard_json = p_order_wizard,
    updated_at = now();
end $$;

grant execute on function get_chat_bot_session(text) to anon, authenticated;
grant execute on function save_chat_bot_session(text, jsonb, jsonb, text, text, jsonb, jsonb) to anon, authenticated;

-- ── List recent orders by phone ──
create or replace function list_orders_by_phone(p_phone text, p_limit int default 5)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_digits text;
  v_rows json;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if length(v_digits) < 10 then
    return json_build_object('found', false, 'error', 'invalid_phone');
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      o.order_number,
      o.status,
      o.payment_status,
      o.total,
      o.created_at,
      o.address,
      o.governorate
    from orders o
    where regexp_replace(o.customer_phone, '[^\d]', '', 'g') = v_digits
      and o.status <> 'cancelled'
    order by o.created_at desc
    limit greatest(1, least(coalesce(p_limit, 5), 10))
  ) t;

  if v_rows is null or v_rows::text = '[]' then
    return json_build_object('found', false);
  end if;

  return json_build_object('found', true, 'orders', v_rows);
end $$;

grant execute on function list_orders_by_phone(text, int) to anon, authenticated;

-- ── Cancel order (phone must match) + restore stock ──
create or replace function cancel_order_by_phone(p_order_number text, p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_digits text;
  v_item record;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('ok', false, 'error', 'invalid_order_number');
  end if;
  if length(v_digits) < 10 then
    return json_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select * into v_order from orders
  where order_number = p_order_number
    and regexp_replace(customer_phone, '[^\d]', '', 'g') = v_digits
  limit 1;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_order.status = 'cancelled' then
    return json_build_object('ok', true, 'already', true, 'order_number', v_order.order_number);
  end if;

  if v_order.status in ('shipped', 'delivered', 'preparing') then
    return json_build_object('ok', false, 'error', 'cannot_cancel', 'status', v_order.status);
  end if;

  for v_item in select product_id, quantity from order_items where order_id = v_order.id loop
    update products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;

  update orders set
    status = 'cancelled',
    payment_status = case when payment_status = 'confirmed' then payment_status else 'pending' end,
    updated_at = now()
  where id = v_order.id;

  return json_build_object(
    'ok', true,
    'order_number', v_order.order_number,
    'status', 'cancelled'
  );
end $$;

grant execute on function cancel_order_by_phone(text, text) to anon, authenticated;

-- ── Update delivery details on modifiable orders ──
create or replace function update_order_delivery_by_phone(
  p_order_number text,
  p_phone text,
  p_address text default null,
  p_governorate text default null,
  p_customer_name text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_digits text;
  v_gov record;
  v_shipping numeric;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('ok', false, 'error', 'invalid_order_number');
  end if;

  select * into v_order from orders
  where order_number = p_order_number
    and regexp_replace(customer_phone, '[^\d]', '', 'g') = v_digits
  limit 1;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_order.status in ('shipped', 'delivered', 'cancelled', 'preparing') then
    return json_build_object('ok', false, 'error', 'cannot_modify', 'status', v_order.status);
  end if;

  v_shipping := v_order.shipping_cost;
  if p_governorate is not null and length(trim(p_governorate)) > 0 then
    select * into v_gov from shipping_rates
    where governorate ilike '%' || trim(p_governorate) || '%' and is_active
    limit 1;
    if not found then
      return json_build_object('ok', false, 'error', 'invalid_governorate');
    end if;
    v_shipping := v_gov.cost;
  end if;

  update orders set
    address = coalesce(nullif(trim(p_address), ''), address),
    governorate = coalesce(v_gov.governorate, governorate),
    city = coalesce(v_gov.governorate, city),
    customer_name = coalesce(nullif(trim(p_customer_name), ''), customer_name),
    shipping_cost = v_shipping,
    total = subtotal - discount + v_shipping,
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return json_build_object(
    'ok', true,
    'order_number', v_order.order_number,
    'address', v_order.address,
    'governorate', v_order.governorate,
    'total', v_order.total,
    'status', v_order.status
  );
end $$;

grant execute on function update_order_delivery_by_phone(text, text, text, text, text) to anon, authenticated;

-- ── Load order items into a new cart (after cancel, for re-order flow) ──
create or replace function get_order_items_for_cart(p_order_number text, p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_digits text;
  v_items json;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  select * into v_order from orders
  where order_number = p_order_number
    and regexp_replace(customer_phone, '[^\d]', '', 'g') = v_digits
  limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  select json_agg(json_build_object(
    'id', oi.product_id,
    'name', oi.product_name,
    'price', oi.price,
    'qty', oi.quantity,
    'image', oi.product_image
  )) into v_items
  from order_items oi where oi.order_id = v_order.id;
  return json_build_object('ok', true, 'items', coalesce(v_items, '[]'::json));
end $$;

grant execute on function get_order_items_for_cart(text, text) to anon, authenticated;
