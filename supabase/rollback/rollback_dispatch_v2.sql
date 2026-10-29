-- ============================================================================
-- Rollback for migration 20261029_02_dispatch_line_discounts_and_additional_items
--
-- What this does:
--   Restores process_branch_dispatch_atomic to the exact body from
--   migration 01 (no per-line discounts, no additional items).
--
--   The four schema additions (discount_type, discount_value, discount_amount,
--   is_additional) are intentionally NOT dropped — they are additive and
--   harmless, and dropping them would permanently destroy line-discount and
--   additional-line data on already-dispatched orders.
--
-- Code rollback:
--   git revert <commit-hash-of-migration-02-feature>
--   (not a checkout — git revert creates a new commit that undoes only this
--   feature without disturbing the inter-branch work that preceded it)
--
-- NEVER run automatically. Apply manually only after reverting the application
-- code to the commit that introduced migration 02.
--
-- To apply:
--   psql "$DATABASE_URL" -f supabase/rollback/rollback_dispatch_v2.sql
-- ============================================================================

BEGIN;

-- 1. Restore dispatch function to migration-01 version
CREATE OR REPLACE FUNCTION public.process_branch_dispatch_atomic(
  p_order_id         UUID,
  p_to_tenant_id     UUID,
  p_items            JSONB,
  p_discount         NUMERIC DEFAULT 0,
  p_delivery_charges NUMERIC DEFAULT 0,
  p_delivery_method  TEXT DEFAULT NULL,
  p_dispatch_note    TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order                 RECORD;
  v_item_record           RECORD;
  v_input_item            JSONB;
  v_dispatched_qty        INTEGER;
  v_unit_price            NUMERIC(14,2);
  v_line_total            NUMERIC(14,2);
  v_subtotal              NUMERIC(14,2) := 0;
  v_net_total             NUMERIC(14,2) := 0;
  v_src_id                UUID;
  v_src_qty               NUMERIC;
  v_total_dispatched_qty  INTEGER := 0;
  v_has_short_dispatch    BOOLEAN := FALSE;
  v_clean_dispatch_note   TEXT;
  v_clean_delivery_method TEXT;
  v_matched               BOOLEAN;
BEGIN
  -- 1. Lock and validate order
  SELECT * INTO v_order
    FROM public.branch_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.to_tenant_id <> p_to_tenant_id THEN
    RAISE EXCEPTION 'Forbidden: Only the supplying branch may dispatch this order';
  END IF;

  IF v_order.status <> 'accepted' THEN
    RAISE EXCEPTION 'Order must be in "accepted" status to dispatch (current: "%")', v_order.status;
  END IF;

  -- 2. Validate discount and delivery charges
  IF p_discount IS NOT NULL AND p_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  IF p_delivery_charges IS NOT NULL AND p_delivery_charges < 0 THEN
    RAISE EXCEPTION 'Delivery charges cannot be negative';
  END IF;

  v_clean_dispatch_note := NULLIF(TRIM(p_dispatch_note), '');
  v_clean_delivery_method := NULLIF(TRIM(p_delivery_method), '');

  IF v_clean_dispatch_note IS NOT NULL AND LENGTH(v_clean_dispatch_note) > 500 THEN
    RAISE EXCEPTION 'Dispatch note cannot exceed 500 characters';
  END IF;

  -- 3. Iterate over existing order items and match strictly by item id
  FOR v_item_record IN
    SELECT id, item_code, qty
      FROM public.branch_order_items
     WHERE order_id = p_order_id
  LOOP
    v_matched := FALSE;

    -- Match by id ONLY (required)
    FOR v_input_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      IF v_input_item->>'id' IS NOT NULL AND v_input_item->>'id' = v_item_record.id::text THEN
        -- Unit price validation: must be provided explicitly (error if missing or negative)
        IF v_input_item->'unit_price' IS NULL OR jsonb_typeof(v_input_item->'unit_price') = 'null' THEN
          RAISE EXCEPTION 'Unit price is required for item "%" (%)', v_item_record.item_code, v_item_record.id;
        END IF;

        v_unit_price     := (v_input_item->>'unit_price')::numeric;
        v_dispatched_qty := (v_input_item->>'dispatched_qty')::integer;
        v_matched        := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_matched THEN
      RAISE EXCEPTION 'Item with id "%" (code: "%") is missing from dispatch payload', v_item_record.id, v_item_record.item_code;
    END IF;

    -- Validate quantities
    IF v_dispatched_qty IS NULL OR v_dispatched_qty < 0 THEN
      RAISE EXCEPTION 'Invalid dispatched quantity for item "%"', v_item_record.item_code;
    END IF;

    IF v_dispatched_qty > v_item_record.qty THEN
      RAISE EXCEPTION 'Dispatched quantity (%) cannot exceed requested quantity (%) for item "%"',
        v_dispatched_qty, v_item_record.qty, v_item_record.item_code;
    END IF;

    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative for item "%"', v_item_record.item_code;
    END IF;

    IF v_dispatched_qty < v_item_record.qty THEN
      v_has_short_dispatch := TRUE;
    END IF;

    v_total_dispatched_qty := v_total_dispatched_qty + v_dispatched_qty;

    -- Check and deduct stock from supplying branch if dispatched_qty > 0
    IF v_dispatched_qty > 0 THEN
      SELECT id, stock_qty
        INTO v_src_id, v_src_qty
        FROM public.items
       WHERE tenant_id = p_to_tenant_id
         AND UPPER(code) = UPPER(TRIM(v_item_record.item_code))
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item "%" does not exist in supplying branch inventory', v_item_record.item_code;
      END IF;

      IF v_src_qty < v_dispatched_qty THEN
        RAISE EXCEPTION 'Insufficient stock for item "%" (available: %, dispatch requested: %)',
          v_item_record.item_code, v_src_qty, v_dispatched_qty;
      END IF;

      -- Deduct stock strictly (no negative stock clamp)
      UPDATE public.items
         SET stock_qty = stock_qty - v_dispatched_qty
       WHERE id = v_src_id;
    END IF;

    -- Compute line totals
    v_line_total := ROUND(v_dispatched_qty * v_unit_price, 2);
    v_subtotal   := v_subtotal + v_line_total;

    -- Update order item row
    UPDATE public.branch_order_items
       SET dispatched_qty = v_dispatched_qty,
           unit_price     = v_unit_price,
           total_price    = v_line_total
     WHERE id = v_item_record.id;
  END LOOP;

  -- 4. Validate overall quantities
  IF v_total_dispatched_qty = 0 THEN
    RAISE EXCEPTION 'Cannot dispatch an order with 0 total quantity. Reject the order instead.';
  END IF;

  -- 5. If partial dispatch, enforce dispatch_note
  IF v_has_short_dispatch AND v_clean_dispatch_note IS NULL THEN
    RAISE EXCEPTION 'A dispatch note explaining the shortage is required when any item is dispatched short';
  END IF;

  -- 6. Validate discount vs subtotal
  IF COALESCE(p_discount, 0) > v_subtotal THEN
    RAISE EXCEPTION 'Discount (%) cannot exceed subtotal (%)', p_discount, v_subtotal;
  END IF;

  v_net_total := ROUND((v_subtotal - COALESCE(p_discount, 0)) + COALESCE(p_delivery_charges, 0), 2);

  -- 7. Update branch_orders
  UPDATE public.branch_orders
     SET status           = 'dispatched',
         subtotal         = v_subtotal,
         discount         = COALESCE(p_discount, 0),
         delivery_charges = COALESCE(p_delivery_charges, 0),
         delivery_method  = v_clean_delivery_method,
         dispatch_note    = v_clean_dispatch_note,
         transfer_value   = v_net_total,
         dispatched_at    = now()
   WHERE id = p_order_id;

  -- 8. Insert notification event
  INSERT INTO public.branch_order_events (
    order_id,
    event_type,
    notify_tenant_id,
    data,
    created_at
  ) VALUES (
    p_order_id,
    'dispatched',
    v_order.from_tenant_id,
    jsonb_build_object(
      'order_no',           v_order.order_no,
      'dispatch_note',      v_clean_dispatch_note,
      'delivery_method',    v_clean_delivery_method,
      'transfer_value',     v_net_total,
      'subtotal',           v_subtotal,
      'has_short_dispatch', v_has_short_dispatch
    ),
    now()
  );

  RETURN v_net_total;
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_dispatch_atomic(UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT, TEXT)
  TO service_role;

-- Schema columns intentionally NOT dropped. See header comment.

COMMIT;

