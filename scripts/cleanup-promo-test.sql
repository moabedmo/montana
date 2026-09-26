-- =============================================================================
-- Montana: remove the promo test order, and correct Amany's
-- Supabase Dashboard → SQL Editor → Run
-- Project: ikryeyqrithikabwidov
--
-- Two jobs, both one-off:
--
--   1. MON-43525 — placed only to prove migration 117 works. It is a real row
--      and it took a unit of stock, so the stock goes back before it is
--      deleted.
--
--   2. MON-53582 — Amany's real order, written before 117 was applied, so it
--      carries no discount: 324 where it should be 274. Her stock and items
--      are correct; only the money is wrong.
--
-- Run STEP 0 first and read what it prints before running anything else.
-- =============================================================================


-- ── STEP 0: look at both rows before touching them ───────────────────────
select order_number, customer_name, customer_phone,
       subtotal, discount, shipping_cost, total, created_at
from orders
where order_number in ('MON-43525', 'MON-53582')
order by created_at;


-- ── STEP 1: delete the test order, stock first ───────────────────────────
begin;

update products p
   set stock = p.stock + oi.quantity
  from order_items oi
  join orders o on o.id = oi.order_id
 where o.order_number = 'MON-43525'
   and p.id = oi.product_id;

delete from order_items
 where order_id in (select id from orders where order_number = 'MON-43525');

delete from orders where order_number = 'MON-43525';

-- the customer row it created along the way
delete from customers
 where name = 'TEST DELETE ME' and phone = '01000000001';

commit;


-- ── STEP 2: correct Amany's order to what she was quoted ─────────────────
-- 249 − 20% = 199, plus 75 shipping to المنيا = 274.
begin;

update orders
   set discount = 50,
       total    = 274
 where order_number = 'MON-53582'
   and subtotal = 249
   and total = 324;          -- refuses to run twice, or on the wrong row

commit;


-- ── STEP 3: confirm ──────────────────────────────────────────────────────
select order_number, customer_name, subtotal, discount, shipping_cost, total
from orders
where order_number in ('MON-43525', 'MON-53582');
-- expected: one row only — MON-53582, discount 50, total 274.
