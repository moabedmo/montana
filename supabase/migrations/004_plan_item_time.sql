-- Reps build their own schedules: each planned doctor gets an AM/PM slot
-- chosen by the rep (pre-fills the check-in screen).
alter table crm_plan_items
  add column if not exists preferred_time text default 'AM';

update crm_plan_items set preferred_time = 'AM' where preferred_time is null;
