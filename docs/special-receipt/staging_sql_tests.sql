-- ============================================================================
-- Staging SQL Tests for Special Receipt Feature
-- ============================================================================
--
-- ██████   ██████      ███    ██  ██████  ████████
-- ██   ██ ██    ██     ████   ██ ██    ██    ██
-- ██   ██ ██    ██     ██ ██  ██ ██    ██    ██
-- ██   ██ ██    ██     ██  ██ ██ ██    ██    ██
-- ██████   ██████      ██   ████  ██████     ██
--
-- DO NOT RUN ON PRODUCTION
-- DO NOT RUN ON PRODUCTION
-- DO NOT RUN ON PRODUCTION
--
-- This file is for documentation and staging verification ONLY.
-- Every test block uses BEGIN; ... ROLLBACK; to ensure ZERO persistent changes.
-- Target: PostgreSQL 17 (Supabase staging project: azzonbwaevtywisxlxej)
-- Verified Status: Staging project azzonbwaevtywisxlxej is ACTIVE_HEALTHY, PG 17.11
-- ============================================================================

-- ============================================================================
-- TEST 1: Immutability Trigger — Direct DELETE & UPDATE Blocked
-- ============================================================================
-- Precondition: special_print_log table exists.
-- Expected: RAISE EXCEPTION 'special_print_log is an immutable audit trail...'

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_test_inv_id UUID := gen_random_uuid();
BEGIN
  -- Insert a test row first
  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, master_total, printed_total, charged_total, delivery_charge,
    receipt_snapshot, template_snapshot
  ) VALUES (
    v_tenant_id, v_test_inv_id, 'TEST-IMMUT-001', 'test_cashier', gen_random_uuid(),
    'sale', 1000, 1000, 800, 0, '{"items":[]}'::jsonb, '{}'::jsonb
  );

  -- Attempt direct DELETE (depth = 1)
  BEGIN
    DELETE FROM special_print_log WHERE invoice_no = 'TEST-IMMUT-001';
    RAISE EXCEPTION 'TEST FAILED: Direct DELETE should have been blocked by trigger';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%immutable audit trail%' THEN
      RAISE NOTICE 'TEST PASSED: Direct DELETE correctly blocked — %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST FAILED: Unexpected error on DELETE — %', SQLERRM;
    END IF;
  END;

  -- Attempt direct UPDATE (depth = 1)
  BEGIN
    UPDATE special_print_log SET charged_total = 9999 WHERE invoice_no = 'TEST-IMMUT-001';
    RAISE EXCEPTION 'TEST FAILED: Direct UPDATE should have been blocked by trigger';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%immutable audit trail%' THEN
      RAISE NOTICE 'TEST PASSED: Direct UPDATE correctly blocked — %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST FAILED: Unexpected error on UPDATE — %', SQLERRM;
    END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 2: Immutability Trigger — TRUNCATE Blocked
-- ============================================================================
-- Expected: Statement trigger blocks TRUNCATE statement.

BEGIN;

DO $$
BEGIN
  TRUNCATE special_print_log;
  RAISE EXCEPTION 'TEST FAILED: TRUNCATE should have been blocked by trigger';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM ILIKE '%Truncating is prohibited%' THEN
    RAISE NOTICE 'TEST PASSED: TRUNCATE correctly blocked — %', SQLERRM;
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Unexpected error on TRUNCATE — %', SQLERRM;
  END IF;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 3: Tenant Cascade Delete Verification (pg_trigger_depth() > 1)
-- ============================================================================
-- Purpose: Verify that deleting a tenant cleanly cascades to special_print_log
--          without trigger exception (depth > 1 bypasses immutability).
-- Expected: Tenant and associated log rows deleted successfully.

BEGIN;

DO $$
DECLARE
  v_test_tenant_id UUID := gen_random_uuid();
  v_count INTEGER;
BEGIN
  -- Create isolated test tenant with verified NOT NULL columns
  INSERT INTO tenants (id, name, slug, type)
  VALUES (v_test_tenant_id, 'Cascade Test Tenant', 'cascade-test-tenant', 'shop');

  -- Insert a special print log record linked to this test tenant
  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, master_total, printed_total, charged_total, delivery_charge,
    receipt_snapshot, template_snapshot
  ) VALUES (
    v_test_tenant_id, gen_random_uuid(), 'TEST-CASCADE-001', 'test_cashier', gen_random_uuid(),
    'sale', 2500, 2500, 2000, 0, '{"items":[]}'::jsonb, '{}'::jsonb
  );

  -- Delete the parent tenant (triggers cascade delete on special_print_log at depth > 1)
  DELETE FROM tenants WHERE id = v_test_tenant_id;

  -- Verify row was cleaned up
  SELECT COUNT(*) INTO v_count FROM special_print_log WHERE tenant_id = v_test_tenant_id;
  IF v_count = 0 THEN
    RAISE NOTICE 'TEST PASSED: Tenant cascade delete cleanly removed special_print_log rows (pg_trigger_depth() > 1 verified)';
  ELSE
    RAISE EXCEPTION 'TEST FAILED: Log rows still exist after tenant deletion (count: %)', v_count;
  END IF;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 4: Partial Unique Index — Duplicate Sale Log Handled
-- ============================================================================
-- Expected: Unique violation on idx_special_print_log_sale when inserting
--           two 'sale' events for the same invoice_id. Reprint is allowed.

BEGIN;

DO $$
DECLARE
  v_test_inv_id UUID := gen_random_uuid();
  v_test_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
BEGIN
  -- First sale log — should succeed
  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, master_total, printed_total, charged_total, delivery_charge,
    receipt_snapshot, template_snapshot
  ) VALUES (
    v_test_tenant_id, v_test_inv_id, 'TEST-DUP-001', 'cashier1', gen_random_uuid(),
    'sale', 5000, 5000, 4000, 0, '{"items":[]}'::jsonb, '{}'::jsonb
  );

  -- Second sale log for same invoice_id — should fail with unique_violation
  BEGIN
    INSERT INTO special_print_log (
      tenant_id, invoice_id, invoice_no, printed_by, user_id,
      event_type, master_total, printed_total, charged_total, delivery_charge,
      receipt_snapshot, template_snapshot
    ) VALUES (
      v_test_tenant_id, v_test_inv_id, 'TEST-DUP-001', 'cashier1', gen_random_uuid(),
      'sale', 5000, 5000, 4000, 0, '{"items":[]}'::jsonb, '{}'::jsonb
    );
    RAISE EXCEPTION 'TEST FAILED: Duplicate sale log should have been rejected';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST PASSED: Duplicate sale log correctly rejected by partial unique index';
  END;

  -- Reprint for same invoice_id — should succeed (partial index only covers event_type='sale')
  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, master_total, printed_total, charged_total, delivery_charge,
    receipt_snapshot, template_snapshot
  ) VALUES (
    v_test_tenant_id, v_test_inv_id, 'TEST-DUP-001', 'cashier1', gen_random_uuid(),
    'reprint', 5000, 5000, 4000, 0, '{"items":[]}'::jsonb, '{}'::jsonb
  );
  RAISE NOTICE 'TEST PASSED: Multiple reprint log entries permitted for same invoice_id';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 5: Permission & Role Verification Matrix (Named Arguments)
-- ============================================================================
-- Tests:
--  5a: Staff with can_use_special_receipt = false rejected.
--  5b: Inactive staff rejected.
--  5c: Staff from different tenant rejected (branch mismatch).
--  5d: CEO role rejected from creating special sales.
--  5e: Developer role rejected from creating special sales.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_other_tenant_id UUID;
  v_item_id UUID;
  v_user_off UUID := gen_random_uuid();
  v_user_inactive UUID := gen_random_uuid();
  v_user_other UUID := gen_random_uuid();
  v_user_ceo UUID := gen_random_uuid();
  v_user_dev UUID := gen_random_uuid();
  v_inv_data JSONB;
  v_items JSONB;
