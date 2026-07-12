-- Owner dashboard's channel breakdown classified chat sessions purely by
-- session_id prefix ('messenger:'/'instagram:'), a scheme from before
-- ManyChat was introduced. ManyChat unifies Facebook + Instagram under one
-- 'manychat:<contact id>' prefix (contact IDs aren't platform-specific),
-- so every ManyChat-sourced session silently fell through the dashboard's
-- classification and showed as 0 for both channels. Fix: store an explicit
-- channel hint (now sent by each ManyChat automation) instead of trying to
-- infer it from session_id alone.

alter table chat_bot_sessions add column if not exists chat_channel text;

create or replace function save_chat_bot_session(
  p_session_id text,
  p_cart jsonb default null,
  p_history jsonb default null,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_checkout_wizard jsonb default null,
  p_order_wizard jsonb default null,
  p_chat_channel text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return;
  end if;
  insert into chat_bot_sessions (
    session_id, cart_json, history_json, customer_phone, customer_name,
    checkout_wizard_json, order_wizard_json, chat_channel, updated_at
  ) values (
    p_session_id,
    coalesce(p_cart, '[]'::jsonb),
    coalesce(p_history, '[]'::jsonb),
    nullif(p_customer_phone, ''),
    nullif(p_customer_name, ''),
    p_checkout_wizard,
    p_order_wizard,
    nullif(p_chat_channel, ''),
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
    updated_at = now();
end $$;

grant execute on function save_chat_bot_session(text, jsonb, jsonb, text, text, jsonb, jsonb, text) to anon, authenticated;

-- ── Owner dashboard channel breakdown now prefers the stored hint ──
create or replace function get_owner_dashboard(
  p_year int default null,
  p_month int default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_period_label text;
  v_store json;
  v_inventory json;
  v_invoices json;
  v_crm json;
  v_channels json;
  v_recent json;
  v_low_stock json;
begin
  if not is_owner() then
    raise exception 'Owner access only';
  end if;

  if p_year is null or p_month is null then
    v_start := date_trunc('month', now());
    v_end := v_start + interval '1 month';
  else
    v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Africa/Cairo');
    v_end := v_start + interval '1 month';
  end if;

  v_period_label := to_char(v_start, 'YYYY-MM');

  select json_build_object(
    'products_active', (select count(*)::int from products where is_active),
    'customers_total', (select count(*)::int from customers),
    'orders_all_time', (select count(*)::int from orders where status <> 'cancelled'),
    'orders_month', (select count(*)::int from orders where created_at >= v_start and created_at < v_end and status <> 'cancelled'),
    'revenue_all_time', coalesce((select sum(total) from orders where status <> 'cancelled'), 0),
    'revenue_month', coalesce((select sum(total) from orders where created_at >= v_start and created_at < v_end and status <> 'cancelled'), 0),
    'pending_orders', (select count(*)::int from orders where status = 'pending'),
    'contact_messages', (select count(*)::int from contact_messages),
    'contact_messages_month', (select count(*)::int from contact_messages where created_at >= v_start and created_at < v_end)
  ) into v_store;

  select json_build_object(
    'total_units', coalesce((select sum(stock)::bigint from products where is_active), 0),
    'skus_active', (select count(*)::int from products where is_active),
    'low_stock_count', (select count(*)::int from products where is_active and stock > 0 and stock < 50),
    'out_of_stock_count', (select count(*)::int from products where is_active and stock <= 0)
  ) into v_inventory;

  select json_build_object(
    'count_month', (select count(*)::int from invoices where invoice_date >= v_start::date and invoice_date < v_end::date),
    'revenue_month', coalesce((select sum(total) from invoices where invoice_date >= v_start::date and invoice_date < v_end::date), 0),
    'count_all_time', (select count(*)::int from invoices)
  ) into v_invoices;

  select json_build_object(
    'active_reps', (select count(*)::int from crm_reps where active and role = 'rep'),
    'admins', (select count(*)::int from crm_reps where active and role = 'admin'),
    'visits_mtd', (select count(*)::int from crm_visits where visited_at >= date_trunc('month', current_date)),
    'pending_doctors', (select count(*)::int from crm_doctors where not approved),
    'pending_b2b', (select count(*)::int from crm_visits where b2b_invoice_status = 'pending'),
    'doctors_total', (select count(*)::int from crm_doctors where approved)
  ) into v_crm;

  select coalesce(json_agg(row_to_json(t) order by t.sort), '[]'::json)
  into v_channels
  from (
    select * from (
      select
        ch.key as channel,
        ch.label_ar as label,
        ch.icon as icon,
        ch.sort as sort,
        coalesce(o.cnt, 0)::int as orders,
        coalesce(s.sessions, 0)::int as chat_sessions,
        coalesce(s.turns, 0)::int as chat_turns
      from (
        values
          ('web', 'الموقع / الشات', 'fa-globe', 1),
          ('messenger', 'Messenger', 'fa-facebook-messenger', 2),
          ('instagram', 'Instagram', 'fa-instagram', 3),
          ('whatsapp', 'WhatsApp', 'fa-whatsapp', 4)
      ) as ch(key, label_ar, icon, sort)
      left join (
        select coalesce(nullif(chat_channel, ''), 'web') as channel, count(*)::int as cnt
        from orders
        where created_at >= v_start and created_at < v_end and status <> 'cancelled'
        group by 1
      ) o on o.channel = ch.key
      left join (
        select
          case
            when cbs.chat_channel = 'messenger' then 'messenger'
            when cbs.chat_channel = 'instagram' then 'instagram'
            when cbs.chat_channel = 'whatsapp' then 'whatsapp'
            when cbs.session_id like 'messenger:%' then 'messenger'
            when cbs.session_id like 'instagram:%' then 'instagram'
            when cbs.session_id like 'whatsapp:%' then 'whatsapp'
            else 'web'
          end as channel,
          count(*)::int as sessions,
          coalesce(sum(jsonb_array_length(coalesce(history_json, '[]'::jsonb))), 0)::int as turns
        from chat_bot_sessions cbs
        where updated_at >= v_start and updated_at < v_end
        group by 1
      ) s on s.channel = ch.key
    ) x
  ) t;

  select coalesce(json_agg(row_to_json(r) order by r.created_at desc), '[]'::json)
  into v_recent
  from (
    select order_number, customer_name, total, status, chat_channel, created_at
    from orders
    where status <> 'cancelled'
    order by created_at desc
    limit 8
  ) r;

  select coalesce((
    select json_agg(row_to_json(t) order by t.stock asc)
    from (
      select id, name, stock, price
      from products
      where is_active and stock < 50
      order by stock asc
      limit 8
    ) t
  ), '[]'::json) into v_low_stock;

  return json_build_object(
    'period', json_build_object(
      'year', extract(year from v_start)::int,
      'month', extract(month from v_start)::int,
      'label', v_period_label
    ),
    'store', v_store,
    'inventory', v_inventory,
    'invoices', v_invoices,
    'crm', v_crm,
    'channels', v_channels,
    'recent_orders', v_recent,
    'low_stock', v_low_stock
  );
end $$;

grant execute on function get_owner_dashboard(int, int) to authenticated;
