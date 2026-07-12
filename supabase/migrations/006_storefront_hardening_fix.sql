-- ════════════════════════════════════════════════════════════
-- Correction pass on 005: after applying it, a query of the live
-- pg_policies table found two leftovers 005's DROP statements
-- didn't catch because their real names differed from what was
-- guessed:
--   1. site_settings still had "Admin all settings" — cmd=ALL,
--      roles=public, qual=true, with_check=true — STILL wide
--      open to any anon visitor. This is the same class of bug
--      005 was written to fix; it just had a different name than
--      assumed ("Admin all settings" vs "Admin all site_settings").
--   2. coupons still had "Public read coupons" (qual: is_active
--      = true) — narrower than a blanket `true`, but still lets
--      anyone read every active code's discount_type/value/
--      min_order directly, defeating the point of validate_coupon().
-- Also drops a couple of harmless-but-redundant duplicate SELECT
-- policies left over from 005 (banners/categories/reviews each
-- ended up with two overlapping public-read policies).
-- ════════════════════════════════════════════════════════════

drop policy if exists "Admin all settings" on site_settings;

drop policy if exists "Public read coupons" on coupons;

-- de-duplicate: keep the new *_public_read policy, drop the
-- old differently-named twin on each table.
drop policy if exists "Public read banners" on banners;
drop policy if exists "Public read categories" on categories;

-- reviews: the original policy correctly scoped to is_visible;
-- mine (reviews_public_read) was a plain `true` duplicate — drop
-- mine, keep the correct one.
drop policy if exists reviews_public_read on reviews;
