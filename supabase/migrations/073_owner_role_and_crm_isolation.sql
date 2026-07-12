-- Three fully-isolated admin roles, per owner's explicit request:
--   admin@montana.com    -> online store admin panel only
--   owner@montana.com    -> owner report only (brand-new role, was
--                            piggybacking on is_store_admin() before)
--   admincrm@montana.com -> CRM (doctors/pharmacies) panel only
-- No account should be able to reach another's panel.

-- ── New, standalone "owner" role (mirrors store_admins' shape) ──
create table if not exists store_owners (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  active     boolean not null default true,
  created_at timestamptz default now()
);

alter table store_owners enable row level security;

drop policy if exists store_owners_self_read on store_owners;
create policy store_owners_self_read on store_owners
  for select to authenticated
  using (user_id = auth.uid());

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from store_owners where user_id = auth.uid() and active
  );
$$;

-- ── Close the store-admin -> CRM bridge (017_crm_store_admin_access.sql).
-- Was: any is_store_admin() user was automatically also a full CRM admin.
-- Now: CRM access requires an actual crm_reps admin row, nothing else.
create or replace function is_crm_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_reps
    where user_id = auth.uid() and role = 'admin' and active
  );
$$;

-- ── owner report data (053_owner_dashboard.sql) now requires is_owner(),
-- not is_store_admin() — a regular store admin can no longer pull it.
-- Body is otherwise byte-identical to 053's version; only the permission
-- check on the first line changed.
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
            when session_id like 'messenger:%' then 'messenger'
            when session_id like 'instagram:%' then 'instagram'
            when session_id like 'whatsapp:%' then 'whatsapp'
            else 'web'
          end as channel,
          count(*)::int as sessions,
          coalesce(sum(jsonb_array_length(coalesce(history_json, '[]'::jsonb))), 0)::int as turns
        from chat_bot_sessions
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

grant execute on function is_owner() to anon, authenticated;
grant execute on function get_owner_dashboard(int, int) to authenticated;

-- ── Link the three accounts to exactly one role each ──
insert into store_admins (user_id, email, active)
values ('b53bc88f-6c0a-4418-b38f-14a6fc7fba8d', 'admin@montana.com', true)
on conflict (user_id) do update set active = true;

insert into store_owners (user_id, email, active)
values ('97efba18-57f4-4385-ac84-d83350474e44', 'owner@montana.com', true)
on conflict (user_id) do update set active = true;

insert into crm_reps (user_id, name, email, role, active)
values ('ca5cf7e6-bc2d-4b6f-8ffe-6623bffd59c3', 'CRM Admin', 'admincrm@montana.com', 'admin', true)
on conflict (email) do update set user_id = excluded.user_id, role = 'admin', active = true;
