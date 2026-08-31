-- Allow owner role to manage pharmacy regions (same as invoice admin).

drop policy if exists pharmacy_regions_admin on crm_pharmacy_regions;
create policy pharmacy_regions_admin on crm_pharmacy_regions
  for all to authenticated
  using (is_crm_admin() or is_store_admin() or is_invoice_admin() or is_owner())
  with check (is_crm_admin() or is_store_admin() or is_invoice_admin() or is_owner());
