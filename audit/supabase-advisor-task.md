# Supabase Advisor — Live-Verified Remediation Task Register
## PyntFlow POS & Industrial ERP (`p-industry`)
**Document Status:** AUDIT-VERIFIED TASK REGISTER (PRE-IMPLEMENTATION)  
**Verification Date:** October 9, 2026  
**Derived From:** Live Supabase PostgreSQL 17.6 Forensic Database Audit  
**Implementation Constraint:** READ-ONLY AUDIT COMPLETE — AWAITING IMPLEMENTATION AUTHORIZATION  

---

## 1. Master Task Inventory

| Task ID | Finding IDs | Category | Target Object Count | Current Live State | Risk | Status |
|---|---|---|---|---|---|---|
| **SA-TASK-01** | `SA-W-001` to `SA-W-006` | Function Search Path | 6 Functions | `proconfig IS NULL` | Low | **READY FOR IMPLEMENTATION** |
| **SA-TASK-02** | `SA-W-007` to `SA-W-024` | Anon RPC Execution | 18 Functions | `has_anon = true` | Zero (App uses server Admin) | **READY FOR IMPLEMENTATION** |
| **SA-TASK-03** | `SA-W-025` to `SA-W-042` | Authenticated RPC Execution | 18 Functions | `has_authenticated = true`| Zero (App uses server Admin) | **READY FOR IMPLEMENTATION** |
| **SA-TASK-04** | `SA-I-001` to `SA-I-017` | RLS Explicit Policies | 17 Tables | `pg_policy` count = 0 | Zero (Default-deny documented) | **READY FOR IMPLEMENTATION** |
| **SA-TASK-05** | `ALL` (59 Findings) | Verification & Linter | 59 Findings | 42 WARN, 17 INFO | Zero | **BLOCKED BY MIGRATION** |

---

## 2. Detailed Task Specifications

### SA-TASK-01: Harden Mutable Search Paths on SECURITY DEFINER Functions
- **Task ID:** `SA-TASK-01`
- **Finding IDs:** `SA-W-001`, `SA-W-002`, `SA-W-003`, `SA-W-004`, `SA-W-005`, `SA-W-006`
- **Exact Database Objects & Signatures:**
  1. `public.process_branch_dispatch_atomic(uuid, uuid)`
  2. `public.process_branch_receive_atomic(uuid, uuid, uuid)`
  3. `public.get_ceo_branches_kpi_summary(uuid[], date)`
  4. `public.set_default_receipt_template(uuid)`
  5. `public.check_rate_limit_atomic(text, integer, integer)`
  6. `public.reset_rate_limit_atomic(text)`
- **Current Verified State:** Functions are defined with `SECURITY DEFINER` and have `proconfig IS NULL`. Execution runs with owner privileges while resolving objects using user's active session `search_path`.
- **Required Change:** Execute `ALTER FUNCTION <signature> SET search_path = public, pg_temp;` for each of the 6 functions.
- **Dependencies:** None.
- **Risk:** Zero. All tables, functions, and types invoked reside in `public`.
- **Rollback:** `ALTER FUNCTION <signature> RESET search_path;`
- **Verification Query:**
  ```sql
  SELECT proname, proconfig 
  FROM pg_proc 
  WHERE proname IN (
    'process_branch_dispatch_atomic', 'process_branch_receive_atomic', 
    'get_ceo_branches_kpi_summary', 'set_default_receipt_template', 
    'check_rate_limit_atomic', 'reset_rate_limit_atomic'
  );
  ```
- **Expected Advisor Result:** 6 `function_search_path_mutable` warnings cleared (0 remaining).

---

### SA-TASK-02: Revoke Anon Execution Rights on SECURITY DEFINER Functions
- **Task ID:** `SA-TASK-02`
- **Finding IDs:** `SA-W-007` to `SA-W-024` (18 Warnings)
- **Exact Database Objects & Signatures:**
  1. `public.adjust_item_stock(uuid, numeric)`
  2. `public.adjust_item_stock_by_code(uuid, text, numeric)`
  3. `public.cancel_invoice_atomic(uuid, uuid, text, text)`
  4. `public.cancel_purchase_atomic(uuid, uuid)`
  5. `public.check_rate_limit_atomic(text, integer, integer)`
  6. `public.create_invoice_atomic(jsonb, jsonb, jsonb)`
  7. `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])`
  8. `public.create_voucher_atomic(uuid, jsonb, uuid[])`
  9. `public.get_ceo_branches_kpi_summary(uuid[], date)`
  10. `public.process_branch_dispatch_atomic(uuid, uuid)`
  11. `public.process_branch_receive_atomic(uuid, uuid, uuid)`
  12. `public.receive_goods_atomic(uuid, uuid, numeric, text, text, text)`
  13. `public.redeem_tokens_atomic(jsonb, jsonb)`
  14. `public.reserve_ai_usage(uuid, text, text, text, text)`
  15. `public.reset_rate_limit_atomic(text)`
  16. `public.set_default_receipt_template(uuid)`
  17. `public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text)`
  18. `public.update_invoice_atomic(uuid, uuid, jsonb, jsonb)`
