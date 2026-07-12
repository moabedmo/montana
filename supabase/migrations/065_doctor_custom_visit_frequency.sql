-- Let the admin set a custom visits/month target per doctor or pharmacy,
-- overriding the generic class-based rule (crm_class_rules). Null/0 = keep
-- using the class default (AB1=4, AB2=3, BB1=2, BB2=1).
alter table crm_doctors
  add column if not exists target_visits_per_month int
  check (target_visits_per_month is null or target_visits_per_month between 0 and 31);

-- Plan generation: prefer the doctor's own target over the class rule.
create or replace function crm_generate_plan(p_month date default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  my_rep uuid := current_rep_id();
  v_month date := coalesce(p_month, date_trunc('month', current_date)::date);
  v_plan uuid;
  v_added int;
begin
  if my_rep is null then
    raise exception 'No active CRM account for this user';
  end if;

  insert into crm_cycle_plans (rep_id, month, status)
    values (my_rep, v_month, 'active')
    on conflict (rep_id, month) do update set status = crm_cycle_plans.status
    returning id into v_plan;

  insert into crm_plan_items (cycle_plan_id, doctor_id, planned_visits, completed_visits)
  select v_plan, d.id,
         coalesce(nullif(d.target_visits_per_month, 0), r.visits_per_month, 1), 0
  from crm_doctors d
  join crm_rep_bricks rb on rb.brick_id = d.brick_id and rb.rep_id = my_rep
  left join crm_class_rules r on r.class = d.class
  where d.approved
    and not exists (
      select 1 from crm_plan_items pi
      where pi.cycle_plan_id = v_plan and pi.doctor_id = d.id);

  get diagnostics v_added = row_count;
  return json_build_object('plan_id', v_plan, 'added', v_added);
end $$;

-- Keep this month's already-generated plan items in sync when the admin
-- changes a doctor's custom visit frequency (or clears it back to auto).
create or replace function crm_sync_doctor_target_visits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_visits_per_month is distinct from old.target_visits_per_month then
    update crm_plan_items pi
    set planned_visits = coalesce(
      nullif(new.target_visits_per_month, 0),
      (select visits_per_month from crm_class_rules where class = new.class),
      1
    )
    from crm_cycle_plans cp
    where pi.cycle_plan_id = cp.id
      and pi.doctor_id = new.id
      and cp.month = date_trunc('month', current_date)::date;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_doctor_target_visits on crm_doctors;
create trigger trg_sync_doctor_target_visits
after update on crm_doctors
for each row execute function crm_sync_doctor_target_visits();
