-- ==============================================================================
-- ROLLBACK ARTIFACT: rollback_20261013_03_fix_create_voucher_atomic.sql
-- Target: public.create_voucher_atomic
-- Location: supabase/rollbacks/ (ISOLATED outside active migrations root)
-- Purpose: Emergency standby recovery and containment script for create_voucher_atomic
-- Reference: docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md (Revision 12 FINAL Task T5)
-- ==============================================================================
--
-- IMPORTANT SAFETY & DESIGN NOTICE:
-- 1. This file is intentionally placed in supabase/rollbacks/ so that forward migration
--    runners do NOT execute it automatically.
-- 2. RESOLUTION OF ROLLBACK CONTRADICTION:
--    A verbatim revert to the historical baseline migration (20261005_04_create_voucher_atomic.sql)
--    would reinstate the P0 defect BUG-VA-01 (used_date = NOW() at line 129).
--    Because column "used_date" does NOT exist in public.token_transactions, reverting
--    verbatim to 20261005_04 would restore error 42703 (undefined_column) and crash
--    every voucher transaction that applies tokens.
--    Dropping the function entirely would break /api/vouchers for all voucher creation.
-- 3. SAFE CONTAINMENT HYBRID SPECIFICATION:
--    - Drops the canonical JSONB overload create_voucher_atomic(uuid, jsonb, jsonb) introduced
--      in migration 20261013_03.
--    - Restores the baseline UUID-array overload create_voucher_atomic(uuid, jsonb, uuid[])
--      as a clean containment routine with the invalid "used_date = NOW()" assignment removed.
--    - Retains row-level FOR UPDATE locking on tokens and party balances.
--    - Retains collision-resistant candidate voucher_no generation and uniqueness checking.
--    - Preserves security posture (restricted strictly to service_role).
-- 4. DATA REALITY: Rolling back function DDL modifies routine code only; it does NOT
--    undo child slices or balance adjustments committed while the forward patch was active.
-- ==============================================================================

-- ── 1. Drop the forward canonical JSONB overload ─────────────────────────────
DROP FUNCTION IF EXISTS public.create_voucher_atomic(uuid, jsonb, jsonb);

