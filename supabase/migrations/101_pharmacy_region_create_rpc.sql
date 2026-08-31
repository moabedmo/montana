-- Reliable region create for admin / owner / invoice admins (bypasses RLS edge cases).

create or replace function create_pharmacy_region(
  p_parent_id uuid,
  p_name text,
  p_region_type text,
  p_phone text default null,
  p_address text default null
) returns crm_pharmacy_regions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row crm_pharmacy_regions;
  v_name text := trim(coalesce(p_name, ''));
  v_type text := trim(coalesce(p_region_type, ''));
begin
  if not (is_crm_admin() or is_store_admin() or is_invoice_admin() or is_owner()) then
    raise exception 'Not authorized to manage regions';
  end if;
  if v_name = '' then
    raise exception 'Name is required';
  end if;
  if v_type not in ('governorate', 'area', 'pharmacy') then
    raise exception 'Invalid region type';
  end if;
  if v_type = 'governorate' and p_parent_id is not null then
    raise exception 'Governorate cannot have a parent';
  end if;
  if v_type in ('area', 'pharmacy') and p_parent_id is null then
    raise exception 'Select a parent region first';
  end if;

  insert into crm_pharmacy_regions (parent_id, name, region_type, phone, address)
  values (
    p_parent_id,
    v_name,
    v_type,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), '')
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'This name already exists under the same parent';
end;
$$;

grant execute on function create_pharmacy_region(uuid, text, text, text, text) to authenticated;
