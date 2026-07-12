-- Paymob card toggle (safe in site_settings — public read; no secrets stored)
insert into site_settings (key, value) values ('paymob_card_enabled', 'false')
on conflict (key) do nothing;
