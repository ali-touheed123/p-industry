-- Migration: 20261028_04_allow_negative_stock_system.sql
-- Purpose: Enable per-branch negative stock selling and fix purchase deficit arithmetic
--
-- 1. Add allow_negative_stock column to tenants (defaults to true for retail branches)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN tenants.allow_negative_stock IS 'Master switch: If true, POS counters can sell products below 0 (negative stock). If false, strict zero-floor validation applies.';

-- 2. get_inventory_stats: safeguard store valuation against negative units
CREATE OR REPLACE FUNCTION public.get_inventory_stats(p_tenant_id uuid)
RETURNS TABLE(total_skus integer, total_stock_units numeric, total_valuation numeric, low_stock_count integer)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    count(*)::int as total_skus,
    coalesce(sum(stock_qty), 0)::numeric as total_stock_units,
    coalesce(sum(GREATEST(0, stock_qty) * cost_price), 0)::numeric as total_valuation,
    count(*) filter (where stock_qty <= coalesce(min_stock_alert, 5))::int as low_stock_count
  FROM items
  WHERE tenant_id = p_tenant_id;
$$;

-- 3. cancel_purchase_atomic: exact delta reversal without 0 clamp
 Migration: 20261005_03_cancel_purchase_atomic.sql
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



-- 4. create_invoice_atomic: respect allow_negative_stock policy
CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_invoice_data JSONB,
  p_items        JSONB,
  p_tokens       JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
BEGIN
  -- Extract invoice fields
  v_tenant_id       := (p_invoice_data->>'tenant_id')::UUID;
  v_invoice_no      := TRIM(p_invoice_data->>'invoice_no');
  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;
  v_client_name     := COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer');
  v_shift_id        := NULLIF(p_invoice_data->>'shift_id', '')::UUID;
  v_date            := COALESCE(NULLIF(p_invoice_data->>'date', '')::DATE, CURRENT_DATE);
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
  IF v_invoice_no IS NULL OR v_invoice_no = '' THEN
    RAISE EXCEPTION 'invoice_no is required';
  END IF;

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

  -- 0. Idempotency Check: Pre-insert check for existing invoice_no
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

  -- 1. Insert Invoice (with concurrency collision protection via unique constraint)
  BEGIN
    INSERT INTO invoices (
      tenant_id, invoice_no, client_id, client_name, shift_id,
      date, subtotal, discount, delivery_charge, remarks,
      invoice_type, net_total, paid_amount, due_amount,
      payment_type, cash_paid, card_paid, bank_paid, others_paid,
      status, created_by
    ) VALUES (
      v_tenant_id, v_invoice_no, v_client_id, v_client_name, v_shift_id,
      v_date, v_subtotal, v_discount, v_delivery_charge, v_remarks,
      v_invoice_type, v_net_total, v_paid_amount, v_due_amount,
      v_payment_type, v_cash_paid, v_card_paid, v_bank_paid, v_others_paid,
      v_status, v_created_by
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent duplicate request safely caught by DB constraint
    SELECT row_to_json(i)::JSONB INTO v_result
      FROM invoices i
     WHERE i.tenant_id = v_tenant_id
       AND i.invoice_no = v_invoice_no;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice', v_result
    );
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
  -- Returns do not issue tokens or create stockpile entries
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
        -- Authoritative Brand Verification
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

        -- Authoritative Series Verification
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

        -- Authoritative Unit and Token Configuration Verification
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

        -- Verify client-supplied token value does not diverge from authoritative config
        IF v_client_val > 0 AND v_client_val != v_auth_val THEN
          RAISE EXCEPTION 'Token value mismatch for "% - % - %": Client provided Rs. %, authoritative config is Rs. %',
            v_brand_name, v_series_name, v_unit_name, v_client_val, v_auth_val;
        END IF;

        v_token_total := v_auth_val * v_token_qty;

        IF v_token_action = 'remove' THEN
          -- Remove Token: Shop Retained stockpile entry (enters safe, available for settlement)
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
            v_config_rec.unit_name, -- store exact configured unit identity
            v_auth_val,
            v_token_qty,
            v_token_qty, -- remaining_quantity starts equal to quantity
            v_token_total,
            'available',
            v_shift_id,
            v_created_by,
            'Shop retained token at sale (Discount applied to sale price)'
          );
        ELSE
          -- Keep Token: Customer Token Activity Issued log only (NO stockpile entry)
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
            v_config_rec.unit_name, -- store exact configured unit identity
            v_auth_val,
            v_token_qty,
            0, -- remaining_quantity is 0 (not in shop stockpile)
            v_token_total,
            'n_a', -- not available in shop stockpile
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

  -- Fetch complete invoice record to return
  SELECT row_to_json(i)::JSONB INTO v_result
    FROM invoices i
   WHERE i.id = v_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice', v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) TO service_role;

