-- Migration: 20261014_01_create_purchase_atomic_partial_tokens.sql
-- Purpose:   Add quantity-aware token allocations (Path B: Partial-Batch Parity) to
--            create_purchase_atomic. Enables partial-batch consumption, decrements
--            parent batch remaining_quantity and total_amount, generates uniform child
--            slices linked via used_against_purchase_id and parent_transaction_id,
--            and provides a hardened backward-compatible UUID[] overload.
-- Target:    public.create_purchase_atomic(uuid, jsonb, jsonb, jsonb)
--            public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])
-- Phase:     Path B Implementation
-- Reference: SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md (Section 1.1, 1.2, 4.1)

-- ==============================================================================
-- 1. CANONICAL STORED PROCEDURE: JSONB Allocations Overload
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_purchase_atomic(
  p_tenant_id          UUID,
  p_purchase_data      JSONB,
  p_items              JSONB,
  p_token_allocations  JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_purchase_no        TEXT;
  v_purchase_type      TEXT;
  v_supplier_id        UUID;
  v_supplier_name      TEXT;
  v_date               DATE;
  v_subtotal           NUMERIC;
  v_discount           NUMERIC;
  v_net_total          NUMERIC;
  v_paid_amount        NUMERIC;
  v_due_amount         NUMERIC;
  v_payment_type       TEXT;
  v_created_by         TEXT;
  v_shift_id           UUID;

  v_is_return          BOOLEAN;
  v_tokens_amount      NUMERIC := 0;
  v_purchase_id        UUID;
  v_db_item            RECORD;
  v_qty_delta          NUMERIC;
  v_supplier           RECORD;
  v_current_bal        NUMERIC;
  v_new_balance        NUMERIC;
  v_cash_received      NUMERIC;
  v_return_credit      NUMERIC;
  v_line               JSONB;
  v_item_id            UUID;
  v_item_code          TEXT;

  -- Token allocation tracking
  v_token_ids          UUID[];
  v_locked_rows        token_transactions[] := '{}';
  v_alloc_qtys         INTEGER[] := '{}';
  v_rec                token_transactions;
  v_rec_qty            INTEGER;
  v_elem               JSONB;
  i                    INTEGER;

  -- Parameterized cursor selecting composite tuple 't' directly in deterministic ascending order
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

  v_cursor_row RECORD;
BEGIN

  -- ── 0. Extract header fields from JSONB parameter ───────────────────────────
  v_purchase_no   := p_purchase_data->>'purchase_no';
  v_purchase_type := COALESCE(p_purchase_data->>'purchase_type', 'purchase');
  v_supplier_id   := NULLIF(p_purchase_data->>'supplier_id', '')::UUID;
  v_supplier_name := COALESCE(p_purchase_data->>'supplier_name', 'Supplier');
  v_date          := COALESCE((p_purchase_data->>'date')::DATE, CURRENT_DATE);
  v_subtotal      := COALESCE((p_purchase_data->>'subtotal')::NUMERIC, 0);
  v_discount      := COALESCE((p_purchase_data->>'discount')::NUMERIC, 0);
  v_net_total     := COALESCE((p_purchase_data->>'net_total')::NUMERIC, 0);
  v_paid_amount   := COALESCE((p_purchase_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount    := COALESCE((p_purchase_data->>'due_amount')::NUMERIC, 0);
  v_payment_type  := COALESCE(p_purchase_data->>'payment_type', 'credit');
  v_created_by    := p_purchase_data->>'created_by';
  v_shift_id      := NULLIF(p_purchase_data->>'shift_id', '')::UUID;
  v_is_return     := (v_purchase_type = 'return');

  -- ── 1. Validate required fields ────────────────────────────────────────────
  IF v_purchase_no IS NULL OR trim(v_purchase_no) = '' THEN
    RAISE EXCEPTION 'purchase_no is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF p_purchase_data IS NULL OR jsonb_typeof(p_purchase_data) <> 'object' THEN
    RAISE EXCEPTION 'p_purchase_data must be a valid JSONB object';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a non-null JSONB array';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Disallow token application on purchase returns
  IF v_is_return AND p_token_allocations IS NOT NULL AND jsonb_array_length(p_token_allocations) > 0 THEN
    RAISE EXCEPTION 'Stockpile tokens cannot be applied to purchase returns';
  END IF;

  -- ── 2. Validate token allocations structure & bounds ───────────────────────
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
        RAISE EXCEPTION 'Duplicate token IDs supplied in purchase token allocations';
      END IF;
    END IF;
  END IF;

  -- ── 3. Deterministic Row Locking & Valuation Calculation ───────────────────
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
        RAISE EXCEPTION 'Token % is not available for deduction (status: %)', v_rec.id, v_rec.usage_status;
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

  -- ── 4. Insert purchase header (includes Phase 9 shift_id) ──────────────────
  INSERT INTO purchases (
    tenant_id, purchase_no, purchase_type, supplier_id, supplier_name,
    date, subtotal, discount, tokens_applied_amount, net_total,
    paid_amount, due_amount, payment_type, created_by, shift_id
  ) VALUES (
    p_tenant_id, v_purchase_no, v_purchase_type, v_supplier_id, v_supplier_name,
    v_date, v_subtotal, v_discount, v_tokens_amount, v_net_total,
    v_paid_amount, v_due_amount, v_payment_type, v_created_by, v_shift_id
  )
  RETURNING id INTO v_purchase_id;

  -- ── 5. Token Mutation & Uniform Child Slice Creation ───────────────────────
  IF cardinality(v_locked_rows) > 0 THEN
    FOR i IN 1 .. cardinality(v_locked_rows)
    LOOP
      v_rec     := v_locked_rows[i];
      v_rec_qty := v_alloc_qtys[i];

      -- A. Decrement parent batch residual stock and book value (Model 1 Dynamic Residual Book Value)
      UPDATE token_transactions
         SET remaining_quantity = remaining_quantity - v_rec_qty,
             total_amount       = (remaining_quantity - v_rec_qty) * token_value,
             usage_status       = CASE WHEN remaining_quantity - v_rec_qty = 0 THEN 'used' ELSE 'available' END
       WHERE id = v_rec.id;

      -- B. Insert child consumption slice (uniform for all partial and full allocations)
      -- Populates all 10 NOT NULL columns; sets shift_id = NULL to protect drawer cash.
      INSERT INTO token_transactions (
        tenant_id, type, invoice_id, redemption_id, client_id, client_name,
        brand_id, brand_name, series_id, series_name, unit_name,
        token_value, quantity, remaining_quantity, total_amount,
        parent_transaction_id, usage_status, used_against_purchase_id,
        settled_vendor_name, notes, shift_id
      ) VALUES (
        p_tenant_id, v_rec.type, v_rec.invoice_id, v_rec.redemption_id,
        v_rec.client_id, v_rec.client_name,
        v_rec.brand_id, v_rec.brand_name,
        v_rec.series_id, v_rec.series_name, v_rec.unit_name,
        v_rec.token_value, v_rec_qty, 0, v_rec_qty * v_rec.token_value,
        v_rec.id, 'used', v_purchase_id,
        v_supplier_name,
        'Deduction against purchase ' || v_purchase_no,
        NULL
      );
    END LOOP;
  END IF;

  -- ── 6. Insert line items & adjust stock atomically (row-level lock per item) ──
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_line->>'item_id', '')::UUID;
    v_item_code := v_line->>'item_code';

    INSERT INTO purchase_items (
      purchase_id, item_id, item_code, item_name,
      unit, qty, unit_price, total_price
    ) VALUES (
      v_purchase_id,
      v_item_id,
      v_item_code,
      COALESCE(v_line->>'item_name', ''),
      COALESCE(v_line->>'unit', 'Can'),
      COALESCE((v_line->>'qty')::NUMERIC, 0),
      COALESCE((v_line->>'unit_price')::NUMERIC, 0),
      COALESCE((v_line->>'total_price')::NUMERIC, 0)
    );

    -- Purchase increases stock; return decreases it
    v_qty_delta := CASE WHEN v_is_return
                        THEN -COALESCE((v_line->>'qty')::NUMERIC, 0)
                        ELSE  COALESCE((v_line->>'qty')::NUMERIC, 0)
                   END;

    IF v_item_id IS NOT NULL THEN
      -- Primary path: lookup by item_id (UUID)
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE id = v_item_id AND tenant_id = p_tenant_id
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with ID % not found for this tenant', v_item_id;
      END IF;
      UPDATE items
         SET stock_qty = GREATEST(0, COALESCE(v_db_item.stock_qty, 0) + v_qty_delta)
       WHERE id = v_db_item.id AND tenant_id = p_tenant_id;

    ELSIF v_item_code IS NOT NULL AND trim(v_item_code) <> '' THEN
      -- Fallback path: lookup by item code (C-01 — strict validation, no silent skip)
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;
      END IF;
      UPDATE items
         SET stock_qty = GREATEST(0, COALESCE(v_db_item.stock_qty, 0) + v_qty_delta)
       WHERE id = v_db_item.id AND tenant_id = p_tenant_id;
    END IF;
  END LOOP;

  -- ── 7. Update supplier balance & payment metadata atomically ───────────────
  IF v_supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_supplier_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_current_bal := COALESCE(v_supplier.current_balance, 0);

      IF NOT v_is_return THEN
        -- Purchase: unpaid amount increases supplier payable balance
        v_new_balance := v_current_bal + v_due_amount;
      ELSE
        -- Return: cash refund vs store credit against unpaid debt
        v_cash_received := v_paid_amount;
        v_return_credit := GREATEST(0, v_net_total - v_cash_received);
        v_new_balance   := v_current_bal - v_return_credit;
      END IF;

      UPDATE suppliers
         SET current_balance     = v_new_balance,
             last_payment_amount = CASE WHEN v_paid_amount > 0 THEN v_paid_amount
                                        ELSE last_payment_amount END,
             last_payment_date   = CASE WHEN v_paid_amount > 0 THEN v_date
                                        ELSE last_payment_date END
       WHERE id = v_supplier_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- ── 8. Write audit log entry (canonical contract — F-06 / C-05) ────────────
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
    COALESCE(v_created_by, 'System'),
    CASE WHEN v_is_return THEN 'Purchase Return' ELSE 'Purchase Invoice Complete' END,
    CASE WHEN v_is_return THEN 'purchase_return' ELSE 'purchase' END,
    'purchase',
    v_purchase_id::text,
    jsonb_build_object(
      'purchase_no',            v_purchase_no,
      'supplier_id',            v_supplier_id,
      'supplier_name',          v_supplier_name,
      'net_total',              v_net_total,
      'paid_amount',            v_paid_amount,
      'due_amount',             v_due_amount,
      'tokens_applied_amount',  v_tokens_amount,
      'token_allocations',      COALESCE(p_token_allocations, '[]'::jsonb),
      'item_count',             jsonb_array_length(p_items)
    )
  );

  RETURN jsonb_build_object(
    'success',                true,
    'purchase_id',            v_purchase_id,
    'purchase_no',            v_purchase_no,
    'tokens_applied_amount',  v_tokens_amount,
    'due_amount',             v_due_amount,
    'net_total',              v_net_total
  );

END;
$func$;

-- ==============================================================================
-- 2. HARDENED LEGACY WRAPPER: UUID Array Overload
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_purchase_atomic(
  p_tenant_id     UUID,
  p_purchase_data JSONB,
  p_items         JSONB,
  p_token_ids     UUID[]
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
    RETURN public.create_purchase_atomic(p_tenant_id, p_purchase_data, p_items, NULL::jsonb);
  END IF;

  IF array_position(p_token_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Token ID array cannot contain NULL elements';
  END IF;

  IF (SELECT count(DISTINCT u.id) FROM unnest(p_token_ids) AS u(id)) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'Duplicate token IDs supplied in purchase token request';
  END IF;

  -- Pre-validate existence and tenant ownership (fail-closed guard)
  IF (SELECT count(*) FROM token_transactions WHERE id = ANY(p_token_ids) AND tenant_id = p_tenant_id) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'One or more tokens do not belong to this tenant or do not exist';
  END IF;

  -- Formatting conversion: maps each token to full remaining_quantity for legacy callers
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

  RETURN public.create_purchase_atomic(p_tenant_id, p_purchase_data, p_items, v_allocations);
END;
$func$;

-- ==============================================================================
-- 3. SECURITY POSTURE & PRIVILEGES (C-06)
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;
