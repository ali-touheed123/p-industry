-- Migration: 20260925_05_atomic_stock_adjust.sql
-- Purpose: Create atomic stock adjustment RPCs to eliminate read-modify-write race conditions
--          under concurrent multi-terminal POS checkout (VAL-01 / DB-01 fix).
--
-- NOTE: items.stock_qty is NUMERIC in this schema, so all delta params use NUMERIC.
-- Applied to project: ignspvajzblmsbertmmv (p-industry) on 2026-09-25.

CREATE OR REPLACE FUNCTION adjust_item_stock(
  p_item_id   UUID,
  p_qty_delta NUMERIC  -- positive = add stock (returns), negative = deduct stock (sales)
)
RETURNS TABLE(new_stock_qty NUMERIC) AS $$
DECLARE
  v_current NUMERIC;
  v_new     NUMERIC;
BEGIN
  -- Lock the row for the duration of this transaction (prevents concurrent updates)
  SELECT stock_qty INTO v_current
    FROM items
   WHERE id = p_item_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found', p_item_id;
  END IF;

  -- Clamp to 0 on deductions (sales), allow free add on returns
  v_new := GREATEST(0, v_current + p_qty_delta);

  UPDATE items
     SET stock_qty = v_new
   WHERE id = p_item_id;

  RETURN QUERY SELECT v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role (used by supabaseAdmin)
GRANT EXECUTE ON FUNCTION adjust_item_stock(UUID, NUMERIC) TO service_role;

-- Variant that falls back to item_code lookup within a tenant (for invoices without item_id)
CREATE OR REPLACE FUNCTION adjust_item_stock_by_code(
  p_tenant_id UUID,
  p_item_code TEXT,
  p_qty_delta NUMERIC
)
RETURNS TABLE(item_id UUID, new_stock_qty NUMERIC) AS $$
DECLARE
  v_item_id UUID;
  v_current NUMERIC;
  v_new     NUMERIC;
BEGIN
  SELECT id, stock_qty INTO v_item_id, v_current
    FROM items
   WHERE tenant_id = p_tenant_id
     AND code      = p_item_code
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item with code % not found for tenant %', p_item_code, p_tenant_id;
  END IF;

  v_new := GREATEST(0, v_current + p_qty_delta);

  UPDATE items
     SET stock_qty = v_new
   WHERE id = v_item_id;

  RETURN QUERY SELECT v_item_id, v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION adjust_item_stock_by_code(UUID, TEXT, NUMERIC) TO service_role;
