-- Allow CRM admins (and store admin / owner) to manage print card templates in site_settings.
drop policy if exists site_settings_crm_print_cards on site_settings;
create policy site_settings_crm_print_cards on site_settings
  for all to authenticated
  using (
    key in ('print_discount_cards', 'print_business_card')
    and (is_crm_admin() or is_store_admin() or is_owner())
  )
  with check (
    key in ('print_discount_cards', 'print_business_card')
    and (is_crm_admin() or is_store_admin() or is_owner())
  );
