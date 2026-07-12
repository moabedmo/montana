-- Telegram confirm failed with "Admin only" because order-confirm triggers
-- call create_invoice_from_order / next_invoice_number which require admin JWT.
-- Allow system (trigger) path via a transaction-local GUC flag.

create or replace function next_invoice_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if current_setting('montana.invoice_system', true) is distinct from '1'
     and not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  insert into invoice_sequences (year_month, last_num)
  values (ym, 1)
  on conflict (year_month) do update
    set last_num = invoice_sequences.last_num + 1
  returning last_num into n;

  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
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

create or replace function orders_auto_invoice_on_confirm()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed'
     and (old.status is distinct from 'confirmed')
     and new.status <> 'cancelled' then
    perform set_config('montana.invoice_system', '1', true);
    perform create_invoice_from_order(new.id);
  end if;
  return new;
end $$;

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
    perform set_config('montana.invoice_system', '1', true);
    perform create_invoice_from_order(new.id);
  end if;
  return new;
end $$;
