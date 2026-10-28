-- Migration: 20261029_01_branch_orders_lifecycle_and_pricing.sql
-- Purpose: Inter-branch order lifecycle management, pricing, partial dispatch,
--          atomic receipt with ledger vouchers, rejection tracking, and event notifications.

BEGIN;

-- ============================================================================
-- 0. Drop old function signatures to prevent stale overloads
-- ============================================================================
-- Dropping the 2-argument signature of process_branch_dispatch_atomic (from 20261004_03_atomic_branch_transfer.sql)
-- so the old GREATEST(0, stock - qty) clamp cannot be invoked.
DROP FUNCTION IF EXISTS public.process_branch_dispatch_atomic(UUID, UUID);

-- Dropping previous receive signature to ensure clean replacement
DROP FUNCTION IF EXISTS public.process_branch_receive_atomic(UUID, UUID, UUID);

-- ============================================================================
-- 1. Alter branch_orders table
-- ============================================================================
ALTER TABLE public.branch_orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charges numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS dispatch_note text,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS received_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;

-- Note: transfer_value already exists on branch_orders (numeric)

-- ============================================================================
-- 2. Alter branch_order_items table
-- ============================================================================
ALTER TABLE public.branch_order_items
  ADD COLUMN IF NOT EXISTS dispatched_qty integer,
  ADD COLUMN IF NOT EXISTS unit_price numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_price numeric(14,2) DEFAULT 0;

