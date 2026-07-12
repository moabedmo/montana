-- Preview next invoice number (no sequence consumption)
create or replace function peek_invoice_number()
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if not is_store_admin() then
    raise exception 'Admin only';
  end if;
  select coalesce(last_num, 0) + 1 into n from invoice_sequences where year_month = ym;
  if n is null then n := 1; end if;
  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
end $$;

grant execute on function peek_invoice_number() to authenticated;
