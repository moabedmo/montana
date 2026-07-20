-- Pharmacy invoices (trade sales) — separate from doctor samples.
-- New credit invoices default to due_date = invoice_date + 30 days.
-- Legacy/open invoices can set due_date manually in admin.

create table if not exists crm_pharmacy_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  pharmacy_id uuid references crm_doctors(id) on delete set null,
  pharmacy_name text not null,
  region text, -- Cairo / Giza / Other
  invoice_date date not null default current_date,
  due_date date,
  due_date_manual boolean not null default false, -- true when admin set date by hand
  payment_type text not null default 'credit'
    check (payment_type in ('cash', 'credit', 'partial')),
  discount numeric not null default 0 check (discount >= 0 and discount <= 1),
  line_items jsonb not null default '[]'::jsonb,
  -- each: { sku, name, qty, unit_price, line_total }
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'paid', 'cancelled')),
  is_legacy boolean not null default false,
  notes text,
  created_by uuid references crm_reps(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_pharmacy_invoices_due_idx
  on crm_pharmacy_invoices (due_date)
  where status <> 'paid' and status <> 'cancelled';

create index if not exists crm_pharmacy_invoices_pharmacy_idx
  on crm_pharmacy_invoices (pharmacy_id);

create index if not exists crm_pharmacy_invoices_date_idx
  on crm_pharmacy_invoices (invoice_date desc);

alter table crm_pharmacy_invoices enable row level security;

drop policy if exists pharmacy_invoices_admin on crm_pharmacy_invoices;
create policy pharmacy_invoices_admin on crm_pharmacy_invoices
  for all to authenticated
  using (is_crm_admin() or is_store_admin() or is_invoice_admin())
  with check (is_crm_admin() or is_store_admin() or is_invoice_admin());

-- Auto due date for NEW credit/partial invoices: +30 days (1 month)
create or replace function crm_pharmacy_invoice_defaults()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();

  -- Status from paid vs total
  if new.status <> 'cancelled' then
    if coalesce(new.amount_paid, 0) >= coalesce(new.total, 0) and coalesce(new.total, 0) > 0 then
      new.status := 'paid';
      new.payment_type := 'cash';
    elsif coalesce(new.amount_paid, 0) > 0 then
      new.status := 'partial';
      if new.payment_type = 'cash' then new.payment_type := 'partial'; end if;
    elsif coalesce(new.payment_type, 'credit') = 'cash' and coalesce(new.amount_paid, 0) = 0 and coalesce(new.total, 0) > 0 then
      -- fully unpaid cash still pending until collected
      new.status := 'pending';
    else
      new.status := 'pending';
    end if;
  end if;

  -- Due date: NEW invoices get +30 days (1 month). Legacy stays empty until admin sets it.
  if new.due_date_manual is not true and new.is_legacy is not true then
    if coalesce(new.payment_type, 'credit') in ('credit', 'partial')
       or (coalesce(new.total, 0) - coalesce(new.amount_paid, 0)) > 0 then
      if tg_op = 'INSERT' and new.due_date is null then
        new.due_date := (coalesce(new.invoice_date, current_date)::date + 30);
      elsif tg_op = 'UPDATE' and (
        new.invoice_date is distinct from old.invoice_date
        or new.payment_type is distinct from old.payment_type
      ) and new.due_date_manual is not true and new.is_legacy is not true then
        new.due_date := (coalesce(new.invoice_date, current_date)::date + 30);
      end if;
    end if;
  end if;

  -- Fully paid → clear urgency (keep due_date for history)
  return new;
end $$;

drop trigger if exists trg_crm_pharmacy_invoice_defaults on crm_pharmacy_invoices;
create trigger trg_crm_pharmacy_invoice_defaults
  before insert or update on crm_pharmacy_invoices
  for each row execute function crm_pharmacy_invoice_defaults();

-- Next invoice number PHI-YYYY-####
create or replace function crm_next_pharmacy_invoice_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  y text := to_char(timezone('Africa/Cairo', now()), 'YYYY');
  n int;
begin
  if not (is_crm_admin() or is_store_admin() or is_invoice_admin()) then
    raise exception 'Admin only';
  end if;
  select coalesce(max(
    nullif(substring(invoice_number from 'PHI-' || y || '-([0-9]+)'), '')::int
  ), 0) + 1
  into n
  from crm_pharmacy_invoices
  where invoice_number ~ ('^PHI-' || y || '-[0-9]+$');
  return 'PHI-' || y || '-' || lpad(n::text, 4, '0');
end $$;

grant execute on function crm_next_pharmacy_invoice_number() to authenticated;

-- Collection schedule for admin AR view
create or replace function get_pharmacy_ar_schedule()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not (is_crm_admin() or is_store_admin() or is_invoice_admin()) then
    raise exception 'Admin only';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.sort_due, t.invoice_date desc)
    from (
      select
        i.id,
        i.invoice_number,
        i.pharmacy_name,
        i.pharmacy_id,
        i.region,
        i.invoice_date,
        i.due_date,
        i.due_date_manual,
        i.total,
        i.amount_paid,
        greatest(i.total - i.amount_paid, 0) as balance_due,
        i.payment_type,
        i.status,
        i.is_legacy,
        i.discount,
        i.line_items,
        (i.due_date - current_date) as days_to_due,
        case
          when i.due_date is null then 'no_date'
          when i.due_date < current_date then 'overdue'
          when i.due_date <= current_date + 7 then 'due_soon'
          else 'open'
        end as collection_status,
        coalesce(i.due_date, date '9999-12-31') as sort_due
      from crm_pharmacy_invoices i
      where i.status in ('pending', 'partial')
        and greatest(i.total - i.amount_paid, 0) > 0
    ) t
  ), '[]'::json);
end $$;

grant execute on function get_pharmacy_ar_schedule() to authenticated;
