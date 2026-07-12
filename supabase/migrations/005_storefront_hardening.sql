-- ════════════════════════════════════════════════════════════
-- Montana Storefront — Security Hardening
-- ════════════════════════════════════════════════════════════
-- The storefront schema (products/orders/order_items/customers/
-- categories/coupons/banners/reviews/site_settings) was applied
-- directly (database.sql) without RLS policies of its own. At
-- some point permissive "Admin all X" policies were added
-- (cmd=ALL, roles=public, qual=true, with_check=true) — meaning
-- the anon key, already sitting in plain sight inside admin.js,
-- granted any visitor full read/write/delete on customer PII,
-- every order, and the whole product catalog. admin.html itself
-- had no login gate at all. This migration:
--   1. Introduces store_admins + is_store_admin(), mirroring the
--      is_crm_admin() pattern in 003_crm_hardening.sql.
--   2. Replaces every "Admin all X" policy with scoped ones:
--      public read-only where safe, public insert-only where a
--      guest checkout needs it (customers/orders/order_items —
--      deliberately NO public select on these, so there is no
--      order-enumeration/IDOR surface at all), admin-only for
--      everything else.
--   3. Adds validate_coupon() so the client never has to SELECT
--      the raw coupons table (which would let anyone list every
--      active discount code).
-- Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 1. Admin identity
-- ───────────────────────────────────────────────
create table if not exists store_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  active     boolean not null default true,
  created_at timestamptz default now()
);

alter table store_admins enable row level security;

drop policy if exists store_admins_self_read on store_admins;
create policy store_admins_self_read on store_admins
  for select to authenticated
  using (user_id = auth.uid());

create or replace function is_store_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from store_admins where user_id = auth.uid() and active
  );
$$;

-- ───────────────────────────────────────────────
-- 2. Guest checkout can't be looked up (no anon SELECT on
--    customers), so repeat guests with the same email/phone
--    would otherwise fail on the UNIQUE constraints. Every guest
--    checkout gets its own customers row until a real customer-
--    account/login system exists.
-- ───────────────────────────────────────────────
alter table customers drop constraint if exists customers_email_key;
alter table customers drop constraint if exists customers_phone_key;

-- ───────────────────────────────────────────────
-- 3. Drop every wide-open "Admin all X" policy
-- ───────────────────────────────────────────────
drop policy if exists "Admin all products" on products;
drop policy if exists "Admin all orders" on orders;
drop policy if exists "Admin all order_items" on order_items;
drop policy if exists "Admin all customers" on customers;
drop policy if exists "Admin all categories" on categories;
drop policy if exists "Admin all coupons" on coupons;
drop policy if exists "Admin all banners" on banners;
drop policy if exists "Admin all reviews" on reviews;
drop policy if exists "Admin all site_settings" on site_settings;

-- ───────────────────────────────────────────────
-- 4. Reference data: public read, admin write
--    ("Public read products" already exists correctly and is
--    left untouched by this migration.)
-- ───────────────────────────────────────────────
drop policy if exists categories_public_read  on categories;
drop policy if exists categories_admin_write  on categories;
create policy categories_public_read on categories for select to public using (true);
create policy categories_admin_write on categories for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

drop policy if exists banners_public_read on banners;
drop policy if exists banners_admin_write on banners;
create policy banners_public_read on banners for select to public using (true);
create policy banners_admin_write on banners for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

drop policy if exists site_settings_public_read on site_settings;
drop policy if exists site_settings_admin_write on site_settings;
create policy site_settings_public_read on site_settings for select to public using (true);
create policy site_settings_admin_write on site_settings for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

drop policy if exists reviews_public_read   on reviews;
drop policy if exists reviews_public_insert on reviews;
drop policy if exists reviews_admin_all     on reviews;
create policy reviews_public_read   on reviews for select to public using (true);
create policy reviews_public_insert on reviews for insert to public with check (true);
create policy reviews_admin_all     on reviews for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

drop policy if exists products_admin_write on products;
create policy products_admin_write on products for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

-- ───────────────────────────────────────────────
-- 5. Coupons: no public read of the raw table (that would let
--    anyone list every active code) — validated only via RPC.
-- ───────────────────────────────────────────────
drop policy if exists coupons_admin_all on coupons;
create policy coupons_admin_all on coupons for all to authenticated
  using (is_store_admin()) with check (is_store_admin());
-- deliberately: no select/insert policy for anon/public at all.

create or replace function validate_coupon(p_code text, p_subtotal numeric default 0)
returns json
language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from coupons
    where upper(code) = upper(p_code) and is_active
    limit 1;

  if not found then
    return json_build_object('valid', false, 'message', 'كود الخصم غير صحيح');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return json_build_object('valid', false, 'message', 'كود الخصم منتهي الصلاحية');
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return json_build_object('valid', false, 'message', 'تم استخدام هذا الكود بالكامل');
  end if;
  if c.min_order is not null and p_subtotal < c.min_order then
    return json_build_object('valid', false, 'message', format('الحد الأدنى للطلب %s ج.م', c.min_order));
  end if;

  return json_build_object(
    'valid', true,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value
  );
end $$;

-- ───────────────────────────────────────────────
-- 6. Guest checkout: insert-only for anon (no select/update/
--    delete policy exists for anon on these three tables at
--    all — structurally impossible to enumerate other orders).
-- ───────────────────────────────────────────────
drop policy if exists customers_public_insert on customers;
drop policy if exists customers_admin_all     on customers;
create policy customers_public_insert on customers for insert to public with check (true);
create policy customers_admin_all     on customers for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

drop policy if exists orders_public_insert on orders;
drop policy if exists orders_admin_all     on orders;
create policy orders_public_insert on orders for insert to public with check (true);
create policy orders_admin_all     on orders for all to authenticated
  using (is_store_admin()) with check (is_store_admin());

drop policy if exists order_items_public_insert on order_items;
drop policy if exists order_items_admin_all     on order_items;
create policy order_items_public_insert on order_items for insert to public with check (true);
create policy order_items_admin_all     on order_items for all to authenticated
  using (is_store_admin()) with check (is_store_admin());
