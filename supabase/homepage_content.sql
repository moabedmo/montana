-- نفس migration 004 — انسخي وشغّلي في Supabase SQL Editor

ALTER TABLE montana_settings DROP CONSTRAINT IF EXISTS montana_settings_platform_check;

ALTER TABLE montana_settings ADD CONSTRAINT montana_settings_platform_check
  CHECK (platform IN ('facebook', 'instagram', 'shipping', 'homepage'));

INSERT INTO montana_settings (platform, status, metadata)
VALUES (
  'homepage',
  'connected',
  jsonb_build_object('content', '{}'::jsonb, 'updated_at', NOW())
)
ON CONFLICT (platform) DO NOTHING;
