-- Migration 119: Idempotency flag for Meta Purchase tracking (fires once per real order)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS meta_purchase_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_meta_purchase_sent_at ON orders(meta_purchase_sent_at) WHERE meta_purchase_sent_at IS NOT NULL;
