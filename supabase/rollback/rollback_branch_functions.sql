-- Migration: 20261029_02_rollback_branch_orders_lifecycle.sql
-- Purpose: Complete emergency rollback procedure to restore original stored procedures
--          from 20261004_03_atomic_branch_transfer.sql if the new lifecycle system needs to be reverted.
-- Note: Added columns and branch_order_events are additive and remain in place safely.

BEGIN;

-- ============================================================================
-- 1. Drop new lifecycle procedure overloads
-- ============================================================================
DROP FUNCTION IF EXISTS public.process_branch_dispatch_atomic(UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.process_branch_accept_atomic(UUID, UUID);
DROP FUNCTION IF EXISTS public.process_branch_reject_atomic(UUID, UUID, TEXT);

-- ============================================================================
-- 2. Restore original 2-argument process_branch_dispatch_atomic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_branch_dispatch_atomic(
  p_order_id     UUID,
  p_to_tenant_id UUID
)
RETURNS NUMERIC           -- Returns the computed transfer_value
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item           RECORD;
  v_src_id         UUID;
  v_src_qty        NUMERIC;
  v_new_qty        NUMERIC;
  v_cost_price     NUMERIC;
  v_retail_price   NUMERIC;
  v_unit_cost      NUMERIC;
  v_transfer_value NUMERIC := 0;
BEGIN
  -- Iterate over order line items
  FOR v_item IN
    SELECT item_code, qty
      FROM public.branch_order_items
     WHERE order_id = p_order_id
  LOOP
    -- Resolve item in supplying branch using strict code match (upper-cased)
    SELECT id, stock_qty, cost_price, retail_price
      INTO v_src_id, v_src_qty, v_cost_price, v_retail_price
      FROM public.items
     WHERE tenant_id = p_to_tenant_id
       AND UPPER(code) = UPPER(TRIM(v_item.item_code))
     FOR UPDATE;  -- Row-level lock: prevents concurrent dispatch racing

    IF FOUND THEN
      -- Deduct stock, clamped to 0
      v_new_qty := GREATEST(0, v_src_qty - v_item.qty);
      UPDATE public.items SET stock_qty = v_new_qty WHERE id = v_src_id;

      -- Accumulate transfer value from cost price (fallback: 85% of retail)
      v_unit_cost := COALESCE(NULLIF(v_cost_price, 0), v_retail_price * 0.85, 0);
      v_transfer_value := v_transfer_value + (v_unit_cost * v_item.qty);
    END IF;
  END LOOP;

  -- Persist the computed transfer value so the receive step can reuse it
  UPDATE public.branch_orders
     SET transfer_value = CASE WHEN v_transfer_value > 0 THEN v_transfer_value ELSE NULL END
   WHERE id = p_order_id;

  RETURN v_transfer_value;
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_dispatch_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(UUID, UUID) TO service_role;

-- ============================================================================
-- 3. Restore original 3-argument process_branch_receive_atomic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_branch_receive_atomic(
  p_order_id       UUID,
  p_from_tenant_id UUID,
  p_to_tenant_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item     RECORD;
  v_dest_id  UUID;
  v_dest_qty NUMERIC;
  v_new_qty  NUMERIC;
  v_orig     RECORD;
BEGIN
  -- Iterate over order line items
  FOR v_item IN
    SELECT item_code, qty
      FROM public.branch_order_items
     WHERE order_id = p_order_id
  LOOP
    -- Try to find item in destination branch (lock for update)
    SELECT id, stock_qty
      INTO v_dest_id, v_dest_qty
      FROM public.items
     WHERE tenant_id = p_from_tenant_id
       AND UPPER(code) = UPPER(TRIM(v_item.item_code))
     FOR UPDATE;

    IF FOUND THEN
      -- Item exists in destination: increment stock
      v_new_qty := v_dest_qty + v_item.qty;
      UPDATE public.items SET stock_qty = v_new_qty WHERE id = v_dest_id;
    ELSE
      -- Item does not exist in destination: copy from supplying branch
      SELECT *
        INTO v_orig
        FROM public.items
       WHERE tenant_id = p_to_tenant_id
         AND UPPER(code) = UPPER(TRIM(v_item.item_code))
       LIMIT 1;

      IF FOUND THEN
        INSERT INTO public.items (
          tenant_id, code, name, category, item_type, unit, pack_size,
          shade_code, shade_hex, cost_price, retail_price, wholesale_price,
          trade_price, stock_qty, min_stock_alert, brand_id, series_id, brand
        )
        VALUES (
          p_from_tenant_id,
          v_orig.code,
          v_orig.name,
          COALESCE(v_orig.category, 'General'),
          COALESCE(v_orig.item_type, 'finish_goods'),
          COALESCE(v_orig.unit, 'Can'),
          COALESCE(v_orig.pack_size, v_orig.unit, 'Can'),
          v_orig.shade_code,
          v_orig.shade_hex,
          COALESCE(v_orig.cost_price, 0),
          COALESCE(v_orig.retail_price, 0),
          COALESCE(v_orig.wholesale_price, 0),
          COALESCE(v_orig.trade_price, 0),
          v_item.qty,
          COALESCE(v_orig.min_stock_alert, 5),
          v_orig.brand_id,
          v_orig.series_id,
          v_orig.brand
        )
        ON CONFLICT DO NOTHING;  -- Guard against concurrent inserts of same code+tenant
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_receive_atomic(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_receive_atomic(UUID, UUID, UUID) TO service_role;

COMMIT;

