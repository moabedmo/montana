-- Allow shipping row in montana_settings (platform = 'shipping')
ALTER TABLE montana_settings DROP CONSTRAINT IF EXISTS montana_settings_platform_check;
ALTER TABLE montana_settings ADD CONSTRAINT montana_settings_platform_check
  CHECK (platform IN ('facebook', 'instagram', 'shipping'));

-- Shipping credentials stored as:
--   platform = 'shipping'
--   page_access_token = API key
--   page_id = API URL / endpoint base
--   metadata = { company_name, paths, last_test_at, last_test_message }
