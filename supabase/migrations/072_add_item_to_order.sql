-- Let a verified customer (phone-matched, same pattern as cancel/modify)
-- add a product to an order that's ALREADY been placed — instead of the
-- chat bot silently starting a brand-new second order that has no link
-- back to the original one. Gated the same way the store owner asked:
-- allowed regardless of confirm status, as long as the order isn't
-- cancelled/shipped/delivered AND it's within 6 hours of being placed.

create or replace function add_item_to_order(
  p_order_number text,
  p_phone text,
  p_product_id int,
  p_quantity int default 1
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_digits text;
  v_order_digits text;
  v_product record;
  v_existing_id int;
  v_new_subtotal numeric;
  v_new_total numeric;
begin
  if p_order_number is null or p_order_number !~ '^MON-\d{5}$' then
    return json_build_object('ok', false, 'error', 'invalid_order_number');
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    return json_build_object('ok', false, 'error', 'invalid_quantity');
  end if;

  v_digits := regexp_replace(coalesce(p_phone, ''), '[^\d]', '', 'g');
  if length(v_digits) < 10 then
    return json_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select * into v_order from orders where order_number = p_order_number limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  v_order_digits := regexp_replace(coalesce(v_order.customer_phone, ''), '[^\d]', '', 'g');
  if v_digits <> v_order_digits then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_order.status in ('cancelled', 'shipped', 'delivered') then
    return json_build_object('ok', false, 'error', 'cannot_modify', 'status', v_order.status);
  end if;

  if v_order.created_at < now() - interval '6 hours' then
    return json_build_object('ok', false, 'error', 'window_expired');
  end if;

  select id, name, price, image_url, coalesce(stock, 0) as stock
    into v_product
    from products where id = p_product_id and is_active;
  if not found then
    return json_build_object('ok', false, 'error', 'product_not_found');
  end if;
  if v_product.stock < p_quantity then
    return json_build_object('ok', false, 'error', 'out_of_stock');
  end if;

  select id into v_existing_id from order_items
    where order_id = v_order.id and product_id = p_product_id
    limit 1;

  if v_existing_id is not null then
    update order_items set
      quantity = quantity + p_quantity,
      total = (quantity + p_quantity) * price
      where id = v_existing_id;
  else
    insert into order_items (order_id, product_id, product_name, product_image, price, quantity, total)
    values (v_order.id, v_product.id, v_product.name, v_product.image_url, v_product.price, p_quantity, v_product.price * p_quantity);
  end if;

  update products set stock = stock - p_quantity where id = p_product_id;

  select coalesce(sum(total), 0) into v_new_subtotal from order_items where order_id = v_order.id;
  v_new_total := v_new_subtotal + coalesce(v_order.shipping_cost, 0) - coalesce(v_order.discount, 0);

  update orders set subtotal = v_new_subtotal, total = v_new_total, updated_at = now()
  where id = v_order.id;

  return json_build_object(
    'ok', true,
    'order_number', v_order.order_number,
    'added_product', v_product.name,
    'added_qty', p_quantity,
    'new_total', v_new_total
  );
end $$;

grant execute on function add_item_to_order(text, text, int, int) to anon, authenticated;
