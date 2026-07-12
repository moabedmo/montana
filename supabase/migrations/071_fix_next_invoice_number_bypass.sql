-- next_invoice_number() (067) added a CRM-admin/rep gate but never got the
-- same montana.invoice_system bypass that create_invoice_from_order/
-- get_order_for_invoice already use (051/052) — so the orders-confirm
-- trigger chain (confirm_order_by_number -> orders_auto_invoice_on_payment
-- -> create_invoice_from_order -> next_invoice_number) started raising
-- "CRM access only" for every anon-key order confirmation (Telegram button
-- and admin-panel button alike), even though create_invoice_from_order's
-- own check already lets this exact call through via that same bypass.

create or replace function next_invoice_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if current_setting('montana.invoice_system', true) is distinct from '1'
     and not (is_invoice_admin() or current_rep_id() is not null) then
    raise exception 'CRM access only';
  end if;

  insert into invoice_sequences (year_month, last_num)
  values (ym, 1)
  on conflict (year_month) do update
    set last_num = invoice_sequences.last_num + 1
  returning last_num into n;

  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
end $$;
