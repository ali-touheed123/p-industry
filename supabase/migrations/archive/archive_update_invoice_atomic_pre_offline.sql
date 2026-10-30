-- ============================================================================
-- ARCHIVE: Live definition of update_invoice_atomic before Offline Mode Phase 8
-- Captured via pg_get_functiondef on 2026-10-30 from ignspvajzblmsbertmmv
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_invoice_atomic(p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb)
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

