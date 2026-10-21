-- ============================================================================
-- EXTRA STAGING SQL VERIFICATION TESTS (NEW-1 through NEW-8)
-- ============================================================================
-- Environment: Supabase Staging (azzonbwaevtywisxlxej)
-- Architecture: Every test uses an isolated tenant, runs in a sandbox transaction,
-- and terminates with RAISE EXCEPTION 'EVIDENCE: %', <jsonb> to both roll back
-- state automatically and return observable runtime evidence in the response.
-- ============================================================================

-- ============================================================================
-- TEST NEW-1: Idempotent Retry of Special Sale
-- ============================================================================
-- Scenario:
--   1. Create special invoice with invoice_no = 'RETRY-001' (qty = 2).
--   2. Retry RPC with exact same parameters and same user.
-- Expected:
--   - res1.success = true.
--   - res2.is_duplicate = true, returns same invoice_id.
--   - Exactly 1 invoice and 1 'sale' log row exist.
--   - Stock is deducted exactly once (10 - 2 = 8).

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_res1 JSONB;
  v_res2 JSONB;
  v_inv_cnt INT;
  v_log_cnt INT;
  v_stock NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New1 Branch', 'new1-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_new1', 'hash', 'New1 Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New1 Item', 'N1-01', 1000, 700, 10) RETURNING id INTO v_item_id;

  -- Call 1
  v_res1 := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'RETRY-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 2000, 'discount', 0,
      'delivery_charge', 0, 'net_total', 2000, 'paid_amount', 2000, 'due_amount', 0, 'cash_paid', 2000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New1 Item', 'qty', 2, 'unit_price', 1000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{"title":"Test"}'::jsonb,
    p_printed_by => 'New1 Cashier',
    p_user_id => v_user_id,
    p_tokens => '[]'::jsonb
  );

  -- Call 2: Retry with exact same arguments
  v_res2 := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'RETRY-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 2000, 'discount', 0,
      'delivery_charge', 0, 'net_total', 2000, 'paid_amount', 2000, 'due_amount', 0, 'cash_paid', 2000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New1 Item', 'qty', 2, 'unit_price', 1000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{"title":"Test"}'::jsonb,
    p_printed_by => 'New1 Cashier',
    p_user_id => v_user_id,
    p_tokens => '[]'::jsonb
  );

  SELECT COUNT(*) INTO v_inv_cnt FROM invoices WHERE tenant_id = v_tenant_id;
  SELECT COUNT(*) INTO v_log_cnt FROM special_print_log WHERE tenant_id = v_tenant_id AND event_type = 'sale';
  SELECT stock_qty INTO v_stock FROM items WHERE id = v_item_id;

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'res1_success', v_res1->>'success',
    'res2_duplicate', (v_res2->>'is_duplicate')::boolean,
    'same_invoice_id', (v_res1->>'invoice_id') = (v_res2->>'invoice_id'),
    'invoice_count', v_inv_cnt,
    'sale_log_count', v_log_cnt,
    'stock_qty_after', v_stock
  );
END;
$$;


-- ============================================================================
-- TEST NEW-2: Invoice Number Collisions (Regular Collision & Cross-User Retry Collision)
-- ============================================================================
-- Scenario:
--   Part (a): Existing regular invoice with same invoice_no -> error 'already exists as a non-special invoice'.
--   Part (b): Special invoice created by User A, retry attempted by User B -> error 'created by another user'.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_err_a TEXT;
  v_err_b TEXT;
  v_res_a JSONB;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New2 Branch', 'new2-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES
    (v_user_a, v_tenant_id, 'cashier_2a', 'hash', 'Cashier 2A', 'staff', true, true),
    (v_user_b, v_tenant_id, 'cashier_2b', 'hash', 'Cashier 2B', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_a, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New2 Item', 'N2-01', 1000, 700, 10) RETURNING id INTO v_item_id;

  -- Part (a): Existing regular invoice
  INSERT INTO invoices (id, tenant_id, invoice_no, invoice_type, status, printed_as, date, subtotal, discount, net_total, paid_amount, due_amount)
  VALUES (gen_random_uuid(), v_tenant_id, 'COLLISION-REG', 'sales', 'completed', 'regular', CURRENT_DATE, 1000, 0, 1000, 1000, 0);

  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object(
        'tenant_id', v_tenant_id, 'invoice_no', 'COLLISION-REG', 'invoice_type', 'sales',
        'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0,
        'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000
      ),
      p_items => jsonb_build_array(jsonb_build_object(
        'item_id', v_item_id, 'item_name', 'New2 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000
      )),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier 2A', p_user_id => v_user_a, p_tokens => '[]'::jsonb
    );
    v_err_a := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_a := SQLSTATE || ': ' || SQLERRM;
  END;

  -- Part (b): Special invoice created by User A, retry attempted by User B
  v_res_a := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'COLLISION-USR', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0,
      'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New2 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier 2A', p_user_id => v_user_a, p_tokens => '[]'::jsonb
  );

  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object(
        'tenant_id', v_tenant_id, 'invoice_no', 'COLLISION-USR', 'invoice_type', 'sales',
        'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0,
        'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000
      ),
      p_items => jsonb_build_array(jsonb_build_object(
        'item_id', v_item_id, 'item_name', 'New2 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000
      )),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier 2B', p_user_id => v_user_b, p_tokens => '[]'::jsonb
    );
    v_err_b := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_b := SQLSTATE || ': ' || SQLERRM;
  END;

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'part_a_regular_collision_error', v_err_a,
    'part_b_cross_user_collision_error', v_err_b
  );
END;
$$;


