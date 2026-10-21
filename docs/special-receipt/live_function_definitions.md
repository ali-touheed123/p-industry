# Live Function Definitions & Patches (Verified Against Production DB)

**Database:** PostgreSQL 17 (Supabase Project: `ignspvajzblmsbertmmv`)  
**Method of Verification:** Direct read-only query using `SELECT pg_get_functiondef(oid)` via Supabase MCP tool on 2026-10-21.  
**Purpose:** Maintain exact byte-level fidelity with live production stored procedures and provide side-by-side diffs for audit.

---

## 1. `update_invoice_atomic`

### 1.1 Live Production Definition (Unmodified)
```sql
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
BEGIN
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

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

  -- Lock old invoice for update
  SELECT * INTO v_old_invoice
    FROM invoices
   WHERE id = p_invoice_id AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;

  v_is_old_return := (v_old_invoice.invoice_type = 'return');
  v_old_due       := COALESCE(v_old_invoice.due_amount, 0);

  -- Revert stock from old invoice items
  FOR v_old_item IN
    SELECT item_id, item_code, qty FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    v_revert_delta := CASE WHEN v_is_old_return THEN -COALESCE(v_old_item.qty, 0) ELSE COALESCE(v_old_item.qty, 0) END;

    IF v_old_item.item_id IS NOT NULL THEN
      UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_revert_delta)
       WHERE id = v_old_item.item_id AND tenant_id = p_tenant_id;
    ELSIF v_old_item.item_code IS NOT NULL AND trim(v_old_item.item_code) <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_old_item.item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_revert_delta)
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  -- Delete old items
  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

  -- Insert new items and apply new stock
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
      UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_apply_delta)
       WHERE id = v_item_id AND tenant_id = p_tenant_id;
    ELSIF v_item_code <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_apply_delta)
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  -- Adjust client balance
  v_new_due  := v_due_amount;
  v_due_diff := v_new_due - v_old_due;

  IF v_client_id IS NOT NULL AND v_due_diff <> 0 THEN
    SELECT current_balance INTO v_client_bal
      FROM clients WHERE id = v_client_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF FOUND THEN
      UPDATE clients SET current_balance = COALESCE(v_client_bal, 0) + v_due_diff
       WHERE id = v_client_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- Update invoice header
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
```

### 1.2 Patched Version (Special Invoice Edit Rejection — Owner Decision D1)
```sql
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
BEGIN
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

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

  -- Lock old invoice for update
  SELECT * INTO v_old_invoice
    FROM invoices
   WHERE id = p_invoice_id AND tenant_id = p_tenant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;

  -- ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  -- OWNER DECISION D1: Reject any edit on special invoices
  -- ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  IF v_old_invoice.printed_as = 'special' THEN
    RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
  END IF;
  -- ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  v_is_old_return := (v_old_invoice.invoice_type = 'return');
  v_old_due       := COALESCE(v_old_invoice.due_amount, 0);

  -- Revert stock from old invoice items
  FOR v_old_item IN
    SELECT item_id, item_code, qty FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    v_revert_delta := CASE WHEN v_is_old_return THEN -COALESCE(v_old_item.qty, 0) ELSE COALESCE(v_old_item.qty, 0) END;

    IF v_old_item.item_id IS NOT NULL THEN
      UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_revert_delta)
       WHERE id = v_old_item.item_id AND tenant_id = p_tenant_id;
    ELSIF v_old_item.item_code IS NOT NULL AND trim(v_old_item.item_code) <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_old_item.item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_revert_delta)
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  -- Delete old items
  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

  -- Insert new items and apply new stock
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
      UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_apply_delta)
       WHERE id = v_item_id AND tenant_id = p_tenant_id;
    ELSIF v_item_code <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) + v_apply_delta)
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  -- Adjust client balance
  v_new_due  := v_due_amount;
  v_due_diff := v_new_due - v_old_due;

  IF v_client_id IS NOT NULL AND v_due_diff <> 0 THEN
    SELECT current_balance INTO v_client_bal
      FROM clients WHERE id = v_client_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF FOUND THEN
      UPDATE clients SET current_balance = COALESCE(v_client_bal, 0) + v_due_diff
       WHERE id = v_client_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- Update invoice header
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
```

### 1.3 Exact Diff Block
```diff
   -- Lock old invoice for update
   SELECT * INTO v_old_invoice
     FROM invoices
    WHERE id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;
 
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Invoice not found or access denied';
   END IF;
 
+  -- OWNER DECISION D1: Reject any edit on special invoices
+  IF v_old_invoice.printed_as = 'special' THEN
+    RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
+  END IF;
+
   v_is_old_return := (v_old_invoice.invoice_type = 'return');
   v_old_due       := COALESCE(v_old_invoice.due_amount, 0);
```

---

## 2. `create_invoice_atomic` (Live Production Reference)

