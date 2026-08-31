-- Persist ManyChat selectedBundle on chat sessions (ad → bundle context).
alter table chat_bot_sessions
  add column if not exists selected_bundle text;

create or replace function get_chat_bot_session(p_session_id text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_row chat_bot_sessions%rowtype;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('found', false);
  end if;
  select * into v_row from chat_bot_sessions where session_id = p_session_id limit 1;
  if not found then
    return json_build_object('found', false);
  end if;
  return json_build_object(
    'found', true,
    'cart', coalesce(v_row.cart_json, '[]'::jsonb),
    'history', coalesce(v_row.history_json, '[]'::jsonb),
    'customer_phone', v_row.customer_phone,
    'customer_name', v_row.customer_name,
    'checkout_wizard', v_row.checkout_wizard_json,
    'order_wizard', v_row.order_wizard_json,
    'chat_channel', v_row.chat_channel,
    'selected_bundle', v_row.selected_bundle
  );
end $$;

create or replace function save_chat_bot_session(
  p_session_id text,
  p_cart jsonb default null,
  p_history jsonb default null,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_checkout_wizard jsonb default null,
  p_order_wizard jsonb default null,
  p_chat_channel text default null,
  p_selected_bundle text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return;
  end if;
  insert into chat_bot_sessions (
    session_id, cart_json, history_json, customer_phone, customer_name,
    checkout_wizard_json, order_wizard_json, chat_channel, selected_bundle, updated_at
  ) values (
    p_session_id,
    coalesce(p_cart, '[]'::jsonb),
    coalesce(p_history, '[]'::jsonb),
    nullif(p_customer_phone, ''),
    nullif(p_customer_name, ''),
    p_checkout_wizard,
    p_order_wizard,
    nullif(p_chat_channel, ''),
    nullif(trim(coalesce(p_selected_bundle, '')), ''),
    now()
  )
  on conflict (session_id) do update set
    cart_json = coalesce(p_cart, chat_bot_sessions.cart_json),
    history_json = coalesce(p_history, chat_bot_sessions.history_json),
    customer_phone = coalesce(nullif(p_customer_phone, ''), chat_bot_sessions.customer_phone),
    customer_name = coalesce(nullif(p_customer_name, ''), chat_bot_sessions.customer_name),
    checkout_wizard_json = p_checkout_wizard,
    order_wizard_json = p_order_wizard,
    chat_channel = coalesce(nullif(p_chat_channel, ''), chat_bot_sessions.chat_channel),
    -- Only overwrite selected_bundle when a non-empty value is provided
    selected_bundle = case
      when p_selected_bundle is not null and length(trim(p_selected_bundle)) > 0
        then trim(p_selected_bundle)
      else chat_bot_sessions.selected_bundle
    end,
    updated_at = now();
end $$;

grant execute on function get_chat_bot_session(text) to anon, authenticated;
grant execute on function save_chat_bot_session(text, jsonb, jsonb, text, text, jsonb, jsonb, text, text) to anon, authenticated;
