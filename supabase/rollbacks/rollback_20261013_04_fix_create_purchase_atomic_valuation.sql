-- ==============================================================================
-- ROLLBACK ARTIFACT: rollback_20261013_04_fix_create_purchase_atomic_valuation.sql
-- Target: public.create_purchase_atomic(UUID, JSONB, JSONB, UUID[])
-- Location: supabase/rollbacks/ (ISOLATED outside active migrations root)
-- Purpose: Emergency standby restoration script for create_purchase_atomic
-- Reference: docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md (Revision 12 FINAL Task T5)
-- ==============================================================================
--
-- IMPORTANT SAFETY & DESIGN NOTICE:
-- 1. This file is intentionally placed in supabase/rollbacks/ so that forward migration
--    runners do NOT execute it automatically.
-- 2. BASELINE RESTORATION:
--    Restores the exact, verified definition established by 20261013_01_fix_create_purchase_atomic_audit_log.sql.
--    - Retains canonical Step 7 audit contract (entity_type = 'purchase', action_type, entity_id::text).
--    - Retains Phase 9 shift_id DECLARE, extraction, and purchases.shift_id insert.
--    - Retains C-01 strict item exception on unresolved item_code.
--    - Retains C-02 supplier payment metadata updates when paid_amount > 0.
--    - Retains C-06 security posture (service_role only).
--    - Reverts Step 2 token accumulator to unit face value summation: COALESCE(v_token.token_value, 0).
-- 3. DATA REALITY: Rolling back function DDL modifies routine code only; it does NOT
--    undo or reverse purchase records, inventory changes, or token mutations committed while
--    the forward patch was active.
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
  v_shift_id           UUID;           -- Phase 9: shift linkage

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
  v_shift_id      := NULLIF(p_purchase_data->>'shift_id', '')::UUID;  -- Phase 9
  v_is_return     := (v_purchase_type = 'return');

  -- ── 1. Validate required fields ────────────────────────────────────────────
  IF v_purchase_no IS NULL OR trim(v_purchase_no) = '' THEN
    RAISE EXCEPTION 'purchase_no is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a non-null JSONB array';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- ── 2. Validate & sum applied tokens; lock rows (prevent concurrent double-apply) ──
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_token_count
      FROM token_transactions
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;

    IF v_token_count <> array_length(p_token_ids, 1) THEN
      RAISE EXCEPTION 'One or more tokens do not belong to this tenant or do not exist';
    END IF;

    FOR v_token IN
      SELECT id, token_value, usage_status, used_against_purchase_id
        FROM token_transactions
       WHERE id = ANY(p_token_ids)
         AND tenant_id = p_tenant_id
       ORDER BY id ASC
         FOR UPDATE
    LOOP
      IF v_token.usage_status = 'used' OR v_token.used_against_purchase_id IS NOT NULL THEN
        RAISE EXCEPTION 'Token % has already been applied to another purchase', v_token.id;
      END IF;
      v_tokens_amount := v_tokens_amount + COALESCE(v_token.token_value, 0);
    END LOOP;
  END IF;

  -- ── 3. Insert purchase header (includes Phase 9 shift_id) ──────────────────
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

  -- ── 4. Mark applied tokens as used ─────────────────────────────────────────
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    UPDATE token_transactions
       SET usage_status             = 'used',
           used_against_purchase_id = v_purchase_id
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;
  END IF;

  -- ── 5. Insert line items & adjust stock atomically (row-level lock per item) ──
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

    v_qty_delta := CASE WHEN v_is_return
                        THEN -COALESCE((v_line->>'qty')::NUMERIC, 0)
                        ELSE  COALESCE((v_line->>'qty')::NUMERIC, 0)
                   END;

    IF v_item_id IS NOT NULL THEN
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

  -- ── 6. Update supplier balance & payment metadata atomically ───────────────
  IF v_supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_supplier_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_current_bal := COALESCE(v_supplier.current_balance, 0);

      IF NOT v_is_return THEN
        v_new_balance := v_current_bal + v_due_amount;
      ELSE
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

  -- ── 7. Write audit log entry (canonical contract — F-06 / C-05) ────────────
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
      'payment_type',           v_payment_type,
      'shift_id',               v_shift_id,
      'tokens_applied_amount',  v_tokens_amount
    )
  );

  -- ── 8. Return result ────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'purchase_id',            v_purchase_id,
    'purchase_no',            v_purchase_no,
    'tokens_applied_amount',  v_tokens_amount
  );

END;
$func$;

-- ==============================================================================
-- SECURITY POSTURE (C-06)
-- Revoke execute from PUBLIC, anon, and authenticated roles.
-- Grant execute strictly to service_role only.
-- ==============================================================================
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;
