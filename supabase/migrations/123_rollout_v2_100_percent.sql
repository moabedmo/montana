-- Migration 123: Full Launch (100% of customers) for Montana AI Sales Assistant v2.0
UPDATE public.site_settings
SET value = 'on'
WHERE key = 'chat_engine_v2_mode';

UPDATE public.site_settings
SET value = '100'
WHERE key = 'chat_engine_v2_canary_percent';
