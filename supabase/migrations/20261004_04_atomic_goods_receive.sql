-- Migration: 20261004_04_atomic_goods_receive.sql
-- Purpose: Task 6.2 — Implement atomic inward goods receiving (GRN) with row-level locking
--          and atomic audit logging.
-- Fixes: FINDING-INV-002
-- Phase: 6

CREATE OR REPLACE FUNCTION receive_goods_atomic(
  p_tenant_id        UUID,
  p_item_id          UUID,
  p_qty              NUMERIC,
  p_batch_no         TEXT DEFAULT NULL,
  p_supplier_ref     TEXT DEFAULT NULL,
  p_received_by      TEXT DEFAULT 'Inventory Staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item             RECORD;
  v_previous_stock   NUMERIC;
  v_new_stock        NUMERIC;
  v_year             TEXT;
  v_seq              INT;
  v_grn_no           TEXT;
  v_log_id           UUID;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Received quantity must be positive';
  END IF;

  -- 1. Lock and verify item row under authorized tenant
  SELECT id, tenant_id, code, name, stock_qty
    INTO v_item
    FROM items
   WHERE id = p_item_id
     AND tenant_id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or does not belong to authorized tenant';
  END IF;

  v_previous_stock := COALESCE(v_item.stock_qty, 0);
  v_new_stock := v_previous_stock + p_qty;

  -- 2. Update stock quantity
  UPDATE items
     SET stock_qty = v_new_stock
   WHERE id = p_item_id;

  -- 3. Generate sequential unique GRN reference number
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1
    INTO v_seq
    FROM audit_logs
   WHERE tenant_id = p_tenant_id
     AND action_type = 'grn_receive';

  v_grn_no := 'GRN-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  -- 4. Record stock movement audit log (atomic within the transaction)
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
    COALESCE(p_received_by, 'Inventory Staff'),
    'Goods Received (' || v_grn_no || ')',
    'grn_receive',
    'item',
    p_item_id::text,
    jsonb_build_object(
      'grn_no', v_grn_no,
      'item_id', p_item_id,
      'item_code', v_item.code,
      'item_name', v_item.name,
      'qty_received', p_qty,
      'previous_stock', v_previous_stock,
      'new_stock', v_new_stock,
      'batch_no', p_batch_no,
      'supplier_bill_ref', p_supplier_ref,
      'received_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'grn_no', v_grn_no,
    'previous_stock', v_previous_stock,
    'new_stock', v_new_stock,
    'item_id', p_item_id,
    'item_code', v_item.code,
    'item_name', v_item.name,
    'log_id', v_log_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION receive_goods_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
