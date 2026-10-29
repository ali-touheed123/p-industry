-- Rollback: 20261030_04_invoices_late_sync_shift_columns.sql
-- Drops the partial index, then removes both columns.
-- Safe to run even if partially applied.

DROP INDEX IF EXISTS public.idx_invoices_shift_late_sync;

ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS original_shift_id,
  DROP COLUMN IF EXISTS is_late_sync;

