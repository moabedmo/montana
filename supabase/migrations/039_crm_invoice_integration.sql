-- CRM ↔ Invoices ↔ Warehouse full integration

-- ── Admin helper (store admin OR CRM admin) ──
create or replace function is_invoice_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(is_store_admin(), false) or coalesce(is_crm_admin(), false);
$$;
grant execute on function is_invoice_admin() to authenticated;

-- ── Extend invoice access to CRM admins ──
drop policy if exists invoices_admin_all on invoices;
create policy invoices_admin_all on invoices
  for all to authenticated
  using (is_invoice_admin()) with check (is_invoice_admin());

-- ── CRM visit → B2B invoice workflow ──
alter table crm_visits
  add column if not exists needs_b2b_invoice boolean not null default false,
  add column if not exists b2b_invoice_status text not null default 'none',
  add column if not exists invoice_id int references invoices(id) on delete set null;

alter table invoices
  add column if not exists visit_id uuid references crm_visits(id) on delete set null;

create index if not exists crm_visits_b2b_pending_idx
  on crm_visits (b2b_invoice_status) where b2b_invoice_status = 'pending';
create index if not exists invoices_visit_id_idx on invoices(visit_id);
create index if not exists invoices_doctor_id_idx on invoices(doctor_id);

-- ── Link CRM sample products to store catalog ──
alter table crm_products
  add column if not exists store_product_id int references products(id) on delete set null;

