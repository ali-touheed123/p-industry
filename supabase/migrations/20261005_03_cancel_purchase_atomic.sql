-- Migration: 20261005_03_cancel_purchase_atomic.sql
-- Purpose: Task 7.2 Residual Remediation — Encapsulate purchase cancellation in a single
--          atomic PostgreSQL transaction to prevent partial stock/ledger desynchronization.
-- Fixes: RESIDUAL-PROC-001 (HIGH)
-- Phase: 7 Residual
--
-- The previous DELETE /api/purchases handler executed sequential non-transactional PostgREST
-- calls (stock RPCs, supplier updates, and table deletes). If an error occurred midway,
-- stock or supplier ledger balances remained permanently corrupted without rollback.
--
-- This procedure encapsulates the entire cancellation workflow:
--   1. Locks purchase record (FOR UPDATE) and confirms tenant ownership.
--   2. Loops through purchase line items, locking each item (FOR UPDATE) and reversing stock deltas.
--   3. Locks supplier record (FOR UPDATE) and reverses balance deltas.
--   4. Deletes purchase_items and the purchase header.
--   5. Writes audit log.
-- If any error occurs, PostgreSQL rolls back all operations atomically.

CREATE OR REPLACE FUNCTION cancel_purchase_atomic(
  p_tenant_id   UUID,
  p_purchase_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_purchase       RECORD;
  v_line           RECORD;
  v_reverse_delta  NUMERIC;
  v_item           RECORD;
  v_supplier       RECORD;
  v_current_bal    NUMERIC;
  v_new_balance    NUMERIC;
  v_paid_amt       NUMERIC;
  v_return_credit  NUMERIC;
  v_due_amt        NUMERIC;
  v_net_total      NUMERIC;
  v_debt_added     NUMERIC;
BEGIN
  -- 1. Validate inputs
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'purchase_id is required';
  END IF;

  -- 2. Fetch and lock the purchase record
  SELECT * INTO v_purchase
    FROM purchases
   WHERE id = p_purchase_id AND tenant_id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found for this tenant';
  END IF;

  -- 3. Iterate through line items and reverse inventory adjustments atomically
  FOR v_line IN
    SELECT item_id, item_code, qty
      FROM purchase_items
     WHERE purchase_id = p_purchase_id
  LOOP
    -- Reversal logic:
    -- A purchase originally added stock (+qty), so cancellation removes stock (-qty).
    -- A return originally removed stock (-qty), so cancellation restores stock (+qty).
    v_reverse_delta := CASE WHEN v_purchase.purchase_type = 'return'
                            THEN COALESCE(v_line.qty, 0)
                            ELSE -COALESCE(v_line.qty, 0)
                       END;

    IF v_line.item_id IS NOT NULL THEN
      SELECT id, stock_qty INTO v_item
        FROM items
       WHERE id = v_line.item_id AND tenant_id = p_tenant_id
         FOR UPDATE;

      IF FOUND THEN
        UPDATE items
           SET stock_qty = GREATEST(0, COALESCE(v_item.stock_qty, 0) + v_reverse_delta)
         WHERE id = v_item.id AND tenant_id = p_tenant_id;
      END IF;
    ELSIF v_line.item_code IS NOT NULL AND trim(v_line.item_code) <> '' THEN
      SELECT id, stock_qty INTO v_item
        FROM items
       WHERE tenant_id = p_tenant_id AND code = v_line.item_code
         FOR UPDATE;

      IF FOUND THEN
        UPDATE items
           SET stock_qty = GREATEST(0, COALESCE(v_item.stock_qty, 0) + v_reverse_delta)
         WHERE id = v_item.id AND tenant_id = p_tenant_id;
      END IF;
    END IF;
  END LOOP;

  -- 4. Reverse supplier balance adjustments atomically
  IF v_purchase.supplier_id IS NOT NULL THEN
    SELECT id, current_balance INTO v_supplier
      FROM suppliers
     WHERE id = v_purchase.supplier_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_current_bal := COALESCE(v_supplier.current_balance, 0);

      IF v_purchase.purchase_type = 'return' THEN
        -- Purchase return had reduced debt by (net_total - paid_amount); restore it
        v_paid_amt      := GREATEST(0, COALESCE(v_purchase.paid_amount, 0));
        v_return_credit := GREATEST(0, COALESCE(v_purchase.net_total, 0) - v_paid_amt);
        v_new_balance   := v_current_bal + v_return_credit;
      ELSE
        -- Purchase invoice had increased debt by due_amount or (net_total - paid_amount); subtract it
        v_due_amt    := COALESCE(v_purchase.due_amount, 0);
        v_net_total  := COALESCE(v_purchase.net_total, 0);
        v_paid_amt   := COALESCE(v_purchase.paid_amount, 0);
        v_debt_added := CASE WHEN v_due_amt > 0 THEN v_due_amt
                             ELSE GREATEST(0, v_net_total - v_paid_amt)
                        END;
        v_new_balance := v_current_bal - v_debt_added;
      END IF;

      UPDATE suppliers
         SET current_balance = v_new_balance
       WHERE id = v_purchase.supplier_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- 5. Delete line items (preserves FK integrity)
  DELETE FROM purchase_items
   WHERE purchase_id = p_purchase_id;

  -- 6. Delete purchase header
  DELETE FROM purchases
   WHERE id = p_purchase_id AND tenant_id = p_tenant_id;

  -- 7. Record atomic audit log
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id,
    COALESCE(v_purchase.supplier_name, 'System'),
    'Purchase Cancelled',
    'purchase_cancel',
    'purchase',
    p_purchase_id::text,
    jsonb_build_object(
      'purchase_id',   p_purchase_id,
      'purchase_no',   v_purchase.purchase_no,
      'purchase_type', v_purchase.purchase_type,
      'net_total',     v_purchase.net_total,
      'supplier_id',   v_purchase.supplier_id
    )
  );

  -- 8. Return confirmation
  RETURN jsonb_build_object(
    'success',     true,
    'purchase_id', p_purchase_id,
    'purchase_no', v_purchase.purchase_no
  );

END;
$func$;

GRANT EXECUTE ON FUNCTION cancel_purchase_atomic(UUID, UUID) TO service_role;