-- ============================================================================
-- 3. Create branch_order_events table for lifecycle notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branch_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.branch_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  notify_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_order_events_notify 
  ON public.branch_order_events(notify_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_order_events_order_id 
  ON public.branch_order_events(order_id);

-- Keep RLS enabled with no public/anon policies (service_role bypasses RLS)
ALTER TABLE public.branch_order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenants can view their notifications" ON public.branch_order_events;

-- ============================================================================
-- 4. process_branch_accept_atomic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_branch_accept_atomic(
  p_order_id     UUID,
  p_to_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order
    FROM public.branch_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.to_tenant_id <> p_to_tenant_id THEN
    RAISE EXCEPTION 'Forbidden: Only the supplying branch may accept this order';
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order cannot be accepted from current status "%"', v_order.status;
  END IF;

  UPDATE public.branch_orders
     SET status = 'accepted',
         accepted_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.branch_order_events (
    order_id,
    event_type,
    notify_tenant_id,
    data,
    created_at
  ) VALUES (
    p_order_id,
    'accepted',
    v_order.from_tenant_id,
    jsonb_build_object(
      'order_no', v_order.order_no,
      'status', 'accepted'
    ),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_accept_atomic(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_accept_atomic(UUID, UUID) TO service_role;

-- ============================================================================
-- 5. process_branch_dispatch_atomic
-- ============================================================================
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
      'order_no', v_order.order_no,
      'dispatch_note', v_clean_dispatch_note,
      'delivery_method', v_clean_delivery_method,
      'transfer_value', v_net_total,
      'subtotal', v_subtotal,
      'has_short_dispatch', v_has_short_dispatch
    ),
    now()
  );

  RETURN v_net_total;
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_dispatch_atomic(UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(UUID, UUID, JSONB, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;

-- ============================================================================
-- 6. process_branch_receive_atomic
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
  v_order            RECORD;
  v_item             RECORD;
  v_dest_id          UUID;
  v_dest_qty         NUMERIC;
  v_orig             RECORD;
  v_effective_qty    INTEGER;
  v_from_name        TEXT;
  v_to_name          TEXT;
  v_voucher_amount   NUMERIC(14,2);
  v_is_counter_order BOOLEAN;
  v_recv_party_code  TEXT;
  v_supp_party_code  TEXT;
  v_item_count       INTEGER := 0;
  v_cost_price       NUMERIC;
  v_retail_price     NUMERIC;
  v_unit_cost        NUMERIC;
  v_voucher_no_in    TEXT;
  v_voucher_no_out   TEXT;
BEGIN
  -- 1. Lock and validate order
  SELECT * INTO v_order
    FROM public.branch_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Enforce authorization first
  IF v_order.from_tenant_id <> p_from_tenant_id THEN
    RAISE EXCEPTION 'Forbidden: Only the requesting branch may confirm receipt';
  END IF;

  IF v_order.to_tenant_id <> p_to_tenant_id THEN
    RAISE EXCEPTION 'Supplying tenant mismatch';
  END IF;

  -- Idempotency check: if already received, exit safely (after tenant verification)
  IF v_order.status = 'received' THEN
    RETURN;
  END IF;

  IF v_order.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Order must be in "dispatched" status to receive (current: "%")', v_order.status;
  END IF;

  -- 2. Add stock to requesting branch based on dispatched_qty
  FOR v_item IN
    SELECT item_code, COALESCE(dispatched_qty, qty) AS receive_qty
      FROM public.branch_order_items
     WHERE order_id = p_order_id
  LOOP
    v_effective_qty := v_item.receive_qty;
    v_item_count    := v_item_count + 1;

    IF v_effective_qty > 0 THEN
      SELECT id, stock_qty
        INTO v_dest_id, v_dest_qty
        FROM public.items
       WHERE tenant_id = p_from_tenant_id
         AND UPPER(code) = UPPER(TRIM(v_item.item_code))
       FOR UPDATE;

      IF FOUND THEN
        UPDATE public.items
           SET stock_qty = stock_qty + v_effective_qty
         WHERE id = v_dest_id;
      ELSE
        -- Copy master item record from supplying branch
        SELECT * INTO v_orig
          FROM public.items
         WHERE tenant_id = p_to_tenant_id
           AND UPPER(code) = UPPER(TRIM(v_item.item_code))
         LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item "%" does not exist in supplying branch; cannot create item in receiving branch', v_item.item_code;
        END IF;

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
          v_effective_qty,
          COALESCE(v_orig.min_stock_alert, 5),
          v_orig.brand_id,
          v_orig.series_id,
          v_orig.brand
        );
      END IF;
    END IF;
  END LOOP;

  -- 3. Resolve tenant names for ledger entries
  SELECT name INTO v_from_name FROM public.tenants WHERE id = p_from_tenant_id;
  SELECT name INTO v_to_name   FROM public.tenants WHERE id = p_to_tenant_id;

  v_voucher_amount := COALESCE(v_order.transfer_value, 0);

  -- Legacy fallback: Run ONLY for legacy orders (dispatched before lifecycle tracking,
  -- identified by items having dispatched_qty IS NULL, or order dispatched_at IS NULL)
  -- AND where no transfer_value was stored at dispatch time (v_voucher_amount <= 0).
  -- If a legacy order already has transfer_value > 0, use it as is (preserving historical pricing).
  -- Never recompute for orders dispatched through the new RPC, even if transfer_value is 0.
  IF (v_order.dispatched_at IS NULL OR EXISTS (
    SELECT 1 FROM public.branch_order_items WHERE order_id = p_order_id AND dispatched_qty IS NULL
  )) AND v_voucher_amount <= 0 THEN
    v_voucher_amount := 0;
    FOR v_item IN
      SELECT item_code, COALESCE(dispatched_qty, qty) AS receive_qty
        FROM public.branch_order_items
       WHERE order_id = p_order_id
    LOOP
      SELECT cost_price, retail_price
        INTO v_cost_price, v_retail_price
        FROM public.items
       WHERE tenant_id = p_to_tenant_id
         AND UPPER(code) = UPPER(TRIM(v_item.item_code))
       LIMIT 1;

      v_unit_cost := COALESCE(NULLIF(v_cost_price, 0), v_retail_price * 0.85, 0);
      v_voucher_amount := v_voucher_amount + (v_unit_cost * v_item.receive_qty);
    END LOOP;

    -- Only persist the value when the fallback actually computed one
    IF v_voucher_amount > 0 THEN
      UPDATE public.branch_orders
         SET transfer_value = v_voucher_amount
       WHERE id = p_order_id;
    END IF;
  END IF;

  v_is_counter_order := (p_from_tenant_id = p_to_tenant_id);

  IF v_is_counter_order THEN
    v_recv_party_code := 'counter_' || COALESCE(v_order.target_counter, 'main');
    v_supp_party_code := 'counter_' || COALESCE(v_order.from_counter, 'main');
    -- Unique constraint safety: If both vouchers are inserted into the same tenant (counter order),
    -- differentiate voucher_no so uq_vouchers_tenant_voucher_no (tenant_id, voucher_no) does not collide.
    v_voucher_no_in  := 'IBT-IN-' || v_order.order_no;
    v_voucher_no_out := 'IBT-OUT-' || v_order.order_no;
  ELSE
    v_recv_party_code := NULL;
    v_supp_party_code := NULL;
    v_voucher_no_in   := 'IBT-' || v_order.order_no;
    v_voucher_no_out  := 'IBT-' || v_order.order_no;
  END IF;

  -- 4. Create Inter-Branch Vouchers idempotently (check existence by tenant_id & reference_no & voucher_type)
  -- Voucher for Requesting Branch (Debit / Stock In / Payable)
  IF NOT EXISTS (
    SELECT 1 FROM public.vouchers
     WHERE tenant_id = p_from_tenant_id
       AND reference_no = v_order.order_no
       AND voucher_type = 'branch_transfer_in'
  ) THEN
    INSERT INTO public.vouchers (
      tenant_id,
      voucher_no,
      voucher_type,
      party_type,
      party_id,
      party_code,
      party_name,
      amount,
      payment_mode,
      reference_no,
      remarks,
      date
    ) VALUES (
      p_from_tenant_id,
      v_voucher_no_in,
      'branch_transfer_in',
      'branch',
      p_to_tenant_id,
      v_recv_party_code,
      COALESCE(v_to_name, 'Supplying Branch'),
      v_voucher_amount,
      'Transfer on Account',
      v_order.order_no,
      'Stock Received from ' || COALESCE(v_to_name, 'Branch') || ' | ' || v_item_count || ' item(s) | ' || v_order.order_no,
      CURRENT_DATE
    );
  END IF;

  -- Voucher for Supplying Branch (Credit / Stock Out / Receivable)
  IF NOT EXISTS (
    SELECT 1 FROM public.vouchers
     WHERE tenant_id = p_to_tenant_id
       AND reference_no = v_order.order_no
       AND voucher_type = 'branch_transfer_out'
  ) THEN
    INSERT INTO public.vouchers (
      tenant_id,
      voucher_no,
      voucher_type,
      party_type,
      party_id,
      party_code,
      party_name,
      amount,
      payment_mode,
      reference_no,
      remarks,
      date
    ) VALUES (
      p_to_tenant_id,
      v_voucher_no_out,
      'branch_transfer_out',
      'branch',
      p_from_tenant_id,
      v_supp_party_code,
      COALESCE(v_from_name, 'Requesting Branch'),
      v_voucher_amount,
      'Transfer on Account',
      v_order.order_no,
      'Stock Dispatched to ' || COALESCE(v_from_name, 'Branch') || ' | ' || v_item_count || ' item(s) | ' || v_order.order_no,
      CURRENT_DATE
    );
  END IF;

  -- 5. Update branch_orders status
  UPDATE public.branch_orders
     SET status = 'received',
         received_at = now()
   WHERE id = p_order_id;

  -- 6. Insert notification event
  INSERT INTO public.branch_order_events (
    order_id,
    event_type,
    notify_tenant_id,
    data,
    created_at
  ) VALUES (
    p_order_id,
    'received',
    p_to_tenant_id,
    jsonb_build_object(
      'order_no', v_order.order_no,
      'received_by', COALESCE(v_from_name, 'Requesting Branch'),
      'transfer_value', v_voucher_amount
    ),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_receive_atomic(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_receive_atomic(UUID, UUID, UUID) TO service_role;

-- ============================================================================
-- 7. process_branch_reject_atomic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_branch_reject_atomic(
  p_order_id       UUID,
  p_to_tenant_id   UUID,
  p_reject_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order               RECORD;
  v_clean_reject_reason TEXT;
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
    RAISE EXCEPTION 'Forbidden: Only the supplying branch may reject this order';
  END IF;

  IF v_order.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'Order cannot be rejected from current status "%"', v_order.status;
  END IF;

  v_clean_reject_reason := NULLIF(TRIM(p_reject_reason), '');
  IF v_clean_reject_reason IS NULL THEN
    RAISE EXCEPTION 'A non-empty rejection reason is required';
  END IF;

  IF LENGTH(v_clean_reject_reason) > 500 THEN
    RAISE EXCEPTION 'Rejection reason cannot exceed 500 characters';
  END IF;

  -- 2. Update order
  UPDATE public.branch_orders
     SET status        = 'rejected',
         reject_reason = v_clean_reject_reason,
         rejected_at   = now()
   WHERE id = p_order_id;

  -- 3. Insert notification event
  INSERT INTO public.branch_order_events (
    order_id,
    event_type,
    notify_tenant_id,
    data,
    created_at
  ) VALUES (
    p_order_id,
    'rejected',
    v_order.from_tenant_id,
    jsonb_build_object(
      'order_no', v_order.order_no,
      'reject_reason', v_clean_reject_reason
    ),
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_branch_reject_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_reject_atomic(UUID, UUID, TEXT) TO service_role;

COMMIT;
