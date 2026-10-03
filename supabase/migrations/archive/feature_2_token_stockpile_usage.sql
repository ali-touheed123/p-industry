-- Feature 2 Revision: Token Stockpile Usage for Supplier Purchase Offsets

-- 1. Add usage tracking columns to token_transactions
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS usage_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS used_against_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_date TIMESTAMPTZ DEFAULT NULL;

-- 2. Add tokens_applied_amount to purchases table if not exists
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS tokens_applied_amount NUMERIC(10,2) DEFAULT 0;

-- 3. Backfill existing shop_retained rows to have 'available' usage_status
UPDATE token_transactions
SET usage_status = 'available'
WHERE transaction_type = 'shop_retained'
  AND (usage_status IS NULL OR usage_status = '');

-- 4. Create indexes for fast status and purchase lookups
CREATE INDEX IF NOT EXISTS idx_token_transactions_usage_status ON token_transactions(usage_status);
CREATE INDEX IF NOT EXISTS idx_token_transactions_purchase     ON token_transactions(used_against_purchase_id);
