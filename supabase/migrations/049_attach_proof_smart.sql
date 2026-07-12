-- One RPC for proof upload: tries session → phone → order number (pending only).

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
  v_digits text;
  v_order_digits text;
begin
  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('found', false, 'error', 'invalid_order_number');
  end if;
  if p_payment_proof_url is null or length(trim(p_payment_proof_url)) = 0 then
    return json_build_object('found', false, 'error', 'invalid_proof_url');
  end if;

  -- 1) Match chat session (web bot orders)
  if p_session_id is not null and length(trim(p_session_id)) > 0 then
    select * into v_order from orders
    where order_number = p_order_number
      and chat_session_id = p_session_id
      and status <> 'cancelled'
    limit 1;
  end if;

  -- 2) Match phone (checkout / fallback)
  if not found and p_phone is not null then
    v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
    if length(v_digits) = 10 and v_digits like '1%' then
      v_digits := '0' || v_digits;
    end if;
    if length(v_digits) >= 10 then
      select * into v_order from orders
      where order_number = p_order_number
        and status <> 'cancelled'
      limit 1;
      if found then
        v_order_digits := regexp_replace(coalesce(v_order.customer_phone, ''), '[^\d]', '', 'g');
        if length(v_order_digits) = 10 and v_order_digits like '1%' then
          v_order_digits := '0' || v_order_digits;
        end if;
        if v_digits <> v_order_digits then
          v_order := null;
        end if;
      end if;
    end if;
  end if;

  -- 3) Pending order by number only (customer sees MON-xxxxx in chat)
  if not found then
    select * into v_order from orders
    where order_number = p_order_number
      and status <> 'cancelled'
      and payment_status = 'pending'
      and coalesce(payment_proof_url, '') = ''
    limit 1;
  end if;

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

-- Auto-set telegram confirm key placeholder (replace with your TELEGRAM_CHAT_ID once).
insert into site_settings (key, value)
values ('telegram_confirm_key', '')
on conflict (key) do nothing;
