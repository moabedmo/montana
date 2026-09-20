-- A store-wide percentage taken off at checkout, without touching prices.
--
-- The Back-to-School ad promised 20% off everything. Nothing applied it: the
-- product prices were unchanged, there was no coupon, and validate_coupon
-- rejected every code the campaign might have used. A customer arriving from
-- that ad paid full price, and the bot was hard-coded to tell her no discount
-- existed.
--
-- Rather than edit six prices and have to put them all back, the promo lives
-- here as three settings. Checkout and the chat bot both read them, so turning
-- the campaign off is one row, and the shelf prices never move.
--
--   promo_percent   whole number, 0 or empty disables it
--   promo_label     what the customer is told this is
--   promo_ends_at   ISO timestamp; past it the promo stops on its own.
--                   Empty means no end date, which is how a campaign quietly
--                   runs for a year — set it.

insert into site_settings (key, value) values
  ('promo_percent', '20'),
  ('promo_label',   'خصم BackToSchool'),
  ('promo_ends_at', '')
on conflict (key) do update set value = excluded.value;
