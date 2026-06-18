-- Deposit proofs — admin approval before order confirm
-- Run in Supabase SQL Editor after 001 and 002

CREATE TABLE IF NOT EXISTS deposit_proofs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT,
  name TEXT,
  phone TEXT,
  address TEXT,
  items_summary TEXT,
  total NUMERIC,
  telegram_message_id BIGINT,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS deposit_proofs_telegram_msg_idx
  ON deposit_proofs (telegram_message_id);

CREATE INDEX IF NOT EXISTS deposit_proofs_status_created_idx
  ON deposit_proofs (status, created_at DESC);

ALTER TABLE deposit_proofs ENABLE ROW LEVEL SECURITY;

-- Access only via service role from API routes (no public policies)