-- 5. update_invoice_atomic: respect allow_negative_stock policy
CREATE OR REPLACE FUNCTION public.update_invoice_atomic(
  p_invoice_id   uuid,
  p_tenant_id    uuid,
  p_invoice_data jsonb,
  p_items        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_id        UUID;
  v_client_name      TEXT;
  v_subtotal         NUMERIC;
  v_discount         NUMERIC;
  v_delivery_charge  NUMERIC;
  v_remarks          TEXT;
  v_net_total        NUMERIC;
  v_paid_amount      NUMERIC;
  v_due_amount       NUMERIC;
  v_payment_type     TEXT;
  v_cash_paid        NUMERIC;
  v_card_paid        NUMERIC;
  v_bank_paid        NUMERIC;
  v_others_paid      NUMERIC;
  v_status           TEXT;
  v_invoice_type     TEXT;
  v_old_invoice      RECORD;
  v_old_item         RECORD;
  v_is_old_return    BOOLEAN;
  v_is_new_return    BOOLEAN;
  v_revert_delta     NUMERIC;
  v_new_item         JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_qty         NUMERIC;
  v_apply_delta      NUMERIC;
  v_code_item_id     UUID;
  v_old_due          NUMERIC;
  v_new_due          NUMERIC;
  v_due_diff         NUMERIC;
  v_client_bal       NUMERIC;
  v_updated_invoice  JSONB;
BEGIN
  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'invoice_id is required'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id is required'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one line item is required'; END IF;

  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;
  v_client_name     := COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer');
  v_subtotal        := COALESCE((p_invoice_data->>'subtotal')::NUMERIC, 0);
  v_discount        := COALESCE((p_invoice_data->>'discount')::NUMERIC, 0);
  v_delivery_charge := COALESCE((p_invoice_data->>'delivery_charge')::NUMERIC, 0);
  v_remarks         := p_invoice_data->>'remarks';
  v_net_total       := COALESCE((p_invoice_data->>'net_total')::NUMERIC, 0);
  v_paid_amount     := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount      := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_payment_type    := COALESCE(p_invoice_data->>'payment_type', 'cash');
  v_cash_paid       := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid       := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid       := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid     := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);
  v_status          := COALESCE(p_invoice_data->>'status', 'completed');
  v_invoice_type    := COALESCE(p_invoice_data->>'invoice_type', 'sales');
  v_is_new_return   := (v_invoice_type = 'return');

  SELECT COALESCE(allow_negative_stock, true) INTO v_allow_neg_stock FROM tenants WHERE id = p_tenant_id;

  SELECT * INTO v_old_invoice FROM invoices
   WHERE id = p_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or access denied'; END IF;

  -- D1 Enforcement: Reject edits to special invoices
  IF v_old_invoice.printed_as = 'special' THEN
    RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
  END IF;

  v_is_old_return := (v_old_invoice.invoice_type = 'return');
  v_old_due       := COALESCE(v_old_invoice.due_amount, 0);

  FOR v_old_item IN SELECT item_id, item_code, qty FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    v_revert_delta := CASE WHEN v_is_old_return THEN -COALESCE(v_old_item.qty,0) ELSE COALESCE(v_old_item.qty,0) END;
    IF v_old_item.item_id IS NOT NULL THEN
      UPDATE items SET stock_qty = COALESCE(stock_qty, 0) + v_revert_delta
       WHERE id = v_old_item.item_id AND tenant_id = p_tenant_id;
    ELSIF v_old_item.item_code IS NOT NULL AND trim(v_old_item.item_code) <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_old_item.item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = COALESCE(stock_qty, 0) + v_revert_delta
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

  FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_new_item->>'item_id', '')::UUID;
    v_item_code := TRIM(COALESCE(v_new_item->>'item_code', ''));
    v_item_qty  := COALESCE((v_new_item->>'qty')::NUMERIC, 1);
    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, shade_code,
      pack_size, unit, qty, unit_price, discount, discount_percent, total_price
    ) VALUES (
      p_invoice_id, v_item_id, v_item_code,
      COALESCE(v_new_item->>'item_name', ''),
      COALESCE(v_new_item->>'shade_code', ''),
      COALESCE(v_new_item->>'pack_size', 'Can'),
      COALESCE(v_new_item->>'unit', 'PCS'),
      v_item_qty,
      COALESCE((v_new_item->>'unit_price')::NUMERIC, 0),
      COALESCE((v_new_item->>'discount')::NUMERIC, 0),
      COALESCE((v_new_item->>'discount_percent')::NUMERIC, 0),
      COALESCE((v_new_item->>'total_price')::NUMERIC, 0)
    );
    v_apply_delta := CASE WHEN v_is_new_return THEN v_item_qty ELSE -v_item_qty END;
    IF v_item_id IS NOT NULL THEN
      UPDATE items SET stock_qty = COALESCE(stock_qty, 0) + v_apply_delta
       WHERE id = v_item_id AND tenant_id = p_tenant_id;
    ELSIF v_item_code <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = COALESCE(stock_qty, 0) + v_apply_delta
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  v_new_due  := v_due_amount;
  v_due_diff := v_new_due - v_old_due;
  IF v_client_id IS NOT NULL AND v_due_diff <> 0 THEN
    SELECT current_balance INTO v_client_bal FROM clients
     WHERE id = v_client_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF FOUND THEN
      UPDATE clients SET current_balance = COALESCE(v_client_bal,0) + v_due_diff
       WHERE id = v_client_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  UPDATE invoices SET
    client_id = v_client_id, client_name = v_client_name,
    subtotal = v_subtotal, discount = v_discount, delivery_charge = v_delivery_charge,
    remarks = v_remarks, net_total = v_net_total, paid_amount = v_paid_amount,
    due_amount = v_due_amount, payment_type = v_payment_type,
    cash_paid = v_cash_paid, card_paid = v_card_paid,
    bank_paid = v_bank_paid, others_paid = v_others_paid, status = v_status
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  SELECT row_to_json(i)::JSONB INTO v_updated_invoice FROM invoices i WHERE i.id = p_invoice_id;

  INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, entity_id, details)
  VALUES (
    p_tenant_id, v_client_name, 'Sales Invoice Updated (Atomic)', 'update', 'invoice', p_invoice_id,
    jsonb_build_object(
      'invoice_no', v_old_invoice.invoice_no, 'previous_net', v_old_invoice.net_total,
      'new_net', v_net_total, 'items_count', jsonb_array_length(p_items), 'due_diff', v_due_diff
    )
  );

  RETURN jsonb_build_object('success', true, 'invoice', v_updated_invoice);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_invoice_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic TO service_role;

