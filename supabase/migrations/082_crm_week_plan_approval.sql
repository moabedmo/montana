-- Week plans: multi visits/day + admin approve/reject before plan is usable.

-- ── Extra review columns ───────────────────────────────────────────────────
alter table crm_week_plans
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references crm_reps(id) on delete set null,
  add column if not exists rejection_note text;

-- Status: draft → pending → approved | rejected (legacy locked → approved)
alter table crm_week_plans drop constraint if exists crm_week_plans_status_check;
alter table crm_week_plans
  add constraint crm_week_plans_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'locked'));

update crm_week_plans set status = 'approved' where status = 'locked';

alter table crm_week_plans drop constraint if exists crm_week_plans_status_check;
alter table crm_week_plans
  add constraint crm_week_plans_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected'));

-- Allow multiple doctors / pharmacies per day (unique per day+doctor+slot)
alter table crm_week_plan_days
  drop constraint if exists crm_week_plan_days_week_plan_id_day_date_key;

alter table crm_week_plan_days
  drop constraint if exists crm_week_plan_days_unique_slot;

alter table crm_week_plan_days
  add constraint crm_week_plan_days_unique_slot
  unique (week_plan_id, day_date, doctor_id, time_of_day);

-- Days editable only while draft (submit/review use SECURITY DEFINER)
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

