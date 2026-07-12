-- ============================================================
-- Montana CRM — Hardening & Features Upgrade
-- Run in Supabase → SQL Editor (safe to re-run; idempotent)
--
-- 1. is_crm_admin() / current_rep_id() helpers
-- 2. Server-side GPS verification (trigger — client values ignored)
-- 3. Atomic completed_visits increment (trigger — no race)
-- 4. Idempotent visit submission (client_id + unique index)
-- 5. Visit photo support (photo_url)
-- 6. Full RLS on every crm_* table
-- 7. Auto plan generation from class rules (RPC)
-- 8. Push notification subscriptions table
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. Helpers (SECURITY DEFINER so they bypass RLS
--    and can be used inside policies without recursion)
-- ───────────────────────────────────────────────
create or replace function is_crm_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_reps
    where user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function current_rep_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from crm_reps where user_id = auth.uid() and active limit 1;
$$;

-- ───────────────────────────────────────────────
-- 2+3+4+5. Visit columns & triggers
-- ───────────────────────────────────────────────
alter table crm_visits
  add column if not exists client_id uuid,
  add column if not exists photo_url text;

-- one row per client-generated id → offline flush can never duplicate
create unique index if not exists crm_visits_client_id_key
  on crm_visits (client_id) where client_id is not null;

-- BEFORE INSERT: force rep identity from the JWT and compute GPS
-- verification server-side. Whatever the client sends in
-- gps_verified / distance_from_doctor is discarded.
create or replace function crm_visits_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  doc record;
  my_rep uuid;
begin
  my_rep := current_rep_id();
  if not is_crm_admin() then
    if my_rep is null then
      raise exception 'No active CRM account for this user';
    end if;
    new.rep_id := my_rep;  -- client cannot submit visits as another rep
  end if;

  new.gps_verified := false;
  new.distance_from_doctor := null;

  select lat, lng into doc from crm_doctors where id = new.doctor_id;

  if new.lat is not null and new.lng is not null then
    if doc.lat is not null and doc.lng is not null then
      -- haversine, metres
      new.distance_from_doctor := round(
        2 * 6371000 * asin( sqrt(
          power(sin(radians(new.lat - doc.lat) / 2), 2) +
          cos(radians(doc.lat)) * cos(radians(new.lat)) *
          power(sin(radians(new.lng - doc.lng) / 2), 2)
        ))
      )::int;
      new.gps_verified := new.distance_from_doctor <= 150;
    else
      -- first ever visit to this doctor: location gets recorded (below)
      new.gps_verified := true;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_crm_visits_before_insert on crm_visits;
create trigger trg_crm_visits_before_insert
  before insert on crm_visits
  for each row execute function crm_visits_before_insert();

-- AFTER INSERT: atomic plan-item increment + first-visit doctor location
create or replace function crm_visits_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan_item_id is not null then
    update crm_plan_items
      set completed_visits = coalesce(completed_visits, 0) + 1
      where id = new.plan_item_id;
  end if;

  if new.lat is not null and new.lng is not null then
    update crm_doctors
      set lat = new.lat, lng = new.lng, location_verified = true
      where id = new.doctor_id and lat is null;
  end if;

  return new;
end $$;

drop trigger if exists trg_crm_visits_after_insert on crm_visits;
create trigger trg_crm_visits_after_insert
  after insert on crm_visits
  for each row execute function crm_visits_after_insert();

-- ───────────────────────────────────────────────
-- 6. Row Level Security — every crm table
-- ───────────────────────────────────────────────
alter table crm_offices          enable row level security;
alter table crm_areas            enable row level security;
alter table crm_bricks           enable row level security;
alter table crm_reps             enable row level security;
alter table crm_rep_bricks       enable row level security;
alter table crm_doctors          enable row level security;
alter table crm_products         enable row level security;
alter table crm_materials        enable row level security;
alter table crm_cycle_plans      enable row level security;
alter table crm_plan_items       enable row level security;
alter table crm_visits           enable row level security;
alter table crm_visit_samples    enable row level security;
alter table crm_visit_products   enable row level security;
alter table crm_visit_materials  enable row level security;
alter table crm_class_rules      enable row level security;

-- ── Reference data: read for all signed-in users, write admin-only ──
do $$
declare t text;
begin
  foreach t in array array['crm_offices','crm_areas','crm_bricks','crm_products','crm_materials','crm_class_rules','crm_rep_bricks']
  loop
    execute format('drop policy if exists ref_read on %I', t);
    execute format('drop policy if exists ref_admin_write on %I', t);
    execute format('create policy ref_read on %I for select to authenticated using (true)', t);
    execute format('create policy ref_admin_write on %I for all to authenticated using (is_crm_admin()) with check (is_crm_admin())', t);
  end loop;
end $$;

-- ── crm_reps: see own row; admin manages everyone.
--    Reps can NOT update their own row (no role/territory self-escalation).
drop policy if exists reps_self_read   on crm_reps;
drop policy if exists reps_admin_all   on crm_reps;
create policy reps_self_read on crm_reps
  for select to authenticated
  using (user_id = auth.uid() or is_crm_admin());
