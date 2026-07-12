-- Final fix: attach proof by order number only (always works for chat).

create or replace function attach_payment_proof_smart(
  p_order_number text,
  p_payment_proof_url text,
  p_deposit_amount numeric default 200,
  p_session_id text default null,
  p_phone text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_items json;
begin
  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('found', false, 'error', 'invalid_order_number');
  end if;
  if p_payment_proof_url is null or length(trim(p_payment_proof_url)) = 0 then
    return json_build_object('found', false, 'error', 'invalid_proof_url');
  end if;

  select * into v_order from orders
  where order_number = p_order_number
    and status <> 'cancelled'
  limit 1;

  if not found then
    return json_build_object('found', false, 'error', 'not_found');
  end if;

  update orders set
    payment_proof_url = p_payment_proof_url,
    payment_status = 'awaiting_review',
    deposit_amount = coalesce(p_deposit_amount, 200),
    updated_at = now()
  where id = v_order.id;

  select json_agg(oi) into v_items from order_items oi where oi.order_id = v_order.id;

  return json_build_object(
    'found', true,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', 'awaiting_review',
    'payment_method', v_order.payment_method,
    'total', v_order.total,
    'customer_phone', v_order.customer_phone,
    'customer_name', v_order.customer_name,
    'created_at', v_order.created_at,
    'items', v_items
  );
end $$;

grant execute on function attach_payment_proof_smart(text, text, numeric, text, text) to anon, authenticated;
