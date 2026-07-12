-- Confirm order from Telegram without Supabase service_role key.
-- Set site_settings.telegram_confirm_key = your TELEGRAM_CHAT_ID (same value as Vercel env).

insert into site_settings (key, value)
values ('telegram_confirm_key', '')
on conflict (key) do nothing;

create or replace function confirm_order_by_number(p_order_number text, p_confirm_key text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_msg text;
  v_expected text;
begin
  select value into v_expected from site_settings where key = 'telegram_confirm_key' limit 1;
  if coalesce(v_expected, '') = '' or coalesce(p_confirm_key, '') = '' or p_confirm_key <> v_expected then
    return json_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('ok', false, 'error', 'invalid_order_number');
  end if;

  select * into v_order from orders where order_number = p_order_number limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_order.payment_status = 'confirmed' and v_order.status = 'confirmed' then
    return json_build_object(
      'ok', true,
      'already', true,
      'order_number', v_order.order_number,
      'chat_session_id', v_order.chat_session_id,
      'chat_channel', v_order.chat_channel,
      'customer_phone', v_order.customer_phone
    );
  end if;

  v_msg := format(
    'تم تأكيد طلبك **%s** بنجاح ✅%sشكراً لثقتك في Montana 💜',
    v_order.order_number,
    E'\n'
  );

  update orders set
    payment_status = 'confirmed',
    status = 'confirmed',
    pending_customer_message = v_msg,
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return json_build_object(
    'ok', true,
    'already', false,
    'order_number', v_order.order_number,
    'chat_session_id', v_order.chat_session_id,
    'chat_channel', v_order.chat_channel,
    'customer_phone', v_order.customer_phone,
    'customer_name', v_order.customer_name,
    'pending_message', v_msg
  );
end $$;

revoke all on function confirm_order_by_number(text, text) from public;
grant execute on function confirm_order_by_number(text, text) to anon, authenticated;