create policy reps_admin_all on crm_reps
  for all to authenticated
  using (is_crm_admin()) with check (is_crm_admin());

-- ── crm_doctors ──
drop policy if exists "reps_see_their_doctors" on crm_doctors;
drop policy if exists doctors_read         on crm_doctors;
drop policy if exists doctors_rep_insert   on crm_doctors;
drop policy if exists doctors_admin_update on crm_doctors;
drop policy if exists doctors_admin_delete on crm_doctors;

create policy doctors_read on crm_doctors
  for select to authenticated
  using (
    is_crm_admin()
    or added_by = current_rep_id()
    or (approved and brick_id in (
         select brick_id from crm_rep_bricks where rep_id = current_rep_id()))
  );

-- reps may add doctors but only as pending (approved = false);
-- doctor coordinates are only ever written by the visit trigger or an admin
create policy doctors_rep_insert on crm_doctors
  for insert to authenticated
  with check (
    is_crm_admin()
    or (added_by = current_rep_id() and approved = false and lat is null and lng is null)
  );

create policy doctors_admin_update on crm_doctors
  for update to authenticated
  using (is_crm_admin()) with check (is_crm_admin());

create policy doctors_admin_delete on crm_doctors
  for delete to authenticated
  using (is_crm_admin());

-- ── crm_visits: reps read + insert their own; only admins update/delete
--    (reps can no longer approve their own flagged visits)
drop policy if exists "reps_own_visits"    on crm_visits;
drop policy if exists visits_read          on crm_visits;
drop policy if exists visits_rep_insert    on crm_visits;
drop policy if exists visits_admin_update  on crm_visits;
drop policy if exists visits_admin_delete  on crm_visits;

create policy visits_read on crm_visits
  for select to authenticated
  using (rep_id = current_rep_id() or is_crm_admin());
create policy visits_rep_insert on crm_visits
  for insert to authenticated
  with check (rep_id = current_rep_id() or is_crm_admin());
create policy visits_admin_update on crm_visits
  for update to authenticated
  using (is_crm_admin()) with check (is_crm_admin());
create policy visits_admin_delete on crm_visits
  for delete to authenticated
  using (is_crm_admin());

-- ── crm_cycle_plans ──
drop policy if exists "reps_own_plans" on crm_cycle_plans;
drop policy if exists plans_rw on crm_cycle_plans;
create policy plans_rw on crm_cycle_plans
  for all to authenticated
  using (rep_id = current_rep_id() or is_crm_admin())
  with check (rep_id = current_rep_id() or is_crm_admin());

-- ── crm_plan_items: items of plans you own ──
drop policy if exists plan_items_rw on crm_plan_items;
create policy plan_items_rw on crm_plan_items
  for all to authenticated
  using (
    is_crm_admin() or exists (
      select 1 from crm_cycle_plans cp
      where cp.id = cycle_plan_id and cp.rep_id = current_rep_id())
  )
  with check (
    is_crm_admin() or exists (
      select 1 from crm_cycle_plans cp
      where cp.id = cycle_plan_id and cp.rep_id = current_rep_id())
  );

-- ── visit child tables: rows of your own visits ──
do $$
declare t text;
begin
  foreach t in array array['crm_visit_samples','crm_visit_products','crm_visit_materials']
  loop
    execute format('drop policy if exists visit_children_rw on %I', t);
    execute format($p$
      create policy visit_children_rw on %I
        for all to authenticated
        using (
          is_crm_admin() or exists (
            select 1 from crm_visits v
            where v.id = visit_id and v.rep_id = current_rep_id())
        )
        with check (
          is_crm_admin() or exists (
            select 1 from crm_visits v
            where v.id = visit_id and v.rep_id = current_rep_id())
        )
    $p$, t);
  end loop;
end $$;

-- ───────────────────────────────────────────────
-- 7. Auto plan generation from class rules
--    (AB1→4, AB2→3, BB1→2, BB2→1 visits/month by default)
-- ───────────────────────────────────────────────
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
  select v_plan, d.id, coalesce(r.visits_per_month, 1), 0
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

-- ───────────────────────────────────────────────
-- 8. Push notification subscriptions
-- ───────────────────────────────────────────────
create table if not exists crm_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  rep_id     uuid references crm_reps(id) on delete cascade,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);

alter table crm_push_subscriptions enable row level security;

drop policy if exists push_own on crm_push_subscriptions;
create policy push_own on crm_push_subscriptions
  for all to authenticated
  using (rep_id = current_rep_id() or is_crm_admin())
  with check (rep_id = current_rep_id() or is_crm_admin());

-- ───────────────────────────────────────────────
-- Storage: allow signed-in reps to upload visit photos
-- (bucket "montana", folder crm-visits/)
-- ───────────────────────────────────────────────
drop policy if exists crm_visit_photos_upload on storage.objects;
create policy crm_visit_photos_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'montana' and name like 'crm-visits/%');
