-- =============================================================================
-- Phase 6 — Sandbox Tests (7 scenarios)
-- Run each block inside BEGIN ... ROLLBACK to leave the DB clean.
-- Requires: migration 03, 04, and RPC v2 already applied.
-- Tenant: 'example' slug → replace TENANT_ID below with actual UUID.
-- =============================================================================

-- ─── PREP: Get a test tenant_id ──────────────────────────────────────────────
-- SELECT id, slug FROM tenants WHERE slug IN ('example', 'example-branch-2');

-- Replace this with the real UUID from the query above:
-- \set TENANT_ID 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- =============================================================================
-- TEST 1: Normal sale → success
-- =============================================================================
BEGIN;
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',      (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1),
      'idempotency_key', gen_random_uuid(),
      'client_name',    'Test Customer T1',
      'invoice_type',   'sales',
      'net_total',      1000,
      'paid_amount',    1000,
      'due_amount',     0,
      'subtotal',       1000,
      'discount',       0,
      'delivery_charge',0,
      'payment_type',   'cash',
      'cash_paid',      1000,
      'card_paid',      0,
      'bank_paid',      0,
      'others_paid',    0,
      'status',         'completed',
      'created_by',     'sandbox-test',
      'is_offline',     false
    ),
    '[{"item_code":"TEST001","item_name":"Test Item","qty":1,"unit_price":1000,"discount":0,"discount_percent":0,"total_price":1000}]'::jsonb,
    '[]'::jsonb
  ) AS result_t1;
ROLLBACK;


-- =============================================================================
-- TEST 2: Same idempotency key again → is_duplicate: true
-- =============================================================================
BEGIN;
  -- First insert
  WITH key AS (SELECT gen_random_uuid() AS k),
       tenant AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',       (SELECT id FROM tenant),
      'idempotency_key', (SELECT k FROM key),
      'client_name',     'Test Customer T2',
      'invoice_type',    'sales',
      'net_total',        500,
      'paid_amount',      500,
      'due_amount',       0,
      'subtotal',         500,
      'discount',         0,
      'delivery_charge',  0,
      'payment_type',     'cash',
      'cash_paid',        500,
      'card_paid',        0,
      'bank_paid',        0,
      'others_paid',      0,
      'status',          'completed',
      'created_by',      'sandbox-test',
      'is_offline',      false
    ),
    '[{"item_code":"TEST002","item_name":"Item T2","qty":1,"unit_price":500,"discount":0,"discount_percent":0,"total_price":500}]'::jsonb,
    '[]'::jsonb
  );

  -- Second call with SAME key — must return is_duplicate=true
  WITH key AS (
    SELECT idempotency_key AS k
      FROM invoices
     WHERE created_by = 'sandbox-test'
       AND tenant_id = (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
     ORDER BY created_at DESC LIMIT 1
  ),
  tenant AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',       (SELECT id FROM tenant),
      'idempotency_key', (SELECT k FROM key),
      'client_name',     'Test Customer T2',
      'invoice_type',    'sales',
      'net_total',        500,
      'paid_amount',      500,
      'due_amount',       0,
      'subtotal',         500,
      'discount',         0,
      'delivery_charge',  0,
      'payment_type',     'cash',
      'cash_paid',        500,
      'card_paid',        0,
      'bank_paid',        0,
      'others_paid',      0,
      'status',          'completed',
      'created_by',      'sandbox-test',
      'is_offline',      false
    ),
    '[{"item_code":"TEST002","item_name":"Item T2","qty":1,"unit_price":500,"discount":0,"discount_percent":0,"total_price":500}]'::jsonb,
    '[]'::jsonb
  ) AS result_t2;
  -- Verify: result_t2->>'is_duplicate' = 'true'
ROLLBACK;


