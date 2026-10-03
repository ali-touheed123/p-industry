-- Feature 2: Paint Token Management System & Brand Migration

-- 1. Add brand and token fields to items table
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS has_token BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS token_value NUMERIC(10,2) DEFAULT 0;

-- 2. Add token_balance to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS token_balance NUMERIC(10,2) DEFAULT 0;

-- 3. Create token_transactions table
CREATE TABLE IF NOT EXISTS token_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_type  TEXT NOT NULL CHECK (transaction_type IN ('issued','redeemed','shop_retained')),
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name       TEXT,
  item_id           UUID REFERENCES items(id) ON DELETE SET NULL,
  item_name         TEXT,
  brand             TEXT,
  category          TEXT,
  token_value       NUMERIC(10,2) NOT NULL DEFAULT 0,
  redeemed_amount   NUMERIC(10,2) DEFAULT 0,
  remaining_balance NUMERIC(10,2) DEFAULT 0,
  shift_id          UUID REFERENCES shifts(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_tenant ON token_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_shift  ON token_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_client ON token_transactions(client_id);
