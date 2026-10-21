-- Staging original function definitions from azzonbwaevtywisxlxej (backup before Step 4 alignment)

-- ============================================================================
-- create_invoice_atomic (md5: b71f73ef7943fe6d449bbc0a918d0fdb)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_invoice_atomic(p_invoice_data jsonb, p_items jsonb, p_tokens jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id UUID; v_invoice_no TEXT; v_client_id UUID; v_client_name TEXT;
  v_shift_id UUID; v_date DATE; v_subtotal NUMERIC; v_discount NUMERIC;
  v_delivery_charge NUMERIC; v_remarks TEXT; v_invoice_type TEXT;
  v_net_total NUMERIC; v_paid_amount NUMERIC; v_due_amount NUMERIC;
  v_payment_type TEXT; v_cash_paid NUMERIC; v_card_paid NUMERIC;
  v_bank_paid NUMERIC; v_others_paid NUMERIC; v_status TEXT; v_created_by TEXT;
  v_invoice_id UUID; v_item JSONB; v_item_id UUID; v_item_code TEXT;
  v_item_name TEXT; v_item_qty NUMERIC; v_curr_stock NUMERIC; v_is_return BOOLEAN;
  v_token JSONB; v_token_action TEXT; v_token_qty INTEGER; v_token_total NUMERIC;
  v_brand_id UUID; v_brand_name TEXT; v_series_id UUID; v_series_name TEXT;
  v_unit_name TEXT; v_client_val NUMERIC; v_auth_val NUMERIC; v_config_rec RECORD;
  v_existing_id UUID; v_client_bal NUMERIC; v_cash_refunded NUMERIC;
  v_store_credit NUMERIC; v_result JSONB;
BEGIN
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

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id is required'; END IF;
  IF v_invoice_no IS NULL OR v_invoice_no = '' THEN RAISE EXCEPTION 'invoice_no is required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one item is required'; END IF;

  SELECT id INTO v_existing_id FROM invoices WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no;
  IF FOUND THEN
    SELECT row_to_json(i)::JSONB INTO v_result FROM invoices i WHERE i.id = v_existing_id;
    RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'invoice_id', v_existing_id, 'invoice', v_result);
  END IF;

  BEGIN
    INSERT INTO invoices (
      tenant_id, invoice_no, client_id, client_name, date, subtotal, discount,
      delivery_charge, remarks, invoice_type, net_total, paid_amount, due_amount,
      payment_type, shift_id, cash_paid, card_paid, bank_paid, others_paid, status, created_by
    ) VALUES (
      v_tenant_id, v_invoice_no, v_client_id, v_client_name, v_date, v_subtotal, v_discount,
      v_delivery_charge, v_remarks, v_invoice_type, v_net_total, v_paid_amount, v_due_amount,
      v_payment_type, v_shift_id, v_cash_paid, v_card_paid, v_bank_paid, v_others_paid, v_status, v_created_by
    ) RETURNING id INTO v_invoice_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT row_to_json(i)::JSONB INTO v_result FROM invoices i
     WHERE i.tenant_id = v_tenant_id AND i.invoice_no = v_invoice_no;
    RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'invoice', v_result);
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_id   := NULLIF(v_item->>'item_id', '')::UUID;
    v_item_code := TRIM(COALESCE(v_item->>'item_code', ''));
    v_item_qty  := COALESCE((v_item->>'qty')::NUMERIC, 1);
    v_item_name := COALESCE(v_item->>'item_name', 'Product');
    INSERT INTO invoice_items (invoice_id, item_id, item_code, item_name, shade_code, pack_size,
      unit, qty, unit_price, discount, discount_percent, total_price)
    VALUES (v_invoice_id, v_item_id, v_item_code, v_item_name,
      COALESCE(v_item->>'shade_code', ''), COALESCE(v_item->>'pack_size', 'Can'),
      COALESCE(v_item->>'unit', 'PCS'), v_item_qty,
      COALESCE((v_item->>'unit_price')::NUMERIC, 0),
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE((v_item->>'discount_percent')::NUMERIC, 0),
      COALESCE((v_item->>'total_price')::NUMERIC, 0));
    IF v_item_id IS NOT NULL OR v_item_code != '' THEN
      IF v_item_id IS NOT NULL THEN
        SELECT stock_qty, name INTO v_curr_stock, v_item_name FROM items WHERE id = v_item_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Item with ID % not found', v_item_id; END IF;
      ELSE
        SELECT id, stock_qty, name INTO v_item_id, v_curr_stock, v_item_name FROM items
         WHERE tenant_id = v_tenant_id AND code = v_item_code FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Item with code "%" not found', v_item_code; END IF;
      END IF;
      IF v_is_return THEN
        UPDATE items SET stock_qty = v_curr_stock + v_item_qty WHERE id = v_item_id;
      ELSE
        IF v_curr_stock < v_item_qty THEN
          RAISE EXCEPTION 'Insufficient stock for "%" (Code: %): Available %, requested %',
            v_item_name, v_item_code, v_curr_stock, v_item_qty;
        END IF;
        UPDATE items SET stock_qty = v_curr_stock - v_item_qty WHERE id = v_item_id;
      END IF;
    END IF;
  END LOOP;

  IF v_client_id IS NOT NULL THEN
    SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id FOR UPDATE;
    IF FOUND THEN
      IF v_is_return THEN
        v_cash_refunded := CASE WHEN v_cash_paid > 0 THEN v_cash_paid
          WHEN LOWER(v_payment_type) IN ('cash', 'refund') THEN v_paid_amount ELSE 0 END;
        v_store_credit := GREATEST(0, v_net_total - v_cash_refunded);
        IF v_store_credit > 0 THEN
          UPDATE clients SET current_balance = current_balance - v_store_credit WHERE id = v_client_id;
        END IF;
      ELSIF v_due_amount > 0 THEN
        UPDATE clients SET current_balance = current_balance + v_due_amount WHERE id = v_client_id;
      END IF;
    END IF;
  END IF;

  IF NOT v_is_return AND p_tokens IS NOT NULL AND jsonb_array_length(p_tokens) > 0 THEN
    FOR v_token IN SELECT * FROM jsonb_array_elements(p_tokens) LOOP
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
          SELECT id, name INTO v_brand_id, v_brand_name FROM brands WHERE id = v_brand_id AND tenant_id = v_tenant_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'Brand ID % not found for tenant', v_brand_id; END IF;
        ELSIF v_brand_name != '' THEN
          SELECT id, name INTO v_brand_id, v_brand_name FROM brands WHERE tenant_id = v_tenant_id AND LOWER(name) = LOWER(v_brand_name);
          IF NOT FOUND THEN RAISE EXCEPTION 'Brand "%" not found for tenant', v_brand_name; END IF;
        ELSE RAISE EXCEPTION 'Brand is required for token processing'; END IF;
        IF v_series_id IS NOT NULL THEN
          SELECT id, name INTO v_series_id, v_series_name FROM brand_series
           WHERE id = v_series_id AND brand_id = v_brand_id AND tenant_id = v_tenant_id AND status = 'active';
          IF NOT FOUND THEN RAISE EXCEPTION 'Series ID % invalid or inactive for brand %', v_series_id, v_brand_name; END IF;
        ELSIF v_series_name != '' THEN
          SELECT id, name INTO v_series_id, v_series_name FROM brand_series
           WHERE brand_id = v_brand_id AND tenant_id = v_tenant_id AND LOWER(name) = LOWER(v_series_name) AND status = 'active';
          IF NOT FOUND THEN RAISE EXCEPTION 'Series "%" not found or inactive for brand %', v_series_name, v_brand_name; END IF;
        ELSE RAISE EXCEPTION 'Series is required for token processing'; END IF;
        SELECT unit_name, is_enabled, token_value INTO v_config_rec FROM series_token_configs
         WHERE series_id = v_series_id AND tenant_id = v_tenant_id AND match_unit_to_config(v_unit_name, unit_name) LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'Unit "%" is not configured in series "%"', v_unit_name, v_series_name; END IF;
        IF NOT v_config_rec.is_enabled THEN RAISE EXCEPTION 'Token is disabled for unit "%" in series "%"', v_unit_name, v_series_name; END IF;
        v_auth_val := (v_config_rec.token_value)::NUMERIC;
        IF v_auth_val <= 0 THEN RAISE EXCEPTION 'Token value must be > 0 for series "%" unit "%"', v_series_name, v_unit_name; END IF;
        IF v_client_val > 0 AND v_client_val != v_auth_val THEN
          RAISE EXCEPTION 'Token value mismatch for "% - % - %": Client Rs. %, config Rs. %',
            v_brand_name, v_series_name, v_unit_name, v_client_val, v_auth_val;
        END IF;
        v_token_total := v_auth_val * v_token_qty;
        IF v_token_action = 'remove' THEN
          INSERT INTO token_transactions (tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name, token_value, quantity,
            remaining_quantity, total_amount, usage_status, shift_id, created_by, notes)
          VALUES (v_tenant_id, 'shop_retained', v_invoice_id, v_client_id, v_client_name,
            v_brand_id, v_brand_name, v_series_id, v_series_name, v_config_rec.unit_name,
            v_auth_val, v_token_qty, v_token_qty, v_token_total, 'available',
            v_shift_id, v_created_by, 'Shop retained token at sale');
        ELSE
          INSERT INTO token_transactions (tenant_id, type, invoice_id, client_id, client_name,
            brand_id, brand_name, series_id, series_name, unit_name, token_value, quantity,
            remaining_quantity, total_amount, usage_status, shift_id, created_by, notes)
          VALUES (v_tenant_id, 'issued', v_invoice_id, v_client_id, v_client_name,
            v_brand_id, v_brand_name, v_series_id, v_series_name, v_config_rec.unit_name,
            v_auth_val, v_token_qty, 0, v_token_total, 'n_a',
            v_shift_id, v_created_by, 'Customer kept physical token with purchase');
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, entity_id, details)
  VALUES (v_tenant_id, v_client_name,
    CASE WHEN v_is_return THEN 'Credit Note Return' ELSE 'Sales Invoice Complete' END,
    CASE WHEN v_is_return THEN 'return' ELSE 'sale' END,
    'invoice', v_invoice_id,
    jsonb_build_object('invoice_no', v_invoice_no, 'net_total', v_net_total,
      'paid_amount', v_paid_amount, 'due_amount', v_due_amount, 'items_count', jsonb_array_length(p_items)));

  SELECT row_to_json(i)::JSONB INTO v_result FROM invoices i WHERE i.id = v_invoice_id;
  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id, 'invoice', v_result);
