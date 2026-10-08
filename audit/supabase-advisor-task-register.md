# Supabase Advisor — Remediation Task Register (Evidence-Challenged)
## PyntFlow POS & Industrial ERP (`p-industry`)
**Document:** Master Remediation Task Register  
**Audit Date:** October 9, 2026 (Phase 2B Challenge Update)  
**Status:** REASSESSED & READY FOR AUTHORIZATION (READ-ONLY)  

---

## 1. Remediation Task Summary

| Task ID | Description | Source Advisor Findings | Finding Count | Classification | Safety & Operational Risk | Status |
|---|---|---|---|---|---|---|
| **SA-TASK-01** | Set explicit `search_path = public, pg_temp` | `WARN-01` to `WARN-06` | 6 Warnings | **Security Vulnerability Fix** | Zero regression risk; prevents search path hijacking | **READY FOR EXECUTION** |
| **SA-TASK-02** | Revoke `EXECUTE` from `PUBLIC` & `anon` on SECURITY DEFINER functions | `WARN-07` to `WARN-24` | 18 Warnings | **Security Vulnerability Fix** | Zero regression for app (uses `service_role`); blocks direct HTTP RPC | **READY FOR EXECUTION** |
| **SA-TASK-03** | Revoke `EXECUTE` from `authenticated` on SECURITY DEFINER functions | `WARN-25` to `WARN-42` | 18 Warnings | **Security Vulnerability Fix** | Zero regression for app (uses `service_role`); blocks user JWT RPC | **READY FOR EXECUTION** |
| **SA-TASK-04** | Create explicit `service_role` RLS policies on 17 tables | `INFO-01` to `INFO-17` | 17 Info | **Linter Hygiene Cleanup** | Zero risk; documents default-deny model | **READY FOR EXECUTION** |
| **SA-TASK-05** | Post-implementation catalog verification & regression test | All Findings | 59 Total | **Validation** | Read-only verification suite | **READY FOR EXECUTION** |

---

## 2. Detailed Task Mapping & Evidence Specifications

### SA-TASK-01: Harden Function Search Paths (6 Functions)
- **Finding IDs:** `WARN-01`, `WARN-02`, `WARN-03`, `WARN-04`, `WARN-05`, `WARN-06`
- **Advisor Finding Name:** `function_search_path_mutable`
- **Target Functions & Exact PostgreSQL Signatures:**
  1. `public.process_branch_dispatch_atomic(uuid, uuid)`
  2. `public.process_branch_receive_atomic(uuid, uuid, uuid)`
  3. `public.get_ceo_branches_kpi_summary(uuid[], date)`
  4. `public.set_default_receipt_template(uuid)`
  5. `public.check_rate_limit_atomic(text, integer, integer)`
  6. `public.reset_rate_limit_atomic(text)`
- **Supporting Catalog Evidence:** `pg_proc.proconfig` returns `null` for all 6 functions in the live database. Owner is `postgres` (Superuser).
- **Remediation Statement:**
  ```sql
  ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) SET search_path = public, pg_temp;
  ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) SET search_path = public, pg_temp;
  ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) SET search_path = public, pg_temp;
  ALTER FUNCTION public.set_default_receipt_template(uuid) SET search_path = public, pg_temp;
  ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) SET search_path = public, pg_temp;
  ALTER FUNCTION public.reset_rate_limit_atomic(text) SET search_path = public, pg_temp;
  ```
- **Accurate Rollback:**
  ```sql
  ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) RESET search_path;
  ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) RESET search_path;
  ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) RESET search_path;
  ALTER FUNCTION public.set_default_receipt_template(uuid) RESET search_path;
  ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) RESET search_path;
  ALTER FUNCTION public.reset_rate_limit_atomic(text) RESET search_path;
  ```

---

### SA-TASK-02 & SA-TASK-03: Revoke Public / Anon / Authenticated Execution Rights (18 Functions)
- **Finding IDs:** `WARN-07` through `WARN-42` (36 Warnings total)
- **Advisor Finding Names:** `anon_security_definer_function_executable` (18), `authenticated_security_definer_function_executable` (18)
- **Target Functions & Exact Signatures:**
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
- **Supporting Catalog Evidence:** Live queries on `pg_proc.proacl` confirm `=X/postgres` (PUBLIC), `anon=X/postgres`, and `authenticated=X/postgres` grants exist on all 18 functions.
- **Application Call-Site Evidence:** 100% of callers in `src/app/api/**` and `src/lib/**` invoke these functions via `supabaseAdmin` with the `service_role` key. Zero callers invoke them from public client components.
- **Operational Risk:** Zero regression risk for official application routes. 100% breaking for unauthorized or direct HTTP consumers (desired security goal).
- **Remediation Statements (per function):**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.<signature> FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.<signature> TO service_role;
  ```
- **Accurate Rollback (Restores Original Full ACL):**
  ```sql
  GRANT EXECUTE ON FUNCTION public.<signature> TO PUBLIC, anon, authenticated;
  ```

---

### SA-TASK-04: Explicit Service Role RLS Policies (17 Tables)
- **Finding IDs:** `INFO-01` through `INFO-17` (17 Info findings total)
- **Advisor Finding Name:** `rls_enabled_no_policy`
- **Target Tables (17 Tables):**
  `app_users`, `audit_logs`, `branch_order_items`, `branch_orders`, `clients`, `invoice_items`, `invoices`, `items`, `petty_expenses`, `purchase_items`, `purchases`, `receipt_templates`, `shifts`, `suppliers`, `tenant_receipt_template`, `tenants`, `vouchers`.
- **Supporting Catalog Evidence:** `pg_class.relrowsecurity = true` for all 17 tables, while `pg_policy` returns 0 policies.
- **Clarification:** Non-superusers are already blocked by PostgreSQL Default Deny. `service_role` already bypasses RLS via `BYPASSRLS`. This task is informational linter hygiene to document the architectural design and clear Advisor suggestions.
- **Remediation Statements:**
  ```sql
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = '<table_name>' 
        AND policyname = '<table_name>_service_role'
    ) THEN
      CREATE POLICY "<table_name>_service_role" ON public."<table_name>"
        AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
  END $$;
  ```
- **Accurate Rollback:**
  ```sql
  DROP POLICY IF EXISTS "<table_name>_service_role" ON public."<table_name>";
  ```

---

### SA-TASK-05: Post-Implementation Validation Suite
- **Verification Plan:**
  1. Query `pg_proc.proconfig` to verify 0 functions with `proconfig IS NULL`.
  2. Query `has_function_privilege` for `anon` and `authenticated` to confirm `false` across all 18 functions.
  3. Query `pg_policies` to confirm all 30 public tables have active policies.
  4. Run automated Next.js API route verification tests (sales checkout, inventory, rate limiter, AI reserve) to confirm complete application continuity.
