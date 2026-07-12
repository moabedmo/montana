-- Rep assigns plan doctors to specific calendar days (drag-and-drop / day picker).
create table if not exists crm_visit_schedule (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references crm_reps(id) on delete cascade,
  plan_item_id uuid not null references crm_plan_items(id) on delete cascade,
  scheduled_date date not null,
  time_of_day text not null default 'AM' check (time_of_day in ('AM', 'PM')),
  created_at timestamptz not null default now(),
  unique (plan_item_id, scheduled_date)
);

create index if not exists crm_visit_schedule_rep_date_idx
  on crm_visit_schedule (rep_id, scheduled_date);

alter table crm_visit_schedule enable row level security;

drop policy if exists visit_schedule_rw on crm_visit_schedule;
create policy visit_schedule_rw on crm_visit_schedule
  for all to authenticated
  using (rep_id = current_rep_id() or is_crm_admin())
  with check (rep_id = current_rep_id() or is_crm_admin());
