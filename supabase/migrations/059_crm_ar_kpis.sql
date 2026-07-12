-- AR collection schedule, invoice returns, discount cap 40%, rep KPIs, credit max 30 days

alter table invoices
  add column if not exists is_return boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists discount_approved boolean not null default false;

-- Credit invoices: due date = invoice date + 30 days (one month max)
create or replace function invoices_set_credit_due_date()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.payment_type, 'cash') in ('credit', 'partial') then
    new.due_date := (coalesce(new.invoice_date, current_date)::date + 30);
  end if;
  if coalesce(new.status, '') = 'returned' then
    new.is_return := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_invoices_credit_due on invoices;
create trigger trg_invoices_credit_due
  before insert or update of payment_type, invoice_date on invoices
  for each row execute function invoices_set_credit_due_date();

-- Cancel invoice as return + restore stock
create or replace function cancel_invoice_as_return(p_invoice_id int, p_reason text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  inv record;
  rest json;
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  select * into inv from invoices where id = p_invoice_id for update;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  if inv.status in ('returned', 'cancelled') then
    return json_build_object('ok', false, 'reason', 'already_cancelled');
  end if;

  rest := restore_invoice_stock(p_invoice_id);

  update invoices set
    status = 'returned',
    is_return = true,
    cancelled_at = now(),
    cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Return / credit note'),
    updated_at = now()
  where id = p_invoice_id;

  return json_build_object('ok', true, 'stock', rest);
end $$;
grant execute on function cancel_invoice_as_return(int, text) to authenticated;

-- Validate discount <= 40% unless approved
create or replace function validate_invoice_discount(p_line_items jsonb, p_discount_approved boolean)
returns json
language plpgsql immutable as $$
declare
  item jsonb;
  disc numeric;
  max_disc numeric := 0;
begin
  for item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    disc := coalesce(nullif(regexp_replace(coalesce(item->>'discount', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0);
    if disc > max_disc then max_disc := disc; end if;
  end loop;

  if max_disc > 40 and not coalesce(p_discount_approved, false) then
    return json_build_object('ok', false, 'max_discount', max_disc, 'message', 'Discount above 40% requires admin approval');
  end if;
  return json_build_object('ok', true, 'max_discount', max_disc);
end $$;
grant execute on function validate_invoice_discount(jsonb, boolean) to authenticated;

-- Accounts receivable / collection schedule for admin
create or replace function get_ar_collection_schedule(p_limit int default 100)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.due_date asc nulls last, t.invoice_date desc)
    from (
      select
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total,
        coalesce(i.amount_paid, 0) as amount_paid,
        greatest(i.total - coalesce(i.amount_paid, 0), 0) as balance_due,
        i.status,
        i.payment_type,
        i.is_return,
        d.name as doctor_name,
        d.doctor_type,
        r.name as rep_name,
        (i.due_date - current_date) as days_to_due,
        case
          when i.status in ('returned', 'cancelled', 'paid') then 'closed'
          when i.due_date is not null and i.due_date < current_date then 'overdue'
          when i.due_date is not null and i.due_date <= current_date + 7 then 'due_soon'
          else 'open'
        end as collection_status
      from invoices i
      left join crm_doctors d on d.id = i.doctor_id
      left join crm_visits v on v.id = i.visit_id
      left join crm_reps r on r.id = v.rep_id
      where i.status not in ('returned', 'cancelled', 'paid')
        and coalesce(i.payment_type, 'cash') in ('credit', 'partial')
      order by i.due_date asc nulls last
      limit greatest(1, least(p_limit, 200))
    ) t
  ), '[]'::json);
end $$;
grant execute on function get_ar_collection_schedule(int) to authenticated;

-- Rep monthly KPIs: money (EGP) + units (packages from invoices + samples)
create or replace function get_rep_month_kpis(
  p_rep_id uuid,
  p_year int default null,
  p_month int default null
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_start date;
  v_end date;
  v_rev numeric;
  v_units int;
  v_samples int;
  v_actual int;
  v_total_visits int;
begin
  if p_rep_id is distinct from current_rep_id() and not is_crm_admin() then
    raise exception 'Not authorized';
  end if;

  v_start := make_date(coalesce(p_year, extract(year from current_date)::int), coalesce(p_month, extract(month from current_date)::int), 1);
  v_end := (v_start + interval '1 month')::date;

  select coalesce(sum(i.total), 0) into v_rev
  from invoices i
  join crm_visits v on v.id = i.visit_id
  where v.rep_id = p_rep_id
    and v.visited_at >= v_start and v.visited_at < v_end
    and i.status not in ('returned', 'cancelled');

  select coalesce(sum((item->>'qty')::int), 0) into v_units
  from invoices i
  join crm_visits v on v.id = i.visit_id
  cross join lateral jsonb_array_elements(coalesce(i.line_items, '[]'::jsonb)) item
  where v.rep_id = p_rep_id
    and v.visited_at >= v_start and v.visited_at < v_end
    and i.status not in ('returned', 'cancelled');

  select coalesce(sum(s.quantity), 0) into v_samples
  from crm_visit_samples s
  join crm_visits v on v.id = s.visit_id
  where v.rep_id = p_rep_id
    and v.visited_at >= v_start and v.visited_at < v_end;

  select
    count(*) filter (where coalesce(v.visit_type, 'regular') = 'actual'),
    count(*)
  into v_actual, v_total_visits
  from crm_visits v
  where v.rep_id = p_rep_id
    and v.visited_at >= v_start and v.visited_at < v_end;

  return json_build_object(
    'revenue_egp', round(v_rev, 2),
    'invoice_units', v_units,
    'sample_units', v_samples,
    'total_units', v_units + v_samples,
    'actual_visits', v_actual,
    'total_visits', v_total_visits,
    'month', to_char(v_start, 'YYYY-MM')
  );
end $$;
grant execute on function get_rep_month_kpis(uuid, int, int) to authenticated;

-- Default pharmacy credit terms to 30 days
update crm_doctors set credit_terms_days = 30 where doctor_type = 'pharmacy' and (credit_terms_days is null or credit_terms_days > 30);
