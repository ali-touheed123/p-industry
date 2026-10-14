-- Migration: 20261013_03_fix_create_voucher_atomic.sql
-- Purpose:   Remediate P0 defect BUG-VA-01 (invalid used_date column in create_voucher_atomic),
--            implement partial-batch quantity-aware token valuation (BUG-VA-02), uniform child
--            slice accounting (BUG-VA-03), deterministic FOR UPDATE row-level locking, and provide
--            a hardened legacy UUID-array wrapper.
-- Target:    public.create_voucher_atomic(uuid, jsonb, jsonb) & public.create_voucher_atomic(uuid, jsonb, uuid[])
-- Phase:     Patch (Phase 8 / Post-Phase 9 Remediation)
-- Reference: docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md (Revision 12 FINAL)
--
-- ROOT CAUSE REMEDIATION:
--   Phase 8 migration (20261005_04_create_voucher_atomic.sql#L129) contained:
--     UPDATE token_transactions SET used_date = NOW() ...
--   Column "used_date" does not exist in public.token_transactions, causing PostgreSQL runtime
--   error 42703 (undefined_column) and immediate transaction rollback on every token-assisted voucher.
--   This migration removes all references to "used_date" and establishes the Uniform Consumption
--   Slice Architecture (uniform child slice insertion per allocation slice; parent remains batch origin).
--
-- BUSINESS RULES ENFORCED (Revision 12 FINAL):
--   1. Partial-Batch Selection: Allocations specify requested_quantity per batch.
--   2. Dual-Layer Type & Integer Contract: Allocations enforce jsonb_typeof = 'number', whole integer,
--      positive bounds (1 <= qty <= 2147483647), and locked database stock availability.
--   3. Uniform Consumption Slice Model: Every token allocation applied to a voucher creates an explicit
--      child row in token_transactions with quantity = requested_qty, remaining_quantity = 0,
--      total_amount = requested_qty * token_value, parent_transaction_id = parent.id, usage_status = 'used',
--      used_against_voucher_id = voucher.id, and explicit shift_id = NULL.
--   4. Residual Book Value Model (Q2 Model 1): Active parent batches decrement remaining_quantity and
--      total_amount proportionally. Fully exhausted parent batches transition to usage_status = 'used'
--      with total_amount = 0 and used_against_voucher_id = NULL (preserving origin).
--   5. Shift Drawer Protection: Child rows set shift_id = NULL, ensuring voucher token tender is never
--      deducted from register cash in shifts reconciliation (src/app/api/shifts/route.ts#L312-L326).
--   6. Deterministic Concurrency Control: Parameterized cursor locks tenant-owned rows in deterministic
--      ascending UUID order (ORDER BY t.id ASC FOR UPDATE OF t), preventing deadlocks.
--   7. Unique Voucher Number Concurrency Guard: Voucher insertion includes an internal SAVEPOINT retry
--      loop on unique_violation to resolve race collisions on uq_vouchers_tenant_voucher_no safely.
--   8. Hardened Legacy Wrapper: Overload (uuid, jsonb, uuid[]) pre-validates tenant ownership and uses
--      LEFT JOIN with COALESCE to ensure missing, foreign-tenant, or depleted IDs are never dropped silently.
--
-- SECURITY POSTURE:
--   Both functions configured as SECURITY DEFINER with search_path = public, pg_temp.
--   REVOKE EXECUTE from PUBLIC, anon, and authenticated.
--   GRANT EXECUTE strictly to service_role.

-- ==============================================================================
-- 1. CANONICAL STORED PROCEDURE: JSONB Allocations Overload
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_voucher_atomic(
  p_tenant_id         UUID,
  p_voucher_data      JSONB,
  p_token_allocations JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_voucher_id       UUID;
  v_voucher_no       TEXT;
  v_voucher_type     TEXT;
  v_prefix           TEXT;
  v_party_type       TEXT;
  v_party_id         UUID;
  v_party_name       TEXT;
  v_payment_mode     TEXT;
  v_reference_no     TEXT;
  v_remarks          TEXT;
  v_created_by       TEXT;
  v_date             DATE;
  v_amount           NUMERIC(12,2) := 0.00;
  v_tokens_amount    NUMERIC(12,2) := 0.00;
  v_total_settlement NUMERIC(12,2) := 0.00;
  v_token_ids        UUID[];
  v_locked_rows      token_transactions[] := '{}';
  v_alloc_qtys       INTEGER[] := '{}';
  v_rec              token_transactions;
  v_rec_qty          INTEGER;
  v_cursor_row       RECORD;
  v_elem             JSONB;
  v_supplier         suppliers%ROWTYPE;
  v_client           clients%ROWTYPE;
  v_new_balance      NUMERIC(12,2);
  v_audit_details    JSONB;
  v_constraint_name  TEXT;
  v_retry_count      INTEGER := 0;
  i                  INTEGER;

  -- Parameterized cursor selecting composite tuple 't' directly in deterministic ascending lock order
  c_alloc_tokens CURSOR (cp_token_ids UUID[]) FOR
    SELECT t,
           (a.elem->>'quantity')::INTEGER AS requested_qty
      FROM token_transactions t
      JOIN jsonb_array_elements(p_token_allocations) a(elem)
        ON (a.elem->>'token_id')::UUID = t.id
     WHERE t.id = ANY(cp_token_ids)
       AND t.tenant_id = p_tenant_id
     ORDER BY t.id ASC
       FOR UPDATE OF t;
BEGIN
  -- ── 1. Basic Parameter Validation ──────────────────────────────────────────
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_voucher_data IS NULL OR jsonb_typeof(p_voucher_data) <> 'object' THEN
    RAISE EXCEPTION 'p_voucher_data must be a valid JSONB object';
  END IF;

  -- ── 2. Independent Cash Component Validation ───────────────────────────────
  IF p_voucher_data ? 'amount' AND (p_voucher_data->>'amount') IS NOT NULL AND (p_voucher_data->>'amount') <> '' THEN
    IF (p_voucher_data->>'amount') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Voucher cash amount must be a valid non-negative numeric string with at most 2 decimal places: %',
        p_voucher_data->>'amount';
    END IF;
    v_amount := (p_voucher_data->>'amount')::NUMERIC;
    IF v_amount < 0 THEN
      RAISE EXCEPTION 'Voucher cash amount cannot be negative: %', v_amount;
    END IF;
    IF v_amount > 99999999.99 THEN
      RAISE EXCEPTION 'Voucher cash amount exceeds maximum allowable limit (99,999,999.99): %', v_amount;
    END IF;
  ELSE
    v_amount := 0.00;
  END IF;

  -- ── 3. Token Allocations Structure Validation ──────────────────────────────
  IF p_token_allocations IS NOT NULL THEN
    IF jsonb_typeof(p_token_allocations) = 'null' THEN
      RAISE EXCEPTION 'p_token_allocations cannot be JSON null; must be a JSON array or SQL NULL';
    END IF;
    IF jsonb_typeof(p_token_allocations) <> 'array' THEN
      RAISE EXCEPTION 'p_token_allocations must be a JSONB array';
    END IF;

    IF jsonb_array_length(p_token_allocations) > 0 THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(p_token_allocations)
      LOOP
        IF jsonb_typeof(v_elem) <> 'object' THEN
          RAISE EXCEPTION 'Allocation array elements must be JSON objects';
        END IF;
        IF NOT (v_elem ? 'token_id') OR NOT (v_elem ? 'quantity') THEN
          RAISE EXCEPTION 'Allocation elements must contain both "token_id" and "quantity"';
        END IF;
        IF jsonb_typeof(v_elem->'token_id') = 'null' OR jsonb_typeof(v_elem->'quantity') = 'null' THEN
          RAISE EXCEPTION 'Allocation "token_id" and "quantity" values cannot be null';
        END IF;
        IF jsonb_typeof(v_elem->'token_id') <> 'string' THEN
          RAISE EXCEPTION 'Allocation token_id must be a JSON string: %', v_elem->'token_id';
        END IF;
        IF (v_elem->>'token_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          RAISE EXCEPTION 'Invalid UUID format for token_id: %', v_elem->>'token_id';
        END IF;
        IF jsonb_typeof(v_elem->'quantity') <> 'number' THEN
          RAISE EXCEPTION 'Allocation quantity must be a JSON number: %', v_elem->'quantity';
        END IF;
        IF (v_elem->>'quantity') !~ '^[0-9]+$' THEN
          RAISE EXCEPTION 'Allocation quantity must be an unsigned integer: %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC <= 0 THEN
          RAISE EXCEPTION 'Allocation quantity must be strictly greater than zero: %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC > 2147483647 THEN
          RAISE EXCEPTION 'Allocation quantity exceeds integer limit (2147483647): %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC <> floor((v_elem->>'quantity')::NUMERIC) THEN
          RAISE EXCEPTION 'Allocation quantity cannot contain fractional units: %', v_elem->>'quantity';
        END IF;
      END LOOP;

      IF (SELECT count(DISTINCT (elem->>'token_id')::UUID) FROM jsonb_array_elements(p_token_allocations) elem)
         <> jsonb_array_length(p_token_allocations) THEN
        RAISE EXCEPTION 'Duplicate token IDs supplied in settlement allocations';
      END IF;
    END IF;
  END IF;

  -- ── 4. Deterministic Row Locking & In-Memory Retention ─────────────────────
  IF p_token_allocations IS NOT NULL AND jsonb_array_length(p_token_allocations) > 0 THEN
    v_token_ids := ARRAY(
      SELECT (elem->>'token_id')::UUID
        FROM jsonb_array_elements(p_token_allocations) elem
    );

    OPEN c_alloc_tokens(v_token_ids);
    LOOP
      FETCH c_alloc_tokens INTO v_cursor_row;
      EXIT WHEN NOT FOUND;

      v_rec     := v_cursor_row.t;
      v_rec_qty := v_cursor_row.requested_qty;

      IF v_rec.usage_status IS DISTINCT FROM 'available' THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % is not available for settlement (status: %)', v_rec.id, v_rec.usage_status;
      END IF;

      IF v_rec.used_against_voucher_id IS NOT NULL OR v_rec.used_against_purchase_id IS NOT NULL THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % has already been applied to another transaction', v_rec.id;
      END IF;

      IF v_rec_qty > v_rec.remaining_quantity THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Requested quantity % exceeds available quantity % for token %',
          v_rec_qty, v_rec.remaining_quantity, v_rec.id;
      END IF;

      IF v_rec.remaining_quantity <= 0 THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % is depleted', v_rec.id;
      END IF;

      IF v_rec.token_value <= 0 THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % has non-positive face value (%) and cannot be applied as payment tender',
          v_rec.id, v_rec.token_value;
      END IF;

      v_tokens_amount := v_tokens_amount + (v_rec.token_value * v_rec_qty);
      v_locked_rows   := array_append(v_locked_rows, v_rec);
      v_alloc_qtys    := array_append(v_alloc_qtys, v_rec_qty);
    END LOOP;
    CLOSE c_alloc_tokens;

    IF coalesce(cardinality(v_locked_rows), 0) <> jsonb_array_length(p_token_allocations) THEN
      RAISE EXCEPTION 'One or more requested tokens do not exist or belong to another tenant';
    END IF;
  END IF;

  -- ── 5. Total Settlement Calculation & Non-Zero Guard ───────────────────────
  v_total_settlement := v_amount + v_tokens_amount;
  IF v_total_settlement <= 0 THEN
    RAISE EXCEPTION 'Total settlement amount (cash + tokens) must be greater than zero';
  END IF;

  -- Extract voucher metadata
  v_voucher_no   := p_voucher_data->>'voucher_no';
  v_voucher_type := COALESCE(p_voucher_data->>'voucher_type', 'payment');
  v_party_type   := COALESCE(p_voucher_data->>'party_type', 'supplier');
  v_party_id     := (p_voucher_data->>'party_id')::UUID;
  v_party_name   := COALESCE(p_voucher_data->>'party_name', '');
  v_payment_mode := COALESCE(p_voucher_data->>'payment_mode', 'Cash');
  v_reference_no := p_voucher_data->>'reference_no';
  v_remarks      := p_voucher_data->>'remarks';
  v_created_by   := p_voucher_data->>'created_by';
  v_date         := COALESCE((p_voucher_data->>'date')::DATE, CURRENT_DATE);

  -- ── 6. Insert Voucher Header with Concurrency Collision Handling ───────────
  -- Generate candidate voucher_no if not supplied or empty
  v_prefix := CASE WHEN v_voucher_type = 'receipt' THEN 'RCP' ELSE 'PMT' END;
  IF v_voucher_no IS NULL OR trim(v_voucher_no) = '' THEN
    v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
  END IF;

  -- Pre-insert collision avoidance loop
  WHILE EXISTS (SELECT 1 FROM vouchers WHERE tenant_id = p_tenant_id AND voucher_no = v_voucher_no) LOOP
    v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
  END LOOP;

  -- Robust insertion with subtransaction SAVEPOINT retry specifically on uq_vouchers_tenant_voucher_no
  LOOP
    BEGIN
      INSERT INTO vouchers (
        tenant_id, voucher_no, voucher_type, party_type, party_id,
        party_name, amount, payment_mode, reference_no, remarks,
        created_by, date
      ) VALUES (
        p_tenant_id, v_voucher_no, v_voucher_type, v_party_type, v_party_id,
        v_party_name, v_total_settlement, v_payment_mode, v_reference_no, v_remarks,
        v_created_by, v_date
      ) RETURNING id INTO v_voucher_id;

      EXIT; -- Insert succeeded
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
        -- Filter specifically for uq_vouchers_tenant_voucher_no collisions; re-raise any other constraint failure
        IF v_constraint_name = 'uq_vouchers_tenant_voucher_no' THEN
          v_retry_count := v_retry_count + 1;
          IF v_retry_count > 10 THEN
            RAISE EXCEPTION 'Exceeded maximum retry attempts (10) generating collision-free voucher_no';
          END IF;
          v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
        ELSE
          RAISE; -- Re-raise unexpected unique constraint violations with original error
        END IF;
    END;
  END LOOP;

  -- ── 7. Token Mutation & Uniform Child Slice Creation ───────────────────────
  IF cardinality(v_locked_rows) > 0 THEN
    FOR i IN 1 .. cardinality(v_locked_rows)
    LOOP
      v_rec     := v_locked_rows[i];
      v_rec_qty := v_alloc_qtys[i];

      -- A. Decrement parent batch residual stock and book value
      UPDATE token_transactions
         SET remaining_quantity = remaining_quantity - v_rec_qty,
             total_amount       = (remaining_quantity - v_rec_qty) * token_value,
             usage_status       = CASE WHEN remaining_quantity - v_rec_qty = 0 THEN 'used' ELSE 'available' END
       WHERE id = v_rec.id;

      -- B. Insert child consumption slice (uniform for all allocations)
      -- Explicitly populates all 10 NOT NULL columns; sets shift_id = NULL to protect drawer cash.
      INSERT INTO token_transactions (
        tenant_id, type, invoice_id, redemption_id, client_id, client_name,
        brand_id, brand_name, series_id, series_name, unit_name,
        token_value, quantity, remaining_quantity, total_amount,
        parent_transaction_id, usage_status, used_against_voucher_id,
        settled_vendor_name, notes, shift_id
      ) VALUES (
        p_tenant_id, v_rec.type, v_rec.invoice_id, v_rec.redemption_id,
        v_rec.client_id, v_rec.client_name,
        v_rec.brand_id, v_rec.brand_name,
        v_rec.series_id, v_rec.series_name, v_rec.unit_name,
        v_rec.token_value, v_rec_qty, 0, v_rec_qty * v_rec.token_value,
        v_rec.id, 'used', v_voucher_id,
        v_party_name,
        'Settlement against voucher ' || v_voucher_no,
        NULL
      );
    END LOOP;
  END IF;

  -- ── 8. Adjust Party Balance with Lock ───────────────────────────────────────
  IF v_party_type = 'supplier' THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_party_id AND tenant_id = p_tenant_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier % not found', v_party_id;
    END IF;

    UPDATE suppliers
       SET current_balance = current_balance - v_total_settlement
     WHERE id = v_party_id AND tenant_id = p_tenant_id
     RETURNING current_balance INTO v_new_balance;
  ELSIF v_party_type = 'client' THEN
    SELECT * INTO v_client
      FROM clients
     WHERE id = v_party_id AND tenant_id = p_tenant_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client % not found', v_party_id;
    END IF;

    UPDATE clients
       SET current_balance = current_balance - v_total_settlement
     WHERE id = v_party_id AND tenant_id = p_tenant_id
     RETURNING current_balance INTO v_new_balance;
  ELSE
    RAISE EXCEPTION 'Unsupported party_type: %', v_party_type;
  END IF;

  -- ── 9. Write Audit Log ─────────────────────────────────────────────────────
  v_audit_details := jsonb_build_object(
    'voucher_no',            v_voucher_no,
    'voucher_type',          v_voucher_type,
    'party_type',            v_party_type,
    'party_id',              v_party_id,
    'cash_paid_amount',      v_amount,
    'tokens_applied_amount', v_tokens_amount,
    'total_settlement',      v_total_settlement,
    'token_allocations',     COALESCE(p_token_allocations, '[]'::jsonb)
  );

  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id, COALESCE(v_created_by, 'System'), 'CREATE_VOUCHER', 'CREATE',
    'voucher', v_voucher_id::text, v_audit_details
  );

  RETURN jsonb_build_object(
    'voucher_id',            v_voucher_id,
    'voucher_no',            v_voucher_no,
    'voucher_type',          v_voucher_type,
    'party_type',            v_party_type,
    'party_id',              v_party_id,
    'party_name',            v_party_name,
    'date',                  v_date,
    'amount',                v_total_settlement,
    'cash_paid_amount',      v_amount,
    'tokens_applied_amount', v_tokens_amount,
    'updated_balance',       v_new_balance
  );
END;
$func$;

-- ==============================================================================
-- 2. HARDENED LEGACY WRAPPER: UUID Array Overload
-- ==============================================================================

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
  v_allocations JSONB;
BEGIN
  IF p_token_ids IS NULL OR cardinality(p_token_ids) = 0 THEN
    RETURN public.create_voucher_atomic(p_tenant_id, p_voucher_data, NULL::jsonb);
  END IF;

  IF array_position(p_token_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Token ID array cannot contain NULL elements';
  END IF;

  IF (SELECT count(DISTINCT u.id) FROM unnest(p_token_ids) AS u(id)) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'Duplicate token IDs supplied in settlement request';
  END IF;

  -- Pre-validate existence and tenant ownership (fail-closed guard)
  -- Prevents missing, foreign-tenant, or depleted IDs from being bypassed or dropped
  IF (SELECT count(*) FROM token_transactions WHERE id = ANY(p_token_ids) AND tenant_id = p_tenant_id) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'One or more requested tokens do not exist or belong to another tenant';
  END IF;

  -- Formatting conversion: LEFT JOIN ensures every requested ID is preserved
  -- Missing, foreign-tenant, or depleted tokens yield quantity: 0 (or null), which
  -- the canonical RPC deterministically locks and rejects with fail-closed errors.
  SELECT jsonb_agg(
           jsonb_build_object(
             'token_id', u.id,
             'quantity', COALESCE(t.remaining_quantity, 0)
           )
         )
    INTO v_allocations
    FROM unnest(p_token_ids) AS u(id)
    LEFT JOIN token_transactions t
      ON t.id = u.id AND t.tenant_id = p_tenant_id;

  RETURN public.create_voucher_atomic(p_tenant_id, p_voucher_data, v_allocations);
END;
$func$;

-- ==============================================================================
-- 3. SECURITY POSTURE & ACCESS PRIVILEGES
-- ==============================================================================

-- Revoke all execute privileges from untrusted roles
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;

-- Grant execution strictly to service_role (invoked via Supabase Admin API routes)
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) TO service_role;
