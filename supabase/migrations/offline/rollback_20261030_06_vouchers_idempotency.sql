-- ============================================================================
-- Rollback: rollback_20261030_06_vouchers_idempotency.sql
-- Phase: Rollback for Phase 6 / 9 Vouchers Idempotency Migration
-- Purpose: Restores pre-offline create_voucher_atomic RPC from archive and drops
--          added offline and late-sync columns and indexes from vouchers.
-- Status: NOT APPLIED (Rollback Script)
-- ============================================================================

-- 1. Restore archived pre-offline create_voucher_atomic RPC
\i supabase/migrations/archive/archive_create_voucher_atomic_pre_offline.sql

-- 2. Drop indexes
DROP INDEX IF EXISTS public.idx_vouchers_shift_late_sync;
DROP INDEX IF EXISTS public.idx_vouchers_local_receipt_search;
DROP INDEX IF EXISTS public.idx_vouchers_offline_dedup;
DROP INDEX IF EXISTS public.idx_vouchers_idempotency;

-- 3. Drop columns
ALTER TABLE public.vouchers
  DROP COLUMN IF EXISTS original_shift_id,
  DROP COLUMN IF EXISTS is_late_sync,
  DROP COLUMN IF EXISTS synced_at,
  DROP COLUMN IF EXISTS local_receipt_no,
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS created_at_local,
  DROP COLUMN IF EXISTS is_offline,
  DROP COLUMN IF EXISTS idempotency_key;
