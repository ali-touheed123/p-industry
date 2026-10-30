-- ============================================================================
-- Rollback: rollback_20261030_08_invoices_version.sql
-- Phase: Rollback for Phase 8 Invoices Version Migration
-- Purpose: Drops v2 update_invoice_atomic (with 6 parameters), restores pre-offline
--          4-arg update_invoice_atomic RPC from archive, and drops version
--          and edit_idempotency_key columns from invoices.
-- Status: NOT APPLIED (Rollback Script)
-- ============================================================================

-- 1. Explicitly drop the v2 6-arg function overload
DROP FUNCTION IF EXISTS public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid);

-- 2. Restore archived pre-offline 4-arg update_invoice_atomic RPC
\i supabase/migrations/archive/archive_update_invoice_atomic_pre_offline.sql

-- 3. Drop unique index
DROP INDEX IF EXISTS public.idx_invoices_edit_idempotency;

-- 4. Drop columns
ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS edit_idempotency_key,
  DROP COLUMN IF EXISTS version;