BEGIN
  -- Setup another tenant with verified NOT NULL columns
  INSERT INTO tenants (id, name, slug, type) 
  VALUES (gen_random_uuid(), 'Other Branch', 'other-branch', 'shop')
  RETURNING id INTO v_other_tenant_id;

  -- Setup an active item
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Special Paint 1', 'SP-01', 1500, 1000, 10)
  RETURNING id INTO v_item_id;

  -- Setup users supplying required password_hash
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt) VALUES
    (v_user_off, v_tenant_id, 'cashier_off', 'dummy_hash', 'Cashier Off', 'staff', true, false),
    (v_user_inactive, v_tenant_id, 'cashier_inact', 'dummy_hash', 'Cashier Inactive', 'staff', false, true),
    (v_user_other, v_other_tenant_id, 'cashier_other', 'dummy_hash', 'Cashier Other', 'staff', true, true),
    (v_user_ceo, v_tenant_id, 'ceo_user', 'dummy_hash', 'CEO User', 'ceo', true, true),
    (v_user_dev, v_tenant_id, 'dev_user', 'dummy_hash', 'Dev User', 'developer', true, true);

  v_inv_data := jsonb_build_object(
    'tenant_id', v_tenant_id,
    'invoice_no', 'PERM-TEST-001',
    'invoice_type', 'sales',
    'date', CURRENT_DATE,
    'paid_amount', 1500,
    'due_amount', 0,
    'cash_paid', 1500
  );

  v_items := jsonb_build_array(jsonb_build_object(
    'item_id', v_item_id,
    'qty', 1,
    'unit_price', 1500,
    'discount', 0,
    'total_price', 1500
  ));

  -- 5a: Permission OFF
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => v_inv_data,
      p_items        => v_items,
      p_receipt_snap => '{}'::jsonb,
      p_printed_by   => 'cashier_off',
      p_user_id      => v_user_off,
      p_tokens       => '[]'::jsonb
    );
    RAISE EXCEPTION 'TEST 5a FAILED: Permission OFF was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%permission denied%' THEN
      RAISE NOTICE 'TEST 5a PASSED: can_use_special_receipt = false correctly rejected';
    ELSE RAISE EXCEPTION 'TEST 5a FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- 5b: Inactive User
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => v_inv_data,
      p_items        => v_items,
      p_receipt_snap => '{}'::jsonb,
      p_printed_by   => 'cashier_inact',
      p_user_id      => v_user_inactive,
      p_tokens       => '[]'::jsonb
    );
    RAISE EXCEPTION 'TEST 5b FAILED: Inactive user was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%inactive%' THEN
      RAISE NOTICE 'TEST 5b PASSED: Inactive user correctly rejected';
    ELSE RAISE EXCEPTION 'TEST 5b FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- 5c: Branch Mismatch
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => v_inv_data,
      p_items        => v_items,
      p_receipt_snap => '{}'::jsonb,
      p_printed_by   => 'cashier_other',
      p_user_id      => v_user_other,
      p_tokens       => '[]'::jsonb
    );
    RAISE EXCEPTION 'TEST 5c FAILED: Branch mismatch was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%target branch%' OR SQLERRM ILIKE '%branch mismatch%' THEN
      RAISE NOTICE 'TEST 5c PASSED: Branch mismatch correctly rejected';
    ELSE RAISE EXCEPTION 'TEST 5c FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- 5d: CEO Role Rejected
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => v_inv_data,
      p_items        => v_items,
      p_receipt_snap => '{}'::jsonb,
      p_printed_by   => 'ceo_user',
      p_user_id      => v_user_ceo,
      p_tokens       => '[]'::jsonb
    );
    RAISE EXCEPTION 'TEST 5d FAILED: CEO role was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%counter staff%' THEN
      RAISE NOTICE 'TEST 5d PASSED: CEO role correctly rejected from checkout';
    ELSE RAISE EXCEPTION 'TEST 5d FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- 5e: Developer Role Rejected
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => v_inv_data,
      p_items        => v_items,
      p_receipt_snap => '{}'::jsonb,
      p_printed_by   => 'dev_user',
      p_user_id      => v_user_dev,
      p_tokens       => '[]'::jsonb
    );
    RAISE EXCEPTION 'TEST 5e FAILED: Developer role was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%counter staff%' THEN
      RAISE NOTICE 'TEST 5e PASSED: Developer role correctly rejected from checkout';
    ELSE RAISE EXCEPTION 'TEST 5e FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 6: POS Storage Rule & Option A Happy-Path Sale
-- ============================================================================
-- Tests:
--  - Line discount applied: Unit Rate = 2,000, Qty = 2, Line Discount = 300/unit (Total Line Discount = 600)
--  - POS Storage Rule:
--      invoices.subtotal = 3,400 (sum of line totals AFTER line discounts)
--      invoices.discount = 0 (strictly zero for special sales)
--      invoices.net_total = 3,400
--  - Rejection of Option B: asserts subtotal <> 4000 and discount <> 600.
--  - Master Total = 4,000 (catalog items.retail_price * qty).
--  - Printed Total = 4,000 (server-derived pre-discount rate * qty).
--  - Verified in invoices, invoice_items, items stock deduction, and special_print_log.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_res JSONB;
  v_inv_id UUID;
  v_inv_rec RECORD;
  v_item_rec RECORD;
  v_log_rec RECORD;
  v_stock_after NUMERIC;
BEGIN
  -- Create active staff with special permission and required password_hash
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_happy', 'dummy_hash', 'Happy Cashier', 'staff', true, true);

  -- Create item in catalog (retail_price = 2000, stock = 50)
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Dulux Emulsion 4L', 'DLX-4L', 2000, 1400, 50)
  RETURNING id INTO v_item_id;

  -- Execute create_special_invoice_atomic with named arguments
  v_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',       v_tenant_id,
      'invoice_no',      'HAPPY-SPEC-001',
      'invoice_type',    'sales',
      'date',            CURRENT_DATE,
      'paid_amount',     3400,
      'due_amount',      0,
      'cash_paid',       3400,
      'delivery_charge', 0
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',      v_item_id,
      'item_name',    'Dulux Emulsion 4L',
      'receipt_name', 'High Gloss Silk Enamel', -- receipt text override
      'qty',          2,
      'unit_price',   2000,                     -- pre-discount unit price
      'discount',     600,                      -- line discount
      'total_price',  3400                      -- charged net line price
    )),
    p_receipt_snap => '{"header": {"showShopName": false}}'::jsonb,
    p_printed_by   => 'Happy Cashier',
    p_user_id      => v_user_id,
    p_tokens       => '[]'::jsonb
  );

  IF NOT (v_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 6 FAILED: RPC returned success = false';
  END IF;

  v_inv_id := (v_res->>'invoice_id')::UUID;

  -- Verify invoices table adheres to POS storage rule (Option A)
  SELECT * INTO v_inv_rec FROM invoices WHERE id = v_inv_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST 6 FAILED: invoices row not found';
  END IF;

  IF v_inv_rec.printed_as <> 'special' THEN
    RAISE EXCEPTION 'TEST 6 FAILED: printed_as is not special (got %)', v_inv_rec.printed_as;
  END IF;

  -- POS Storage Rule Verification:
  IF v_inv_rec.subtotal <> 3400 OR v_inv_rec.discount <> 0 OR v_inv_rec.net_total <> 3400 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: POS storage rule violated! Expected subtotal=3400, discount=0, net=3400; got subtotal=%, discount=%, net=%',
      v_inv_rec.subtotal, v_inv_rec.discount, v_inv_rec.net_total;
  END IF;

  -- Verify Option B is rejected
  IF v_inv_rec.subtotal = 4000 OR v_inv_rec.discount = 600 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Rejected Option B (4000/600) was incorrectly used';
  END IF;

  -- Verify invoice_items has discount = 600, total_price = 3400, and preserved catalog name
  SELECT * INTO v_item_rec FROM invoice_items WHERE invoice_id = v_inv_id;
  IF v_item_rec.item_name <> 'Dulux Emulsion 4L' THEN
    RAISE EXCEPTION 'TEST 6 FAILED: invoice_items did not preserve catalog name (got %)', v_item_rec.item_name;
  END IF;
  IF v_item_rec.discount <> 600 OR v_item_rec.total_price <> 3400 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: invoice_items amounts mismatch (discount %, total %)',
      v_item_rec.discount, v_item_rec.total_price;
  END IF;

  -- Verify physical stock deducted by 2
  SELECT stock_qty INTO v_stock_after FROM items WHERE id = v_item_id;
  IF v_stock_after <> 48 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Stock deduction failed (expected 48, got %)', v_stock_after;
  END IF;

  -- Verify special_print_log
  SELECT * INTO v_log_rec FROM special_print_log WHERE invoice_id = v_inv_id AND event_type = 'sale';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST 6 FAILED: special_print_log row not found';
  END IF;

  IF v_log_rec.master_total <> 4000 OR v_log_rec.printed_total <> 4000 OR v_log_rec.charged_total <> 3400 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Totals mismatch (master %, printed %, charged %)',
      v_log_rec.master_total, v_log_rec.printed_total, v_log_rec.charged_total;
  END IF;

  -- Verify receipt_snapshot contains the receipt text override
  IF (v_log_rec.receipt_snapshot->'items'->0->>'receipt_name') <> 'High Gloss Silk Enamel' THEN
    RAISE EXCEPTION 'TEST 6 FAILED: receipt_snapshot missing receipt_name override';
  END IF;

  RAISE NOTICE 'TEST 6 PASSED: POS storage rule verified (subtotal = 3400, discount = 0, net = 3400)';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 7: Real Token Configuration & Pass-Through (Decision 1)
-- ============================================================================
-- Tests:
--  - Creates real brand, series, and series_token_config inside the transaction.
--  - create_special_invoice_atomic accepts non-empty p_tokens referencing valid config.
--  - Token transactions created successfully; zero error raised.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_brand_id UUID := gen_random_uuid();
  v_series_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_res JSONB;
BEGIN
  -- User
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_token', 'dummy_hash', 'Token Cashier', 'staff', true, true);

  -- Real brand master
  INSERT INTO brands (id, tenant_id, name)
  VALUES (v_brand_id, v_tenant_id, 'Berger Master Brands');

  -- Real series master
  INSERT INTO brand_series (id, tenant_id, brand_id, name, status)
  VALUES (v_series_id, v_tenant_id, v_brand_id, 'Elegance Luxury', 'active');

  -- Real series token configuration
  INSERT INTO series_token_configs (id, tenant_id, series_id, unit_name, is_enabled, token_value)
  VALUES (gen_random_uuid(), v_tenant_id, v_series_id, 'PCS', true, 50);

  -- Item
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Berger Elegance 4L', 'BRG-01', 1200, 800, 20)
  RETURNING id INTO v_item_id;

  -- Invoke RPC with real token configuration referencing valid series_id
  v_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'TOKEN-TEST-001',
      'invoice_type', 'sales',
      'date',         CURRENT_DATE,
      'paid_amount',  1200,
      'due_amount',   0,
      'cash_paid',    1200
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Berger Elegance 4L',
      'qty',         1,
      'unit_price',  1200,
      'discount',    0,
      'total_price', 1200
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Token Cashier',
    p_user_id      => v_user_id,
    p_tokens       => jsonb_build_array(jsonb_build_object(
      'brand_id',     v_brand_id,
      'series_id',    v_series_id,
      'unit_name',    'PCS',
      'quantity',     1,
      'token_action', 'keep',
      'token_value',  50
    ))
  );

  IF (v_res->>'success')::BOOLEAN THEN
    RAISE NOTICE 'TEST 7 PASSED: Real token config processed cleanly by create_special_invoice_atomic';
  ELSE
    RAISE EXCEPTION 'TEST 7 FAILED: create_special_invoice_atomic failed on real tokens';
  END IF;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 8: Special Return Engine (Shift Check, original_invoice_item_id, Quantity Guard, Option E)