-- ── Stock movement log ──
create table if not exists stock_movements (
  id           serial primary key,
  product_id   int not null references products(id) on delete cascade,
  delta        int not null,
  qty_after    int,
  reason       text not null,
  reference_type text,
  reference_id text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements(product_id, created_at desc);

alter table stock_movements enable row level security;
drop policy if exists stock_movements_admin on stock_movements;
create policy stock_movements_admin on stock_movements
  for all to authenticated
  using (is_invoice_admin()) with check (is_invoice_admin());

-- ── Log a stock change ──
create or replace function log_stock_movement(
  p_product_id int,
  p_delta int,
  p_reason text,
  p_reference_type text default null,
  p_reference_id text default null,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_after int;
begin
  select stock into v_after from products where id = p_product_id;
  insert into stock_movements (product_id, delta, qty_after, reason, reference_type, reference_id, notes, created_by)
  values (p_product_id, p_delta, v_after, p_reason, p_reference_type, p_reference_id, p_notes, auth.uid());
end $$;

-- ── Apply stock deduction (with logging) ──
create or replace function apply_invoice_stock(p_items jsonb, p_invoice_id int default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  pid int;
  qty int;
  v_stock int;
  v_name text;
  ref_id text;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  ref_id := coalesce(p_invoice_id::text, 'manual');

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    pid := nullif(item->>'product_id', '')::int;
    qty := coalesce(nullif(item->>'qty', '')::int, 0);
    if pid is null or qty <= 0 then
      continue;
    end if;

    select stock, name into v_stock, v_name
    from products where id = pid and is_active
    for update;

    if not found then
      raise exception 'Product % not found', pid;
    end if;
    if v_stock < qty then
      raise exception 'Insufficient stock for % (available: %)', v_name, v_stock;
    end if;

    update products set stock = stock - qty where id = pid;
    perform log_stock_movement(pid, -qty, 'invoice_deduct', 'invoice', ref_id, v_name);
  end loop;

  return json_build_object('ok', true);
end $$;

grant execute on function apply_invoice_stock(jsonb, int) to authenticated;
grant execute on function apply_invoice_stock(jsonb) to authenticated;

-- ── Restore stock on invoice delete/cancel ──
create or replace function _restore_invoice_stock_items(p_line_items jsonb, p_invoice_id int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  pid int;
  qty int;
  v_name text;
begin
  for item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    pid := nullif(item->>'product_id', '')::int;
    qty := coalesce(nullif(item->>'qty', '')::int, 0);
    if pid is null or qty <= 0 then
      continue;
    end if;

    select name into v_name from products where id = pid;
    update products set stock = stock + qty where id = pid;
    perform log_stock_movement(pid, qty, 'invoice_restore', 'invoice', p_invoice_id::text, v_name);
  end loop;
end $$;

create or replace function restore_invoice_stock(p_invoice_id int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  inv record;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select * into inv from invoices where id = p_invoice_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not coalesce(inv.stock_deducted, false) then
    return json_build_object('ok', true, 'restored', false);
  end if;

  perform _restore_invoice_stock_items(inv.line_items, p_invoice_id);
  update invoices set stock_deducted = false where id = p_invoice_id;
  return json_build_object('ok', true, 'restored', true);
end $$;

grant execute on function restore_invoice_stock(int) to authenticated;

create or replace function invoices_before_delete_restore_stock()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.stock_deducted, false) then
    perform _restore_invoice_stock_items(old.line_items, old.id);
  end if;
  return old;
end $$;

drop trigger if exists trg_invoices_before_delete_stock on invoices;
create trigger trg_invoices_before_delete_stock
  before delete on invoices
  for each row execute function invoices_before_delete_restore_stock();

-- ── Manual stock adjust with log ──
create or replace function adjust_product_stock(p_product_id int, p_new_stock int, p_notes text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_old int;
  v_delta int;
begin
  if not is_store_admin() then
    raise exception 'Admin only';
  end if;
  if p_new_stock < 0 then
    raise exception 'Stock cannot be negative';
  end if;

  select stock into v_old from products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;

  v_delta := p_new_stock - v_old;
  update products set stock = p_new_stock where id = p_product_id;
  if v_delta <> 0 then
    perform log_stock_movement(p_product_id, v_delta, 'manual_adjust', 'manual', p_product_id::text, p_notes);
  end if;

  return json_build_object('ok', true, 'delta', v_delta);
end $$;

grant execute on function adjust_product_stock(int, int, text) to authenticated;

-- ── Auto-flag B2B visits ──
create or replace function crm_visits_set_b2b_flag()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dt text;
begin
  select coalesce(doctor_type, 'doctor') into dt from crm_doctors where id = new.doctor_id;

  if new.visit_type = 'no_show' then
    new.needs_b2b_invoice := false;
    new.b2b_invoice_status := 'none';
  elsif new.needs_b2b_invoice or dt in ('pharmacy', 'hospital', 'polyclinic') then
    new.needs_b2b_invoice := true;
    if coalesce(new.b2b_invoice_status, 'none') = 'none' then
      new.b2b_invoice_status := 'pending';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_crm_visits_b2b_flag on crm_visits;
create trigger trg_crm_visits_b2b_flag
  before insert on crm_visits
  for each row execute function crm_visits_set_b2b_flag();

-- ── Invoice number helpers: allow CRM admin ──
create or replace function next_invoice_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  insert into invoice_sequences (year_month, last_num)
  values (ym, 1)
  on conflict (year_month) do update
    set last_num = invoice_sequences.last_num + 1
  returning last_num into n;

  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
end $$;

create or replace function peek_invoice_number()
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;
  select coalesce(last_num, 0) + 1 into n from invoice_sequences where year_month = ym;
  if n is null then n := 1; end if;
  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
end $$;

-- ── Auto-create invoice when order confirmed ──
create or replace function create_invoice_from_order(p_order_id int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_existing int;
  v_inv_id int;
  v_inv_num text;
  v_addr text;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select id into v_existing from invoices where order_id = p_order_id limit 1;
  if v_existing is not null then
    select invoice_number into v_inv_num from invoices where id = v_existing;
    return json_build_object('ok', true, 'created', false, 'invoice_id', v_existing, 'invoice_number', v_inv_num);
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', oi.product_name,
    'price', coalesce(p.old_price, oi.price),
    'qty', oi.quantity,
    'discount', case when coalesce(p.old_price, 0) > oi.price
      then round((1 - oi.price / p.old_price) * 100)::text || '%'
      else '0%' end,
    'pharmacyPrice', oi.price,
    'total', oi.total,
    'product_id', oi.product_id
  ) order by oi.id), '[]'::jsonb)
  into v_items
  from order_items oi
  left join products p on p.id = oi.product_id
  where oi.order_id = p_order_id;

  if coalesce(v_order.shipping_cost, 0) > 0 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'name', 'رسوم الشحن',
      'price', v_order.shipping_cost,
      'qty', 1,
      'discount', '0%',
      'pharmacyPrice', v_order.shipping_cost,
      'total', v_order.shipping_cost
    ));
  end if;

  v_addr := trim(both ' — ' from concat_ws(' — ', v_order.address, v_order.city, v_order.governorate));

  insert into invoices (
    order_id, source_type, customer_name, customer_phone, customer_address,
    invoice_date, payment_method, status, line_items,
    subtotal, tax, total, stock_deducted
  ) values (
    p_order_id, 'order', v_order.customer_name, v_order.customer_phone, v_addr,
    coalesce(v_order.created_at::date, current_date),
    coalesce(v_order.payment_method, 'cod'),
    case when v_order.payment_status = 'confirmed' then 'paid' else 'pending' end,
    v_items,
    v_order.subtotal, 0, v_order.total, false
  )
  returning id, invoice_number into v_inv_id, v_inv_num;

  return json_build_object('ok', true, 'created', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_num);
end $$;

grant execute on function create_invoice_from_order(int) to authenticated;

create or replace function orders_auto_invoice_on_confirm()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed'
     and (old.status is distinct from 'confirmed')
     and new.status <> 'cancelled' then
    perform create_invoice_from_order(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_auto_invoice on orders;
create trigger trg_orders_auto_invoice
  after update of status on orders
  for each row execute function orders_auto_invoice_on_confirm();

-- Also when payment confirmed sets status
create or replace function orders_auto_invoice_on_payment()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'confirmed'
     and (old.payment_status is distinct from 'confirmed')
     and coalesce(new.status, 'pending') not in ('cancelled') then
    if new.status <> 'confirmed' then
      new.status := 'confirmed';
    end if;
    perform create_invoice_from_order(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_auto_invoice_payment on orders;
create trigger trg_orders_auto_invoice_payment
  before update of payment_status on orders
  for each row execute function orders_auto_invoice_on_payment();

-- ── Doctor invoice helpers ──
create or replace function get_doctor_for_invoice(p_doctor_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select d.*, b.name as brick_name
  into d
  from crm_doctors d
  left join crm_bricks b on b.id = d.brick_id
  where d.id = p_doctor_id;

  if not found then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'doctor', json_build_object(
      'id', d.id,
      'name', d.name,
      'phone', d.phone,
      'address', d.address,
      'class', d.class,
      'specialty', d.specialty,
      'doctor_type', d.doctor_type,
      'brick', d.brick_name
    )
  );
end $$;

grant execute on function get_doctor_for_invoice(uuid) to authenticated;

create or replace function get_doctor_invoices(p_doctor_id uuid, p_limit int default 20)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.created_at desc)
    from (
      select id, invoice_number, invoice_date, total, status, source_type, stock_deducted, created_at
      from invoices
      where doctor_id = p_doctor_id
      order by created_at desc
      limit greatest(1, least(p_limit, 50))
    ) t
  ), '[]'::json);
