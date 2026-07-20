-- Link CRM bricks to pharmacy invoice governorates (for invoice picker).

create table if not exists crm_pharmacy_region_bricks (
  region_id uuid not null references crm_pharmacy_regions(id) on delete cascade,
  brick_id uuid not null references crm_bricks(id) on delete cascade,
  primary key (region_id, brick_id)
);

create index if not exists crm_pharmacy_region_bricks_brick_idx
  on crm_pharmacy_region_bricks (brick_id);

alter table crm_pharmacy_region_bricks enable row level security;

drop policy if exists pharmacy_region_bricks_admin on crm_pharmacy_region_bricks;
create policy pharmacy_region_bricks_admin on crm_pharmacy_region_bricks
  for all to authenticated
  using (is_crm_admin() or is_store_admin() or is_invoice_admin())
  with check (is_crm_admin() or is_store_admin() or is_invoice_admin());

grant select, insert, update, delete on crm_pharmacy_region_bricks to authenticated;

-- Seed governorate ↔ brick links from IMS geography
insert into crm_pharmacy_region_bricks (region_id, brick_id)
select g.id, b.id
from crm_pharmacy_regions g
join crm_bricks b on true
join crm_areas a on a.id = b.area_id
join crm_offices o on o.id = a.office_id
where g.region_type = 'governorate'
  and lower(g.name) = 'cairo'
  and (
    o.name = 'CAIRO EAST OFFICE'
    or (
      o.name = 'CAIRO WEST OFFICE'
      and (
        a.name ilike '%cairo%'
        or a.name ilike '%قاهره%'
        or a.name ilike '%معاد%'
        or a.name ilike '%helwan%'
        or a.name ilike '%shobra%'
        or a.name ilike '%شبرا%'
      )
      and a.name not ilike '%giza%'
      and a.name not ilike '%giz%'
      and a.name not ilike '%جيز%'
      and a.name not ilike '%haram%'
      and a.name not ilike '%هرم%'
      and a.name not ilike '%faisal%'
      and a.name not ilike '%فيصل%'
      and a.name not ilike '%imbaba%'
      and a.name not ilike '%امباب%'
    )
  )
on conflict do nothing;

insert into crm_pharmacy_region_bricks (region_id, brick_id)
select g.id, b.id
from crm_pharmacy_regions g
join crm_bricks b on true
join crm_areas a on a.id = b.area_id
join crm_offices o on o.id = a.office_id
where g.region_type = 'governorate'
  and lower(g.name) = 'giza'
  and o.name = 'CAIRO WEST OFFICE'
  and (
    a.name ilike '%giza%'
    or a.name ilike '%giz%'
    or a.name ilike '%جيز%'
    or a.name ilike '%haram%'
    or a.name ilike '%هرم%'
    or a.name ilike '%faisal%'
    or a.name ilike '%فيصل%'
    or a.name ilike '%imbaba%'
    or a.name ilike '%امباب%'
  )
on conflict do nothing;

insert into crm_pharmacy_region_bricks (region_id, brick_id)
select g.id, b.id
from crm_pharmacy_regions g
join crm_bricks b on true
join crm_areas a on a.id = b.area_id
join crm_offices o on o.id = a.office_id
where g.region_type = 'governorate'
  and lower(g.name) = 'alex'
  and o.name = 'ALEX/BEHERA OFFICE'
on conflict do nothing;

insert into crm_pharmacy_region_bricks (region_id, brick_id)
select g.id, b.id
from crm_pharmacy_regions g
join crm_bricks b on true
join crm_areas a on a.id = b.area_id
where g.region_type = 'governorate'
  and lower(g.name) = 'fayoum'
  and (a.name ilike '%fayoum%' or a.name ilike '%فيوم%')
on conflict do nothing;

-- Other: bricks not linked to Cairo/Giza/Alex/Fayoum
insert into crm_pharmacy_region_bricks (region_id, brick_id)
select g.id, b.id
from crm_pharmacy_regions g
cross join crm_bricks b
where g.region_type = 'governorate'
  and lower(g.name) = 'other'
  and not exists (
    select 1 from crm_pharmacy_region_bricks rb
  where rb.brick_id = b.id
    and rb.region_id in (
      select id from crm_pharmacy_regions
      where region_type = 'governorate' and lower(name) in ('cairo', 'giza', 'alex', 'fayoum')
    )
  )
on conflict do nothing;
