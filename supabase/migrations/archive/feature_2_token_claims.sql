-- Feature 2 Extension: Token Claim Tracking for Shop Retained Tokens

-- 1. Add claim tracking columns to token_transactions
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS claimed_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS claim_reference TEXT DEFAULT NULL;

-- 2. Backfill existing shop_retained rows to have 'pending' claim_status if not already claimed
UPDATE token_transactions
SET claim_status = 'pending'
WHERE transaction_type = 'shop_retained'
  AND (claim_status IS NULL OR claim_status = '');

-- 3. Create index for fast status querying
CREATE INDEX IF NOT EXISTS idx_token_transactions_claim_status ON token_transactions(claim_status);