end $$;

grant execute on function get_doctor_invoices(uuid, int) to authenticated;

create or replace function get_pending_b2b_visits(p_limit int default 50)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.visited_at desc)
    from (
      select
        v.id, v.visited_at, v.visit_type, v.notes, v.needs_b2b_invoice,
        r.name as rep_name,
        d.id as doctor_id, d.name as doctor_name, d.phone as doctor_phone,
        d.address as doctor_address, d.class, d.doctor_type,
        b.name as brick_name,
        coalesce((
          select sum(s.quantity) from crm_visit_samples s where s.visit_id = v.id
        ), 0) as sample_units
      from crm_visits v
      join crm_reps r on r.id = v.rep_id
      join crm_doctors d on d.id = v.doctor_id
      left join crm_bricks b on b.id = d.brick_id
      where v.b2b_invoice_status = 'pending'
      order by v.visited_at desc
      limit greatest(1, least(p_limit, 100))
    ) t
  ), '[]'::json);
end $$;

grant execute on function get_pending_b2b_visits(int) to authenticated;

create or replace function mark_visit_invoiced(p_visit_id uuid, p_invoice_id int)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  update crm_visits
  set b2b_invoice_status = 'invoiced', invoice_id = p_invoice_id
  where id = p_visit_id;

  update invoices set visit_id = p_visit_id where id = p_invoice_id and visit_id is null;

  return json_build_object('ok', true);
