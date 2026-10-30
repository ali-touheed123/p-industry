-- ============================================================================
-- SQL Test: test_20261030_08_invoices_version.sql
-- Phase: Test suite for Migration 08 (Invoices Version & update_invoice_atomic v2)
-- Transaction: Strictly transactional (BEGIN ... ROLLBACK). Leaves NO data behind.
-- Status: NOT APPLIED (Run manually or via test harness; rolls back completely)
-- ============================================================================

BEGIN;

-- Apply migration 08 inside this sandbox transaction
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS edit_idempotency_key UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_edit_idempotency
  ON public.invoices(tenant_id, edit_idempotency_key)
  WHERE edit_idempotency_key IS NOT NULL;

DROP FUNCTION IF EXISTS public.update_invoice_atomic(uuid, uuid, jsonb, jsonb);

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
  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'invoice_id is required'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id is required'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one line item is required'; END IF;

  v_idemp_key := COALESCE(p_edit_idempotency_key, NULLIF(p_invoice_data->>'edit_idempotency_key', '')::UUID);
  v_exp_version := COALESCE(p_expected_version, NULLIF(p_invoice_data->>'expected_version', '')::INT);

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

  IF v_old_invoice.printed_as = 'special' THEN
    RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
  END IF;

  IF v_idemp_key IS NOT NULL AND v_old_invoice.edit_idempotency_key = v_idemp_key THEN
    SELECT row_to_json(i)::JSONB INTO v_updated_invoice FROM invoices i WHERE i.id = p_invoice_id;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice', v_updated_invoice
    );
  END IF;

  IF v_exp_version IS NOT NULL AND v_old_invoice.version <> v_exp_version THEN
    RAISE EXCEPTION 'INVOICE_VERSION_CONFLICT: Expected version %, but current invoice version is %',
      v_exp_version, v_old_invoice.version;
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
    bank_paid = v_bank_paid, others_paid = v_others_paid, status = v_status,
    version = COALESCE(v_old_invoice.version, 1) + 1,
    edit_idempotency_key = v_idemp_key
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  SELECT row_to_json(i)::JSONB INTO v_updated_invoice FROM invoices i WHERE i.id = p_invoice_id;

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

REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid) TO service_role;

DO $$
DECLARE
  v_tenant_id        UUID;
  v_client_id        UUID;
  v_item_id          UUID;
  v_invoice_id       UUID;
  v_edit_key         UUID := gen_random_uuid();
  v_res_old          JSONB;
  v_res1             JSONB;
  v_res2             JSONB;
  v_res3             JSONB;
  v_version_conflict BOOLEAN := false;
  v_final_version    INT;
  v_anon_has_access  BOOLEAN;