-- =============================================================================
-- TEST 3: Online-timeout then offline-queue, SAME idempotency_key
--         (offline retry drops shift_id, adds offline fields)
--         → must return is_duplicate:true (new fingerprint matches, shift_id excluded)
-- =============================================================================
BEGIN;
  -- Simulate: online sale stored first (no offline fields, has shift_id)
  WITH k AS (SELECT gen_random_uuid() AS key),
       t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
  INSERT INTO invoices (
    tenant_id, invoice_no, client_name, invoice_type,
    net_total, paid_amount, due_amount, subtotal, discount, delivery_charge,
    payment_type, cash_paid, card_paid, bank_paid, others_paid,
    status, created_by, idempotency_key, request_fingerprint,
    is_offline
  )
  SELECT
    t.id,
    'INV-TEST3-ONLINE',
    'Test T3',
    'sales',
    750, 750, 0, 750, 0, 0,
    'cash', 750, 0, 0, 0,
    'completed', 'sandbox-test',
    k.key,
    -- new fingerprint (no shift_id):
    md5('' || '|' || 'sales' || '|' || '750' || '|' || '750' || '|' ||
        '0' || '|' || '750' || '|' || '0' || '|' || '0' || '|' || '0' || '|' ||
        '0' || '|' || '0' || '|' ||
        '[{"item_code":"TEST003","item_name":"Item T3","qty":1,"unit_price":750,"discount":0,"discount_percent":0,"total_price":750}]' ||
        '|' || '[]'),
    false
  FROM k, t;

  -- Now simulate offline retry with SAME key (adds is_offline, device_id, no shift_id)
  WITH k AS (
    SELECT idempotency_key AS key
      FROM invoices WHERE invoice_no = 'INV-TEST3-ONLINE'
  ),
  t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',       (SELECT id FROM t),
      'idempotency_key', (SELECT key FROM k),
      'client_name',     'Test T3',
      'invoice_type',    'sales',
      'net_total',        750,
      'paid_amount',      750,
      'due_amount',       0,
      'subtotal',         750,
      'discount',         0,
      'delivery_charge',  0,
      'payment_type',     'cash',
      'cash_paid',        750,
      'card_paid',        0,
      'bank_paid',        0,
      'others_paid',      0,
      'status',          'completed',
      'created_by',      'sandbox-test',
      'is_offline',       true,
      'device_id',       'DEVICE-A',
      'local_receipt_no','A-0001',
      'created_at_local', NOW()::TEXT
    ),
    '[{"item_code":"TEST003","item_name":"Item T3","qty":1,"unit_price":750,"discount":0,"discount_percent":0,"total_price":750}]'::jsonb,
    '[]'::jsonb
  ) AS result_t3;
  -- Verify: result_t3->>'is_duplicate' = 'true'
ROLLBACK;


-- =============================================================================
-- TEST 4: Legacy fingerprint retry (pre-deploy invoice stored WITH shift_id in hash)
--         → must return is_duplicate:true via legacy fingerprint match
-- =============================================================================
BEGIN;
  WITH k AS (SELECT gen_random_uuid() AS key),
       t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1),
       sh AS (SELECT id FROM shifts WHERE tenant_id = (SELECT id FROM t) ORDER BY created_at DESC LIMIT 1)
  INSERT INTO invoices (
    tenant_id, invoice_no, client_name, invoice_type,
    net_total, paid_amount, due_amount, subtotal, discount, delivery_charge,
    payment_type, cash_paid, card_paid, bank_paid, others_paid,
    status, created_by, idempotency_key, request_fingerprint, is_offline, shift_id
  )
  SELECT
    t.id,
    'INV-TEST4-LEGACY',
    'Test T4',
    'sales',
    600, 600, 0, 600, 0, 0,
    'cash', 600, 0, 0, 0,
    'completed', 'sandbox-test',
    k.key,
    -- OLD (legacy) fingerprint: includes shift_id
    md5(COALESCE(sh.id::TEXT,'') || '|' || 'sales' || '|' || '600' || '|' || '600' || '|' ||
        '0' || '|' || '600' || '|' || '0' || '|' || '0' || '|' || '0' || '|' ||
        '0' || '|' || '0' || '|' ||
        '[{"item_code":"TEST004","item_name":"Item T4","qty":1,"unit_price":600,"discount":0,"discount_percent":0,"total_price":600}]' ||
        '|' || '[]'),
    false,
    sh.id
  FROM k, t, sh;

  -- Retry via RPC (new code, shift_id EXCLUDED from new fingerprint)
  WITH k AS (SELECT idempotency_key AS key FROM invoices WHERE invoice_no = 'INV-TEST4-LEGACY'),
       t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1),
       sh AS (SELECT id FROM shifts WHERE tenant_id = (SELECT id FROM t) ORDER BY created_at DESC LIMIT 1)
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',       (SELECT id FROM t),
      'idempotency_key', (SELECT key FROM k),
      'shift_id',        (SELECT id FROM sh),
      'client_name',     'Test T4',
      'invoice_type',    'sales',
      'net_total',        600,
      'paid_amount',      600,
      'due_amount',       0,
      'subtotal',         600,
      'discount',         0,
      'delivery_charge',  0,
      'payment_type',     'cash',
      'cash_paid',        600,
      'card_paid',        0,
      'bank_paid',        0,
      'others_paid',      0,
      'status',          'completed',
      'created_by',      'sandbox-test',
      'is_offline',       false
    ),
    '[{"item_code":"TEST004","item_name":"Item T4","qty":1,"unit_price":600,"discount":0,"discount_percent":0,"total_price":600}]'::jsonb,
    '[]'::jsonb
  ) AS result_t4;
  -- Verify: result_t4->>'is_duplicate' = 'true'