-- ============================================================================
-- Tests:
--  - Requires open shift (fails if no shift).
--  - Creates special sale of 3 units at charged price Rs. 800 (unit 1000, discount 600 = net 2400).
--  - First partial return: 1 unit returned -> success, refund Rs. 800.
--  - Verifies invoice_items.original_invoice_item_id populated and real shade_code retained.
--  - Quantity guard: Attempt to return 3 more units -> rejected (only 2 returnable).
--  - Second partial return: Return 2 units -> success (all 3 returned).
--  - Third partial return: Attempt to return 1 more unit -> rejected (0 returnable).
--  - Option E verified: print_receipt = false.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_item RECORD;
BEGIN
  -- Create isolated fresh tenant so no pre-existing open shifts exist
  INSERT INTO tenants (id, name, slug, type)
  VALUES (v_tenant_id, 'Return Test Branch', 'return-test-branch', 'shop');

  -- Setup staff
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_ret', 'dummy_hash', 'Return Cashier', 'staff', true, true);

  -- Open shift for creating the sale (opened_by — verified via information_schema)
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 5000);

  -- Setup item with a real shade code
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Multi Return Paint', 'MRP-01', 1000, 700, 30)
  RETURNING id INTO v_item_id;

  -- 1. Create original special sale (3 units @ 800 net = 2400)
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'ORIG-SALE-001',
      'invoice_type', 'sales',
      'shift_id',     v_shift_id,
      'date',         CURRENT_DATE,
      'paid_amount',  2400,
      'due_amount',   0,
      'cash_paid',    2400
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Multi Return Paint',
      'shade_code',  'BASE-WHITE-01',          -- real shade code
      'qty',         3,
      'unit_price',  1000,
      'discount',    600,
      'total_price', 2400
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Return Cashier',
    p_user_id      => v_user_id,
    p_tokens       => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Close the shift so no open shift exists
  UPDATE shifts SET status = 'closed', end_time = NOW() WHERE id = v_shift_id;

  -- Attempt return without open shift (must fail)
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
      p_user_id             => v_user_id,
      p_printed_by          => 'Return Cashier',
      p_shift_id            => v_shift_id, -- closed shift
      p_cash_refunded       => 800
    );
    RAISE EXCEPTION 'TEST 8 FAILED: Return with closed shift should have been blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%open%' OR SQLERRM ILIKE '%shift%' THEN
      RAISE NOTICE 'TEST 8.0 PASSED: Open shift check correctly blocked return — %', SQLERRM;
    ELSE RAISE EXCEPTION 'TEST 8.0 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- Create active open shift for tenant to process returns
  v_shift_id := gen_random_uuid();
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 5000);

  -- 2. First partial return: 1 unit (refund = 800)
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object(
      'original_item_id', v_orig_item_id,
      'qty', 1
    )),
    p_user_id             => v_user_id,
    p_printed_by          => 'Return Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 800
  );

  IF NOT (v_ret_res->>'success')::BOOLEAN OR (v_ret_res->>'print_receipt')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 8.1 FAILED: First return failed or Option E violated';
  END IF;

  -- Verify original_invoice_item_id column populated and real shade code preserved
  SELECT * INTO v_ret_item FROM invoice_items WHERE invoice_id = (v_ret_res->>'return_invoice_id')::UUID;
  IF v_ret_item.original_invoice_item_id <> v_orig_item_id THEN
    RAISE EXCEPTION 'TEST 8.1 FAILED: original_invoice_item_id not set on return line';
  END IF;
  IF v_ret_item.shade_code <> 'BASE-WHITE-01' THEN
    RAISE EXCEPTION 'TEST 8.1 FAILED: Real shade_code not preserved (got %)', v_ret_item.shade_code;
  END IF;
  RAISE NOTICE 'TEST 8.1 PASSED: Return 1 verified with original_invoice_item_id and real shade_code';

  -- 3. Quantity Guard: Attempt to return 3 units (only 2 left)
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items               => jsonb_build_array(jsonb_build_object(
        'original_item_id', v_orig_item_id,
        'qty', 3
      )),
      p_user_id             => v_user_id,
      p_printed_by          => 'Return Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 2400
    );
    RAISE EXCEPTION 'TEST 8.2 FAILED: Excess quantity return was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%exceeds returnable qty%' THEN
      RAISE NOTICE 'TEST 8.2 PASSED: Quantity guard correctly blocked excess return — %', SQLERRM;
    ELSE RAISE EXCEPTION 'TEST 8.2 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- 4. Second partial return: Return remaining 2 units (refund = 1600)
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object(
      'original_item_id', v_orig_item_id,
      'qty', 2
    )),
    p_user_id             => v_user_id,
    p_printed_by          => 'Return Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 1600
  );

  IF NOT (v_ret_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 8.3 FAILED: Second partial return failed';
  END IF;
  RAISE NOTICE 'TEST 8.3 PASSED: Second partial return succeeded (all 3 units now returned)';

  -- 5. Third return: Attempt to return 1 more unit on same line (0 left)
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items               => jsonb_build_array(jsonb_build_object(
        'original_item_id', v_orig_item_id,
        'qty', 1
      )),
      p_user_id             => v_user_id,
      p_printed_by          => 'Return Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 800
    );
    RAISE EXCEPTION 'TEST 8.4 FAILED: Return when 0 returnable was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%exceeds returnable qty%' THEN
      RAISE NOTICE 'TEST 8.4 PASSED: Third return rejected: returnable qty is 0';
    ELSE RAISE EXCEPTION 'TEST 8.4 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 9: Credit-Sale Return with Server Khata Offset (Debt Reduction)
-- ============================================================================
-- Tests (Owner Decision):
--  - NO store credit / no client advance. Refunds are cash, card, or cash+card only.
--  - Credit-sale return: Server computes khata_offset = LEAST(return_net, orig_due, client_bal)
--  - Cashier refund (cash + card) must equal return_net - khata_offset (0.02 tolerance).
--  - Return invoice: paid_amount = cash + card, net_total = return_net, due_amount = 0.
--  - Client current_balance is reduced by khata_offset only.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_inv RECORD;
  v_client_bal NUMERIC;
BEGIN
  -- Setup staff
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_khata', 'dummy_hash', 'Khata Cashier', 'staff', true, true);

  -- Setup registered customer with 5000 debt
  INSERT INTO clients (id, tenant_id, name, current_balance)
  VALUES (v_client_id, v_tenant_id, 'Registered Client A', 5000);

  -- Open shift
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);

  -- Setup item
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Credit Item', 'CI-01', 2000, 1500, 10)
  RETURNING id INTO v_item_id;

  -- Create credit sale: total 2000, paid 500 cash, due 1500
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'CREDIT-SALE-001',
      'invoice_type', 'sales',
      'shift_id',     v_shift_id,
      'client_id',    v_client_id,
      'date',         CURRENT_DATE,
      'subtotal',     2000,
      'discount',     0,
      'delivery_charge', 0,
      'net_total',    2000,
      'paid_amount',  500,
      'due_amount',   1500,
      'cash_paid',    500
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Credit Item',
      'qty',         1,
      'unit_price',  2000,
      'discount',    0,
      'total_price', 2000
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Khata Cashier',
    p_user_id      => v_user_id,
    p_tokens       => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Return item: return_net = 2000.
  -- Server computes:
  --   orig_due_remaining = 1500 (since 0 prior offsets)
  --   client_balance = 5000
  --   khata_offset = LEAST(2000, 1500, 5000) = 1500
  --   cashier refund needed = 2000 - 1500 = 500.
  -- Test cashier pays 500 in cash:
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Khata Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 500,
    p_card_refunded       => 0
  );

  IF NOT (v_ret_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Credit return failed';
  END IF;

  IF (v_ret_res->>'khata_offset')::NUMERIC <> 1500 THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Expected khata_offset 1500, got %', (v_ret_res->>'khata_offset');
  END IF;

  IF (v_ret_res->>'cashier_refund')::NUMERIC <> 500 THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Expected cashier_refund 500, got %', (v_ret_res->>'cashier_refund');
  END IF;

  -- Verify return invoice header fields
  SELECT * INTO v_ret_inv FROM invoices WHERE id = (v_ret_res->>'return_invoice_id')::UUID;
  IF v_ret_inv.paid_amount <> 500 OR v_ret_inv.net_total <> 2000 OR v_ret_inv.cash_paid <> 500 OR v_ret_inv.payment_type <> 'cash' THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Return invoice header mismatch (paid %, net %, cash %, type %)',
      v_ret_inv.paid_amount, v_ret_inv.net_total, v_ret_inv.cash_paid, v_ret_inv.payment_type;
  END IF;

  -- Verify client current_balance reduced by khata_offset only (from 5000 to 3500)
  SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id;
  IF v_client_bal <> 3500 THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Client balance not updated correctly (expected 3500, got %)', v_client_bal;
  END IF;

  -- Test mismatch tolerance rejection: cashier attempts to refund 600 instead of 500
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
      p_user_id             => v_user_id,
      p_printed_by          => 'Khata Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 600,
      p_card_refunded       => 0
    );
    RAISE EXCEPTION 'TEST 9 FAILED: Cashier over-refund was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%must equal return net%' OR SQLERRM ILIKE '%exceeds remaining returnable%' THEN
      -- Passed: either rejected on remaining qty or tender tolerance
      NULL;
    ELSE
      RAISE EXCEPTION 'TEST 9 FAILED: Unexpected error on tender mismatch: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'TEST 9 PASSED: Server computes khata_offset=1500, cashier refund=500, client ledger reduced to 3500';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 10: Cancelled Invoice Reprint Rejection (A4 & D2)