-- ============================================================================
-- TEST NEW-3: Reprint Success and Comprehensive Guards (a..e)
-- ============================================================================
-- Scenario:
--   (a) Staff reprint copies delivery_charge=200, matches totals, returns snapshot & template.
--   (b) CEO user reprint blocked with 'CEO reprint is not permitted'.
--   (c) Staff of another tenant blocked with 'Invoice not found or access denied'.
--   (d) Regular invoice blocked with 'is not a special receipt invoice'.
--   (e) Reprint after partial return succeeds.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_tenant_other UUID := gen_random_uuid();
  v_user_staff UUID := gen_random_uuid();
  v_user_ceo UUID := gen_random_uuid();
  v_user_other UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_shift_other UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_inv_id UUID;
  v_rep_a_res JSONB;
  v_rep_a_log RECORD;
  v_err_b TEXT;
  v_err_c TEXT;
  v_err_d TEXT;
  v_reg_inv_id UUID := gen_random_uuid();
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_rep_e_res JSONB;
BEGIN
  -- Tenants
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New3 Branch', 'new3-branch', 'shop');
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_other, 'Other Branch', 'other-branch', 'shop');

  -- Users
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES
    (v_user_staff, v_tenant_id, 'staff_n3', 'hash', 'Staff N3', 'staff', true, true),
    (v_user_ceo, v_tenant_id, 'ceo_n3', 'hash', 'CEO N3', 'ceo', true, true),
    (v_user_other, v_tenant_other, 'staff_other', 'hash', 'Staff Other', 'staff', true, true);

  -- Shifts
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_staff, 'open', NOW(), 10000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_other, v_tenant_other, v_user_other, 'open', NOW(), 10000);

  -- Item (2 units)
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New3 Item', 'N3-01', 1000, 700, 10) RETURNING id INTO v_item_id;

  -- Template for tenant
  INSERT INTO special_receipt_templates (tenant_id, paper_size, template_json)
  VALUES (v_tenant_id, 'thermal_80', '{"header":"Welcome"}'::jsonb);

  -- Original Special Sale with delivery_charge = 200
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'N3-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 2000, 'discount', 0,
      'delivery_charge', 200, 'net_total', 2200, 'paid_amount', 2200, 'due_amount', 0, 'cash_paid', 2200
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New3 Item', 'qty', 2, 'unit_price', 1000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{"items":[{"name":"New3 Item","qty":2}]}'::jsonb,
    p_printed_by => 'Staff N3',
    p_user_id => v_user_staff,
    p_tokens => '[]'::jsonb
  );
  v_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_inv_id LIMIT 1;

  -- Guard (a): Staff reprint success + copies delivery_charge 200 + returns snapshot & template
  v_rep_a_res := public.log_special_reprint_atomic(
    p_invoice_id => v_inv_id,
    p_user_id => v_user_staff,
    p_printed_by => 'Staff N3'
  );
  SELECT event_type, master_total, printed_total, charged_total, delivery_charge
  INTO v_rep_a_log
  FROM special_print_log
  WHERE invoice_id = v_inv_id AND event_type = 'reprint'
  ORDER BY printed_at DESC LIMIT 1;

  -- Guard (b): CEO reprint blocked
  BEGIN
    PERFORM public.log_special_reprint_atomic(
      p_invoice_id => v_inv_id,
      p_user_id => v_user_ceo,
      p_printed_by => 'CEO N3'
    );
    v_err_b := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_b := SQLSTATE || ': ' || SQLERRM;
  END;

  -- Guard (c): Staff of another tenant blocked
  BEGIN
    PERFORM public.log_special_reprint_atomic(
      p_invoice_id => v_inv_id,
      p_user_id => v_user_other,
      p_printed_by => 'Staff Other'
    );
    v_err_c := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_c := SQLSTATE || ': ' || SQLERRM;
  END;

  -- Guard (d): Regular invoice reprint blocked
  INSERT INTO invoices (id, tenant_id, invoice_no, invoice_type, status, printed_as, date, subtotal, discount, net_total, paid_amount, due_amount)
  VALUES (v_reg_inv_id, v_tenant_id, 'REG-N3-001', 'sales', 'completed', 'regular', CURRENT_DATE, 1000, 0, 1000, 1000, 0);

  BEGIN
    PERFORM public.log_special_reprint_atomic(
      p_invoice_id => v_reg_inv_id,
      p_user_id => v_user_staff,
      p_printed_by => 'Staff N3'
    );
    v_err_d := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_d := SQLSTATE || ': ' || SQLERRM;
  END;

  -- Guard (e): Partial return then reprint succeeds
  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_inv_id,
    p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id => v_user_staff,
    p_printed_by => 'Staff N3',
    p_shift_id => v_shift_id,
    p_cash_refunded => 1000
  );

  v_rep_e_res := public.log_special_reprint_atomic(
    p_invoice_id => v_inv_id,
    p_user_id => v_user_staff,
    p_printed_by => 'Staff N3'
  );

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'part_a_success', v_rep_a_res->>'success',
    'part_a_has_snapshot', (v_rep_a_res ? 'snapshot') AND (v_rep_a_res->'snapshot' <> 'null'::jsonb),
    'part_a_has_template', (v_rep_a_res ? 'template') AND (v_rep_a_res->'template' <> 'null'::jsonb),
    'part_a_log', to_jsonb(v_rep_a_log),
    'part_b_ceo_error', v_err_b,
    'part_c_other_tenant_error', v_err_c,
    'part_d_regular_error', v_err_d,
    'part_e_after_return_success', v_rep_e_res->>'success'
  );
END;
$$;


