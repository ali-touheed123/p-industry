-- Migration: 20261007_02_settle_tokens_atomic.sql
-- Purpose: Task 12.7 — FINDING-E2E-010
--   Wrap the sequential per-allocation settle_vendor loop in a single atomic
--   PostgreSQL transaction via settle_tokens_atomic RPC.
--
-- Problem: POST /api/tokens settle_vendor processed allocations in a sequential
--   non-atomic JS loop. Mid-loop failure left partial settlement with some rows
--   marked 'settled' and others unchanged — no rollback.
--
-- Solution: Single plpgsql function accepting an array of allocations (JSONB).
--   The entire loop runs inside one transaction. Any failure rolls back all changes.
--
-- Parameters:
--   p_tenant_id        UUID   -- Tenant (server-enforced isolation)
--   p_allocations      JSONB  -- Array of { id: UUID, count: int }
--   p_supplier_id      UUID   -- Optional supplier for vendor_rep_credit voucher
--   p_supplier_name    TEXT   -- Supplier name
--   p_settlement_type  TEXT   -- 'vendor_rep_cash' | 'vendor_rep_credit'
--   p_claim_reference  TEXT   -- Claim reference code for audit trail
--
-- Returns JSONB with:
--   { "settled_count": int, "total_settled_value": numeric, "voucher_id": UUID | null }

