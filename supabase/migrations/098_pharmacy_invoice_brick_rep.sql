-- Link pharmacy trade invoices to CRM bricks so reps only see invoices in their territory.

alter table crm_pharmacy_invoices
  add column if not exists brick_id uuid references crm_bricks(id) on delete set null;

create index if not exists crm_pharmacy_invoices_brick_idx
  on crm_pharmacy_invoices (brick_id);

-- Sync brick from linked pharmacy (crm_doctors)
create or replace function crm_pharmacy_invoice_brick_sync()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.pharmacy_id is not null then
    select d.brick_id into new.brick_id
    from crm_doctors d
    where d.id = new.pharmacy_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_crm_pharmacy_invoice_brick_sync on crm_pharmacy_invoices;
create trigger trg_crm_pharmacy_invoice_brick_sync
  before insert or update of pharmacy_id, brick_id on crm_pharmacy_invoices
  for each row execute function crm_pharmacy_invoice_brick_sync();

-- Backfill from linked pharmacies
update crm_pharmacy_invoices i
set brick_id = d.brick_id
from crm_doctors d
where i.pharmacy_id = d.id
  and i.brick_id is distinct from d.brick_id
  and d.brick_id is not null;

-- Reps: read-only for invoices in their assigned bricks
drop policy if exists pharmacy_invoices_rep_select on crm_pharmacy_invoices;
create policy pharmacy_invoices_rep_select on crm_pharmacy_invoices
  for select to authenticated
  using (
    current_rep_id() is not null
    and brick_id is not null
    and exists (
      select 1
      from crm_rep_bricks rb
      where rb.rep_id = current_rep_id()
        and rb.brick_id = crm_pharmacy_invoices.brick_id
    )
  );

comment on column crm_pharmacy_invoices.brick_id is
  'CRM brick territory — reps see invoices only when brick matches crm_rep_bricks.';
