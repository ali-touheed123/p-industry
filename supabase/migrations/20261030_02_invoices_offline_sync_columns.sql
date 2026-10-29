-- Migration: 20261030_02_invoices_offline_sync_columns.sql
-- Description: Phase 6 Additive Columns for Offline Sales Queue & Auto-Sync
-- Status: PROPOSED (Awaiting Owner Approval)
-- Confirmed tenant column: tenant_id (UUID NOT NULL)

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at_local TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS device_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS local_receipt_no TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS offline_schema_version INT NULL;

-- 1. Unique partial index: strictly dedupes sales per device and slip number
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_offline_dedup
  ON invoices(tenant_id, device_id, local_receipt_no)
  WHERE local_receipt_no IS NOT NULL;

-- 2. Fast index for receipt search, ledger statements, and sales return lookups
CREATE INDEX IF NOT EXISTS idx_invoices_local_receipt_search
  ON invoices(tenant_id, local_receipt_no)
  WHERE local_receipt_no IS NOT NULL;