-- ============================================================================
-- TEST NEW-4: Sale RPC Comprehensive Rejections (13 Cases + Zero Mutation Proof)
-- ============================================================================
-- Checks all 13 boundary validations on create_special_invoice_atomic:
--   1. shift_id NULL
--   2. closed shift
--   3. shift of another tenant
--   4. invoice_type = 'return'
--   5. non-existent item_id
--   6. tender sum != paid_amount
--   7. paid + due != charged_total
--   8. due > 0 with no client_id
--   9. qty = 0
--   10. negative unit_price
--   11. discount > line gross
--   12. total_price mismatch
--   13. insufficient stock
-- Proves: 0 invoices, 0 invoice_items, 0 special_print_log, and stock unchanged.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_tenant_other UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_open UUID := gen_random_uuid();
  v_shift_closed UUID := gen_random_uuid();
  v_shift_other UUID := gen_random_uuid();
  v_item_id UUID;
  v_init_stock NUMERIC := 10;
  v_final_stock NUMERIC;
  v_inv_cnt INT; v_ii_cnt INT; v_log_cnt INT;
  v_err_shift_null TEXT;
  v_err_shift_closed TEXT;
  v_err_shift_other TEXT;
  v_err_inv_type TEXT;
  v_err_nonexist_item TEXT;
  v_err_tender_sum TEXT;
  v_err_paid_due_sum TEXT;
  v_err_due_no_client TEXT;
  v_err_qty_zero TEXT;
  v_err_neg_price TEXT;
  v_err_disc_exceed TEXT;
  v_err_line_total TEXT;
  v_err_stock_insufficient TEXT;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New4 Branch', 'new4-branch', 'shop');
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_other, 'Other4 Branch', 'other4-branch', 'shop');

  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_n4', 'hash', 'Cashier N4', 'staff', true, true);

  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_open, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_closed, v_tenant_id, v_user_id, 'closed', NOW(), 10000);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_other, v_tenant_other, gen_random_uuid(), 'open', NOW(), 10000);

  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New4 Item', 'N4-01', 1000, 700, v_init_stock) RETURNING id INTO v_item_id;

  -- 1. shift_id NULL
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-01', 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 1000, 'cash_paid', 1000),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_shift_null := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_shift_null := SQLSTATE || ': ' || SQLERRM; END;

  -- 2. closed shift
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-02', 'shift_id', v_shift_closed, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 1000, 'cash_paid', 1000),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_shift_closed := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_shift_closed := SQLSTATE || ': ' || SQLERRM; END;

  -- 3. shift of another tenant
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-03', 'shift_id', v_shift_other, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 1000, 'cash_paid', 1000),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_shift_other := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_shift_other := SQLSTATE || ': ' || SQLERRM; END;

  -- 4. invoice_type='return'
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-04', 'invoice_type', 'return', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 1000, 'cash_paid', 1000),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_inv_type := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_inv_type := SQLSTATE || ': ' || SQLERRM; END;

  -- 5. non-existent item_id
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-05', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 1000, 'cash_paid', 1000),
      p_items => jsonb_build_array(jsonb_build_object('item_id', gen_random_uuid(), 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_nonexist_item := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_nonexist_item := SQLSTATE || ': ' || SQLERRM; END;

  -- 6. tender sum != paid_amount (paid=1000, cash_paid=800)
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-06', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 1000, 'cash_paid', 800),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_tender_sum := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_tender_sum := SQLSTATE || ': ' || SQLERRM; END;

  -- 7. paid + due != charged_total (paid=500, due=400, net=1000)
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-07', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 500, 'due_amount', 400, 'cash_paid', 500),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_paid_due_sum := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_paid_due_sum := SQLSTATE || ': ' || SQLERRM; END;

  -- 8. due > 0 with no client_id
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-08', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 1000, 'net_total', 1000, 'paid_amount', 500, 'due_amount', 500, 'cash_paid', 500),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'total_price', 1000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_due_no_client := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_due_no_client := SQLSTATE || ': ' || SQLERRM; END;

  -- 9. qty = 0
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-09', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 0, 'net_total', 0, 'paid_amount', 0, 'cash_paid', 0),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 0, 'unit_price', 1000, 'total_price', 0)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_qty_zero := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_qty_zero := SQLSTATE || ': ' || SQLERRM; END;

  -- 10. negative unit_price
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-10', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', -100, 'net_total', -100, 'paid_amount', -100, 'cash_paid', -100),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', -100, 'total_price', -100)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_neg_price := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_neg_price := SQLSTATE || ': ' || SQLERRM; END;

  -- 11. discount > line gross (unit_price=1000, discount=1200)
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-11', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 0, 'net_total', 0, 'paid_amount', 0, 'cash_paid', 0),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'discount', 1200, 'total_price', 0)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_disc_exceed := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_disc_exceed := SQLSTATE || ': ' || SQLERRM; END;

  -- 12. total_price mismatch (qty 1 * price 1000 != total 800)
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-12', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 800, 'net_total', 800, 'paid_amount', 800, 'cash_paid', 800),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 800)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_line_total := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_line_total := SQLSTATE || ': ' || SQLERRM; END;

  -- 13. insufficient stock (qty 15 > stock 10)
  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'E-13', 'shift_id', v_shift_open, 'date', CURRENT_DATE, 'subtotal', 15000, 'net_total', 15000, 'paid_amount', 15000, 'cash_paid', 15000),
      p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'X', 'qty', 15, 'unit_price', 1000, 'discount', 0, 'total_price', 15000)),
      p_receipt_snap => '{}'::jsonb, p_printed_by => 'Staff', p_user_id => v_user_id, p_tokens => '[]'::jsonb
    );
    v_err_stock_insufficient := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_err_stock_insufficient := SQLSTATE || ': ' || SQLERRM; END;

  -- Check counts and stock
  SELECT COUNT(*) INTO v_inv_cnt FROM invoices WHERE tenant_id = v_tenant_id;
  SELECT COUNT(*) INTO v_ii_cnt FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.tenant_id = v_tenant_id;
  SELECT COUNT(*) INTO v_log_cnt FROM special_print_log WHERE tenant_id = v_tenant_id;
  SELECT stock_qty INTO v_final_stock FROM items WHERE id = v_item_id;

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'rejections', jsonb_build_object(
      'shift_id_null', v_err_shift_null,
      'closed_shift', v_err_shift_closed,
      'other_tenant_shift', v_err_shift_other,
      'invoice_type_return', v_err_inv_type,
      'nonexistent_item', v_err_nonexist_item,
      'tender_sum_mismatch', v_err_tender_sum,
      'paid_due_sum_mismatch', v_err_paid_due_sum,
      'due_without_client', v_err_due_no_client,
      'qty_zero', v_err_qty_zero,
      'negative_unit_price', v_err_neg_price,
      'discount_exceeds_gross', v_err_disc_exceed,
      'total_price_mismatch', v_err_line_total,
      'insufficient_stock', v_err_stock_insufficient
    ),
    'post_rejections_counts', jsonb_build_object(
      'invoices_created', v_inv_cnt,
      'invoice_items_created', v_ii_cnt,
      'special_print_log_created', v_log_cnt,
      'stock_unchanged', (v_init_stock = v_final_stock),
      'initial_stock', v_init_stock,
      'final_stock', v_final_stock
    )
  );