-- 6. create_purchase_atomic: exact partial purchase deficit arithmetic
CREATE OR REPLACE FUNCTION public.create_purchase_atomic(
  p_tenant_id          UUID,
  p_purchase_data      JSONB,
  p_items              JSONB,
  p_token_allocations  JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_enforce            BOOLEAN := false;
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
  v_shift_id           UUID;

  v_is_return          BOOLEAN;
  v_tokens_amount      NUMERIC := 0;
  v_purchase_id        UUID;
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

  -- Token allocation tracking
  v_token_ids          UUID[];
  v_locked_rows        token_transactions[] := '{}';
  v_alloc_qtys         INTEGER[] := '{}';
  v_rec                token_transactions;
  v_rec_qty            INTEGER;
  v_elem               JSONB;
  i                    INTEGER;

  -- Parameterized cursor selecting composite tuple 't' directly in deterministic ascending order
  c_alloc_tokens CURSOR (cp_token_ids UUID[]) FOR
    SELECT t,
           (a.elem->>'quantity')::INTEGER AS requested_qty
      FROM token_transactions t
      JOIN jsonb_array_elements(p_token_allocations) a(elem)
        ON (a.elem->>'token_id')::UUID = t.id
     WHERE t.id = ANY(cp_token_ids)
       AND t.tenant_id = p_tenant_id
     ORDER BY t.id ASC
       FOR UPDATE OF t;

  v_cursor_row RECORD;
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
  v_shift_id      := NULLIF(p_purchase_data->>'shift_id', '')::UUID;
  v_is_return     := (v_purchase_type = 'return');

  -- ── 1. Validate required fields ────────────────────────────────────────────
  IF v_purchase_no IS NULL OR trim(v_purchase_no) = '' THEN
    RAISE EXCEPTION 'purchase_no is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF p_purchase_data IS NULL OR jsonb_typeof(p_purchase_data) <> 'object' THEN
    RAISE EXCEPTION 'p_purchase_data must be a valid JSONB object';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a non-null JSONB array';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Disallow token application on purchase returns
  IF v_is_return AND p_token_allocations IS NOT NULL AND jsonb_array_length(p_token_allocations) > 0 THEN
    RAISE EXCEPTION 'Stockpile tokens cannot be applied to purchase returns';
  END IF;

  -- ── N4 Financial Validations (1-Rupee Tolerance) ───────────────────────────
  IF ABS(v_due_amount - GREATEST(0, v_net_total - v_paid_amount)) > 1.00
     OR v_net_total < 0
     OR v_paid_amount < 0
     OR v_due_amount < 0 THEN
    IF v_enforce THEN
      RAISE EXCEPTION 'VALIDATION: due_amount (%) must equal GREATEST(0, net_total (%) - paid_amount (%)) with non-negative amounts',
        v_due_amount, v_net_total, v_paid_amount;
    ELSE
      BEGIN
        INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
        VALUES (
          p_tenant_id,
          COALESCE(v_created_by, 'system'),
          'VALIDATION_WARNING',
          'validation',
          'purchase',
          jsonb_build_object(
            'rule', 'purchase_due_amount_balance',
            'purchase_no', v_purchase_no,
            'net_total', v_net_total,
            'paid_amount', v_paid_amount,
            'due_amount', v_due_amount,
            'expected_due', GREATEST(0, v_net_total - v_paid_amount)
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- ── 2. Validate token allocations structure & bounds ───────────────────────
  IF p_token_allocations IS NOT NULL THEN
    IF jsonb_typeof(p_token_allocations) = 'null' THEN
      RAISE EXCEPTION 'p_token_allocations cannot be JSON null; must be a JSON array or SQL NULL';
    END IF;
    IF jsonb_typeof(p_token_allocations) <> 'array' THEN
      RAISE EXCEPTION 'p_token_allocations must be a JSONB array';
    END IF;

    IF jsonb_array_length(p_token_allocations) > 0 THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(p_token_allocations)
      LOOP
        IF jsonb_typeof(v_elem) <> 'object' THEN
          RAISE EXCEPTION 'Allocation array elements must be JSON objects';
        END IF;
        IF NOT (v_elem ? 'token_id') OR NOT (v_elem ? 'quantity') THEN
          RAISE EXCEPTION 'Allocation elements must contain both "token_id" and "quantity"';
        END IF;
        IF jsonb_typeof(v_elem->'token_id') = 'null' OR jsonb_typeof(v_elem->'quantity') = 'null' THEN
          RAISE EXCEPTION 'Allocation "token_id" and "quantity" values cannot be null';
        END IF;
        IF jsonb_typeof(v_elem->'token_id') <> 'string' THEN
          RAISE EXCEPTION 'Allocation token_id must be a JSON string: %', v_elem->'token_id';
        END IF;
        IF (v_elem->>'token_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          RAISE EXCEPTION 'Invalid UUID format for token_id: %', v_elem->>'token_id';
        END IF;
        IF jsonb_typeof(v_elem->'quantity') <> 'number' THEN
          RAISE EXCEPTION 'Allocation quantity must be a JSON number: %', v_elem->'quantity';
        END IF;
        IF (v_elem->>'quantity') !~ '^[0-9]+$' THEN
          RAISE EXCEPTION 'Allocation quantity must be an unsigned integer: %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC <= 0 THEN
          RAISE EXCEPTION 'Allocation quantity must be strictly greater than zero: %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC > 2147483647 THEN
          RAISE EXCEPTION 'Allocation quantity exceeds integer limit (2147483647): %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC <> floor((v_elem->>'quantity')::NUMERIC) THEN
          RAISE EXCEPTION 'Allocation quantity cannot contain fractional units: %', v_elem->>'quantity';
        END IF;
      END LOOP;

      IF (SELECT count(DISTINCT (elem->>'token_id')::UUID) FROM jsonb_array_elements(p_token_allocations) elem)
         <> jsonb_array_length(p_token_allocations) THEN
        RAISE EXCEPTION 'Duplicate token IDs supplied in purchase token allocations';
      END IF;
    END IF;
  END IF;

  -- ── 3. Deterministic Row Locking & Valuation Calculation ───────────────────
  IF p_token_allocations IS NOT NULL AND jsonb_array_length(p_token_allocations) > 0 THEN
    v_token_ids := ARRAY(
      SELECT (elem->>'token_id')::UUID
        FROM jsonb_array_elements(p_token_allocations) elem
    );

    OPEN c_alloc_tokens(v_token_ids);
    LOOP
      FETCH c_alloc_tokens INTO v_cursor_row;
      EXIT WHEN NOT FOUND;

      v_rec     := v_cursor_row.t;
      v_rec_qty := v_cursor_row.requested_qty;

      IF v_rec.usage_status IS DISTINCT FROM 'available' THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % is not available for deduction (status: %)', v_rec.id, v_rec.usage_status;
      END IF;

      IF v_rec.used_against_voucher_id IS NOT NULL OR v_rec.used_against_purchase_id IS NOT NULL THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % has already been applied to another transaction', v_rec.id;
      END IF;

      IF v_rec_qty > v_rec.remaining_quantity THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Requested quantity % exceeds available quantity % for token %',
          v_rec_qty, v_rec.remaining_quantity, v_rec.id;
      END IF;

      IF v_rec.remaining_quantity <= 0 THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % is depleted', v_rec.id;
      END IF;

      IF v_rec.token_value <= 0 THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % has non-positive face value (%) and cannot be applied as payment tender',
          v_rec.id, v_rec.token_value;
      END IF;

      v_tokens_amount := v_tokens_amount + (v_rec.token_value * v_rec_qty);
      v_locked_rows   := array_append(v_locked_rows, v_rec);
      v_alloc_qtys    := array_append(v_alloc_qtys, v_rec_qty);
    END LOOP;
    CLOSE c_alloc_tokens;

    IF coalesce(cardinality(v_locked_rows), 0) <> jsonb_array_length(p_token_allocations) THEN
      RAISE EXCEPTION 'One or more requested tokens do not exist or belong to another tenant';
    END IF;
  END IF;

  -- ── 4. Insert purchase header (includes Phase 9 shift_id) ──────────────────
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

  -- ── 5. Token Mutation & Uniform Child Slice Creation ───────────────────────
  IF cardinality(v_locked_rows) > 0 THEN
    FOR i IN 1 .. cardinality(v_locked_rows)
    LOOP
      v_rec     := v_locked_rows[i];
      v_rec_qty := v_alloc_qtys[i];

      -- A. Decrement parent batch residual stock and book value (Model 1 Dynamic Residual Book Value)
      UPDATE token_transactions
         SET remaining_quantity = remaining_quantity - v_rec_qty,
             total_amount       = (remaining_quantity - v_rec_qty) * token_value,
             usage_status       = CASE WHEN remaining_quantity - v_rec_qty = 0 THEN 'used' ELSE 'available' END
       WHERE id = v_rec.id;

      -- B. Insert child consumption slice (uniform for all partial and full allocations)
      -- Populates all 10 NOT NULL columns; sets shift_id = NULL to protect drawer cash.
      INSERT INTO token_transactions (
        tenant_id, type, invoice_id, redemption_id, client_id, client_name,
        brand_id, brand_name, series_id, series_name, unit_name,
        token_value, quantity, remaining_quantity, total_amount,
        parent_transaction_id, usage_status, used_against_purchase_id,
        settled_vendor_name, notes, shift_id
      ) VALUES (
        p_tenant_id, v_rec.type, v_rec.invoice_id, v_rec.redemption_id,
        v_rec.client_id, v_rec.client_name,
        v_rec.brand_id, v_rec.brand_name,
        v_rec.series_id, v_rec.series_name, v_rec.unit_name,
        v_rec.token_value, v_rec_qty, 0, v_rec_qty * v_rec.token_value,
        v_rec.id, 'used', v_purchase_id,
        v_supplier_name,
        'Deduction against purchase ' || v_purchase_no,
        NULL
      );
    END LOOP;
  END IF;

  -- ── 6. Insert line items & adjust stock atomically (row-level lock per item) ──
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

    -- Purchase increases stock; return decreases it
    v_qty_delta := CASE WHEN v_is_return
                        THEN -COALESCE((v_line->>'qty')::NUMERIC, 0)
                        ELSE  COALESCE((v_line->>'qty')::NUMERIC, 0)
                   END;

    IF v_item_id IS NOT NULL THEN
      -- Primary path: lookup by item_id (UUID)
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE id = v_item_id AND tenant_id = p_tenant_id
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with ID % not found for this tenant', v_item_id;
      END IF;
      UPDATE items
         SET stock_qty = COALESCE(v_db_item.stock_qty, 0) + v_qty_delta
       WHERE id = v_db_item.id AND tenant_id = p_tenant_id;

    ELSIF v_item_code IS NOT NULL AND trim(v_item_code) <> '' THEN
      -- Fallback path: lookup by item code (C-01 — strict validation, no silent skip)
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;
      END IF;
      UPDATE items
         SET stock_qty = COALESCE(v_db_item.stock_qty, 0) + v_qty_delta
       WHERE id = v_db_item.id AND tenant_id = p_tenant_id;
    END IF;
  END LOOP;

  -- ── 7. Update supplier balance & payment metadata atomically ───────────────
  IF v_supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_supplier_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_current_bal := COALESCE(v_supplier.current_balance, 0);

      IF NOT v_is_return THEN
        -- Purchase: unpaid amount increases supplier payable balance
        v_new_balance := v_current_bal + v_due_amount;
      ELSE
        -- Return: cash refund vs store credit against unpaid debt
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

  -- ── 8. Write audit log entry (canonical contract — F-06 / C-05) ────────────
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
      'tokens_applied_amount',  v_tokens_amount,
      'token_allocations',      COALESCE(p_token_allocations, '[]'::jsonb),
      'item_count',             jsonb_array_length(p_items)
    )
  );

  RETURN jsonb_build_object(
    'success',                true,
    'purchase_id',            v_purchase_id,
    'purchase_no',            v_purchase_no,
    'tokens_applied_amount',  v_tokens_amount,
    'due_amount',             v_due_amount,
    'net_total',              v_net_total
  );

END;
$func$;

-- ==============================================================================
-- 2. HARDENED LEGACY WRAPPER: UUID Array Overload
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
  v_allocations JSONB;
BEGIN
  IF p_token_ids IS NULL OR cardinality(p_token_ids) = 0 THEN
    RETURN public.create_purchase_atomic(p_tenant_id, p_purchase_data, p_items, NULL::jsonb);
  END IF;

  IF array_position(p_token_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Token ID array cannot contain NULL elements';
  END IF;

  IF (SELECT count(DISTINCT u.id) FROM unnest(p_token_ids) AS u(id)) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'Duplicate token IDs supplied in purchase token request';
  END IF;

  -- Pre-validate existence and tenant ownership (fail-closed guard)
  IF (SELECT count(*) FROM token_transactions WHERE id = ANY(p_token_ids) AND tenant_id = p_tenant_id) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'One or more tokens do not belong to this tenant or do not exist';
  END IF;

  -- Formatting conversion: maps each token to full remaining_quantity for legacy callers
  SELECT jsonb_agg(
           jsonb_build_object(
             'token_id', u.id,
             'quantity', COALESCE(t.remaining_quantity, 0)
           )
         )
    INTO v_allocations
    FROM unnest(p_token_ids) AS u(id)
    LEFT JOIN token_transactions t
      ON t.id = u.id AND t.tenant_id = p_tenant_id;

  RETURN public.create_purchase_atomic(p_tenant_id, p_purchase_data, p_items, v_allocations);
END;
$func$;

-- ==============================================================================
-- 3. SECURITY POSTURE & PRIVILEGES (C-06)
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;
