-- Invoices linked to orders + manual B2B invoices
create table if not exists invoices (
  id serial primary key,
  invoice_number text unique not null,
  order_id int references orders(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  invoice_date date not null default current_date,
  payment_method text default 'cod',
  status text not null default 'paid',
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_order_id_idx on invoices(order_id);
create index if not exists invoices_created_at_idx on invoices(created_at desc);

alter table invoices enable row level security;

drop policy if exists invoices_admin_all on invoices;
create policy invoices_admin_all on invoices
  for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

-- Admin: full order payload for invoice generation
create or replace function get_order_for_invoice(p_order_id int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_items json;
begin
  if not is_store_admin() then
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

  return json_build_object(
    'found', true,
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

grant execute on function get_order_for_invoice(int) to authenticated;