- **Current Verified State:** All 18 functions have `has_function_privilege('anon', oid, 'EXECUTE') = true` due to default `PUBLIC` execution rights. PostgREST exposes these functions directly at `/rest/v1/rpc/<name>`.
- **Required Change:** Execute `REVOKE EXECUTE ON FUNCTION <signature> FROM PUBLIC, anon;` and `GRANT EXECUTE ON FUNCTION <signature> TO service_role;` for each of the 18 functions.
- **Dependencies:** None.
- **Risk:** Zero application breakage. All application callers in `src/app/api/` execute via `supabaseAdmin` (`service_role` key).
- **Rollback:** `GRANT EXECUTE ON FUNCTION <signature> TO PUBLIC;`
- **Verification Query:**
  ```sql
  SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as has_anon
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef = true;
  ```
- **Expected Advisor Result:** 18 `anon_security_definer_function_executable` warnings cleared (0 remaining).

---

### SA-TASK-03: Revoke Authenticated Execution Rights on SECURITY DEFINER Functions
- **Task ID:** `SA-TASK-03`
- **Finding IDs:** `SA-W-025` to `SA-W-042` (18 Warnings)
- **Exact Database Objects & Signatures:** Identical 18 functions specified in `SA-TASK-02`.
- **Current Verified State:** All 18 functions have `has_function_privilege('authenticated', oid, 'EXECUTE') = true`. End-user JWTs can execute superuser functions directly via Supabase API.
- **Required Change:** Execute `REVOKE EXECUTE ON FUNCTION <signature> FROM authenticated;` for each of the 18 functions.
- **Dependencies:** `SA-TASK-02` (can be executed in the same statement: `REVOKE ... FROM PUBLIC, anon, authenticated`).
- **Risk:** Zero application breakage. No client components invoke RPC functions directly.
- **Rollback:** `GRANT EXECUTE ON FUNCTION <signature> TO authenticated;`
- **Verification Query:**
  ```sql
  SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as has_auth
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef = true;
  ```
- **Expected Advisor Result:** 18 `authenticated_security_definer_function_executable` warnings cleared (0 remaining).

---

### SA-TASK-04: Implement Explicit Service Role RLS Policies on 17 Tables
- **Task ID:** `SA-TASK-04`
- **Finding IDs:** `SA-I-001` to `SA-I-017` (17 Info Findings)
- **Exact Database Objects:**
  1. `public.app_users`
  2. `public.audit_logs`
  3. `public.branch_order_items`
  4. `public.branch_orders`
  5. `public.clients`
  6. `public.invoice_items`
  7. `public.invoices`
  8. `public.items`
  9. `public.petty_expenses`
  10. `public.purchase_items`
  11. `public.purchases`
  12. `public.receipt_templates`
  13. `public.shifts`
  14. `public.suppliers`
  15. `public.tenant_receipt_template`
  16. `public.tenants`
  17. `public.vouchers`
- **Current Verified State:** All 17 tables have `relrowsecurity = true` but 0 records in `pg_policy`. Supabase Advisor flags lack of explicit policy definition.
- **Required Change:** Create an explicit permissive `service_role` policy on each table:
  ```sql
  CREATE POLICY "<table_name>_service_role" ON public."<table_name>"
    AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  ```
- **Dependencies:** None.
- **Risk:** Zero. `service_role` already possesses full bypass capabilities. The explicit policy documents access intent and silences Advisor warnings.
- **Rollback:** `DROP POLICY IF EXISTS "<table_name>_service_role" ON public."<table_name>";`
- **Verification Query:**
  ```sql
  SELECT tablename, count(*) 
  FROM pg_policies 
  WHERE schemaname = 'public' 
  GROUP BY tablename 
  ORDER BY tablename;
  ```
- **Expected Advisor Result:** 17 `rls_enabled_no_policy` info suggestions cleared (0 remaining).

---

### SA-TASK-05: Post-Implementation Verification & Final Advisor Audit
- **Task ID:** `SA-TASK-05`
- **Finding IDs:** All 59 Findings
- **Exact Database Objects:** Entire `public` schema (30 tables, 19 functions).
- **Current Verified State:** Audit verified baseline: 42 Warnings, 17 Info.
- **Required Change:** Run verification script to confirm:
  - 0 functions with `proconfig IS NULL`
  - 0 functions with `anon` or `authenticated` execute rights
  - 0 tables with RLS enabled and 0 policies
  - End-to-end API route regression test (POS checkout, token redemption, AI gateway, purchase, vouchers)
- **Dependencies:** `SA-TASK-01`, `SA-TASK-02`, `SA-TASK-03`, `SA-TASK-04`
- **Risk:** Zero. Read-only validation.
- **Rollback:** N/A.
- **Verification Query:** Full catalog query suite against live database.
- **Expected Advisor Result:**
  - **Errors:** 0
  - **Warnings:** 0
  - **Info:** 0
  - **Total Findings:** 0
