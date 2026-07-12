-- Fix search_invoice_clients: customers table uses address_1/city, not address

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
    select o.id, o.order_number, o.customer_name, o.customer_phone, o.total, o.status, o.created_at
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
