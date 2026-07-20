-- Pharmacy invoice bonus: free bottles (no price) deducted from warehouse stock.

alter table crm_pharmacy_invoices
  add column if not exists bonus integer not null default 0
    check (bonus >= 0);

alter table crm_pharmacy_invoices
  add column if not exists bonus_stock_deducted boolean not null default false;

comment on column crm_pharmacy_invoices.bonus is
  'Free bonus bottles total (no price). Per-product amounts live in line_items[].bonus_qty.';

-- Map pharmacy invoice SKU → store products.id
create or replace function resolve_pharmacy_sku_store_product(p_sku text, p_name text default null)
returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_key text := lower(trim(coalesce(p_sku, '')));
  v_name text := lower(trim(coalesce(p_name, '')));
  v_id int;
begin
  begin
    select coalesce(cp.store_product_id, resolve_crm_store_product(cp.id))
      into v_id
    from crm_products cp
    where (cp.sku is not null and lower(trim(cp.sku)) = v_key)
       or (v_name <> '' and lower(trim(cp.name)) = v_name)
    order by cp.store_product_id nulls last
    limit 1;
  exception when undefined_function then
    v_id := null;
  end;
  if v_id is not null then return v_id; end if;

  if v_key in ('post-laser', 'postlaser', 'post laser')
     or v_name like '%post%laser%' or v_name like '%بعد الليزر%' then
    select id into v_id from products where is_active and name ilike '%بعد الليزر%' order by id limit 1;
  elsif v_key in ('lotion') or v_name like '%lotion%' or v_name like '%لوشن%' then
    select id into v_id from products where is_active and name ilike '%لوشن%' order by id limit 1;
  elsif v_key in ('w-cleanser', 'wcleanser', 'w.cleanser', 'cleanser')
     or v_name like '%cleanser%' or v_name like '%غسول التفتيح%' then
    select id into v_id from products where is_active and name = 'غسول التفتيح' order by id limit 1;
  elsif v_key in ('acne') or v_name like '%acne%' or v_name like '%حب الشباب%' then
    select id into v_id from products where is_active and name ilike '%حب الشباب%' order by id limit 1;
  elsif v_key in ('w-cream', 'wcream', 'w.cream')
     or v_name like '%w.cream%' or v_name like '%كريم التفتيح%' then
    select id into v_id from products where is_active and name = 'كريم التفتيح' order by id limit 1;
  end if;

  if v_id is not null then return v_id; end if;

  if v_name <> '' then
    select id into v_id from products where is_active and lower(trim(name)) = v_name order by id limit 1;
  end if;
  return v_id;
end $$;

grant execute on function resolve_pharmacy_sku_store_product(text, text) to authenticated;

create or replace function crm_pharmacy_invoice_bonus_map(p_line_items jsonb)
returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  item jsonb;
  v_map jsonb := '{}'::jsonb;
  v_sku text;
  v_qty int;
  v_key text;
begin
  for item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    v_qty := greatest(0, coalesce((item->>'bonus_qty')::numeric, 0)::int);
    if v_qty <= 0 then continue; end if;
    v_sku := coalesce(nullif(trim(item->>'sku'), ''), nullif(trim(item->>'name'), ''), 'unknown');
    v_key := lower(v_sku);
    v_map := jsonb_set(
      v_map,
      array[v_key],
      jsonb_build_object(
        'sku', v_sku,
        'name', coalesce(item->>'name', v_sku),
        'qty', coalesce((v_map->v_key->>'qty')::int, 0) + v_qty
      ),
      true
    );
  end loop;
  return v_map;
end $$;