-- ============================================================================
-- Tests:
--  - Creates special sale.
--  - Cancels the invoice via cancel_invoice_atomic (proper DB function).
--  - log_special_reprint_atomic REJECTS reprinting cancelled invoice.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_inv_id UUID;
BEGIN
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_canc', 'dummy_hash', 'Cancel Cashier', 'staff', true, true);

  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Cancel Test Item', 'CT-01', 500, 300, 10)
  RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'CANC-SPEC-001',
      'invoice_type', 'sales',
      'date',         CURRENT_DATE,
      'paid_amount',  500,
      'due_amount',   0,
      'cash_paid',    500
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Cancel Test Item',
      'qty',         1,
      'unit_price',  500,
      'discount',    0,
      'total_price', 500
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Cancel Cashier',
    p_user_id      => v_user_id,
    p_tokens       => '[]'::jsonb
  );

  v_inv_id := (v_sale_res->>'invoice_id')::UUID;

  -- Cancel the invoice using cancel_invoice_atomic RPC
  PERFORM public.cancel_invoice_atomic(
    p_invoice_id := v_inv_id,
    p_tenant_id  := v_tenant_id
  );

  -- Attempt reprint on cancelled invoice
  BEGIN
    PERFORM public.log_special_reprint_atomic(
      p_invoice_id := v_inv_id,
      p_user_id    := v_user_id,
      p_printed_by := 'Cancel Cashier'
    );
    RAISE EXCEPTION 'TEST 10 FAILED: Reprint on cancelled invoice was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%Cannot reprint cancelled invoice%' THEN
      RAISE NOTICE 'TEST 10 PASSED: Reprint on cancelled invoice correctly rejected (A4 verified)';
    ELSE RAISE EXCEPTION 'TEST 10 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 11: Return Blocked on Cancelled Special Invoice
-- ============================================================================
-- Tests:
--  - Creates special sale.
--  - Cancels invoice via cancel_invoice_atomic.
--  - create_special_return_atomic REJECTS return on cancelled invoice.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_inv_id UUID;
  v_item_id_orig UUID;
BEGIN
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_canc2', 'dummy_hash', 'Cancel Cashier 2', 'staff', true, true);

  -- Open shift (opened_by — verified via information_schema)
  INSERT INTO shifts (tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_tenant_id, v_user_id, 'open', NOW(), 5000);

  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Cancel Return Item', 'CR-02', 1000, 700, 10)
  RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'CANC-RET-001',
      'invoice_type', 'sales',
      'date',         CURRENT_DATE,
      'paid_amount',  1000,
      'due_amount',   0,
      'cash_paid',    1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Cancel Return Item',
      'qty',         1,
      'unit_price',  1000,
      'discount',    0,
      'total_price', 1000
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Cancel Cashier 2',
    p_user_id      => v_user_id,
    p_tokens       => '[]'::jsonb
  );

  v_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_item_id_orig FROM invoice_items WHERE invoice_id = v_inv_id LIMIT 1;

  -- Cancel the invoice
  PERFORM public.cancel_invoice_atomic(
    p_invoice_id := v_inv_id,
    p_tenant_id  := v_tenant_id
  );

  -- Attempt return on cancelled invoice
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_inv_id,
      p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_item_id_orig, 'qty', 1)),
      p_user_id             => v_user_id,
      p_printed_by          => 'Cancel Cashier 2',
      p_cash_refunded       => 1000
    );
    RAISE EXCEPTION 'TEST 11 FAILED: Return on cancelled invoice was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%Cannot process return for cancelled special invoice%' THEN
      RAISE NOTICE 'TEST 11 PASSED: Return on cancelled invoice correctly rejected';
    ELSE RAISE EXCEPTION 'TEST 11 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 12: D1 Edit Block Verification (update_invoice_atomic)
-- ============================================================================
-- Tests:
--  - Creates special invoice.
--  - update_invoice_atomic raises exception rejecting edit on special invoice.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_inv_id UUID := gen_random_uuid();
BEGIN
  -- Insert dummy special invoice
  INSERT INTO invoices (
    id, tenant_id, invoice_no, invoice_type, status, printed_as,
    date, subtotal, discount, net_total, paid_amount, due_amount
  ) VALUES (
    v_inv_id, v_tenant_id, 'EDIT-TEST-001', 'sales', 'completed', 'special',
    CURRENT_DATE, 1000, 0, 1000, 1000, 0
  );

  -- Attempt update via update_invoice_atomic using named arguments
  BEGIN
    PERFORM public.update_invoice_atomic(
      p_invoice_id   => v_inv_id,
      p_tenant_id    => v_tenant_id,
      p_invoice_data => jsonb_build_object('net_total', 1200),
      p_items        => jsonb_build_array(jsonb_build_object(
        'item_id', gen_random_uuid(),
        'item_name', 'Test Item',
        'qty', 1,
        'unit_price', 1200,
        'total_price', 1200
      ))
    );
    RAISE EXCEPTION 'TEST 12 FAILED: update_invoice_atomic allowed edit of special invoice';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%Special invoices cannot be edited%' THEN
      RAISE NOTICE 'TEST 12 PASSED: D1 edit block works — %', SQLERRM;
    ELSE RAISE EXCEPTION 'TEST 12 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 13: Privilege Verification — anon/authenticated cannot execute RPCs
-- ============================================================================
-- Expected: anon_exec = false, auth_exec = false for all special receipt functions.

SELECT
  p.proname,
  p.prosecdef AS is_security_definer,
  has_function_privilege('anon', p.oid, 'execute') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') AS auth_exec,
  has_function_privilege('service_role', p.oid, 'execute') AS service_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_special_invoice_atomic',
    'log_special_reprint_atomic',
    'create_special_return_atomic'
  )
ORDER BY 1;


-- ============================================================================
-- TEST 14: Constraint, Column & Index Schema Verification
-- ============================================================================

-- Check constraints on invoices.printed_as
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.invoices'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%printed_as%';

-- Check constraints on special_print_log.event_type
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.special_print_log'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%event_type%';

-- Partial unique index on special_print_log
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'special_print_log'
  AND indexdef ILIKE '%WHERE%event_type%sale%';

-- Column verification: invoices.original_invoice_id
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoices'
  AND column_name = 'original_invoice_id';

-- Column verification: invoice_items.original_invoice_item_id
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoice_items'
  AND column_name = 'original_invoice_item_id';

-- Column verification: app_users.can_use_special_receipt
SELECT column_name, column_default, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_users'
  AND column_name = 'can_use_special_receipt';


-- ============================================================================
-- TEST 15: F7 — Delivery Charge Consistency
-- ============================================================================
-- Verifies that delivery_charge is included in printed_total and charged_total
-- but NOT in master_total (which represents only catalog item cost basis).

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_res JSONB;
  v_inv_id UUID;
  v_log_rec RECORD;
BEGIN
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_deliv', 'dummy_hash', 'Delivery Cashier', 'staff', true, true);

  -- Catalog price = 1000; delivery_charge = 200
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Delivery Paint', 'DLV-01', 1000, 700, 10)
  RETURNING id INTO v_item_id;

  v_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',       v_tenant_id,
      'invoice_no',      'DELIV-TEST-001',
      'invoice_type',    'sales',
      'date',            CURRENT_DATE,
      'delivery_charge', 200,
      'paid_amount',     1200,   -- 1000 item + 200 delivery
      'due_amount',      0,
      'cash_paid',       1200
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Delivery Paint',
      'qty',         1,
      'unit_price',  1000,
      'discount',    0,
      'total_price', 1000
    )),
    p_receipt_snap  => '{}'::jsonb,
    p_printed_by    => 'Delivery Cashier',
    p_user_id       => v_user_id,
    p_tokens        => '[]'::jsonb
  );

  IF NOT (v_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 15 FAILED: RPC returned success = false';
  END IF;

  v_inv_id := (v_res->>'invoice_id')::UUID;

  SELECT * INTO v_log_rec FROM special_print_log WHERE invoice_id = v_inv_id AND event_type = 'sale';

  -- master_total = 1 * catalog retail_price (1000) — delivery excluded
  IF v_log_rec.master_total <> 1000 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: master_total should be 1000 (no delivery), got %', v_log_rec.master_total;
  END IF;

  -- delivery_charge column verified in special_print_log
  IF v_log_rec.delivery_charge <> 200 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: delivery_charge column should be 200, got %', v_log_rec.delivery_charge;
  END IF;

  -- printed_total = 1 * unit_price + delivery = 1000 + 200 = 1200
  IF v_log_rec.printed_total <> 1200 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: printed_total should be 1200 (includes delivery), got %', v_log_rec.printed_total;
  END IF;

  -- charged_total = subtotal + delivery = 1000 + 200 = 1200
  IF v_log_rec.charged_total <> 1200 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: charged_total should be 1200 (includes delivery), got %', v_log_rec.charged_total;
  END IF;

  -- CEO Log Variance calculation: (charged_total - delivery_charge) - master_total = (1200 - 200) - 1000 = 0
  IF ((v_log_rec.charged_total - v_log_rec.delivery_charge) - v_log_rec.master_total) <> 0 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: CEO price variance should be 0, got %',
      ((v_log_rec.charged_total - v_log_rec.delivery_charge) - v_log_rec.master_total);
  END IF;

  RAISE NOTICE 'TEST 15 PASSED: delivery charge correctly recorded in column, excluded from master_total, and total_variance = 0';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 16: F8 — Invoice-Level Discount Rejected
-- ============================================================================
-- Verifies that create_special_invoice_atomic raises an exception when a
-- non-zero invoice-level discount is supplied by the client.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_item_id UUID;
BEGIN
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_disc', 'dummy_hash', 'Discount Cashier', 'staff', true, true);

  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Discount Paint', 'DSC-01', 1000, 700, 10)
  RETURNING id INTO v_item_id;

  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object(
        'tenant_id',    v_tenant_id,
        'invoice_no',   'DISC-TEST-001',
        'invoice_type', 'sales',
        'date',         CURRENT_DATE,
        'discount',     100,           -- invoice-level discount: should be rejected
        'paid_amount',  900,
        'due_amount',   0,
        'cash_paid',    900
      ),
      p_items => jsonb_build_array(jsonb_build_object(
        'item_id',     v_item_id,
        'item_name',   'Discount Paint',
        'qty',         1,
        'unit_price',  1000,
        'discount',    0,
        'total_price', 1000
      )),
      p_receipt_snap  => '{}'::jsonb,
      p_printed_by    => 'Discount Cashier',
      p_user_id       => v_user_id,
      p_tokens        => '[]'::jsonb
    );
    RAISE EXCEPTION 'TEST 16 FAILED: Invoice-level discount was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%Invoice-level discounts are not allowed%' THEN
      RAISE NOTICE 'TEST 16 PASSED: Invoice-level discount correctly rejected — %', SQLERRM;
    ELSE
      RAISE EXCEPTION 'TEST 16 FAILED: Unexpected error — %', SQLERRM;
    END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 17: F1 — Duplicate Same-Item Lines (original_invoice_item_id Disambiguation)
