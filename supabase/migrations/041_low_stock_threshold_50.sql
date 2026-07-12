-- Default low-stock threshold: 50 units

create or replace function get_low_stock_products(p_threshold int default 50)
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
      where is_active and stock <= greatest(1, p_threshold)
      order by stock asc
      limit 30
    ) t
  ), '[]'::json);
end $$;

grant execute on function get_low_stock_products(int) to authenticated;
