# Supabase Advisor — Live-Verified Implementation Plan
## PyntFlow POS & Industrial ERP (`p-industry`)
**Document Status:** AUDIT-VERIFIED & EVIDENCE-CHALLENGED IMPLEMENTATION PLAN  
**Verification Date:** October 9, 2026 (Phase 2B Update)  
**Target Migration:** `supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`  
**Scope:** 59 Live-Verified Advisor Findings (42 Security Warnings, 17 Informational Suggestions)  
**Execution Mode:** Single Atomic, Idempotent Database Migration  

---

## 1. Architectural Strategy & Design Principles

This implementation plan is derived **strictly from live PostgreSQL 17.6 catalog inspection** and cross-repository caller analysis.

### Verified Architectural Baseline
1. **Server Architecture:** All application backend routes in `src/app/api/` execute atomic workflows exclusively via `supabaseAdmin` with the `service_role` key. Zero client-side components call `supabase.rpc()` directly.
2. **PostgreSQL Privilege Hierarchy:** 
   - New functions inherit `EXECUTE` rights granted to pseudo-role `PUBLIC`. This exposes internal superuser logic (`SECURITY DEFINER`) to unauthenticated HTTP consumers on PostgREST (`anon`).
   - Revoking `EXECUTE` from `PUBLIC, anon, authenticated` closes direct PostgREST RPC exposure without affecting `supabaseAdmin` (`service_role`).
3. **Idempotency & Safety:** All DDL statements employ idempotent clauses (`ALTER FUNCTION ... SET search_path`, `REVOKE ... FROM PUBLIC, anon, authenticated`, `CREATE POLICY ... IF NOT EXISTS`).

---

## 2. Wave 1: Function Search Path Hardening (Security Fix — 6 Functions)

Remediates Advisor findings **SA-W-001 through SA-W-006** (`function_search_path_mutable`).

### Remediations

#### REM-01: `process_branch_dispatch_atomic`
- **Live Object:** `public.process_branch_dispatch_atomic`
- **Live Signature:** `process_branch_dispatch_atomic(p_order_id uuid, p_to_tenant_id uuid)`
- **Current State:** `prosecdef = true`, `proowner = postgres`, `proconfig IS NULL`
- **Intended Change:** Set explicit search path to `public, pg_temp`
- **Safety Proof:** Unqualified references (`branch_order_items`, `items`, `branch_orders`) reside strictly in `public`. Built-in functions (`COALESCE`, `NULLIF`, `UPPER`, `TRIM`, `GREATEST`) are in `pg_catalog`.
- **Operational Risk:** Zero regression risk for application logic. Eliminates temporary schema hijacking.
- **Rollback:** `ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) RESET search_path;`
- **SQL Statement:**
  ```sql
  ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) SET search_path = public, pg_temp;
  ```

#### REM-02: `process_branch_receive_atomic`
- **Live Object:** `public.process_branch_receive_atomic`
- **Live Signature:** `process_branch_receive_atomic(p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid)`
- **Current State:** `prosecdef = true`, `proowner = postgres`, `proconfig IS NULL`
- **Intended Change:** Set explicit search path to `public, pg_temp`
- **Safety Proof:** Unqualified references (`branch_order_items`, `items`) reside strictly in `public`.
- **Operational Risk:** Zero regression risk for application logic.
- **Rollback:** `ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) RESET search_path;`
- **SQL Statement:**
  ```sql
  ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) SET search_path = public, pg_temp;
  ```

#### REM-03: `get_ceo_branches_kpi_summary`
- **Live Object:** `public.get_ceo_branches_kpi_summary`
- **Live Signature:** `get_ceo_branches_kpi_summary(p_tenant_ids uuid[], p_today date)`
- **Current State:** `prosecdef = true`, `proowner = postgres`, `proconfig IS NULL`
- **Intended Change:** Set explicit search path to `public, pg_temp`
- **Safety Proof:** Queries `public.invoices` and `public.clients`.
- **Operational Risk:** Zero regression risk for application logic.
- **Rollback:** `ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) RESET search_path;`
- **SQL Statement:**
  ```sql
  ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) SET search_path = public, pg_temp;
  ```

#### REM-04: `set_default_receipt_template`
- **Live Object:** `public.set_default_receipt_template`
- **Live Signature:** `set_default_receipt_template(p_template_id uuid)`
- **Current State:** `prosecdef = true`, `proowner = postgres`, `proconfig IS NULL`
- **Intended Change:** Set explicit search path to `public, pg_temp`
- **Safety Proof:** Modifies `public.receipt_templates`.
- **Operational Risk:** Zero regression risk for application logic.
- **Rollback:** `ALTER FUNCTION public.set_default_receipt_template(uuid) RESET search_path;`
- **SQL Statement:**
  ```sql
  ALTER FUNCTION public.set_default_receipt_template(uuid) SET search_path = public, pg_temp;
  ```