create or replace function crm_pharmacy_apply_bonus_stock(
  p_map jsonb,
  p_invoice_id uuid,
  p_sign int
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
  item jsonb;
  pid int;
  qty int;
  v_name text;
begin
  if p_map is null or p_map = '{}'::jsonb then return; end if;

  for k in select jsonb_object_keys(p_map)
  loop
    item := p_map->k;
    qty := greatest(0, coalesce((item->>'qty')::int, 0));
    if qty <= 0 then continue; end if;
    pid := resolve_pharmacy_sku_store_product(item->>'sku', item->>'name');
    if pid is null then
      raise exception 'Cannot map bonus product "%" to warehouse stock', coalesce(item->>'name', item->>'sku', k);
    end if;
    select name into v_name from products where id = pid;
    update products set stock = stock + (p_sign * qty) where id = pid;
    perform log_stock_movement(
      pid,
      p_sign * qty,
      case when p_sign < 0 then 'pharmacy_bonus_deduct' else 'pharmacy_bonus_restore' end,
      'crm_pharmacy_invoice',
      p_invoice_id::text,
      coalesce(v_name, '') || ' · bonus'
    );
  end loop;
end $$;

-- BEFORE: rollup bonus + decide whether stock should be applied (no nested UPDATE)
create or replace function crm_pharmacy_invoice_bonus_before()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  from_lines int;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  from_lines := coalesce((
    select sum(coalesce((x->>'bonus_qty')::numeric, 0))::int
    from jsonb_array_elements(coalesce(new.line_items, '[]'::jsonb)) x
  ), 0);

  if from_lines > 0 then
    new.bonus := from_lines;
  else
    new.bonus := greatest(coalesce(new.bonus, 0), 0);
  end if;

  -- Stock applies when there is per-product bonus_qty.
  -- Legacy rows with only a display bonus number (Excel) stay display-only until bonus_qty is set.
  if from_lines > 0 then
    new.bonus_stock_deducted := true;
  elsif tg_op = 'INSERT' and new.is_legacy is true then
    new.bonus_stock_deducted := false;
  elsif from_lines = 0 and coalesce(new.bonus_stock_deducted, false) and tg_op = 'UPDATE' then
    -- Clearing all bonus_qty → stock will be restored in AFTER, flag cleared
    new.bonus_stock_deducted := false;
  end if;

  return new;
end $$;

create or replace function crm_pharmacy_invoice_bonus_after()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_map jsonb := '{}'::jsonb;
  new_map jsonb := '{}'::jsonb;
  k text;
  keys text[];
  old_q int;
  new_q int;
  d int;
  item jsonb;
begin
  if tg_op = 'DELETE' then
    if coalesce(old.bonus_stock_deducted, false) then
      perform crm_pharmacy_apply_bonus_stock(crm_pharmacy_invoice_bonus_map(old.line_items), old.id, +1);
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new_map := crm_pharmacy_invoice_bonus_map(new.line_items);
    if new_map <> '{}'::jsonb and coalesce(new.bonus_stock_deducted, false) then
      perform crm_pharmacy_apply_bonus_stock(new_map, new.id, -1);
    end if;
    return new;
  end if;

  -- UPDATE
  if coalesce(old.bonus_stock_deducted, false) then
    old_map := crm_pharmacy_invoice_bonus_map(old.line_items);
  end if;
  if coalesce(new.bonus_stock_deducted, false) or crm_pharmacy_invoice_bonus_map(new.line_items) <> '{}'::jsonb then
    new_map := crm_pharmacy_invoice_bonus_map(new.line_items);
  end if;

  keys := array(select distinct x from (
    select jsonb_object_keys(old_map) as x
    union
    select jsonb_object_keys(new_map) as x
  ) s);

  foreach k in array coalesce(keys, array[]::text[])
  loop
    old_q := coalesce((old_map->k->>'qty')::int, 0);
    new_q := coalesce((new_map->k->>'qty')::int, 0);
    d := new_q - old_q;
    if d = 0 then continue; end if;
    item := coalesce(new_map->k, old_map->k);
    perform crm_pharmacy_apply_bonus_stock(
      jsonb_build_object(k, jsonb_build_object(
        'sku', item->>'sku',
        'name', item->>'name',
        'qty', abs(d)
      )),
      new.id,
      case when d > 0 then -1 else +1 end
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_crm_pharmacy_bonus_before on crm_pharmacy_invoices;
drop trigger if exists trg_crm_pharmacy_bonus_after on crm_pharmacy_invoices;
drop trigger if exists trg_crm_pharmacy_invoice_bonus_stock_trg on crm_pharmacy_invoices;
drop function if exists crm_pharmacy_invoice_bonus_stock_trg();
drop function if exists crm_pharmacy_invoice_bonus_stock_after_trg();

create trigger trg_crm_pharmacy_bonus_before
  before insert or update on crm_pharmacy_invoices
  for each row execute function crm_pharmacy_invoice_bonus_before();

create trigger trg_crm_pharmacy_bonus_after
  after insert or update or delete on crm_pharmacy_invoices
  for each row execute function crm_pharmacy_invoice_bonus_after();
