-- Week plan: Sat–Thu only (no Friday), and any 1+ days allowed (not all days required).

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
  v_friday date;
begin
  select * into wp from crm_week_plans where id = p_week_plan_id;
  if not found then raise exception 'Week plan not found'; end if;
  if wp.rep_id <> p_rep_id then raise exception 'Not allowed'; end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'Add at least one visit';
  end if;

  v_friday := wp.week_start + 6; -- Saturday week → Friday

  delete from crm_week_plan_days where week_plan_id = wp.id;

  for d in select * from jsonb_array_elements(p_days)
  loop
    v_day := (d->>'day_date')::date;
    v_doctor := (d->>'doctor_id')::uuid;
    v_slot := upper(coalesce(d->>'time_of_day', 'AM'));

    if v_day is null or v_doctor is null or v_slot not in ('AM', 'PM') then
      raise exception 'Incomplete visit data';
    end if;
    if v_day < wp.week_start or v_day > wp.week_end then
      raise exception 'Day is outside the plan week';
    end if;
    -- Friday is not a planning day
    if v_day = v_friday then
      raise exception 'Friday is not included in the week plan';
    end if;

    if not exists (
      select 1 from crm_doctors doc
      join crm_rep_bricks rb on rb.brick_id = doc.brick_id and rb.rep_id = wp.rep_id
      where doc.id = v_doctor and doc.approved and doc.is_active
    ) then
      raise exception 'Client is not available for this rep';
    end if;

    begin
      insert into crm_week_plan_days (week_plan_id, day_date, doctor_id, time_of_day)
      values (wp.id, v_day, v_doctor, v_slot);
    exception when unique_violation then
      raise exception 'Duplicate visit: same client and slot on %', v_day;
    end;

    v_count := v_count + 1;
  end loop;

  if v_count < 1 then
    raise exception 'Add at least one visit';
  end if;

  return v_count;
end $$;

revoke all on function crm_week_plan_write_days(uuid, jsonb, uuid) from public, anon, authenticated;
