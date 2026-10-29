BEGIN;

-- ============================================================================
-- Migration: 20261029_02_dispatch_line_discounts_and_additional_items
--
-- Changes (additive only — migration 01 untouched):
--   A. Per-line discount columns on branch_order_items
--   B. is_additional column on branch_order_items
--   C. Replacement of process_branch_dispatch_atomic (same 7-arg signature,
--      new fields optional in payload so SQL can go first, code after)
--
-- Constraints audit result (pre-checked, no changes needed):
--   branch_order_items has NO CHECK constraint on qty.
--   qty column: integer NOT NULL DEFAULT 1.
--   → additional lines may use qty = 0 (requested 0, dispatched N) without
--     violating any constraint.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Schema additions — branch_order_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.branch_order_items
  ADD COLUMN IF NOT EXISTS discount_type   TEXT           DEFAULT NULL
    CHECK (discount_type IN ('percent', 'flat')),
  ADD COLUMN IF NOT EXISTS discount_value  NUMERIC(14,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_additional   BOOLEAN        NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.branch_order_items.discount_type
  IS 'percent = % of gross line, flat = Rs amount off line total; NULL means no line discount';
COMMENT ON COLUMN public.branch_order_items.discount_value
  IS 'Input value from operator (e.g. 10 for 10% or Rs 10)';
COMMENT ON COLUMN public.branch_order_items.discount_amount
  IS 'Resolved Rs discount on this line (stored for audit)';
COMMENT ON COLUMN public.branch_order_items.is_additional
  IS 'True for lines added by the supplying branch at dispatch time (not in original order)';

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Replacement dispatch function
-- Same 7-argument signature as migration 01 — new fields come in via p_items JSONB
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_branch_dispatch_atomic(
  p_order_id         UUID,
  p_to_tenant_id     UUID,
  p_items            JSONB,
  p_discount         NUMERIC DEFAULT 0,
  p_delivery_charges NUMERIC DEFAULT 0,
  p_delivery_method  TEXT    DEFAULT NULL,
  p_dispatch_note    TEXT    DEFAULT NULL
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
  v_gross                 NUMERIC(14,2);
  v_disc_type             TEXT;
  v_disc_value            NUMERIC(14,2);
  v_disc_amount           NUMERIC(14,2);
  v_line_total            NUMERIC(14,2);
  v_subtotal              NUMERIC(14,2) := 0;
  v_net_total             NUMERIC(14,2) := 0;
  v_src_id                UUID;
  v_src_qty               NUMERIC;
  v_total_dispatched_qty  INTEGER := 0;
  v_has_short_dispatch    BOOLEAN := FALSE;
  v_has_additional        BOOLEAN := FALSE;
  v_additional_count      INTEGER := 0;
  v_clean_dispatch_note   TEXT;
  v_clean_delivery_method TEXT;
  v_matched               BOOLEAN;
  -- additional-item processing
  v_add_input             JSONB;
  v_add_code              TEXT;
  v_add_dqty              INTEGER;
  v_add_uprice            NUMERIC(14,2);
  v_add_disc_type         TEXT;
  v_add_disc_value        NUMERIC(14,2);
  v_add_disc_amount       NUMERIC(14,2);
  v_add_gross             NUMERIC(14,2);
  v_add_total             NUMERIC(14,2);
  v_add_item_id           UUID;
  v_add_item_name         TEXT;
  v_add_item_unit         TEXT;
  v_add_item_qty          NUMERIC;
  v_add_item_stock        NUMERIC;
  v_extra_count           INTEGER := 0;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. Lock and validate order
  -- ──────────────────────────────────────────────────────────────────────────
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

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. Validate overall discount / delivery
  -- ──────────────────────────────────────────────────────────────────────────
  IF p_discount IS NOT NULL AND p_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  IF p_delivery_charges IS NOT NULL AND p_delivery_charges < 0 THEN
    RAISE EXCEPTION 'Delivery charges cannot be negative';
  END IF;

  v_clean_dispatch_note   := NULLIF(TRIM(p_dispatch_note), '');
  v_clean_delivery_method := NULLIF(TRIM(p_delivery_method), '');

  IF v_clean_dispatch_note IS NOT NULL AND LENGTH(v_clean_dispatch_note) > 500 THEN
    RAISE EXCEPTION 'Dispatch note cannot exceed 500 characters';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 3. Payload structural validation (upfront, before any DB work)
  -- ──────────────────────────────────────────────────────────────────────────

  -- 3a. Every line with an id must belong to this order
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS it
     WHERE it->>'id' IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.branch_order_items
          WHERE order_id = p_order_id
            AND id = (it->>'id')::uuid
            AND is_additional = FALSE
       )
  ) THEN
    RAISE EXCEPTION 'Payload contains an item id that does not belong to this order';
  END IF;

  -- 3b. No duplicate ids among requested lines
  IF EXISTS (
    SELECT 1 FROM (
      SELECT it->>'id' AS iid
        FROM jsonb_array_elements(p_items) AS it
       WHERE it->>'id' IS NOT NULL
    ) x
    GROUP BY iid HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Payload contains duplicate item ids';
  END IF;

  -- 3c. Lines without an id must have is_additional = true
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS it
     WHERE it->>'id' IS NULL
       AND COALESCE((it->>'is_additional')::boolean, FALSE) IS DISTINCT FROM TRUE
  ) THEN
    RAISE EXCEPTION 'Payload contains a line with no id and is_additional is not true';
  END IF;

  -- 3d. Count and cap additional lines
  SELECT COUNT(*) INTO v_extra_count
    FROM jsonb_array_elements(p_items) AS it
   WHERE it->>'id' IS NULL;

  IF v_extra_count > 50 THEN
    RAISE EXCEPTION 'Too many additional items (%). Maximum is 50 extra lines per dispatch.', v_extra_count;
  END IF;

  -- 3e. Duplicate item_code among additional lines (EXISTS pattern)
  IF EXISTS (
    SELECT 1 FROM (
      SELECT UPPER(TRIM(it->>'item_code')) AS code
        FROM jsonb_array_elements(p_items) AS it
       WHERE it->>'id' IS NULL
    ) x
    GROUP BY code HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate item_code found among additional lines in dispatch payload';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 4. Process requested (original) order items — match by id
  -- ──────────────────────────────────────────────────────────────────────────
  FOR v_item_record IN
    SELECT id, item_code, qty
      FROM public.branch_order_items
     WHERE order_id = p_order_id
       AND is_additional = FALSE
  LOOP
    v_matched := FALSE;

    FOR v_input_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      IF v_input_item->>'id' IS NOT NULL AND v_input_item->>'id' = v_item_record.id::text THEN
        -- Unit price required
        IF v_input_item->'unit_price' IS NULL OR jsonb_typeof(v_input_item->'unit_price') = 'null' THEN
          RAISE EXCEPTION 'Unit price is required for item "%" (%)', v_item_record.item_code, v_item_record.id;
        END IF;

        v_unit_price     := (v_input_item->>'unit_price')::numeric;
        v_dispatched_qty := COALESCE((v_input_item->>'dispatched_qty')::integer, 0);

        -- Per-line discount: extract raw fields without normalization yet
        v_disc_type  := NULLIF(TRIM(COALESCE(v_input_item->>'discount_type', '')), '');
        v_disc_value := COALESCE((v_input_item->>'discount_value')::numeric, 0);

        -- Reject negative discount_value always, regardless of type
        IF v_disc_value < 0 THEN
          RAISE EXCEPTION 'discount_value cannot be negative for item "%"', v_item_record.item_code;
        END IF;

        -- Strict type validation: if type is supplied it must be exactly 'percent' or 'flat'
        IF v_disc_type IS NOT NULL AND v_disc_type NOT IN ('percent', 'flat') THEN
          RAISE EXCEPTION 'Invalid discount_type "%" for item "%" — must be ''percent'' or ''flat''',
            v_disc_type, v_item_record.item_code;
        END IF;

        -- Value without type is not allowed
        IF v_disc_value > 0 AND v_disc_type IS NULL THEN
          RAISE EXCEPTION 'discount_value > 0 requires a discount_type for item "%"', v_item_record.item_code;
        END IF;

        v_matched := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_matched THEN
      RAISE EXCEPTION 'Item with id "%" (code: "%") is missing from dispatch payload', v_item_record.id, v_item_record.item_code;
    END IF;

    -- Quantity validation
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

    -- Stock check and deduct
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

      UPDATE public.items
         SET stock_qty = stock_qty - v_dispatched_qty
       WHERE id = v_src_id;
    END IF;

    -- Resolve per-line discount (type already validated above)
    v_gross := ROUND(v_dispatched_qty * v_unit_price, 2);

    IF v_disc_type = 'percent' THEN
      IF v_disc_value < 0 OR v_disc_value > 100 THEN
        RAISE EXCEPTION 'Percent discount must be between 0 and 100 for item "%"', v_item_record.item_code;
      END IF;
      v_disc_amount := ROUND(v_gross * v_disc_value / 100, 2);

    ELSIF v_disc_type = 'flat' THEN
      IF v_disc_value < 0 THEN
        RAISE EXCEPTION 'Flat discount cannot be negative for item "%"', v_item_record.item_code;
      END IF;
      IF v_disc_value > v_gross THEN
        RAISE EXCEPTION 'Flat discount (%) exceeds line gross (%) for item "%"',
          v_disc_value, v_gross, v_item_record.item_code;
      END IF;
      v_disc_amount := ROUND(v_disc_value, 2);

    ELSE
      -- No per-line discount: type is NULL and value is 0 (already validated)
      v_disc_amount := 0;
    END IF;

    v_line_total := v_gross - v_disc_amount;
    v_subtotal   := v_subtotal + v_line_total;

    UPDATE public.branch_order_items
       SET dispatched_qty   = v_dispatched_qty,
           unit_price       = v_unit_price,
           total_price      = v_line_total,
           discount_type    = v_disc_type,
           discount_value   = v_disc_value,
           discount_amount  = v_disc_amount,
           is_additional    = FALSE
     WHERE id = v_item_record.id;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 5. Process additional lines (no id in payload, is_additional = true)
  -- ──────────────────────────────────────────────────────────────────────────
  FOR v_add_input IN
    SELECT * FROM jsonb_array_elements(p_items) AS it
     WHERE it->>'id' IS NULL
       AND (it->>'is_additional')::boolean IS NOT FALSE
  LOOP
    v_add_code := UPPER(TRIM(COALESCE(v_add_input->>'item_code', '')));

    IF v_add_code = '' THEN
      RAISE EXCEPTION 'item_code is required for additional lines';
    END IF;

    -- Must not already exist as a requested line on this order
    IF EXISTS (
      SELECT 1 FROM public.branch_order_items
       WHERE order_id = p_order_id
         AND UPPER(TRIM(item_code)) = v_add_code
         AND is_additional = FALSE
    ) THEN
      RAISE EXCEPTION 'Item code "%" already exists as a requested line on this order; cannot add as additional', v_add_code;
    END IF;

    -- Must not already exist as an additional line (handles idempotency of payload)
    IF EXISTS (
      SELECT 1 FROM public.branch_order_items
       WHERE order_id = p_order_id
         AND UPPER(TRIM(item_code)) = v_add_code
         AND is_additional = TRUE
    ) THEN
      RAISE EXCEPTION 'Additional item code "%" is already present on this order', v_add_code;
    END IF;

    v_add_dqty := COALESCE((v_add_input->>'dispatched_qty')::integer, 0);
    IF v_add_dqty < 1 THEN
      RAISE EXCEPTION 'Additional item "%" must have dispatched_qty >= 1', v_add_code;
    END IF;

    -- Per-line discount for additional line: extract and validate strictly
    v_add_disc_type  := NULLIF(TRIM(COALESCE(v_add_input->>'discount_type', '')), '');
    v_add_disc_value := COALESCE((v_add_input->>'discount_value')::numeric, 0);

    -- Reject negative discount_value always, regardless of type
    IF v_add_disc_value < 0 THEN
      RAISE EXCEPTION 'discount_value cannot be negative for additional item "%"', v_add_code;
    END IF;

    IF v_add_disc_type IS NOT NULL AND v_add_disc_type NOT IN ('percent', 'flat') THEN
      RAISE EXCEPTION 'Invalid discount_type "%" for additional item "%" — must be ''percent'' or ''flat''',
        v_add_disc_type, v_add_code;
    END IF;

    IF v_add_disc_value > 0 AND v_add_disc_type IS NULL THEN
      RAISE EXCEPTION 'discount_value > 0 requires a discount_type for additional item "%"', v_add_code;
    END IF;

    -- Look up item in supplier's stock (name/unit from DB, never from client)
    SELECT id, name, unit, stock_qty
      INTO v_add_item_id, v_add_item_name, v_add_item_unit, v_add_item_stock
      FROM public.items
     WHERE tenant_id = p_to_tenant_id
       AND UPPER(code) = v_add_code
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Additional item "%" not found in supplying branch inventory', v_add_code;
    END IF;

    -- Unit price required
    IF v_add_input->'unit_price' IS NULL OR jsonb_typeof(v_add_input->'unit_price') = 'null' THEN
      RAISE EXCEPTION 'Unit price is required for additional item "%"', v_add_code;
    END IF;

    v_add_uprice := (v_add_input->>'unit_price')::numeric;
    IF v_add_uprice < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative for additional item "%"', v_add_code;
    END IF;

    -- Stock check
    IF v_add_item_stock < v_add_dqty THEN
      RAISE EXCEPTION 'Insufficient stock for additional item "%" (available: %, requested: %)',
        v_add_code, v_add_item_stock, v_add_dqty;
    END IF;

    -- Deduct stock
    UPDATE public.items
       SET stock_qty = stock_qty - v_add_dqty
     WHERE id = v_add_item_id;

    -- Resolve discount (type already validated above)
    v_add_gross := ROUND(v_add_dqty * v_add_uprice, 2);

    IF v_add_disc_type = 'percent' THEN
      IF v_add_disc_value < 0 OR v_add_disc_value > 100 THEN
        RAISE EXCEPTION 'Percent discount must be between 0 and 100 for additional item "%"', v_add_code;
      END IF;
      v_add_disc_amount := ROUND(v_add_gross * v_add_disc_value / 100, 2);

    ELSIF v_add_disc_type = 'flat' THEN
      IF v_add_disc_value < 0 THEN
        RAISE EXCEPTION 'Flat discount cannot be negative for additional item "%"', v_add_code;
      END IF;
      IF v_add_disc_value > v_add_gross THEN
        RAISE EXCEPTION 'Flat discount (%) exceeds line gross (%) for additional item "%"',
          v_add_disc_value, v_add_gross, v_add_code;
      END IF;
      v_add_disc_amount := ROUND(v_add_disc_value, 2);

    ELSE
      -- No per-line discount: type is NULL and value is 0 (already validated)
      v_add_disc_amount := 0;
    END IF;

    v_add_total := v_add_gross - v_add_disc_amount;

    -- Insert the additional line
    -- qty = 0 (no quantity was requested), dispatched_qty = actual amount sent
    INSERT INTO public.branch_order_items (
      order_id,
      item_code,
      item_name,
      unit,
      qty,
      dispatched_qty,
      unit_price,
      total_price,
      discount_type,
      discount_value,
      discount_amount,
      is_additional
    ) VALUES (
      p_order_id,
      v_add_code,
      v_add_item_name,    -- always from DB
      v_add_item_unit,    -- always from DB
      0,                  -- requested qty = 0 for additional lines
      v_add_dqty,
      v_add_uprice,
      v_add_total,
      v_add_disc_type,
      v_add_disc_value,
      v_add_disc_amount,
      TRUE
    );

    v_subtotal              := v_subtotal + v_add_total;
    v_total_dispatched_qty  := v_total_dispatched_qty + v_add_dqty;
    v_additional_count      := v_additional_count + 1;
    v_has_additional        := TRUE;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────────
  -- 6. Global validations
  -- ──────────────────────────────────────────────────────────────────────────
  IF v_total_dispatched_qty = 0 THEN
    RAISE EXCEPTION 'Cannot dispatch an order with 0 total quantity. Reject the order instead.';
  END IF;

  -- Note required when any requested line is short OR any additional line exists
  IF (v_has_short_dispatch OR v_has_additional) AND v_clean_dispatch_note IS NULL THEN
    RAISE EXCEPTION 'A dispatch note is required when any item is short or any additional item is added';
  END IF;

  -- Overall discount cannot exceed subtotal
  IF COALESCE(p_discount, 0) > v_subtotal THEN
    RAISE EXCEPTION 'Discount (%) cannot exceed subtotal (%)', p_discount, v_subtotal;
  END IF;

  v_net_total := ROUND((v_subtotal - COALESCE(p_discount, 0)) + COALESCE(p_delivery_charges, 0), 2);

  -- ──────────────────────────────────────────────────────────────────────────
  -- 7. Update branch_orders header
  -- ──────────────────────────────────────────────────────────────────────────
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

  -- ──────────────────────────────────────────────────────────────────────────
  -- 8. Insert notification event (+ additional_items_count)
  -- ──────────────────────────────────────────────────────────────────────────
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
      'order_no',               v_order.order_no,
      'dispatch_note',          v_clean_dispatch_note,
      'delivery_method',        v_clean_delivery_method,
      'transfer_value',         v_net_total,
      'subtotal',               v_subtotal,
      'has_short_dispatch',     v_has_short_dispatch,
      'additional_items_count', v_additional_count
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

COMMIT;

