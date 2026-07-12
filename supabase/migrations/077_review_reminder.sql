-- Real-review collection: 3-4 days after an order is marked "delivered",
-- nudge Messenger/Instagram customers (the only channels we can message
-- back into post-purchase) for a genuine review, with a one-time 30 EGP
-- coupon as an incentive. Mirrors the abandoned-cart-reminder pattern
-- (migration 076): service_role-only RPCs, no anon/authenticated access,
-- since these expose chat_session_id (-> ManyChat contact id) in bulk.

alter table orders
  add column if not exists review_reminder_sent_at timestamptz;

create or replace function get_orders_awaiting_review_reminder()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rows json;
begin
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      o.id as order_id,
      o.order_number,
      o.chat_session_id,
      o.chat_channel,
      (
        select coalesce(json_agg(json_build_object('name', oi.product_name, 'slug', p.slug)), '[]'::json)
        from order_items oi
        left join products p on p.id = oi.product_id
        where oi.order_id = o.id
      ) as items
    from orders o
    where o.status = 'delivered'
      and o.chat_channel in ('messenger', 'instagram')
      and o.chat_session_id is not null
      and o.review_reminder_sent_at is null
      and o.updated_at <= now() - interval '3 days'
      and o.updated_at > now() - interval '4 days'
  ) t;

  return v_rows;
end $$;

create or replace function mark_review_reminder_sent(p_order_id int)
returns void
language sql security definer set search_path = public as $$
  update orders set review_reminder_sent_at = now() where id = p_order_id;
$$;

revoke all on function get_orders_awaiting_review_reminder() from public, anon, authenticated;
revoke all on function mark_review_reminder_sent(int) from public, anon, authenticated;
grant execute on function get_orders_awaiting_review_reminder() to service_role;
grant execute on function mark_review_reminder_sent(int) to service_role;
