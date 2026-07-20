-- Canonical owner account: owner@montana.com (خالد).
-- Keep khaled@montana.com as an optional alias if the auth user still exists.

update auth.users
set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('name', 'خالد', 'full_name', 'خالد')
where lower(email) = 'owner@montana.com';

insert into store_owners (user_id, email, active)
select u.id, u.email, true
from auth.users u
where lower(u.email) = 'owner@montana.com'
on conflict (user_id) do update
  set active = true,
      email = excluded.email;

-- Owner also needs store-admin for invoices / CRM SSO from owner dashboard.
insert into store_admins (user_id, email, active)
select u.id, u.email, true
from auth.users u
where lower(u.email) = 'owner@montana.com'
on conflict (user_id) do update
  set active = true,
      email = excluded.email;

-- Alias account (if present): keep owner access, sync Arabic name.
update auth.users
set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('name', 'خالد', 'full_name', 'خالد')
where lower(email) = 'khaled@montana.com';

insert into store_owners (user_id, email, active)
select u.id, u.email, true
from auth.users u
where lower(u.email) = 'khaled@montana.com'
on conflict (user_id) do update
  set active = true,
      email = excluded.email;
