# SUPABASE ADVISOR — EXISTING MIGRATION SAFETY REVIEW

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Existing Migration File:** [`supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql)  
**Git Commit:** `8fa3bf0`  
**Target Database:** Supabase PostgreSQL 17.6 (Project Ref: `ignspvajzblmsbertmmv`)  
**Review Type:** READ-ONLY FORENSIC SAFETY REVIEW  
**Review Date:** October 10, 2026  

---

## 1. FILES INSPECTED

The following committed repository artifacts were completely inspected line-by-line:

1. **Migration SQL:** [`supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql) (209 total lines)
2. **Implementation Report:** [`audit/supabase-advisor-implementation-report.md`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/audit/supabase-advisor-implementation-report.md)
3. **Task Register:** [`audit/supabase-advisor-task-register.md`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/audit/supabase-advisor-task-register.md)
4. **Remediation Plan:** [`audit/supabase-advisor-implementation-plan.md`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/audit/supabase-advisor-implementation-plan.md)
5. **Live Database Audit Log:** [`audit/supabase-advisor-live-database-audit.md`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/audit/supabase-advisor-live-database-audit.md)
6. **Application Backend Callers:**
   - [`src/lib/supabaseClient.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/lib/supabaseClient.ts)
   - [`src/app/api/invoices/route.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/invoices/route.ts)
   - [`src/app/api/purchases/route.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/purchases/route.ts)
   - [`src/app/api/branch-orders/route.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/branch-orders/route.ts)
   - [`src/app/api/vouchers/route.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/vouchers/route.ts)
   - [`src/app/api/tokens/route.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/tokens/route.ts)
   - [`src/app/api/ai/usage/route.ts`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/ai/usage/route.ts)

---

## 2. APPROVED SCOPE VERSUS ACTUAL SQL SCOPE

A complete line-by-line forensic comparison between the approved remediation plan and the committed SQL file:

### 2.1 Wave 1: Function `search_path` Hardening (SA-TASK-01)
* **Approved Operation:** Set `search_path = public, pg_temp` on exactly six SECURITY DEFINER functions.
* **Actual Migration SQL (Lines 13–18):**
  1. `public.process_branch_dispatch_atomic(uuid, uuid)` — Line 13
  2. `public.process_branch_receive_atomic(uuid, uuid, uuid)` — Line 14
  3. `public.get_ceo_branches_kpi_summary(uuid[], date)` — Line 15
  4. `public.set_default_receipt_template(uuid)` — Line 16
  5. `public.check_rate_limit_atomic(text, integer, integer)` — Line 17
  6. `public.reset_rate_limit_atomic(text)` — Line 18
* **Scope Match:** **100% PASS** (Exactly 6 approved functions, zero extra or missing).

### 2.2 Wave 2: Function Execution Rights Hardening (SA-TASK-02 & SA-TASK-03)
* **Approved Operation:** Revoke `EXECUTE` privileges from `PUBLIC`, `anon`, and `authenticated` roles while granting `EXECUTE` privileges to `service_role` on exactly 18 SECURITY DEFINER functions.
* **Actual Migration SQL (Lines 26–95):**
  1. `public.adjust_item_stock(uuid, numeric)` — Lines 26–27
  2. `public.adjust_item_stock_by_code(uuid, text, numeric)` — Lines 30–31
  3. `public.cancel_invoice_atomic(uuid, uuid, text, text)` — Lines 34–35
  4. `public.cancel_purchase_atomic(uuid, uuid)` — Lines 38–39
  5. `public.check_rate_limit_atomic(text, integer, integer)` — Lines 42–43
  6. `public.create_invoice_atomic(jsonb, jsonb, jsonb)` — Lines 46–47
  7. `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` — Lines 50–51
  8. `public.create_voucher_atomic(uuid, jsonb, uuid[])` — Lines 54–55
  9. `public.get_ceo_branches_kpi_summary(uuid[], date)` — Lines 58–59
  10. `public.process_branch_dispatch_atomic(uuid, uuid)` — Lines 62–63
  11. `public.process_branch_receive_atomic(uuid, uuid, uuid)` — Lines 66–67
  12. `public.receive_goods_atomic(uuid, uuid, numeric, text, text, text)` — Lines 70–71
  13. `public.redeem_tokens_atomic(jsonb, jsonb)` — Lines 74–75
  14. `public.reserve_ai_usage(uuid, text, text, text, text)` — Lines 78–79
  15. `public.reset_rate_limit_atomic(text)` — Lines 82–83
  16. `public.set_default_receipt_template(uuid)` — Lines 86–87
  17. `public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text)` — Lines 90–91
  18. `public.update_invoice_atomic(uuid, uuid, jsonb, jsonb)` — Lines 94–95