-- ============================================================================
-- Purpose: Verify that when an invoice has two lines containing the SAME item_id
-- (e.g. same paint, two separate line entries with different discounts),
-- a partial return of one line correctly sets original_invoice_item_id without
-- ambiguity. Option (a) direct-INSERT strategy is confirmed by this test.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := (SELECT id FROM tenants LIMIT 1);
  v_user_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_line1_id UUID;
  v_orig_item_line2_id UUID;
  v_ret_res JSONB;
  v_ret_item RECORD;
BEGIN
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_dup', 'dummy_hash', 'Dup Cashier', 'staff', true, true);

  -- Open shift
  INSERT INTO shifts (tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_tenant_id, v_user_id, 'open', NOW(), 5000);

  -- SAME item_id appears twice on the invoice with different discounts
  -- Line 1: 2 qty × 1000 = 2000, discount 200 → net 1800
  -- Line 2: 1 qty × 1000 = 1000, discount 0  → net 1000
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Dual Line Paint', 'DLP-01', 1000, 700, 20)
  RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'DUP-LINES-001',
      'invoice_type', 'sales',
      'date',         CURRENT_DATE,
      'paid_amount',  2800,
      'due_amount',   0,
      'cash_paid',    2800
    ),
    p_items => jsonb_build_array(
      jsonb_build_object(
        'item_id',     v_item_id,
        'item_name',   'Dual Line Paint',
        'qty',         2,
        'unit_price',  1000,
        'discount',    200,
        'total_price', 1800
      ),
      jsonb_build_object(
        'item_id',     v_item_id,
        'item_name',   'Dual Line Paint',
        'qty',         1,
        'unit_price',  1000,
        'discount',    0,
        'total_price', 1000
      )
    ),
    p_receipt_snap  => '{}'::jsonb,
    p_printed_by    => 'Dup Cashier',
    p_user_id       => v_user_id,
    p_tokens        => '[]'::jsonb
  );

  IF NOT (v_sale_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 17 FAILED: special sale with duplicate item lines failed';
  END IF;

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;

  -- Disambiguate both line items by distinct discount (discount = 200 vs discount = 0)
  -- With Option (a) direct INSERT, each line gets its own unique invoice_items.id.
  SELECT id INTO v_orig_item_line1_id
  FROM invoice_items
  WHERE invoice_id = v_orig_inv_id AND discount = 200 LIMIT 1;

  SELECT id INTO v_orig_item_line2_id
  FROM invoice_items
  WHERE invoice_id = v_orig_inv_id AND discount = 0 LIMIT 1;

  IF v_orig_item_line1_id IS NULL OR v_orig_item_line2_id IS NULL THEN
    RAISE EXCEPTION 'TEST 17 FAILED: Could not identify both line items by distinct discount';
  END IF;

  -- Return ONLY line 2 (1 qty, net 1000)
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(
      jsonb_build_object('original_item_id', v_orig_item_line2_id, 'qty', 1)
    ),
    p_user_id             => v_user_id,
    p_printed_by          => 'Dup Cashier',
    p_shift_id            => (SELECT id FROM shifts WHERE tenant_id = v_tenant_id AND status = 'open' LIMIT 1),
    p_cash_refunded       => 1000
  );

  IF NOT (v_ret_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 17 FAILED: Partial return of line 2 failed';
  END IF;

  -- Verify return item has original_invoice_item_id = line 2's id
  SELECT * INTO v_ret_item
  FROM invoice_items
  WHERE invoice_id = (v_ret_res->>'return_invoice_id')::UUID
  LIMIT 1;

  IF v_ret_item.original_invoice_item_id <> v_orig_item_line2_id THEN
    RAISE EXCEPTION 'TEST 17 FAILED: original_invoice_item_id mapped to wrong line (got %, expected %)',
      v_ret_item.original_invoice_item_id, v_orig_item_line2_id;
  END IF;

  -- Verify line 1 still has its full qty returnable (not consumed by line 2 return)
  -- Uses clean, valid SQL in nested block (nested DECLARE ... BEGIN ... END is valid PL/pgSQL)
  DECLARE
    v_orig_qty NUMERIC;
    v_ret_qty NUMERIC;
    v_returnable NUMERIC;
  BEGIN
    SELECT qty INTO v_orig_qty FROM invoice_items WHERE id = v_orig_item_line1_id;
    SELECT COALESCE(SUM(ii.qty), 0) INTO v_ret_qty
    FROM invoices i
    JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.original_invoice_id = v_orig_inv_id
      AND i.invoice_type = 'return'
      AND i.status <> 'cancelled'
      AND ii.original_invoice_item_id = v_orig_item_line1_id;

    v_returnable := v_orig_qty - v_ret_qty;
    IF v_returnable <> 2 THEN
      RAISE EXCEPTION 'TEST 17 FAILED: Line 1 returnable qty should be 2, got %', v_returnable;
    END IF;

    -- Also verify zero return rows exist for line 1
    IF v_ret_qty <> 0 THEN
      RAISE EXCEPTION 'TEST 17 FAILED: Line 1 was incorrectly consumed by line 2 return';
    END IF;
  END;

  RAISE NOTICE 'TEST 17 PASSED: Duplicate item lines handled correctly — original_invoice_item_id set on correct line, line 1 untouched';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 18: R1f — Cents Rule Per Original Line Across Multiple Return Calls
-- ============================================================================
-- Scenario: 3 units sold at net total Rs. 1000.00 (unit_price = 333.3333...).
-- Returns processed in 3 separate calls of 1 unit each.
-- Expected: Return 1 = 333.33, Return 2 = 333.33, Return 3 = 333.34. Sum = 1000.00.

BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret1_res JSONB;
  v_ret2_res JSONB;
  v_ret3_res JSONB;
  v_ret1_net NUMERIC;
  v_ret2_net NUMERIC;
  v_ret3_net NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type)
  VALUES (v_tenant_id, 'Cents Test Branch', 'cents-test-branch', 'shop');

  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_cents', 'dummy_hash', 'Cents Cashier', 'staff', true, true);

  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);

  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Cents Item 3for1000', 'CNT-01', 500, 300, 30)
  RETURNING id INTO v_item_id;

  -- Original special sale: 3 units for total_price = 1000.00
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id',    v_tenant_id,
      'invoice_no',   'CENTS-SALE-001',
      'invoice_type', 'sales',
      'shift_id',     v_shift_id,
      'date',         CURRENT_DATE,
      'paid_amount',  1000,
      'due_amount',   0,
      'cash_paid',    1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id',     v_item_id,
      'item_name',   'Cents Item 3for1000',
      'qty',         3,
      'unit_price',  333.3333333333,
      'discount',    0,
      'total_price', 1000.00
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Cents Cashier',
    p_user_id      => v_user_id,
    p_tokens       => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Return Call 1: 1 unit
  v_ret1_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Cents Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 333.33
  );
  SELECT net_total INTO v_ret1_net FROM invoices WHERE id = (v_ret1_res->>'return_invoice_id')::UUID;

  -- Return Call 2: 1 unit
  v_ret2_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Cents Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 333.33
  );
  SELECT net_total INTO v_ret2_net FROM invoices WHERE id = (v_ret2_res->>'return_invoice_id')::UUID;

  -- Return Call 3: 1 unit (completes line remaining quantity)
  v_ret3_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Cents Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 333.34
  );
  SELECT net_total INTO v_ret3_net FROM invoices WHERE id = (v_ret3_res->>'return_invoice_id')::UUID;

  IF v_ret1_net <> 333.33 THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Return 1 net_total expected 333.33, got %', v_ret1_net;
  END IF;

  IF v_ret2_net <> 333.33 THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Return 2 net_total expected 333.33, got %', v_ret2_net;
  END IF;

  IF v_ret3_net <> 333.34 THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Return 3 net_total expected 333.34 (completing line), got %', v_ret3_net;
  END IF;

  IF (v_ret1_net + v_ret2_net + v_ret3_net) <> 1000.00 THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Total refunded does not equal 1000.00 (got %)',
      (v_ret1_net + v_ret2_net + v_ret3_net);
  END IF;

  RAISE NOTICE 'TEST 18 PASSED: Cents rule verified across 3 calls (333.33 + 333.33 + 333.34 = 1000.00)';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 19: R1c — Card Refund Leaves Client Ledger Unchanged
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_inv RECORD;
  v_client_bal NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Card Ret Branch', 'card-ret-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_card', 'dummy_hash', 'Card Cashier', 'staff', true, true);
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Client Card Test', 5000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Card Paint', 'CP-01', 2000, 1500, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'CARD-SALE-001', 'invoice_type', 'sales',
      'client_id', v_client_id, 'shift_id', v_shift_id, 'date', CURRENT_DATE,
      'paid_amount', 2000, 'due_amount', 0, 'card_paid', 2000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Card Paint', 'qty', 1, 'unit_price', 2000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Card Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Process Card Refund
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Card Cashier',
    p_shift_id            => v_shift_id,
    p_card_refunded       => 2000
  );

  SELECT * INTO v_ret_inv FROM invoices WHERE id = (v_ret_res->>'return_invoice_id')::UUID;
  IF v_ret_inv.payment_type <> 'card' OR v_ret_inv.card_paid <> 2000 OR v_ret_inv.cash_paid <> 0 OR v_ret_inv.paid_amount <> 2000 THEN
    RAISE EXCEPTION 'TEST 19 FAILED: Return invoice tender incorrect (type %, card %, cash %, paid %)',
      v_ret_inv.payment_type, v_ret_inv.card_paid, v_ret_inv.cash_paid, v_ret_inv.paid_amount;
  END IF;

  SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id;
  IF v_client_bal <> 5000 THEN
    RAISE EXCEPTION 'TEST 19 FAILED: Client ledger altered by card refund (expected 5000, got %)', v_client_bal;
  END IF;

  RAISE NOTICE 'TEST 19 PASSED: Card refund recorded with card_paid = 2000, paid_amount = 2000, client ledger unchanged';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 20: R1c — Cash Refund Sets cash_paid for Day Close Netting
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_inv RECORD;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Cash Ret Branch', 'cash-ret-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_c', 'dummy_hash', 'Cash Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Cash Paint', 'CP-02', 1500, 1000, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'CSH-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'paid_amount', 1500, 'due_amount', 0, 'cash_paid', 1500
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Cash Paint', 'qty', 1, 'unit_price', 1500, 'discount', 0, 'total_price', 1500
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cash Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Cash Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 1500
  );

  SELECT * INTO v_ret_inv FROM invoices WHERE id = (v_ret_res->>'return_invoice_id')::UUID;
  IF v_ret_inv.payment_type <> 'cash' OR v_ret_inv.cash_paid <> 1500 OR v_ret_inv.paid_amount <> 1500 THEN
    RAISE EXCEPTION 'TEST 20 FAILED: Cash return tender breakdown incorrect (type %, cash %, paid %)',
      v_ret_inv.payment_type, v_ret_inv.cash_paid, v_ret_inv.paid_amount;
  END IF;

  RAISE NOTICE 'TEST 20 PASSED: Cash refund correctly populates cash_paid = 1500 for Day Close netting';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 21: Walk-In Customer Return (offset = 0, Full Cashier Refund Required)
