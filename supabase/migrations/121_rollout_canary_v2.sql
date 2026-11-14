-- Migration 121: Gradual Rollout Configuration for AI Sales Assistant v2.0
INSERT INTO public.site_settings (key, value)
VALUES 
  ('chat_engine_v2_mode', 'canary'),
  ('chat_engine_v2_canary_percent', '5'),
  ('chat_engine_v2_allowlist', 'eval-v2-canary-84')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