ROLLBACK;


-- =============================================================================
-- TEST 5: Duplicate (device_id, local_receipt_no) with DIFFERENT key
--         → OFFLINE_RECEIPT_DUPLICATE raised
-- =============================================================================
BEGIN;
  -- First offline sale
  WITH t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',       (SELECT id FROM t),
      'idempotency_key',  gen_random_uuid(),
      'client_name',     'Test T5a',
      'invoice_type',    'sales',
      'net_total',        300,
      'paid_amount',      300,
      'due_amount',       0,
      'subtotal',         300,
      'discount',         0,
      'delivery_charge',  0,
      'payment_type',     'cash',
      'cash_paid',        300,
      'card_paid',        0,
      'bank_paid',        0,
      'others_paid',      0,
      'status',          'completed',
      'created_by',      'sandbox-test',
      'is_offline',       true,
      'device_id',       'DEVICE-B',
      'local_receipt_no','B-0001',
      'created_at_local', NOW()::TEXT
    ),
    '[{"item_code":"TEST005","item_name":"Item T5","qty":1,"unit_price":300,"discount":0,"discount_percent":0,"total_price":300}]'::jsonb,
    '[]'::jsonb
  );

  -- Second call: DIFFERENT idempotency_key but SAME device_id + local_receipt_no
  -- → Should raise OFFLINE_RECEIPT_DUPLICATE
  WITH t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1)
  SELECT public.create_invoice_atomic(
    jsonb_build_object(
      'tenant_id',       (SELECT id FROM t),
      'idempotency_key',  gen_random_uuid(),
      'client_name',     'Test T5b',
      'invoice_type',    'sales',
      'net_total',        300,
      'paid_amount',      300,
      'due_amount',       0,
      'subtotal',         300,
      'discount',         0,
      'delivery_charge',  0,
      'payment_type',     'cash',
      'cash_paid',        300,
      'card_paid',        0,
      'bank_paid',        0,
      'others_paid',      0,
      'status',          'completed',
      'created_by',      'sandbox-test',
      'is_offline',       true,
      'device_id',       'DEVICE-B',
      'local_receipt_no','B-0001',
      'created_at_local', NOW()::TEXT
    ),
    '[{"item_code":"TEST005","item_name":"Item T5b","qty":1,"unit_price":300,"discount":0,"discount_percent":0,"total_price":300}]'::jsonb,
    '[]'::jsonb
  ) AS result_t5;
  -- Expected: ERROR - OFFLINE_RECEIPT_DUPLICATE: A sale with device_id=DEVICE-B and local_receipt_no=B-0001 already exists.
