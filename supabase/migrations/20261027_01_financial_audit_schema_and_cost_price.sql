-- ==============================================================================
-- Migration: 20261027_01_financial_audit_schema_and_cost_price.sql
-- Purpose  : Day-close audit remediation, step 1 (additive, idempotent).
--   1. vouchers.shift_id (FK shifts, ON DELETE SET NULL) + index
--   2. shifts.cash_breakdown jsonb
--   3. invoice_items.cost_price numeric
--   4. shifts.previous_closing_cash / handover_variance: drop default 0, allow NULL
--   5. create_voucher_atomic: stores optional p_voucher_data->>'shift_id'
--      (body = 20261013_03 verbatim + 4 added lines; return shape unchanged)
--   6. create_invoice_atomic: fills invoice_items.cost_price
--      (body = 20261002_02 verbatim + cost_price column; token/audit logic unchanged)
--   7. Guarded backfills
-- ==============================================================================

ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_shift ON public.vouchers (tenant_id, shift_id);
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS cash_breakdown jsonb;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS cost_price numeric;

ALTER TABLE public.shifts ALTER COLUMN previous_closing_cash DROP DEFAULT;
ALTER TABLE public.shifts ALTER COLUMN handover_variance DROP DEFAULT;
ALTER TABLE public.shifts ALTER COLUMN previous_closing_cash DROP NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN handover_variance DROP NOT NULL;

