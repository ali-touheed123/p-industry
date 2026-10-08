# SUPABASE DATABASE LINTER — FORENSIC AUDIT REPORT

**Date:** October 8, 2026  
**Auditor:** Lead Database Security Architect & Forensic Systems Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Target Goal:** **0 WARNING + 0 INFO + 0 FINDINGS (100% CLEAN LINTER STATE)**  

---

## 1. Executive Summary

This Forensic Audit Report analyzes the complete finding set of the Supabase Database Linter against the live PyntFlow PostgreSQL schema.

The audit evaluated 3 main linter warning/info categories:
1. `function_search_path_mutable` (18 Functions)
2. `anon_security_definer_function_executable` & `authenticated_security_definer_function_executable` (18 Functions)
3. `rls_enabled_no_policy` (Tables with RLS enabled lacking explicit policies)

---

## 2. Detailed Finding Breakdown & Root Cause Analysis

### Category A: `function_search_path_mutable`
- **Root Cause**: `SECURITY DEFINER` functions created in migrations without explicit `SET search_path = public, pg_temp`.
- **Security Impact**: **High**. Search Path Hijacking vulnerability allowing session-level manipulation of schema resolution order.
- **Affected Functions (18 Total)**:
  1. `public.adjust_item_stock(UUID, NUMERIC)`
  2. `public.adjust_item_stock_by_code(UUID, TEXT, NUMERIC)`
  3. `public.create_invoice_atomic(...)`
  4. `public.cancel_invoice_atomic(...)`
  5. `public.redeem_tokens_atomic(...)`
  6. `public.reserve_ai_usage(...)`
  7. `public.process_branch_dispatch_atomic(...)`
  8. `public.receive_branch_dispatch_atomic(...)`
  9. `public.receive_goods_atomic(...)`
  10. `public.create_purchase_atomic(...)`
  11. `public.cancel_purchase_atomic(...)`
  12. `public.create_voucher_atomic(...)`
  13. `public.get_ceo_branches_kpi_summary(...)`
  14. `public.set_default_receipt_template(...)`
  15. `public.update_invoice_atomic(...)`
  16. `public.settle_tokens_atomic(...)`
  17. `public.check_rate_limit_atomic(...)`
  18. `public.reset_rate_limit_atomic(...)`

### Category B: `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`
- **Root Cause**: Default PostgreSQL behavior grants `EXECUTE` privileges on newly created functions to `PUBLIC` (including `anon` and `authenticated`).
- **Security Impact**: **Critical**. Allows unauthenticated or unauthorized clients to bypass Next.js API server checks and execute elevated `SECURITY DEFINER` functions directly via PostgREST `/rest/v1/rpc/<function>`.
- **Affected Functions**: All 18 RPC stored procedures listed above.

### Category C: `rls_enabled_no_policy`
- **Root Cause**: RLS was enabled on system tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) without explicit policies defined in `pg_policies`.
- **Security Impact**: **Medium**. Ambiguous security state where PostgREST defaults to 0 rows, but linter flags potential omitted policy intent.
- **Affected Tables**: `rate_limit_entries`, `revoked_sessions`, `custom_units`, and secondary catalog tables.

---

## 3. Performance Risk Evaluation

- **RLS Policy Overhead**: Adding `TO service_role USING (true) WITH CHECK (true)` policies adds zero execution overhead because service_role bypasses RLS evaluation.
- **Function Search Path**: Setting `SET search_path = public, pg_temp` is evaluated at function compilation time and incurs zero runtime latency.
- **Privilege Revocation**: `REVOKE EXECUTE` is checked during PostgREST route lookup and adds zero SQL execution cost.

---

## 4. Proposed Zero-Findings Remediation Strategy

1. **Function Search Path Hardening**:
   - Issue `ALTER FUNCTION public.<func_name>(...) SET search_path = public, pg_temp;` for all 18 functions.
2. **Strict Privilege Isolation**:
   - Issue `REVOKE EXECUTE ON FUNCTION public.<func_name>(...) FROM PUBLIC, anon, authenticated;`
   - Issue `GRANT EXECUTE ON FUNCTION public.<func_name>(...) TO service_role;`
3. **Explicit Service-Role RLS Policies**:
   - Issue `CREATE POLICY <table_name>_service_role ON public.<table_name> FOR ALL TO service_role USING (true) WITH CHECK (true);` for all tables.

---

## 5. Application Compatibility Audit
- Node.js API routes consume Supabase using `supabaseAdmin` (`SUPABASE_SERVICE_ROLE_KEY`).
- Service role operates with full database privileges, bypassing RLS and utilizing `service_role` EXECUTE grants.
- **Result**: **100% Backward Compatible — Zero Application Changes Required**.
