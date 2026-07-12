-- Discount approval workflow: reps can discount up to 40% on their own.
-- Above that, the invoice is held pending and sent to the admin on Telegram
-- with Approve/Reject buttons — the same confirm-key pattern already used
-- for order confirmation (047_telegram_confirm_without_service_role.sql),
-- so the webhook can act without a logged-in session.

create table if not exists crm_discount_approvals (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references crm_reps(id) on delete cascade,
  doctor_id uuid not null references crm_doctors(id),
  visit_id uuid references crm_visits(id),
  items jsonb not null, -- [{product_id, qty, list_price}]
  discount_pct numeric not null,
  subtotal numeric not null,
  requested_total numeric not null,
  amount_paid numeric not null default 0,
  payment_type text default 'cash',
  due_date date,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  invoice_id int references invoices(id),
  created_at timestamptz default now(),
  decided_at timestamptz
);

alter table crm_discount_approvals enable row level security;

drop policy if exists "reps_see_own_discount_requests" on crm_discount_approvals;
create policy "reps_see_own_discount_requests" on crm_discount_approvals
  for select using (rep_id = current_rep_id() or is_crm_admin());

drop policy if exists "reps_create_discount_requests" on crm_discount_approvals;
create policy "reps_create_discount_requests" on crm_discount_approvals
  for insert with check (rep_id = current_rep_id());

drop policy if exists "admin_manage_discount_requests" on crm_discount_approvals;
create policy "admin_manage_discount_requests" on crm_discount_approvals
  for update using (is_crm_admin());

-- Shared core: creates the invoice for an explicit rep_id (no auth.uid()
-- dependency) so both the direct rep call AND the Telegram-approved path
-- can reuse it.
create or replace function _crm_create_invoice_for_rep(
  p_rep_id uuid,
  p_doctor_id uuid,
  p_items jsonb, -- [{product_id, qty, price}] — already at final (discounted) price
  p_amount_paid numeric,
  p_payment_type text,
  p_notes text,
  p_visit_id uuid,
  p_due_date date,
  p_discount_pct numeric default 0
) returns json
language plpgsql security definer set search_path = public as $$
declare
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
  if p_visit_id is not null then
    select rep_id into v_visit_rep from crm_visits where id = p_visit_id;
    if v_visit_rep is distinct from p_rep_id then
      raise exception 'This visit does not belong to this rep';
    end if;
  end if;

  select * into v_doctor from crm_doctors where id = p_doctor_id;
  if not found then
    raise exception 'Doctor/pharmacy not found';
  end if;

  select exists (
    select 1 from crm_rep_bricks where rep_id = p_rep_id and brick_id = v_doctor.brick_id
  ) into v_in_territory;
  if not v_in_territory then
    raise exception 'This doctor/pharmacy is outside the rep''s assigned bricks';
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

    insert into crm_rep_sample_custody (rep_id, product_id, quantity, updated_at)
      values (p_rep_id, v_pid, -v_qty, now())
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
    line_items, subtotal, tax, total, amount_paid, notes, stock_deducted, discount_pct
  ) values (
    v_inv_num, p_doctor_id, p_rep_id, 'rep', p_visit_id,
    v_doctor.name, v_doctor.phone, v_doctor.address,
    current_date, p_due_date, p_payment_type, p_payment_type, v_status,
    v_line_items, v_subtotal, 0, v_subtotal, p_amount_paid, p_notes, false, p_discount_pct
  )
  returning id into v_inv_id;

  if p_visit_id is not null then
    update crm_visits
      set b2b_invoice_status = 'invoiced', invoice_id = v_inv_id, needs_b2b_invoice = true
      where id = p_visit_id;
  end if;

  return json_build_object('ok', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_num, 'total', v_subtotal, 'status', v_status);
end $$;

alter table invoices add column if not exists discount_pct numeric;

-- Rep-facing entry point: discount <= 40% creates the invoice immediately;
-- above that, it's queued for admin approval (see crm-discount-notify API).
create or replace function crm_rep_request_invoice(
  p_doctor_id uuid,
  p_items jsonb, -- [{product_id, qty, list_price}]
  p_discount_pct numeric default 0,
  p_amount_paid numeric default 0,
  p_payment_type text default 'cash',
  p_notes text default null,
  p_visit_id uuid default null,
  p_due_date date default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_rep uuid := current_rep_id();
  v_final_items jsonb;
  v_subtotal numeric := 0;
  v_qty numeric; v_list numeric;
  v_approval_id uuid;
  v_inv json;
  it jsonb;
begin
  if v_rep is null then
    raise exception 'Rep access only';
  end if;
  if p_discount_pct < 0 or p_discount_pct > 100 then
    raise exception 'Invalid discount percentage';
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := coalesce(nullif(it->>'qty', '')::numeric, 0);
    v_list := coalesce(nullif(it->>'list_price', '')::numeric, 0);
    v_subtotal := v_subtotal + v_qty * v_list;
  end loop;

  if p_discount_pct <= 40 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', x->>'product_id',
      'qty', (x->>'qty')::numeric,
      'price', round(((x->>'list_price')::numeric * (1 - p_discount_pct / 100.0))::numeric, 2)
    )), '[]'::jsonb) into v_final_items
    from jsonb_array_elements(p_items) x;

    v_inv := _crm_create_invoice_for_rep(v_rep, p_doctor_id, v_final_items, p_amount_paid, p_payment_type, p_notes, p_visit_id, p_due_date, p_discount_pct);
    return (v_inv::jsonb || jsonb_build_object('auto_approved', true))::json;
  end if;

  insert into crm_discount_approvals (
    rep_id, doctor_id, visit_id, items, discount_pct, subtotal, requested_total,
    amount_paid, payment_type, notes, due_date
  ) values (
    v_rep, p_doctor_id, p_visit_id, p_items, p_discount_pct, v_subtotal,
    round((v_subtotal * (1 - p_discount_pct / 100.0))::numeric, 2),
    p_amount_paid, p_payment_type, p_notes, p_due_date
  ) returning id into v_approval_id;

  return json_build_object(
    'ok', true, 'auto_approved', false, 'approval_id', v_approval_id,
    'requested_total', round((v_subtotal * (1 - p_discount_pct / 100.0))::numeric, 2)
  );
