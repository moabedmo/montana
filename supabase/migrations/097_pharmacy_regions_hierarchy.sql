-- Hierarchical pharmacy regions (governorate → area/city → specific pharmacy)
-- + mandatory phone & pharmacy address on invoices (enforced in app; legacy rows exempt).

create table if not exists crm_pharmacy_regions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references crm_pharmacy_regions(id) on delete cascade,
  name text not null,
  region_type text not null
    check (region_type in ('governorate', 'area', 'pharmacy')),
  phone text,
  address text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_pharmacy_regions_parent_type check (
    (region_type = 'governorate' and parent_id is null)
    or (region_type in ('area', 'pharmacy') and parent_id is not null)
  )
);

create index if not exists crm_pharmacy_regions_parent_idx
  on crm_pharmacy_regions (parent_id);

create unique index if not exists crm_pharmacy_regions_name_parent_uidx
  on crm_pharmacy_regions (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));

alter table crm_pharmacy_invoices
  add column if not exists region_id uuid references crm_pharmacy_regions(id) on delete set null,
  add column if not exists pharmacy_phone text,
  add column if not exists pharmacy_address text;

create index if not exists crm_pharmacy_invoices_region_id_idx
  on crm_pharmacy_invoices (region_id);

-- Full path label: "Cairo / Downtown / Pharmacy X"
create or replace function crm_pharmacy_region_path(p_id uuid)
returns text
language sql stable set search_path = public as $$
  with recursive chain as (
    select id, parent_id, name, 1 as depth
    from crm_pharmacy_regions
    where id = p_id
    union all
    select r.id, r.parent_id, r.name, c.depth + 1
    from crm_pharmacy_regions r
    join chain c on c.parent_id = r.id
  )
  select string_agg(name, ' / ' order by depth desc)
  from chain;
$$;

create or replace function crm_pharmacy_region_governorate_id(p_id uuid)
returns uuid
language sql stable set search_path = public as $$
  with recursive chain as (
    select id, parent_id, region_type
    from crm_pharmacy_regions
    where id = p_id
    union all
    select r.id, r.parent_id, r.region_type
    from crm_pharmacy_regions r
    join chain c on c.id = r.parent_id
  )
  select id from chain where region_type = 'governorate' limit 1;
$$;

create or replace function crm_pharmacy_invoice_region_sync()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.region_id is not null then
    new.region := crm_pharmacy_region_path(new.region_id);
  end if;

  if tg_op = 'INSERT' and coalesce(new.is_legacy, false) is not true then
    if nullif(trim(coalesce(new.pharmacy_phone, '')), '') is null then
      raise exception 'Pharmacy phone is required';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_crm_pharmacy_invoice_region_sync on crm_pharmacy_invoices;
create trigger trg_crm_pharmacy_invoice_region_sync
  before insert or update on crm_pharmacy_invoices
  for each row execute function crm_pharmacy_invoice_region_sync();

create or replace function crm_pharmacy_regions_touch()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_crm_pharmacy_regions_touch on crm_pharmacy_regions;
create trigger trg_crm_pharmacy_regions_touch
  before insert or update on crm_pharmacy_regions
  for each row execute function crm_pharmacy_regions_touch();

alter table crm_pharmacy_regions enable row level security;

drop policy if exists pharmacy_regions_admin on crm_pharmacy_regions;
create policy pharmacy_regions_admin on crm_pharmacy_regions
  for all to authenticated
  using (is_crm_admin() or is_store_admin() or is_invoice_admin())
  with check (is_crm_admin() or is_store_admin() or is_invoice_admin());

-- Seed governorates + warehouse areas from legacy flat list
insert into crm_pharmacy_regions (name, region_type, sort_order)
select v.name, 'governorate', v.ord
from (values
  ('Giza', 1),
  ('Cairo', 2),
  ('Alex', 3),
  ('Fayoum', 4),
  ('Other', 99)
) as v(name, ord)
where not exists (
  select 1 from crm_pharmacy_regions r
  where r.parent_id is null and lower(r.name) = lower(v.name)
);

insert into crm_pharmacy_regions (parent_id, name, region_type, sort_order)
select g.id, v.area, 'area', v.ord
from (values
  ('Giza', 'مخازن Giza', 1),
  ('Cairo', 'مخازن Cairo', 1)
) as v(gov, area, ord)
join crm_pharmacy_regions g on g.parent_id is null and lower(g.name) = lower(v.gov)
where not exists (
  select 1 from crm_pharmacy_regions r
  where r.parent_id = g.id and lower(r.name) = lower(v.area)
);

-- Link existing invoices to seeded regions by exact region text match
alter table crm_pharmacy_invoices disable trigger trg_crm_pharmacy_invoice_region_sync;

update crm_pharmacy_invoices i
set region_id = r.id,
    region = crm_pharmacy_region_path(r.id)
from crm_pharmacy_regions r
where i.region_id is null
  and i.region is not null
  and lower(trim(i.region)) = lower(trim(r.name));

update crm_pharmacy_invoices i
set region_id = r.id,
    region = crm_pharmacy_region_path(r.id)
from crm_pharmacy_regions g
join crm_pharmacy_regions r on r.parent_id = g.id
where i.region_id is null
  and i.region is not null
  and lower(trim(i.region)) = lower(trim(r.name));

alter table crm_pharmacy_invoices enable trigger trg_crm_pharmacy_invoice_region_sync;

grant select, insert, update, delete on crm_pharmacy_regions to authenticated;
