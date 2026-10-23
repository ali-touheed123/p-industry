-- Migration: 20261023_01_stock_adjustment_atomic.sql
-- Purpose: Atomic signed (+/-) stock adjustment with audit log, used by the
--          keyboard-driven Stock Adjustment grid (/api/items/adjust).
--          Unlike receive_goods_atomic this does NOT create a GRN; it logs
--          action_type = 'stock_adjustment' and refuses to take stock below zero.

CREATE OR REPLACE FUNCTION public.stock_adjustment_atomic(
  p_tenant_id    UUID,
  p_item_id      UUID,
  p_delta        NUMERIC,
  p_reason       TEXT DEFAULT NULL,
  p_batch_ref    TEXT DEFAULT NULL,
  p_adjusted_by  TEXT DEFAULT 'Inventory Staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item           RECORD;
  v_previous_stock NUMERIC;
  v_new_stock      NUMERIC;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity must be non-zero';
  END IF;

  -- Lock the item row under the authorized tenant
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
  v_new_stock := v_previous_stock + p_delta;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for % (current %, adjustment %)', v_item.code, v_previous_stock, p_delta;
  END IF;

  UPDATE items SET stock_qty = v_new_stock WHERE id = p_item_id;

  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id,
    COALESCE(p_adjusted_by, 'Inventory Staff'),
    'Stock Adjustment (' || CASE WHEN p_delta > 0 THEN '+' ELSE '-' END || abs(p_delta)::text || ')',
    'stock_adjustment',
    'item',
    p_item_id::text,
    jsonb_build_object(
      'item_id', p_item_id,
      'item_code', v_item.code,
      'item_name', v_item.name,
      'qty_delta', p_delta,
      'previous_stock', v_previous_stock,
      'new_stock', v_new_stock,
      'reason', p_reason,
      'batch_ref', p_batch_ref,
      'adjusted_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  );

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'item_code', v_item.code,
    'item_name', v_item.name,
    'previous_stock', v_previous_stock,
    'new_stock', v_new_stock
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stock_adjustment_atomic(uuid, uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_adjustment_atomic(uuid, uuid, numeric, text, text, text) TO service_role;
