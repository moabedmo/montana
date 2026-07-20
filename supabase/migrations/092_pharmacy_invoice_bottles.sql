-- Persist bottle counts (Excel "Total Bottles") on pharmacy invoices.

alter table crm_pharmacy_invoices
  add column if not exists bottles numeric not null default 0;

-- Backfill from line item quantities
update crm_pharmacy_invoices
set bottles = coalesce((
  select sum(coalesce((elem->>'qty')::numeric, 0))
  from jsonb_array_elements(coalesce(line_items, '[]'::jsonb)) as elem
), 0)
where coalesce(bottles, 0) = 0;
