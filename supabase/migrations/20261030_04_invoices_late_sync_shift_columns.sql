-- Migration: 20261030_04_invoices_late_sync_shift_columns.sql
-- Description: Track late-synced offline sales originating from earlier shifts.
-- Columns:
--   is_late_sync: true if sale occurred during an earlier shift and synced into the currently open shift.
--   original_shift_id: ID of the shift that was active on the client when the sale was made (if known).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_late_sync BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_shift_id UUID NULL REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_shift_late_sync
  ON public.invoices(tenant_id, shift_id, is_late_sync)
  WHERE is_late_sync = true;

