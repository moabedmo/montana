-- ════════════════════════════════════════════════════════════
-- My orders + Montana Rewards on delivery
-- Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════

alter table orders add column if not exists rewards_awarded boolean not null default false;

-- List orders for logged-in user (by auth email / linked customer / phone)
create or replace function get_my_orders()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_phone text;
  v_rows json;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;
  select phone into v_phone from customers where auth_user_id = v_uid limit 1;

  select coalesce(json_agg(row order by row.created_at desc), '[]'::json)
  into v_rows
  from (
    select
      o.order_number,
      o.status,
      o.payment_status,
      o.total,
      o.customer_phone,
      o.created_at
    from orders o
    where o.customer_email = v_email
       or (v_phone is not null and o.customer_phone = v_phone)
       or o.customer_id in (select id from customers where auth_user_id = v_uid)
    order by o.created_at desc
    limit 50
  ) row;

  return v_rows;
end $$;

grant execute on function get_my_orders() to authenticated;

-- Award points when order is delivered (1 point per 10 EGP, idempotent)
create or replace function award_order_rewards(p_order_id int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_points int;
  v_customer customers%rowtype;
  v_new_tier text;
begin
  if not is_store_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_order.rewards_awarded then
    return json_build_object('ok', true, 'already', true);
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'Order must be delivered first';
  end if;

  v_points := greatest(0, floor(coalesce(v_order.total, 0) / 10)::int);
  if v_points = 0 or v_order.customer_id is null then
    update orders set rewards_awarded = true where id = p_order_id;
    return json_build_object('ok', true, 'points', 0);
  end if;

  select * into v_customer from customers where id = v_order.customer_id;
  if not found then
    update orders set rewards_awarded = true where id = p_order_id;
    return json_build_object('ok', true, 'points', 0);
  end if;

  update customers set
    points = coalesce(points, 0) + v_points,
    tier = case
      when coalesce(points, 0) + v_points >= 2500 then 'platinum'
      when coalesce(points, 0) + v_points >= 1500 then 'gold'
      when coalesce(points, 0) + v_points >= 500 then 'silver'
      else 'bronze'
    end
  where id = v_customer.id;

  update orders set rewards_awarded = true where id = p_order_id;

  return json_build_object('ok', true, 'points', v_points);
end $$;

grant execute on function award_order_rewards(int) to authenticated;
