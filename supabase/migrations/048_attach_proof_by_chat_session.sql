-- Attach payment proof using chat session (avoids phone mismatch in chat widget).

create or replace function attach_payment_proof_for_chat(
  p_order_number text,
  p_session_id text,
  p_payment_proof_url text,
  p_deposit_amount numeric default 200
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_items json;
begin
  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('found', false, 'error', 'invalid_order_number');
  end if;
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('found', false, 'error', 'invalid_session');
  end if;

  select * into v_order from orders
  where order_number = p_order_number
    and chat_session_id = p_session_id
    and status <> 'cancelled'
  limit 1;

  if not found then
    return json_build_object('found', false, 'error', 'not_found');
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
    'customer_phone', v_order.customer_phone,
    'customer_name', v_order.customer_name,
    'created_at', v_order.created_at,
    'items', v_items
  );
end $$;

grant execute on function attach_payment_proof_for_chat(text, text, text, numeric) to anon, authenticated;

-- Stronger phone matching for checkout / legacy attach.
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
  v_order_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if length(v_digits) = 10 and v_digits like '1%' then
    v_digits := '0' || v_digits;
  end if;

  select * into v_order from orders
  where order_number = p_order_number
  limit 1;

  if not found then
    return json_build_object('found', false, 'error', 'not_found');
  end if;

  v_order_digits := regexp_replace(coalesce(v_order.customer_phone, ''), '[^\d]', '', 'g');
  if length(v_order_digits) = 10 and v_order_digits like '1%' then
    v_order_digits := '0' || v_order_digits;
  end if;

  if v_digits <> v_order_digits then
    return json_build_object('found', false, 'error', 'phone_mismatch');
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
    'customer_phone', v_order.customer_phone,
    'customer_name', v_order.customer_name,
    'created_at', v_order.created_at,
    'items', v_items
  );
end $$;

grant execute on function attach_payment_proof(text, text, text, numeric) to anon, authenticated;
