-- Migration: 20261030_05_create_invoice_atomic_v2_offline.sql
-- Description: Replace create_invoice_atomic with offline-aware v2.
--
-- Key changes vs pre-offline backup:
--   1. Reads offline fields from p_invoice_data: is_offline, created_at_local,
--      device_id, local_receipt_no, offline_schema_version, is_late_sync, original_shift_id.
--   2. v_date derived from created_at_local (Karachi) ONLY when is_offline=true.
--   3. Invoice number YYMMDD built from v_date, not NOW().
--   4. New fingerprint EXCLUDES shift_id, is_offline, created_at_local, device_id,
--      local_receipt_no, offline_schema_version — so an online-timeout retry that
--      later arrives via the offline queue matches the same key.
--   5. Legacy fingerprint (includes shift_id) stored in v_legacy_fingerprint for
--      backward-compat with in-flight retries of pre-deploy invoices.
--   6. Duplicate check matches EITHER new OR legacy fingerprint.
--   7. Time-safety check (after duplicate check so retries always succeed):
--        > 5 min future  → RAISE 'OFFLINE_TIME_FUTURE'
--        > 7 days old    → RAISE 'OFFLINE_TIME_TOO_OLD'
--   8. INSERT writes all 8 new columns; synced_at = NOW() when is_offline.
--   9. unique_violation on idx_invoices_offline_dedup → RAISE 'OFFLINE_RECEIPT_DUPLICATE'.
--
-- Apply order: migration 03 → migration 04 → THIS.
-- Backward compatible: old route sends no offline fields → all default to false/NULL,
--   new fingerprint still computed correctly (offline fields default to empty string).

-- Save current definition to allow quick rollback:
-- See supabase/rollback/rollback_create_invoice_atomic_to_pre_offline.sql

CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
  p_invoice_data jsonb,
  p_items        jsonb,
  p_tokens       jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- ── Core invoice fields ──────────────────────────────────────────────────────
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

  -- ── Offline-specific fields ──────────────────────────────────────────────────
  v_is_offline             BOOLEAN;
  v_created_at_local       TIMESTAMPTZ;
  v_device_id              TEXT;
  v_local_receipt_no       TEXT;
  v_offline_schema_version INT;
  v_is_late_sync           BOOLEAN;
  v_original_shift_id      UUID;
  v_synced_at              TIMESTAMPTZ;
  v_time_diff_secs         NUMERIC;

  -- ── Item loop vars ───────────────────────────────────────────────────────────
  v_invoice_id       UUID;
  v_item             JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_name        TEXT;
  v_item_qty         NUMERIC;
  v_curr_stock       NUMERIC;
  v_is_return        BOOLEAN;
  v_allow_neg_stock  BOOLEAN := true;

  -- ── Token loop vars ──────────────────────────────────────────────────────────
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

  -- ── Idempotency & balance vars ───────────────────────────────────────────────
  v_existing_id           UUID;
  v_client_bal            NUMERIC;
  v_cash_refunded         NUMERIC;
  v_store_credit          NUMERIC;
  v_result                JSONB;

  -- ── N4 validation helpers ────────────────────────────────────────────────────
  v_line_elem        JSONB;
  v_line_items_total NUMERIC := 0;

  -- ── B6 Idempotency & Numbering ───────────────────────────────────────────────
  v_idempotency_key       UUID;
  v_payload_fingerprint   TEXT;   -- new: excludes shift_id + all offline fields
  v_legacy_fingerprint    TEXT;   -- old: includes shift_id (backward-compat)
  v_existing_fingerprint  TEXT;
  v_seq                   BIGINT;
  v_seq_str               TEXT;
  v_karachi_date_str      TEXT;
  v_constraint_name       TEXT;

