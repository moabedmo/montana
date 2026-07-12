-- Order invoices: include deposit (مقدّم الحجز) + customer/order context.

alter table invoices add column if not exists deposit_amount numeric not null default 0;
alter table invoices add column if not exists balance_due numeric not null default 0;
alter table invoices add column if not exists order_number text;

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
      'deposit_amount', coalesce(v_order.deposit_amount, 0),
      'payment_method', v_order.payment_method,
      'payment_status', v_order.payment_status,
      'payment_proof_url', v_order.payment_proof_url,
      'status', v_order.status,
      'created_at', v_order.created_at
    ),
    'items', v_items
  );
end $$;

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
  v_deposit numeric;
  v_balance numeric;
begin
  if current_setting('montana.invoice_system', true) is distinct from '1'
     and not is_invoice_admin() then
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

  v_deposit := coalesce(v_order.deposit_amount, 0);
  v_balance := greatest(0, coalesce(v_order.total, 0) - v_deposit);

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
    order_id, source_type, order_number,
    customer_name, customer_phone, customer_address,
    invoice_date, payment_method, status, line_items,
    subtotal, tax, total, deposit_amount, balance_due, stock_deducted
  ) values (
    p_order_id, 'order', v_order.order_number,
    v_order.customer_name, v_order.customer_phone, v_addr,
    coalesce(v_order.created_at::date, current_date),
    coalesce(v_order.payment_method, 'cod'),
    case when v_order.payment_status = 'confirmed' then 'paid' else 'pending' end,
    v_items,
    v_order.subtotal, 0, v_order.total, v_deposit, v_balance, false
  )
  returning id, invoice_number into v_inv_id, v_inv_num;

  return json_build_object('ok', true, 'created', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_num);
end $$;

-- Backfill saved order invoices with deposit from linked orders.
update invoices i set
  deposit_amount = coalesce(o.deposit_amount, 0),
  balance_due = greatest(0, coalesce(o.total, 0) - coalesce(o.deposit_amount, 0)),
  order_number = coalesce(i.order_number, o.order_number)
from orders o
where i.order_id = o.id
  and i.source_type = 'order';