END;
$$;


-- ============================================================================
-- TEST NEW-5: Tender Mismatch on Fresh Return (Rejection Guard & Zero Mutation Proof)
-- ============================================================================
-- Scenario:
--   Credit sale: 2000 total, paid 500, due 1500 (client debt 3500 -> 5000).
--   Return 1 unit (net 2000). Server offset = LEAST(2000, 1500, 5000) = 1500.
--   Cashier payout required = 500. Cashier passes cash 600.
-- Expected:
--   - Exception raised: 'must equal return net'.
--   - Client balance remains 5000 (unchanged).
--   - Stock remains 9 (unchanged).
--   - 0 return invoices created.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_client_bal_before NUMERIC;
  v_client_bal_after NUMERIC;
  v_stock_before NUMERIC;
  v_stock_after NUMERIC;
  v_ret_cnt INT;
  v_err_mismatch TEXT;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New5 Branch', 'new5-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_n5', 'hash', 'Cashier N5', 'staff', true, true);
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Client N5', 3500);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New5 Item', 'N5-01', 2000, 1500, 10) RETURNING id INTO v_item_id;

  -- Credit sale: total 2000, paid 500 cash, due 1500 -> client balance becomes 5000
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'N5-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'client_id', v_client_id, 'date', CURRENT_DATE,
      'subtotal', 2000, 'discount', 0, 'delivery_charge', 0, 'net_total', 2000,
      'paid_amount', 500, 'due_amount', 1500, 'cash_paid', 500
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New5 Item', 'qty', 1, 'unit_price', 2000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier N5', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );
  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  SELECT current_balance INTO v_client_bal_before FROM clients WHERE id = v_client_id;
  SELECT stock_qty INTO v_stock_before FROM items WHERE id = v_item_id;

  -- Attempt return with cash 600 instead of 500 (mismatch: 600 cash + 1500 offset = 2100 != 2000 return net)
  BEGIN
    PERFORM public.create_special_return_atomic(
      p_original_invoice_id => v_orig_inv_id,
      p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
      p_user_id => v_user_id,
      p_printed_by => 'Cashier N5',
      p_shift_id => v_shift_id,
      p_cash_refunded => 600,
      p_card_refunded => 0
    );
    v_err_mismatch := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_mismatch := SQLSTATE || ': ' || SQLERRM;
  END;

  SELECT current_balance INTO v_client_bal_after FROM clients WHERE id = v_client_id;
  SELECT stock_qty INTO v_stock_after FROM items WHERE id = v_item_id;
  SELECT COUNT(*) INTO v_ret_cnt FROM invoices WHERE tenant_id = v_tenant_id AND invoice_type = 'return';

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'mismatch_error', v_err_mismatch,
    'client_balance_before', v_client_bal_before,
    'client_balance_after', v_client_bal_after,
    'client_balance_unchanged', (v_client_bal_before = v_client_bal_after),
    'stock_before', v_stock_before,
    'stock_after', v_stock_after,
    'stock_unchanged', (v_stock_before = v_stock_after),
    'return_invoices_created', v_ret_cnt
  );
END;
$$;


