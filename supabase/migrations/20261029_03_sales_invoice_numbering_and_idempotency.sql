-- Migration: 20261029_03_sales_invoice_numbering_and_idempotency.sql
-- Description:
--   1. Create tenant_invoice_counters table with strict RLS and service_role privileges.
--   2. Add idempotency_key (UUID) and request_fingerprint (TEXT) to public.invoices.
--   3. Add partial unique index uq_invoices_tenant_idempotency_key on (tenant_id, idempotency_key).
--   4. Add unique index uq_branch_orders_order_no on branch_orders(order_no) with pre-check.
--   5. Rebase create_invoice_atomic, create_special_invoice_atomic, and create_special_return_atomic
--      strictly onto LIVE database definitions:
--      - Server-side sequential number allocation per tenant (INV / RET).
--      - Non-truncating padding: CASE WHEN length(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END.
--      - Asia/Karachi date component (TO_CHAR(NOW() AT TIME ZONE 'Asia/Karachi', 'YYMMDD')).
--      - (NOW() AT TIME ZONE 'Asia/Karachi')::DATE used for all date defaults.
--      - Late allocation (after validations, just before INSERT).
--      - Widened request fingerprint check: raises IDEMPOTENCY_CONFLICT on payload mismatch for same key.
--      - Wrapper-level fingerprint conflict check in create_special_invoice_atomic.
--      - Pre-shift and pre-lookup idempotency re-checks in create_special_return_atomic.
--      - Preserves legacy branch when idempotency_key is null.
--      - Strict search_path and service_role execute permissions.

BEGIN;

-- ── 1. Create tenant_invoice_counters Table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_invoice_counters (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  current_seq BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_tenant_invoice_counters PRIMARY KEY (tenant_id, prefix)
);

ALTER TABLE public.tenant_invoice_counters ENABLE ROW LEVEL SECURITY;

-- Deny all client access; table is modified exclusively by SECURITY DEFINER RPCs running as postgres/service_role
REVOKE ALL ON TABLE public.tenant_invoice_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.tenant_invoice_counters TO service_role;

-- ── 2. Add Columns & Partial Unique Index to Invoices ────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_tenant_idempotency_key
  ON public.invoices (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 3. Branch Orders Unique Index (with duplicate pre-check) ─────────────────

DO $$
DECLARE
  v_dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT order_no
    FROM public.branch_orders
    WHERE order_no IS NOT NULL
    GROUP BY order_no
    HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index uq_branch_orders_order_no: % duplicate order_no found', v_dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_orders_order_no
  ON public.branch_orders (order_no)
  WHERE order_no IS NOT NULL;

-- ── 4. Update create_invoice_atomic ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_tokens jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_enforce          BOOLEAN := false;
  v_tenant_id        UUID;
  v_invoice_no       TEXT;
  v_client_id        UUID;
  v_client_name      TEXT;
  v_shift_id         UUID;
  v_date             DATE;
  v_subtotal         NUMERIC;
  v_discount         NUMERIC;
  v_delivery_charge  NUMERIC;
  v_remarks          TEXT;
  v_invoice_type     TEXT;
  v_net_total        NUMERIC;
  v_paid_amount      NUMERIC;
  v_due_amount       NUMERIC;
  v_payment_type     TEXT;
  v_cash_paid        NUMERIC;
  v_card_paid        NUMERIC;
  v_bank_paid        NUMERIC;
  v_others_paid      NUMERIC;
  v_status           TEXT;
  v_created_by       TEXT;

  v_invoice_id       UUID;
  v_item             JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_name        TEXT;
  v_item_qty         NUMERIC;
  v_curr_stock       NUMERIC;
  v_is_return        BOOLEAN;
  v_allow_neg_stock  BOOLEAN := true;

  v_token            JSONB;
  v_token_action     TEXT;
  v_token_qty        INTEGER;
  v_token_total      NUMERIC;
  v_brand_id         UUID;
  v_brand_name       TEXT;
  v_series_id        UUID;
  v_series_name      TEXT;
  v_unit_name        TEXT;
  v_client_val       NUMERIC;
  v_auth_val         NUMERIC;
  v_config_rec       RECORD;

  v_existing_id      UUID;
  v_client_bal       NUMERIC;
  v_cash_refunded    NUMERIC;
  v_store_credit     NUMERIC;
  v_result           JSONB;

  -- N4 validation helpers
  v_line_elem        JSONB;
  v_line_items_total NUMERIC := 0;

  -- B6 Idempotency & Numbering
  v_idempotency_key       UUID;
  v_payload_fingerprint   TEXT;
  v_existing_fingerprint  TEXT;
  v_seq                   BIGINT;
  v_seq_str               TEXT;
  v_karachi_date_str      TEXT;
  v_constraint_name       TEXT;
BEGIN
  -- Extract invoice fields
  v_tenant_id       := (p_invoice_data->>'tenant_id')::UUID;
  v_invoice_no      := TRIM(p_invoice_data->>'invoice_no');
  v_idempotency_key := NULLIF(p_invoice_data->>'idempotency_key', '')::UUID;
  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;
  v_client_name     := COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer');
  v_shift_id        := NULLIF(p_invoice_data->>'shift_id', '')::UUID;
  v_date            := COALESCE(NULLIF(p_invoice_data->>'date', '')::DATE, (NOW() AT TIME ZONE 'Asia/Karachi')::DATE);
  v_subtotal        := COALESCE((p_invoice_data->>'subtotal')::NUMERIC, 0);
  v_discount        := COALESCE((p_invoice_data->>'discount')::NUMERIC, 0);
  v_delivery_charge := COALESCE((p_invoice_data->>'delivery_charge')::NUMERIC, 0);
  v_remarks         := p_invoice_data->>'remarks';
  v_invoice_type    := COALESCE(p_invoice_data->>'invoice_type', 'sales');
  v_net_total       := COALESCE((p_invoice_data->>'net_total')::NUMERIC, 0);
  v_paid_amount     := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount      := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_payment_type    := COALESCE(p_invoice_data->>'payment_type', 'cash');
  v_cash_paid       := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid       := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid       := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid     := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);
  v_status          := COALESCE(p_invoice_data->>'status', 'completed');
  v_created_by      := p_invoice_data->>'created_by';
  v_is_return       := (v_invoice_type = 'return');

  SELECT COALESCE(allow_negative_stock, true) INTO v_allow_neg_stock
    FROM tenants
   WHERE id = v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF v_idempotency_key IS NULL AND (v_invoice_no IS NULL OR v_invoice_no = '') THEN
    RAISE EXCEPTION 'invoice_no is required when idempotency_key is not provided';
  END IF;

  -- ── B6 Widened Request Fingerprint Computation ──────────────────────────────
  v_payload_fingerprint := md5(
    COALESCE(v_client_id::TEXT, '') || '|' ||
    COALESCE(v_shift_id::TEXT, '') || '|' ||
    COALESCE(v_invoice_type, '') || '|' ||
    v_net_total::TEXT || '|' ||
    v_paid_amount::TEXT || '|' ||
    v_due_amount::TEXT || '|' ||
    v_cash_paid::TEXT || '|' ||
    v_card_paid::TEXT || '|' ||
    v_bank_paid::TEXT || '|' ||
    v_others_paid::TEXT || '|' ||
    v_discount::TEXT || '|' ||
    v_delivery_charge::TEXT || '|' ||
    p_items::TEXT || '|' ||
    COALESCE(p_tokens::TEXT, '[]')
  );

  -- ── N4 Financial Validations (1-Rupee Tolerance) ───────────────────────────
  IF ABS(v_net_total - (v_subtotal - v_discount + v_delivery_charge)) > 1.00 THEN
    IF v_enforce THEN
      RAISE EXCEPTION 'VALIDATION: net_total (%) does not match subtotal (%) - discount (%) + delivery_charge (%)',
        v_net_total, v_subtotal, v_discount, v_delivery_charge;
    ELSE
      BEGIN
        INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
        VALUES (v_tenant_id, COALESCE(v_created_by, 'system'), 'VALIDATION_WARNING', 'validation', 'invoice',
          jsonb_build_object('rule', 'net_total_formula', 'invoice_no', v_invoice_no, 'net_total', v_net_total, 'expected', v_subtotal - v_discount + v_delivery_charge));
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  IF ABS((v_paid_amount + v_due_amount) - v_net_total) > 1.00
     OR v_paid_amount > v_net_total + 1.00
     OR v_paid_amount < 0
     OR v_due_amount < 0
     OR v_net_total < 0 THEN
    IF v_enforce THEN
      RAISE EXCEPTION 'VALIDATION: paid_amount (%) + due_amount (%) does not match net_total (%) or amounts are invalid',
        v_paid_amount, v_due_amount, v_net_total;
    ELSE
      BEGIN
        INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
        VALUES (v_tenant_id, COALESCE(v_created_by, 'system'), 'VALIDATION_WARNING', 'validation', 'invoice',
          jsonb_build_object('rule', 'paid_plus_due_equals_net', 'invoice_no', v_invoice_no, 'paid_amount', v_paid_amount, 'due_amount', v_due_amount, 'net_total', v_net_total));
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  IF ABS((v_cash_paid + v_card_paid + v_bank_paid + v_others_paid) - v_paid_amount) > 1.00 THEN
    IF v_enforce THEN
      RAISE EXCEPTION 'VALIDATION: split payment sum (cash %, card %, bank %, others %) does not match paid_amount (%)',
        v_cash_paid, v_card_paid, v_bank_paid, v_others_paid, v_paid_amount;
    ELSE
      BEGIN
        INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
        VALUES (v_tenant_id, COALESCE(v_created_by, 'system'), 'VALIDATION_WARNING', 'validation', 'invoice',
          jsonb_build_object('rule', 'split_payment_sum', 'invoice_no', v_invoice_no, 'cash_paid', v_cash_paid, 'card_paid', v_card_paid, 'bank_paid', v_bank_paid, 'others_paid', v_others_paid, 'paid_amount', v_paid_amount));
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_line_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_line_items_total := v_line_items_total + COALESCE((v_line_elem->>'total_price')::NUMERIC, (v_line_elem->>'total')::NUMERIC, 0);
    END LOOP;

    IF ABS(v_subtotal - v_line_items_total) > 1.00 THEN
      IF v_enforce THEN
        RAISE EXCEPTION 'VALIDATION: subtotal (%) does not match sum of line item totals (%)',
          v_subtotal, v_line_items_total;
      ELSE
        BEGIN
          INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
          VALUES (v_tenant_id, COALESCE(v_created_by, 'system'), 'VALIDATION_WARNING', 'validation', 'invoice',
            jsonb_build_object('rule', 'line_items_subtotal', 'invoice_no', v_invoice_no, 'subtotal', v_subtotal, 'line_items_total', v_line_items_total));
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END IF;
  END IF;

  -- 0. Idempotency Check: Pre-insert check
  IF v_idempotency_key IS NOT NULL THEN
    SELECT id, request_fingerprint, row_to_json(invoices)::JSONB
      INTO v_existing_id, v_existing_fingerprint, v_result
      FROM invoices
     WHERE tenant_id = v_tenant_id AND idempotency_key = v_idempotency_key;

    IF FOUND THEN
      IF v_existing_fingerprint IS NOT NULL AND v_existing_fingerprint <> v_payload_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different cart payload', v_idempotency_key;
      END IF;
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'invoice', v_result
      );
    END IF;
  ELSE
    SELECT id INTO v_existing_id
      FROM invoices
     WHERE tenant_id = v_tenant_id
       AND invoice_no = v_invoice_no;

    IF FOUND THEN
      SELECT row_to_json(i)::JSONB INTO v_result
        FROM invoices i
       WHERE i.id = v_existing_id;
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'invoice', v_result
      );
    END IF;
  END IF;

  -- ── B6 Late Server Number Allocation (After Validations) ───────────────────
  IF v_idempotency_key IS NOT NULL THEN
    INSERT INTO public.tenant_invoice_counters (tenant_id, prefix, current_seq)
    VALUES (v_tenant_id, 'INV', 1)
    ON CONFLICT (tenant_id, prefix) DO UPDATE
      SET current_seq = tenant_invoice_counters.current_seq + 1,
          updated_at  = NOW()
    RETURNING current_seq INTO v_seq;

    v_karachi_date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Karachi', 'YYMMDD');
    v_seq_str := CASE WHEN LENGTH(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END;
    v_invoice_no := 'INV-' || v_karachi_date_str || '-' || v_seq_str;

    WHILE EXISTS (SELECT 1 FROM invoices WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no) LOOP
      v_seq := v_seq + 1;
      v_seq_str := CASE WHEN LENGTH(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END;
      v_invoice_no := 'INV-' || v_karachi_date_str || '-' || v_seq_str;
    END LOOP;

    UPDATE public.tenant_invoice_counters
       SET current_seq = v_seq, updated_at = NOW()
     WHERE tenant_id = v_tenant_id AND prefix = 'INV';
  END IF;

  -- 1. Insert Invoice (with concurrency collision protection via unique constraint)
  BEGIN
    INSERT INTO invoices (
      tenant_id, invoice_no, client_id, client_name, shift_id,
      date, subtotal, discount, delivery_charge, remarks,
      invoice_type, net_total, paid_amount, due_amount,
      payment_type, cash_paid, card_paid, bank_paid, others_paid,
      status, created_by, idempotency_key, request_fingerprint
    ) VALUES (
      v_tenant_id, v_invoice_no, v_client_id, v_client_name, v_shift_id,
      v_date, v_subtotal, v_discount, v_delivery_charge, v_remarks,
      v_invoice_type, v_net_total, v_paid_amount, v_due_amount,
      v_payment_type, v_cash_paid, v_card_paid, v_bank_paid, v_others_paid,
      v_status, v_created_by, v_idempotency_key, v_payload_fingerprint
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_idempotency_key IS NOT NULL AND v_constraint_name = 'uq_invoices_tenant_idempotency_key' THEN
      SELECT id, request_fingerprint, row_to_json(invoices)::JSONB 
        INTO v_existing_id, v_existing_fingerprint, v_result
        FROM invoices
       WHERE tenant_id = v_tenant_id AND idempotency_key = v_idempotency_key;

      IF v_existing_fingerprint IS NOT NULL AND v_existing_fingerprint <> v_payload_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different cart payload', v_idempotency_key;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'invoice', v_result
      );
    ELSIF v_idempotency_key IS NULL THEN
      SELECT row_to_json(i)::JSONB INTO v_result
        FROM invoices i
       WHERE i.tenant_id = v_tenant_id
         AND i.invoice_no = v_invoice_no;
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'invoice', v_result
      );
    ELSE
      RAISE;
    END IF;
  END;

  -- 2. Insert Invoice Items & Adjust Stock Atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_item->>'item_id', '')::UUID;
    v_item_code := TRIM(COALESCE(v_item->>'item_code', ''));
    v_item_qty  := COALESCE((v_item->>'qty')::NUMERIC, 1);
    v_item_name := COALESCE(v_item->>'item_name', 'Product');

    -- Insert invoice item row
    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, shade_code,
      pack_size, unit, qty, unit_price, discount,
      discount_percent, total_price, cost_price
    ) VALUES (
      v_invoice_id,
      v_item_id,
      v_item_code,
      v_item_name,
      COALESCE(v_item->>'shade_code', ''),
      COALESCE(v_item->>'pack_size', 'Can'),
      COALESCE(v_item->>'unit', 'PCS'),
      v_item_qty,
      COALESCE((v_item->>'unit_price')::NUMERIC, 0),
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE((v_item->>'discount_percent')::NUMERIC, 0),
      COALESCE((v_item->>'total_price')::NUMERIC, 0),
      COALESCE(
        NULLIF(v_item->>'cost_price', '')::NUMERIC,
        (SELECT it.cost_price FROM items it
          WHERE it.tenant_id = v_tenant_id
            AND (it.id = v_item_id
                 OR (v_item_id IS NULL AND v_item_code <> '' AND it.code = v_item_code))
          LIMIT 1)
      )
    );

    -- Stock adjustment with strict row-level locking & shortage check
    IF v_item_id IS NOT NULL OR v_item_code != '' THEN
      IF v_item_id IS NOT NULL THEN
        SELECT stock_qty, name INTO v_curr_stock, v_item_name
          FROM items
         WHERE id = v_item_id
           FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item with ID % not found', v_item_id;
        END IF;
      ELSIF v_item_code != '' THEN
        SELECT id, stock_qty, name INTO v_item_id, v_curr_stock, v_item_name
          FROM items
         WHERE tenant_id = v_tenant_id
           AND code = v_item_code
           FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item with code "%" not found', v_item_code;
        END IF;
      END IF;

      IF v_is_return THEN
        -- Returns: increase stock
        UPDATE items
           SET stock_qty = v_curr_stock + v_item_qty
         WHERE id = v_item_id;
      ELSE
        -- Sales: Check stock shortage only if negative stock is NOT allowed for this tenant
        IF NOT COALESCE(v_allow_neg_stock, true) AND v_curr_stock < v_item_qty THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (Code: %): Available %, requested %',
            v_item_name, v_item_code, v_curr_stock, v_item_qty;
        END IF;

        UPDATE items
           SET stock_qty = v_curr_stock - v_item_qty
         WHERE id = v_item_id;
      END IF;
    END IF;
  END LOOP;

  -- 3. Update Client Balance Atomically
  IF v_client_id IS NOT NULL THEN
    SELECT current_balance INTO v_client_bal
      FROM clients
     WHERE id = v_client_id
        FOR UPDATE;

    IF FOUND THEN
      IF v_is_return THEN
        v_cash_refunded := CASE
          WHEN v_cash_paid > 0 THEN v_cash_paid
          WHEN LOWER(v_payment_type) IN ('cash', 'refund') THEN v_paid_amount
          ELSE 0
        END;
        v_store_credit := GREATEST(0, v_net_total - v_cash_refunded);
        IF v_store_credit > 0 THEN
          UPDATE clients
             SET current_balance = current_balance - v_store_credit
           WHERE id = v_client_id;
        END IF;
      ELSIF v_due_amount > 0 THEN
        UPDATE clients
           SET current_balance = current_balance + v_due_amount
         WHERE id = v_client_id;
      END IF;
    END IF;
  END IF;

  -- 4. Process Token Transactions Atomically (Sales Only)
  IF NOT v_is_return AND p_tokens IS NOT NULL AND jsonb_array_length(p_tokens) > 0 THEN
    FOR v_token IN SELECT * FROM jsonb_array_elements(p_tokens)
    LOOP
      v_token_action := LOWER(COALESCE(v_token->>'token_action', 'keep'));
      v_token_qty    := COALESCE((v_token->>'quantity')::INTEGER, 1);
      v_brand_id     := NULLIF(v_token->>'brand_id', '')::UUID;
      v_brand_name   := TRIM(COALESCE(v_token->>'brand_name', ''));
      v_series_id    := NULLIF(v_token->>'series_id', '')::UUID;
      v_series_name  := TRIM(COALESCE(v_token->>'series_name', ''));
      v_unit_name    := TRIM(COALESCE(v_token->>'unit_name', ''));
      v_client_val   := COALESCE((v_token->>'token_value')::NUMERIC, 0);

      IF v_token_qty > 0 THEN
        IF v_brand_id IS NOT NULL THEN
          SELECT id, name INTO v_brand_id, v_brand_name
            FROM brands
           WHERE id = v_brand_id
             AND tenant_id = v_tenant_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand ID % not found for tenant', v_brand_id;
          END IF;
        ELSIF v_brand_name != '' THEN
          SELECT id, name INTO v_brand_id, v_brand_name
            FROM brands
           WHERE tenant_id = v_tenant_id
             AND LOWER(name) = LOWER(v_brand_name);
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand "%" not found for tenant', v_brand_name;
          END IF;
        ELSE
          RAISE EXCEPTION 'Brand is required for token processing';
        END IF;

        IF v_series_id IS NOT NULL THEN
          SELECT id, name INTO v_series_id, v_series_name
            FROM brand_series
           WHERE id = v_series_id
             AND brand_id = v_brand_id
             AND tenant_id = v_tenant_id
             AND status = 'active';
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Series ID % is invalid, inactive, or does not belong to brand %', v_series_id, v_brand_name;
          END IF;
        ELSIF v_series_name != '' THEN
          SELECT id, name INTO v_series_id, v_series_name
            FROM brand_series
           WHERE brand_id = v_brand_id
             AND tenant_id = v_tenant_id
             AND LOWER(name) = LOWER(v_series_name)
             AND status = 'active';
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Series "%" not found or inactive for brand %', v_series_name, v_brand_name;
          END IF;
        ELSE
          RAISE EXCEPTION 'Series is required for token processing';
        END IF;

        SELECT unit_name, is_enabled, token_value INTO v_config_rec
          FROM series_token_configs
         WHERE series_id = v_series_id
           AND tenant_id = v_tenant_id
           AND match_unit_to_config(v_unit_name, unit_name)
         LIMIT 1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Unit "%" is not configured in series "%"', v_unit_name, v_series_name;
        END IF;

        IF NOT v_config_rec.is_enabled THEN
          RAISE EXCEPTION 'Token is disabled for unit "%" in series "%"', v_unit_name, v_series_name;
        END IF;

        v_auth_val := (v_config_rec.token_value)::NUMERIC;
        IF v_auth_val <= 0 THEN
          RAISE EXCEPTION 'Authoritative token value must be greater than zero for series "%" unit "%"', v_series_name, v_unit_name;
        END IF;

        IF v_client_val > 0 AND v_client_val != v_auth_val THEN
          RAISE EXCEPTION 'Token value mismatch for "% - % - %": Client provided Rs. %, authoritative config is Rs. %',
            v_brand_name, v_series_name, v_unit_name, v_client_val, v_auth_val;
        END IF;

        v_token_total := v_auth_val * v_token_qty;

        IF v_token_action = 'remove' THEN
          INSERT INTO token_transactions (
            tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name,
            token_value, quantity, remaining_quantity, total_amount,
            usage_status, shift_id, created_by, notes
          ) VALUES (
            v_tenant_id,
            'shop_retained',
            v_invoice_id,
            v_client_id,
            v_client_name,
            v_brand_id,
            v_brand_name,
            v_series_id,
            v_series_name,
            v_config_rec.unit_name,
            v_auth_val,
            v_token_qty,
            v_token_qty,
            v_token_total,
            'available',
            v_shift_id,
            v_created_by,
            'Shop retained token at sale (Discount applied to sale price)'
          );
        ELSE
          INSERT INTO token_transactions (
            tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name,
            token_value, quantity, remaining_quantity, total_amount,
            usage_status, shift_id, created_by, notes
          ) VALUES (
            v_tenant_id,
            'issued',
            v_invoice_id,
            v_client_id,
            v_client_name,
            v_brand_id,
            v_brand_name,
            v_series_id,
            v_series_name,
            v_config_rec.unit_name,
            v_auth_val,
            v_token_qty,
            0,
            v_token_total,
            'n_a',
            v_shift_id,
            v_created_by,
            'Customer kept physical token with purchase'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 5. Audit Log Entry
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    v_tenant_id,
    v_client_name,
    CASE WHEN v_is_return THEN 'Credit Note Return' ELSE 'Sales Invoice Complete' END,
    CASE WHEN v_is_return THEN 'return' ELSE 'sale' END,
    'invoice',
    v_invoice_id,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'net_total', v_net_total,
      'paid_amount', v_paid_amount,
      'due_amount', v_due_amount,
      'items_count', jsonb_array_length(p_items)
    )
  );

  SELECT row_to_json(i)::JSONB INTO v_result
    FROM invoices i
   WHERE i.id = v_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice', v_result
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) TO service_role;

