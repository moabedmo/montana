-- Lets the chatbot recognize a returning customer (by phone) and mention
-- what they bought before, so the conversation feels continuous instead of
-- starting from zero every time.

create or replace function get_customer_past_products(p_phone text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_digits text;
  v_products json;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if length(v_digits) < 10 then
    return json_build_object('found', false);
  end if;

  select coalesce(json_agg(distinct oi.product_name), '[]'::json) into v_products
  from orders o
  join order_items oi on oi.order_id = o.id
  where regexp_replace(o.customer_phone, '[^\d]', '', 'g') = v_digits
    and o.status <> 'cancelled'
  limit 5;

  if v_products is null or v_products::text = '[]' then
    return json_build_object('found', false);
  end if;

  return json_build_object('found', true, 'products', v_products);
end $$;

-- service_role only: this returns another person's purchase history keyed
-- by phone number alone, so it must never be reachable with the public
-- anon key (which ships in client-side JS) — only our own backend, which
-- holds the service role key, may call it.
revoke all on function get_customer_past_products(text) from public, anon, authenticated;
grant execute on function get_customer_past_products(text) to service_role;
