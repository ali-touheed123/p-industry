-- Add require_ceo_pass master switch to tenants table (defaults to true for existing and new branches)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS require_ceo_pass BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN tenants.require_ceo_pass IS 'Master switch: If true, POS actions (Receipt Settings, Stock Adjustment, Product/Price Edits) require CEO password for staff. If false, staff can access them without CEO password.';