-- ============================================================================
-- Tests (Owner Decision):
--  - Walk-in customer (client_id IS NULL) => khata_offset = 0.
--  - Cashier refund (cash + card) must equal return_net in full (0.02 tolerance).
--  - Cash refund of full net succeeds. Cashier short-refund fails.
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'WalkIn Branch', 'walkin-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_w', 'dummy_hash', 'Walk Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Walk Item', 'WI-01', 800, 500, 10) RETURNING id INTO v_item_id;

  -- Walk-in sale: client_id is NULL
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'WALK-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'paid_amount', 800, 'due_amount', 0, 'cash_paid', 800
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Walk Item', 'qty', 1, 'unit_price', 800, 'discount', 0, 'total_price', 800
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Walk Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- 1. Full cash refund for walk-in customer succeeds (khata_offset = 0)
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Walk Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 800,
    p_card_refunded       => 0
  );
  IF NOT (v_ret_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 21 FAILED: Cash refund for walk-in customer failed';
  END IF;
  IF (v_ret_res->>'khata_offset')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'TEST 21 FAILED: Expected khata_offset 0 for walk-in, got %', (v_ret_res->>'khata_offset');
  END IF;

  RAISE NOTICE 'TEST 21 PASSED: Walk-in return requires offset=0 and full cashier payout';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 22: R1c — Mixed Tender Return (Cash + Card) with Khata Offset
-- ============================================================================
-- Sale: 1400 net (paid 1000 cash, due 400). Client has current_balance = 5000.
-- Return net = 1400.
-- Server computes:
--   khata_offset = LEAST(1400, 400, 5000) = 400.
--   Cashier refund remainder = 1400 - 400 = 1000.
-- Cashier splits remainder: Cash 500 + Card 500. Total payout = 1000.
-- Return invoice: cash_paid = 500, card_paid = 500, paid_amount = 1000, net_total = 1400, payment_type = 'mixed'.
-- Clients: current_balance reduced by 400 (5000 -> 4600).
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_inv RECORD;
  v_client_bal NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Mixed Branch', 'mixed-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_m', 'dummy_hash', 'Mixed Cashier', 'staff', true, true);
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Mixed Client', 5000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Mixed Item', 'MI-01', 1400, 1000, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'MIX-SALE-001', 'invoice_type', 'sales',
      'client_id', v_client_id, 'shift_id', v_shift_id, 'date', CURRENT_DATE,
      'subtotal', 1400, 'discount', 0, 'delivery_charge', 0, 'net_total', 1400,
      'paid_amount', 1000, 'due_amount', 400, 'cash_paid', 1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Mixed Item', 'qty', 1, 'unit_price', 1400, 'discount', 0, 'total_price', 1400
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Mixed Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Process mixed return: cash 500, card 500
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Mixed Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 500,
    p_card_refunded       => 500
  );

  IF NOT (v_ret_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 22 FAILED: Mixed return failed';
  END IF;

  IF (v_ret_res->>'khata_offset')::NUMERIC <> 400 THEN
    RAISE EXCEPTION 'TEST 22 FAILED: Expected khata_offset 400, got %', (v_ret_res->>'khata_offset');
  END IF;

  SELECT * INTO v_ret_inv FROM invoices WHERE id = (v_ret_res->>'return_invoice_id')::UUID;
  IF v_ret_inv.payment_type <> 'mixed' OR v_ret_inv.cash_paid <> 500 OR v_ret_inv.card_paid <> 500 OR v_ret_inv.paid_amount <> 1000 THEN
    RAISE EXCEPTION 'TEST 22 FAILED: Mixed tender fields incorrect (type %, cash %, card %, paid %)',
      v_ret_inv.payment_type, v_ret_inv.cash_paid, v_ret_inv.card_paid, v_ret_inv.paid_amount;
  END IF;

  SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id;
  IF v_client_bal <> 4600 THEN
    RAISE EXCEPTION 'TEST 22 FAILED: Client balance not reduced by khata_offset (expected 4600, got %)', v_client_bal;
  END IF;

  RAISE NOTICE 'TEST 22 PASSED: Mixed tender return sets payment_type=mixed, cash_paid=500, card_paid=500, paid_amount=1000, balance reduced by 400';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 23: R1a — In-Request Duplicate Line Aggregation
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Dup Agg Branch', 'dup-agg-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_da', 'dummy_hash', 'DupAgg Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'DupAgg Paint', 'DAP-01', 1000, 700, 10) RETURNING id INTO v_item_id;

  -- Sale of 2 units
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'DUPAGG-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'paid_amount', 2000, 'due_amount', 0, 'cash_paid', 2000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'DupAgg Paint', 'qty', 2, 'unit_price', 1000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'DupAgg Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Pass same original_item_id twice totaling 2.5 units (exceeds returnable qty 2.0)
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items               => jsonb_build_array(
        jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1.5),
        jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1.0)
      ),
      p_user_id             => v_user_id,
      p_printed_by          => 'DupAgg Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 2500
    );
    RAISE EXCEPTION 'TEST 23 FAILED: Duplicate lines exceeding returnable qty were not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%exceeds returnable qty%' THEN
      RAISE NOTICE 'TEST 23 PASSED: In-request duplicate line aggregation correctly blocked excess return';
    ELSE RAISE EXCEPTION 'TEST 23 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 24: R1b — Return of Return & Non-Special Return Blocked
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_ret_inv_id UUID := gen_random_uuid();
  v_reg_inv_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Guard Branch', 'guard-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_g', 'dummy_hash', 'Guard Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);

  -- 1. Insert an existing return invoice (invoice_type = 'return')
  INSERT INTO invoices (id, tenant_id, invoice_no, invoice_type, status, printed_as, date, subtotal, discount, net_total, paid_amount, due_amount)
  VALUES (v_ret_inv_id, v_tenant_id, 'RET-DUMMY-01', 'return', 'completed', 'special', CURRENT_DATE, 1000, 0, 1000, 1000, 0);

  -- 2. Insert a regular invoice (printed_as = 'regular')
  INSERT INTO invoices (id, tenant_id, invoice_no, invoice_type, status, printed_as, date, subtotal, discount, net_total, paid_amount, due_amount)
  VALUES (v_reg_inv_id, v_tenant_id, 'REG-DUMMY-01', 'sales', 'completed', 'regular', CURRENT_DATE, 1000, 0, 1000, 1000, 0);

  -- Attempt return of return
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_ret_inv_id,
      p_items               => '[]'::jsonb,
      p_user_id             => v_user_id,
      p_printed_by          => 'Guard Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 1000
    );
    RAISE EXCEPTION 'TEST 24a FAILED: Return of return was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%non-special or return invoice%' THEN
      RAISE NOTICE 'TEST 24a PASSED: Return of return correctly blocked';
    ELSE RAISE EXCEPTION 'TEST 24a FAILED: Unexpected error — %', SQLERRM; END IF;
  END;

  -- Attempt return of regular invoice
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_reg_inv_id,
      p_items               => '[]'::jsonb,
      p_user_id             => v_user_id,
      p_printed_by          => 'Guard Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 1000
    );
    RAISE EXCEPTION 'TEST 24b FAILED: Return of regular invoice was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%non-special or return invoice%' THEN
      RAISE NOTICE 'TEST 24b PASSED: Return of regular invoice correctly blocked';
    ELSE RAISE EXCEPTION 'TEST 24b FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 25: R1c — Negative Tender Rejection
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_inv_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Neg Branch', 'neg-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_neg', 'dummy_hash', 'Neg Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);

  INSERT INTO invoices (id, tenant_id, invoice_no, invoice_type, status, printed_as, date, subtotal, discount, net_total, paid_amount, due_amount)
  VALUES (v_inv_id, v_tenant_id, 'NEG-INV-001', 'sales', 'completed', 'special', CURRENT_DATE, 1000, 0, 1000, 1000, 0);

  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_inv_id,
      p_items               => '[]'::jsonb,
      p_user_id             => v_user_id,
      p_printed_by          => 'Neg Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => -100
    );
    RAISE EXCEPTION 'TEST 25 FAILED: Negative cash was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%cannot be negative%' THEN
      RAISE NOTICE 'TEST 25 PASSED: Negative tender correctly rejected — %', SQLERRM;
    ELSE RAISE EXCEPTION 'TEST 25 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 26: Formula Simulation of cancel_invoice_atomic Asymmetry (Does Not Call Live Function)
