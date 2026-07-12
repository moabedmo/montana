-- Seed CRM product catalog from the live store (images/stock/prices live on products table).
-- Fixes empty rep sample list when crm_products was never populated.

create or replace function ensure_crm_products_from_store()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_inserted int := 0;
  v_linked int := 0;
begin
  -- CRM admin, rep app, or SQL Editor (postgres)
  if not is_crm_admin()
     and current_rep_id() is null
     and coalesce(auth.uid()::text, '') <> ''
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'CRM access only';
  end if;

  -- Link existing CRM rows by exact name
  with matched as (
    select distinct on (cp.id)
      cp.id as crm_id,
      p.id as store_id
    from crm_products cp
    join products p on p.is_active
      and lower(trim(cp.name)) = lower(trim(p.name))
    where cp.store_product_id is null
    order by cp.id, p.id
  )
  update crm_products cp
  set store_product_id = m.store_id
  from matched m
  where cp.id = m.crm_id;

  get diagnostics v_linked = row_count;

  -- Create CRM product for every active store SKU not yet represented
  insert into crm_products (name, description, active, store_product_id)
  select
    p.name,
    nullif(left(trim(coalesce(p.description, '')), 500), ''),
    true,
    p.id
  from products p
  where p.is_active
    and not exists (
      select 1 from crm_products cp where cp.store_product_id = p.id
    )
    and not exists (
      select 1 from crm_products cp where lower(trim(cp.name)) = lower(trim(p.name))
    );

  get diagnostics v_inserted = row_count;

  return json_build_object(
    'inserted', v_inserted,
    'linked', v_linked,
    'crm_total', (select count(*)::int from crm_products where coalesce(active, true)),
    'store_total', (select count(*)::int from products where is_active)
  );
end $$;
grant execute on function ensure_crm_products_from_store() to authenticated;

-- Combined sync used by admin UI
create or replace function sync_crm_store_product_links()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v json;
begin
  v := ensure_crm_products_from_store();
  return v;
end $$;

-- One-time seed on deploy
insert into crm_products (name, description, active, store_product_id)
select
  p.name,
  nullif(left(trim(coalesce(p.description, '')), 500), ''),
  true,
  p.id
from products p
where p.is_active
  and not exists (
    select 1 from crm_products cp where cp.store_product_id = p.id
  )
  and not exists (
    select 1 from crm_products cp where lower(trim(cp.name)) = lower(trim(p.name))
  );

update crm_products cp
set store_product_id = m.store_id
from (
  select distinct on (cp2.id)
    cp2.id as crm_id,
    p.id as store_id
  from crm_products cp2
  join products p on p.is_active
    and lower(trim(cp2.name)) = lower(trim(p.name))
  where cp2.store_product_id is null
  order by cp2.id, p.id
) m
where cp.id = m.crm_id;
