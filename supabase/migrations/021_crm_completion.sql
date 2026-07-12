-- Montana CRM — completion fixes (visit fields, day logs, leaderboard, storage)
-- Idempotent — safe to re-run.

-- ── 1. Visit / doctor columns (was in crm/supabase-upgrade.sql) ──
alter table crm_visits
  add column if not exists time_of_day text default 'AM',
  add column if not exists visit_type  text default 'regular';

alter table crm_doctors
  add column if not exists doctor_type text default 'doctor';

-- ── 2. Day logs ──
create table if not exists crm_day_logs (
  id         uuid primary key default gen_random_uuid(),
  rep_id     uuid references crm_reps(id) on delete cascade,
  log_date   date not null default current_date,
  day_type   text not null,
  notes      text,
  created_at timestamptz default now(),
  unique(rep_id, log_date)
);

alter table crm_day_logs enable row level security;

drop policy if exists rep_see_own_daylogs on crm_day_logs;
drop policy if exists rep_insert_daylogs on crm_day_logs;
drop policy if exists rep_update_daylogs on crm_day_logs;
drop policy if exists admin_all_daylogs on crm_day_logs;
drop policy if exists daylogs_rep_rw on crm_day_logs;
drop policy if exists daylogs_admin_all on crm_day_logs;

create policy daylogs_rep_rw on crm_day_logs
  for all to authenticated
  using (rep_id = current_rep_id() or is_crm_admin())
  with check (rep_id = current_rep_id() or is_crm_admin());

-- ── 3. Leaderboard view — security definer so reps see all peers ──
drop view if exists crm_leaderboard;

create or replace view crm_leaderboard
with (security_invoker = false)
as
select
  r.id as rep_id,
  r.name,
  r.territory,
  count(v.id) as total_visits,
  count(v.id) filter (where v.gps_verified) as verified_visits,
  coalesce(sum(s.quantity), 0) as total_samples,
  round(
    count(v.id)::numeric /
    nullif((
      select sum(pi.planned_visits)
      from crm_plan_items pi
      join crm_cycle_plans cp on pi.cycle_plan_id = cp.id
      where cp.rep_id = r.id
        and cp.month = date_trunc('month', current_date)
    ), 0) * 100, 1
  ) as coverage_pct
from crm_reps r
left join crm_visits v on v.rep_id = r.id
  and v.visited_at >= date_trunc('month', current_date)
left join crm_visit_samples s on s.visit_id = v.id
where r.active = true and r.role = 'rep'
group by r.id, r.name, r.territory
order by total_visits desc;

grant select on crm_leaderboard to authenticated;

-- ── 4. Storage: eDetailing material uploads (CRM admin) ──
drop policy if exists crm_materials_upload on storage.objects;
create policy crm_materials_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'montana'
    and name like 'crm-materials/%'
    and is_crm_admin()
  );

drop policy if exists crm_materials_read on storage.objects;
create policy crm_materials_read on storage.objects
  for select to authenticated
  using (bucket_id = 'montana' and name like 'crm-materials/%');

drop policy if exists crm_visit_photos_read on storage.objects;
create policy crm_visit_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'montana' and name like 'crm-visits/%');
