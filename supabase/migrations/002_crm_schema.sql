-- ============================================================
-- Montana CRM Schema
-- ============================================================

-- Offices (Cairo East, Delta, Alex, etc.)
create table if not exists crm_offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Areas (Heliopolis I, Nasr City, etc.)
create table if not exists crm_areas (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references crm_offices(id),
  name text not null,
  ims_area_no int,
  market_share numeric(6,4)
);

-- Bricks (B1, B2, Dakahlia 1, etc.)
create table if not exists crm_bricks (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references crm_areas(id),
  name text not null,
  description text,
  market_share numeric(6,4)
);

-- Reps
create table if not exists crm_reps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text unique not null,
  phone text,
  territory text,
  office_id uuid references crm_offices(id),
  role text not null default 'rep' check (role in ('rep','admin')),
  active boolean default true,
  created_at timestamptz default now()
);

-- Rep ↔ Brick assignments
create table if not exists crm_rep_bricks (
  rep_id uuid references crm_reps(id),
  brick_id uuid references crm_bricks(id),
  primary key (rep_id, brick_id)
);

-- Doctors & Pharmacies (HCOs)
create table if not exists crm_doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  brick_id uuid references crm_bricks(id),
  org_type text,                         -- PRIVATE CLINIC, PHARMACY, HOSPITAL...
  class text check (class in ('AB1','AB2','BB1','BB2')),
  specialty text,
  lat numeric(10,7),
  lng numeric(10,7),
  location_verified boolean default false,
  added_by uuid references crm_reps(id),
  approved boolean default true,
  notes text,
  created_at timestamptz default now()
);

-- Products
create table if not exists crm_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean default true
);

-- eDetailing materials
create table if not exists crm_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references crm_products(id),
  title text not null,
  type text check (type in ('pdf','image','video_url')),
  url text not null,
  active boolean default true,
  uploaded_at timestamptz default now()
);

-- Cycle Plans (monthly)
create table if not exists crm_cycle_plans (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid references crm_reps(id),
  month date not null,               -- first day of month
  status text default 'active' check (status in ('draft','active','closed')),
  created_at timestamptz default now(),
  unique(rep_id, month)
);

-- Planned visits per doctor per cycle
create table if not exists crm_plan_items (
  id uuid primary key default gen_random_uuid(),
  cycle_plan_id uuid references crm_cycle_plans(id) on delete cascade,
  doctor_id uuid references crm_doctors(id),
  planned_visits int not null default 1,
  completed_visits int default 0
);

-- Actual Visit Reports
create table if not exists crm_visits (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid references crm_reps(id),
  doctor_id uuid references crm_doctors(id),
  plan_item_id uuid references crm_plan_items(id),
  visited_at timestamptz default now(),
  -- GPS
  lat numeric(10,7),
  lng numeric(10,7),
  distance_from_doctor int,            -- metres
  gps_verified boolean default false,
  -- Report
  notes text,
  -- Competitor mentions
  competitor_products text[],          -- ['Competitor A', 'Competitor B']
  created_at timestamptz default now()
);

-- Samples distributed per visit
create table if not exists crm_visit_samples (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references crm_visits(id) on delete cascade,
  product_id uuid references crm_products(id),
  quantity int not null default 0
);

-- Products discussed per visit
create table if not exists crm_visit_products (
  visit_id uuid references crm_visits(id) on delete cascade,
  product_id uuid references crm_products(id),
  primary key (visit_id, product_id)
);

-- eDetailing shown per visit
create table if not exists crm_visit_materials (
  visit_id uuid references crm_visits(id) on delete cascade,
  material_id uuid references crm_materials(id),
  seconds_viewed int default 0,
  primary key (visit_id, material_id)
);

-- ============================================================
-- Class → visits/month rule
-- ============================================================
create table if not exists crm_class_rules (
  class text primary key,
  visits_per_month int not null
);
insert into crm_class_rules values
  ('AB1', 4), ('AB2', 3), ('BB1', 2), ('BB2', 1)
on conflict do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table crm_doctors    enable row level security;
alter table crm_visits     enable row level security;
alter table crm_cycle_plans enable row level security;
alter table crm_plan_items  enable row level security;
alter table crm_visit_samples enable row level security;

-- Reps can only see their own visits and plans
create policy "reps_own_visits" on crm_visits
  for all using (rep_id = (select id from crm_reps where user_id = auth.uid()));

create policy "reps_own_plans" on crm_cycle_plans
  for all using (rep_id = (select id from crm_reps where user_id = auth.uid()));

-- Doctors: rep can see doctors in their bricks
create policy "reps_see_their_doctors" on crm_doctors
  for select using (
    brick_id in (
      select brick_id from crm_rep_bricks
      where rep_id = (select id from crm_reps where user_id = auth.uid())
    )
  );

-- ============================================================
-- Leaderboard view
-- ============================================================
create or replace view crm_leaderboard as
select
  r.id as rep_id,
  r.name,
  r.territory,
  count(v.id) as total_visits,
  count(v.id) filter (where v.gps_verified) as verified_visits,
  sum(s.quantity) as total_samples,
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
where r.active = true
group by r.id, r.name, r.territory
order by total_visits desc;