-- ── Shared: write day rows from jsonb (no schedule sync) ───────────────────
create or replace function crm_week_plan_write_days(p_week_plan_id uuid, p_days jsonb, p_rep_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  wp crm_week_plans%rowtype;
  d jsonb;
  v_day date;
  v_doctor uuid;
  v_slot text;
  v_count int := 0;
  day_counts jsonb := '{}'::jsonb;
  v_dates date[];
  i int;
begin
  select * into wp from crm_week_plans where id = p_week_plan_id;
  if not found then raise exception 'Week plan not found'; end if;
  if wp.rep_id <> p_rep_id then raise exception 'Not allowed'; end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'لازم تضيف زيارة واحدة على الأقل';
  end if;

  delete from crm_week_plan_days where week_plan_id = wp.id;

  for d in select * from jsonb_array_elements(p_days)
  loop
    v_day := (d->>'day_date')::date;
    v_doctor := (d->>'doctor_id')::uuid;
    v_slot := upper(coalesce(d->>'time_of_day', 'AM'));

    if v_day is null or v_doctor is null or v_slot not in ('AM', 'PM') then
      raise exception 'بيانات زيارة ناقصة';
    end if;
    if v_day < wp.week_start or v_day > wp.week_end then
      raise exception 'اليوم خارج أسبوع الخطة';
    end if;

    if not exists (
      select 1 from crm_doctors doc
      join crm_rep_bricks rb on rb.brick_id = doc.brick_id and rb.rep_id = wp.rep_id
      where doc.id = v_doctor and doc.approved and doc.is_active
    ) then
      raise exception 'عميل غير متاح للمندوب';
    end if;

    begin
      insert into crm_week_plan_days (week_plan_id, day_date, doctor_id, time_of_day)
      values (wp.id, v_day, v_doctor, v_slot);
    exception when unique_violation then
      raise exception 'زيارة مكررة: نفس العميل ونفس الموعد في يوم %', v_day;
    end;

    v_count := v_count + 1;
    day_counts := jsonb_set(
      day_counts,
      array[v_day::text],
      to_jsonb(coalesce((day_counts->>v_day::text)::int, 0) + 1)
    );
  end loop;

  -- Each Sat–Fri day must have ≥1 visit
  v_dates := array[
    wp.week_start,
    wp.week_start + 1,
    wp.week_start + 2,
    wp.week_start + 3,
    wp.week_start + 4,
    wp.week_start + 5,
    wp.week_start + 6
  ];
  for i in 1..7 loop
    if coalesce((day_counts->>v_dates[i]::text)::int, 0) < 1 then
      raise exception 'لازم تملي كل يوم من السبت للجمعة (يوم % ناقص)', v_dates[i];
    end if;
  end loop;

  return v_count;
end $$;

-- Sync approved days into monthly plan + visit_schedule
create or replace function crm_week_plan_sync_schedule(p_week_plan_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  wp crm_week_plans%rowtype;
  r record;
  v_month date;
  v_plan uuid;
  v_item uuid;
  v_count int := 0;
begin
  select * into wp from crm_week_plans where id = p_week_plan_id;
  if not found then raise exception 'Week plan not found'; end if;

  for r in
    select day_date, doctor_id, time_of_day
    from crm_week_plan_days
    where week_plan_id = wp.id
  loop
    v_month := date_trunc('month', r.day_date)::date;
    insert into crm_cycle_plans (rep_id, month, status)
      values (wp.rep_id, v_month, 'active')
      on conflict (rep_id, month) do update set status = crm_cycle_plans.status
      returning id into v_plan;

    select id into v_item from crm_plan_items
      where cycle_plan_id = v_plan and doctor_id = r.doctor_id;
    if v_item is null then
      insert into crm_plan_items (cycle_plan_id, doctor_id, planned_visits, completed_visits)
      values (v_plan, r.doctor_id, 1, 0)
      returning id into v_item;
    else
      update crm_plan_items set planned_visits = greatest(planned_visits, 1)
        where id = v_item;
    end if;

    insert into crm_visit_schedule (rep_id, plan_item_id, scheduled_date, time_of_day)
    values (wp.rep_id, v_item, r.day_date, r.time_of_day)
    on conflict (plan_item_id, scheduled_date, time_of_day) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Rep submits plan for admin approval (no schedule until approved)
create or replace function crm_submit_week_plan(p_week_plan_id uuid, p_days jsonb)
returns json
language plpgsql security definer set search_path = public as $$
declare
  my_rep uuid := current_rep_id();
  wp crm_week_plans%rowtype;
  v_count int;
begin
  if my_rep is null then raise exception 'No active CRM account'; end if;

  select * into wp from crm_week_plans where id = p_week_plan_id for update;
  if not found then raise exception 'Week plan not found'; end if;
  if wp.rep_id <> my_rep then raise exception 'Not allowed'; end if;
  if wp.status not in ('draft', 'rejected') then
    raise exception 'الخطة مش مسودة — مينفعش إرسالها تاني';
  end if;

  -- Rejected rebuild starts clean as draft write
  if wp.status = 'rejected' then
    update crm_week_plans
      set status = 'draft', rejection_note = null, reviewed_at = null, reviewed_by = null
      where id = wp.id;
  end if;

  v_count := crm_week_plan_write_days(wp.id, p_days, my_rep);

  update crm_week_plans
    set status = 'pending',
        submitted_at = now(),
        locked_at = null,
        rejection_note = null,
        reviewed_at = null,
        reviewed_by = null
    where id = wp.id;

  return json_build_object(
    'ok', true,
    'week_plan_id', wp.id,
    'status', 'pending',
    'days', v_count,
    'week_start', wp.week_start,
    'week_end', wp.week_end
  );
end $$;

-- Admin approve / reject
create or replace function crm_review_week_plan(
  p_week_plan_id uuid,
  p_action text,
  p_note text default null
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  admin_rep uuid := current_rep_id();
  wp crm_week_plans%rowtype;
  v_synced int := 0;
  v_action text := lower(trim(p_action));
begin
  if not is_crm_admin() then
    raise exception 'Admin only';
  end if;

  select * into wp from crm_week_plans where id = p_week_plan_id for update;
  if not found then raise exception 'Week plan not found'; end if;
  if wp.status <> 'pending' then
    raise exception 'الخطة مش في انتظار الموافقة';
  end if;

  if v_action = 'approve' then
    v_synced := crm_week_plan_sync_schedule(wp.id);
    update crm_week_plans
      set status = 'approved',
          locked_at = now(),
          reviewed_at = now(),
          reviewed_by = admin_rep,
          rejection_note = null
      where id = wp.id;

    return json_build_object(
      'ok', true,
      'status', 'approved',
      'week_plan_id', wp.id,
      'synced', v_synced
    );
  elsif v_action = 'reject' then
    update crm_week_plans
      set status = 'rejected',
          reviewed_at = now(),
          reviewed_by = admin_rep,
          rejection_note = nullif(trim(coalesce(p_note, '')), ''),
          locked_at = null
      where id = wp.id;

    return json_build_object(
      'ok', true,
      'status', 'rejected',
      'week_plan_id', wp.id,
      'note', p_note
    );
  else
    raise exception 'action must be approve or reject';
  end if;
end $$;

-- Rep starts over after rejection (clears days → draft)
create or replace function crm_reset_rejected_week_plan(p_week_plan_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  my_rep uuid := current_rep_id();
  wp crm_week_plans%rowtype;
begin
  if my_rep is null then raise exception 'No active CRM account'; end if;
  select * into wp from crm_week_plans where id = p_week_plan_id for update;
  if not found then raise exception 'Week plan not found'; end if;
  if wp.rep_id <> my_rep and not is_crm_admin() then raise exception 'Not allowed'; end if;
  if wp.status <> 'rejected' then
    raise exception 'مينفعش إعادة البناء إلا بعد الرفض';
  end if;

  delete from crm_week_plan_days where week_plan_id = wp.id;
  update crm_week_plans
    set status = 'draft',
        rejection_note = null,
        reviewed_at = null,
        reviewed_by = null,
        submitted_at = null,
        locked_at = null
    where id = wp.id;

  return json_build_object('ok', true, 'status', 'draft', 'week_plan_id', wp.id);
end $$;

-- Keep old lock RPC as submit+auto-approve for backwards compat? No — redirect to submit only.
-- Admins who call lock still get pending; use review separately.
drop function if exists crm_lock_week_plan(uuid, jsonb);
create or replace function crm_lock_week_plan(p_week_plan_id uuid, p_days jsonb)
returns json
language plpgsql security definer set search_path = public as $$
begin
  -- Legacy name: now submits for approval
  return crm_submit_week_plan(p_week_plan_id, p_days);
end $$;

grant execute on function crm_submit_week_plan(uuid, jsonb) to authenticated;
grant execute on function crm_review_week_plan(uuid, text, text) to authenticated;
grant execute on function crm_reset_rejected_week_plan(uuid) to authenticated;
grant execute on function crm_lock_week_plan(uuid, jsonb) to authenticated;

-- Internal helpers: not directly callable by clients
revoke all on function crm_week_plan_write_days(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function crm_week_plan_sync_schedule(uuid) from public, anon, authenticated;
