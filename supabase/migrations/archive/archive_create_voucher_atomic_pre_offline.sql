-- ============================================================================
-- ARCHIVE: Live definition of create_voucher_atomic before Offline Mode Phase 6/9
-- Captured via pg_get_functiondef on 2026-10-30 from ignspvajzblmsbertmmv
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_allocations jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_shift_id         UUID;
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

  -- ── 3. Token Allocations Structural Validation & Pass 1 Aggregation ────────
  IF p_token_allocations IS NOT NULL AND jsonb_typeof(p_token_allocations) <> 'null' THEN
    IF jsonb_typeof(p_token_allocations) <> 'array' THEN
      RAISE EXCEPTION 'p_token_allocations must be a JSONB array';
    END IF;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_token_allocations)
    LOOP
      IF NOT (v_elem ? 'token_id') OR (v_elem->>'token_id') IS NULL OR (v_elem->>'token_id') = '' THEN
        RAISE EXCEPTION 'Each token allocation must contain a valid non-null token_id';
      END IF;

      IF NOT (v_elem ? 'quantity') OR (v_elem->>'quantity') IS NULL OR (v_elem->>'quantity') = '' THEN
        RAISE EXCEPTION 'Each token allocation must contain a valid non-null quantity';
      END IF;

      IF (v_elem->>'quantity') !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'Token allocation quantity must be a positive integer greater than zero: %',
          v_elem->>'quantity';
      END IF;

      -- Check duplicate token_id entries in payload
      IF (v_elem->>'token_id')::UUID = ANY(v_token_ids) THEN
        RAISE EXCEPTION 'Duplicate token_id detected in allocation request: %', v_elem->>'token_id';
      END IF;

      v_token_ids := array_append(v_token_ids, (v_elem->>'token_id')::UUID);
    END LOOP;
  END IF;

  -- ── 4. Verify Positive Total Settlement ────────────────────────────────────
  -- Total settlement will be computed from locked tokens + v_amount.
  -- Initial fast check: If both amount is zero and no tokens allocated, fail immediately.
  IF v_amount = 0.00 AND (v_token_ids IS NULL OR array_length(v_token_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'Voucher must have a positive total settlement (cash amount > 0 or at least one token allocation)';
  END IF;

  -- ── 5. Field Extraction & Mandatory Checks ─────────────────────────────────
  v_voucher_type := trim(COALESCE(p_voucher_data->>'voucher_type', ''));
  IF v_voucher_type NOT IN ('receipt', 'payment') THEN
    RAISE EXCEPTION 'voucher_type must be either receipt or payment, got: %', v_voucher_type;
  END IF;

  v_party_type := trim(COALESCE(p_voucher_data->>'party_type', ''));
  IF v_party_type NOT IN ('client', 'supplier') THEN
    RAISE EXCEPTION 'party_type must be either client or supplier, got: %', v_party_type;
  END IF;

  IF NOT (p_voucher_data ? 'party_id') OR (p_voucher_data->>'party_id') IS NULL OR trim(p_voucher_data->>'party_id') = '' THEN
    RAISE EXCEPTION 'party_id is required';
  END IF;
  v_party_id := (p_voucher_data->>'party_id')::UUID;

  v_party_name   := trim(COALESCE(p_voucher_data->>'party_name', ''));
  v_payment_mode := trim(COALESCE(p_voucher_data->>'payment_mode', 'cash'));
  v_reference_no := trim(COALESCE(p_voucher_data->>'reference_no', ''));
  v_remarks      := trim(COALESCE(p_voucher_data->>'remarks', ''));
  v_created_by   := trim(COALESCE(p_voucher_data->>'created_by', ''));

  IF p_voucher_data ? 'date' AND (p_voucher_data->>'date') IS NOT NULL AND trim(p_voucher_data->>'date') <> '' THEN
    v_date := (p_voucher_data->>'date')::DATE;
  ELSE
    v_date := CURRENT_DATE;
  END IF;

  IF p_voucher_data ? 'shift_id' AND (p_voucher_data->>'shift_id') IS NOT NULL AND trim(p_voucher_data->>'shift_id') <> '' THEN
    v_shift_id := (p_voucher_data->>'shift_id')::UUID;
  ELSE
    v_shift_id := NULL;
  END IF;

  -- ── 6. Deterministic Deadlock-Free Token Locking & Valuation Verification ───
  IF v_token_ids IS NOT NULL AND array_length(v_token_ids, 1) > 0 THEN
    OPEN c_alloc_tokens(v_token_ids);
    LOOP
      FETCH c_alloc_tokens INTO v_cursor_row;
      EXIT WHEN NOT FOUND;

      v_rec     := v_cursor_row.t;
      v_rec_qty := v_cursor_row.requested_qty;

      -- Validate usage status: Must be available in shop stockpile
      IF v_rec.usage_status <> 'available' THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token transaction % has status %, but must be available for allocation',
          v_rec.id, v_rec.usage_status;
      END IF;

      -- Validate sufficient remaining quantity
      IF v_rec.remaining_quantity < v_rec_qty THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Insufficient quantity on token %: requested %, available %',
          v_rec.id, v_rec_qty, v_rec.remaining_quantity;
      END IF;

      -- Validate token party alignment:
      -- Physical stockpile tokens retained in shop belong to the shop and can be settled to suppliers.
      -- If token belongs to a specific client/supplier, it must match the voucher party.
      IF v_rec.client_id IS NOT NULL AND v_rec.client_id <> v_party_id AND v_party_type = 'client' THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % client_id % does not match voucher party_id %',
          v_rec.id, v_rec.client_id, v_party_id;
      END IF;

      IF v_rec.supplier_id IS NOT NULL AND v_rec.supplier_id <> v_party_id AND v_party_type = 'supplier' THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % supplier_id % does not match voucher party_id %',
          v_rec.id, v_rec.supplier_id, v_party_id;
      END IF;

      -- Tally valuation using locked immutable token_value
      v_tokens_amount := v_tokens_amount + (v_rec_qty * v_rec.token_value);

      -- Accumulate in memory arrays for execution phase
      v_locked_rows := array_append(v_locked_rows, v_rec);
      v_alloc_qtys  := array_append(v_alloc_qtys, v_rec_qty);
    END LOOP;
    CLOSE c_alloc_tokens;

    -- Ensure all requested tokens were found and locked
    IF array_length(v_locked_rows, 1) IS NULL OR array_length(v_locked_rows, 1) <> array_length(v_token_ids, 1) THEN
      RAISE EXCEPTION 'One or more requested tokens could not be found or locked for tenant %', p_tenant_id;
    END IF;
  END IF;

  v_total_settlement := v_amount + v_tokens_amount;
  IF v_total_settlement <= 0.00 THEN
    RAISE EXCEPTION 'Total voucher settlement amount must be strictly greater than 0';
  END IF;

  -- ── 7. Party Validation & Deterministic Row Locking ────────────────────────
  IF v_party_type = 'supplier' THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_party_id
       AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier % not found for tenant %', v_party_id, p_tenant_id;
    END IF;

    IF v_party_name = '' THEN
      v_party_name := v_supplier.name;
    END IF;

    -- Ledger impact:
    -- Payment to supplier reduces supplier's credit balance (what we owe them decreases: -)
    -- Receipt from supplier increases credit balance (+)
    IF v_voucher_type = 'payment' THEN
      v_new_balance := v_supplier.current_balance - v_total_settlement;
    ELSE
      v_new_balance := v_supplier.current_balance + v_total_settlement;
    END IF;

  ELSIF v_party_type = 'client' THEN
    SELECT * INTO v_client
      FROM clients
     WHERE id = v_party_id
       AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client % not found for tenant %', v_party_id, p_tenant_id;
    END IF;

    IF v_party_name = '' THEN
      v_party_name := v_client.name;
    END IF;

    -- Ledger impact:
    -- Receipt from client reduces client's debit balance (what they owe us decreases: -)
    -- Payment/refund to client increases debit balance (+)
    IF v_voucher_type = 'receipt' THEN
      v_new_balance := v_client.current_balance - v_total_settlement;
    ELSE
      v_new_balance := v_client.current_balance + v_total_settlement;
    END IF;
  END IF;

  -- ── 8. Concurrency-Safe Voucher Number Generation ──────────────────────────
  IF v_voucher_type = 'receipt' THEN
    v_prefix := 'RCP';
  ELSE
    v_prefix := 'PMT';
  END IF;

  LOOP
    BEGIN
      v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' ||
                      upper(substr(md5(gen_random_uuid()::text), 1, 4));

      INSERT INTO vouchers (
        tenant_id, voucher_no, voucher_type, date,
        party_type, party_id, party_name,
        amount, payment_mode, reference_no, remarks,
        created_by, shift_id
      ) VALUES (
        p_tenant_id, v_voucher_no, v_voucher_type, v_date,
        v_party_type, v_party_id, v_party_name,
        v_total_settlement, v_payment_mode, v_reference_no, v_remarks,
        v_created_by, v_shift_id
      )
      RETURNING id INTO v_voucher_id;

      EXIT; -- Insert succeeded
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= 5 THEN
          RAISE EXCEPTION 'Failed to generate unique voucher_no after 5 attempts (constraint: %)',
            v_constraint_name;
        END IF;
    END;
  END LOOP;

  -- ── 9. Execute Token Deductions & Create Audit Allocation Records ───────────
  IF array_length(v_locked_rows, 1) > 0 THEN
    FOR i IN 1 .. array_length(v_locked_rows, 1)
    LOOP
      v_rec     := v_locked_rows[i];
      v_rec_qty := v_alloc_qtys[i];

      -- Decrement remaining quantity on the source stockpile token
      UPDATE token_transactions
         SET remaining_quantity = remaining_quantity - v_rec_qty,
             usage_status = CASE
                              WHEN remaining_quantity - v_rec_qty = 0 THEN 'used'
                              ELSE 'available'
                            END,
             updated_at = NOW()
       WHERE id = v_rec.id;

      -- Insert child token settlement tracking record tied to this voucher
      INSERT INTO token_transactions (
        tenant_id,
        parent_token_id,
        type,
        usage_status,
        quantity,
        remaining_quantity,
        token_value,
        total_amount,
        party_type,
        party_id,
        supplier_id,
        supplier_name,
        client_id,
        client_name,
        brand_id,
        brand_name,
        series_id,
        series_name,
        unit_name,
        voucher_id,
        shift_id,
        created_by,
        notes
      ) VALUES (
        p_tenant_id,
        v_rec.id,
        'redeemed',
        'used',
        v_rec_qty,
        0,
        v_rec.token_value,
        v_rec_qty * v_rec.token_value,
        v_party_type,
        v_party_id,
        CASE WHEN v_party_type = 'supplier' THEN v_party_id ELSE v_rec.supplier_id END,
        CASE WHEN v_party_type = 'supplier' THEN v_party_name ELSE v_rec.supplier_name END,
        CASE WHEN v_party_type = 'client' THEN v_party_id ELSE v_rec.client_id END,
        CASE WHEN v_party_type = 'client' THEN v_party_name ELSE v_rec.client_name END,
        v_rec.brand_id,
        v_rec.brand_name,
        v_rec.series_id,
        v_rec.series_name,
        v_rec.unit_name,
        v_voucher_id,
        v_shift_id,
        v_created_by,
        'Settled via voucher ' || v_voucher_no
      );
    END LOOP;
  END IF;

  -- ── 10. Update Party Balance ────────────────────────────────────────────────
  IF v_party_type = 'supplier' THEN
    UPDATE suppliers
       SET current_balance = v_new_balance,
           updated_at      = NOW()
     WHERE id = v_party_id
       AND tenant_id = p_tenant_id;
  ELSIF v_party_type = 'client' THEN
    UPDATE clients
       SET current_balance = v_new_balance,
           updated_at      = NOW()
     WHERE id = v_party_id
       AND tenant_id = p_tenant_id;
  END IF;

  -- ── 11. Write Audit Log ─────────────────────────────────────────────────────
  v_audit_details := jsonb_build_object(
    'voucher_no', v_voucher_no,
    'voucher_type', v_voucher_type,
    'party_type', v_party_type,
    'party_id', v_party_id,
    'party_name', v_party_name,
    'cash_amount', v_amount,
    'tokens_amount', v_tokens_amount,
    'total_amount', v_total_settlement,
    'payment_mode', v_payment_mode,
    'allocated_tokens_count', COALESCE(array_length(v_locked_rows, 1), 0),
    'new_party_balance', v_new_balance
  );

  INSERT INTO audit_logs (
    tenant_id,
    user_name,
    action,
    action_type,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_tenant_id,
    COALESCE(NULLIF(v_created_by, ''), 'system'),
    CASE WHEN v_voucher_type = 'receipt' THEN 'Voucher Receipt Created' ELSE 'Voucher Payment Created' END,
    'create',
    'voucher',
    v_voucher_id,
    v_audit_details
  );

  -- ── 12. Return Standard JSONB Payload ───────────────────────────────────────
  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no,
    'voucher_type', v_voucher_type,
    'party_type', v_party_type,
    'party_id', v_party_id,
    'party_name', v_party_name,
    'cash_amount', v_amount,
    'tokens_amount', v_tokens_amount,
    'total_amount', v_total_settlement,
    'payment_mode', v_payment_mode,
    'new_party_balance', v_new_balance
  );
END;
$function$;

