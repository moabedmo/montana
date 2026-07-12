-- Pending proof lookup for chat + normalize phone in attach_payment_proof.

create or replace function get_pending_proof_by_session(p_session_id text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('found', false);
  end if;

  select * into v_order from orders
  where chat_session_id = p_session_id
    and status <> 'cancelled'
    and payment_status = 'pending'
    and (payment_proof_url is null or payment_proof_url = '')
  order by created_at desc
  limit 1;

  if not found then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'order_number', v_order.order_number,
    'phone', v_order.customer_phone,
    'total', v_order.total,
    'customer_name', v_order.customer_name
  );
end $$;

grant execute on function get_pending_proof_by_session(text) to anon, authenticated;

create or replace function attach_payment_proof(
  p_order_number text,
  p_phone text,
  p_payment_proof_url text,
  p_deposit_amount numeric default 200
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_items json;
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');

  select * into v_order from orders
  where order_number = p_order_number
    and regexp_replace(customer_phone, '[^\d]', '', 'g') = v_digits
  limit 1;

  if not found then
    return json_build_object('found', false);
  end if;

  update orders set
    payment_proof_url = p_payment_proof_url,
    payment_status = 'awaiting_review',
    deposit_amount = p_deposit_amount,
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
    'created_at', v_order.created_at,
    'items', v_items
  );
end $$;

grant execute on function attach_payment_proof(text, text, text, numeric) to anon, authenticated;
