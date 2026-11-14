-- Migration 122: Promote canary to 50%
UPDATE public.site_settings
SET value = '50'
WHERE key = 'chat_engine_v2_canary_percent';
