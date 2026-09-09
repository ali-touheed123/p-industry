-- Feature 2 Extension: Token Enhancements (Loose Tokens, Discrete Counts, Splits, Opening Stock, Vendor Settlements, Write-Offs)

-- 1. Update check constraint on transaction_type to include opening_stock and write_off
DO $$
BEGIN
  ALTER TABLE token_transactions DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;
  ALTER TABLE token_transactions ADD CONSTRAINT token_transactions_transaction_type_check 
    CHECK (transaction_type IN ('issued', 'redeemed', 'shop_retained', 'opening_stock', 'write_off'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 2. Add columns for discrete token counting, loose token flagging, partial surrenders, and write-offs
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_token_value NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS write_off_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS settlement_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES token_transactions(id) ON DELETE SET NULL;

-- 3. Backfill legacy rows with consistent count and unit values
UPDATE token_transactions
SET 
  token_count = COALESCE(token_count, 1),
  unit_token_value = CASE 
    WHEN unit_token_value IS NULL OR unit_token_value = 0 THEN token_value 
    ELSE unit_token_value 
  END,
  remaining_count = CASE 
    WHEN usage_status = 'used' THEN 0
    WHEN remaining_count IS NULL THEN 1
    ELSE remaining_count
  END
WHERE token_count IS NULL OR unit_token_value IS NULL OR unit_token_value = 0;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_parent ON token_transactions(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_is_external ON token_transactions(is_external);
