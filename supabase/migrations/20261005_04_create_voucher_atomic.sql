-- Migration: 20261005_04_create_voucher_atomic.sql
-- Purpose: Task 8.1 & 8.2 — Encapsulate voucher creation, token status update, and party balance
--          adjustment in a single atomic PostgreSQL transaction with collision-resistant voucher codes.
-- Fixes: FINDING-LEDG-001 (HIGH) & FINDING-LEDG-002 (MEDIUM)
-- Phase: 8
--
-- Parameters:
--   p_tenant_id     UUID   -- Tenant ID owning the voucher (server-enforced)
--   p_voucher_data  JSONB  -- Voucher header fields
--   p_token_ids     UUID[] -- Array of stockpile token IDs applied (optional)
--
-- Returns JSONB with:
--   { "voucher_id": UUID, "voucher_no": TEXT, "amount": NUMERIC, "updated_balance": NUMERIC, ... }

CREATE OR REPLACE FUNCTION create_voucher_atomic(
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

  IF v_party_id IS NULL THEN
    RAISE EXCEPTION 'party_id is required';
  END IF;

  -- 3. Validate & lock applied tokens (if any)
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_token_count
      FROM token_transactions
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;

    IF v_token_count <> array_length(p_token_ids, 1) THEN
      RAISE EXCEPTION 'One or more selected tokens were not found for this tenant';
    END IF;

    FOR v_token IN
      SELECT id, token_value, usage_status, used_against_purchase_id, used_against_voucher_id
        FROM token_transactions
       WHERE id = ANY(p_token_ids)
         AND tenant_id = p_tenant_id
         FOR UPDATE
    LOOP
      IF v_token.usage_status = 'used' OR v_token.used_against_purchase_id IS NOT NULL OR v_token.used_against_voucher_id IS NOT NULL THEN
        RAISE EXCEPTION 'One or more selected tokens have already been applied to another purchase or payment';
      END IF;
      v_tokens_amount := v_tokens_amount + COALESCE(v_token.token_value, 0);
    END LOOP;
  END IF;

  v_total_settlement := v_amount + v_tokens_amount;

  IF v_total_settlement <= 0 THEN
    RAISE EXCEPTION 'A valid cash amount or token selection is required';
  END IF;

  -- 4. Collision-resistant voucher_no generation with retry (Task 8.2)
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

  -- 6. Mark tokens as used against this voucher
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    UPDATE token_transactions
       SET usage_status            = 'used',
           used_against_voucher_id = v_voucher_id,
           used_date               = NOW()
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

    -- Receipt decreases client debt (negative balance = advance / store credit preserved)
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

    -- Payment decreases supplier payable (negative balance = advance / credit held with supplier)
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
      'voucher_no',       v_voucher_no,
      'voucher_type',     v_voucher_type,
      'party_type',       v_party_type,
      'party_id',         v_party_id,
      'party_name',       v_party_name,
      'amount',           v_total_settlement,
      'cash_amount',      v_amount,
      'tokens_amount',    v_tokens_amount,
      'updated_balance',  v_updated_balance
    )
  );

  -- 9. Return JSONB confirmation
  RETURN jsonb_build_object(
    'voucher_id',            v_voucher_id,
    'voucher_no',            v_voucher_no,
    'voucher_type',          v_voucher_type,
    'party_type',            v_party_type,
    'party_id',              v_party_id,
    'party_name',            v_party_name,
    'amount',                v_total_settlement,
    'tokens_applied_amount', v_tokens_amount,
    'cash_paid_amount',      v_amount,
    'updated_balance',       v_updated_balance,
    'date',                  v_date
  );

END;
$func$;

GRANT EXECUTE ON FUNCTION create_voucher_atomic(UUID, JSONB, UUID[]) TO service_role;
