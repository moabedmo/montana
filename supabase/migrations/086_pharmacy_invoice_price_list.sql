-- Distinguish old vs new pharmacy price lists.
-- Everything imported from the first Excel file = old prices.

alter table crm_pharmacy_invoices
  add column if not exists price_list text not null default 'new'
    check (price_list in ('old', 'new'));

comment on column crm_pharmacy_invoices.price_list is
  'old = legacy Excel / old bottle prices; new = current price list';

-- Backfill: all existing rows + legacy imports are old prices
update crm_pharmacy_invoices
set price_list = 'old'
where is_legacy = true
   or invoice_number like 'PHI-LEGACY-%'
   or coalesce(price_list, '') = '';

create index if not exists crm_pharmacy_invoices_price_list_idx
  on crm_pharmacy_invoices (price_list);
