-- Rollback Artifact: rollback_20261013_02_allow_used_token_usage_status.sql
-- Target:    public.token_transactions
-- Location:  supabase/rollbacks/ (ISOLATED outside active migrations root)
-- Purpose:   Emergency standby rollback for 20261013_02_allow_used_token_usage_status.sql
--
-- REVERT BEHAVIOR:
--   Restores the original 5-value check constraint ('available', 'settled', 'written_off', 'reversed', 'n_a').
--
-- DATA REALITY NOTICE:
--   If any rows were saved with usage_status = 'used' while the forward migration was active,
--   re-applying this constraint will fail unless those rows are reclassified or reverted first.

ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_usage_status_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_usage_status_check
  CHECK (usage_status IN ('available', 'settled', 'written_off', 'reversed', 'n_a'));
