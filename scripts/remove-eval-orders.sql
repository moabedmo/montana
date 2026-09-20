-- Remove the orders scripts/eval-chat.js placed on production.
--
-- The eval replays 74 real conversations against www.montana.com.eg, and some
-- of them run all the way to checkout. Those are real rows: they sit in the
-- admin like any other order, they were announced on Telegram, and each one
-- took its quantities out of products.stock. Deleting the order does not put
-- the stock back on its own, so this restores it first.
--
-- Run it in the Supabase SQL editor (project ikryeyqrithikabwidov).
--
-- STEP 1 first — look at what it lists before running step 2.

-- ── STEP 1: what is about to go ───────────────────────────────────────────
select o.order_number, o.created_at, o.customer_name, o.customer_phone,
       o.total, o.status, o.chat_session_id
from orders o
where o.chat_session_id like 'messenger:eval-%'
order by o.created_at desc;

-- and the stock each one took
select p.name, sum(oi.quantity) as "هيرجع للمخزون"
from order_items oi
join orders o on o.id = oi.order_id
join products p on p.id = oi.product_id
where o.chat_session_id like 'messenger:eval-%'
group by p.name
order by 2 desc;


-- ── STEP 2: put the stock back, then delete ───────────────────────────────
-- All or nothing: if anything fails, none of it happens.
begin;

create temp table _eval_orders on commit drop as
  select id from orders where chat_session_id like 'messenger:eval-%';

update products p
   set stock = p.stock + x.qty
  from (select oi.product_id, sum(oi.quantity) as qty
          from order_items oi
          join _eval_orders e on e.id = oi.order_id
         group by oi.product_id) x
 where p.id = x.product_id;

delete from order_items where order_id in (select id from _eval_orders);
delete from orders      where id       in (select id from _eval_orders);

commit;


-- ── STEP 3: confirm nothing is left ───────────────────────────────────────
select count(*) as "باقي من أوردرات الاختبار"
from orders where chat_session_id like 'messenger:eval-%';