* **Scope Match:** **100% PASS** (Exactly 18 approved functions, 36 total REVOKE/GRANT DDL statements).

### 2.3 Wave 3: Explicit Service Role RLS Policies (SA-TASK-04)
* **Approved Operation:** Add explicit `PERMISSIVE` `service_role` policies to exactly 17 tables that currently have RLS enabled with zero policies.
* **Actual Migration SQL (Lines 102–154):**
  1. `public.app_users` (`app_users_service_role`) — Lines 103–105
  2. `public.audit_logs` (`audit_logs_service_role`) — Lines 106–108
  3. `public.branch_order_items` (`branch_order_items_service_role`) — Lines 109–111
  4. `public.branch_orders` (`branch_orders_service_role`) — Lines 112–114
  5. `public.clients` (`clients_service_role`) — Lines 115–117
  6. `public.invoice_items` (`invoice_items_service_role`) — Lines 118–120
  7. `public.invoices` (`invoices_service_role`) — Lines 121–123
  8. `public.items` (`items_service_role`) — Lines 124–126
  9. `public.petty_expenses` (`petty_expenses_service_role`) — Lines 127–129
  10. `public.purchase_items` (`purchase_items_service_role`) — Lines 130–132
  11. `public.purchases` (`purchases_service_role`) — Lines 133–135
  12. `public.receipt_templates` (`receipt_templates_service_role`) — Lines 136–138
  13. `public.shifts` (`shifts_service_role`) — Lines 139–141
  14. `public.suppliers` (`suppliers_service_role`) — Lines 142–144
  15. `public.tenant_receipt_template` (`tenant_receipt_template_service_role`) — Lines 145–147
  16. `public.tenants` (`tenants_service_role`) — Lines 148–150
  17. `public.vouchers` (`vouchers_service_role`) — Lines 151–153
* **Scope Match:** **100% PASS** (Exactly 17 approved tables, zero extra or missing).

### 2.4 Preservation of Unrelated Database Objects
* Existing policies on the 13 previously configured policy-bearing tables (e.g. `ai_usage_ledger`, `global_ai_settings`, `tenant_ai_settings`, `token_transactions`, etc.): **UNTOUCHED**.
* Existing table schemas, constraints, indexes, triggers, sequence generators, and user roles: **UNTOUCHED**.
* Unexpected object or permission changes: **ZERO**.

---

## 3. FINDINGS AND RISKS

### 3.1 PostgreSQL 17.6 Syntax & Signature Verification
* **Function Signatures:** Every argument type (`uuid`, `text`, `numeric`, `integer`, `date`, `jsonb`, `uuid[]`) matches standard PostgreSQL 17.6 data types and exact catalog signatures from pre-audit schema definitions.
* **DDL Syntax:** `ALTER FUNCTION ... SET search_path`, `REVOKE EXECUTE ... FROM ...`, `GRANT EXECUTE ... TO ...`, and `DO $$ BEGIN ... END $$;` block are compliant with standard PostgreSQL 17.6 grammar.

### 3.2 Transaction Boundaries & Failure Behavior
* When executed in the Supabase Dashboard SQL Editor, the entire script executes inside an implicit single transaction context.
* If any single statement fails (for example, if a function signature does not exist on the live catalog), PostgreSQL aborts the entire block and automatically rolls back all preceding changes in that execution window.

### 3.3 Idempotency & Repeatability
* `ALTER FUNCTION ... SET search_path = public, pg_temp;` is idempotent. Re-running it updates the function configuration to the exact same setting.
* `REVOKE EXECUTE ...` and `GRANT EXECUTE ...` are idempotent in PostgreSQL. Granting or revoking an already-granted/revoked permission produces no error.
* `CREATE POLICY` statements are wrapped inside `IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE ...)` catalog checks within a PL/pgSQL `DO` block. Re-running the script skips policy creation if the policy name already exists on the table, preventing `duplicate_object` errors.