end $$;

grant execute on function mark_visit_invoiced(uuid, int) to authenticated;

create or replace function dismiss_b2b_visit(p_visit_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  update crm_visits
  set b2b_invoice_status = 'dismissed', needs_b2b_invoice = false
  where id = p_visit_id and b2b_invoice_status = 'pending';

  return json_build_object('ok', true);
end $$;

grant execute on function dismiss_b2b_visit(uuid) to authenticated;

-- ── Sales report (monthly) ──
create or replace function get_sales_report(p_year int default null, p_month int default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_start date;
  v_end date;
  v_by_brick json;
  v_by_class json;
  v_by_rep json;
  v_totals json;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  if p_year is null or p_month is null then
    v_start := date_trunc('month', current_date)::date;
    v_end := (date_trunc('month', current_date) + interval '1 month')::date;
  else
    v_start := make_date(p_year, p_month, 1);
    v_end := (v_start + interval '1 month')::date;
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_by_brick
  from (
    select coalesce(b.name, '—') as brick, count(*) as invoice_count, sum(i.total)::numeric as revenue
    from invoices i
    left join crm_doctors d on d.id = i.doctor_id
    left join crm_bricks b on b.id = d.brick_id
    where i.invoice_date >= v_start and i.invoice_date < v_end
    group by b.name
    order by revenue desc nulls last
  ) t;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_by_class
  from (
    select coalesce(d.class, '—') as doctor_class, count(*) as invoice_count, sum(i.total)::numeric as revenue
    from invoices i
    left join crm_doctors d on d.id = i.doctor_id
    where i.invoice_date >= v_start and i.invoice_date < v_end and i.doctor_id is not null
    group by d.class
    order by revenue desc nulls last
  ) t;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_by_rep
  from (
    select coalesce(r.name, '—') as rep_name, count(distinct v.id) as visits_with_invoice,
           sum(i.total)::numeric as revenue
    from invoices i
    join crm_visits v on v.invoice_id = i.id
    join crm_reps r on r.id = v.rep_id
    where i.invoice_date >= v_start and i.invoice_date < v_end
    group by r.name
    order by revenue desc nulls last
  ) t;

  select json_build_object(
    'invoice_count', count(*),
    'total_revenue', coalesce(sum(total), 0),
    'stock_deducted_count', count(*) filter (where stock_deducted),
    'from_orders', count(*) filter (where source_type = 'order'),
    'from_doctors', count(*) filter (where source_type = 'doctor'),
    'pending_b2b', (select count(*) from crm_visits where b2b_invoice_status = 'pending')
  )
  into v_totals
  from invoices
  where invoice_date >= v_start and invoice_date < v_end;

  return json_build_object(
    'period_start', v_start,
    'period_end', v_end,
    'totals', v_totals,
    'by_brick', v_by_brick,
    'by_class', v_by_class,
    'by_rep', v_by_rep
  );
end $$;

grant execute on function get_sales_report(int, int) to authenticated;

-- ── Low stock alert ──
create or replace function get_low_stock_products(p_threshold int default 10)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.stock asc)
    from (
      select id, name, stock, price
      from products
      where is_active and stock < greatest(1, p_threshold)
      order by stock asc
      limit 30
    ) t
  ), '[]'::json);
