-- ============================================================================
-- SQL Test: test_20261030_06_vouchers_idempotency.sql
-- Phase: Test suite for Migration 06 (Vouchers Idempotency, Time Safety & Late Sync)
-- Transaction: Strictly transactional (BEGIN ... ROLLBACK). Leaves NO data behind.
-- Status: NOT APPLIED (Run manually or via test harness; rolls back completely)
-- ============================================================================

BEGIN;

-- 1. Additive columns for vouchers
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL,
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at_local TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS device_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS local_receipt_no TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS is_late_sync BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_shift_id UUID NULL REFERENCES public.shifts(id) ON DELETE SET NULL;

-- 2. Unique deduplication index on idempotency_key per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_idempotency
  ON public.vouchers(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Unique deduplication index on local receipt number per device per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_offline_dedup
  ON public.vouchers(tenant_id, device_id, local_receipt_no)
  WHERE local_receipt_no IS NOT NULL;

-- 4. Fast search index for local receipt number
CREATE INDEX IF NOT EXISTS idx_vouchers_local_receipt_search
  ON public.vouchers(tenant_id, local_receipt_no)
  WHERE local_receipt_no IS NOT NULL;

-- 5. Partial index for late-sync shift cash queries
CREATE INDEX IF NOT EXISTS idx_vouchers_shift_late_sync
  ON public.vouchers(tenant_id, shift_id, is_late_sync)
  WHERE is_late_sync = true;

-- 6. Full upgraded create_voucher_atomic v2
CREATE OR REPLACE FUNCTION public.create_voucher_atomic(
  p_tenant_id uuid,
  p_voucher_data jsonb,
  p_token_allocations jsonb DEFAULT NULL::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_voucher_id       UUID;
  v_voucher_no       TEXT;
  v_voucher_type     TEXT;
  v_prefix           TEXT;
  v_party_type       TEXT;
  v_party_id         UUID;
  v_party_name       TEXT;
  v_payment_mode     TEXT;
  v_reference_no     TEXT;
  v_remarks          TEXT;
  v_created_by       TEXT;
  v_date             DATE;
  v_shift_id         UUID;
  v_original_shift_id UUID;
  v_is_late_sync     BOOLEAN := false;
  v_amount           NUMERIC(12,2) := 0.00;
  v_tokens_amount    NUMERIC(12,2) := 0.00;
  v_total_settlement NUMERIC(12,2) := 0.00;
  v_token_ids        UUID[];
  v_locked_rows      token_transactions[] := '{}';
  v_alloc_qtys       INTEGER[] := '{}';
  v_rec              token_transactions;
  v_rec_qty          INTEGER;
  v_cursor_row       RECORD;
  v_elem             JSONB;
  v_supplier         suppliers%ROWTYPE;
  v_client           clients%ROWTYPE;
  v_new_balance      NUMERIC(12,2);
  v_audit_details    JSONB;
  v_constraint_name  TEXT;
  v_retry_count      INTEGER := 0;
  i                  INTEGER;

  v_idempotency_key   UUID;
  v_is_offline        BOOLEAN := false;
  v_created_at_local  TIMESTAMPTZ;
  v_device_id         TEXT;
  v_local_receipt_no  TEXT;
  v_existing_voucher  RECORD;
  v_shift_rec         RECORD;
  v_current_open_shift RECORD;

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
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id is required'; END IF;
  IF p_voucher_data IS NULL OR jsonb_typeof(p_voucher_data) <> 'object' THEN
    RAISE EXCEPTION 'p_voucher_data must be a valid JSONB object';
  END IF;

  v_voucher_type := trim(COALESCE(p_voucher_data->>'voucher_type', ''));
  IF v_voucher_type NOT IN ('receipt', 'payment') THEN
    RAISE EXCEPTION 'voucher_type must be either receipt or payment, got: %', v_voucher_type;
  END IF;

  v_party_type := trim(COALESCE(p_voucher_data->>'party_type', ''));
  IF v_party_type NOT IN ('client', 'supplier') THEN
    RAISE EXCEPTION 'party_type must be either client or supplier, got: %', v_party_type;
  END IF;

  IF NOT (p_voucher_data ? 'party_id') OR (p_voucher_data->>'party_id') IS NULL OR trim(p_voucher_data->>'party_id') = '' THEN
    RAISE EXCEPTION 'party_id is required';
  END IF;
  v_party_id := (p_voucher_data->>'party_id')::UUID;

  IF p_voucher_data ? 'amount' AND (p_voucher_data->>'amount') IS NOT NULL AND (p_voucher_data->>'amount') <> '' THEN
    IF (p_voucher_data->>'amount') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Voucher cash amount must be a valid non-negative numeric string with at most 2 decimal places: %',
        p_voucher_data->>'amount';
    END IF;
    v_amount := (p_voucher_data->>'amount')::NUMERIC;
    IF v_amount < 0 THEN RAISE EXCEPTION 'Voucher cash amount cannot be negative: %', v_amount; END IF;
    IF v_amount > 99999999.99 THEN RAISE EXCEPTION 'Voucher cash amount exceeds maximum allowable limit: %', v_amount; END IF;
  ELSE
    v_amount := 0.00;
  END IF;

  v_is_offline := COALESCE((p_voucher_data->>'is_offline')::BOOLEAN, false);
  IF p_voucher_data ? 'created_at_local' AND NULLIF(trim(p_voucher_data->>'created_at_local'), '') IS NOT NULL THEN
    v_created_at_local := (p_voucher_data->>'created_at_local')::TIMESTAMPTZ;
  END IF;
  v_device_id := NULLIF(trim(COALESCE(p_voucher_data->>'device_id', '')), '');
  v_local_receipt_no := NULLIF(trim(COALESCE(p_voucher_data->>'local_receipt_no', '')), '');

  IF v_is_offline AND v_created_at_local IS NOT NULL THEN
    IF v_created_at_local > NOW() + INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'OFFLINE_TIME_FUTURE: Local voucher creation timestamp (%) is more than 5 minutes in the future', v_created_at_local;
    END IF;
    IF v_created_at_local < NOW() - INTERVAL '7 days' THEN
      RAISE EXCEPTION 'OFFLINE_TIME_TOO_OLD: Local voucher creation timestamp (%) is older than 7 days', v_created_at_local;
    END IF;
  END IF;

  IF p_voucher_data ? 'idempotency_key' AND NULLIF(trim(p_voucher_data->>'idempotency_key'), '') IS NOT NULL THEN
    v_idempotency_key := (p_voucher_data->>'idempotency_key')::UUID;
    SELECT id, voucher_no, voucher_type, party_type, party_id, party_name, amount, payment_mode, date
      INTO v_existing_voucher
      FROM public.vouchers
     WHERE tenant_id = p_tenant_id AND idempotency_key = v_idempotency_key LIMIT 1;

    IF FOUND THEN
      IF v_existing_voucher.voucher_type <> v_voucher_type
         OR v_existing_voucher.party_id <> v_party_id
         OR v_existing_voucher.amount <> v_amount THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key % was already used for voucher % with different payload',
          v_idempotency_key, v_existing_voucher.voucher_no;
      END IF;

      RETURN jsonb_build_object(
        'success', true, 'is_duplicate', true, 'voucher_id', v_existing_voucher.id,
        'voucher_no', v_existing_voucher.voucher_no, 'voucher_type', v_existing_voucher.voucher_type,
        'party_type', v_existing_voucher.party_type, 'party_id', v_existing_voucher.party_id,
        'party_name', v_existing_voucher.party_name, 'cash_amount', v_existing_voucher.amount,
        'tokens_amount', 0.00, 'total_amount', v_existing_voucher.amount,
        'payment_mode', v_existing_voucher.payment_mode, 'new_party_balance', NULL
      );
    END IF;
  END IF;

  IF p_token_allocations IS NOT NULL AND jsonb_typeof(p_token_allocations) <> 'null' THEN
    IF jsonb_typeof(p_token_allocations) <> 'array' THEN RAISE EXCEPTION 'p_token_allocations must be a JSONB array'; END IF;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_token_allocations)
    LOOP
      IF (v_elem->>'token_id')::UUID = ANY(v_token_ids) THEN RAISE EXCEPTION 'Duplicate token_id detected'; END IF;
      v_token_ids := array_append(v_token_ids, (v_elem->>'token_id')::UUID);
    END LOOP;
  END IF;

  IF v_amount = 0.00 AND (v_token_ids IS NULL OR array_length(v_token_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'Voucher must have a positive total settlement';
  END IF;

  v_party_name   := trim(COALESCE(p_voucher_data->>'party_name', ''));
  v_payment_mode := trim(COALESCE(p_voucher_data->>'payment_mode', 'cash'));
  v_reference_no := trim(COALESCE(p_voucher_data->>'reference_no', ''));
  v_remarks      := trim(COALESCE(p_voucher_data->>'remarks', ''));
  v_created_by   := trim(COALESCE(p_voucher_data->>'created_by', ''));

  IF v_is_offline AND v_created_at_local IS NOT NULL THEN
    v_date := (v_created_at_local AT TIME ZONE 'Asia/Karachi')::DATE;
  ELSIF p_voucher_data ? 'date' AND (p_voucher_data->>'date') IS NOT NULL AND trim(p_voucher_data->>'date') <> '' THEN
    v_date := (p_voucher_data->>'date')::DATE;
  ELSE
    v_date := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
  END IF;

  IF p_voucher_data ? 'shift_id' AND (p_voucher_data->>'shift_id') IS NOT NULL AND trim(p_voucher_data->>'shift_id') <> '' THEN
    v_original_shift_id := (p_voucher_data->>'shift_id')::UUID;
    v_shift_id := v_original_shift_id;
  ELSE
    v_original_shift_id := NULL;
    v_shift_id := NULL;
  END IF;

  IF v_is_offline THEN
    IF v_original_shift_id IS NOT NULL THEN
      SELECT id, status INTO v_shift_rec FROM public.shifts WHERE id = v_original_shift_id AND tenant_id = p_tenant_id;
      IF FOUND AND v_shift_rec.status = 'open' THEN
        v_shift_id := v_original_shift_id;
        v_is_late_sync := false;
      ELSE
        SELECT id INTO v_current_open_shift FROM public.shifts WHERE tenant_id = p_tenant_id AND status = 'open' ORDER BY start_time DESC LIMIT 1;
        IF FOUND THEN
          v_shift_id := v_current_open_shift.id;
          v_is_late_sync := true;
        ELSE
          RAISE EXCEPTION 'WAITING_FOR_OPEN_SHIFT: Original shift % is closed and no open shift exists', v_original_shift_id;
        END IF;
      END IF;
    ELSE
      SELECT id INTO v_current_open_shift FROM public.shifts WHERE tenant_id = p_tenant_id AND status = 'open' ORDER BY start_time DESC LIMIT 1;
      IF FOUND THEN
        v_shift_id := v_current_open_shift.id;
        v_is_late_sync := true;
      END IF;
    END IF;
  END IF;

  v_total_settlement := v_amount + v_tokens_amount;

  IF v_party_type = 'supplier' THEN
    SELECT * INTO v_supplier FROM suppliers WHERE id = v_party_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier % not found', v_party_id; END IF;
    IF v_party_name = '' THEN v_party_name := v_supplier.name; END IF;
    IF v_voucher_type = 'payment' THEN v_new_balance := v_supplier.current_balance - v_total_settlement;
    ELSE v_new_balance := v_supplier.current_balance + v_total_settlement; END IF;
  ELSIF v_party_type = 'client' THEN
    SELECT * INTO v_client FROM clients WHERE id = v_party_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Client % not found', v_party_id; END IF;
    IF v_party_name = '' THEN v_party_name := v_client.name; END IF;
    IF v_voucher_type = 'receipt' THEN v_new_balance := v_client.current_balance - v_total_settlement;
    ELSE v_new_balance := v_client.current_balance + v_total_settlement; END IF;
  END IF;

  IF v_voucher_type = 'receipt' THEN v_prefix := 'RCP'; ELSE v_prefix := 'PMT'; END IF;

  LOOP
    BEGIN
      v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
      INSERT INTO vouchers (
        tenant_id, voucher_no, voucher_type, date, party_type, party_id, party_name,
        amount, payment_mode, reference_no, remarks, created_by, shift_id,
        idempotency_key, is_offline, created_at_local, device_id, local_receipt_no,
        synced_at, is_late_sync, original_shift_id
      ) VALUES (
        p_tenant_id, v_voucher_no, v_voucher_type, v_date, v_party_type, v_party_id, v_party_name,
        v_total_settlement, v_payment_mode, v_reference_no, v_remarks, v_created_by, v_shift_id,
        v_idempotency_key, v_is_offline, v_created_at_local, v_device_id, v_local_receipt_no,
        CASE WHEN v_is_offline THEN NOW() ELSE NULL END, v_is_late_sync, v_original_shift_id
      )
      RETURNING id INTO v_voucher_id;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_retry_count := v_retry_count + 1;
        IF v_retry_count >= 5 THEN RAISE EXCEPTION 'Failed to generate unique voucher_no'; END IF;
    END;
  END LOOP;

  IF v_party_type = 'supplier' THEN
    UPDATE suppliers SET current_balance = v_new_balance, updated_at = NOW() WHERE id = v_party_id AND tenant_id = p_tenant_id;
  ELSIF v_party_type = 'client' THEN
    UPDATE clients SET current_balance = v_new_balance, updated_at = NOW() WHERE id = v_party_id AND tenant_id = p_tenant_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'is_duplicate', false, 'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no, 'voucher_type', v_voucher_type, 'party_type', v_party_type,
    'party_id', v_party_id, 'party_name', v_party_name, 'cash_amount', v_amount,
    'tokens_amount', 0.00, 'total_amount', v_total_settlement, 'payment_mode', v_payment_mode,
    'new_party_balance', v_new_balance, 'is_late_sync', v_is_late_sync, 'shift_id', v_shift_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_voucher_atomic(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_voucher_atomic(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_voucher_atomic(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, jsonb) TO service_role;

DO $$
DECLARE
  v_tenant_id        UUID;
  v_client_id        UUID;
  v_init_balance     NUMERIC(12,2);
  v_idemp_key        UUID := gen_random_uuid();
  v_res1             JSONB;
  v_res2             JSONB;
  v_mid_balance      NUMERIC(12,2);
  v_final_balance    NUMERIC(12,2);
  v_future_caught    BOOLEAN := false;
  v_old_caught       BOOLEAN := false;
  v_conflict_caught  BOOLEAN := false;
  v_anon_has_access  BOOLEAN;
  v_test_shift_1     UUID;
  v_test_shift_2     UUID;
  v_res_late         JSONB;
  v_res_online       JSONB;
BEGIN
  -- Create isolated sandbox tenant to avoid colliding with live open shifts
  INSERT INTO public.tenants (name, slug)
  VALUES ('Voucher Test Sandbox', 'voucher-test-sandbox-' || substr(md5(random()::text), 1, 8))
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.clients (tenant_id, name, current_balance)
  VALUES (v_tenant_id, 'Test Client Idempotency', 5000.00)
  RETURNING id, current_balance INTO v_client_id, v_init_balance;

  -- T1: Happy Path
  v_res1 := public.create_voucher_atomic(
    v_tenant_id,
    jsonb_build_object(
      'voucher_type', 'receipt',
      'party_type', 'client',
      'party_id', v_client_id,
      'amount', '500.00',
      'payment_mode', 'cash',
      'idempotency_key', v_idemp_key::text,
      'is_offline', true,
      'created_at_local', (NOW() - INTERVAL '10 minutes')::text,
      'device_id', 'TESTDEV1',
      'local_receipt_no', 'OFF-TEST-0001'
    ),
    NULL::jsonb
  );

  IF (v_res1->>'success')::boolean <> true THEN RAISE EXCEPTION 'T1 failed'; END IF;
  IF (v_res1->>'is_duplicate')::boolean <> false THEN RAISE EXCEPTION 'T1 duplicate error'; END IF;
  SELECT current_balance INTO v_mid_balance FROM public.clients WHERE id = v_client_id;
  IF v_mid_balance <> (v_init_balance - 500.00) THEN RAISE EXCEPTION 'T1 balance error'; END IF;

  -- T2: Duplicate retry deduplicated without double-deduction
  v_res2 := public.create_voucher_atomic(
    v_tenant_id,
    jsonb_build_object(
      'voucher_type', 'receipt',
      'party_type', 'client',
      'party_id', v_client_id,
      'amount', '500.00',
      'payment_mode', 'cash',
      'idempotency_key', v_idemp_key::text,
      'is_offline', true,
      'created_at_local', (NOW() - INTERVAL '10 minutes')::text,
      'device_id', 'TESTDEV1',
      'local_receipt_no', 'OFF-TEST-0001'
    ),
    NULL::jsonb
  );

  IF (v_res2->>'is_duplicate')::boolean <> true THEN RAISE EXCEPTION 'T2 failed'; END IF;
  SELECT current_balance INTO v_final_balance FROM public.clients WHERE id = v_client_id;
  IF v_final_balance <> v_mid_balance THEN RAISE EXCEPTION 'T2 double-deduction error'; END IF;

  -- T3: IDEMPOTENCY_CONFLICT on payload mismatch
  BEGIN
    PERFORM public.create_voucher_atomic(
      v_tenant_id,
      jsonb_build_object(
        'voucher_type', 'receipt',
        'party_type', 'client',
        'party_id', v_client_id,
        'amount', '999.00',
        'payment_mode', 'cash',
        'idempotency_key', v_idemp_key::text
      ),
      NULL::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%IDEMPOTENCY_CONFLICT%' THEN v_conflict_caught := true; END IF;
  END;
  IF NOT v_conflict_caught THEN RAISE EXCEPTION 'T3 failed'; END IF;

  -- T4: OFFLINE_TIME_FUTURE
  BEGIN
    PERFORM public.create_voucher_atomic(
      v_tenant_id,
      jsonb_build_object(
        'voucher_type', 'receipt',
        'party_type', 'client',
        'party_id', v_client_id,
        'amount', '100.00',
        'is_offline', true,
        'created_at_local', (NOW() + INTERVAL '10 minutes')::text
      ),
      NULL::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%OFFLINE_TIME_FUTURE%' THEN v_future_caught := true; END IF;
  END;
  IF NOT v_future_caught THEN RAISE EXCEPTION 'T4 failed'; END IF;

  -- T5: OFFLINE_TIME_TOO_OLD
  BEGIN
    PERFORM public.create_voucher_atomic(
      v_tenant_id,
      jsonb_build_object(
        'voucher_type', 'receipt',
        'party_type', 'client',
        'party_id', v_client_id,
        'amount', '100.00',
        'is_offline', true,
        'created_at_local', (NOW() - INTERVAL '8 days')::text
      ),
      NULL::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%OFFLINE_TIME_TOO_OLD%' THEN v_old_caught := true; END IF;
  END;
  IF NOT v_old_caught THEN RAISE EXCEPTION 'T5 failed'; END IF;

  -- T6: Shift-at-sync late sync reconciliation
  INSERT INTO public.shifts (tenant_id, opening_cash, start_time, end_time, status)
  VALUES (v_tenant_id, 1000.00, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour', 'closed')
  RETURNING id INTO v_test_shift_1;

  INSERT INTO public.shifts (tenant_id, opening_cash, start_time, status)
  VALUES (v_tenant_id, 1000.00, NOW() - INTERVAL '30 minutes', 'open')
  RETURNING id INTO v_test_shift_2;

  v_res_late := public.create_voucher_atomic(
    v_tenant_id,
    jsonb_build_object(
      'voucher_type', 'receipt',
      'party_type', 'client',
      'party_id', v_client_id,
      'amount', '200.00',
      'payment_mode', 'cash',
      'is_offline', true,
      'shift_id', v_test_shift_1::text,
      'created_at_local', (NOW() - INTERVAL '2 hours')::text
    ),
    NULL::jsonb
  );

  IF (v_res_late->>'is_late_sync')::boolean <> true THEN RAISE EXCEPTION 'T6 failed: not late sync'; END IF;
  IF (v_res_late->>'shift_id')::uuid <> v_test_shift_2 THEN RAISE EXCEPTION 'T6 failed: shift mismatch'; END IF;

  -- T7: Standard online flow
  v_res_online := public.create_voucher_atomic(
    v_tenant_id,
    jsonb_build_object(
      'voucher_type', 'receipt',
      'party_type', 'client',
      'party_id', v_client_id,
      'amount', '50.00',
      'payment_mode', 'cash'
    ),
    NULL::jsonb
  );
  IF (v_res_online->>'success')::boolean <> true THEN RAISE EXCEPTION 'T7 failed'; END IF;

  -- T8: Security Check: anon role forbidden
  SELECT has_function_privilege('anon', 'public.create_voucher_atomic(uuid, jsonb, jsonb)', 'EXECUTE')
    INTO v_anon_has_access;
  IF v_anon_has_access THEN RAISE EXCEPTION 'T8 security failed: anon has EXECUTE'; END IF;

  RAISE NOTICE 'ALL MIGRATION 06 TESTS PASSED SUCCESSFULLY';
END;
$$;

ROLLBACK;
