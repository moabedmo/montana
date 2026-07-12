-- Auto-link CRM products to store catalog + richer rep sample stock (image, price).

-- One-time + callable sync: match crm_products.name to products.name (case-insensitive)
create or replace function sync_crm_store_product_links()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_linked int := 0;
begin
  -- App: CRM admin or rep. SQL Editor / migrations: postgres (no JWT session).
  if not is_crm_admin()
     and current_rep_id() is null
     and coalesce(auth.uid()::text, '') <> ''
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'CRM access only';
  end if;

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

  return json_build_object('linked', v_linked);
end $$;
grant execute on function sync_crm_store_product_links() to authenticated;

-- Resolve store product for a CRM product (explicit link or name match)
create or replace function resolve_crm_store_product(p_crm_product_id uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    cp.store_product_id,
    (
      select p.id
      from products p
      where p.is_active
        and lower(trim(p.name)) = lower(trim(cp.name))
      order by p.id
      limit 1
    )
  )
  from crm_products cp
  where cp.id = p_crm_product_id;
$$;
grant execute on function resolve_crm_store_product(uuid) to authenticated;

-- Rep catalog read (images, prices, stock)
create or replace function list_rep_store_catalog()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if current_rep_id() is null and not is_crm_admin() then
    raise exception 'Rep access only';
  end if;
  return coalesce((
    select json_agg(row_to_json(t) order by t.name)
    from (
      select id, name, price, stock, image_url
      from products
      where is_active
      order by name
      limit 500
    ) t
  ), '[]'::json);
end $$;
grant execute on function list_rep_store_catalog() to authenticated;

-- Richer stock list for visit samples
create or replace function list_rep_sample_stock()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if current_rep_id() is null and not is_crm_admin() then
    raise exception 'Rep access only';
  end if;
  return coalesce((
    select json_agg(row_to_json(t) order by t.crm_name)
    from (
      select
        cp.id as crm_product_id,
        cp.name as crm_name,
        resolve_crm_store_product(cp.id) as store_product_id,
        coalesce(p.stock, 0) as stock_available,
        p.name as store_name,
        p.price as store_price,
        p.image_url,
        (resolve_crm_store_product(cp.id) is not null) as is_linked
      from crm_products cp
      left join products p on p.id = resolve_crm_store_product(cp.id) and p.is_active
      where coalesce(cp.active, true)
      order by cp.name
    ) t
  ), '[]'::json);
end $$;

-- Deduct warehouse stock using resolved store product
create or replace function crm_visit_samples_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_store_id int;
  v_stock int;
  v_name text;
begin
  if new.quantity is null or new.quantity <= 0 then
    return new;
  end if;

  v_store_id := resolve_crm_store_product(new.product_id);

  if v_store_id is null then
    return new;
  end if;

  select stock, name into v_stock, v_name
  from products where id = v_store_id for update;

  if v_stock is null then
    raise exception 'Linked store product not found';
  end if;

  if v_stock < new.quantity then
    raise exception 'Insufficient stock for % (available: %)', v_name, v_stock;
  end if;

  update products set stock = stock - new.quantity where id = v_store_id;
  perform log_stock_movement(
    v_store_id, -new.quantity, 'sample_distribute', 'crm_visit', new.visit_id::text, v_name
  );

  -- Persist name-match link for next time
  update crm_products
  set store_product_id = v_store_id
  where id = new.product_id and store_product_id is null;

  return new;
end $$;

-- One-time auto-link on deploy (inline — avoids auth check in SQL Editor)
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