ROLLBACK;


-- =============================================================================
-- TEST 6: is_offline=true + created_at_local → date on invoice = created_at_local date;
--         invoice_no prefix uses that date (not today's date if different)
-- =============================================================================
BEGIN;
  -- Use a created_at_local that is 2 days ago (date differs from today)
  WITH t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1),
       past AS (SELECT (NOW() - INTERVAL '2 days') AS local_ts)
  SELECT
    (result->>'invoice_no') AS invoice_no,
    (result->'invoice'->>'date') AS invoice_date,
    (SELECT local_ts::DATE::TEXT FROM past) AS expected_date,
    ((result->>'invoice_no') LIKE 'INV-' || TO_CHAR((SELECT local_ts FROM past), 'YYMMDD') || '-%') AS date_in_invoice_no
  FROM (
    SELECT public.create_invoice_atomic(
      jsonb_build_object(
        'tenant_id',       (SELECT id FROM t),
        'idempotency_key',  gen_random_uuid(),
        'client_name',     'Test T6',
        'invoice_type',    'sales',
        'net_total',        200,
        'paid_amount',      200,
        'due_amount',       0,
        'subtotal',         200,
        'discount',         0,
        'delivery_charge',  0,
        'payment_type',     'cash',
        'cash_paid',        200,
        'card_paid',        0,
        'bank_paid',        0,
        'others_paid',      0,
        'status',          'completed',
        'created_by',      'sandbox-test',
        'is_offline',       true,
        'device_id',       'DEVICE-C',
        'local_receipt_no','C-0001',
        'created_at_local', (SELECT local_ts::TEXT FROM past)
      ),
      '[{"item_code":"TEST006","item_name":"Item T6","qty":1,"unit_price":200,"discount":0,"discount_percent":0,"total_price":200}]'::jsonb,
      '[]'::jsonb
    ) AS result
  ) sub;
  -- Verify: date_in_invoice_no = true, invoice_date = (NOW()-2days)::DATE
ROLLBACK;


-- =============================================================================
-- TEST 7: is_late_sync=true + original_shift_id → saved correctly to DB
-- =============================================================================
BEGIN;
  WITH t AS (SELECT id FROM tenants WHERE slug = 'example' LIMIT 1),
       sh AS (SELECT id FROM shifts WHERE tenant_id = (SELECT id FROM t) ORDER BY created_at ASC LIMIT 1)
  SELECT
    inv.is_late_sync,
    inv.original_shift_id,
    (inv.original_shift_id = (SELECT id FROM sh)) AS original_shift_matches,
    inv.is_offline,
    inv.synced_at IS NOT NULL AS has_synced_at
  FROM (
    SELECT public.create_invoice_atomic(
      jsonb_build_object(
        'tenant_id',        (SELECT id FROM t),
        'idempotency_key',   gen_random_uuid(),
        'client_name',      'Test T7',
        'invoice_type',     'sales',
        'net_total',         400,
        'paid_amount',       400,
        'due_amount',        0,
        'subtotal',          400,
        'discount',          0,
        'delivery_charge',   0,
        'payment_type',      'cash',
        'cash_paid',         400,
        'card_paid',         0,
        'bank_paid',         0,
        'others_paid',       0,
        'status',           'completed',
        'created_by',       'sandbox-test',
        'is_offline',        true,
        'is_late_sync',      true,
        'original_shift_id', (SELECT id FROM sh),
        'device_id',        'DEVICE-D',
        'local_receipt_no', 'D-0001',
        'created_at_local',  NOW()::TEXT
      ),
      '[{"item_code":"TEST007","item_name":"Item T7","qty":1,"unit_price":400,"discount":0,"discount_percent":0,"total_price":400}]'::jsonb,
      '[]'::jsonb
    ) AS rpc_result
  ) rpc
  JOIN invoices inv ON inv.id = (rpc_result->>'invoice_id')::UUID;
  -- Verify: is_late_sync=true, original_shift_id=sh.id, has_synced_at=true
ROLLBACK;