end $$;

grant execute on function get_low_stock_products(int) to authenticated;

-- Store products for CRM product linking
create or replace function list_store_products_for_link()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_crm_admin() then
    raise exception 'CRM admin only';
  end if;
  return coalesce((
    select json_agg(row_to_json(t) order by t.name)
    from (select id, name, price, stock from products where is_active order by name limit 500) t
  ), '[]'::json);
end $$;
grant execute on function list_store_products_for_link() to authenticated;

-- Update search_invoice_clients to use is_invoice_admin
create or replace function search_invoice_clients(p_query text default '', p_limit int default 40)
returns json
language plpgsql security definer set search_path = public as $$
declare
  q text := trim(coalesce(p_query, ''));
  v_doctors json;
  v_customers json;
  v_orders json;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_doctors
  from (
    select d.id, d.name, d.phone, d.address,
      coalesce(d.doctor_type, 'doctor') as type,
      d.class, d.specialty, b.name as brick
    from crm_doctors d
    left join crm_bricks b on b.id = d.brick_id
    where d.approved = true
      and (q = '' or d.name ilike '%' || q || '%' or coalesce(d.phone, '') ilike '%' || q || '%')
    order by d.name
    limit greatest(1, least(p_limit, 80))
  ) t;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_customers
  from (
    select c.id, c.name, c.phone, c.email,
      trim(both ' ' from coalesce(c.address_1, '') || coalesce(' — ' || c.city, '')) as address
    from customers c
    where q = '' or c.name ilike '%' || q || '%'
       or coalesce(c.phone, '') ilike '%' || q || '%'
       or coalesce(c.email, '') ilike '%' || q || '%'
    order by c.name
    limit greatest(1, least(p_limit, 80))
  ) t;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into v_orders
  from (
    select id, order_number, customer_name, customer_phone, total, status, created_at
    from orders
    where q = '' or order_number ilike '%' || q || '%'
       or customer_name ilike '%' || q || '%'
       or coalesce(customer_phone, '') ilike '%' || q || '%'
    order by created_at desc
    limit greatest(1, least(p_limit, 80))
  ) t;

  return json_build_object('doctors', v_doctors, 'customers', v_customers, 'orders', v_orders);
end $$;

create or replace function get_order_for_invoice(p_order_id int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_items json;
  v_inv json;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then
    return json_build_object('found', false);
  end if;

  select coalesce(json_agg(json_build_object(
    'product_id', oi.product_id,
    'product_name', oi.product_name,
    'price', oi.price,
    'quantity', oi.quantity,
    'total', oi.total,
    'old_price', p.old_price
  ) order by oi.id), '[]'::json)
  into v_items
  from order_items oi
  left join products p on p.id = oi.product_id
  where oi.order_id = p_order_id;

  select json_build_object('id', i.id, 'invoice_number', i.invoice_number)
  into v_inv
  from invoices i where i.order_id = p_order_id limit 1;

  return json_build_object(
    'found', true,
    'existing_invoice', v_inv,
    'order', json_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'customer_name', v_order.customer_name,
      'customer_phone', v_order.customer_phone,
      'customer_email', v_order.customer_email,
      'address', v_order.address,
      'city', v_order.city,
      'governorate', v_order.governorate,
      'subtotal', v_order.subtotal,
      'shipping_cost', v_order.shipping_cost,
      'discount', v_order.discount,
      'total', v_order.total,
      'payment_method', v_order.payment_method,
      'payment_status', v_order.payment_status,
      'status', v_order.status,
      'created_at', v_order.created_at
    ),
    'items', v_items
  );
end $$;
