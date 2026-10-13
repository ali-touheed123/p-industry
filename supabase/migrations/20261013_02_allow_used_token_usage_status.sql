-- Migration: 20261013_02_allow_used_token_usage_status.sql
-- Purpose:   Add 'used' status to token_transactions_usage_status_check constraint
-- Target:    public.token_transactions
-- Context:   Enables token deduction in create_purchase_atomic & create_voucher_atomic (C-08)
--
-- BUSINESS CONTEXT:
--   When physical tokens are redeemed against supplier purchases or payment vouchers,
--   both create_purchase_atomic and create_voucher_atomic update:
--     UPDATE token_transactions SET usage_status = 'used', used_against_purchase_id = ...
--   However, the original check constraint created in 20261002_01 only permitted:
--     ('available', 'settled', 'written_off', 'reversed', 'n_a').
--   This migration broadens the allowed status set to include 'used', preserving all
--   pre-existing statuses and existing data.

ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_usage_status_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_usage_status_check
  CHECK (usage_status IN ('available', 'settled', 'used', 'written_off', 'reversed', 'n_a'));