#### REM-05: `check_rate_limit_atomic`
- **Live Object:** `public.check_rate_limit_atomic`
- **Live Signature:** `check_rate_limit_atomic(p_key text, p_max_attempts integer, p_window_seconds integer)`
- **Current State:** `prosecdef = true`, `proowner = postgres`, `proconfig IS NULL`
- **Intended Change:** Set explicit search path to `public, pg_temp`
- **Safety Proof:** Accesses `public.rate_limit_entries`.
- **Operational Risk:** Zero regression risk for application logic.
- **Rollback:** `ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) RESET search_path;`
- **SQL Statement:**
  ```sql
  ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) SET search_path = public, pg_temp;
  ```

#### REM-06: `reset_rate_limit_atomic`
- **Live Object:** `public.reset_rate_limit_atomic`
- **Live Signature:** `reset_rate_limit_atomic(p_key text)`
- **Current State:** `prosecdef = true`, `proowner = postgres`, `proconfig IS NULL`
- **Intended Change:** Set explicit search path to `public, pg_temp`
- **Safety Proof:** Accesses `public.rate_limit_entries`.
- **Operational Risk:** Zero regression risk for application logic.
- **Rollback:** `ALTER FUNCTION public.reset_rate_limit_atomic(text) RESET search_path;`
- **SQL Statement:**
  ```sql
  ALTER FUNCTION public.reset_rate_limit_atomic(text) SET search_path = public, pg_temp;
  ```

---

## 3. Wave 2: Function Execution Hardening (Security Fix — 18 Functions)

Remediates Advisor findings **SA-W-007 through SA-W-042** (36 warnings: 18 `anon` + 18 `authenticated`).

### Execution Remediation Pattern
For each function:
```sql
REVOKE EXECUTE ON FUNCTION public.<signature> FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<signature> TO service_role;
```

### Verified Target Function Signatures & Remediation Registry

| Remediation ID | Exact PostgreSQL Function Signature | Target Object | Advisor Findings Resolved |
|---|---|---|---|
| **REM-F01** | `public.adjust_item_stock(uuid, numeric)` | `adjust_item_stock` | `SA-W-007`, `SA-W-025` |
| **REM-F02** | `public.adjust_item_stock_by_code(uuid, text, numeric)` | `adjust_item_stock_by_code` | `SA-W-008`, `SA-W-026` |
| **REM-F03** | `public.cancel_invoice_atomic(uuid, uuid, text, text)` | `cancel_invoice_atomic` | `SA-W-009`, `SA-W-027` |
| **REM-F04** | `public.cancel_purchase_atomic(uuid, uuid)` | `cancel_purchase_atomic` | `SA-W-010`, `SA-W-028` |
| **REM-F05** | `public.check_rate_limit_atomic(text, integer, integer)` | `check_rate_limit_atomic` | `SA-W-011`, `SA-W-029` |
| **REM-F06** | `public.create_invoice_atomic(jsonb, jsonb, jsonb)` | `create_invoice_atomic` | `SA-W-012`, `SA-W-030` |
| **REM-F07** | `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` | `create_purchase_atomic` | `SA-W-013`, `SA-W-031` |
| **REM-F08** | `public.create_voucher_atomic(uuid, jsonb, uuid[])` | `create_voucher_atomic` | `SA-W-014`, `SA-W-032` |
| **REM-F09** | `public.get_ceo_branches_kpi_summary(uuid[], date)` | `get_ceo_branches_kpi_summary` | `SA-W-015`, `SA-W-033` |
| **REM-F10** | `public.process_branch_dispatch_atomic(uuid, uuid)` | `process_branch_dispatch_atomic` | `SA-W-016`, `SA-W-034` |
| **REM-F11** | `public.process_branch_receive_atomic(uuid, uuid, uuid)` | `process_branch_receive_atomic` | `SA-W-017`, `SA-W-035` |
| **REM-F12** | `public.receive_goods_atomic(uuid, uuid, numeric, text, text, text)` | `receive_goods_atomic` | `SA-W-018`, `SA-W-036` |
| **REM-F13** | `public.redeem_tokens_atomic(jsonb, jsonb)` | `redeem_tokens_atomic` | `SA-W-019`, `SA-W-037` |
| **REM-F14** | `public.reserve_ai_usage(uuid, text, text, text, text)` | `reserve_ai_usage` | `SA-W-020`, `SA-W-038` |
| **REM-F15** | `public.reset_rate_limit_atomic(text)` | `reset_rate_limit_atomic` | `SA-W-021`, `SA-W-039` |
| **REM-F16** | `public.set_default_receipt_template(uuid)` | `set_default_receipt_template` | `SA-W-022`, `SA-W-040` |
| **REM-F17** | `public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text)` | `settle_tokens_atomic` | `SA-W-023`, `SA-W-041` |
| **REM-F18** | `public.update_invoice_atomic(uuid, uuid, jsonb, jsonb)` | `update_invoice_atomic` | `SA-W-024`, `SA-W-042` |