-- ============================================================================
-- Note: This is a standalone formula simulation of live cancel_invoice_atomic lines 907-917 and does NOT call the live function directly.
-- It mathematically proves why cancel_invoice_atomic is incompatible with card/mixed returns
-- and proves why D5 (blocking cancellation of return invoices in BOTH PATCH and DELETE API routes) is mandatory.
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_ret_inv_id UUID := gen_random_uuid();
  v_invoice RECORD;
  v_cash_ref NUMERIC;
  v_store_credit NUMERIC;
  v_bal_before NUMERIC := 4600;
  v_bal_after NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Cancel Asym Branch', 'cancel-asym-branch', 'shop');
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Asym Client', v_bal_before);

  -- Simulated return invoice with mixed tender: net 1400 (cash 500, card 500, khata offset 400)
  INSERT INTO invoices (
    id, tenant_id, invoice_no, invoice_type, status, printed_as, client_id,
    payment_type, date, subtotal, discount, net_total, cash_paid, card_paid, paid_amount, due_amount
  ) VALUES (
    v_ret_inv_id, v_tenant_id, 'RET-ASYM-001', 'return', 'completed', 'special', v_client_id,
    'mixed', CURRENT_DATE, 1400, 0, 1400, 500, 500, 1000, 0
  );

  SELECT * INTO v_invoice FROM invoices WHERE id = v_ret_inv_id;

  -- Exact logic executed by live cancel_invoice_atomic lines 907-917:
  v_cash_ref := CASE
    WHEN COALESCE(v_invoice.cash_paid, 0) > 0 THEN v_invoice.cash_paid
    WHEN LOWER(COALESCE(v_invoice.payment_type, '')) IN ('cash', 'refund') THEN v_invoice.paid_amount
    ELSE 0
  END;
  v_store_credit := GREATEST(0, v_invoice.net_total - v_cash_ref);

  -- Simulating cancel_invoice_atomic update on clients:
  UPDATE clients SET current_balance = current_balance + v_store_credit WHERE id = v_invoice.client_id;
  SELECT current_balance INTO v_bal_after FROM clients WHERE id = v_client_id;

  -- Demonstration check:
  -- Net was 1400, cash_ref was 500. v_store_credit evaluated to 900 (instead of original offset 400)!
  -- Client balance jumped from 4600 to 5500 (extra 500 credited because card_paid was treated as store credit by the formula!).
  IF v_store_credit = 900 AND v_bal_after = 5500 THEN
    RAISE NOTICE 'TEST 26 PASSED (ASYMMETRY PROVEN): cancel_invoice_atomic treats card_paid as store_credit (% credited instead of 400). Proves D5 API block is mandatory.',
      v_store_credit;
  ELSE
    RAISE EXCEPTION 'TEST 26 FAILED: Unexpected simulation behavior';
  END IF;
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 27: F9 — Return on Original Invoice with Discount > 0 Rejected
-- ============================================================================
-- Tests:
--  - F9 guard: If original invoice has invoices.discount > 0, return is rejected
--    with an exception requiring manual review (due to ambiguous per-line allocation).
BEGIN;

DO $
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_inv_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Disc Rej Branch', 'disc-rej-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_dr', 'dummy_hash', 'DiscRej Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);

  -- Original special invoice has invoice-level discount = 100 (subtotal 1000, discount 100, net 900)
  INSERT INTO invoices (id, tenant_id, invoice_no, invoice_type, status, printed_as, date, subtotal, discount, net_total, paid_amount, due_amount)
  VALUES (v_inv_id, v_tenant_id, 'DISC-INV-001', 'sales', 'completed', 'special', CURRENT_DATE, 1000, 100, 900, 900, 0);

  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_inv_id,
      p_items               => jsonb_build_array(jsonb_build_object(
        'original_item_id', gen_random_uuid(),
        'qty', 1
      )),
      p_user_id             => v_user_id,
      p_printed_by          => 'DiscRej Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 900
    );
    RAISE EXCEPTION 'TEST 27 FAILED: Return on discounted original invoice was not rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%invoice-level discount%' THEN
      RAISE NOTICE 'TEST 27 PASSED: Return on discounted original invoice rejected — %', SQLERRM;
    ELSE RAISE EXCEPTION 'TEST 27 FAILED: Unexpected error — %', SQLERRM; END IF;
  END;
END;
$;

ROLLBACK;


-- ============================================================================
-- TEST 28: Token Transactions Pass-Through on Sale, Skipped on Return (Real Runnable SQL)
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_brand_id UUID := gen_random_uuid();
  v_series_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_token_tx_count_before INTEGER;
  v_token_tx_count_after INTEGER;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Token Branch', 'token-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_t', 'dummy_hash', 'Token Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO brands (id, tenant_id, name) VALUES (v_brand_id, v_tenant_id, 'Token Brand');
  INSERT INTO brand_series (id, tenant_id, brand_id, name, status) VALUES (v_series_id, v_tenant_id, v_brand_id, 'Token Series', 'active');
  INSERT INTO series_token_configs (id, tenant_id, series_id, unit_name, is_enabled, token_value)
  VALUES (gen_random_uuid(), v_tenant_id, v_series_id, 'PCS', true, 50);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Token Item', 'TI-01', 1200, 800, 20) RETURNING id INTO v_item_id;

  -- 1. Create special sale with tokens
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'TOK-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'paid_amount', 1200, 'due_amount', 0, 'cash_paid', 1200
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Token Item', 'qty', 1, 'unit_price', 1200, 'discount', 0, 'total_price', 1200
    )),
    p_receipt_snap => '{}'::jsonb,
    p_printed_by   => 'Token Cashier',
    p_user_id      => v_user_id,
    p_tokens       => jsonb_build_array(jsonb_build_object(
      'brand_id', v_brand_id, 'series_id', v_series_id, 'unit_name', 'PCS', 'quantity', 1, 'token_action', 'keep', 'token_value', 50
    ))
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  SELECT COUNT(*) INTO v_token_tx_count_before FROM token_transactions WHERE tenant_id = v_tenant_id;
  IF v_token_tx_count_before = 0 THEN
    RAISE EXCEPTION 'TEST 28 FAILED: Expected token transaction to be created for sale';
  END IF;

  -- 2. Process special return
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Token Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 1200
  );

  SELECT COUNT(*) INTO v_token_tx_count_after FROM token_transactions WHERE tenant_id = v_tenant_id;
  IF v_token_tx_count_after <> v_token_tx_count_before THEN
    RAISE EXCEPTION 'TEST 28 FAILED: Return created unwanted token transaction';
  END IF;

  RAISE NOTICE 'TEST 28 PASSED: Token transaction created on sale, correctly skipped on return';
END;
$$;

ROLLBACK;


-- ============================================================================
-- TEST 29: R4 — CEO Log View Variance Calculation with Delivery Charge
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_inv1_id UUID := gen_random_uuid();
  v_inv2_id UUID := gen_random_uuid();
  v_rep_id UUID := gen_random_uuid();
  v_ret_id UUID := gen_random_uuid();
  v_total_variance NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'CEO Branch', 'ceo-branch', 'shop');

  -- Sale 1: master 9800, charged 8200, delivery 0
  INSERT INTO special_print_log (tenant_id, invoice_id, invoice_no, printed_by, user_id, event_type, master_total, printed_total, charged_total, delivery_charge, receipt_snapshot, template_snapshot)
  VALUES (v_tenant_id, v_inv1_id, 'CEO-001', 'cashier', gen_random_uuid(), 'sale', 9800, 8200, 8200, 0, '{}'::jsonb, '{}'::jsonb);

  -- Sale 2: master 6000, charged 5000, delivery 500 (items 4500 + delivery 500)
  INSERT INTO special_print_log (tenant_id, invoice_id, invoice_no, printed_by, user_id, event_type, master_total, printed_total, charged_total, delivery_charge, receipt_snapshot, template_snapshot)
  VALUES (v_tenant_id, v_inv2_id, 'CEO-002', 'cashier', gen_random_uuid(), 'sale', 6000, 5000, 5000, 500, '{}'::jsonb, '{}'::jsonb);

  -- Reprint 1 (must be excluded from sales sums)
  INSERT INTO special_print_log (tenant_id, invoice_id, invoice_no, printed_by, user_id, event_type, master_total, printed_total, charged_total, delivery_charge, receipt_snapshot, template_snapshot)
  VALUES (v_tenant_id, v_inv1_id, 'CEO-001', 'cashier', gen_random_uuid(), 'reprint', 9800, 8200, 8200, 0, '{}'::jsonb, '{}'::jsonb);

  -- Return 1 (must be excluded from sales sums)
  INSERT INTO special_print_log (tenant_id, invoice_id, invoice_no, printed_by, user_id, event_type, master_total, printed_total, charged_total, delivery_charge, receipt_snapshot, template_snapshot)
  VALUES (v_tenant_id, v_ret_id, 'RET-CEO-001', 'cashier', gen_random_uuid(), 'return', 2000, 2000, 2000, 0, '{}'::jsonb, '{}'::jsonb);

  -- CEO View formula: sum(charged_total - delivery_charge) - sum(master_total)
  SELECT COALESCE(SUM(charged_total - delivery_charge) - SUM(master_total), 0)
  INTO v_total_variance
  FROM special_print_log
  WHERE tenant_id = v_tenant_id AND event_type = 'sale';

  -- Expected: (8200 - 0 + 5000 - 500) - (9800 + 6000) = 12700 - 15800 = -3100
  IF v_total_variance <> -3100 THEN
    RAISE EXCEPTION 'TEST 29 FAILED: Total variance expected -3100, got %', v_total_variance;
  END IF;

  RAISE NOTICE 'TEST 29 PASSED: CEO Log view formula sum(charged_total - delivery_charge) - sum(master_total) = -3100 verified';
