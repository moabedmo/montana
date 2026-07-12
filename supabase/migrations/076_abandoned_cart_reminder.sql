-- Abandoned-cart reminder for Messenger/Instagram customers: adds a
-- "did we already remind them" flag, and two service_role-only RPCs to
-- find eligible sessions and mark them once reminded. Kept off anon/
-- authenticated since these expose session_id (-> ManyChat contact id)
-- and cart contents in bulk, not scoped to one caller's own session.

alter table chat_bot_sessions
  add column if not exists cart_reminder_sent_at timestamptz;

create or replace function get_abandoned_carts()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rows json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select session_id, cart_json, chat_channel
    from chat_bot_sessions
    where chat_channel in ('messenger', 'instagram')
      and jsonb_array_length(coalesce(cart_json, '[]'::jsonb)) > 0
      and cart_reminder_sent_at is null
      and updated_at <= now() - interval '3 hours'
      and updated_at > now() - interval '4 hours'
  ) t;

  return v_rows;
end $$;

create or replace function mark_cart_reminder_sent(p_session_id text)
returns void
language sql security definer set search_path = public as $$
  update chat_bot_sessions set cart_reminder_sent_at = now() where session_id = p_session_id;
$$;

revoke all on function get_abandoned_carts() from public, anon, authenticated;
revoke all on function mark_cart_reminder_sent(text) from public, anon, authenticated;
grant execute on function get_abandoned_carts() to service_role;
grant execute on function mark_cart_reminder_sent(text) to service_role;
