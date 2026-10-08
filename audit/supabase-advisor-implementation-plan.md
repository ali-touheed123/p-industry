# Supabase Advisor — Reconciled Implementation Plan

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Target Migration File:** `supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`  
**Goal:** Address all 59 Supabase Advisor findings (42 WARN, 17 INFO) with 100% exact PostgreSQL function signatures.  
**Execution Strategy:** Single, atomic, idempotent database migration.  

---

## 1. Execution Strategy & Principles

All remediation DDL statements will be packaged into a single migration file:

`supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`

### Core Implementation Principles
1. **Exact PostgreSQL Function Identities:** Every `ALTER FUNCTION`, `REVOKE EXECUTE`, and `GRANT EXECUTE` statement uses the exact schema-qualified name and exact ordered parameter types matching PostgreSQL definitions.
2. **Expected Architectural Compatibility:** Based on codebase analysis, all backend API routes in `src/app/api/` interact with the database via `supabaseAdmin` (`service_role`). `service_role` bypasses RLS and maintains full privileges. Post-migration verification is required to confirm zero regression.
3. **Idempotent DDL:** DDL statements rely on standard PostgreSQL idempotency patterns (`ALTER FUNCTION ... SET search_path`, `REVOKE ... FROM PUBLIC`, policy creation checks).

---

## 2. Phased Execution Waves & Exact DDL Statements

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        MIGRATION EXECUTION WAVES                           │
├────────────────────────────────────────────────────────────────────────────┤
│ WAVE 1: Harden Function Search Paths (6 ALTER FUNCTION statements)         │
│   └── Resolves SA-W-001 through SA-W-006 (SA-RG-001)                      │
├────────────────────────────────────────────────────────────────────────────┤
│ WAVE 2: Revoke Public Execute & Grant Service Role (18 Functions)           │
│   └── Resolves SA-W-007 through SA-W-042 (SA-RG-002 & SA-RG-003)           │
├────────────────────────────────────────────────────────────────────────────┤
│ WAVE 3: Add Service Role RLS Policies (17 Tables)                          │
│   └── Resolves SA-I-001 through SA-I-017 (SA-RG-004)                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Wave 1: Function Search Path Hardening (SA-RG-001)
Adds `SET search_path = public, pg_temp` to the 6 `SECURITY DEFINER` functions missing explicit schema scoping.

**Exact DDL Statements:**
1. `ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) SET search_path = public, pg_temp;`
2. `ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) SET search_path = public, pg_temp;`
3. `ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) SET search_path = public, pg_temp;`
4. `ALTER FUNCTION public.set_default_receipt_template(uuid) SET search_path = public, pg_temp;`
5. `ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) SET search_path = public, pg_temp;`
6. `ALTER FUNCTION public.reset_rate_limit_atomic(text) SET search_path = public, pg_temp;`

---

### Wave 2: Function Execution Security (SA-RG-002 & SA-RG-003)
Revokes default `PUBLIC` execution rights from all 18 `SECURITY DEFINER` functions and explicitly grants `EXECUTE` rights to `service_role`.

**Exact DDL Statements per Function (18 Functions Total):**

```sql
-- 1. adjust_item_stock(uuid, numeric)
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) TO service_role;

-- 2. adjust_item_stock_by_code(uuid, text, numeric)
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) TO service_role;

-- 3. cancel_invoice_atomic(uuid, uuid, text, text)
REVOKE EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) TO service_role;

-- 4. cancel_purchase_atomic(uuid, uuid)
REVOKE EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) TO service_role;

-- 5. check_rate_limit_atomic(text, integer, integer)
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) TO service_role;

-- 6. create_invoice_atomic(jsonb, jsonb, jsonb)
REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) TO service_role;

-- 7. create_purchase_atomic(uuid, jsonb, jsonb, uuid[])
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;

-- 8. create_voucher_atomic(uuid, jsonb, uuid[])
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) TO service_role;

-- 9. get_ceo_branches_kpi_summary(uuid[], date)
REVOKE EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) TO service_role;

-- 10. process_branch_dispatch_atomic(uuid, uuid)
REVOKE EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) TO service_role;

-- 11. process_branch_receive_atomic(uuid, uuid, uuid)
REVOKE EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) TO service_role;

-- 12. receive_goods_atomic(uuid, uuid, numeric, text, text, text)
REVOKE EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) TO service_role;

-- 13. redeem_tokens_atomic(jsonb, jsonb)
REVOKE EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) TO service_role;

-- 14. reserve_ai_usage(uuid, text, text, text, text)
REVOKE EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) TO service_role;

-- 15. reset_rate_limit_atomic(text)
REVOKE EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) TO service_role;

-- 16. set_default_receipt_template(uuid)
REVOKE EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) TO service_role;

-- 17. settle_tokens_atomic(uuid, jsonb, uuid, text, text, text)
REVOKE EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) TO service_role;

-- 18. update_invoice_atomic(uuid, uuid, jsonb, jsonb)
REVOKE EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) TO service_role;
```

---

### Wave 3: Service Role RLS Policies (SA-RG-004)
Provides explicit policy reconciliation for the 17 tables flagged under INFO linter findings.

**Target Tables (17 Total):**
`app_users`, `audit_logs`, `branch_order_items`, `branch_orders`, `clients`, `invoice_items`, `invoices`, `items`, `petty_expenses`, `purchase_items`, `purchases`, `receipt_templates`, `shifts`, `suppliers`, `tenant_receipt_template`, `tenants`, `vouchers`

---

## 3. Post-Migration Verification & Test Criteria

1. **Supabase Advisor Audit Verification:**
   - Re-run Supabase Advisor linter.
   - Confirm `WARNINGS` count drops from 42 to **0**.
   - Confirm `INFO` count drops from 17 to **0**.
   - Confirm `ERRORS` count remains **0**.

2. **Function Privilege SQL Verification Query:**
   ```sql
   SELECT routine_name, grantee, privilege_type 
   FROM information_schema.routine_privileges 
   WHERE routine_schema = 'public' 
     AND routine_name IN (
       'adjust_item_stock', 'adjust_item_stock_by_code', 'cancel_invoice_atomic',
       'cancel_purchase_atomic', 'check_rate_limit_atomic', 'create_invoice_atomic',
       'create_purchase_atomic', 'create_voucher_atomic', 'get_ceo_branches_kpi_summary',
       'process_branch_dispatch_atomic', 'process_branch_receive_atomic', 'receive_goods_atomic',
       'redeem_tokens_atomic', 'reserve_ai_usage', 'reset_rate_limit_atomic',
       'set_default_receipt_template', 'settle_tokens_atomic', 'update_invoice_atomic'
     );
   ```
   *Expected Result:* Zero entries for `grantee IN ('PUBLIC', 'anon', 'authenticated')`.

3. **Application Suite Verification:**
   - Run integration tests (`npm run test`) to verify API routes function correctly with `service_role`.
