-- ============================================================================
-- Migration: 20261002_01_paint_token_management.sql
-- Description: Complete Paint Token Management schema:
--              Brands, Series, Custom Units, Series Token Configs,
--              Multi-line Token Redemptions, and re-architected Token Transactions
--              with 4-part identity (Brand + Series + Unit + Token Value).
-- ============================================================================

-- 1. Brands Table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_tenant_name ON brands (tenant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id, status);

-- 2. Brand Series Table
CREATE TABLE IF NOT EXISTS brand_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_series_tenant_brand_name ON brand_series (tenant_id, brand_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_brand_series_brand ON brand_series(tenant_id, brand_id, status);

-- 3. Custom Units Table
CREATE TABLE IF NOT EXISTS custom_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_units_tenant_name ON custom_units (tenant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_custom_units_tenant ON custom_units(tenant_id);

-- 4. Series Token Configurations Table
CREATE TABLE IF NOT EXISTS series_token_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES brand_series(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    token_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (token_value >= 0),
    is_drum_auto BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_series_token_configs ON series_token_configs (tenant_id, series_id, LOWER(unit_name));
CREATE INDEX IF NOT EXISTS idx_series_token_configs ON series_token_configs(tenant_id, series_id);

-- 5. Token Redemptions (Master Header for Multi-line Redemptions)
CREATE TABLE IF NOT EXISTS token_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    redemption_no TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
    total_tokens INTEGER NOT NULL CHECK (total_tokens > 0),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    payout_method TEXT NOT NULL DEFAULT 'cash' CHECK (payout_method = 'cash'),
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_redemptions_tenant_shift ON token_redemptions(tenant_id, shift_id);

-- 6. Token Redemption Items (Multi-line Details)
CREATE TABLE IF NOT EXISTS token_redemption_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redemption_id UUID NOT NULL REFERENCES token_redemptions(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    brand_name TEXT NOT NULL,
    series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL,
    series_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    token_value NUMERIC(10,2) NOT NULL CHECK (token_value > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10,2) NOT NULL CHECK (line_total > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_redemption_items_redemption ON token_redemption_items(redemption_id);

-- 7. Re-architect Token Transactions Ledger
DROP TABLE IF EXISTS token_transactions CASCADE;

CREATE TABLE token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'issued',         -- POS Sale Keep Token (Customer took physical token, activity log only)
        'shop_retained',   -- POS Sale Remove Token (Discount applied, shop kept token in safe)
        'redeemed',        -- Customer handed physical token for cash payout (enters safe)
        'opening_stock',   -- Drawer initialization / safe seeding (distinct physical origin)
        'settle_vendor',   -- Handed over to manufacturer sales rep
        'write_off',       -- Damaged / Lost / Expired / Invalid
        'used_purchase',   -- Applied against supplier purchase / payment voucher
        'reversal'         -- Inversion of invoice cancellation
    )),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    redemption_id UUID REFERENCES token_redemptions(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    brand_name TEXT NOT NULL,
    series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL,
    series_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    token_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (token_value >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    remaining_quantity INTEGER NOT NULL DEFAULT 0 CHECK (remaining_quantity >= 0),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    usage_status TEXT NOT NULL DEFAULT 'available' CHECK (usage_status IN ('available', 'settled', 'written_off', 'reversed', 'n_a')),
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    notes TEXT,
    write_off_reason TEXT, -- 'Damaged', 'Lost', 'Invalid', 'Other'
    settled_vendor_name TEXT,
    used_against_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    used_against_voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
    parent_transaction_id UUID REFERENCES token_transactions(id) ON DELETE SET NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_tx_tenant_usage ON token_transactions(tenant_id, usage_status, type);
CREATE INDEX IF NOT EXISTS idx_token_tx_identity ON token_transactions(tenant_id, brand_name, series_name, unit_name, token_value);
CREATE INDEX IF NOT EXISTS idx_token_tx_invoice ON token_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_shift ON token_transactions(tenant_id, shift_id, type);

-- 8. Alter Items to support Brand and Series references
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_items_brand_series ON items(brand_id, series_id);

-- 9. Seed Brands from existing Items
INSERT INTO brands (tenant_id, name, status)
SELECT DISTINCT tenant_id, INITCAP(TRIM(brand)), 'active'
FROM items
WHERE brand IS NOT NULL AND TRIM(brand) != ''
ON CONFLICT (tenant_id, LOWER(name)) DO NOTHING;

-- Link existing items to newly created brand records
UPDATE items i
SET brand_id = b.id
FROM brands b
WHERE i.tenant_id = b.tenant_id AND LOWER(TRIM(i.brand)) = LOWER(b.name)
AND i.brand_id IS NULL;

-- Create default "General Series" for each brand
INSERT INTO brand_series (tenant_id, brand_id, name, status)
SELECT tenant_id, id, 'General Series', 'active'
FROM brands
ON CONFLICT (tenant_id, brand_id, LOWER(name)) DO NOTHING;

-- Link existing items to default series
UPDATE items i
SET series_id = s.id
FROM brand_series s
WHERE i.brand_id = s.brand_id AND s.name = 'General Series'
AND i.series_id IS NULL;

-- Seed default standard units (Gallon, Drum, Quarter) for each Series
INSERT INTO series_token_configs (tenant_id, series_id, unit_name, is_enabled, token_value, is_drum_auto)
SELECT tenant_id, id, 'Gallon', FALSE, 0, FALSE
FROM brand_series
ON CONFLICT (tenant_id, series_id, LOWER(unit_name)) DO NOTHING;

INSERT INTO series_token_configs (tenant_id, series_id, unit_name, is_enabled, token_value, is_drum_auto)
SELECT tenant_id, id, 'Drum', FALSE, 0, TRUE
FROM brand_series
ON CONFLICT (tenant_id, series_id, LOWER(unit_name)) DO NOTHING;

INSERT INTO series_token_configs (tenant_id, series_id, unit_name, is_enabled, token_value, is_drum_auto)
SELECT tenant_id, id, 'Quarter', FALSE, 0, FALSE
FROM brand_series
ON CONFLICT (tenant_id, series_id, LOWER(unit_name)) DO NOTHING;

-- 10. Enable Row-Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_token_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_redemption_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for PyntFlow (auth handled at API & session layer)
DROP POLICY IF EXISTS brands_all ON brands;
CREATE POLICY brands_all ON brands FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS brand_series_all ON brand_series;
CREATE POLICY brand_series_all ON brand_series FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS custom_units_all ON custom_units;
CREATE POLICY custom_units_all ON custom_units FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS series_token_configs_all ON series_token_configs;
CREATE POLICY series_token_configs_all ON series_token_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS token_redemptions_all ON token_redemptions;
CREATE POLICY token_redemptions_all ON token_redemptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS token_redemption_items_all ON token_redemption_items;
CREATE POLICY token_redemption_items_all ON token_redemption_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS token_transactions_all ON token_transactions;
CREATE POLICY token_transactions_all ON token_transactions FOR ALL USING (true) WITH CHECK (true);

-- 11. Deprecate legacy clients.token_balance
COMMENT ON COLUMN clients.token_balance IS 'DEPRECATED: Legacy virtual token balance. Tokens are physical assets only.';
