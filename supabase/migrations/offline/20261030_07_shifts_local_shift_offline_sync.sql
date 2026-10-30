-- ============================================================================
-- Migration: 20261030_07_shifts_local_shift_offline_sync.sql
-- Phase: Phase 7 (Offline Session Grace + Local Shift)
-- Purpose: Support offline shift opening and idempotent sync reconciliation.
--          PRIMARY KEY POLICY: Server ALWAYS generates shifts.id (DEFAULT gen_random_uuid()).
--          The client-supplied offline shift UUID is stored strictly in `local_shift_id`.
--          When reconnecting, the sync engine calls the server endpoint with `local_shift_id`.
--          The server inserts the shift (or returns the existing open shift) and responds
--          with the authoritative server `id`. The client maps local_shift_id -> server_id,
--          and resolves pending queued sales referencing local_shift_id to the server_id
--          prior to syncing sales FIFO.
--
-- DESIGN DECISIONS & QUESTIONS ANSWERED:
-- 1. Server already has open shift when offline shift syncs:
--    If an offline shift arrives to sync and the server already has an active 'open' shift
--    for that tenant/branch/user, the server DOES NOT create a concurrent overlapping shift.
--    Instead, the sync engine treats this idempotently: it returns the server's existing open
--    shift ID. The client reconciles local_shift_id -> existing_server_shift_id and updates
--    all queued sales locally to reference that open shift.
-- 2. Offline Shift Close:
--    Shift CLOSE is strictly ONLINE-ONLY in v1. A cashier cannot close a register shift
--    while offline because shift closure requires definitive end-of-day cash reconciliation,
--    syncing all outstanding sales, and verifying server totals.
-- 3. Time Safety for Shift Opened Time:
--    The shift `start_time` (derived from offline `opened_at_local`) is validated with the
--    same time-safety bounds: rejected if > 5 minutes in future (skew guard) or > 7 days old.
--
-- Depends on: 20261030_04_invoices_late_sync_shift_columns.sql
-- When to apply: Together with or before deploying Phase 7 client offline shift logic
-- Risk: Low (additive columns with defaults, unique partial index on non-null)
-- Status: NOT APPLIED (Prepared for Owner Review)
-- ============================================================================

-- 1. Additive columns for shifts table (server generates primary key id)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS local_shift_id UUID NULL,
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL;

-- 2. Unique deduplication index on local_shift_id per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_local_shift_dedup
  ON public.shifts(tenant_id, local_shift_id)
  WHERE local_shift_id IS NOT NULL;

-- 3. Fast lookup index for active offline shifts
CREATE INDEX IF NOT EXISTS idx_shifts_offline_status
  ON public.shifts(tenant_id, status, is_offline)
  WHERE is_offline = true;
