-- Sample custody: the admin hands out a running allotment of samples to each
-- rep (drawn from the shared warehouse stock), and can see per-rep balances
-- plus what's still left centrally. When a rep logs samples given to a
-- doctor during a visit, that now draws down from THEIR OWN custody instead
-- of the shared warehouse (which already left the warehouse at allocation
-- time) — replacing the 056 trigger that deducted straight from `products`.

create table if not exists crm_rep_sample_custody (
  rep_id uuid not null references crm_reps(id) on delete cascade,
  product_id uuid not null references crm_products(id) on delete cascade,
  quantity int not null default 0,
  updated_at timestamptz default now(),
  primary key (rep_id, product_id)
);

-- Audit trail of every admin allocation (positive = given to rep, negative =
-- reclaimed back to the warehouse).
create table if not exists crm_sample_allocations (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references crm_reps(id) on delete cascade,
  product_id uuid not null references crm_products(id) on delete cascade,
  quantity int not null check (quantity <> 0),
  allocated_by uuid references crm_reps(id),
  note text,
  created_at timestamptz default now()
);

alter table crm_rep_sample_custody enable row level security;
alter table crm_sample_allocations enable row level security;

drop policy if exists "reps_see_own_custody" on crm_rep_sample_custody;
create policy "reps_see_own_custody" on crm_rep_sample_custody
  for select using (
    rep_id = current_rep_id() or is_crm_admin()
  );

drop policy if exists "admin_manage_custody" on crm_rep_sample_custody;
create policy "admin_manage_custody" on crm_rep_sample_custody
  for all using (is_crm_admin()) with check (is_crm_admin());

drop policy if exists "reps_see_own_allocations" on crm_sample_allocations;
create policy "reps_see_own_allocations" on crm_sample_allocations
  for select using (
    rep_id = current_rep_id() or is_crm_admin()
  );

drop policy if exists "admin_insert_allocations" on crm_sample_allocations;
create policy "admin_insert_allocations" on crm_sample_allocations
  for insert with check (is_crm_admin());

-- Admin-only: give (positive qty) or reclaim (negative qty) samples for a
-- rep. Moves stock out of (or back into) the shared warehouse and updates
-- the rep's running custody balance, logging both the stock movement and
-- the allocation itself for audit.
create or replace function crm_allocate_sample(p_rep_id uuid, p_product_id uuid, p_qty int, p_note text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_store_id int;
  v_stock int;
  v_name text;
  v_admin uuid;
begin
  if not is_crm_admin() then
    raise exception 'Admin access only';
  end if;
  if p_qty = 0 then
    raise exception 'Quantity must not be zero';
  end if;

  select id into v_admin from crm_reps where user_id = auth.uid();
  select store_product_id, name into v_store_id, v_name from crm_products where id = p_product_id;
  if v_store_id is null then
    raise exception 'This product is not linked to a store item yet';
  end if;

  select stock into v_stock from products where id = v_store_id for update;
  if v_stock is null then
    raise exception 'Linked store product not found';
  end if;
  if p_qty > 0 and v_stock < p_qty then
    raise exception 'Insufficient warehouse stock for % (available: %)', v_name, v_stock;
  end if;

  update products set stock = stock - p_qty where id = v_store_id;
  perform log_stock_movement(v_store_id, -p_qty, 'sample_allocation', 'crm_rep', p_rep_id::text, v_name);

  insert into crm_rep_sample_custody (rep_id, product_id, quantity, updated_at)
    values (p_rep_id, p_product_id, greatest(p_qty, 0), now())
  on conflict (rep_id, product_id) do update
    set quantity = greatest(crm_rep_sample_custody.quantity + p_qty, 0),
        updated_at = now();

  insert into crm_sample_allocations (rep_id, product_id, quantity, allocated_by, note)
    values (p_rep_id, p_product_id, p_qty, v_admin, p_note);

  return json_build_object('ok', true);
end $$;
grant execute on function crm_allocate_sample(uuid, uuid, int, text) to authenticated;

-- Replaces the 056 version: draw the sample from the rep's own custody
-- instead of the shared warehouse (already deducted when allocated to them).
-- Non-blocking on purpose — a rep who hasn't been allocated custody yet (or
-- ran out) must never be stopped from logging a completed visit; going
-- negative is a visible signal for the admin to review, not a hard stop.
create or replace function crm_visit_samples_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_rep_id uuid;
begin
  if new.quantity is null or new.quantity <= 0 then
    return new;
  end if;

  select rep_id into v_rep_id from crm_visits where id = new.visit_id;
  if v_rep_id is null then
    return new;
  end if;

  insert into crm_rep_sample_custody (rep_id, product_id, quantity, updated_at)
    values (v_rep_id, new.product_id, -new.quantity, now())
  on conflict (rep_id, product_id) do update
    set quantity = crm_rep_sample_custody.quantity - new.quantity,
        updated_at = now();

  return new;
end $$;

-- View: per-product rollup — warehouse stock left, total held across reps.
create or replace view crm_sample_stock_summary as
select
  cp.id as product_id,
  cp.name as product_name,
  coalesce(p.stock, 0) as warehouse_stock,
  coalesce((select sum(c.quantity) from crm_rep_sample_custody c where c.product_id = cp.id), 0) as total_in_rep_custody
from crm_products cp
left join products p on p.id = cp.store_product_id;

grant select on crm_sample_stock_summary to authenticated;
