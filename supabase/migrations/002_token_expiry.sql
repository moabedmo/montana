-- Add token expiry + user token storage for long-lived token refresh
ALTER TABLE montana_settings
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_access_token TEXT,
  ADD COLUMN IF NOT EXISTS user_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN montana_settings.token_expires_at IS 'Page access token expiry (NULL = non-expiring long-lived page token)';
COMMENT ON COLUMN montana_settings.user_access_token IS 'Long-lived user token used to refresh page token';
COMMENT ON COLUMN montana_settings.user_token_expires_at IS 'Long-lived user token expiry (~60 days)';
