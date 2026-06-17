-- Montana social media settings (Facebook + Instagram)
-- Run in Supabase SQL Editor or via supabase db push

CREATE TABLE IF NOT EXISTS montana_settings (
  platform TEXT PRIMARY KEY CHECK (platform IN ('facebook', 'instagram', 'shipping')),
  page_access_token TEXT,
  page_id TEXT,
  instagram_account_id TEXT,
  user_access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  user_token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_id TEXT,
  recipient_id TEXT,
  message_text TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_messages_platform_created_idx
  ON social_messages (platform, created_at DESC);

ALTER TABLE montana_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;

-- No public policies — access only via service role from API routes

CREATE OR REPLACE FUNCTION montana_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS montana_settings_updated_at ON montana_settings;
CREATE TRIGGER montana_settings_updated_at
  BEFORE UPDATE ON montana_settings
  FOR EACH ROW EXECUTE FUNCTION montana_settings_set_updated_at();
