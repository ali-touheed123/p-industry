-- ==============================================================================
-- scripts/verify-day.sql
-- Read-only verification query for PYNTFLOW financial audit
-- Target: Tenant /ali (f6b883aa-c630-4e08-a555-72d4d751e147), Date: 2026-10-26
-- ==============================================================================

\set target_tenant 'f6b883aa-c630-4e08-a555-72d4d751e147'
\set target_date '2026-10-26'

-- 1. Shift Row (Opening, Expected, Actual, Difference, Cash Breakdown)
SELECT 
  '1. SHIFT SUMMARY' AS section,
  id AS shift_id,
  status,
  opening_cash,
  expected_cash,
  actual_cash,
  difference,
  previous_closing_cash,
  handover_variance,
  cash_breakdown,
  start_time,
  end_time
FROM shifts
WHERE tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
  AND (created_at::date = '2026-10-26' OR start_time::date = '2026-10-26');

-- 2. Voucher Cash Receipts / Payments Linked to That Shift (or Covering Date)
SELECT 
  '2. VOUCHERS' AS section,
  v.id AS voucher_id,
  v.voucher_no,
  v.voucher_type,
  v.party_type,
  v.party_name,
  v.amount,
  v.payment_mode,
  v.shift_id,
  v.created_at
FROM vouchers v
WHERE v.tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
  AND (v.date = '2026-10-26' OR v.created_at::date = '2026-10-26')
ORDER BY v.created_at;

-- 3. Supplier Return Cash Received
SELECT 
  '3. SUPPLIER RETURN CASH RECEIVED' AS section,
  p.id AS purchase_id,
  p.purchase_no,
  p.purchase_type,
  p.supplier_name,
  p.net_total,
  p.paid_amount AS cash_refund_received,
  p.payment_type,
  p.shift_id,
  p.created_at
FROM purchases p
WHERE p.tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
  AND (p.date = '2026-10-26' OR p.created_at::date = '2026-10-26')
  AND p.purchase_type = 'return';

-- 4. Clients Current Balance vs Sum of Invoices / Returns / Vouchers
WITH client_calc AS (
  SELECT 
    c.id AS client_id,
    c.name AS client_name,
    c.current_balance AS db_balance,
    -- Sum of forward invoice due amounts
    COALESCE(SUM(CASE WHEN i.invoice_type <> 'return' AND i.status <> 'cancelled' THEN i.due_amount ELSE 0 END), 0) AS total_due_incurred,
    -- Sum of return store credits (net_total - cash refunded)
    COALESCE(SUM(CASE WHEN i.invoice_type = 'return' AND i.status <> 'cancelled' THEN GREATEST(0, i.net_total - CASE WHEN COALESCE(i.cash_paid, 0) > 0 THEN i.cash_paid WHEN LOWER(COALESCE(i.payment_type, '')) IN ('cash', 'refund') THEN COALESCE(i.paid_amount, 0) ELSE 0 END) ELSE 0 END), 0) AS total_return_credits
  FROM clients c
  LEFT JOIN invoices i ON i.client_id = c.id
  WHERE c.tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
  GROUP BY c.id, c.name, c.current_balance
),
client_vouchers AS (
  SELECT 
    v.party_id AS client_id,
    COALESCE(SUM(v.amount), 0) AS total_vouchers_paid
  FROM vouchers v
  WHERE v.tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
    AND v.party_type = 'client'
  GROUP BY v.party_id
)
SELECT 
  '4. CLIENT RECONCILIATION' AS section,
  cc.client_name,
  cc.db_balance,
  (cc.total_due_incurred - cc.total_return_credits - COALESCE(cv.total_vouchers_paid, 0)) AS calculated_balance,
  cc.db_balance - (cc.total_due_incurred - cc.total_return_credits - COALESCE(cv.total_vouchers_paid, 0)) AS variance
FROM client_calc cc
LEFT JOIN client_vouchers cv ON cv.client_id = cc.client_id
ORDER BY cc.client_name;

-- 5. Suppliers Current Balance vs Sum of Purchases / Returns / Vouchers
WITH supplier_calc AS (
  SELECT 
    s.id AS supplier_id,
    s.name AS supplier_name,
    s.current_balance AS db_balance,
    -- Sum of regular purchase due amounts
    COALESCE(SUM(CASE WHEN p.purchase_type <> 'return' THEN p.due_amount ELSE 0 END), 0) AS total_purchase_due,
    -- Sum of purchase return credits (net_total - cash received)
    COALESCE(SUM(CASE WHEN p.purchase_type = 'return' THEN GREATEST(0, p.net_total - p.paid_amount) ELSE 0 END), 0) AS total_return_credits
  FROM suppliers s
  LEFT JOIN purchases p ON p.supplier_id = s.id
  WHERE s.tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
  GROUP BY s.id, s.name, s.current_balance
),
supplier_vouchers AS (
  SELECT 
    v.party_id AS supplier_id,
    COALESCE(SUM(v.amount), 0) AS total_vouchers_paid
  FROM vouchers v
  WHERE v.tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
    AND v.party_type = 'supplier'
  GROUP BY v.party_id
)
SELECT 
  '5. SUPPLIER RECONCILIATION' AS section,
  sc.supplier_name,
  sc.db_balance,
  (sc.total_purchase_due - sc.total_return_credits - COALESCE(sv.total_vouchers_paid, 0)) AS calculated_balance,
  sc.db_balance - (sc.total_purchase_due - sc.total_return_credits - COALESCE(sv.total_vouchers_paid, 0)) AS variance
FROM supplier_calc sc
LEFT JOIN supplier_vouchers sv ON sv.supplier_id = sc.supplier_id
ORDER BY sc.supplier_name;

-- 6. Token Transactions Summary (Excluding Reversed)
SELECT 
  '6. TOKENS SUMMARY' AS section,
  type,
  usage_status,
  COUNT(*) AS transaction_count,
  SUM(quantity) AS total_qty,
  SUM(total_amount) AS total_amount
FROM token_transactions
WHERE tenant_id = 'f6b883aa-c630-4e08-a555-72d4d751e147'
  AND (created_at::date = '2026-10-26')
  AND usage_status <> 'reversed'
  AND type <> 'reversal'
GROUP BY type, usage_status;

-- 7. CEO KPI Result from RPC
SELECT 
  '7. CEO KPI RPC' AS section,
  *
FROM get_ceo_branches_kpi_summary(ARRAY['f6b883aa-c630-4e08-a555-72d4d751e147'::uuid], '2026-10-26'::date);
