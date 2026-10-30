-- ============================================================================
-- Migration: 20261030_08_invoices_version_and_update_atomic_v2.sql
-- Phase: Phase 8 (Invoice Edit PATCH Idempotency + Version Lock)
-- Purpose: Add version (optimistic locking counter) and edit_idempotency_key
--          to invoices table. Upgrade update_invoice_atomic to v2 to support
--          version concurrency verification (rejection with INVOICE_VERSION_CONFLICT)
--          and edit idempotency deduplication so retried PATCH edits never
--          double-revert inventory or multiply client balance deltas.
-- Limitation Note: Only the LAST edit idempotency key is stored in invoices.edit_idempotency_key.
--          Prior edit keys on the same invoice are overwritten upon subsequent edits.
-- Overload Fix: Explicitly DROPS the existing 4-parameter overload before creating v2
--          to prevent Postgres function ambiguity ("function is not unique").
-- Privileges: Replicates live security model (REVOKE from public/anon/authenticated,
--          GRANT EXECUTE TO service_role only).
-- Depends on: 20261007_01_update_invoice_atomic.sql
-- When to apply: Together with or before deploying Phase 8 invoice edit API updates
-- Risk: Low (additive column defaults to 1, RPC parameters have NULL defaults)
-- Status: NOT APPLIED (Prepared for Owner Review)
-- ============================================================================

-- 1. Additive columns for invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS edit_idempotency_key UUID NULL;

-- 2. Unique deduplication index on edit_idempotency_key per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_edit_idempotency
  ON public.invoices(tenant_id, edit_idempotency_key)
  WHERE edit_idempotency_key IS NOT NULL;

-- 3. DROP old 4-argument overload to avoid function ambiguity
DROP FUNCTION IF EXISTS public.update_invoice_atomic(uuid, uuid, jsonb, jsonb);

-- 4. Full upgraded update_invoice_atomic v2
CREATE OR REPLACE FUNCTION public.update_invoice_atomic(
  p_invoice_id           uuid,
  p_tenant_id            uuid,
  p_invoice_data         jsonb,
  p_items                jsonb,
  p_expected_version     int DEFAULT NULL,
  p_edit_idempotency_key uuid DEFAULT NULL
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
  v_allow_neg_stock  BOOLEAN := true;
  v_idemp_key        UUID;
  v_exp_version      INT;
BEGIN
  -- ── 1. Basic Parameter Validations ─────────────────────────────────────────
  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'invoice_id is required'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id is required'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one line item is required'; END IF;

  v_idemp_key := COALESCE(p_edit_idempotency_key, NULLIF(p_invoice_data->>'edit_idempotency_key', '')::UUID);
  v_exp_version := COALESCE(p_expected_version, NULLIF(p_invoice_data->>'expected_version', '')::INT);

  -- ── 2. Field Extraction ───────────────────────────────────────────────────
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

  -- ── 3. Row Lock & Concurrency Control (FOR UPDATE) ────────────────────────
  SELECT * INTO v_old_invoice FROM invoices
   WHERE id = p_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or access denied'; END IF;

  IF v_old_invoice.printed_as = 'special' THEN
    RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
  END IF;

  -- ── 4. Edit Idempotency Check UNDER ROW LOCK ──────────────────────────────
  -- Re-check edit_idempotency_key strictly under the row lock to eliminate race conditions
  IF v_idemp_key IS NOT NULL AND v_old_invoice.edit_idempotency_key = v_idemp_key THEN
    SELECT row_to_json(i)::JSONB INTO v_updated_invoice FROM invoices i WHERE i.id = p_invoice_id;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice', v_updated_invoice
    );
  END IF;

  -- ── 5. Optimistic Locking Version Check ────────────────────────────────────
  IF v_exp_version IS NOT NULL AND v_old_invoice.version <> v_exp_version THEN
    RAISE EXCEPTION 'INVOICE_VERSION_CONFLICT: Expected version %, but current invoice version is %',
      v_exp_version, v_old_invoice.version;
  END IF;

  v_is_old_return := (v_old_invoice.invoice_type = 'return');
  v_old_due       := COALESCE(v_old_invoice.due_amount, 0);

  -- ── 6. Revert Old Item Stock ───────────────────────────────────────────────
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

  -- ── 7. Insert New Lines & Apply Stock Deductions ───────────────────────────
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

  -- ── 8. Adjust Customer Balance Delta ───────────────────────────────────────
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

  -- ── 9. Update Invoice Header, Increment Version & Record Edit Key ───────────
  UPDATE invoices SET
    client_id = v_client_id, client_name = v_client_name,
    subtotal = v_subtotal, discount = v_discount, delivery_charge = v_delivery_charge,
    remarks = v_remarks, net_total = v_net_total, paid_amount = v_paid_amount,
    due_amount = v_due_amount, payment_type = v_payment_type,
    cash_paid = v_cash_paid, card_paid = v_card_paid,
    bank_paid = v_bank_paid, others_paid = v_others_paid, status = v_status,
    version = COALESCE(v_old_invoice.version, 1) + 1,
    edit_idempotency_key = v_idemp_key
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  SELECT row_to_json(i)::JSONB INTO v_updated_invoice FROM invoices i WHERE i.id = p_invoice_id;

  -- ── 10. Audit Logging ──────────────────────────────────────────────────────
  INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, entity_id, details)
  VALUES (
    p_tenant_id, v_client_name, 'Sales Invoice Updated (Atomic v2)', 'update', 'invoice', p_invoice_id,
    jsonb_build_object(
      'invoice_no', v_old_invoice.invoice_no,
      'previous_net', v_old_invoice.net_total,
      'new_net', v_net_total,
      'previous_version', v_old_invoice.version,
      'new_version', COALESCE(v_old_invoice.version, 1) + 1,
      'edit_idempotency_key', v_idemp_key,
      'items_count', jsonb_array_length(p_items),
      'due_diff', v_due_diff
    )
  );

  RETURN jsonb_build_object('success', true, 'is_duplicate', false, 'invoice', v_updated_invoice);
END;
$function$;

-- 5. Privileges: Match live security model strictly
REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) TO service_role;