### 3.4 Existing Policies & Policy Alteration Risks
* The migration uses `CREATE POLICY ...` only inside conditional guards (`IF NOT EXISTS`).
* No `DROP POLICY` or `ALTER POLICY` statements are present in the forward execution section.
* Existing policies on all tables remain completely intact.

### 3.5 External Caller Compatibility & Security Assessment
* **Application API Integration:** Forensic audit of the repository confirmed that 100% of RPC function calls in `src/app/api/**` originate from server-side Next.js route handlers using `supabaseAdmin` (instantiated with `SUPABASE_SERVICE_ROLE_KEY`).
* **Service Role Rights:** `service_role` is explicitly granted `EXECUTE` privileges on all 18 target functions in Wave 2. Application API callers will experience **zero disruption**.
* **Client-Side Browser Callers:** The client-side Supabase client (`src/lib/supabaseClient.ts`) uses `anon` / `authenticated` JWT tokens. Inspection of the frontend codebase confirmed that **no client-side RPC calls (`supabase.rpc(...)`) are made directly from browser components**.
* **External Caller Risk:** If an uncommitted, external, or third-party client attempts to invoke these 18 RPC functions directly over PostgREST using an `anon` or `authenticated` JWT key without `service_role`, those calls will return `401 Unauthorized` / `403 Forbidden` (`permission denied for function`). This is the intended security hardening outcome.

### 3.6 Function Object Resolution (`search_path`)
* Pinned `search_path = public, pg_temp` explicitly restricts unqualified object resolution within `SECURITY DEFINER` function execution contexts to the `public` schema and temporary tables (`pg_temp`).
* This eliminates CVE-level search_path hijacking vulnerabilities while preserving standard object resolution for all `public` tables referenced in those functions.

---

## 4. EXACT FORWARD SQL BOUNDARIES

