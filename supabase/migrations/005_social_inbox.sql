-- Social inbox: messages + orders from Facebook & Instagram
-- Run in Supabase SQL Editor after previous migrations

-- ═══ Social Messages ═══
CREATE TABLE IF NOT EXISTS social_messages (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_id TEXT,
  recipient_id TEXT,
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'comment', 'comment_reply')),
  comment_id TEXT,
  post_id TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_messages_sender_idx
  ON social_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS social_messages_platform_dir_idx
  ON social_messages (platform, direction, created_at DESC);

CREATE INDEX IF NOT EXISTS social_messages_recipient_idx
  ON social_messages (recipient_id, created_at DESC);

ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;

-- ═══ Social Orders ═══
CREATE TABLE IF NOT EXISTS social_orders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  source TEXT,
  social_sender_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_orders_status_idx
  ON social_orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS social_orders_sender_idx
  ON social_orders (social_sender_id);

ALTER TABLE social_orders ENABLE ROW LEVEL SECURITY;
