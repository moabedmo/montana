-- Rep-facing product stock + auto-deduct samples from warehouse on visit submit.

create or replace function list_rep_sample_stock()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if current_rep_id() is null and not is_crm_admin() then
    raise exception 'Rep access only';
  end if;
  return coalesce((
    select json_agg(row_to_json(t) order by t.crm_name)
    from (
      select
        cp.id as crm_product_id,
        cp.name as crm_name,
        cp.store_product_id,
        coalesce(p.stock, 0) as stock_available,
        p.name as store_name
      from crm_products cp
      left join products p on p.id = cp.store_product_id and p.is_active
      order by cp.name
    ) t
  ), '[]'::json);
end $$;
grant execute on function list_rep_sample_stock() to authenticated;

create or replace function crm_visit_samples_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_store_id int;
  v_stock int;
  v_name text;
begin
  if new.quantity is null or new.quantity <= 0 then
    return new;
  end if;

  select store_product_id into v_store_id
  from crm_products where id = new.product_id;

  if v_store_id is null then
    return new;
  end if;

  select stock, name into v_stock, v_name
  from products where id = v_store_id for update;

  if v_stock is null then
    raise exception 'Linked store product not found';
  end if;

  if v_stock < new.quantity then
    raise exception 'Insufficient stock for % (available: %)', v_name, v_stock;
  end if;

  update products set stock = stock - new.quantity where id = v_store_id;
  perform log_stock_movement(
    v_store_id, -new.quantity, 'sample_distribute', 'crm_visit', new.visit_id::text, v_name
  );
  return new;
end $$;

drop trigger if exists trg_crm_visit_samples_stock on crm_visit_samples;
create trigger trg_crm_visit_samples_stock
  after insert on crm_visit_samples
  for each row execute function crm_visit_samples_after_insert();