CREATE OR REPLACE FUNCTION settle_tokens_atomic(
  p_tenant_id       UUID,
  p_allocations     JSONB,
  p_supplier_id     UUID     DEFAULT NULL,
  p_supplier_name   TEXT     DEFAULT 'Vendor / Paint Company',
  p_settlement_type TEXT     DEFAULT 'vendor_rep_cash',
  p_claim_reference TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_alloc            JSONB;
  v_alloc_id         UUID;
  v_alloc_count      NUMERIC;
  v_parent           RECORD;
  v_available        NUMERIC;
  v_surrender_qty    NUMERIC;
  v_unit_val         NUMERIC;
  v_surrender_val    NUMERIC;
  v_total_value      NUMERIC := 0;
  v_total_tokens     INTEGER := 0;
  v_new_remaining    NUMERIC;
  v_ref_code         TEXT;
  v_voucher_id       UUID;
  v_voucher_no       TEXT;
  v_supplier         RECORD;
  v_updated_balance  NUMERIC;
BEGIN
  -- 0. Validate
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'No token allocations provided for settlement';
  END IF;

  v_ref_code := COALESCE(
    NULLIF(TRIM(p_claim_reference), ''),
    'REP-' || right(floor(extract(epoch from now()) * 1000)::text, 6)
  );

  -- 1. Process each allocation atomically within this transaction
  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_alloc_id    := NULLIF(v_alloc->>'id', '')::UUID;
    v_alloc_count := COALESCE((v_alloc->>'count')::NUMERIC, 1);

    IF v_alloc_id IS NULL THEN
      RAISE EXCEPTION 'Allocation id is required';
    END IF;

    -- Lock row for update to prevent concurrent settlement race
    SELECT *
      INTO v_parent
      FROM token_transactions
     WHERE id = v_alloc_id
       AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
      -- Skip allocations that don't belong to this tenant (do not silently corrupt)
      RAISE EXCEPTION 'Token transaction % not found for this tenant', v_alloc_id;
    END IF;

    v_available   := COALESCE(v_parent.remaining_quantity, v_parent.quantity, 1);
    v_surrender_qty := LEAST(v_available, GREATEST(1, v_alloc_count));
    v_unit_val    := COALESCE(
      v_parent.token_value,
      CASE WHEN COALESCE(v_available, 0) > 0
           THEN COALESCE(v_parent.total_amount, 0) / v_available
           ELSE 0
      END,
      0
    );
    v_surrender_val := v_surrender_qty * v_unit_val;

    v_total_value  := v_total_value + v_surrender_val;
    v_total_tokens := v_total_tokens + v_surrender_qty::INTEGER;

    IF v_surrender_qty >= v_available THEN
      -- Full surrender: mark settled, zero remaining
      UPDATE token_transactions
         SET usage_status         = 'settled',
             remaining_quantity   = 0,
             settled_vendor_name  = p_supplier_name,
             notes                = CASE
                                      WHEN notes IS NOT NULL AND notes <> ''
                                      THEN notes || ' | Settled: ' || v_ref_code
                                      ELSE 'Settled with rep: ' || v_ref_code
                                    END
       WHERE id = v_alloc_id;
    ELSE
      -- Partial surrender: decrement parent remaining quantity
      v_new_remaining := v_available - v_surrender_qty;
      UPDATE token_transactions
         SET remaining_quantity = v_new_remaining,
             total_amount       = v_new_remaining * v_unit_val
       WHERE id = v_alloc_id;

      -- Insert settled child row for surrendered portion
      INSERT INTO token_transactions (
        tenant_id, type, invoice_id, redemption_id, client_id, client_name,
        brand_id, brand_name, series_id, series_name, unit_name,
        token_value, quantity, remaining_quantity, total_amount,
        parent_transaction_id, usage_status, settled_vendor_name, notes
      ) VALUES (
        p_tenant_id,
        v_parent.type,
        v_parent.invoice_id,
        v_parent.redemption_id,
        v_parent.client_id,
        v_parent.client_name,
        v_parent.brand_id,
        v_parent.brand_name,
        v_parent.series_id,
        v_parent.series_name,
        v_parent.unit_name,
        v_unit_val,
        v_surrender_qty,
        0,
        v_surrender_val,
        v_parent.id,
        'settled',
        p_supplier_name,
        'Partial surrender from #' || left(v_parent.id::text, 8) || ': ' || v_ref_code
      );
    END IF;
  END LOOP;

  -- 2. If vendor_rep_credit and supplier_id is set, create payment voucher atomically
  v_voucher_id := NULL;
  IF p_settlement_type = 'vendor_rep_credit' AND p_supplier_id IS NOT NULL AND v_total_value > 0 THEN
    -- Lock supplier row
    SELECT *
      INTO v_supplier
      FROM suppliers
     WHERE id = p_supplier_id
       AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_voucher_no := 'VTK-' || upper(to_hex(floor(extract(epoch from now()) * 1000)::bigint % 65535));

      -- Collision-safe voucher_no (retry once)
      WHILE EXISTS (SELECT 1 FROM vouchers WHERE tenant_id = p_tenant_id AND voucher_no = v_voucher_no) LOOP
        v_voucher_no := 'VTK-' || upper(to_hex(floor((extract(epoch from now()) * 1000 + random() * 9999)::bigint % 65535)));
      END LOOP;

      INSERT INTO vouchers (
        tenant_id, voucher_no, voucher_type, party_type, party_id,
        party_name, amount, payment_mode, remarks, created_by, date
      ) VALUES (
        p_tenant_id,
        v_voucher_no,
        'payment',
        'supplier',
        p_supplier_id,
        p_supplier_name,
        v_total_value,
        'token_credit',
        'Token Settlement Credit Slip: ' || v_ref_code,
        'System',
        CURRENT_DATE
      ) RETURNING id INTO v_voucher_id;

      -- Adjust supplier balance
      v_updated_balance := COALESCE(v_supplier.current_balance, 0) - v_total_value;
      UPDATE suppliers
         SET current_balance     = v_updated_balance,
             last_payment_amount = v_total_value,
             last_payment_date   = CURRENT_DATE
       WHERE id = p_supplier_id
         AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- 3. Audit log
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, details
  ) VALUES (
    p_tenant_id,
    p_supplier_name,
    'Token Settlement (Atomic)',
    'settle',
    'token_transactions',
    jsonb_build_object(
      'claim_reference',    v_ref_code,
      'settlement_type',    p_settlement_type,
      'supplier_id',        p_supplier_id,
      'supplier_name',      p_supplier_name,
      'total_tokens',       v_total_tokens,
      'total_value',        v_total_value,
      'allocations_count',  jsonb_array_length(p_allocations),
      'voucher_id',         v_voucher_id
    )
  );

  RETURN jsonb_build_object(
    'settled_count',        v_total_tokens,
    'total_settled_value',  v_total_value,
    'voucher_id',           v_voucher_id,
    'claim_reference',      v_ref_code
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION settle_tokens_atomic(UUID, JSONB, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
