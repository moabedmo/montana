-- ════════════════════════════════════════════════════════════
-- Attach a payment-proof screenshot to an ALREADY-CREATED order
-- ════════════════════════════════════════════════════════════
-- Needed for the chat-bot ordering flow: the bot creates the order
-- first (create_guest_order, no proof yet), asks the customer to
-- transfer the deposit and upload a screenshot, then this RPC
-- attaches it to that same order — same order_number+phone
-- "lightweight token" pattern as get_order_status(). Also usable
-- from checkout.html's flow in principle, though checkout currently
-- uploads the proof before creating the order in one step.
-- ════════════════════════════════════════════════════════════

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
begin
  select * into v_order from orders
    where order_number = p_order_number and customer_phone = p_phone
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