```sql
CREATE OR REPLACE FUNCTION public.create_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_tokens jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
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

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF v_invoice_no IS NULL OR v_invoice_no = '' THEN
    RAISE EXCEPTION 'invoice_no is required';
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

    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, shade_code,
      pack_size, unit, qty, unit_price, discount,
      discount_percent, total_price
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
      COALESCE((v_item->>'total_price')::NUMERIC, 0)
    );

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
        UPDATE items
           SET stock_qty = v_curr_stock + v_item_qty
         WHERE id = v_item_id;
      ELSE
        IF v_curr_stock < v_item_qty THEN
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
```

---

## 3. `cancel_invoice_atomic` (Live Production Reference)

```sql
CREATE OR REPLACE FUNCTION public.cancel_invoice_atomic(p_tenant_id uuid, p_invoice_id uuid, p_reason text DEFAULT 'Cancelled by operator'::text, p_cancelled_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invoice      RECORD;
  v_item         RECORD;
  v_tx           RECORD;
  v_curr_stock   NUMERIC;
  v_client_bal   NUMERIC;
  v_store_credit NUMERIC;
  v_cash_ref     NUMERIC;
  v_rev_count    INTEGER := 0;
  v_unconsumed   INTEGER;
BEGIN
  -- 1. Lock invoice row
  SELECT * INTO v_invoice
    FROM invoices
   WHERE id = p_invoice_id
     AND tenant_id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found for tenant %', p_invoice_id, p_tenant_id;
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_cancelled', true,
      'invoice_id', p_invoice_id
    );
  END IF;

  -- 2. Reverse Stock adjustments for line items
  FOR v_item IN SELECT * FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    IF v_item.item_id IS NOT NULL THEN
      SELECT stock_qty INTO v_curr_stock
        FROM items
       WHERE id = v_item.item_id
         FOR UPDATE;

      IF FOUND THEN
        IF v_invoice.invoice_type = 'return' THEN
          IF v_curr_stock < v_item.qty THEN
            RAISE EXCEPTION 'Cannot cancel return: Insufficient stock to revert item % (Available: %, required: %)',
              v_item.item_name, v_curr_stock, v_item.qty;
          END IF;
          UPDATE items SET stock_qty = v_curr_stock - v_item.qty WHERE id = v_item.item_id;
        ELSE
          UPDATE items SET stock_qty = v_curr_stock + v_item.qty WHERE id = v_item.item_id;
        END IF;
      END IF;
    ELSIF v_item.item_code IS NOT NULL AND v_item.item_code != '' THEN
      SELECT stock_qty INTO v_curr_stock
        FROM items
       WHERE tenant_id = p_tenant_id
         AND code = v_item.item_code
         FOR UPDATE;

      IF FOUND THEN
        IF v_invoice.invoice_type = 'return' THEN
          IF v_curr_stock < v_item.qty THEN
            RAISE EXCEPTION 'Cannot cancel return: Insufficient stock to revert item % (Available: %, required: %)',
              v_item.item_name, v_curr_stock, v_item.qty;
          END IF;
          UPDATE items SET stock_qty = v_curr_stock - v_item.qty WHERE tenant_id = p_tenant_id AND code = v_item.item_code;
        ELSE
          UPDATE items SET stock_qty = v_curr_stock + v_item.qty WHERE tenant_id = p_tenant_id AND code = v_item.item_code;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 3. Revert Client Balance
  IF v_invoice.client_id IS NOT NULL THEN
    SELECT current_balance INTO v_client_bal
      FROM clients
     WHERE id = v_invoice.client_id
       FOR UPDATE;

    IF FOUND THEN
      IF v_invoice.invoice_type = 'return' THEN
        v_cash_ref := CASE
          WHEN COALESCE(v_invoice.cash_paid, 0) > 0 THEN v_invoice.cash_paid
          WHEN LOWER(COALESCE(v_invoice.payment_type, '')) IN ('cash', 'refund') THEN v_invoice.paid_amount
          ELSE 0
        END;
        v_store_credit := GREATEST(0, v_invoice.net_total - v_cash_ref);
        IF v_store_credit > 0 THEN
          UPDATE clients
             SET current_balance = current_balance + v_store_credit
           WHERE id = v_invoice.client_id;
        END IF;
      ELSIF v_invoice.due_amount > 0 THEN
        UPDATE clients
           SET current_balance = current_balance - v_invoice.due_amount
         WHERE id = v_invoice.client_id;
      END IF;
    END IF;
  END IF;

  -- 4. Revert Token Transactions with Strict Historical Preservation (Rule A5)
  FOR v_tx IN
    SELECT *
      FROM token_transactions
     WHERE invoice_id = p_invoice_id
       AND usage_status != 'reversed'
       AND type != 'reversal'
       FOR UPDATE
  LOOP
    IF v_tx.type = 'shop_retained' THEN
      v_unconsumed := COALESCE(v_tx.remaining_quantity, 0);

      IF v_tx.usage_status = 'settled' OR v_unconsumed = 0 THEN
        INSERT INTO token_transactions (
          tenant_id, type, invoice_id, client_id, client_name,
          brand_id, brand_name, series_id, series_name, unit_name,
          token_value, quantity, remaining_quantity, total_amount,
          usage_status, shift_id, parent_transaction_id, notes, created_by
        ) VALUES (
          v_tx.tenant_id,
          'reversal',
          v_tx.invoice_id,
          v_tx.client_id,
          v_tx.client_name,
          v_tx.brand_id,
          v_tx.brand_name,
          v_tx.series_id,
          v_tx.series_name,
          v_tx.unit_name,
          v_tx.token_value,
          v_tx.quantity,
          0,
          v_tx.total_amount,
          'reversed',
          v_tx.shift_id,
          v_tx.id,
          'Adjustment Reversal: Invoice cancelled after full vendor settlement. Original settled record #' || v_tx.id || ' preserved intact.',
          p_cancelled_by
        );
        v_rev_count := v_rev_count + 1;

      ELSIF v_unconsumed < v_tx.quantity THEN
        UPDATE token_transactions
           SET remaining_quantity = 0,
               usage_status = 'settled'
         WHERE id = v_tx.id;

        INSERT INTO token_transactions (
          tenant_id, type, invoice_id, client_id, client_name,
          brand_id, brand_name, series_id, series_name, unit_name,
          token_value, quantity, remaining_quantity, total_amount,
          usage_status, shift_id, parent_transaction_id, notes, created_by
        ) VALUES (
          v_tx.tenant_id,
          'reversal',
          v_tx.invoice_id,
          v_tx.client_id,
          v_tx.client_name,
          v_tx.brand_id,
          v_tx.brand_name,
          v_tx.series_id,
          v_tx.series_name,
          v_tx.unit_name,
          v_tx.token_value,
          v_unconsumed,
          0,
          v_unconsumed * v_tx.token_value,
          'reversed',
          v_tx.shift_id,
          v_tx.id,
          'Reversal: Invoice cancelled (Reversed ' || v_unconsumed || ' unconsumed tokens from stockpile; ' || (v_tx.quantity - v_unconsumed) || ' settled tokens preserved intact)',
          p_cancelled_by
        );
        v_rev_count := v_rev_count + 1;

      ELSE
        UPDATE token_transactions
           SET usage_status = 'reversed',
               remaining_quantity = 0
         WHERE id = v_tx.id;

        INSERT INTO token_transactions (
          tenant_id, type, invoice_id, client_id, client_name,
          brand_id, brand_name, series_id, series_name, unit_name,
          token_value, quantity, remaining_quantity, total_amount,
          usage_status, shift_id, parent_transaction_id, notes, created_by
        ) VALUES (
          v_tx.tenant_id,
          'reversal',
          v_tx.invoice_id,
          v_tx.client_id,
          v_tx.client_name,
          v_tx.brand_id,
          v_tx.brand_name,
          v_tx.series_id,
          v_tx.series_name,
          v_tx.unit_name,
          v_tx.token_value,
          v_tx.quantity,
          0,
          v_tx.total_amount,
          'reversed',
          v_tx.shift_id,
          v_tx.id,
          'Reversal: Invoice cancelled (Shop Retained tokens removed from available stockpile)',
          p_cancelled_by
        );
        v_rev_count := v_rev_count + 1;
      END IF;

    ELSIF v_tx.type = 'issued' THEN
      UPDATE token_transactions
         SET usage_status = 'reversed'
       WHERE id = v_tx.id;

      INSERT INTO token_transactions (
        tenant_id, type, invoice_id, client_id, client_name,
        brand_id, brand_name, series_id, series_name, unit_name,
        token_value, quantity, remaining_quantity, total_amount,
        usage_status, shift_id, parent_transaction_id, notes, created_by
      ) VALUES (
        v_tx.tenant_id,
        'reversal',
        v_tx.invoice_id,
        v_tx.client_id,
        v_tx.client_name,
        v_tx.brand_id,
        v_tx.brand_name,
        v_tx.series_id,
        v_tx.series_name,
        v_tx.unit_name,
        v_tx.token_value,
        v_tx.quantity,
        0,
        v_tx.total_amount,
        'reversed',
        v_tx.shift_id,
        v_tx.id,
        'Reversal: Invoice cancelled (Customer issued token activity record voided)',
        p_cancelled_by
      );
      v_rev_count := v_rev_count + 1;
    END IF;
  END LOOP;

  -- 5. Update invoice status
  UPDATE invoices
     SET status = 'cancelled',
         remarks = COALESCE(remarks || ' | ', '') || 'Cancelled: ' || p_reason
   WHERE id = p_invoice_id;

  -- 6. Insert audit log
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id,
    COALESCE(p_cancelled_by, v_invoice.client_name),
    'Sales Invoice Cancelled',
    'cancel',
    'invoice',
    p_invoice_id,
    jsonb_build_object(
      'invoice_no', v_invoice.invoice_no,
      'reason', p_reason,
      'reversed_token_records', v_rev_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'status', 'cancelled',
    'reversed_token_records', v_rev_count
  );
END;
$function$;
```