-- ============================================================================
-- TEST NEW-6: Multi-Stage Return (Debt Offset Return followed by Card Refund Return)
-- ============================================================================
-- Scenario:
--   1. Sale 2 x 1000 = 2000 (paid 1000 cash, due 1000). Client initial balance 2000 -> 3000.
--   2. Return 1: 1 unit with cash_refunded=0 -> khata offset 1000, client balance 3000 -> 2000.
--   3. Return 2: 2nd unit with card_refunded=1000 -> khata offset 0, card payout 1000.
--      Client balance remains 2000 (card refund leaves ledger unchanged).
--   4. Stock restores sequentially: 10 -> 8 -> 9 -> 10.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_orig_inv_id UUID;
  v_orig_item_id UUID;
  v_ret1_res JSONB;
  v_ret2_res JSONB;
  v_ret1_inv RECORD;
  v_ret2_inv RECORD;
  v_bal_initial NUMERIC := 2000;
  v_bal_after_sale NUMERIC;
  v_bal_after_ret1 NUMERIC;
  v_bal_after_ret2 NUMERIC;
  v_stock_initial NUMERIC := 10;
  v_stock_after_sale NUMERIC;
  v_stock_after_ret1 NUMERIC;
  v_stock_after_ret2 NUMERIC;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New6 Branch', 'new6-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_n6', 'hash', 'Cashier N6', 'staff', true, true);
  INSERT INTO clients (id, tenant_id, name, current_balance) VALUES (v_client_id, v_tenant_id, 'Client N6', v_bal_initial);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New6 Item', 'N6-01', 1000, 700, v_stock_initial) RETURNING id INTO v_item_id;

  -- 1. Sale: 2 x 1000 = 2000 (paid 1000 cash, due 1000)
  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'N6-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'client_id', v_client_id, 'date', CURRENT_DATE,
      'subtotal', 2000, 'discount', 0, 'delivery_charge', 0, 'net_total', 2000,
      'paid_amount', 1000, 'due_amount', 1000, 'cash_paid', 1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New6 Item', 'qty', 2, 'unit_price', 1000, 'discount', 0, 'total_price', 2000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier N6', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );
  v_orig_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_orig_inv_id LIMIT 1;

  SELECT current_balance INTO v_bal_after_sale FROM clients WHERE id = v_client_id;
  SELECT stock_qty INTO v_stock_after_sale FROM items WHERE id = v_item_id;

  -- 2. Return 1: 1 unit, cash_refunded=0 -> offset=1000
  v_ret1_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id => v_user_id,
    p_printed_by => 'Cashier N6',
    p_shift_id => v_shift_id,
    p_cash_refunded => 0,
    p_card_refunded => 0
  );
  SELECT payment_type, cash_paid, card_paid, paid_amount, net_total INTO v_ret1_inv
  FROM invoices WHERE id = (v_ret1_res->>'return_invoice_id')::UUID;

  SELECT current_balance INTO v_bal_after_ret1 FROM clients WHERE id = v_client_id;
  SELECT stock_qty INTO v_stock_after_ret1 FROM items WHERE id = v_item_id;

  -- 3. Return 2: 2nd unit, card_refunded=1000 -> offset=0, card payout=1000
  v_ret2_res := public.create_special_return_atomic(
    p_original_invoice_id => v_orig_inv_id,
    p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1)),
    p_user_id => v_user_id,
    p_printed_by => 'Cashier N6',
    p_shift_id => v_shift_id,
    p_cash_refunded => 0,
    p_card_refunded => 1000
  );
  SELECT payment_type, cash_paid, card_paid, paid_amount, net_total INTO v_ret2_inv
  FROM invoices WHERE id = (v_ret2_res->>'return_invoice_id')::UUID;

  SELECT current_balance INTO v_bal_after_ret2 FROM clients WHERE id = v_client_id;
  SELECT stock_qty INTO v_stock_after_ret2 FROM items WHERE id = v_item_id;

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'ret1_header', to_jsonb(v_ret1_inv),
    'ret2_header', to_jsonb(v_ret2_inv),
    'balances', jsonb_build_object(
      'initial', v_bal_initial,
      'after_sale', v_bal_after_sale,
      'after_ret1', v_bal_after_ret1,
      'after_ret2', v_bal_after_ret2,
      'card_ret_kept_balance_unchanged', (v_bal_after_ret1 = v_bal_after_ret2)
    ),
    'stocks', jsonb_build_object(
      'initial', v_stock_initial,
      'after_sale', v_stock_after_sale,
      'after_ret1', v_stock_after_ret1,
      'after_ret2', v_stock_after_ret2,
      'fully_restored', (v_stock_after_ret2 = v_stock_initial)
    )
  );
END;
$$;


-- ============================================================================
-- TEST NEW-7: Full Rollback on Token Transaction Failure
-- ============================================================================
-- Scenario:
--   Sale passes token referencing an unconfigured series unit.
-- Expected:
--   - Exception raised: 'is not configured in series'.
--   - 0 invoices, 0 invoice_items, 0 special_print_log, 0 token_transactions created.
--   - Stock unchanged.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_brand_id UUID := gen_random_uuid();
  v_series_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_stock_init NUMERIC := 10;
  v_stock_after NUMERIC;
  v_inv_cnt INT; v_ii_cnt INT; v_log_cnt INT; v_tok_cnt INT;
  v_err_token TEXT;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New7 Branch', 'new7-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_n7', 'hash', 'Cashier N7', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New7 Item', 'N7-01', 1000, 700, v_stock_init) RETURNING id INTO v_item_id;

  INSERT INTO brands (id, tenant_id, name) VALUES (v_brand_id, v_tenant_id, 'Brand N7');
  INSERT INTO brand_series (id, tenant_id, brand_id, name, status) VALUES (v_series_id, v_tenant_id, v_brand_id, 'Series N7', 'active');

  BEGIN
    PERFORM public.create_special_invoice_atomic(
      p_invoice_data => jsonb_build_object(
        'tenant_id', v_tenant_id, 'invoice_no', 'N7-SALE-001', 'invoice_type', 'sales',
        'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0,
        'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000
      ),
      p_items => jsonb_build_array(jsonb_build_object(
        'item_id', v_item_id, 'item_name', 'New7 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000
      )),
      p_receipt_snap => '{}'::jsonb,
      p_printed_by => 'Cashier N7',
      p_user_id => v_user_id,
      p_tokens => jsonb_build_array(jsonb_build_object(
        'brand_id', v_brand_id, 'series_id', v_series_id, 'unit_name', 'UNCONFIGURED_UNIT',
        'quantity', 1, 'token_action', 'keep', 'token_value', 50
      ))
    );
    v_err_token := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_token := SQLSTATE || ': ' || SQLERRM;
  END;

  SELECT COUNT(*) INTO v_inv_cnt FROM invoices WHERE tenant_id = v_tenant_id;
  SELECT COUNT(*) INTO v_ii_cnt FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.tenant_id = v_tenant_id;
  SELECT COUNT(*) INTO v_log_cnt FROM special_print_log WHERE tenant_id = v_tenant_id;
  SELECT COUNT(*) INTO v_tok_cnt FROM token_transactions WHERE tenant_id = v_tenant_id;
  SELECT stock_qty INTO v_stock_after FROM items WHERE id = v_item_id;

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'token_error', v_err_token,
    'invoices_created', v_inv_cnt,
    'invoice_items_created', v_ii_cnt,
    'special_print_log_created', v_log_cnt,
    'token_transactions_created', v_tok_cnt,
    'stock_init', v_stock_init,
    'stock_after', v_stock_after,
    'stock_unchanged', (v_stock_init = v_stock_after)
  );
