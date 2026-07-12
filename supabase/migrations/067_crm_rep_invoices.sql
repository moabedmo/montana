-- Let reps create B2B invoices themselves for doctors/pharmacies in their own
-- bricks — stock comes out of the rep's own sample custody (not the shared
-- warehouse), and the rep records how much was paid on the spot.

alter table invoices
  add column if not exists rep_id uuid references crm_reps(id) on delete set null,
  add column if not exists source_type text not null default 'order';

create index if not exists invoices_rep_id_idx on invoices(rep_id);

-- Reps can see their own invoices (admin already sees everything via the
-- existing invoices_admin_all policy).
drop policy if exists "reps_see_own_invoices" on invoices;
create policy "reps_see_own_invoices" on invoices
  for select using (rep_id = current_rep_id());

-- Shared invoice numbering — reps need this too, not just admins.
create or replace function next_invoice_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if not (is_invoice_admin() or current_rep_id() is not null) then
    raise exception 'CRM access only';
  end if;

  insert into invoice_sequences (year_month, last_num)
  values (ym, 1)
  on conflict (year_month) do update
    set last_num = invoice_sequences.last_num + 1
  returning last_num into n;

  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
end $$;

-- p_items: jsonb array of {product_id (crm_products.id), qty, price}
create or replace function crm_rep_create_invoice(
  p_doctor_id uuid,
  p_items jsonb,
  p_amount_paid numeric default 0,
  p_payment_type text default 'cash',
  p_notes text default null,
  p_visit_id uuid default null,
  p_due_date date default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rep uuid := current_rep_id();
  v_doctor crm_doctors%rowtype;
  v_in_territory boolean;
  v_visit_rep uuid;
  item jsonb;
  v_pid uuid;
  v_qty numeric;
  v_price numeric;
  v_pname text;
  v_line_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_inv_id int;
  v_inv_num text;
  v_status text;
begin
  if v_rep is null then
    raise exception 'Rep access only';
  end if;

  if p_visit_id is not null then
    select rep_id into v_visit_rep from crm_visits where id = p_visit_id;
    if v_visit_rep is distinct from v_rep then
      raise exception 'This visit does not belong to you';
    end if;
  end if;

  select * into v_doctor from crm_doctors where id = p_doctor_id;
  if not found then
    raise exception 'Doctor/pharmacy not found';
  end if;

  select exists (
    select 1 from crm_rep_bricks where rep_id = v_rep and brick_id = v_doctor.brick_id
  ) into v_in_territory;
  if not v_in_territory then
    raise exception 'This doctor/pharmacy is outside your assigned bricks';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one product line';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := nullif(item->>'product_id', '')::uuid;
    v_qty := coalesce(nullif(item->>'qty', '')::numeric, 0);
    v_price := coalesce(nullif(item->>'price', '')::numeric, 0);
    if v_pid is null or v_qty <= 0 then
      continue;
    end if;

    select name into v_pname from crm_products where id = v_pid;
    if v_pname is null then
      raise exception 'Unknown product in invoice lines';
    end if;

    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid, 'name', v_pname, 'qty', v_qty, 'price', v_price, 'total', v_qty * v_price
    ));
    v_subtotal := v_subtotal + (v_qty * v_price);

    -- Draw down the rep's own custody (non-blocking — going negative just
    -- flags a mismatch for the admin to review, never stops a real sale
    -- from being recorded).
    insert into crm_rep_sample_custody (rep_id, product_id, quantity, updated_at)
      values (v_rep, v_pid, -v_qty, now())
    on conflict (rep_id, product_id) do update
      set quantity = crm_rep_sample_custody.quantity - v_qty,
          updated_at = now();
  end loop;

  if jsonb_array_length(v_line_items) = 0 then
    raise exception 'Add at least one valid product line';
  end if;

  v_status := case
    when p_amount_paid >= v_subtotal then 'paid'
    when p_amount_paid > 0 then 'partial'
    else 'pending'
  end;

  v_inv_num := next_invoice_number();

  insert into invoices (
    invoice_number, doctor_id, rep_id, source_type, visit_id,
    customer_name, customer_phone, customer_address,
    invoice_date, due_date, payment_method, payment_type, status,
    line_items, subtotal, tax, total, amount_paid, notes, stock_deducted
  ) values (
    v_inv_num, p_doctor_id, v_rep, 'rep', p_visit_id,
    v_doctor.name, v_doctor.phone, v_doctor.address,
    current_date, p_due_date, p_payment_type, p_payment_type, v_status,
    v_line_items, v_subtotal, 0, v_subtotal, p_amount_paid, p_notes, false
  )
  returning id into v_inv_id;

  if p_visit_id is not null then
    update crm_visits
      set b2b_invoice_status = 'invoiced', invoice_id = v_inv_id, needs_b2b_invoice = true
      where id = p_visit_id;
  end if;

  return json_build_object('ok', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_num, 'total', v_subtotal, 'status', v_status);
end $$;
grant execute on function crm_rep_create_invoice(uuid, jsonb, numeric, text, text, uuid, date) to authenticated;

-- Rep-facing: their own invoice history.
create or replace function crm_rep_list_invoices(p_limit int default 50)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rep uuid := current_rep_id();
begin
  if v_rep is null then
    raise exception 'Rep access only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.created_at desc)
    from (
      select i.id, i.invoice_number, i.invoice_date, i.total, i.amount_paid, i.status,
             i.line_items, d.name as doctor_name, d.doctor_type
      from invoices i
      left join crm_doctors d on d.id = i.doctor_id
      where i.rep_id = v_rep
      order by i.created_at desc
      limit greatest(1, least(p_limit, 100))
    ) t
  ), '[]'::json);
end $$;
grant execute on function crm_rep_list_invoices(int) to authenticated;

-- Admin-facing: per-product rollup across all invoices — total units sold,
-- total billed, total collected, total still outstanding.
create or replace function get_invoice_product_summary()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.total_amount desc)
    from (
      select
        li->>'name' as product_name,
        sum((li->>'qty')::numeric) as total_qty,
        sum((li->>'total')::numeric) as total_amount,
        sum((li->>'total')::numeric * i.amount_paid / nullif(i.total, 0)) as total_paid,
        sum((li->>'total')::numeric) - sum((li->>'total')::numeric * i.amount_paid / nullif(i.total, 0)) as total_remaining
      from invoices i
      cross join lateral jsonb_array_elements(i.line_items) as li
      where li ? 'product_id'
      group by li->>'name'
    ) t
  ), '[]'::json);
end $$;
grant execute on function get_invoice_product_summary() to authenticated;