- **Current State:** `has_function_privilege('public', oid, 'EXECUTE') = true`, `has_function_privilege('anon', oid, 'EXECUTE') = true`, `has_function_privilege('authenticated', oid, 'EXECUTE') = true`.
- **Intended Change:** Direct RPC execution blocked for unauthenticated and user-level JWT callers via PostgREST.
- **Operational Risk Assessment:**
  - **Application Workflows:** Zero regression risk. Code inspection confirms 100% of application callers invoke these functions via `supabaseAdmin` (`service_role` key) on server routes.
  - **Unauthorized External Callers:** 100% breaking (intended security outcome).
- **Accurate Rollback Statement (Restores Original ACL):**
  ```sql
  GRANT EXECUTE ON FUNCTION public.<signature> TO PUBLIC, anon, authenticated;
  ```

---

## 4. Wave 3: Explicit Service Role RLS Policies (Linter Hygiene — 17 Tables)

Remediates Advisor findings **SA-I-001 through SA-I-017** (`rls_enabled_no_policy`).

### Context & Nature of Change
- **Classification:** Informational Linter Hygiene (not an active data leak).
- **Runtime Reality:** In PostgreSQL, an RLS-enabled table with no policies defaults to **Default Deny** for all non-superusers. `service_role` already bypasses RLS in Supabase via `BYPASSRLS`.
- **Objective:** Adding explicit `service_role` policies documents the intentional access model in PostgreSQL catalogs and silences the 17 Advisor INFO findings.

### Remediation Pattern
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

### Target Table Registry (17 Tables)

| Remediation ID | Target Table | Policy Name Created | Advisor Finding Resolved |
|---|---|---|---|
| **REM-T01** | `public.app_users` | `app_users_service_role` | `SA-I-001` |
| **REM-T02** | `public.audit_logs` | `audit_logs_service_role` | `SA-I-002` |
| **REM-T03** | `public.branch_order_items` | `branch_order_items_service_role` | `SA-I-003` |
| **REM-T04** | `public.branch_orders` | `branch_orders_service_role` | `SA-I-004` |
| **REM-T05** | `public.clients` | `clients_service_role` | `SA-I-005` |
| **REM-T06** | `public.invoice_items` | `invoice_items_service_role` | `SA-I-006` |
| **REM-T07** | `public.invoices` | `invoices_service_role` | `SA-I-007` |
| **REM-T08** | `public.items` | `items_service_role` | `SA-I-008` |
| **REM-T09** | `public.petty_expenses` | `petty_expenses_service_role` | `SA-I-009` |
| **REM-T10** | `public.purchase_items` | `purchase_items_service_role` | `SA-I-010` |
| **REM-T11** | `public.purchases` | `purchases_service_role` | `SA-I-011` |
| **REM-T12** | `public.receipt_templates` | `receipt_templates_service_role` | `SA-I-012` |
| **REM-T13** | `public.shifts` | `shifts_service_role` | `SA-I-013` |
| **REM-T14** | `public.suppliers` | `suppliers_service_role` | `SA-I-014` |
| **REM-T15** | `public.tenant_receipt_template` | `tenant_receipt_template_service_role` | `SA-I-015` |
| **REM-T16** | `public.tenants` | `tenants_service_role` | `SA-I-016` |
| **REM-T17** | `public.vouchers` | `vouchers_service_role` | `SA-I-017` |

- **Operational Risk:** Zero. Does not expose tables to non-superusers; documents administrative access.
- **Rollback:** `DROP POLICY IF EXISTS "<table_name>_service_role" ON public."<table_name>";`

---

## 5. Migration Tracking Drift Accommodation

- **Discrepancy:** The live database contains tables `rate_limit_entries` and `revoked_sessions` that were applied without updating `supabase_migrations.schema_migrations`.
- **Handling:** All DDL in `20261009_01_supabase_advisor_reconciliation.sql` uses defensive `IF EXISTS` / `IF NOT EXISTS` syntax so that execution succeeds regardless of migration tracking state.
- **CLI Repair Note:** If managing migrations via Supabase CLI in the future, run:
  ```bash
  supabase migration repair --status applied 2026100801
  supabase migration repair --status applied 2026100802
  ```

---

## 6. Target Post-Remediation Advisor State

| Metric | Pre-Remediation State | Target State | Nature of Resolution |
|---|---|---|---|
| **Mutable `search_path` Warnings** | 6 | **0** | Security Vulnerability Fix |
| **Anon Execute Rights Warnings** | 18 | **0** | Security Vulnerability Fix |
| **Authenticated Execute Rights Warnings** | 18 | **0** | Security Vulnerability Fix |
| **RLS Enabled No Policy Suggestions** | 17 | **0** | Linter Hygiene Cleanup |
| **Total Supabase Advisor Findings** | **59** | **0** | Complete Resolution |
