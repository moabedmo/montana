-- Double visit: optional manager accompaniment on field visits.

alter table crm_visits
  add column if not exists manager_id uuid references crm_reps(id) on delete set null;

create index if not exists crm_visits_manager_idx on crm_visits (manager_id)
  where manager_id is not null;

-- Reps may read active CRM managers (for double-visit picker)
drop policy if exists reps_read_managers on crm_reps;
create policy reps_read_managers on crm_reps
  for select to authenticated
  using (role = 'admin' and active = true);
