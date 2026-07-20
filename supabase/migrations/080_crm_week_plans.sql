-- Weekly plans (Sat→Fri) + doctor is_active for rep availability.

-- ── Doctors: Active flag (admin toggles; reps only see active) ─────────────
alter table crm_doctors
  add column if not exists is_active boolean not null default true;

create index if not exists crm_doctors_is_active_idx on crm_doctors (is_active);

-- Reps may only read approved+active doctors in their bricks (admins see all).
drop policy if exists doctors_read on crm_doctors;
create policy doctors_read on crm_doctors
  for select to authenticated
  using (
    is_crm_admin()
    or added_by = current_rep_id()
    or (approved and is_active and brick_id in (
         select brick_id from crm_rep_bricks where rep_id = current_rep_id()))
  );

-- Plan generation: only active doctors
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
  where d.approved and d.is_active
    and not exists (
      select 1 from crm_plan_items pi
      where pi.cycle_plan_id = v_plan and pi.doctor_id = d.id);

  get diagnostics v_added = row_count;
  return json_build_object('plan_id', v_plan, 'added', v_added);
end $$;

-- ── Weekly plans ───────────────────────────────────────────────────────────
create table if not exists crm_week_plans (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references crm_reps(id) on delete cascade,
  week_start date not null, -- Saturday
  week_end date not null,   -- Friday
  status text not null default 'draft' check (status in ('draft', 'locked')),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (rep_id, week_start),
  check (week_end = week_start + 6)
);

create table if not exists crm_week_plan_days (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references crm_week_plans(id) on delete cascade,
  day_date date not null,
  doctor_id uuid not null references crm_doctors(id),
  time_of_day text not null check (time_of_day in ('AM', 'PM')),
  created_at timestamptz not null default now(),
  unique (week_plan_id, day_date)
);

create index if not exists crm_week_plans_rep_idx on crm_week_plans (rep_id, week_start desc);
create index if not exists crm_week_plan_days_plan_idx on crm_week_plan_days (week_plan_id);

alter table crm_week_plans enable row level security;
alter table crm_week_plan_days enable row level security;

drop policy if exists week_plans_rw on crm_week_plans;
create policy week_plans_rw on crm_week_plans
  for all to authenticated
  using (rep_id = current_rep_id() or is_crm_admin())
  with check (rep_id = current_rep_id() or is_crm_admin());

drop policy if exists week_plan_days_rw on crm_week_plan_days;
create policy week_plan_days_rw on crm_week_plan_days
  for all to authenticated
  using (
    exists (
      select 1 from crm_week_plans wp
      where wp.id = week_plan_id
        and (wp.rep_id = current_rep_id() or is_crm_admin())
    )
  )
  with check (
    exists (
      select 1 from crm_week_plans wp
      where wp.id = week_plan_id
        and wp.status = 'draft'
        and (wp.rep_id = current_rep_id() or is_crm_admin())
    )
  );

-- Cairo-local Saturday week start
create or replace function crm_week_start_sat(p_date date default null)
returns date
language sql stable set search_path = public as $$
  select (
    coalesce(p_date, (timezone('Africa/Cairo', now()))::date)
    - ((extract(dow from coalesce(p_date, (timezone('Africa/Cairo', now()))::date))::int + 1) % 7)
  )::date;
$$;

-- Save days (draft only) then lock. Syncs into monthly plan + visit_schedule.
create or replace function crm_lock_week_plan(p_week_plan_id uuid, p_days jsonb)
returns json
language plpgsql security definer set search_path = public as $$
declare
  my_rep uuid := current_rep_id();
  wp crm_week_plans%rowtype;
  d jsonb;
  v_day date;
  v_doctor uuid;
  v_slot text;
  v_month date;
  v_plan uuid;
  v_item uuid;
  v_count int := 0;
  seen_dates date[] := '{}';
begin
  if my_rep is null and not is_crm_admin() then
    raise exception 'No active CRM account';
  end if;

  select * into wp from crm_week_plans where id = p_week_plan_id;
  if not found then raise exception 'Week plan not found'; end if;
  if wp.rep_id <> my_rep and not is_crm_admin() then
    raise exception 'Not allowed';
  end if;
  if wp.status = 'locked' then
    raise exception 'الخطة مقفلة بالفعل — مينفعش تعديل';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'لازم تملي أيام الأسبوع';
  end if;

  -- Replace draft days
  delete from crm_week_plan_days where week_plan_id = wp.id;

  for d in select * from jsonb_array_elements(p_days)
  loop
    v_day := (d->>'day_date')::date;
    v_doctor := (d->>'doctor_id')::uuid;
    v_slot := upper(d->>'time_of_day');

    if v_day is null or v_doctor is null or v_slot not in ('AM', 'PM') then
      raise exception 'بيانات يوم ناقصة';
    end if;
    if v_day < wp.week_start or v_day > wp.week_end then
      raise exception 'اليوم خارج أسبوع الخطة';
    end if;
    if v_day = any (seen_dates) then
      raise exception 'يوم مكرر: %', v_day;
    end if;
    seen_dates := array_append(seen_dates, v_day);

    -- Doctor must be active + approved + in rep territory
    if not exists (
      select 1 from crm_doctors doc
      join crm_rep_bricks rb on rb.brick_id = doc.brick_id and rb.rep_id = wp.rep_id
      where doc.id = v_doctor and doc.approved and doc.is_active
    ) then
      raise exception 'دكتور غير متاح للمندوب';
    end if;

    insert into crm_week_plan_days (week_plan_id, day_date, doctor_id, time_of_day)
    values (wp.id, v_day, v_doctor, v_slot);
    v_count := v_count + 1;

    -- Sync into monthly cycle plan + visit schedule (so check-in keeps working)
    v_month := date_trunc('month', v_day)::date;
    insert into crm_cycle_plans (rep_id, month, status)
      values (wp.rep_id, v_month, 'active')
      on conflict (rep_id, month) do update set status = crm_cycle_plans.status
      returning id into v_plan;

    select id into v_item from crm_plan_items
      where cycle_plan_id = v_plan and doctor_id = v_doctor;
    if v_item is null then
      insert into crm_plan_items (cycle_plan_id, doctor_id, planned_visits, completed_visits)
      values (v_plan, v_doctor, 1, 0)
      returning id into v_item;
    else
      update crm_plan_items set planned_visits = greatest(planned_visits, 1)
        where id = v_item;
    end if;

    insert into crm_visit_schedule (rep_id, plan_item_id, scheduled_date, time_of_day)
    values (wp.rep_id, v_item, v_day, v_slot)
    on conflict (plan_item_id, scheduled_date, time_of_day) do nothing;
  end loop;

  -- Require full Sat–Fri (7 days)
  if v_count <> 7 then
    raise exception 'لازم تملي الأيام السبعة (السبت للجمعة)';
  end if;

  update crm_week_plans
    set status = 'locked', locked_at = now()
    where id = wp.id;

  return json_build_object(
    'ok', true,
    'week_plan_id', wp.id,
    'days', v_count,
    'week_start', wp.week_start,
    'week_end', wp.week_end
  );
end $$;

grant execute on function crm_week_start_sat(date) to authenticated;
grant execute on function crm_lock_week_plan(uuid, jsonb) to authenticated;