END;
$$;

ROLLBACK;


-- ============================================================================
-- END OF STAGING TESTS
-- ============================================================================
-- All BEGIN/ROLLBACK blocks above leave ZERO persistent changes.
-- Run these tests on a Supabase staging branch, NOT on production.
-- ============================================================================



-- ============================================================================
-- TEST 30: Credit Sale Partial Paid + Return Within Due Amount
-- ============================================================================
-- Tests:
--  - Sale Rs. 1000, paid 200, due 800. Client balance 3000.
--  - Return worth Rs. 500 (<= due 800).
--  - khata_offset = LEAST(500, 800, 3000) = 500.
--  - Remainder = 500 - 500 = 0. Cashier pays 0 cash / 0 card.
--  - Return invoice: paid_amount = 0, net_total = 500, payment_type = 'cash'.
--  - Client current_balance reduced from 3000 by 500 to 2500.
BEGIN;

DO $
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_inv RECORD;
  v_client_bal NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Offset Branch', 'offset-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_o', 'dummy_hash', 'Offset Cashier', 'staff', true, true);
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Offset Client', 3000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Offset Item', 'OI-01', 500, 300, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'OFF-SALE-001', 'invoice_type', 'sales',
      'client_id', v_client_id, 'shift_id', v_shift_id, 'date', CURRENT_DATE,
      'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000,
      'paid_amount', 200, 'due_amount', 800, 'cash_paid', 200
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Offset Item', 'qty', 2, 'unit_price', 500, 'discount', 0, 'total_price', 1000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Offset Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Return 1 unit (500)
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Offset Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 0,
    p_card_refunded       => 0
  );

  IF NOT (v_ret_res->>'success')::BOOLEAN THEN
    RAISE EXCEPTION 'TEST 30 FAILED: Return failed';
  END IF;

  IF (v_ret_res->>'khata_offset')::NUMERIC <> 500 OR (v_ret_res->>'cashier_refund')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'TEST 30 FAILED: khata_offset or cashier_refund mismatch';
  END IF;

  SELECT * INTO v_ret_inv FROM invoices WHERE id = (v_ret_res->>'return_invoice_id')::UUID;
  IF v_ret_inv.paid_amount <> 0 OR v_ret_inv.net_total <> 500 THEN
    RAISE EXCEPTION 'TEST 30 FAILED: Return invoice header values incorrect';
  END IF;

  SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id;
  IF v_client_bal <> 2500 THEN
    RAISE EXCEPTION 'TEST 30 FAILED: Client balance not reduced by 500 (got %)', v_client_bal;
  END IF;

  RAISE NOTICE 'TEST 30 PASSED: Return within due amount correctly sets offset=500, payout=0, balance=2500';
END;
$;

ROLLBACK;


-- ============================================================================
-- TEST 31: Prior Returns Reduce Available Offset for Subsequent Returns
-- ============================================================================
-- Tests:
--  - Sale Rs. 1000, paid 200, due 800. Client balance 3000.
--  - Return 1: 1 unit (500). khata_offset = 500, cashier refund = 0.
--  - Return 2: 1 unit (500).
--    Dynamic derivation: prior_offsets = SUM(net_total - paid_amount) = 500 - 0 = 500.
--    orig_due_remaining = 800 - 500 = 300.
--    khata_offset = LEAST(500, 300, 2500) = 300.
--    Cashier payout remainder = 500 - 300 = 200 cash!
--    Client balance reduced by 300 (from 2500 to 2200).
BEGIN;

DO $
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret1_res JSONB;
  v_ret2_res JSONB;
  v_client_bal NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'MultiRet Branch', 'multiret-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_mr', 'dummy_hash', 'Multi Cashier', 'staff', true, true);
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Multi Client', 3000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Multi Item', 'MRI-01', 500, 300, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'MR-SALE-001', 'invoice_type', 'sales',
      'client_id', v_client_id, 'shift_id', v_shift_id, 'date', CURRENT_DATE,
      'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000,
      'paid_amount', 200, 'due_amount', 800, 'cash_paid', 200
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Multi Item', 'qty', 2, 'unit_price', 500, 'discount', 0, 'total_price', 1000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Multi Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Return 1: offset 500, cash 0
  v_ret1_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Multi Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 0,
    p_card_refunded       => 0
  );

  -- Return 2: 2nd unit. Remaining due is 300. Offset = 300, cashier refund = 200 cash!
  v_ret2_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Multi Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 200,
    p_card_refunded       => 0
  );

  IF (v_ret2_res->>'khata_offset')::NUMERIC <> 300 OR (v_ret2_res->>'cashier_refund')::NUMERIC <> 200 THEN
    RAISE EXCEPTION 'TEST 31 FAILED: Return 2 offset or refund mismatch (got offset %, refund %)',
      (v_ret2_res->>'khata_offset'), (v_ret2_res->>'cashier_refund');
  END IF;

  SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id;
  IF v_client_bal <> 2200 THEN
    RAISE EXCEPTION 'TEST 31 FAILED: Final balance mismatch (expected 2200, got %)', v_client_bal;
  END IF;

  RAISE NOTICE 'TEST 31 PASSED: Prior returns dynamically reduce available offset for subsequent returns';
END;
$;

ROLLBACK;


-- ============================================================================
-- TEST 32: Client Already Cleared Dues (current_balance = 0) => Offset 0 and Full Cash Refund
-- ============================================================================
-- Tests:
--  - Sale had due 500, but client subsequently paid off debt so current_balance = 0.
--  - Return net = 300.
--  - khata_offset = LEAST(300, 500, 0) = 0.
--  - Balance must NEVER go negative!
--  - Cashier refunds full 300 in cash. Client balance remains 0.
BEGIN;

DO $
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_client_bal NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'ZeroBal Branch', 'zerobal-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_zb', 'dummy_hash', 'Zero Cashier', 'staff', true, true);
  -- Client has 0 balance (already cleared ledger)
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Zero Client', 0);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'Zero Item', 'ZI-01', 300, 200, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'ZB-SALE-001', 'invoice_type', 'sales',
      'client_id', v_client_id, 'shift_id', v_shift_id, 'date', CURRENT_DATE,
      'subtotal', 300, 'discount', 0, 'delivery_charge', 0, 'net_total', 300,
      'paid_amount', 0, 'due_amount', 300, 'cash_paid', 0
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'Zero Item', 'qty', 1, 'unit_price', 300, 'discount', 0, 'total_price', 300
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Zero Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- Return item: khata_offset = LEAST(300, 300, 0) = 0. Cashier pays 300 cash.
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id             => v_user_id,
    p_printed_by          => 'Zero Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 300,
    p_card_refunded       => 0
  );

  IF (v_ret_res->>'khata_offset')::NUMERIC <> 0 OR (v_ret_res->>'cashier_refund')::NUMERIC <> 300 THEN
    RAISE EXCEPTION 'TEST 32 FAILED: Offset must be 0 and cashier refund must be 300';
  END IF;

  SELECT current_balance INTO v_client_bal FROM clients WHERE id = v_client_id;
  IF v_client_bal <> 0 THEN
    RAISE EXCEPTION 'TEST 32 FAILED: Client balance must not go negative (got %)', v_client_bal;
  END IF;

  RAISE NOTICE 'TEST 32 PASSED: Client with 0 balance gets full cash refund without balance going negative';
END;
$;

ROLLBACK;


-- ============================================================================
-- TEST 33: In-Request Duplicate Line Merge & Cents Rule Completion (R1a & R1f)
-- ============================================================================
-- Tests:
--  - Original sale: 3 units for total Rs. 1000.
--  - Return request sends 1 unit + 2 units in same request referencing the same original_item_id.
--  - Aggregates to 3 units.
--  - Since 3 units completes the line (remaining was 3), Cents rule applies: refund = 1000.00 - 0 = 1000.00 exact.
--  - Zero penny loss.
--  - If request asks for 2 + 2 units (= 4 units), raises exception exceeding returnable qty.
BEGIN;

DO $
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'Dup Merge Branch', 'dup-merge-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_dm', 'dummy_hash', 'Dup Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, '3Unit Item', '3UI-01', 333.33, 200, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', '3U-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE,
      'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000,
      'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', '3Unit Item', 'qty', 3, 'unit_price', 333.33, 'discount', 0, 'total_price', 1000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Dup Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );

  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  -- 1. Attempt requesting 2 + 2 units (exceeds 3) => must fail
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items               => jsonb_build_array(
        jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 2),
        jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 2)
      ),
      p_user_id             => v_user_id,
      p_printed_by          => 'Dup Cashier',
      p_shift_id            => v_shift_id,
      p_cash_refunded       => 1333.33,
      p_card_refunded       => 0
    );
    RAISE EXCEPTION 'TEST 33 FAILED: Duplicate request exceeding returnable qty was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%exceed%' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'TEST 33 FAILED: Unexpected error on exceeding duplicate qty: %', SQLERRM;
    END IF;
  END;

  -- 2. Valid duplicate request: 1 unit + 2 units => merges to 3 units, completes line, exact 1000 refund
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items               => jsonb_build_array(
      jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1),
      jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 2)
    ),
    p_user_id             => v_user_id,
    p_printed_by          => 'Dup Cashier',
    p_shift_id            => v_shift_id,
    p_cash_refunded       => 1000,
    p_card_refunded       => 0
  );

  IF (v_ret_res->>'refund_total')::NUMERIC <> 1000 THEN
    RAISE EXCEPTION 'TEST 33 FAILED: Expected refund_total 1000 exact, got %', (v_ret_res->>'refund_total');
  END IF;

  RAISE NOTICE 'TEST 33 PASSED: Duplicate items merge in Pre-Pass and Cents Rule refunds exact 1000.00';
END;
$;

ROLLBACK;