BEGIN
  -- ── Extract core invoice fields ──────────────────────────────────────────────
  v_tenant_id       := (p_invoice_data->>'tenant_id')::UUID;
  v_invoice_no      := TRIM(p_invoice_data->>'invoice_no');
  v_idempotency_key := NULLIF(p_invoice_data->>'idempotency_key', '')::UUID;
  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;
  v_client_name     := COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer');
  v_shift_id        := NULLIF(p_invoice_data->>'shift_id', '')::UUID;
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

  -- ── Extract offline fields ───────────────────────────────────────────────────
  v_is_offline             := COALESCE((p_invoice_data->>'is_offline')::BOOLEAN, false);
  v_created_at_local       := NULLIF(p_invoice_data->>'created_at_local', '')::TIMESTAMPTZ;
  v_device_id              := NULLIF(p_invoice_data->>'device_id', '');
  v_local_receipt_no       := NULLIF(p_invoice_data->>'local_receipt_no', '');
  v_offline_schema_version := NULLIF(NULLIF(p_invoice_data->>'offline_schema_version', ''), 'null')::INT;
  v_is_late_sync           := COALESCE((p_invoice_data->>'is_late_sync')::BOOLEAN, false);
  v_original_shift_id      := NULLIF(p_invoice_data->>'original_shift_id', '')::UUID;
  v_synced_at              := CASE WHEN v_is_offline THEN NOW() ELSE NULL END;

  -- ── Derive v_date (Karachi timezone) ────────────────────────────────────────
  -- For offline sales: use created_at_local so the invoice date matches the
  -- actual moment of the sale, not the sync moment.
  -- For online sales: use passed date field or fall back to server now().
  IF v_is_offline AND v_created_at_local IS NOT NULL THEN
    v_date := (v_created_at_local AT TIME ZONE 'Asia/Karachi')::DATE;
  ELSE
    v_date := COALESCE(
      NULLIF(p_invoice_data->>'date', '')::DATE,
      (NOW() AT TIME ZONE 'Asia/Karachi')::DATE
    );
  END IF;

  -- ── Basic guards ─────────────────────────────────────────────────────────────
  SELECT COALESCE(allow_negative_stock, true) INTO v_allow_neg_stock
    FROM tenants
   WHERE id = v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF v_idempotency_key IS NULL AND (v_invoice_no IS NULL OR v_invoice_no = '') THEN
    RAISE EXCEPTION 'invoice_no is required when idempotency_key is not provided';
  END IF;

  -- ── Fingerprint computation ──────────────────────────────────────────────────
  -- NEW fingerprint: intentionally excludes shift_id, is_offline, created_at_local,
  -- device_id, local_receipt_no, offline_schema_version.
  -- Reason: a sale sent online (timeout) and later queued offline MUST match on
  -- the same idempotency_key without a fingerprint mismatch, even if shift_id
  -- or offline flags differ between the two attempts.
  v_payload_fingerprint := md5(
    COALESCE(v_client_id::TEXT, '') || '|' ||
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

  -- LEGACY fingerprint: old format that included shift_id.
  -- Used to match pre-deploy invoices whose fingerprint was stored with shift_id.
  v_legacy_fingerprint := md5(
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

  -- ── N4 Financial Validations (1-Rupee Tolerance) ────────────────────────────
  IF ABS(v_net_total - (v_subtotal - v_discount + v_delivery_charge)) > 1.00 THEN
    IF v_enforce THEN
      RAISE EXCEPTION 'VALIDATION: net_total (%) does not match subtotal (%) - discount (%) + delivery_charge (%)',
        v_net_total, v_subtotal, v_discount, v_delivery_charge;
    ELSE
      BEGIN
        INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
        VALUES (v_tenant_id, COALESCE(v_created_by, 'system'), 'VALIDATION_WARNING', 'validation', 'invoice',
          jsonb_build_object('rule', 'net_total_formula', 'invoice_no', v_invoice_no,
            'net_total', v_net_total, 'expected', v_subtotal - v_discount + v_delivery_charge));
      EXCEPTION WHEN OTHERS THEN NULL;
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
          jsonb_build_object('rule', 'paid_plus_due_equals_net', 'invoice_no', v_invoice_no,
            'paid_amount', v_paid_amount, 'due_amount', v_due_amount, 'net_total', v_net_total));
      EXCEPTION WHEN OTHERS THEN NULL;
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
          jsonb_build_object('rule', 'split_payment_sum', 'invoice_no', v_invoice_no,
            'cash_paid', v_cash_paid, 'card_paid', v_card_paid,
            'bank_paid', v_bank_paid, 'others_paid', v_others_paid, 'paid_amount', v_paid_amount));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_line_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_line_items_total := v_line_items_total +
        COALESCE((v_line_elem->>'total_price')::NUMERIC, (v_line_elem->>'total')::NUMERIC, 0);
    END LOOP;

    IF ABS(v_subtotal - v_line_items_total) > 1.00 THEN
      IF v_enforce THEN
        RAISE EXCEPTION 'VALIDATION: subtotal (%) does not match sum of line item totals (%)',
          v_subtotal, v_line_items_total;
      ELSE
        BEGIN
          INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, details)
          VALUES (v_tenant_id, COALESCE(v_created_by, 'system'), 'VALIDATION_WARNING', 'validation', 'invoice',
            jsonb_build_object('rule', 'line_items_subtotal', 'invoice_no', v_invoice_no,
              'subtotal', v_subtotal, 'line_items_total', v_line_items_total));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;
  END IF;

  -- ── 0. Idempotency Check: Pre-insert (BEFORE time-safety so retries always win) ──
  IF v_idempotency_key IS NOT NULL THEN
    SELECT id, request_fingerprint, row_to_json(invoices)::JSONB
      INTO v_existing_id, v_existing_fingerprint, v_result
      FROM invoices
     WHERE tenant_id = v_tenant_id AND idempotency_key = v_idempotency_key;

    IF FOUND THEN
      -- Accept if fingerprint matches new format OR legacy format (backward compat).
      -- A mismatch on BOTH means a genuinely different cart was submitted with the same key.
      IF v_existing_fingerprint IS NOT NULL
         AND v_existing_fingerprint <> v_payload_fingerprint
         AND v_existing_fingerprint <> v_legacy_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different cart payload', v_idempotency_key;
      END IF;
      RETURN jsonb_build_object(
        'success',      true,
        'is_duplicate', true,
        'invoice',      v_result
      );
    END IF;
  ELSE
    -- No idempotency key: check by invoice_no
    SELECT id INTO v_existing_id
      FROM invoices
     WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no;

    IF FOUND THEN
      SELECT row_to_json(i)::JSONB INTO v_result FROM invoices i WHERE i.id = v_existing_id;
      RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'invoice', v_result);
    END IF;
  END IF;

  -- ── Offline Time-Safety (AFTER duplicate check so retries always succeed) ────
  -- Check is done here in the RPC (single place) so both the regular and special
  -- invoice routes benefit without code duplication.
  IF v_is_offline AND v_created_at_local IS NOT NULL THEN
    v_time_diff_secs := EXTRACT(EPOCH FROM (v_created_at_local - NOW()));

    -- Reject if created_at_local is more than 5 minutes in the future
    IF v_time_diff_secs > 300 THEN
      RAISE EXCEPTION 'OFFLINE_TIME_FUTURE: created_at_local is % seconds in the future (max 300). Check device clock.',
        ROUND(v_time_diff_secs);
    END IF;

    -- Reject if created_at_local is more than 7 days old
    IF v_time_diff_secs < -604800 THEN
      RAISE EXCEPTION 'OFFLINE_TIME_TOO_OLD: created_at_local is % days old (max 7). CEO override required to accept.',
        ROUND(ABS(v_time_diff_secs) / 86400);
    END IF;
  END IF;

  -- ── B6 Late Server Number Allocation (After Validations) ────────────────────
  IF v_idempotency_key IS NOT NULL THEN
    INSERT INTO public.tenant_invoice_counters (tenant_id, prefix, current_seq)
    VALUES (v_tenant_id, 'INV', 1)
    ON CONFLICT (tenant_id, prefix) DO UPDATE
      SET current_seq = tenant_invoice_counters.current_seq + 1,
          updated_at  = NOW()
    RETURNING current_seq INTO v_seq;

    -- Build YYMMDD from v_date (not NOW()) — for offline sales this is the sale date
    v_karachi_date_str := TO_CHAR(v_date, 'YYMMDD');
    v_seq_str := CASE WHEN LENGTH(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END;
    v_invoice_no := 'INV-' || v_karachi_date_str || '-' || v_seq_str;

    -- Collision guard (extremely rare, handles concurrent inserts)
    WHILE EXISTS (SELECT 1 FROM invoices WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no) LOOP
      v_seq := v_seq + 1;
      v_seq_str := CASE WHEN LENGTH(v_seq::TEXT) >= 4 THEN v_seq::TEXT ELSE LPAD(v_seq::TEXT, 4, '0') END;
      v_invoice_no := 'INV-' || v_karachi_date_str || '-' || v_seq_str;
    END LOOP;

    UPDATE public.tenant_invoice_counters
       SET current_seq = v_seq, updated_at = NOW()
     WHERE tenant_id = v_tenant_id AND prefix = 'INV';
  END IF;

  -- ── 1. Insert Invoice ────────────────────────────────────────────────────────
  BEGIN
    INSERT INTO invoices (
      -- Core columns
      tenant_id, invoice_no, client_id, client_name, shift_id,
      date, subtotal, discount, delivery_charge, remarks,
      invoice_type, net_total, paid_amount, due_amount,
      payment_type, cash_paid, card_paid, bank_paid, others_paid,
      status, created_by, idempotency_key, request_fingerprint,
      -- Offline columns (migration 02)
      is_offline, created_at_local, device_id, local_receipt_no,
      synced_at, offline_schema_version,
      -- Late-sync columns (migration 04)
      is_late_sync, original_shift_id
    ) VALUES (
      -- Core values
      v_tenant_id, v_invoice_no, v_client_id, v_client_name, v_shift_id,
      v_date, v_subtotal, v_discount, v_delivery_charge, v_remarks,
      v_invoice_type, v_net_total, v_paid_amount, v_due_amount,
      v_payment_type, v_cash_paid, v_card_paid, v_bank_paid, v_others_paid,
      v_status, v_created_by, v_idempotency_key, v_payload_fingerprint,
      -- Offline values
      v_is_offline, v_created_at_local, v_device_id, v_local_receipt_no,
      v_synced_at, v_offline_schema_version,
      -- Late-sync values
      v_is_late_sync, v_original_shift_id
    ) RETURNING id INTO v_invoice_id;

  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;

    -- Offline dedup: same device + same local receipt number, different key
    IF v_constraint_name = 'idx_invoices_offline_dedup' THEN
      RAISE EXCEPTION 'OFFLINE_RECEIPT_DUPLICATE: A sale with device_id=% and local_receipt_no=% already exists.',
        v_device_id, v_local_receipt_no;
    END IF;

    -- Standard idempotency key collision (concurrent request race)
    IF v_idempotency_key IS NOT NULL AND v_constraint_name = 'uq_invoices_tenant_idempotency_key' THEN
      SELECT id, request_fingerprint, row_to_json(invoices)::JSONB
        INTO v_existing_id, v_existing_fingerprint, v_result
        FROM invoices
       WHERE tenant_id = v_tenant_id AND idempotency_key = v_idempotency_key;

      IF v_existing_fingerprint IS NOT NULL
         AND v_existing_fingerprint <> v_payload_fingerprint
         AND v_existing_fingerprint <> v_legacy_fingerprint THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key % was already submitted with a different cart payload', v_idempotency_key;
      END IF;

      RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'invoice', v_result);
    END IF;

    -- Invoice_no collision (no idempotency key path)
    IF v_idempotency_key IS NULL THEN
      SELECT row_to_json(i)::JSONB INTO v_result
        FROM invoices i
       WHERE i.tenant_id = v_tenant_id AND i.invoice_no = v_invoice_no;
      RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'invoice', v_result);
    END IF;

    RAISE; -- re-raise any other constraint violation
  END;

  -- ── 2. Insert Invoice Items & Adjust Stock Atomically ───────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_item->>'item_id', '')::UUID;
    v_item_code := TRIM(COALESCE(v_item->>'item_code', ''));
    v_item_qty  := COALESCE((v_item->>'qty')::NUMERIC, 1);
    v_item_name := COALESCE(v_item->>'item_name', 'Product');

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

    IF v_item_id IS NOT NULL OR v_item_code != '' THEN
      IF v_item_id IS NOT NULL THEN
        SELECT stock_qty, name INTO v_curr_stock, v_item_name
          FROM items WHERE id = v_item_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item with ID % not found', v_item_id;
        END IF;
      ELSIF v_item_code != '' THEN
        SELECT id, stock_qty, name INTO v_item_id, v_curr_stock, v_item_name
          FROM items WHERE tenant_id = v_tenant_id AND code = v_item_code FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item with code "%" not found', v_item_code;
        END IF;
      END IF;

      IF v_is_return THEN
        UPDATE items SET stock_qty = v_curr_stock + v_item_qty WHERE id = v_item_id;
      ELSE
        IF NOT COALESCE(v_allow_neg_stock, true) AND v_curr_stock < v_item_qty THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (Code: %): Available %, requested %',
            v_item_name, v_item_code, v_curr_stock, v_item_qty;
        END IF;
        UPDATE items SET stock_qty = v_curr_stock - v_item_qty WHERE id = v_item_id;
      END IF;
    END IF;
  END LOOP;

  -- ── 3. Update Client Balance Atomically ─────────────────────────────────────
  IF v_client_id IS NOT NULL THEN
    SELECT current_balance INTO v_client_bal
      FROM clients WHERE id = v_client_id FOR UPDATE;

    IF FOUND THEN
      IF v_is_return THEN
        v_cash_refunded := CASE
          WHEN v_cash_paid > 0 THEN v_cash_paid
          WHEN LOWER(v_payment_type) IN ('cash', 'refund') THEN v_paid_amount
          ELSE 0
        END;
        v_store_credit := GREATEST(0, v_net_total - v_cash_refunded);
        IF v_store_credit > 0 THEN
          UPDATE clients SET current_balance = current_balance - v_store_credit WHERE id = v_client_id;
        END IF;
      ELSIF v_due_amount > 0 THEN
        UPDATE clients SET current_balance = current_balance + v_due_amount WHERE id = v_client_id;
      END IF;
    END IF;
  END IF;

  -- ── 4. Process Token Transactions Atomically (Sales Only) ───────────────────
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
            FROM brands WHERE id = v_brand_id AND tenant_id = v_tenant_id;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand ID % not found for tenant', v_brand_id;
          END IF;
        ELSIF v_brand_name != '' THEN
          SELECT id, name INTO v_brand_id, v_brand_name
            FROM brands WHERE tenant_id = v_tenant_id AND LOWER(name) = LOWER(v_brand_name);
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand "%" not found for tenant', v_brand_name;
          END IF;
        ELSE
          RAISE EXCEPTION 'Brand is required for token processing';
        END IF;

        IF v_series_id IS NOT NULL THEN
          SELECT id, name INTO v_series_id, v_series_name
            FROM brand_series
           WHERE id = v_series_id AND brand_id = v_brand_id
             AND tenant_id = v_tenant_id AND status = 'active';
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Series ID % is invalid, inactive, or does not belong to brand %', v_series_id, v_brand_name;
          END IF;
        ELSIF v_series_name != '' THEN
          SELECT id, name INTO v_series_id, v_series_name
            FROM brand_series
           WHERE brand_id = v_brand_id AND tenant_id = v_tenant_id
             AND LOWER(name) = LOWER(v_series_name) AND status = 'active';
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Series "%" not found or inactive for brand %', v_series_name, v_brand_name;
          END IF;
        ELSE
          RAISE EXCEPTION 'Series is required for token processing';
        END IF;

        SELECT unit_name, is_enabled, token_value INTO v_config_rec
          FROM series_token_configs
         WHERE series_id = v_series_id AND tenant_id = v_tenant_id
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
            v_tenant_id, 'shop_retained', v_invoice_id, v_client_id, v_client_name,
            v_brand_id, v_brand_name, v_series_id, v_series_name, v_config_rec.unit_name,
            v_auth_val, v_token_qty, v_token_qty, v_token_total,
            'available', v_shift_id, v_created_by,
            'Shop retained token at sale (Discount applied to sale price)'
          );
        ELSE
          INSERT INTO token_transactions (
            tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name,
            token_value, quantity, remaining_quantity, total_amount,
            usage_status, shift_id, created_by, notes
          ) VALUES (
            v_tenant_id, 'issued', v_invoice_id, v_client_id, v_client_name,
            v_brand_id, v_brand_name, v_series_id, v_series_name, v_config_rec.unit_name,
            v_auth_val, v_token_qty, 0, v_token_total,
            'n_a', v_shift_id, v_created_by,
            'Customer kept physical token with purchase'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ── 5. Audit Log Entry ───────────────────────────────────────────────────────
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
      'invoice_no',    v_invoice_no,
      'net_total',     v_net_total,
      'paid_amount',   v_paid_amount,
      'due_amount',    v_due_amount,
      'items_count',   jsonb_array_length(p_items),
      'is_offline',    v_is_offline,
      'synced_at',     v_synced_at,
      'is_late_sync',  v_is_late_sync
    )
  );

  SELECT row_to_json(i)::JSONB INTO v_result
    FROM invoices i WHERE i.id = v_invoice_id;

  RETURN jsonb_build_object(
    'success',    true,
    'invoice_id', v_invoice_id,
    'invoice',    v_result
  );
END;
$function$;

