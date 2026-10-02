-- Migration: 20261002_03_redeem_tokens_atomic.sql
-- Purpose: Atomic multi-line token redemption, authoritative token value resolution,
--          physical stockpile entry ('redeemed' -> 'available'), cash drawer linkage,
--          and unique constraint on token_redemptions(tenant_id, redemption_no).

-- 1. Unique constraint on (tenant_id, redemption_no) for concurrency & duplicate protection
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_redemptions_tenant_no
  ON token_redemptions (tenant_id, redemption_no);

-- 2. Function: redeem_tokens_atomic
CREATE OR REPLACE FUNCTION redeem_tokens_atomic(
  p_redemption_data JSONB,
  p_lines           JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id        UUID;
  v_redemption_no    TEXT;
  v_client_id        UUID;
  v_client_name      TEXT;
  v_shift_id         UUID;
  v_created_by       TEXT;
  v_notes            TEXT;
  v_payout_method    TEXT;

  v_redemption_id    UUID;
  v_existing_id      UUID;
  v_result           JSONB;

  v_line             JSONB;
  v_line_idx         INTEGER := 0;
  v_qty              INTEGER;
  v_brand_id         UUID;
  v_brand_name       TEXT;
  v_series_id        UUID;
  v_series_name      TEXT;
  v_unit_name        TEXT;
  v_client_val       NUMERIC;
  v_auth_val         NUMERIC;
  v_line_total       NUMERIC;
  v_config_rec       RECORD;

  v_total_tokens     INTEGER := 0;
  v_total_amount     NUMERIC := 0;

  v_line_items       JSONB := '[]'::JSONB;
  v_prepared_item    JSONB;
BEGIN
  -- Extract header fields
  v_tenant_id     := (p_redemption_data->>'tenant_id')::UUID;
  v_redemption_no := TRIM(COALESCE(p_redemption_data->>'redemption_no', ''));
  v_client_id     := NULLIF(p_redemption_data->>'client_id', '')::UUID;
  v_client_name   := COALESCE(NULLIF(TRIM(p_redemption_data->>'client_name'), ''), 'Walk-in Customer');
  v_shift_id      := NULLIF(p_redemption_data->>'shift_id', '')::UUID;
  v_created_by    := p_redemption_data->>'created_by';
  v_notes         := p_redemption_data->>'notes';
  v_payout_method := LOWER(TRIM(COALESCE(p_redemption_data->>'payout_method', 'cash')));

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF v_payout_method != 'cash' THEN
    RAISE EXCEPTION 'Invalid payout method "%". Token redemptions are CASH ONLY', v_payout_method;
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) != 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one redemption line is required';
  END IF;

  -- Validate registered customer if client_id provided (NO token_balance read or write)
  IF v_client_id IS NOT NULL THEN
    SELECT name INTO v_client_name
      FROM clients
     WHERE id = v_client_id
       AND tenant_id = v_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client with ID % not found for tenant', v_client_id;
    END IF;
  END IF;

  -- Auto-generate redemption_no if missing
  IF v_redemption_no = '' THEN
    v_redemption_no := 'RDM-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;

  -- 0. Idempotency Check: Pre-insert check for existing redemption_no
  SELECT id INTO v_existing_id
    FROM token_redemptions
   WHERE tenant_id = v_tenant_id
     AND redemption_no = v_redemption_no;

  IF FOUND THEN
    SELECT row_to_json(r)::JSONB INTO v_result
      FROM token_redemptions r
     WHERE r.id = v_existing_id;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'redemption_id', v_existing_id,
      'redemption_no', v_redemption_no,
      'total_tokens', (v_result->>'total_tokens')::INTEGER,
      'total_amount', (v_result->>'total_amount')::NUMERIC,
      'redemption', v_result
    );
  END IF;

  -- 1. Validation & Authoritative Configuration Resolution Loop
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_idx    := v_line_idx + 1;
    v_qty         := COALESCE((v_line->>'quantity')::INTEGER, 0);
    v_brand_id    := NULLIF(v_line->>'brand_id', '')::UUID;
    v_brand_name  := TRIM(COALESCE(v_line->>'brand_name', ''));
    v_series_id   := NULLIF(v_line->>'series_id', '')::UUID;
    v_series_name := TRIM(COALESCE(v_line->>'series_name', ''));
    v_unit_name   := TRIM(COALESCE(v_line->>'unit_name', ''));
    v_client_val  := COALESCE((v_line->>'token_value')::NUMERIC, 0);

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Line %: Quantity must be a positive whole number (got %)', v_line_idx, v_qty;
    END IF;

    -- Authoritative Brand Verification
    IF v_brand_id IS NOT NULL THEN
      SELECT id, name INTO v_brand_id, v_brand_name
        FROM brands
       WHERE id = v_brand_id
         AND tenant_id = v_tenant_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: Brand ID % not found for tenant', v_line_idx, v_brand_id;
      END IF;
    ELSIF v_brand_name != '' THEN
      SELECT id, name INTO v_brand_id, v_brand_name
        FROM brands
       WHERE tenant_id = v_tenant_id
         AND LOWER(name) = LOWER(v_brand_name);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: Brand "%" not found for tenant', v_line_idx, v_brand_name;
      END IF;
    ELSE
      RAISE EXCEPTION 'Line %: Brand is required for token redemption', v_line_idx;
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
        RAISE EXCEPTION 'Line %: Series ID % is invalid, inactive, or does not belong to brand "%"', v_line_idx, v_series_id, v_brand_name;
      END IF;
    ELSIF v_series_name != '' THEN
      SELECT id, name INTO v_series_id, v_series_name
        FROM brand_series
       WHERE brand_id = v_brand_id
         AND tenant_id = v_tenant_id
         AND LOWER(name) = LOWER(v_series_name)
         AND status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Line %: Series "%" not found or inactive for brand "%"', v_line_idx, v_series_name, v_brand_name;
      END IF;
    ELSE
      RAISE EXCEPTION 'Line %: Series is required for token redemption', v_line_idx;
    END IF;

    IF v_unit_name = '' THEN
      RAISE EXCEPTION 'Line %: Unit is required for token redemption', v_line_idx;
    END IF;

    -- Authoritative Unit and Token Value Resolution
    SELECT unit_name, is_enabled, token_value INTO v_config_rec
      FROM series_token_configs
     WHERE series_id = v_series_id
       AND tenant_id = v_tenant_id
       AND (
         LOWER(TRIM(unit_name)) = LOWER(v_unit_name)
         OR match_unit_to_config(v_unit_name, unit_name)
       )
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: Unit "%" is not configured in series "%" (%)', v_line_idx, v_unit_name, v_series_name, v_brand_name;
    END IF;

    IF NOT v_config_rec.is_enabled THEN
      RAISE EXCEPTION 'Line %: Token is disabled for unit "%" in series "%" (%)', v_line_idx, v_config_rec.unit_name, v_series_name, v_brand_name;
    END IF;

    v_auth_val := (v_config_rec.token_value)::NUMERIC;
    IF v_auth_val <= 0 THEN
      RAISE EXCEPTION 'Line %: Authoritative token value must be greater than zero for series "%" unit "%"', v_line_idx, v_series_name, v_config_rec.unit_name;
    END IF;

    -- Verify client-supplied value matches authoritative value if supplied
    IF v_client_val > 0 AND v_client_val != v_auth_val THEN
      RAISE EXCEPTION 'Line %: Token value mismatch for "% - % - %": Client provided Rs. %, authoritative config is Rs. %',
        v_line_idx, v_brand_name, v_series_name, v_config_rec.unit_name, v_client_val, v_auth_val;
    END IF;

    v_line_total   := v_auth_val * v_qty;
    v_total_tokens := v_total_tokens + v_qty;
    v_total_amount := v_total_amount + v_line_total;

    -- Stash resolved line
    v_prepared_item := jsonb_build_object(
      'brand_id', v_brand_id,
      'brand_name', v_brand_name,
      'series_id', v_series_id,
      'series_name', v_series_name,
      'unit_name', v_config_rec.unit_name,
      'token_value', v_auth_val,
      'quantity', v_qty,
      'line_total', v_line_total
    );
    v_line_items := v_line_items || jsonb_build_array(v_prepared_item);
  END LOOP;

  IF v_total_amount <= 0 OR v_total_tokens <= 0 THEN
    RAISE EXCEPTION 'Total redemption amount and tokens must be greater than zero';
  END IF;

  -- 2. Insert Token Redemption Header
  BEGIN
    INSERT INTO token_redemptions (
      tenant_id, redemption_no, client_id, client_name,
      total_tokens, total_amount, payout_method, shift_id, created_by
    ) VALUES (
      v_tenant_id, v_redemption_no, v_client_id, v_client_name,
      v_total_tokens, v_total_amount, 'cash', v_shift_id, v_created_by
    ) RETURNING id INTO v_redemption_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT row_to_json(r)::JSONB INTO v_result
      FROM token_redemptions r
     WHERE r.tenant_id = v_tenant_id
       AND r.redemption_no = v_redemption_no;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'redemption_id', v_result->>'id',
      'redemption_no', v_redemption_no,
      'total_tokens', (v_result->>'total_tokens')::INTEGER,
      'total_amount', (v_result->>'total_amount')::NUMERIC,
      'redemption', v_result
    );
  END;

  -- 3. Insert Redemption Items and Token Transactions (one row per redemption line)
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    v_brand_id    := (v_line->>'brand_id')::UUID;
    v_brand_name  := v_line->>'brand_name';
    v_series_id   := (v_line->>'series_id')::UUID;
    v_series_name := v_line->>'series_name';
    v_unit_name   := v_line->>'unit_name';
    v_auth_val    := (v_line->>'token_value')::NUMERIC;
    v_qty         := (v_line->>'quantity')::INTEGER;
    v_line_total  := (v_line->>'line_total')::NUMERIC;

    -- Item row
    INSERT INTO token_redemption_items (
      redemption_id, brand_id, brand_name,
      series_id, series_name, unit_name,
      token_value, quantity, line_total
    ) VALUES (
      v_redemption_id, v_brand_id, v_brand_name,
      v_series_id, v_series_name, v_unit_name,
      v_auth_val, v_qty, v_line_total
    );

    -- Stockpile Token Transaction row: enters shop safe, available for settlement
    INSERT INTO token_transactions (
      tenant_id, type, redemption_id,
      client_id, client_name,
      brand_id, brand_name,
      series_id, series_name,
      unit_name, token_value,
      quantity, remaining_quantity,
      total_amount, usage_status,
      shift_id, created_by, notes
    ) VALUES (
      v_tenant_id,
      'redeemed',
      v_redemption_id,
      v_client_id,
      v_client_name,
      v_brand_id,
      v_brand_name,
      v_series_id,
      v_series_name,
      v_unit_name,
      v_auth_val,
      v_qty,
      v_qty, -- remaining_quantity starts equal to quantity (enters stockpile)
      v_line_total,
      'available', -- available in safe for supplier settlement / write-off
      v_shift_id,
      v_created_by,
      COALESCE(v_notes, 'Token Redemption Cash Payout (' || v_redemption_no || ')')
    );
  END LOOP;

  -- 4. Audit Log Entry
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    v_tenant_id,
    COALESCE(v_created_by, v_client_name),
    'Token Redemption Cash Payout',
    'redemption',
    'token_redemption',
    v_redemption_id,
    jsonb_build_object(
      'redemption_no', v_redemption_no,
      'total_tokens', v_total_tokens,
      'total_amount', v_total_amount,
      'client_name', v_client_name,
      'lines_count', jsonb_array_length(v_line_items),
      'shift_id', v_shift_id
    )
  );

  -- 5. Return complete redemption data
  SELECT row_to_json(r)::JSONB INTO v_result
    FROM token_redemptions r
   WHERE r.id = v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'redemption_no', v_redemption_no,
    'total_tokens', v_total_tokens,
    'total_amount', v_total_amount,
    'redemption', v_result,
    'items', v_line_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_tokens_atomic(JSONB, JSONB) TO service_role;
