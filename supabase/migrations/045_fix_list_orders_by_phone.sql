-- Fix: PostgreSQL cannot compare json with = ; use text cast for empty check.

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