BEGIN
  -- 1. Setup test fixtures
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No test tenant found in database';
  END IF;

  SELECT id INTO v_client_id FROM public.clients WHERE tenant_id = v_tenant_id LIMIT 1;
  SELECT id INTO v_item_id FROM public.items WHERE tenant_id = v_tenant_id LIMIT 1;

  -- Create a test invoice with initial version = 1
  INSERT INTO public.invoices (
    tenant_id, invoice_no, client_id, subtotal, discount,
    net_total, paid_amount, due_amount, payment_type, date, version
  ) VALUES (
    v_tenant_id, 'TEST-INV-VER-01', v_client_id, 1000.00, 0.00,
    1000.00, 1000.00, 0.00, 'cash', CURRENT_DATE, 1
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id, item_id, item_code, item_name, qty, unit_price, total_price
  ) VALUES (
    v_invoice_id, v_item_id, 'TEST-CODE', 'Test Product', 1, 1000.00, 1000.00
  );

  RAISE NOTICE 'Test invoice created: ID %, initial version = 1', v_invoice_id;

  -- 2. Test: Old-style 4-arg call works seamlessly (backward compatibility)
  v_res_old := public.update_invoice_atomic(
    v_invoice_id,
    v_tenant_id,
    jsonb_build_object(
      'subtotal', '1100.00',
      'net_total', '1100.00',
      'paid_amount', '1100.00',
      'due_amount', '0.00'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id::text,
        'item_code', 'TEST-CODE',
        'item_name', 'Test Product',
        'qty', 1,
        'unit_price', 1100.00,
        'total_price', 1100.00
      )
    )
  );

  IF (v_res_old->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'Test failed: Old-style 4-argument call failed: %', v_res_old;
  END IF;

  SELECT version INTO v_final_version FROM public.invoices WHERE id = v_invoice_id;
  IF v_final_version <> 2 THEN
    RAISE EXCEPTION 'Test failed: Old-style call did not increment version to 2! Got: %', v_final_version;
  END IF;

  RAISE NOTICE 'T1 PASS: Old-style 4-argument call works with default NULL version/edit_key (version 1 -> 2)';

  -- 3. Happy Path Edit with expected_version = 2 & edit_idempotency_key
  v_res1 := public.update_invoice_atomic(
    v_invoice_id,
    v_tenant_id,
    jsonb_build_object(
      'subtotal', '1200.00',
      'net_total', '1200.00',
      'paid_amount', '1200.00',
      'due_amount', '0.00'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id::text,
        'item_code', 'TEST-CODE',
        'item_name', 'Test Product',
        'qty', 1,
        'unit_price', 1200.00,
        'total_price', 1200.00
      )
    ),
    2, -- expected_version
    v_edit_key -- edit_idempotency_key
  );

  IF (v_res1->>'success')::boolean <> true THEN
    RAISE EXCEPTION 'Test failed: Happy path edit failed: %', v_res1;
  END IF;

  SELECT version INTO v_final_version FROM public.invoices WHERE id = v_invoice_id;
  IF v_final_version <> 3 THEN
    RAISE EXCEPTION 'Test failed: Invoice version was not incremented to 3! Got: %', v_final_version;
  END IF;

  RAISE NOTICE 'T2 PASS: Invoice updated successfully with version checking. Version incremented 2 -> 3';

  -- 4. Stale Expected Version Mismatch must throw INVOICE_VERSION_CONFLICT
  BEGIN
    v_res2 := public.update_invoice_atomic(
      v_invoice_id,
      v_tenant_id,
      jsonb_build_object(
        'subtotal', '1300.00',
        'net_total', '1300.00',
        'paid_amount', '1300.00',
        'due_amount', '0.00'
      ),
      jsonb_build_array(
        jsonb_build_object(
          'item_id', v_item_id::text,
          'qty', 1,
          'unit_price', 1300.00,
          'total_price', 1300.00
        )
      ),
      2, -- stale expected_version (current is 3)
      gen_random_uuid()
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%INVOICE_VERSION_CONFLICT%' THEN
        v_version_conflict := true;
      ELSE
        RAISE EXCEPTION 'Unexpected error thrown: %', SQLERRM;
      END IF;
  END;

  IF NOT v_version_conflict THEN
    RAISE EXCEPTION 'Test failed: Stale version check did not throw INVOICE_VERSION_CONFLICT';
  END IF;

  RAISE NOTICE 'T3 PASS: Stale expected_version correctly rejected with INVOICE_VERSION_CONFLICT';

  -- 5. Idempotent Retry of Edit with the exact same edit_idempotency_key
  v_res3 := public.update_invoice_atomic(
    v_invoice_id,
    v_tenant_id,
    jsonb_build_object(
      'subtotal', '1200.00',
      'net_total', '1200.00'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id::text,
        'qty', 1,
        'unit_price', 1200.00
      )
    ),
    3, -- expected_version
    v_edit_key -- same edit key
  );

  IF (v_res3->>'is_duplicate')::boolean <> true THEN
    RAISE EXCEPTION 'Test failed: Repeated edit key was not returned as duplicate: %', v_res3;
  END IF;

  RAISE NOTICE 'T4 PASS: Repeated edit key returned idempotent duplicate without re-modifying invoice';

  -- 6. Permissions Check: Ensure anon role cannot execute update_invoice_atomic
  SELECT has_function_privilege('anon', 'public.update_invoice_atomic(uuid, uuid, jsonb, jsonb, int, uuid)', 'EXECUTE')
    INTO v_anon_has_access;

  IF v_anon_has_access THEN
    RAISE EXCEPTION 'Security failure: role anon has EXECUTE privilege on update_invoice_atomic!';
  END IF;

  RAISE NOTICE 'T5 PASS: anon role correctly forbidden from executing update_invoice_atomic';

  RAISE NOTICE 'ALL MIGRATION 08 TESTS PASSED SUCCESSFULLY ✅';
END;
$$;

ROLLBACK;