END;
$$;


-- ============================================================================
-- TEST NEW-8: Immutability Trigger Guard on Reprint Rows (UPDATE & DELETE Blocked)
-- ============================================================================
-- Scenario:
--   Direct UPDATE and DELETE executed as postgres on a 'reprint' event log row.
-- Expected:
--   Both operations are intercepted and aborted by trg_immutable_special_print_log
--   with error message containing 'immutable audit trail'.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_inv_id UUID;
  v_rep_log_id UUID;
  v_err_update TEXT;
  v_err_delete TEXT;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New8 Branch', 'new8-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_n8', 'hash', 'Cashier N8', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New8 Item', 'N8-01', 1000, 700, 10) RETURNING id INTO v_item_id;

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'N8-SALE-001', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0,
      'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New8 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000
    )),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier N8', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  );
  v_inv_id := (v_sale_res->>'invoice_id')::UUID;

  -- Create reprint row
  PERFORM public.log_special_reprint_atomic(
    p_invoice_id => v_inv_id,
    p_user_id => v_user_id,
    p_printed_by => 'Cashier N8'
  );

  SELECT id INTO v_rep_log_id FROM special_print_log WHERE invoice_id = v_inv_id AND event_type = 'reprint' LIMIT 1;

  -- Attempt UPDATE on reprint row
  BEGIN
    UPDATE special_print_log SET printed_by = 'tampered' WHERE id = v_rep_log_id;
    v_err_update := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_update := SQLSTATE || ': ' || SQLERRM;
  END;

  -- Attempt DELETE on reprint row
  BEGIN
    DELETE FROM special_print_log WHERE id = v_rep_log_id;
    v_err_delete := 'ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_err_delete := SQLSTATE || ': ' || SQLERRM;
  END;

  RAISE EXCEPTION 'EVIDENCE: %', jsonb_build_object(
    'update_error', v_err_update,
    'update_blocked_by_immutable_trigger', (v_err_update ILIKE '%immutable audit trail%'),
    'delete_error', v_err_delete,
    'delete_blocked_by_immutable_trigger', (v_err_delete ILIKE '%immutable audit trail%')
  );
END;
$$;

-- ============================================================================
-- TEST NEW-9: Fully Offset Return (payment_type = 'others' and consumer_calc = 0)
-- ============================================================================
-- Scenario:
--   Credit sale of 1000 to registered client (client balance seeded so it is 3000 after +1000 due).
--   Return the 1000 unit with cash 0 / card 0 -> fully absorbed by khata offset.
-- Expected:
--   - return header payment_type = 'others', cash_paid = 0, card_paid = 0, paid_amount = 0, net_total = 1000, due_amount = 0
--   - client balance drops by 1000 (from 3000 to 2000)
--   - stock replenished (stock_qty goes back to 10)
--   - consumer expression:
--       CASE WHEN cash_paid>0 THEN cash_paid
--            WHEN (payment_type IS NULL OR lower(payment_type) IN ('cash','refund','')) THEN COALESCE(NULLIF(paid_amount,0), net_total)
--            ELSE 0 END
--       evaluates to 0.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_res JSONB;
  v_sale_inv_id UUID;
  v_orig_item_id UUID;
  v_ret_res JSONB;
  v_ret_inv_id UUID;
  v_ret_row RECORD;
  v_bal_before NUMERIC;
  v_bal_after NUMERIC;
  v_stock_after NUMERIC;
  v_evidence JSONB;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New9 Branch', 'new9-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_new9', 'hash', 'New9 Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New9 Item', 'N9-01', 1000, 700, 10) RETURNING id INTO v_item_id;

  INSERT INTO clients (id, tenant_id, name, phone, current_balance)
  VALUES (v_client_id, v_tenant_id, 'Credit Client 9', '03001234567', 2000);

  v_sale_res := public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object(
      'tenant_id', v_tenant_id, 'invoice_no', 'NEW9-SALE-01', 'invoice_type', 'sales',
      'shift_id', v_shift_id, 'date', CURRENT_DATE, 'client_id', v_client_id,
      'client_name', 'Credit Client 9', 'subtotal', 1000, 'discount', 0,
      'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 0, 'due_amount', 1000,
      'payment_type', 'credit'
    ),
    p_items => jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id, 'item_name', 'New9 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000
    )),
    p_receipt_snap => '{"title":"Test"}'::jsonb,
    p_printed_by => 'New9 Cashier',
    p_user_id => v_user_id,
    p_tokens => '[]'::jsonb
  );
  v_sale_inv_id := (v_sale_res->>'invoice_id')::UUID;
  SELECT id INTO v_orig_item_id FROM invoice_items WHERE invoice_id = v_sale_inv_id;

  SELECT current_balance INTO v_bal_before FROM clients WHERE id = v_client_id;

  v_ret_res := public.create_special_return_atomic(
    p_original_invoice_id => v_sale_inv_id,
    p_items => jsonb_build_array(jsonb_build_object(
      'original_item_id', v_orig_item_id,
      'qty', 1
    )),
    p_user_id => v_user_id,
    p_printed_by => 'New9 Cashier',
    p_shift_id => v_shift_id,
    p_cash_refunded => 0,
    p_card_refunded => 0
  );
  v_ret_inv_id := (v_ret_res->>'return_invoice_id')::UUID;

  SELECT current_balance INTO v_bal_after FROM clients WHERE id = v_client_id;
  SELECT stock_qty INTO v_stock_after FROM items WHERE id = v_item_id;

  SELECT payment_type, cash_paid, card_paid, bank_paid, others_paid, paid_amount, net_total, due_amount,
         CASE 
           WHEN cash_paid > 0 THEN cash_paid 
           WHEN (payment_type IS NULL OR lower(payment_type) IN ('cash','refund','')) THEN COALESCE(NULLIF(paid_amount,0), net_total) 
           ELSE 0 
         END AS consumer_calc
    INTO v_ret_row
    FROM invoices WHERE id = v_ret_inv_id;

  v_evidence := jsonb_build_object(
    'return_header', jsonb_build_object(
      'payment_type', v_ret_row.payment_type,
      'cash_paid', v_ret_row.cash_paid,
      'card_paid', v_ret_row.card_paid,
      'bank_paid', v_ret_row.bank_paid,
      'others_paid', v_ret_row.others_paid,
      'paid_amount', v_ret_row.paid_amount,
      'net_total', v_ret_row.net_total,
      'due_amount', v_ret_row.due_amount
    ),
    'client_balance_before', v_bal_before,
    'client_balance_after', v_bal_after,
    'balance_drop', (v_bal_before - v_bal_after),
    'stock_after', v_stock_after,
    'consumer_expression_calc', v_ret_row.consumer_calc
  );

  RAISE EXCEPTION 'EVIDENCE: %', v_evidence;
