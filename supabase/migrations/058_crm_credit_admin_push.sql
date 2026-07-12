-- Pharmacy credit limits, visit→invoice auto-fill RPC, admin push subscriptions, credit validation

alter table crm_doctors
  add column if not exists credit_limit numeric default null,
  add column if not exists credit_terms_days int default 30;

-- Admin web push (separate from rep push)
create table if not exists crm_admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table crm_admin_push_subscriptions enable row level security;

create or replace function is_crm_admin_user() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(is_crm_admin(), false);
$$;
drop policy if exists admin_push_crm_admin on crm_admin_push_subscriptions;
create policy admin_push_crm_admin on crm_admin_push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and is_crm_admin_user())
  with check (user_id = auth.uid() and is_crm_admin_user());

-- Outstanding unpaid balance for a pharmacy/doctor
create or replace function pharmacy_outstanding(p_doctor_id uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(greatest(i.total - coalesce(i.amount_paid, 0), 0)), 0)
  from invoices i
  where i.doctor_id = p_doctor_id
    and i.status <> 'paid'
    and coalesce(i.payment_type, 'cash') in ('credit', 'partial');
$$;

create or replace function get_pharmacy_credit_status(
  p_doctor_id uuid,
  p_additional_amount numeric default 0
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  d record;
  v_outstanding numeric;
  v_limit numeric;
  v_available numeric;
begin
  if current_rep_id() is null and not is_invoice_admin() then
    raise exception 'Not authorized';
  end if;

  select id, name, doctor_type, credit_limit, credit_terms_days
  into d from crm_doctors where id = p_doctor_id;
  if not found then
    return json_build_object('found', false);
  end if;

  v_outstanding := pharmacy_outstanding(p_doctor_id);
  v_limit := coalesce(d.credit_limit, 0);
  v_available := greatest(v_limit - v_outstanding, 0);

  return json_build_object(
    'found', true,
    'doctor_id', d.id,
    'doctor_name', d.name,
    'doctor_type', d.doctor_type,
    'credit_limit', v_limit,
    'credit_terms_days', coalesce(d.credit_terms_days, 30),
    'outstanding', v_outstanding,
    'available', v_available,
    'additional', coalesce(p_additional_amount, 0),
    'ok', (v_limit <= 0) or (v_outstanding + coalesce(p_additional_amount, 0) <= v_limit)
  );
end $$;
grant execute on function get_pharmacy_credit_status(uuid, numeric) to authenticated;

-- Full visit payload for invoice auto-fill
create or replace function get_visit_for_invoice(p_visit_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v record;
  d record;
  samples json;
  fin json;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select v.*, r.name as rep_name
  into v
  from crm_visits v
  join crm_reps r on r.id = v.rep_id
  where v.id = p_visit_id;
  if not found then
    return json_build_object('found', false);
  end if;

  select d.*, b.name as brick_name
  into d
  from crm_doctors d
  left join crm_bricks b on b.id = d.brick_id
  where d.id = v.doctor_id;

  select coalesce(json_agg(row_to_json(t) order by t.product_name), '[]'::json)
  into samples
  from (
    select
      s.quantity,
      cp.id as crm_product_id,
      cp.name as product_name,
      cp.store_product_id,
      p.price as store_price,
      p.name as store_name
    from crm_visit_samples s
    join crm_products cp on cp.id = s.product_id
    left join products p on p.id = cp.store_product_id
    where s.visit_id = p_visit_id and s.quantity > 0
  ) t;

  fin := coalesce(v.financial_requests, '[]'::jsonb);

  return json_build_object(
    'found', true,
    'visit', json_build_object(
      'id', v.id,
      'visited_at', v.visited_at,
      'notes', v.notes,
      'visit_type', v.visit_type,
      'time_of_day', v.time_of_day,
      'financial_requests', fin,
      'rep_name', v.rep_name
    ),
    'doctor', json_build_object(
      'id', d.id,
      'name', d.name,
      'phone', d.phone,
      'address', d.address,
      'class', d.class,
      'specialty', d.specialty,
      'doctor_type', d.doctor_type,
      'brick', d.brick_name,
      'credit_limit', d.credit_limit,
      'credit_terms_days', d.credit_terms_days
    ),
    'samples', samples,
    'credit_status', (
      select get_pharmacy_credit_status(d.id, 0)
    )
  );
end $$;
grant execute on function get_visit_for_invoice(uuid) to authenticated;

-- Validate before saving credit invoice
create or replace function validate_pharmacy_credit_for_invoice(
  p_doctor_id uuid,
  p_total numeric,
  p_amount_paid numeric default 0,
  p_payment_type text default 'cash'
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_additional numeric;
  st json;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;
  if coalesce(p_payment_type, 'cash') not in ('credit', 'partial') then
    return json_build_object('ok', true, 'skipped', true);
  end if;
  v_additional := greatest(coalesce(p_total, 0) - coalesce(p_amount_paid, 0), 0);
  st := get_pharmacy_credit_status(p_doctor_id, v_additional);
  return st;
end $$;
grant execute on function validate_pharmacy_credit_for_invoice(uuid, numeric, numeric, text) to authenticated;

-- Extend get_doctor_for_invoice with credit fields
create or replace function get_doctor_for_invoice(p_doctor_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select d.*, b.name as brick_name
  into d
  from crm_doctors d
  left join crm_bricks b on b.id = d.brick_id
  where d.id = p_doctor_id;

  if not found then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'doctor', json_build_object(
      'id', d.id,
      'name', d.name,
      'phone', d.phone,
      'address', d.address,
      'class', d.class,
      'specialty', d.specialty,
      'doctor_type', d.doctor_type,
      'brick', d.brick_name,
      'credit_limit', d.credit_limit,
      'credit_terms_days', d.credit_terms_days
    ),
    'credit_status', get_pharmacy_credit_status(d.id, 0)
  );
end $$;
