-- Auto invoice numbers: MNT-YYYYMM-0001 (monthly sequence, server-side)

create table if not exists invoice_sequences (
  year_month text primary key,
  last_num     int not null default 0
);

create or replace function next_invoice_number()
returns text
language plpgsql security definer set search_path = public as $$
declare
  ym text := to_char(current_date, 'YYYYMM');
  n int;
begin
  if not is_store_admin() then
    raise exception 'Admin only';
  end if;

  insert into invoice_sequences (year_month, last_num)
  values (ym, 1)
  on conflict (year_month) do update
    set last_num = invoice_sequences.last_num + 1
  returning last_num into n;

  return 'MNT-' || ym || '-' || lpad(n::text, 4, '0');
end $$;

grant execute on function next_invoice_number() to authenticated;

-- Preview next number without consuming a sequence slot
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

-- Reserve number at insert time if client omitted invoice_number
create or replace function invoices_set_number()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invoice_number is null or trim(new.invoice_number) = '' then
    new.invoice_number := next_invoice_number();
  end if;
  return new;
end $$;

drop trigger if exists invoices_before_insert_number on invoices;
create trigger invoices_before_insert_number
  before insert on invoices
  for each row execute function invoices_set_number();
