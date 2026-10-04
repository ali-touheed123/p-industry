-- Migration: 20261005_02_create_purchase_atomic.sql
-- Purpose: Task 7.1 — Encapsulate purchase creation in a single atomic PostgreSQL
--          transaction to prevent partial-failure inventory/ledger desynchronization.
-- Fixes: FINDING-PROC-001
-- Phase: 7
--
-- The previous POST /api/purchases handler executed 6 sequential non-transactional
-- steps. Any failure between step 2 and step 6 left the database in a partially
-- committed state: purchase header saved but stock not incremented, or stock
-- incremented but supplier balance not updated.
--
-- This procedure wraps all operations in a single plpgsql block. PostgreSQL
-- executes the entire body inside one transaction: either everything commits
-- or nothing commits. Any RAISE EXCEPTION or runtime error triggers an automatic
-- rollback of all changes made within the function call.
--
-- Parameters:
--   p_tenant_id       UUID   -- Tenant owning the purchase (server-enforced)
--   p_purchase_data   JSONB  -- Purchase header fields
--   p_items           JSONB  -- Array of line items
--   p_token_ids       UUID[] -- Array of stockpile token IDs to mark as used (may be empty)
--
-- Returns JSONB with:
--   { "purchase_id": UUID, "purchase_no": TEXT, "tokens_applied_amount": NUMERIC }

CREATE OR REPLACE FUNCTION create_purchase_atomic(
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

  v_is_return          BOOLEAN;
  v_tokens_amount      NUMERIC := 0;
  v_purchase_id        UUID;
  v_token              RECORD;
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
  v_token_count        INT;
BEGIN

  -- 0. Extract header fields from JSONB parameter
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
  v_is_return     := (v_purchase_type = 'return');

  -- 1. Validate required fields
  IF v_purchase_no IS NULL OR trim(v_purchase_no) = '' THEN
    RAISE EXCEPTION 'purchase_no is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- 2. Validate & sum applied tokens; lock rows to prevent concurrent double-apply
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_token_count
      FROM token_transactions
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;

    IF v_token_count <> array_length(p_token_ids, 1) THEN
      RAISE EXCEPTION 'One or more token IDs not found for this tenant';
    END IF;

    FOR v_token IN
      SELECT id, token_value, usage_status, used_against_purchase_id
        FROM token_transactions
       WHERE id = ANY(p_token_ids)
         AND tenant_id = p_tenant_id
         FOR UPDATE
    LOOP
      IF v_token.usage_status = 'used' OR v_token.used_against_purchase_id IS NOT NULL THEN
        RAISE EXCEPTION 'Token % has already been applied to another purchase', v_token.id;
      END IF;
      v_tokens_amount := v_tokens_amount + COALESCE(v_token.token_value, 0);
    END LOOP;
  END IF;

  -- 3. Insert purchase header
  INSERT INTO purchases (
    tenant_id, purchase_no, purchase_type, supplier_id, supplier_name,
    date, subtotal, discount, tokens_applied_amount, net_total,
    paid_amount, due_amount, payment_type, created_by
  ) VALUES (
    p_tenant_id, v_purchase_no, v_purchase_type, v_supplier_id, v_supplier_name,
    v_date, v_subtotal, v_discount, v_tokens_amount, v_net_total,
    v_paid_amount, v_due_amount, v_payment_type, v_created_by
  )
  RETURNING id INTO v_purchase_id;

  -- 4. Mark applied tokens as used
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    UPDATE token_transactions
       SET usage_status             = 'used',
           used_against_purchase_id = v_purchase_id,
           used_date                = NOW()
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;
  END IF;

  -- 5. Insert line items & adjust stock atomically (row-level lock per item)
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
      SELECT id, stock_qty INTO v_db_item
        FROM items WHERE id = v_item_id FOR UPDATE;
      IF FOUND THEN
        UPDATE items
           SET stock_qty = GREATEST(0, COALESCE(v_db_item.stock_qty, 0) + v_qty_delta)
         WHERE id = v_item_id;
      END IF;
    ELSIF v_item_code IS NOT NULL AND trim(v_item_code) <> '' THEN
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code
         FOR UPDATE;
      IF FOUND THEN
        UPDATE items
           SET stock_qty = GREATEST(0, COALESCE(v_db_item.stock_qty, 0) + v_qty_delta)
         WHERE id = v_db_item.id;
      END IF;
    END IF;
  END LOOP;

  -- 6. Update supplier balance
  IF v_supplier_id IS NOT NULL THEN
    SELECT id, current_balance INTO v_supplier
      FROM suppliers
     WHERE id = v_supplier_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_current_bal := COALESCE(v_supplier.current_balance, 0);

      IF v_is_return THEN
        v_cash_received := GREATEST(0, v_paid_amount);
        v_return_credit := GREATEST(0, v_net_total - v_cash_received);
        v_new_balance   := v_current_bal - v_return_credit;
      ELSE
        v_new_balance := v_current_bal +
          CASE WHEN v_due_amount > 0 THEN v_due_amount
               ELSE GREATEST(0, v_net_total - v_paid_amount)
          END;
      END IF;

      UPDATE suppliers
         SET current_balance     = v_new_balance,
             last_payment_amount = CASE WHEN v_paid_amount > 0 THEN v_paid_amount ELSE last_payment_amount END,
             last_payment_date   = CASE WHEN v_paid_amount > 0 THEN v_date ELSE last_payment_date END
       WHERE id = v_supplier_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- 7. Audit log (atomic — failure here rolls back everything)
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id,
    COALESCE(v_supplier_name, 'Supplier'),
    CASE WHEN v_is_return THEN 'Purchase Return' ELSE 'Purchase Invoice Complete' END,
    CASE WHEN v_is_return THEN 'purchase_return' ELSE 'purchase' END,
    'purchase',
    v_purchase_id::text,
    jsonb_build_object(
      'purchase_no',  v_purchase_no,
      'net_total',    v_net_total,
      'paid_amount',  v_paid_amount,
      'due_amount',   v_due_amount,
      'items_count',  jsonb_array_length(p_items)
    )
  );

  -- 8. Return result
  RETURN jsonb_build_object(
    'purchase_id',            v_purchase_id,
    'purchase_no',            v_purchase_no,
    'tokens_applied_amount',  v_tokens_amount
  );

END;
$func$;

GRANT EXECUTE ON FUNCTION create_purchase_atomic(UUID, JSONB, JSONB, UUID[]) TO service_role;
