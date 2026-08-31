-- Returning-customer profile for the chatbot: look up name / address /
-- governorate / past products by Egyptian mobile, across 01… and 20… forms.

create or replace function normalize_eg_phone(p_phone text)
returns text
language plpgsql immutable as $$
declare
  v text;
begin
  v := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if v like '0020%' then
    v := substring(v from 3);
  end if;
  if v ~ '^20(1[0-9]{9})$' then
    v := '0' || substring(v from 3);
  elsif v ~ '^1[0-9]{9}$' and length(v) = 10 then
    v := '0' || v;
  end if;
  if v ~ '^01[0-9]{9}$' then
    return v;
  end if;
  return null;
end $$;

create or replace function get_customer_profile_by_phone(p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_digits text;
  v_order orders%rowtype;
  v_products json;
  v_order_count int;
begin
  v_digits := normalize_eg_phone(p_phone);
  if v_digits is null then
    return json_build_object('found', false, 'error', 'invalid_phone');
  end if;

  select * into v_order
  from orders o
  where normalize_eg_phone(o.customer_phone) = v_digits
    and o.status <> 'cancelled'
  order by o.created_at desc
  limit 1;

  if not found then
    return json_build_object('found', false, 'phone', v_digits);
  end if;

  select count(*)::int into v_order_count
  from orders o
  where normalize_eg_phone(o.customer_phone) = v_digits
    and o.status <> 'cancelled';

  select coalesce(json_agg(distinct oi.product_name), '[]'::json) into v_products
  from orders o
  join order_items oi on oi.order_id = o.id
  where normalize_eg_phone(o.customer_phone) = v_digits
    and o.status <> 'cancelled';

  return json_build_object(
    'found', true,
    'phone', v_digits,
    'name', v_order.customer_name,
    'address', v_order.address,
    'governorate', v_order.governorate,
    'last_order_number', v_order.order_number,
    'order_count', v_order_count,
    'products', coalesce(v_products, '[]'::json)
  );
end $$;

-- Phone-keyed PII — backend (service_role) only, same as past products.
revoke all on function get_customer_profile_by_phone(text) from public, anon, authenticated;
grant execute on function get_customer_profile_by_phone(text) to service_role;
grant execute on function normalize_eg_phone(text) to service_role, anon, authenticated;

-- Keep past-products matching in sync with 01… / 20… normalization.
create or replace function get_customer_past_products(p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_digits text;
  v_products json;
begin
  v_digits := normalize_eg_phone(p_phone);
  if v_digits is null then
    return json_build_object('found', false);
  end if;

  select coalesce(json_agg(distinct oi.product_name), '[]'::json) into v_products
  from orders o
  join order_items oi on oi.order_id = o.id
  where normalize_eg_phone(o.customer_phone) = v_digits
    and o.status <> 'cancelled';

  if v_products is null or v_products::text = '[]' then
    return json_build_object('found', false);
  end if;

  return json_build_object('found', true, 'products', v_products);
end $$;

revoke all on function get_customer_past_products(text) from public, anon, authenticated;
grant execute on function get_customer_past_products(text) to service_role;