end $$;
grant execute on function crm_rep_request_invoice(uuid, jsonb, numeric, numeric, text, text, uuid, date) to authenticated;

-- Telegram webhook calls this with the shared confirm key (no user session).
create or replace function crm_approve_discount_request(p_id uuid, p_confirm_key text, p_approve boolean)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_expected text;
  v_req crm_discount_approvals%rowtype;
  v_final_items jsonb;
  v_inv json;
begin
  select value into v_expected from site_settings where key = 'telegram_confirm_key' limit 1;
  if coalesce(v_expected, '') = '' or coalesce(p_confirm_key, '') = '' or p_confirm_key <> v_expected then
    return json_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_req from crm_discount_approvals where id = p_id;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_req.status <> 'pending' then
    return json_build_object('ok', true, 'already', true, 'status', v_req.status);
  end if;

  if not p_approve then
    update crm_discount_approvals set status = 'rejected', decided_at = now() where id = p_id;
    return json_build_object('ok', true, 'status', 'rejected', 'rep_id', v_req.rep_id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', it->>'product_id',
    'qty', (it->>'qty')::numeric,
    'price', round(((it->>'list_price')::numeric * (1 - v_req.discount_pct / 100.0))::numeric, 2)
  )), '[]'::jsonb) into v_final_items
  from jsonb_array_elements(v_req.items) it;

  v_inv := _crm_create_invoice_for_rep(
    v_req.rep_id, v_req.doctor_id, v_final_items, v_req.amount_paid, v_req.payment_type,
    v_req.notes, v_req.visit_id, v_req.due_date, v_req.discount_pct
  );

  update crm_discount_approvals
    set status = 'approved', decided_at = now(), invoice_id = (v_inv->>'invoice_id')::int
    where id = p_id;

  return (v_inv::jsonb || jsonb_build_object('status', 'approved', 'rep_id', v_req.rep_id))::json;
end $$;
revoke all on function crm_approve_discount_request(uuid, text, boolean) from public;
grant execute on function crm_approve_discount_request(uuid, text, boolean) to anon, authenticated;

-- Overdue invoice digest for the daily Telegram alert (cron-triggered, no
-- session — same confirm-key gate as the rest of this file).
create or replace function get_overdue_invoices_for_alert(p_confirm_key text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_expected text;
begin
  select value into v_expected from site_settings where key = 'telegram_confirm_key' limit 1;
  if coalesce(v_expected, '') = '' or coalesce(p_confirm_key, '') = '' or p_confirm_key <> v_expected then
    return json_build_object('ok', false, 'error', 'unauthorized');
  end if;

  return json_build_object('ok', true, 'rows', coalesce((
    select json_agg(row_to_json(t) order by t.due_date asc)
    from (
      select i.invoice_number, i.due_date, i.total, i.amount_paid,
             d.name as doctor_name, r.name as rep_name
      from invoices i
      left join crm_doctors d on d.id = i.doctor_id
      left join crm_reps r on r.id = i.rep_id
      where i.due_date is not null
        and i.status <> 'paid'
        and i.due_date <= current_date
      order by i.due_date asc
      limit 30
    ) t
  ), '[]'::json));
end $$;
revoke all on function get_overdue_invoices_for_alert(text) from public;
grant execute on function get_overdue_invoices_for_alert(text) to anon, authenticated;

-- Rep-facing: see the status of their own pending/decided discount requests.
create or replace function crm_rep_list_discount_requests(p_limit int default 20)
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
      select a.id, a.discount_pct, a.requested_total, a.status, a.created_at, d.name as doctor_name
      from crm_discount_approvals a
      left join crm_doctors d on d.id = a.doctor_id
      where a.rep_id = v_rep
      order by a.created_at desc
      limit greatest(1, least(p_limit, 50))
    ) t
  ), '[]'::json);
end $$;
grant execute on function crm_rep_list_discount_requests(int) to authenticated;