-- ── 2. Restore the baseline UUID[] overload (Safe Containment Definition) ────
CREATE OR REPLACE FUNCTION public.create_voucher_atomic(
  p_tenant_id    UUID,
  p_voucher_data JSONB,
  p_token_ids    UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_voucher_type     TEXT;
  v_party_type       TEXT;
  v_party_id         UUID;
  v_party_name       TEXT;
  v_amount           NUMERIC;
  v_payment_mode     TEXT;
  v_reference_no     TEXT;
  v_remarks          TEXT;
  v_created_by       TEXT;
  v_date             DATE;
  v_voucher_no       TEXT;
  v_prefix           TEXT;

  v_token_count      INT;
  v_token            RECORD;
  v_tokens_amount    NUMERIC := 0;
  v_total_settlement NUMERIC := 0;

  v_voucher_id       UUID;
  v_client           RECORD;
  v_supplier         RECORD;
  v_updated_balance  NUMERIC := 0;
BEGIN
  -- 1. Validate tenant_id
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  -- 2. Extract fields from JSONB parameter
  v_voucher_type := COALESCE(p_voucher_data->>'voucher_type', 'receipt');
  v_party_type   := COALESCE(p_voucher_data->>'party_type', 'client');
  v_party_id     := NULLIF(p_voucher_data->>'party_id', '')::UUID;
  v_party_name   := COALESCE(p_voucher_data->>'party_name', '');
  v_amount       := GREATEST(0, COALESCE((p_voucher_data->>'amount')::NUMERIC, 0));
  v_payment_mode := p_voucher_data->>'payment_mode';
  v_reference_no := p_voucher_data->>'reference_no';
  v_remarks      := p_voucher_data->>'remarks';
  v_created_by   := p_voucher_data->>'created_by';
  v_date         := COALESCE((p_voucher_data->>'date')::DATE, CURRENT_DATE);
  v_voucher_no   := p_voucher_data->>'voucher_no';

  -- 3. Validate & sum applied stockpile tokens; lock rows (prevent concurrent double-apply)
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_token_count
      FROM token_transactions
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;

    IF v_token_count <> array_length(p_token_ids, 1) THEN
      RAISE EXCEPTION 'One or more tokens do not belong to this tenant or do not exist';
    END IF;

    FOR v_token IN
      SELECT id, token_value, usage_status, used_against_voucher_id, used_against_purchase_id
        FROM token_transactions
       WHERE id = ANY(p_token_ids)
         AND tenant_id = p_tenant_id
       ORDER BY id ASC
         FOR UPDATE
    LOOP
      IF v_token.usage_status = 'used' THEN
        RAISE EXCEPTION 'Token % has already been marked as used', v_token.id;
      END IF;
      IF v_token.used_against_voucher_id IS NOT NULL OR v_token.used_against_purchase_id IS NOT NULL THEN
        RAISE EXCEPTION 'One or more selected tokens have already been applied to another purchase or payment';
      END IF;
      v_tokens_amount := v_tokens_amount + COALESCE(v_token.token_value, 0);
    END LOOP;
  END IF;

  v_total_settlement := v_amount + v_tokens_amount;

  IF v_total_settlement <= 0 THEN
    RAISE EXCEPTION 'A valid cash amount or token selection is required';
  END IF;

  -- 4. Collision-resistant voucher_no generation with retry
  v_prefix := CASE WHEN v_voucher_type = 'receipt' THEN 'RCP' ELSE 'PMT' END;
  IF v_voucher_no IS NULL OR trim(v_voucher_no) = '' THEN
    v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
  END IF;

  WHILE EXISTS (SELECT 1 FROM vouchers WHERE tenant_id = p_tenant_id AND voucher_no = v_voucher_no) LOOP
    v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
  END LOOP;

  -- 5. Insert voucher record
  INSERT INTO vouchers (
    tenant_id, voucher_no, voucher_type, party_type, party_id,
    party_name, amount, payment_mode, reference_no, remarks,
    created_by, date
  ) VALUES (
    p_tenant_id, v_voucher_no, v_voucher_type, v_party_type, v_party_id,
    v_party_name, v_total_settlement, v_payment_mode, v_reference_no, v_remarks,
    v_created_by, v_date
  )
  RETURNING id INTO v_voucher_id;

  -- 6. Mark tokens as used against this voucher (SAFE: omits nonexistent used_date column)
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    UPDATE token_transactions
       SET usage_status            = 'used',
           used_against_voucher_id = v_voucher_id
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;
  END IF;

  -- 7. Atomically adjust party balance with row-level lock (FOR UPDATE)
  IF v_party_type = 'client' THEN
    SELECT id, current_balance INTO v_client
      FROM clients
     WHERE id = v_party_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client not found for this tenant';
    END IF;

    v_updated_balance := COALESCE(v_client.current_balance, 0) - v_total_settlement;

    UPDATE clients
       SET current_balance = v_updated_balance
     WHERE id = v_party_id AND tenant_id = p_tenant_id;

  ELSIF v_party_type = 'supplier' THEN
    SELECT id, current_balance INTO v_supplier
      FROM suppliers
     WHERE id = v_party_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier not found for this tenant';
    END IF;

    v_updated_balance := COALESCE(v_supplier.current_balance, 0) - v_total_settlement;

    UPDATE suppliers
       SET current_balance     = v_updated_balance,
           last_payment_amount = v_total_settlement,
           last_payment_date   = v_date
     WHERE id = v_party_id AND tenant_id = p_tenant_id;
  END IF;

  -- 8. Record audit log
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id,
    COALESCE(v_created_by, v_party_name, 'System'),
    CASE WHEN v_voucher_type = 'receipt' THEN 'Payment Received' ELSE 'Supplier Payment' END,
    'voucher',
    'voucher',
    v_voucher_id::text,
    jsonb_build_object(
      'voucher_no',            v_voucher_no,
      'voucher_type',          v_voucher_type,
      'party_type',            v_party_type,
      'party_id',              v_party_id,
      'party_name',            v_party_name,
      'amount',                v_total_settlement,
      'cash_amount',           v_amount,
      'tokens_amount',         v_tokens_amount,
      'payment_mode',          v_payment_mode,
      'token_ids',             p_token_ids,
      'updated_balance',       v_updated_balance
    )
  );

  -- 9. Return structured result
  RETURN jsonb_build_object(
    'voucher_id',            v_voucher_id,
    'voucher_no',            v_voucher_no,
    'voucher_type',          v_voucher_type,
    'party_type',            v_party_type,
    'party_id',              v_party_id,
    'party_name',            v_party_name,
    'amount',                v_total_settlement,
    'cash_amount',           v_amount,
    'tokens_amount',         v_tokens_amount,
    'payment_mode',          v_payment_mode,
    'updated_balance',       v_updated_balance
  );
END;
$func$;

-- ── 3. Security posture & access privileges ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) TO service_role;
