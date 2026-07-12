-- Invoices ↔ warehouse ↔ CRM doctors / store customers

alter table invoices
  add column if not exists doctor_id uuid references crm_doctors(id) on delete set null,
  add column if not exists customer_id uuid references customers(id) on delete set null,
  add column if not exists source_type text not null default 'manual',
  add column if not exists stock_deducted boolean not null default false;

create index if not exists invoices_doctor_id_idx on invoices(doctor_id);
create index if not exists invoices_customer_id_idx on invoices(customer_id);

-- Deduct storefront product stock from invoice line items (product_id + qty)
create or replace function apply_invoice_stock(p_items jsonb)
returns json
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  pid int;
  qty int;
  v_stock int;
  v_name text;
begin
  if not is_store_admin() then
    raise exception 'Admin only';
  end if;

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
  end loop;

  return json_build_object('ok', true);
end $$;

grant execute on function apply_invoice_stock(jsonb) to authenticated;

-- Search helpers for invoice client picker (store admin)
create or replace function search_invoice_clients(p_query text default '', p_limit int default 40)
returns json
language plpgsql security definer set search_path = public as $$
declare
  q text := trim(coalesce(p_query, ''));
  v_doctors json;
  v_customers json;
  v_orders json;
begin
  if not is_store_admin() then
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
    select o.id, o.order_number, o.customer_name, o.customer_phone, o.total, o.created_at
    from orders o
    where q = '' or o.order_number ilike '%' || q || '%'
       or o.customer_name ilike '%' || q || '%'
       or coalesce(o.customer_phone, '') ilike '%' || q || '%'
    order by o.created_at desc
    limit greatest(1, least(p_limit, 40))
  ) t;

  return json_build_object(
    'doctors', v_doctors,
    'customers', v_customers,
    'orders', v_orders
  );
end $$;

grant execute on function search_invoice_clients(text, int) to authenticated;