END;
$function$
;

-- ============================================================================
-- match_unit_to_config (md5: a7822a409f89c6dd1e0b274f7c5c2682)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_unit_to_config(p_unit text, p_config_unit text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  u TEXT := LOWER(TRIM(p_unit));
  cu TEXT := LOWER(TRIM(p_config_unit));
  norm_u TEXT;
  norm_cu TEXT;
  is_drum_u BOOLEAN;
  is_drum_cu BOOLEAN;
  is_gal_u BOOLEAN;
  is_gal_cu BOOLEAN;
  is_qtr_u BOOLEAN;
  is_qtr_cu BOOLEAN;
BEGIN
  IF u IS NULL OR cu IS NULL OR u = '' OR cu = '' THEN
    RETURN FALSE;
  END IF;

  IF u = cu THEN
    RETURN TRUE;
  END IF;

  norm_u := regexp_replace(u, '[^a-z0-9]', '', 'g');
  norm_cu := regexp_replace(cu, '[^a-z0-9]', '', 'g');
  IF norm_u = norm_cu AND LENGTH(norm_u) > 0 THEN
    RETURN TRUE;
  END IF;

  is_drum_u := (u ~* '\mdrums?\M' OR u ~* '^(20\s*(l|ltr|liters?|litres?))$');
  is_drum_cu := (cu ~* '\mdrums?\M' OR cu ~* '^(20\s*(l|ltr|liters?|litres?))$');
  IF is_drum_u AND is_drum_cu THEN
    RETURN TRUE;
  END IF;

  is_gal_u := (u ~* '\mgallons?\M' OR u ~* '^(4\s*(l|ltr|liters?|litres?))$');
  is_gal_cu := (cu ~* '\mgallons?\M' OR cu ~* '^(4\s*(l|ltr|liters?|litres?))$');
  IF is_gal_u AND is_gal_cu THEN
    RETURN TRUE;
  END IF;

  is_qtr_u := (u ~* '\mquarters?\M' OR u ~* '^(1\s*(l|ltr|liters?|litres?))$');
  is_qtr_cu := (cu ~* '\mquarters?\M' OR cu ~* '^(1\s*(l|ltr|liters?|litres?))$');
  IF is_qtr_u AND is_qtr_cu THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$
;

