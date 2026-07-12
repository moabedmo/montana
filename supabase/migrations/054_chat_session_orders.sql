-- Orders + line items for a chat session (bot order summary / modify flows).

create or replace function list_orders_by_chat_session(p_session_id text, p_limit int default 3)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rows json;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('found', false);
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      o.order_number,
      o.status,
      o.payment_status,
      o.total,
      o.subtotal,
      o.shipping_cost,
      o.created_at,
      o.customer_phone,
      (
        select coalesce(json_agg(json_build_object(
          'id', oi.product_id,
          'name', oi.product_name,
          'price', oi.price,
          'qty', oi.quantity
        ) order by oi.id), '[]'::json)
        from order_items oi
        where oi.order_id = o.id
      ) as items
    from orders o
    where o.chat_session_id = p_session_id
      and o.status <> 'cancelled'
    order by o.created_at desc
    limit greatest(1, least(coalesce(p_limit, 3), 5))
  ) t;

  if v_rows is null or v_rows::text = '[]' then
    return json_build_object('found', false);
  end if;

  return json_build_object('found', true, 'orders', v_rows);
end $$;

grant execute on function list_orders_by_chat_session(text, int) to anon, authenticated;