END $$;

-- ============================================================================
-- TEST NEW-10: Payment Type Matrix for Special Returns
-- ============================================================================
-- Scenario:
--   Test 4 return payment modalities in one atomic transaction:
--   1. Cash-only return -> payment_type = 'cash', consumer_calc = cash_paid
--   2. Card-only return -> payment_type = 'card', consumer_calc = 0
--   3. Mixed return (cash 600 + card 400) -> payment_type = 'mixed', consumer_calc = 600
--   4. Fully offset return (cash 0 + card 0) -> payment_type = 'others', consumer_calc = 0
-- Expected:
--   - 4 headers reflect exact payment_type and payment breakdowns.
--   - Consumer expression evaluates correctly for each modality without inflating drawer cash returns.

DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := gen_random_uuid();
  v_shift_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_item_id UUID;
  v_sale_cash_id UUID;
  v_item_cash_id UUID;
  v_sale_card_id UUID;
  v_item_card_id UUID;
  v_sale_mix_id UUID;
  v_item_mix_id UUID;
  v_sale_off_id UUID;
  v_item_off_id UUID;
  v_ret_cash_res JSONB;
  v_ret_card_res JSONB;
  v_ret_mix_res JSONB;
  v_ret_off_res JSONB;
  v_row_cash RECORD;
  v_row_card RECORD;
  v_row_mix RECORD;
  v_row_off RECORD;
  v_evidence JSONB;