The committed migration file [`supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql) contains both forward execution DDL and emergency rollback statements.

* **Forward Migration Start Line:** Line 1 (`-- ============================================================================`)
* **Forward Migration End Line:** Line 154 (`END $$;`)
* **Rollback SQL Location:** Lines 156 through 208, safely isolated inside a multi-line block comment (`/* ... */`).

> [!IMPORTANT]
> **Forward Execution Copy Boundary:** When executing through the Supabase Dashboard SQL Editor, copy **ONLY Lines 1 through 154**. Do **NOT** include Lines 156 through 208 in the execution prompt.

---

## 5. MANUAL EXECUTION INSTRUCTIONS

If manual execution via the Supabase Dashboard SQL Editor is authorized:

### 5.1 Step-by-Step Dashboard Execution Guide

1. Log into the **Supabase Dashboard**: `https://supabase.com/dashboard`
2. Select target project **PyntFlow POS & Industrial ERP (`p-industry`)** (Project Ref: `ignspvajzblmsbertmmv`).
3. In the left navigation sidebar, click on **SQL Editor**.
4. Click **New query** (top left).
5. Open [`supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql) in your local editor.
6. Copy **Lines 1 through 154 ONLY** (stop before `/* ===============================================================================`).
7. Paste the copied SQL text into the Supabase SQL Editor query pane.
8. Click the green **Run** button (or press `Ctrl+Enter` / `Cmd+Enter`).
9. Verify that the query result panel displays: `Success. No rows returned.`

### 5.2 Statements That MUST NOT Be Included
* **Do NOT copy Lines 156 to 208.** These lines contain `RESET search_path`, `GRANT EXECUTE ... TO PUBLIC, anon, authenticated`, and `DROP POLICY` rollback commands.

### 5.3 Partial Failure Handling Protocol
* If execution encounters an error (e.g. `function public.xyz does not exist`):
  1. PostgreSQL will automatically roll back the entire transaction batch. No partial state will persist.
  2. Copy the exact error message from the Dashboard SQL Editor result pane.
  3. Do **NOT** run manual fix statements or partial queries without verifying live catalog state.

---

## 6. POST-EXECUTION VERIFICATION SQL

After running the forward migration in the SQL Editor, execute the following **READ-ONLY** verification queries in a new query window to validate live database state:

### 6.1 Verify `search_path` Hardening (6 Functions)
```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'process_branch_dispatch_atomic',
    'process_branch_receive_atomic',
    'get_ceo_branches_kpi_summary',
    'set_default_receipt_template',
    'check_rate_limit_atomic',
    'reset_rate_limit_atomic'
  );
-- Expected Result: Exactly 6 rows. All proconfig arrays must contain 'search_path=public, pg_temp'.
```

### 6.2 Verify Function EXECUTE Rights (18 Functions)
```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'adjust_item_stock', 'adjust_item_stock_by_code', 'cancel_invoice_atomic',
    'cancel_purchase_atomic', 'check_rate_limit_atomic', 'create_invoice_atomic',
    'create_purchase_atomic', 'create_voucher_atomic', 'get_ceo_branches_kpi_summary',
    'process_branch_dispatch_atomic', 'process_branch_receive_atomic', 'receive_goods_atomic',
    'redeem_tokens_atomic', 'reserve_ai_usage', 'reset_rate_limit_atomic',
    'set_default_receipt_template', 'settle_tokens_atomic', 'update_invoice_atomic'
  );
-- Expected Result: Exactly 18 rows.
-- anon_execute = FALSE, authenticated_execute = FALSE, service_role_execute = TRUE for all 18 rows.
```

### 6.3 Verify 17 Service Role Policies
```sql
SELECT 
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%_service_role'
ORDER BY tablename;
-- Expected Result: Exactly 17 rows.
-- roles = '{service_role}', cmd = 'ALL', qual = 'true', with_check = 'true'.
```

### 6.4 Verify Existing Policies Integrity (13 Pre-Existing Policy Tables)
```sql
SELECT 
  tablename,
  count(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Expected Result: All 13 previously existing policy-bearing tables retain their original policy counts, plus 17 new policies across the zero-policy tables (total 30 tables monitored).
```

### 6.5 Live Supabase Advisor Verification
> [!NOTE]
> Static execution of verification queries proves DDL catalog compliance. To confirm that Supabase Advisor zero-finding status is reflected in the live platform, perform one of the following:
> 1. Check **Supabase Dashboard → Database → Advisors / Linter**.
> 2. Run via Supabase CLI (when access token is present):
>    ```bash
>    npx supabase db advisors --project-ref ignspvajzblmsbertmmv
>    ```
> Expected finding counts after live execution: **0 Security Warnings, 0 Performance Warnings**.

---

## 7. MIGRATION HISTORY RECONCILIATION

When a migration is executed manually using the Supabase Dashboard SQL Editor, PostgreSQL catalog changes occur immediately, but the Supabase CLI tracking table `supabase_migrations.schema_migrations` is **not automatically updated**.

To reconcile local migration history and prevent future Supabase CLI `db push` conflicts:

1. Execute the following SQL statement in the Supabase Dashboard SQL Editor immediately following successful DDL execution:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20261009_01', ARRAY['20261009_01_supabase_advisor_reconciliation'], 'supabase_advisor_reconciliation')
ON CONFLICT (version) DO NOTHING;
```

2. Alternatively, if local Supabase CLI is authenticated with `SUPABASE_ACCESS_TOKEN`, run:
```bash
npx supabase db migration version
```
or mark the version as applied using the Supabase CLI repair command:
```bash
npx supabase db repair --status applied 20261009_01
```

> [!CAUTION]
> Do **NOT** blindly rerun `npx supabase db push` before checking `schema_migrations` catalog state.

---

## 8. FINAL VERDICT

```
SAFE TO EXECUTE
```

### Verdict Justification
1. **Scope Integrity:** The migration SQL in [`supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql) targets **strictly and exclusively** the 59 approved Advisor findings (6 `search_path` hardening changes, 36 function execution privilege changes across 18 functions, 17 explicit `service_role` policies across 17 tables).
2. **PostgreSQL 17.6 Compatibility:** All syntax, functions, parameter signatures, and policy guards are 100% standard PostgreSQL 17.6 DDL.
3. **Idempotency & Safety:** Policy creation is guarded with `IF NOT EXISTS` PL/pgSQL checks; function `search_path` and `REVOKE/GRANT` statements are natively idempotent.
4. **Application Compatibility:** 100% of application RPC calls originate server-side via `supabaseAdmin` (`service_role`), ensuring zero breakage for production workflows.
5. **Rollback Separation:** Rollback SQL (Lines 156–208) is cleanly isolated inside a multi-line comment block at the end of the file and will not execute during forward migration.
