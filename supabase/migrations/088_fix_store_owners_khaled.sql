-- Ensure real owner accounts are in store_owners (fixes is_owner=false for khaled@montana.com).
-- setup_owner.js previously only wrote store_admins, not store_owners.

insert into store_owners (user_id, email, active)
select u.id, u.email, true
from auth.users u
where lower(u.email) in ('khaled@montana.com', 'owner@montana.com')
on conflict (user_id) do update
  set active = true,
      email = excluded.email;