BEGIN
  INSERT INTO tenants (id, name, slug, type) VALUES (v_tenant_id, 'New10 Branch', 'new10-branch', 'shop');
  INSERT INTO app_users (id, tenant_id, username, password_hash, full_name, role, is_active, can_use_special_receipt)
  VALUES (v_user_id, v_tenant_id, 'cashier_new10', 'hash', 'New10 Cashier', 'staff', true, true);
  INSERT INTO shifts (id, tenant_id, opened_by, status, start_time, opening_cash)
  VALUES (v_shift_id, v_tenant_id, v_user_id, 'open', NOW(), 10000);
  INSERT INTO items (tenant_id, name, code, retail_price, cost_price, stock_qty)
  VALUES (v_tenant_id, 'New10 Item', 'N10-01', 1000, 700, 50) RETURNING id INTO v_item_id;

  INSERT INTO clients (id, tenant_id, name, phone, current_balance)
  VALUES (v_client_id, v_tenant_id, 'Credit Client 10', '03001234567', 1000);

  -- 1. Cash sale
  v_sale_cash_id := ((public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'N10-CASH', 'invoice_type', 'sales', 'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000),
    p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'New10 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000)),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  ))->>'invoice_id')::UUID;
  SELECT id INTO v_item_cash_id FROM invoice_items WHERE invoice_id = v_sale_cash_id;

  -- 2. Card sale
  v_sale_card_id := ((public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'N10-CARD', 'invoice_type', 'sales', 'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'card_paid', 1000, 'payment_type', 'card'),
    p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'New10 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000)),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  ))->>'invoice_id')::UUID;
  SELECT id INTO v_item_card_id FROM invoice_items WHERE invoice_id = v_sale_card_id;

  -- 3. Mix sale
  v_sale_mix_id := ((public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'N10-MIX', 'invoice_type', 'sales', 'shift_id', v_shift_id, 'date', CURRENT_DATE, 'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 1000, 'due_amount', 0, 'cash_paid', 1000),
    p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'New10 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000)),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  ))->>'invoice_id')::UUID;
  SELECT id INTO v_item_mix_id FROM invoice_items WHERE invoice_id = v_sale_mix_id;

  -- 4. Credit sale for offset
  v_sale_off_id := ((public.create_special_invoice_atomic(
    p_invoice_data => jsonb_build_object('tenant_id', v_tenant_id, 'invoice_no', 'N10-OFF', 'invoice_type', 'sales', 'shift_id', v_shift_id, 'date', CURRENT_DATE, 'client_id', v_client_id, 'client_name', 'Credit Client 10', 'subtotal', 1000, 'discount', 0, 'delivery_charge', 0, 'net_total', 1000, 'paid_amount', 0, 'due_amount', 1000, 'payment_type', 'credit'),
    p_items => jsonb_build_array(jsonb_build_object('item_id', v_item_id, 'item_name', 'New10 Item', 'qty', 1, 'unit_price', 1000, 'discount', 0, 'total_price', 1000)),
    p_receipt_snap => '{}'::jsonb, p_printed_by => 'Cashier', p_user_id => v_user_id, p_tokens => '[]'::jsonb
  ))->>'invoice_id')::UUID;
  SELECT id INTO v_item_off_id FROM invoice_items WHERE invoice_id = v_sale_off_id;

  -- Return 1: cash-only
  v_ret_cash_res := public.create_special_return_atomic(p_original_invoice_id => v_sale_cash_id, p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_item_cash_id, 'qty', 1)), p_user_id => v_user_id, p_printed_by => 'Cashier', p_shift_id => v_shift_id, p_cash_refunded => 1000, p_card_refunded => 0);

  -- Return 2: card-only
  v_ret_card_res := public.create_special_return_atomic(p_original_invoice_id => v_sale_card_id, p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_item_card_id, 'qty', 1)), p_user_id => v_user_id, p_printed_by => 'Cashier', p_shift_id => v_shift_id, p_cash_refunded => 0, p_card_refunded => 1000);

  -- Return 3: mixed (cash 600, card 400)
  v_ret_mix_res := public.create_special_return_atomic(p_original_invoice_id => v_sale_mix_id, p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_item_mix_id, 'qty', 1)), p_user_id => v_user_id, p_printed_by => 'Cashier', p_shift_id => v_shift_id, p_cash_refunded => 600, p_card_refunded => 400);

  -- Return 4: fully offset (cash 0, card 0)
  v_ret_off_res := public.create_special_return_atomic(p_original_invoice_id => v_sale_off_id, p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_item_off_id, 'qty', 1)), p_user_id => v_user_id, p_printed_by => 'Cashier', p_shift_id => v_shift_id, p_cash_refunded => 0, p_card_refunded => 0);

  SELECT payment_type, cash_paid, card_paid, paid_amount, net_total,
         CASE WHEN cash_paid > 0 THEN cash_paid WHEN (payment_type IS NULL OR lower(payment_type) IN ('cash','refund','')) THEN COALESCE(NULLIF(paid_amount,0), net_total) ELSE 0 END AS consumer_calc
    INTO v_row_cash FROM invoices WHERE id = (v_ret_cash_res->>'return_invoice_id')::UUID;

  SELECT payment_type, cash_paid, card_paid, paid_amount, net_total,
         CASE WHEN cash_paid > 0 THEN cash_paid WHEN (payment_type IS NULL OR lower(payment_type) IN ('cash','refund','')) THEN COALESCE(NULLIF(paid_amount,0), net_total) ELSE 0 END AS consumer_calc
    INTO v_row_card FROM invoices WHERE id = (v_ret_card_res->>'return_invoice_id')::UUID;

  SELECT payment_type, cash_paid, card_paid, paid_amount, net_total,
         CASE WHEN cash_paid > 0 THEN cash_paid WHEN (payment_type IS NULL OR lower(payment_type) IN ('cash','refund','')) THEN COALESCE(NULLIF(paid_amount,0), net_total) ELSE 0 END AS consumer_calc
    INTO v_row_mix FROM invoices WHERE id = (v_ret_mix_res->>'return_invoice_id')::UUID;

  SELECT payment_type, cash_paid, card_paid, paid_amount, net_total,
         CASE WHEN cash_paid > 0 THEN cash_paid WHEN (payment_type IS NULL OR lower(payment_type) IN ('cash','refund','')) THEN COALESCE(NULLIF(paid_amount,0), net_total) ELSE 0 END AS consumer_calc
    INTO v_row_off FROM invoices WHERE id = (v_ret_off_res->>'return_invoice_id')::UUID;

  v_evidence := jsonb_build_object(
    'cash_only', jsonb_build_object('payment_type', v_row_cash.payment_type, 'cash_paid', v_row_cash.cash_paid, 'card_paid', v_row_cash.card_paid, 'paid_amount', v_row_cash.paid_amount, 'consumer_calc', v_row_cash.consumer_calc),
    'card_only', jsonb_build_object('payment_type', v_row_card.payment_type, 'cash_paid', v_row_card.cash_paid, 'card_paid', v_row_card.card_paid, 'paid_amount', v_row_card.paid_amount, 'consumer_calc', v_row_card.consumer_calc),
    'mixed',     jsonb_build_object('payment_type', v_row_mix.payment_type, 'cash_paid', v_row_mix.cash_paid, 'card_paid', v_row_mix.card_paid, 'paid_amount', v_row_mix.paid_amount, 'consumer_calc', v_row_mix.consumer_calc),
    'offset',    jsonb_build_object('payment_type', v_row_off.payment_type, 'cash_paid', v_row_off.cash_paid, 'card_paid', v_row_off.card_paid, 'paid_amount', v_row_off.paid_amount, 'consumer_calc', v_row_off.consumer_calc)
  );

  RAISE EXCEPTION 'EVIDENCE: %', v_evidence;
END $$;