-- ---- create_voucher_atomic (patched copy of 20261013_03) --------------------
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
  v_shift_id     := NULLIF(p_voucher_data->>'shift_id', '')::UUID;

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
        created_by, date, shift_id
      ) VALUES (
        p_tenant_id, v_voucher_no, v_voucher_type, v_party_type, v_party_id,
        v_party_name, v_total_settlement, v_payment_mode, v_reference_no, v_remarks,
        v_created_by, v_date, v_shift_id
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

-- ---- create_invoice_atomic (patched copy of 20261002_02) --------------------
CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_invoice_data JSONB,
  p_items        JSONB,
  p_tokens       JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id        UUID;
  v_invoice_no       TEXT;
  v_client_id        UUID;
  v_client_name      TEXT;
  v_shift_id         UUID;
  v_date             DATE;
  v_subtotal         NUMERIC;
  v_discount         NUMERIC;
  v_delivery_charge  NUMERIC;
  v_remarks          TEXT;
  v_invoice_type     TEXT;
  v_net_total        NUMERIC;
  v_paid_amount      NUMERIC;
  v_due_amount       NUMERIC;
  v_payment_type     TEXT;
  v_cash_paid        NUMERIC;
  v_card_paid        NUMERIC;
  v_bank_paid        NUMERIC;
  v_others_paid      NUMERIC;
  v_status           TEXT;
  v_created_by       TEXT;

  v_invoice_id       UUID;
  v_item             JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_name        TEXT;
  v_item_qty         NUMERIC;
  v_curr_stock       NUMERIC;
  v_is_return        BOOLEAN;

  v_token            JSONB;
  v_token_action     TEXT;
  v_token_qty        INTEGER;
  v_token_total      NUMERIC;
  v_brand_id         UUID;
  v_brand_name       TEXT;
  v_series_id        UUID;
  v_series_name      TEXT;
  v_unit_name        TEXT;
  v_client_val       NUMERIC;
  v_auth_val         NUMERIC;
  v_config_rec       RECORD;

  v_existing_id      UUID;
  v_client_bal       NUMERIC;
  v_cash_refunded    NUMERIC;
  v_store_credit     NUMERIC;
  v_result           JSONB;
BEGIN
  -- Extract invoice fields
  v_tenant_id       := (p_invoice_data->>'tenant_id')::UUID;
  v_invoice_no      := TRIM(p_invoice_data->>'invoice_no');
  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;
  v_client_name     := COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer');
  v_shift_id        := NULLIF(p_invoice_data->>'shift_id', '')::UUID;
  v_date            := COALESCE(NULLIF(p_invoice_data->>'date', '')::DATE, CURRENT_DATE);
  v_subtotal        := COALESCE((p_invoice_data->>'subtotal')::NUMERIC, 0);
  v_discount        := COALESCE((p_invoice_data->>'discount')::NUMERIC, 0);
  v_delivery_charge := COALESCE((p_invoice_data->>'delivery_charge')::NUMERIC, 0);
  v_remarks         := p_invoice_data->>'remarks';
  v_invoice_type    := COALESCE(p_invoice_data->>'invoice_type', 'sales');
  v_net_total       := COALESCE((p_invoice_data->>'net_total')::NUMERIC, 0);
  v_paid_amount     := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount      := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_payment_type    := COALESCE(p_invoice_data->>'payment_type', 'cash');
  v_cash_paid       := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid       := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid       := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid     := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);
  v_status          := COALESCE(p_invoice_data->>'status', 'completed');
  v_created_by      := p_invoice_data->>'created_by';
  v_is_return       := (v_invoice_type = 'return');

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF v_invoice_no IS NULL OR v_invoice_no = '' THEN
    RAISE EXCEPTION 'invoice_no is required';
  END IF;

  -- 0. Idempotency Check: Pre-insert check for existing invoice_no
  SELECT id INTO v_existing_id
    FROM invoices
   WHERE tenant_id = v_tenant_id
     AND invoice_no = v_invoice_no;

  IF FOUND THEN
    SELECT row_to_json(i)::JSONB INTO v_result
      FROM invoices i
     WHERE i.id = v_existing_id;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice', v_result
    );
  END IF;

  -- 1. Insert Invoice (with concurrency collision protection via unique constraint)
  BEGIN
    INSERT INTO invoices (
      tenant_id, invoice_no, client_id, client_name, shift_id,
      date, subtotal, discount, delivery_charge, remarks,
      invoice_type, net_total, paid_amount, due_amount,
      payment_type, cash_paid, card_paid, bank_paid, others_paid,
      status, created_by
    ) VALUES (
      v_tenant_id, v_invoice_no, v_client_id, v_client_name, v_shift_id,
      v_date, v_subtotal, v_discount, v_delivery_charge, v_remarks,
      v_invoice_type, v_net_total, v_paid_amount, v_due_amount,
      v_payment_type, v_cash_paid, v_card_paid, v_bank_paid, v_others_paid,
      v_status, v_created_by
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate request safely caught by DB constraint
    SELECT row_to_json(i)::JSONB INTO v_result
      FROM invoices i
     WHERE i.tenant_id = v_tenant_id
       AND i.invoice_no = v_invoice_no;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice', v_result
    );
  END;

  -- 2. Insert Invoice Items & Adjust Stock Atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_item->>'item_id', '')::UUID;
    v_item_code := TRIM(COALESCE(v_item->>'item_code', ''));
    v_item_qty  := COALESCE((v_item->>'qty')::NUMERIC, 1);
    v_item_name := COALESCE(v_item->>'item_name', 'Product');

    -- Insert invoice item row
    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, shade_code,
      pack_size, unit, qty, unit_price, discount,
      discount_percent, total_price, cost_price
    ) VALUES (
      v_invoice_id,
      v_item_id,
      v_item_code,
      v_item_name,
      COALESCE(v_item->>'shade_code', ''),
      COALESCE(v_item->>'pack_size', 'Can'),
      COALESCE(v_item->>'unit', 'PCS'),
      v_item_qty,
      COALESCE((v_item->>'unit_price')::NUMERIC, 0),
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE((v_item->>'discount_percent')::NUMERIC, 0),
      COALESCE((v_item->>'total_price')::NUMERIC, 0),
      COALESCE(
        NULLIF(v_item->>'cost_price', '')::NUMERIC,
        (SELECT it.cost_price FROM items it
          WHERE it.tenant_id = v_tenant_id
            AND (it.id = v_item_id
                 OR (v_item_id IS NULL AND v_item_code <> '' AND it.code = v_item_code))
          LIMIT 1)
      )
    );

    -- Stock adjustment with strict row-level locking & shortage check
    IF v_item_id IS NOT NULL OR v_item_code != '' THEN
      IF v_item_id IS NOT NULL THEN
        SELECT stock_qty, name INTO v_curr_stock, v_item_name
          FROM items
         WHERE id = v_item_id
           FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item with ID % not found', v_item_id;
        END IF;
      ELSIF v_item_code != '' THEN
        SELECT id, stock_qty, name INTO v_item_id, v_curr_stock, v_item_name
          FROM items
         WHERE tenant_id = v_tenant_id
           AND code = v_item_code
           FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item with code "%" not found', v_item_code;
        END IF;
      END IF;

      IF v_is_return THEN
        -- Returns: increase stock
        UPDATE items
           SET stock_qty = v_curr_stock + v_item_qty
         WHERE id = v_item_id;
      ELSE
        -- Sales: do NOT silently clamp stock. If requested qty > available stock, ABORT!
        IF v_curr_stock < v_item_qty THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (Code: %): Available %, requested %',
            v_item_name, v_item_code, v_curr_stock, v_item_qty;
        END IF;

        UPDATE items
           SET stock_qty = v_curr_stock - v_item_qty
         WHERE id = v_item_id;
      END IF;
    END IF;
  END LOOP;

  -- 3. Update Client Balance Atomically
  IF v_client_id IS NOT NULL THEN
    SELECT current_balance INTO v_client_bal
      FROM clients
     WHERE id = v_client_id
       FOR UPDATE;

    IF FOUND THEN
      IF v_is_return THEN
        v_cash_refunded := CASE
          WHEN v_cash_paid > 0 THEN v_cash_paid
          WHEN LOWER(v_payment_type) IN ('cash', 'refund') THEN v_paid_amount
          ELSE 0
        END;
        v_store_credit := GREATEST(0, v_net_total - v_cash_refunded);
        IF v_store_credit > 0 THEN
          UPDATE clients
             SET current_balance = current_balance - v_store_credit
           WHERE id = v_client_id;
        END IF;
      ELSIF v_due_amount > 0 THEN
        UPDATE clients
           SET current_balance = current_balance + v_due_amount
         WHERE id = v_client_id;
      END IF;
    END IF;
  END IF;

  -- 4. Process Token Transactions Atomically (Sales Only)
  -- Returns do not issue tokens or create stockpile entries
  IF NOT v_is_return AND p_tokens IS NOT NULL AND jsonb_array_length(p_tokens) > 0 THEN
    FOR v_token IN SELECT * FROM jsonb_array_elements(p_tokens)
    LOOP
      v_token_action := LOWER(COALESCE(v_token->>'token_action', 'keep'));
      v_token_qty    := COALESCE((v_token->>'quantity')::INTEGER, 1);
      v_brand_id     := NULLIF(v_token->>'brand_id', '')::UUID;
      v_brand_name   := TRIM(COALESCE(v_token->>'brand_name', ''));
      v_series_id    := NULLIF(v_token->>'series_id', '')::UUID;
      v_series_name  := TRIM(COALESCE(v_token->>'series_name', ''));
      v_unit_name    := TRIM(COALESCE(v_token->>'unit_name', ''));
      v_client_val   := COALESCE((v_token->>'token_value')::NUMERIC, 0);

      IF v_token_qty > 0 THEN
        -- Authoritative Brand Verification
        IF v_brand_id IS NOT NULL THEN
          SELECT id, name INTO v_brand_id, v_brand_name
            FROM brands
           WHERE id = v_brand_id
             AND tenant_id = v_tenant_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand ID % not found for tenant', v_brand_id;
          END IF;
        ELSIF v_brand_name != '' THEN
          SELECT id, name INTO v_brand_id, v_brand_name
            FROM brands
           WHERE tenant_id = v_tenant_id
             AND LOWER(name) = LOWER(v_brand_name);
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand "%" not found for tenant', v_brand_name;
          END IF;
        ELSE
          RAISE EXCEPTION 'Brand is required for token processing';
        END IF;

        -- Authoritative Series Verification
        IF v_series_id IS NOT NULL THEN
          SELECT id, name INTO v_series_id, v_series_name
            FROM brand_series
           WHERE id = v_series_id
             AND brand_id = v_brand_id
             AND tenant_id = v_tenant_id
             AND status = 'active';
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Series ID % is invalid, inactive, or does not belong to brand %', v_series_id, v_brand_name;
          END IF;
        ELSIF v_series_name != '' THEN
          SELECT id, name INTO v_series_id, v_series_name
            FROM brand_series
           WHERE brand_id = v_brand_id
             AND tenant_id = v_tenant_id
             AND LOWER(name) = LOWER(v_series_name)
             AND status = 'active';
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Series "%" not found or inactive for brand %', v_series_name, v_brand_name;
          END IF;
        ELSE
          RAISE EXCEPTION 'Series is required for token processing';
        END IF;

        -- Authoritative Unit and Token Configuration Verification
        SELECT unit_name, is_enabled, token_value INTO v_config_rec
          FROM series_token_configs
         WHERE series_id = v_series_id
           AND tenant_id = v_tenant_id
           AND match_unit_to_config(v_unit_name, unit_name)
         LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Unit "%" is not configured in series "%"', v_unit_name, v_series_name;
        END IF;

        IF NOT v_config_rec.is_enabled THEN
          RAISE EXCEPTION 'Token is disabled for unit "%" in series "%"', v_unit_name, v_series_name;
        END IF;

        v_auth_val := (v_config_rec.token_value)::NUMERIC;
        IF v_auth_val <= 0 THEN
          RAISE EXCEPTION 'Authoritative token value must be greater than zero for series "%" unit "%"', v_series_name, v_unit_name;
        END IF;

        -- Verify client-supplied token value does not diverge from authoritative config
        IF v_client_val > 0 AND v_client_val != v_auth_val THEN
          RAISE EXCEPTION 'Token value mismatch for "% - % - %": Client provided Rs. %, authoritative config is Rs. %',
            v_brand_name, v_series_name, v_unit_name, v_client_val, v_auth_val;
        END IF;

        v_token_total := v_auth_val * v_token_qty;

        IF v_token_action = 'remove' THEN
          -- Remove Token: Shop Retained stockpile entry (enters safe, available for settlement)
          INSERT INTO token_transactions (
            tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name,
            token_value, quantity, remaining_quantity, total_amount,
            usage_status, shift_id, created_by, notes
          ) VALUES (
            v_tenant_id,
            'shop_retained',
            v_invoice_id,
            v_client_id,
            v_client_name,
            v_brand_id,
            v_brand_name,
            v_series_id,
            v_series_name,
            v_config_rec.unit_name, -- store exact configured unit identity
            v_auth_val,
            v_token_qty,
            v_token_qty, -- remaining_quantity starts equal to quantity
            v_token_total,
            'available',
            v_shift_id,
            v_created_by,
            'Shop retained token at sale (Discount applied to sale price)'
          );
        ELSE
          -- Keep Token: Customer Token Activity Issued log only (NO stockpile entry)
          INSERT INTO token_transactions (
            tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name,
            token_value, quantity, remaining_quantity, total_amount,
            usage_status, shift_id, created_by, notes
          ) VALUES (
            v_tenant_id,
            'issued',
            v_invoice_id,
            v_client_id,
            v_client_name,
            v_brand_id,
            v_brand_name,
            v_series_id,
            v_series_name,
            v_config_rec.unit_name, -- store exact configured unit identity
            v_auth_val,
            v_token_qty,
            0, -- remaining_quantity is 0 (not in shop stockpile)
            v_token_total,
            'n_a', -- not available in shop stockpile
            v_shift_id,
            v_created_by,
            'Customer kept physical token with purchase'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 5. Audit Log Entry
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    v_tenant_id,
    v_client_name,
    CASE WHEN v_is_return THEN 'Credit Note Return' ELSE 'Sales Invoice Complete' END,
    CASE WHEN v_is_return THEN 'return' ELSE 'sale' END,
    'invoice',
    v_invoice_id,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'net_total', v_net_total,
      'paid_amount', v_paid_amount,
      'due_amount', v_due_amount,
      'items_count', jsonb_array_length(p_items)
    )
  );

  -- Fetch complete invoice record to return
  SELECT row_to_json(i)::JSONB INTO v_result
    FROM invoices i
   WHERE i.id = v_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice', v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) TO service_role;

-- ---- Guarded backfills ------------------------------------------------------
-- vouchers.shift_id only when exactly one shift of the tenant covers created_at.
WITH single_matching_shift AS (
  SELECT v.id AS voucher_id, MAX(s.id::text)::uuid AS shift_id
    FROM public.vouchers v
    JOIN public.shifts s
      ON s.tenant_id = v.tenant_id
     AND s.start_time <= v.created_at
     AND v.created_at <= COALESCE(s.end_time, now())
   WHERE v.shift_id IS NULL
   GROUP BY v.id
  HAVING COUNT(s.id) = 1
)
UPDATE public.vouchers v
   SET shift_id = m.shift_id
  FROM single_matching_shift m
 WHERE v.id = m.voucher_id;

-- invoice_items.cost_price: best effort from CURRENT items.cost_price.
-- NOTE: this is today's cost, not necessarily the cost at the time of sale.
UPDATE public.invoice_items ii
   SET cost_price = it.cost_price
  FROM public.items it
 WHERE ii.item_id = it.id
   AND ii.cost_price IS NULL
   AND it.cost_price IS NOT NULL;
