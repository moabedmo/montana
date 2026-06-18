-- Deposit proof approvals (admin replies «تم» on Telegram)
-- Run in Supabase SQL Editor if not using supabase db push

ALTER TABLE montana_settings DROP CONSTRAINT IF EXISTS montana_settings_platform_check;
ALTER TABLE montana_settings ADD CONSTRAINT montana_settings_platform_check
  CHECK (platform IN ('facebook', 'instagram', 'shipping', 'deposits'));
