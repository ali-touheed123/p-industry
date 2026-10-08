# SUPABASE ADVISOR — CROSS-DOCUMENT RECONCILIATION & EVIDENCE CHALLENGE REPORT
## PyntFlow POS & Industrial ERP (`p-industry`)
**Document Phase:** Phase 2B — Evidence Challenge & GO/NO-GO Reassessment  
**Verification Date:** October 9, 2026  
**Status:** FORENSIC EVIDENCE CHALLENGED & RECONCILED (READ-ONLY)  

---

## 1. Executive Summary & Challenge Scope

This report independently challenges and reassesses the forensic claims, catalog queries, caller safety arguments, and remediation tasks for the 59 Supabase Advisor findings recorded in [supabase warnings.md](file:///d:/bestow/p-industry/audit/supabase%20warnings.md) and [supabase info.md](file:///d:/bestow/p-industry/audit/supabase%20info.md).

Every prior assertion of "zero operational risk" and "100% verified" has been subjected to rigorous cross-examination against:
1. Direct live PostgreSQL 17.6 system catalogs (`pg_class`, `pg_proc`, `pg_policy`, `information_schema`).
2. Static code analysis of all API routes (`src/app/api/**`), libraries (`src/lib/**`), scripts (`scripts/**`), and verification suites.
3. PostgreSQL Access Control Lists (`proacl`) and role privilege inheritance rules.
4. Migration tracking tables (`supabase_migrations.schema_migrations`) versus migration directory history.

---

## 2. Check 1 — Live Database Verification Evidence & Catalog Queries

Each verification claim is proven below with its exact targeted catalog query, execution parameters, and returned dataset:

### 2.1 Live Target Environment Identity
- **Target Project:** Supabase Project `ignspvajzblmsbertmmv`
- **Catalog Inspection Query:**
  ```sql
  SELECT version(), current_database(), current_user, current_role, current_schema, current_setting('search_path');
  ```
- **Live Output:**
  - `version`: `PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit`
  - `current_database`: `postgres`
  - `current_user`: `postgres` (Superuser)
  - `current_role`: `postgres`
  - `current_schema`: `public`
  - `search_path`: `"$user", public, extensions`

### 2.2 Proof of 6 Mutable Search Path Functions
- **Catalog Inspection Query:**
  ```sql
  SELECT proname, prosecdef, proowner::regrole::text AS owner, proconfig
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace 
    AND prosecdef = true 
    AND proconfig IS NULL
  ORDER BY proname;
  ```
- **Returned Rows (6 Functions):**
  1. `check_rate_limit_atomic` (owner: `postgres`, `proconfig`: `NULL`)
  2. `get_ceo_branches_kpi_summary` (owner: `postgres`, `proconfig`: `NULL`)
  3. `process_branch_dispatch_atomic` (owner: `postgres`, `proconfig`: `NULL`)
  4. `process_branch_receive_atomic` (owner: `postgres`, `proconfig`: `NULL`)
  5. `reset_rate_limit_atomic` (owner: `postgres`, `proconfig`: `NULL`)
  6. `set_default_receipt_template` (owner: `postgres`, `proconfig`: `NULL`)
- **Verification Verdict:** `VERIFIED` — All 6 functions genuinely run without schema pinning.

### 2.3 Proof of 18 SECURITY DEFINER Functions & ACL Privilege State
- **Catalog Inspection Query:**
  ```sql
  SELECT p.proname,
         pg_get_function_identity_arguments(p.oid) AS args,
         has_function_privilege('public', p.oid, 'EXECUTE') AS has_public,
         has_function_privilege('anon', p.oid, 'EXECUTE') AS has_anon,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS has_auth,
         has_function_privilege('service_role', p.oid, 'EXECUTE') AS has_service_role,
         p.proacl::text AS acl
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef = true
  ORDER BY p.proname;
  ```
- **Returned Rows:** Exactly 18 functions.
- **ACL State:** `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` across all 18 functions.
- **Privilege Breakdown:**
  - `=X/postgres`: Default EXECUTE granted to pseudo-role `PUBLIC`.
  - `anon=X/postgres`: Explicit EXECUTE granted to `anon`.
  - `authenticated=X/postgres`: Explicit EXECUTE granted to `authenticated`.
  - `service_role=X/postgres`: Explicit EXECUTE granted to `service_role`.
- **Verification Verdict:** `VERIFIED` — 18 functions are callable by anonymous users via `/rest/v1/rpc/*` and signed-in JWT users.

### 2.4 Proof of 17 RLS-Enabled Tables with Zero Policies
- **Catalog Inspection Query:**
  ```sql
  SELECT c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
  ORDER BY c.relname;
  ```
- **Returned Rows:** Exactly 30 tables:
  - **13 tables** have `policy_count = 1`
  - **17 tables** have `policy_count = 0`: `app_users`, `audit_logs`, `branch_order_items`, `branch_orders`, `clients`, `invoice_items`, `invoices`, `items`, `petty_expenses`, `purchase_items`, `purchases`, `receipt_templates`, `shifts`, `suppliers`, `tenant_receipt_template`, `tenants`, `vouchers`.
- **Verification Verdict:** `VERIFIED` — Exactly 17 tables match the Advisor INFO report.

### 2.5 Proof of Database Row Volume
- **Catalog Inspection Query:** Exact `SELECT count(*) FROM public."<table>"` executed sequentially on all 30 tables.
- **Returned Result:** Exactly 6 rows across the entire database:
  - `ai_usage_ledger`: 1 row
  - `app_users`: 1 row (global developer administrator)
  - `global_ai_settings`: 1 row
  - `receipt_templates`: 1 row
  - `tenant_ai_settings`: 1 row
  - `tenants`: 2 rows (`Test Shop A`, `Test Shop B`)
  - All other 24 tables: 0 rows.
- **Verification Verdict:** `VERIFIED` — Live database is currently in staging/seed configuration.

---

## 3. Check 2 — Challenge to Function Permission Changes

### 3.1 Caller Traversal Across Repository
A comprehensive grep search for `.rpc(` across the entire codebase yielded the following distribution:

| Function Name | Call Site(s) in Codebase | Invoking Client | Caller Scope |
|---|---|---|---|
| `adjust_item_stock` | *None* | Legacy function | Uncalled |
| `adjust_item_stock_by_code` | *None* | Legacy function | Uncalled |
| `cancel_invoice_atomic` | `src/app/api/invoices/route.ts` (lines 373, 535) | `supabaseAdmin` | Server API Route |
| `cancel_purchase_atomic` | `src/app/api/purchases/route.ts` (line 269) | `supabaseAdmin` | Server API Route |
| `check_rate_limit_atomic` | `src/lib/rate-limit.ts` (line 19) | `supabaseAdmin` | Server Middleware / Lib |
| `create_invoice_atomic` | `src/app/api/invoices/route.ts` (line 311) | `supabaseAdmin` | Server API Route |
| `create_purchase_atomic` | `src/app/api/purchases/route.ts` (line 139) | `supabaseAdmin` | Server API Route |
| `create_voucher_atomic` | `src/app/api/vouchers/route.ts` (line 122) | `supabaseAdmin` | Server API Route |
| `get_ceo_branches_kpi_summary`| `src/app/api/tenants/kpi/route.ts` (line 62) | `supabaseAdmin` | Server API Route |
| `process_branch_dispatch_atomic`| `src/app/api/branch-orders/route.ts` (line 325) | `supabaseAdmin` | Server API Route |
| `process_branch_receive_atomic` | `src/app/api/branch-orders/route.ts` (line 359) | `supabaseAdmin` | Server API Route |
| `receive_goods_atomic` | `src/app/api/items/receive/route.ts` (line 32) | `supabaseAdmin` | Server API Route |
| `redeem_tokens_atomic` | `src/app/api/token-redemptions/route.ts` (line 114) | `supabaseAdmin` | Server API Route |
| `reserve_ai_usage` | `src/lib/ai-gateway.ts` (line 202) | `supabaseAdmin` | Server Middleware / Lib |
| `reset_rate_limit_atomic` | `src/lib/rate-limit.ts` (line 66) | `supabaseAdmin` | Server Middleware / Lib |
| `set_default_receipt_template`| `src/app/api/receipt-templates/route.ts` (lines 130, 185) | `supabaseAdmin` | Server API Route |
| `settle_tokens_atomic` | `src/app/api/tokens/route.ts` (line 458) | `supabaseAdmin` | Server API Route |
| `update_invoice_atomic` | `src/app/api/invoices/route.ts` (line 494) | `supabaseAdmin` | Server API Route |

### 3.2 Key Findings & Risk Correction
1. **Zero Client-Side Callers:** No React components in `src/components/**` call `supabase.rpc(...)`. All client requests hit Next.js route handlers (`/api/*`), which validate authorization before invoking `supabaseAdmin.rpc(...)`.
2. **Impact on External / Third-Party Consumers:**
   - Revoking `EXECUTE` from `anon` and `authenticated` **intentionally breaks** any external caller that attempts to bypass the Next.js API layer. This is the **exact desired security posture**.
   - Claiming "zero risk" was imprecise. The corrected statement is: **Zero regression risk for official application workflows, but 100% breaking for unauthorized or direct PostgREST RPC clients**.
3. **Rollback Accuracy:**
   - Previous rollback statements only proposed `GRANT EXECUTE ... TO authenticated;`.
   - **Correction:** To restore the exact original ACL state, the rollback statement must restore `PUBLIC`, `anon`, and `authenticated`:
     ```sql
     GRANT EXECUTE ON FUNCTION public.<signature> TO PUBLIC, anon, authenticated;
     ```

---

## 4. Check 3 — Challenge to the Six `search_path` Changes

### 4.1 Unqualified Reference Audit
Each of the 6 functions was audited for unqualified object references:
- `process_branch_dispatch_atomic`: References `branch_order_items`, `items`, `branch_orders`, plus built-in functions `COALESCE`, `NULLIF`, `UPPER`, `TRIM`, `GREATEST`. All tables are in `public`; all built-in functions are in `pg_catalog`.
- `process_branch_receive_atomic`: References `branch_order_items`, `items`. All in `public`.
- `get_ceo_branches_kpi_summary`: References `invoices`, `clients`, `unnest`, `DATE_TRUNC`. All tables are in `public`.
- `set_default_receipt_template`: References `receipt_templates`. Exists in `public`.
- `check_rate_limit_atomic`: References `rate_limit_entries`, `NOW`, `CEIL`, `EXTRACT`. Table in `public`.
- `reset_rate_limit_atomic`: References `rate_limit_entries`. Table in `public`.

### 4.2 Security Context & Ownership
- All 6 functions are owned by `postgres` (Superuser).
- Without `SET search_path = public, pg_temp`, an attacker with permissions to create objects in temporary schemas (`pg_temp`) could intercept table resolution during superuser execution.
- Setting `search_path = public, pg_temp` explicitly pins resolution to `public` first and `pg_temp` second, eliminating search path hijacking without breaking any table references.

---

## 5. Check 4 — Challenge to the 17 Service Role Policies

### 5.1 Security Hygiene vs. Vulnerability Fix
- **The Advisor Finding:** `rls_enabled_no_policy` is classified as `level: "INFO"`.
- **Runtime Reality:** In PostgreSQL, an RLS-enabled table with no policies defaults to **Default Deny** for all non-superusers. Neither `anon` nor `authenticated` can read or write to these 17 tables directly.
- **Role Behavior:** In Supabase, the `service_role` role possesses the `BYPASSRLS` attribute. Thus, `supabaseAdmin` queries **already bypass RLS**.
- **Assessment:** Creating `CREATE POLICY "<table_name>_service_role" ON public."<table_name>" FOR ALL TO service_role USING (true) WITH CHECK (true);` does **not change effective access permissions**.
- **Conclusion:** This change is an **Informational Linter Hygiene Cleanup**, not a critical security vulnerability fix. It explicitly documents that only the administrative backend is intended to access these tables directly.

---

## 6. Check 5 — Migration History Drift Reconciliation

### 6.1 Discrepancy Identification
- Migration files exist on disk:
  - `supabase/migrations/20261008_01_rate_limit_system.sql`
  - `supabase/migrations/20261008_02_revoked_sessions.sql`
- Live database query on `supabase_migrations.schema_migrations`:
  - Neither `20261008_01` nor `20261008_02` is recorded in `schema_migrations` (last recorded migration is `20261006211846: settle_tokens_atomic`).
  - However, tables `rate_limit_entries` and `revoked_sessions` **already exist** in PostgreSQL.
- **Root Cause:** These migrations were applied directly to the database via SQL management queries rather than through the Supabase CLI migration engine.

### 6.2 Plan Correction
- Merely adding `IF NOT EXISTS` in the remediation script handles execution safety, but does not fix Supabase CLI tracking.
- **Recommendation:** Post-migration, the developer should execute `supabase migration repair --status applied 20261008_01` and `20261008_02` if using Supabase CLI locally. The remediation script itself must use idempotent DDL to ensure zero conflicts.

---

## 7. Claim Discrepancy & Evidence Reassessment Matrix

| Disputed Claim | Previous Claim | Live Catalog / Repository Evidence | Reassessment Result | Corrected Conclusion |
|---|---|---|---|---|
| **Zero Operational Risk** | "Zero risk on all permission changes" | `has_function_privilege('anon') = true` was active. Direct HTTP RPC calls from public will be blocked. | `VERIFIED WITH SCOPE LIMITATION` | Zero risk to official application routes; 100% breaking for unauthorized direct HTTP consumers. |
| **All Findings Equal Severity** | All 59 findings treated as urgent security remediations | 42 are `WARN` (real vulnerabilities); 17 are `INFO` (linter hygiene on default-deny tables). | `VERIFIED` | 42 are critical security hardening; 17 are documentation/linter hygiene. |
| **Rollback Statements** | `GRANT ... TO authenticated;` was specified as rollback | Live ACL contains `=X/postgres` (PUBLIC) and `anon=X/postgres`. | `FAILED` | Rollback must restore `PUBLIC, anon, authenticated` to be accurate. |
| **Migration Drift Reconciliation** | `IF NOT EXISTS` completely reconciles migration drift | `schema_migrations` table is still missing version entries for applied tables. | `FAILED` | DDL is safe, but CLI migration tracking requires explicit status repair. |

---

## 8. Final Verdict and Stop Condition

```
GO — READY FOR EXPLICIT IMPLEMENTATION AUTHORIZATION
```

### Evidence-Backed Justification:
1. **Evidence Established:** Live catalog queries prove the exact existence and configuration of all 59 findings across `pg_proc`, `pg_class`, and `pg_policy`.
2. **Caller Traversal Complete:** Codebase inspection confirms that 100% of application RPC calls use `supabaseAdmin` (`service_role`), ensuring application stability.
3. **Technical Plan Refined:** Rollbacks have been corrected to restore full original ACLs; the distinction between security fixes (42) and linter hygiene (17) is rigorously documented; migration tracking drift is explicitly addressed.
4. **Strict Audit Discipline:** Zero DDL, zero migrations, and zero code changes were executed. The system stands fully audited and awaits owner authorization.
