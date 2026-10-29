-- Migration: 20261030_01_held_invoices_local_hold_id.sql
-- Description: Phase 5.3: Add local_hold_id to held_invoices for offline hold idempotency.
-- Additive only. Backward compatible — existing rows have NULL.

ALTER TABLE held_invoices
  ADD COLUMN IF NOT EXISTS local_hold_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_held_invoices_local_hold_id
  ON held_invoices(local_hold_id)
  WHERE local_hold_id IS NOT NULL;

