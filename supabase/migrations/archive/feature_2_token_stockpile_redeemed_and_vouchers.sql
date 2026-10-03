-- Feature 2 Extension: Redeemed Customer Tokens Stockpile & Supplier Voucher Token Payments

-- 1. Add used_against_voucher_id to token_transactions
ALTER TABLE token_transactions
  ADD COLUMN IF NOT EXISTS used_against_voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL;

-- 2. Backfill existing redeemed rows to have 'available' usage_status if not used
UPDATE token_transactions
SET usage_status = 'available'
WHERE transaction_type = 'redeemed'
  AND (usage_status IS NULL OR usage_status = '')
  AND used_against_purchase_id IS NULL
  AND used_against_voucher_id IS NULL;

-- 3. Create index for voucher lookups
CREATE INDEX IF NOT EXISTS idx_token_transactions_voucher ON token_transactions(used_against_voucher_id);
