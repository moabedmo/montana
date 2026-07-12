-- Visit financial requests (samples invoice, leaflet deals, pharmacy credit) + invoice tracking

alter table crm_visits
  add column if not exists financial_requests jsonb not null default '[]'::jsonb;

alter table invoices
  add column if not exists due_date date,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists payment_type text not null default 'cash';

create index if not exists invoices_due_date_idx on invoices (due_date)
  where due_date is not null and status <> 'paid';

-- Flag visits with financial requests for admin invoice queue
create or replace function crm_visits_financial_flag()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if jsonb_array_length(coalesce(new.financial_requests, '[]'::jsonb)) > 0 then
    new.needs_b2b_invoice := true;
    if coalesce(new.b2b_invoice_status, 'none') = 'none' then
      new.b2b_invoice_status := 'pending';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_crm_visits_financial_flag on crm_visits;
create trigger trg_crm_visits_financial_flag
  before insert or update of financial_requests on crm_visits
  for each row execute function crm_visits_financial_flag();

-- Overdue / upcoming invoice tracking for admin
create or replace function get_overdue_invoices(p_limit int default 50)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.due_date asc nulls last)
    from (
      select
        i.id, i.invoice_number, i.invoice_date, i.due_date, i.total,
        i.amount_paid, i.status, i.payment_type, i.source_type,
        d.name as doctor_name, d.doctor_type,
        r.name as rep_name,
        case
          when i.due_date is not null and i.due_date < current_date and i.status <> 'paid' then 'overdue'
          when i.due_date is not null and i.due_date <= current_date + 7 and i.status <> 'paid' then 'due_soon'
          else 'ok'
        end as urgency
      from invoices i
      left join crm_doctors d on d.id = i.doctor_id
      left join crm_visits v on v.id = i.visit_id
      left join crm_reps r on r.id = v.rep_id
      where i.due_date is not null
        and i.status <> 'paid'
      order by i.due_date asc
      limit greatest(1, least(p_limit, 100))
    ) t
  ), '[]'::json);
end $$;
grant execute on function get_overdue_invoices(int) to authenticated;

-- Enriched pending queue includes financial_requests summary
create or replace function get_pending_b2b_visits(p_limit int default 50)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.visited_at desc)
    from (
      select
        v.id, v.visited_at, v.visit_type, v.notes, v.needs_b2b_invoice,
        v.financial_requests,
        r.name as rep_name,
        d.id as doctor_id, d.name as doctor_name, d.phone as doctor_phone,
        d.address as doctor_address, d.class, d.doctor_type,
        b.name as brick_name,
        coalesce((
          select sum(s.quantity) from crm_visit_samples s where s.visit_id = v.id
        ), 0) as sample_units
      from crm_visits v
      join crm_reps r on r.id = v.rep_id
      join crm_doctors d on d.id = v.doctor_id
      left join crm_bricks b on b.id = d.brick_id
      where v.b2b_invoice_status = 'pending'
      order by v.visited_at desc
      limit greatest(1, least(p_limit, 100))
    ) t
  ), '[]'::json);
end $$;
