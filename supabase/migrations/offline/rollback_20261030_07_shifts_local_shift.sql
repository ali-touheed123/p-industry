-- ============================================================================
-- Rollback: rollback_20261030_07_shifts_local_shift.sql
-- Phase: Rollback for Phase 7 Shifts Offline Sync Migration
-- Purpose: Drops offline columns and unique partial index from shifts table.
-- Status: NOT APPLIED (Rollback Script)
-- ============================================================================

DROP INDEX IF EXISTS public.idx_shifts_offline_status;
DROP INDEX IF EXISTS public.idx_shifts_local_shift_dedup;

ALTER TABLE public.shifts
  DROP COLUMN IF EXISTS synced_at,
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS is_offline,
  DROP COLUMN IF EXISTS local_shift_id;