-- ── 5. Update create_special_invoice_atomic ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_special_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_receipt_snap jsonb, p_printed_by text, p_user_id uuid, p_tokens jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id        UUID;
  v_invoice_no       TEXT;
  v_invoice_type     TEXT;
  v_invoice_id       UUID;
  v_client_id        UUID;
  v_shift_id         UUID;
  v_master_total     NUMERIC := 0;
  v_printed_total    NUMERIC := 0;
  v_charged_total    NUMERIC := 0;
  v_subtotal_calc    NUMERIC := 0;
  v_discount_calc    NUMERIC := 0;
  v_delivery_calc    NUMERIC := 0;
  v_paid_amount      NUMERIC := 0;
  v_due_amount       NUMERIC := 0;
  v_cash_paid        NUMERIC := 0;
  v_card_paid        NUMERIC := 0;
  v_bank_paid        NUMERIC := 0;
  v_others_paid      NUMERIC := 0;
  v_payment_type     TEXT;
  v_item             JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_name        TEXT;
  v_catalog_name     TEXT;
  v_item_qty         NUMERIC;
  v_item_price       NUMERIC;
  v_item_discount    NUMERIC;
  v_item_total_price NUMERIC;
  v_line_expected    NUMERIC;
  v_master_price     NUMERIC;
  v_clean_items      JSONB := '[]'::jsonb;
  v_enriched_items   JSONB := '[]'::jsonb;
  v_enriched_snap    JSONB;
  v_stored_template  JSONB;
  v_user_rec         RECORD;
  v_inv_res          JSONB;
  v_existing_inv     RECORD;
  v_existing_log     RECORD;

  -- B6 / J1 Idempotency
  v_idempotency_key  UUID;
  v_special_fp       TEXT;
