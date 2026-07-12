-- Allow store admins (admin.html) to manage CRM without a separate crm_reps row.
-- Extends is_crm_admin() so existing CRM RLS policies apply automatically.

create or replace function is_crm_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_reps
    where user_id = auth.uid() and role = 'admin' and active
  ) or coalesce(is_store_admin(), false);
$$;

grant execute on function is_crm_admin() to authenticated;