BEGIN
  v_tenant_id    := (p_invoice_data->>'tenant_id')::UUID;
  v_invoice_no   := TRIM(p_invoice_data->>'invoice_no');
  v_invoice_type := COALESCE(p_invoice_data->>'invoice_type', 'sales');
  v_idempotency_key := NULLIF(p_invoice_data->>'idempotency_key', '')::UUID;
  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF v_idempotency_key IS NULL AND (v_invoice_no IS NULL OR v_invoice_no = '') THEN
    RAISE EXCEPTION 'invoice_no is required when idempotency_key is not provided';
  END IF;

  -- ── J1 Special Invoice Request Fingerprint Computation ─────────────────────
  -- Must NOT include p_receipt_snap, invoice_no, or any timestamp
  v_special_fp := md5(
    COALESCE(v_client_id::TEXT, '') || '|' ||
    COALESCE(p_invoice_data->>'shift_id', '') || '|' ||
    COALESCE(p_invoice_data->>'payment_type', '') || '|' ||
    COALESCE(p_invoice_data->>'paid_amount', '') || '|' ||
    COALESCE(p_invoice_data->>'due_amount', '') || '|' ||
    COALESCE(p_invoice_data->>'cash_paid', '') || '|' ||
    COALESCE(p_invoice_data->>'card_paid', '') || '|' ||
    COALESCE(p_invoice_data->>'bank_paid', '') || '|' ||
    COALESCE(p_invoice_data->>'others_paid', '') || '|' ||
    COALESCE(p_invoice_data->>'delivery_charge', '') || '|' ||
    COALESCE(p_items::TEXT, '') || '|' ||
    COALESCE(p_tokens::TEXT, '[]')
  );

  v_shift_id := (p_invoice_data->>'shift_id')::UUID;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'Shift ID is required for special invoice';
  END IF;
  PERFORM 1 FROM shifts WHERE id = v_shift_id AND tenant_id = v_tenant_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift % does not exist, is closed, or belongs to another tenant', v_shift_id;
  END IF;

  -- J2: Ensure advisory lock call never receives NULL
  IF v_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':idemp:' || v_idempotency_key::text));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || COALESCE(v_invoice_no, '')));
  END IF;

  IF v_invoice_type <> 'sales' THEN
    RAISE EXCEPTION 'create_special_invoice_atomic only accepts sales invoices. Return invoices must use create_special_return_atomic.';
  END IF;

  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec FROM app_users WHERE id = p_user_id;

  IF NOT FOUND OR NOT v_user_rec.is_active THEN
    RAISE EXCEPTION 'User not found or inactive';
  END IF;
  IF v_user_rec.role <> 'staff' THEN
    RAISE EXCEPTION 'Special checkout is restricted to counter staff';
  END IF;
  IF NOT v_user_rec.can_use_special_receipt THEN
    RAISE EXCEPTION 'Special receipt permission denied or revoked';
  END IF;
  IF v_user_rec.tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'User does not belong to target branch';
  END IF;

  -- B6 / J1 Idempotency Pre-Check
  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_inv
      FROM invoices
     WHERE tenant_id = v_tenant_id AND idempotency_key = v_idempotency_key;

    IF FOUND THEN
      -- J1: verify fingerprint match
      IF v_existing_inv.request_fingerprint IS DISTINCT FROM v_special_fp THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: same idempotency_key with different payload';
      END IF;

      SELECT * INTO v_existing_log
        FROM special_print_log
       WHERE invoice_id = v_existing_inv.id AND event_type = 'sale'
       LIMIT 1;

      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'invoice_id', v_existing_inv.id,
        'invoice_no', v_existing_inv.invoice_no,
        'master_total', v_existing_log.master_total,
        'printed_total', v_existing_log.printed_total,
        'charged_total', v_existing_log.charged_total,
        'delivery_charge', v_existing_log.delivery_charge,
        'invoice', row_to_json(v_existing_inv)::jsonb,
        'snapshot', v_existing_log.receipt_snapshot,
        'template', v_existing_log.template_snapshot
      );
    END IF;
  ELSE
    SELECT * INTO v_existing_inv
      FROM invoices WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no;

    IF FOUND THEN
      IF v_existing_inv.printed_as <> 'special' THEN
        RAISE EXCEPTION 'Invoice number % already exists as a non-special invoice', v_invoice_no;
      END IF;
      SELECT * INTO v_existing_log
        FROM special_print_log
       WHERE invoice_id = v_existing_inv.id AND event_type = 'sale' LIMIT 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice number % exists as special but missing sales audit log', v_invoice_no;
      END IF;
      IF v_existing_log.user_id <> p_user_id THEN
        RAISE EXCEPTION 'Invoice number % was created by another user (%)', v_invoice_no, v_existing_log.printed_by;
      END IF;
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'invoice_id', v_existing_inv.id,
        'invoice_no', v_invoice_no,
        'master_total', v_existing_log.master_total,
        'printed_total', v_existing_log.printed_total,
        'charged_total', v_existing_log.charged_total,
        'delivery_charge', v_existing_log.delivery_charge,
        'invoice', row_to_json(v_existing_inv)::jsonb,
        'snapshot', v_existing_log.receipt_snapshot,
        'template', v_existing_log.template_snapshot
      );
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  IF COALESCE((p_invoice_data->>'discount')::NUMERIC, 0) > 0 THEN
    RAISE EXCEPTION 'Invoice-level discounts are not allowed on special invoices. Use per-line discounts only.';
  END IF;

  v_discount_calc := 0;
  v_delivery_calc := COALESCE((p_invoice_data->>'delivery_charge')::NUMERIC, 0);
  IF v_delivery_calc < 0 THEN
    RAISE EXCEPTION 'Delivery charge cannot be negative';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id          := NULLIF(v_item->>'item_id', '')::UUID;
    v_item_code        := TRIM(COALESCE(v_item->>'item_code', ''));
    v_item_qty         := (v_item->>'qty')::NUMERIC;
    v_item_price       := (v_item->>'unit_price')::NUMERIC;
    v_item_discount    := COALESCE((v_item->>'discount')::NUMERIC, 0);
    v_item_total_price := (v_item->>'total_price')::NUMERIC;
    v_item_name        := COALESCE(v_item->>'item_name', 'Item');

    IF v_item_qty IS NULL OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity (%) for item "%": must be greater than zero', v_item_qty, v_item_name;
    END IF;
    IF v_item_price IS NULL OR v_item_price < 0 THEN
      RAISE EXCEPTION 'Invalid unit price (%) for item "%": cannot be negative', v_item_price, v_item_name;
    END IF;
    IF v_item_discount < 0 OR v_item_discount > (v_item_qty * v_item_price) THEN
      RAISE EXCEPTION 'Invalid discount (%) for item "%": must be between 0 and line gross (%)',
        v_item_discount, v_item_name, (v_item_qty * v_item_price);
    END IF;
    v_line_expected := (v_item_qty * v_item_price) - v_item_discount;
    IF v_item_total_price IS NULL OR ABS(ROUND(v_item_total_price - v_line_expected, 2)) > 0.02 THEN
      RAISE EXCEPTION 'Total price mismatch for item "%": client sent %, calculated %',
        v_item_name, v_item_total_price, v_line_expected;
    END IF;

    IF v_item_id IS NOT NULL THEN
      SELECT retail_price, name INTO v_master_price, v_catalog_name
        FROM items WHERE id = v_item_id AND tenant_id = v_tenant_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with ID % not found for tenant', v_item_id;
      END IF;
    ELSIF v_item_code <> '' THEN
      SELECT id, retail_price, name INTO v_item_id, v_master_price, v_catalog_name
        FROM items WHERE tenant_id = v_tenant_id AND code = v_item_code;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with code "%" not found for tenant', v_item_code;
      END IF;
    ELSE
      RAISE EXCEPTION 'Item ID or code is required for each line item';
    END IF;

    v_master_total  := v_master_total  + (v_master_price * v_item_qty);
    v_printed_total := v_printed_total + (v_item_price * v_item_qty);
    v_subtotal_calc := v_subtotal_calc + v_item_total_price;

    v_clean_items := v_clean_items || jsonb_build_array(
      (v_item - 'receipt_name' - 'receipt_shade' - 'receipt_pack_size' - 'receipt_notes')
      || jsonb_build_object(
        'item_id', v_item_id, 'item_name', v_catalog_name,
        'unit_price', v_item_price, 'discount', v_item_discount,
        'total_price', v_item_total_price
      )
    );

    v_enriched_items := v_enriched_items || jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id, 'item_code', v_item_code,
        'item_name', v_catalog_name,
        'receipt_name', LEFT(COALESCE(v_item->>'receipt_name', v_catalog_name), 200),
        'receipt_shade', LEFT(COALESCE(v_item->>'receipt_shade', ''), 100),
        'receipt_pack_size', LEFT(COALESCE(v_item->>'receipt_pack_size', ''), 100),
        'receipt_notes', LEFT(COALESCE(v_item->>'receipt_notes', ''), 200),
        'qty', v_item_qty, 'unit_price', v_item_price,
        'pre_discount_rate', v_item_price, 'discount', v_item_discount,
        'total_price', v_item_total_price, 'catalog_name', v_catalog_name,
        'list_price', v_master_price,
        'master_price', v_master_price,
        'charged_rate', (v_item_total_price / v_item_qty),
        'line_discount', v_item_discount,
        'line_variance', (v_item_total_price - (v_master_price * v_item_qty))
      )
    );
  END LOOP;

  v_printed_total := v_printed_total + v_delivery_calc;
  v_charged_total := v_subtotal_calc + v_delivery_calc - v_discount_calc;

  v_paid_amount := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount  := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_cash_paid   := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid   := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid   := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);
  v_payment_type := COALESCE(p_invoice_data->>'payment_type', 'cash');

  IF ABS(ROUND((v_cash_paid + v_card_paid + v_bank_paid + v_others_paid) - v_paid_amount, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Tender breakdown does not equal paid_amount within 0.02 tolerance';
  END IF;
  IF ABS(ROUND((v_paid_amount + v_due_amount) - v_charged_total, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Paid amount (%) + due amount (%) does not equal charged total (%) within 0.02 tolerance',
      v_paid_amount, v_due_amount, v_charged_total;
  END IF;
  IF v_due_amount > 0 AND v_client_id IS NULL THEN
    RAISE EXCEPTION 'Credit sales with balance due require a registered customer account';
  END IF;

  v_inv_res := public.create_invoice_atomic(
    p_invoice_data || jsonb_build_object(
      'subtotal', v_subtotal_calc,
      'discount', v_discount_calc,
      'delivery_charge', v_delivery_calc,
      'net_total', v_charged_total,
      'paid_amount', v_paid_amount,
      'due_amount', v_due_amount
    ),
    v_clean_items,
    p_tokens
  );

  v_invoice_id := COALESCE((v_inv_res->>'invoice_id')::UUID, (v_inv_res->'invoice'->>'id')::UUID);
  v_invoice_no := COALESCE(v_inv_res->'invoice'->>'invoice_no', v_invoice_no);

  -- J1: Handle inner duplicate response without double logging
  IF COALESCE((v_inv_res->>'is_duplicate')::BOOLEAN, false) THEN
    SELECT * INTO v_existing_log
      FROM special_print_log WHERE invoice_id = v_invoice_id AND event_type = 'sale' LIMIT 1;
    SELECT * INTO v_existing_inv
      FROM invoices WHERE id = v_invoice_id;

    RETURN jsonb_build_object(
      'success', true, 'is_duplicate', true,
      'invoice_id', v_invoice_id, 'invoice_no', v_invoice_no,
      'master_total', COALESCE(v_existing_log.master_total, v_master_total),
      'printed_total', COALESCE(v_existing_log.printed_total, v_printed_total),
      'charged_total', COALESCE(v_existing_log.charged_total, v_charged_total),
      'delivery_charge', COALESCE(v_existing_log.delivery_charge, v_delivery_calc),
      'invoice', COALESCE(row_to_json(v_existing_inv)::jsonb, v_inv_res->'invoice'),
      'snapshot', v_existing_log.receipt_snapshot,
      'template', v_existing_log.template_snapshot
    );
  END IF;

  -- J1: Update printed_as and set request_fingerprint to the wrapper's fingerprint
  UPDATE invoices
     SET printed_as = 'special',
         request_fingerprint = v_special_fp
   WHERE id = v_invoice_id;

  SELECT template_json INTO v_stored_template
    FROM special_receipt_templates WHERE tenant_id = v_tenant_id;

  IF NOT FOUND OR v_stored_template IS NULL THEN
    v_stored_template := '{"paper_size":"thermal_80","header":{"showShopName":false,"customShopName":"","showAddress":false,"customAddress":"","showPhone":false,"customPhone":"","showLogo":false,"logoUrl":""},"invoiceInfo":{"showCashier":false},"footer":{"showPoweredBy":false,"poweredByText":""},"tokenClaimSlip":{"enabled":false}}'::jsonb;
  END IF;

  v_enriched_snap := jsonb_build_object(
    'invoice_no', v_invoice_no,
    'client_name', COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer'),
    'date', COALESCE(p_invoice_data->>'date', (NOW() AT TIME ZONE 'Asia/Karachi')::DATE::TEXT),
    'payment_type', v_payment_type,
    'paid_amount', v_paid_amount,
    'due_amount', v_due_amount,
    'header_note', LEFT(COALESCE(p_receipt_snap->>'header_note', ''), 500),
    'footer_note', LEFT(COALESCE(p_receipt_snap->>'footer_note', ''), 500),
    'delivery_charge', v_delivery_calc,
    'items', v_enriched_items,
    'master_total', v_master_total,
    'printed_total', v_printed_total,
    'charged_total', v_charged_total,
    'total_variance', ((v_charged_total - v_delivery_calc) - v_master_total)
  );

  BEGIN
    INSERT INTO special_print_log (
      tenant_id, invoice_id, invoice_no, printed_by, user_id,
      event_type, printed_at, master_total, printed_total, charged_total,
      delivery_charge, receipt_snapshot, template_snapshot
    ) VALUES (
      v_tenant_id, v_invoice_id, v_invoice_no, p_printed_by, p_user_id,
      'sale', NOW(), v_master_total, v_printed_total, v_charged_total,
      v_delivery_calc, v_enriched_snap, v_stored_template
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing_log
      FROM special_print_log WHERE invoice_id = v_invoice_id AND event_type = 'sale' LIMIT 1;
    RETURN jsonb_build_object(
      'success', true, 'is_duplicate', true,
      'invoice_id', v_invoice_id, 'invoice_no', v_invoice_no,
      'master_total', v_existing_log.master_total,
      'printed_total', v_existing_log.printed_total,
      'charged_total', v_existing_log.charged_total,
      'delivery_charge', v_existing_log.delivery_charge,
      'invoice', v_inv_res->'invoice',
      'snapshot', v_existing_log.receipt_snapshot,
      'template', v_existing_log.template_snapshot
    );
  END;

  RETURN jsonb_build_object(
    'success', true, 'is_duplicate', false,
    'invoice_id', v_invoice_id, 'invoice_no', v_invoice_no,
    'master_total', v_master_total, 'printed_total', v_printed_total,
    'charged_total', v_charged_total, 'delivery_charge', v_delivery_calc,
    'invoice', v_inv_res->'invoice',
    'snapshot', v_enriched_snap, 'template', v_stored_template
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_special_invoice_atomic(jsonb, jsonb, jsonb, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_special_invoice_atomic(jsonb, jsonb, jsonb, text, uuid, jsonb) TO service_role;

-- ── 6. Update create_special_return_atomic ───────────────────────────────────
-- Drop the existing 7-argument function on live so no ambiguous overload remains
DROP FUNCTION IF EXISTS public.create_special_return_atomic(uuid, jsonb, uuid, text, uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.create_special_return_atomic(
  p_original_invoice_id uuid,
  p_items jsonb,
  p_user_id uuid,
  p_printed_by text,
  p_shift_id uuid,
  p_cash_refunded numeric DEFAULT 0,
  p_card_refunded numeric DEFAULT 0,
  p_idempotency_key uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_rec               RECORD;
  v_orig_invoice           RECORD;
  v_orig_item              RECORD;
  v_item                   RECORD;
  v_item_qty               NUMERIC;
  v_line_unit_price        NUMERIC;
  v_line_net               NUMERIC;
  v_prior_returned_qty     NUMERIC := 0;
  v_prior_refunded_amount  NUMERIC := 0;
  v_remaining_qty          NUMERIC := 0;
  v_return_subtotal        NUMERIC := 0;
  v_return_net             NUMERIC := 0;
  v_return_inv_id          UUID    := gen_random_uuid();
  v_new_invoice_no         TEXT;
  v_cashier_refund         NUMERIC := 0;
  v_expected_payout        NUMERIC := 0;
  v_payment_type           TEXT;
  v_shift_id               UUID;
  v_cash_paid              NUMERIC := 0;
  v_card_paid              NUMERIC := 0;
  v_paid_amount            NUMERIC := 0;
  v_snap_items             JSONB   := '[]'::jsonb;
  v_curr_stock             NUMERIC;
  v_prior_offsets          NUMERIC := 0;
  v_orig_due_remaining     NUMERIC := 0;
  v_client_bal             NUMERIC := 0;
  v_khata_offset           NUMERIC := 0;

  -- B6 Idempotency & Numbering
  v_payload_fingerprint    TEXT;
  v_existing_id            UUID;
  v_existing_fingerprint   TEXT;
  v_existing_log           RECORD;
  v_result                 JSONB;
  v_seq                    BIGINT;
  v_seq_str                TEXT;
  v_karachi_date_str       TEXT;
  v_constraint_name        TEXT;
BEGIN
  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec FROM app_users WHERE id = p_user_id;
  IF NOT FOUND OR NOT v_user_rec.is_active THEN
    RAISE EXCEPTION 'User not found or inactive';
  END IF;
  IF v_user_rec.role <> 'staff' THEN
    RAISE EXCEPTION 'Special returns are restricted to authorized counter staff';
  END IF;
  IF NOT v_user_rec.can_use_special_receipt THEN
    RAISE EXCEPTION 'Special receipt permission denied or revoked';
  END IF;

  -- ── B6 Widened Fingerprint for Special Return ──────────────────────────────
  v_payload_fingerprint := md5(
    p_original_invoice_id::TEXT || '|' ||
    p_items::TEXT || '|' ||
    COALESCE(p_cash_refunded, 0)::TEXT || '|' ||
    COALESCE(p_card_refunded, 0)::TEXT
  );

  -- ── J3 Pre-Lock Idempotency Check (BEFORE Shift Validation) ────────────────
  -- Genuine retry after a shift has closed still returns is_duplicate
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, request_fingerprint, row_to_json(invoices)::JSONB
      INTO v_existing_id, v_existing_fingerprint, v_result
      FROM invoices
     WHERE tenant_id = v_user_rec.tenant_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing_fingerprint IS NOT NULL AND v_existing_fingerprint <> v_payload_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different return payload', p_idempotency_key;
      END IF;
      SELECT * INTO v_existing_log FROM special_print_log
       WHERE invoice_id = v_existing_id AND event_type = 'return' LIMIT 1;
      RETURN jsonb_build_object(
        'success',           true,
        'is_duplicate',      true,
        'return_invoice_id', v_existing_id,
        'return_invoice_no', v_result->>'invoice_no',
        'refund_total',      COALESCE(v_existing_log.charged_total, (v_result->>'net_total')::NUMERIC),
        'khata_offset',      COALESCE((v_existing_log.receipt_snapshot->>'khata_offset')::NUMERIC, 0),
        'cashier_refund',    COALESCE((v_result->>'paid_amount')::NUMERIC, 0),
        'print_receipt',     false,
        'invoice',           v_result,
        'snapshot',          v_existing_log.receipt_snapshot,
        'template',          v_existing_log.template_snapshot
      );
    END IF;
  END IF;

  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'Shift ID is required for special return';
  END IF;
  SELECT id INTO v_shift_id FROM shifts
   WHERE id = p_shift_id AND tenant_id = v_user_rec.tenant_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift % does not exist, is closed, or belongs to another tenant', p_shift_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_rec.tenant_id::text || ':return:' || p_original_invoice_id::text));

  -- ── J4 Post-Lock Idempotency Re-Check (BEFORE Original Invoice Lookup) ──────
  -- Genuine retry after original invoice was cancelled still returns is_duplicate
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, request_fingerprint, row_to_json(invoices)::JSONB
      INTO v_existing_id, v_existing_fingerprint, v_result
      FROM invoices
     WHERE tenant_id = v_user_rec.tenant_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF v_existing_fingerprint IS NOT NULL AND v_existing_fingerprint <> v_payload_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different return payload', p_idempotency_key;
      END IF;
      SELECT * INTO v_existing_log FROM special_print_log
       WHERE invoice_id = v_existing_id AND event_type = 'return' LIMIT 1;
      RETURN jsonb_build_object(
        'success',           true,
        'is_duplicate',      true,
        'return_invoice_id', v_existing_id,
        'return_invoice_no', v_result->>'invoice_no',
        'refund_total',      COALESCE(v_existing_log.charged_total, (v_result->>'net_total')::NUMERIC),
        'khata_offset',      COALESCE((v_existing_log.receipt_snapshot->>'khata_offset')::NUMERIC, 0),
        'cashier_refund',    COALESCE((v_result->>'paid_amount')::NUMERIC, 0),
        'print_receipt',     false,
        'invoice',           v_result,
        'snapshot',          v_existing_log.receipt_snapshot,
        'template',          v_existing_log.template_snapshot
      );
    END IF;
  END IF;

  SELECT * INTO v_orig_invoice FROM invoices
   WHERE id = p_original_invoice_id
     AND tenant_id = v_user_rec.tenant_id
     AND printed_as = 'special'
     AND invoice_type = 'sales'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original invoice % not found, not sales type, or not special', p_original_invoice_id;
  END IF;
  IF v_orig_invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot process return for cancelled special invoice %', v_orig_invoice.invoice_no;
  END IF;

  IF COALESCE(v_orig_invoice.discount, 0) > 0 THEN
    RAISE EXCEPTION 'Original invoice % has an invoice-level discount (%) which makes per-line refund calculation ambiguous. Manual review required.',
      v_orig_invoice.invoice_no, v_orig_invoice.discount;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one return line item is required';
  END IF;

  v_cash_paid := COALESCE(p_cash_refunded, 0);
  v_card_paid := COALESCE(p_card_refunded, 0);
  IF v_cash_paid < 0 OR v_card_paid < 0 THEN
    RAISE EXCEPTION 'Refund amounts cannot be negative (cash: %, card: %)', v_cash_paid, v_card_paid;
  END IF;

  -- PASS 1: Aggregate, validate, cents rule
  FOR v_item IN
    SELECT (elem->>'original_item_id')::UUID AS orig_id,
           SUM((elem->>'qty')::NUMERIC) AS total_req_qty
      FROM jsonb_array_elements(p_items) elem
     GROUP BY (elem->>'original_item_id')::UUID
  LOOP
    IF v_item.orig_id IS NULL OR v_item.total_req_qty <= 0 THEN
      RAISE EXCEPTION 'Each return item must have a valid original_item_id and positive qty';
    END IF;
    SELECT * INTO v_orig_item FROM invoice_items
     WHERE id = v_item.orig_id AND invoice_id = p_original_invoice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Original line item % not found in invoice %', v_item.orig_id, v_orig_invoice.invoice_no;
    END IF;

    SELECT COALESCE(SUM(ii.qty), 0), COALESCE(SUM(ii.total_price), 0)
      INTO v_prior_returned_qty, v_prior_refunded_amount
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.original_invoice_id = p_original_invoice_id
       AND i.invoice_type = 'return'
       AND i.status <> 'cancelled'
       AND ii.original_invoice_item_id = v_item.orig_id;

    v_remaining_qty := v_orig_item.qty - v_prior_returned_qty;
    IF v_item.total_req_qty > v_remaining_qty THEN
      RAISE EXCEPTION 'Return qty (%) exceeds remaining returnable qty (%) for item "%"',
        v_item.total_req_qty, v_remaining_qty, v_orig_item.item_name;
    END IF;

    IF v_item.total_req_qty = v_remaining_qty THEN
      v_line_net := v_orig_item.total_price - v_prior_refunded_amount;
    ELSE
      v_line_net := ROUND(v_item.total_req_qty * (v_orig_item.total_price / v_orig_item.qty), 2);
    END IF;

    v_line_unit_price := ROUND(v_line_net / v_item.total_req_qty, 2);
    v_return_subtotal := v_return_subtotal + v_line_net;
    v_return_net      := v_return_net      + v_line_net;

    v_snap_items := v_snap_items || jsonb_build_array(jsonb_build_object(
      'original_item_id', v_item.orig_id,
      'item_id',          v_orig_item.item_id,
      'item_name',        v_orig_item.item_name,
      'shade_code',       v_orig_item.shade_code,
      'qty',              v_item.total_req_qty,
      'unit_price',       v_line_unit_price,
      'line_total',       v_line_net
    ));
  END LOOP;

  -- Khata offset
  IF v_orig_invoice.client_id IS NOT NULL THEN
    SELECT COALESCE(SUM(net_total - paid_amount), 0) INTO v_prior_offsets
      FROM invoices
     WHERE original_invoice_id = p_original_invoice_id
       AND invoice_type = 'return' AND status <> 'cancelled';
    v_orig_due_remaining := GREATEST(0, COALESCE(v_orig_invoice.due_amount, 0) - v_prior_offsets);
    SELECT current_balance INTO v_client_bal FROM clients
     WHERE id = v_orig_invoice.client_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client % not found for invoice %', v_orig_invoice.client_id, v_orig_invoice.invoice_no;
    END IF;
    v_khata_offset := GREATEST(0, LEAST(v_return_net, v_orig_due_remaining, v_client_bal));
  ELSE
    v_khata_offset := 0;
  END IF;

  v_cashier_refund  := v_cash_paid + v_card_paid;
  v_expected_payout := v_return_net - v_khata_offset;
  IF ABS(ROUND(v_cashier_refund - v_expected_payout, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Cashier refund (cash % + card % = %) must equal return net (%) minus khata offset (%) = % within 0.02 tolerance',
      v_cash_paid, v_card_paid, v_cashier_refund, v_return_net, v_khata_offset, v_expected_payout;
  END IF;

  v_paid_amount := v_cash_paid + v_card_paid;
  IF v_cash_paid > 0 AND v_card_paid > 0 THEN v_payment_type := 'mixed';
  ELSIF v_card_paid > 0 THEN v_payment_type := 'card';
  ELSIF v_cash_paid > 0 THEN v_payment_type := 'cash';
  ELSE v_payment_type := 'others';
  END IF;

  -- ── B6 Sequential Return Number Allocation (Prefix 'RET') ───────────────────
  INSERT INTO public.tenant_invoice_counters (tenant_id, prefix, current_seq)
  VALUES (v_user_rec.tenant_id, 'RET', 1)
  ON CONFLICT (tenant_id, prefix) DO UPDATE
    SET current_seq = tenant_invoice_counters.current_seq + 1,
        updated_at  = NOW()
  RETURNING current_seq INTO v_seq;

  v_karachi_date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Karachi', 'YYMMDD');
  v_seq_str := CASE WHEN LENGTH(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END;
  v_new_invoice_no := 'RET-' || v_orig_invoice.invoice_no || '-' || v_karachi_date_str || '-' || v_seq_str;

  WHILE EXISTS (SELECT 1 FROM invoices WHERE tenant_id = v_user_rec.tenant_id AND invoice_no = v_new_invoice_no) LOOP
    v_seq := v_seq + 1;
    v_seq_str := CASE WHEN LENGTH(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END;
    v_new_invoice_no := 'RET-' || v_orig_invoice.invoice_no || '-' || v_karachi_date_str || '-' || v_seq_str;
  END LOOP;

  UPDATE public.tenant_invoice_counters
     SET current_seq = v_seq, updated_at = NOW()
   WHERE tenant_id = v_user_rec.tenant_id AND prefix = 'RET';

  -- ── Insert Return Invoice with Idempotency Unique Violation Catch ───────────
  BEGIN
    INSERT INTO invoices (
      id, tenant_id, invoice_no, invoice_type, status, printed_as,
      original_invoice_id, client_id, client_name,
      date, shift_id, created_by,
      subtotal, discount, delivery_charge, net_total,
      paid_amount, due_amount, cash_paid, card_paid, bank_paid, others_paid,
      payment_type, remarks, idempotency_key, request_fingerprint
    ) VALUES (
      v_return_inv_id, v_user_rec.tenant_id, v_new_invoice_no,
      'return', 'completed', 'special',
      p_original_invoice_id, v_orig_invoice.client_id, v_orig_invoice.client_name,
      (NOW() AT TIME ZONE 'Asia/Karachi')::DATE, v_shift_id, p_printed_by,
      ROUND(v_return_subtotal, 2), 0, 0, ROUND(v_return_net, 2),
      ROUND(v_paid_amount, 2), 0,
      v_cash_paid, v_card_paid, 0, 0,
      v_payment_type,
      'Special Return for Invoice #' || v_orig_invoice.invoice_no,
      p_idempotency_key, v_payload_fingerprint
    );
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF p_idempotency_key IS NOT NULL AND v_constraint_name = 'uq_invoices_tenant_idempotency_key' THEN
      SELECT id, request_fingerprint, row_to_json(invoices)::JSONB 
        INTO v_existing_id, v_existing_fingerprint, v_result
        FROM invoices WHERE tenant_id = v_user_rec.tenant_id AND idempotency_key = p_idempotency_key;

      IF v_existing_fingerprint IS NOT NULL AND v_existing_fingerprint <> v_payload_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different return payload', p_idempotency_key;
      END IF;

      SELECT * INTO v_existing_log FROM special_print_log
       WHERE invoice_id = v_existing_id AND event_type = 'return' LIMIT 1;
      RETURN jsonb_build_object(
        'success',           true,
        'is_duplicate',      true,
        'return_invoice_id', v_existing_id,
        'return_invoice_no', v_result->>'invoice_no',
        'refund_total',      COALESCE(v_existing_log.charged_total, (v_result->>'net_total')::NUMERIC),
        'khata_offset',      COALESCE((v_existing_log.receipt_snapshot->>'khata_offset')::NUMERIC, 0),
        'cashier_refund',    COALESCE((v_result->>'paid_amount')::NUMERIC, 0),
        'print_receipt',     false,
        'invoice',           v_result,
        'snapshot',          v_existing_log.receipt_snapshot,
        'template',          v_existing_log.template_snapshot
      );
    ELSE
      RAISE;
    END IF;
  END;

  -- PASS 2: insert items & replenish stock
  FOR v_item IN
    SELECT (elem->>'original_item_id')::UUID AS orig_id,
           SUM((elem->>'qty')::NUMERIC) AS total_req_qty
      FROM jsonb_array_elements(p_items) elem
     GROUP BY (elem->>'original_item_id')::UUID
  LOOP
    SELECT * INTO v_orig_item FROM invoice_items
     WHERE id = v_item.orig_id AND invoice_id = p_original_invoice_id;

    SELECT COALESCE(SUM(ii.qty), 0), COALESCE(SUM(ii.total_price), 0)
      INTO v_prior_returned_qty, v_prior_refunded_amount
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.original_invoice_id = p_original_invoice_id
       AND i.invoice_type = 'return' AND i.status <> 'cancelled'
       AND ii.original_invoice_item_id = v_item.orig_id;

    v_remaining_qty := v_orig_item.qty - v_prior_returned_qty;
    IF v_item.total_req_qty = v_remaining_qty THEN
      v_line_net := v_orig_item.total_price - v_prior_refunded_amount;
    ELSE
      v_line_net := ROUND(v_item.total_req_qty * (v_orig_item.total_price / v_orig_item.qty), 2);
    END IF;
    v_line_unit_price := ROUND(v_line_net / v_item.total_req_qty, 2);

    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, unit, shade_code, pack_size,
      qty, unit_price, discount, discount_percent, total_price, original_invoice_item_id
    ) VALUES (
      v_return_inv_id, v_orig_item.item_id, v_orig_item.item_code, v_orig_item.item_name,
      v_orig_item.unit, v_orig_item.shade_code, v_orig_item.pack_size,
      v_item.total_req_qty, ROUND(v_line_unit_price, 2), 0, 0, ROUND(v_line_net, 2),
      v_item.orig_id
    );

    IF v_orig_item.item_id IS NULL THEN
      RAISE EXCEPTION 'Cannot replenish stock: item_id is NULL for line item "%"', v_orig_item.item_name;
    END IF;
    SELECT stock_qty INTO v_curr_stock FROM items
     WHERE id = v_orig_item.item_id AND tenant_id = v_user_rec.tenant_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found for tenant % during stock replenishment', v_orig_item.item_id, v_user_rec.tenant_id;
    END IF;
    UPDATE items SET stock_qty = v_curr_stock + v_item.total_req_qty
     WHERE id = v_orig_item.item_id AND tenant_id = v_user_rec.tenant_id;
  END LOOP;

  IF v_khata_offset > 0 AND v_orig_invoice.client_id IS NOT NULL THEN
    UPDATE clients SET current_balance = current_balance - ROUND(v_khata_offset, 2)
     WHERE id = v_orig_invoice.client_id;
  END IF;

  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, printed_at, master_total, printed_total, charged_total,
    delivery_charge, receipt_snapshot, template_snapshot, original_invoice_id
  ) VALUES (
    v_user_rec.tenant_id, v_return_inv_id, v_new_invoice_no, p_printed_by, p_user_id,
    'return', NOW(), 0, 0, ROUND(v_return_net, 2), 0,
    jsonb_build_object(
      'items', v_snap_items,
      'original_invoice_id', p_original_invoice_id,
      'original_invoice_no', v_orig_invoice.invoice_no,
      'refund_total', ROUND(v_return_net, 2),
      'khata_offset', ROUND(v_khata_offset, 2),
      'cash_paid', ROUND(v_cash_paid, 2),
      'card_paid', ROUND(v_card_paid, 2),
      'payment_type', v_payment_type
    ),
    '{}'::jsonb,
    p_original_invoice_id
  );

  INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, entity_id, details)
  VALUES (
    v_user_rec.tenant_id,
    COALESCE(v_orig_invoice.client_name, 'Walk-in Customer'),
    'Credit Note Return', 'return', 'invoice', v_return_inv_id,
    jsonb_build_object(
      'invoice_no', v_new_invoice_no,
      'original_invoice_no', v_orig_invoice.invoice_no,
      'net_total', ROUND(v_return_net, 2),
      'paid_amount', ROUND(v_paid_amount, 2),
      'due_amount', 0,
      'khata_offset', ROUND(v_khata_offset, 2),
      'cash_paid', ROUND(v_cash_paid, 2),
      'card_paid', ROUND(v_card_paid, 2),
      'payment_type', v_payment_type,
      'items_count', jsonb_array_length(p_items)
    )
  );

  SELECT row_to_json(i)::JSONB INTO v_result FROM invoices i WHERE i.id = v_return_inv_id;

  RETURN jsonb_build_object(
    'success',           true,
    'return_invoice_id', v_return_inv_id,
    'return_invoice_no', v_new_invoice_no,
    'refund_total',      ROUND(v_return_net, 2),
    'khata_offset',      ROUND(v_khata_offset, 2),
    'cashier_refund',    ROUND(v_cashier_refund, 2),
    'print_receipt',     false,
    'invoice',           v_result
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_special_return_atomic(uuid, jsonb, uuid, text, uuid, numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_special_return_atomic(uuid, jsonb, uuid, text, uuid, numeric, numeric, uuid) TO service_role;

COMMIT;
