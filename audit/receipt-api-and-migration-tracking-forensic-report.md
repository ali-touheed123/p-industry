# PyntFlow — Receipt API Bug & Migration Tracking Forensic Investigation Report

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Scope:** Issue A — Receipt Template API Security & Schema Analysis; Issue B — Three Untracked Migrations Reconciliation  
**Mode:** STRICT READ-ONLY INVESTIGATION + DOCUMENTATION RECORD  
**Audit Date:** 2026-10-11  
**Status:** `PLAN REVIEW COMPLETE — OWNER DECISIONS RECORDED — IMPLEMENTATION NOT AUTHORIZED`  

---

## 1. Explicit Owner Decisions (2026-10-11)

### Decision A — Receipt Template API: OPTION A APPROVED
The project owner has formally selected **Option A: Developer-only access to the Receipt Templates catalog API**.
- **Approved Approach:** `GET /api/receipt-templates` will enforce `requireDevAuth(req)`, bringing complete symmetry with `POST`, `PATCH`, and `DELETE` handlers on the same route.
- **Scope of Code Fix:** 
  1. Switch authorization guard from `requireTenantAuth(req, null)` to `requireDevAuth(req)`.
  2. Remove invalid `tenant_id` column references and `.or()` filter expressions.
  3. Remove redundant and unsafe runtime default-template seeding from the GET handler after verifying Developer Panel empty-state handling.
- **Workflow Preservation:** The tenant receipt assignment route (`/api/receipt-templates/assign?tenant_id=...`) is a separate API and remains fully tenant-authorized. Standard POS and Sales History printing workflows remain unaffected.
- **No Schema Changes:** No `tenant_id` column will be added to `receipt_templates`. No database migrations are proposed or approved.

### Decision B — Supabase Migration Tracking: DEFER
The project owner has decided not to prioritize migration-history repair at this time.
- **Status:** **DEFERRED BY OWNER — NOT CURRENTLY AUTHORIZED.**
- **Rationale:** Live database inspection confirms all reported database objects (tables, functions, indexes, policies, and privileges) are already physically active on the production database. The application operates normally. Missing entries in `supabase_migrations.schema_migrations` represent CLI tracking drift rather than database corruption.
- **Operational Boundary:** Migration tracking reconciliation is decoupled from the Receipt Template API fix and does not block it. No `supabase migration repair`, `supabase db push`, `supabase init`, or `supabase link` commands will be executed.

---

## 2. Executive Summary

### Issue A — Receipt Template API Security & Schema Defect

**Verdict: PRIOR AUDIT CLAIM WAS PARTIALLY INCORRECT; SCHEMA IS SOUND; ROUTE ACCESS CONTRACT NOW SET TO DEVELOPER-ONLY BY OWNER DECISION.**

1. **Schema Ground Truth (Verified Live):** The table `receipt_templates` physically contains **EXACTLY 8 columns** (verified directly via `information_schema.columns` query on live database `ignspvajzblmsbertmmv`):
   - `id` (uuid, NOT NULL)
   - `name` (text, NOT NULL)
   - `description` (text, NULLABLE)
   - `paper_size` (text, NOT NULL)
   - `template_json` (jsonb, NOT NULL)
   - `is_default` (boolean, NOT NULL)
   - `is_deleted` (boolean, NOT NULL)
   - `created_at` (timestamptz, NULLABLE)
   *(Note: `updated_at` does not exist in the live database table; `tenant_id` does not exist).*
2. **Origin of Defect:** An earlier remediation effort (commented `FIX FINDING-API-015`) assumed `receipt_templates` was multi-tenant like `items` or `clients`, and introduced three references to `tenant_id` in `src/app/api/receipt-templates/route.ts`:
   - Line 37: Single-template lookup compared `data.tenant_id !== callerTenantId`. Because `data.tenant_id` is always `undefined`, the check silently passes.
   - Line 58: List endpoint applied `.or('tenant_id.eq.<id>,tenant_id.is.null')`, triggering PostgreSQL error `42703` (column does not exist) → **HTTP 500** for all non-developer callers.
   - Line 74: Runtime default-seeding included `tenant_id: callerTenantId` in the INSERT payload, triggering PostgreSQL error `42703` → **HTTP 500** if triggered on an empty catalog.
3. **Security & Authorization Review:**
   - In the live system, **no non-developer UI calls `GET /api/receipt-templates`**. Active billing and reprint interfaces (`PosBilling.tsx`, `SalesHistory.tsx`) exclusively query `/api/receipt-templates/assign?tenant_id=...`. The only caller of `GET /api/receipt-templates` is the developer management panel (`DevReceiptTemplatesView.tsx`).
   - Mutations (`POST`, `PATCH`, `DELETE`) in `src/app/api/receipt-templates/route.ts` are already strictly restricted to developers via `requireDevAuth`.
   - With the owner's explicit selection of **Option A**, `GET /api/receipt-templates` will enforce `requireDevAuth(req)`.
   - **Verified Status Code Semantics in `requireDevAuth`:**
     - Unauthenticated requests (no session, no valid token) → `session === null` → returns `{ authorized: false, status: 401, error: 'Unauthorized: Login session required' }`.
     - Non-developer tenant requests (session with role `'staff'` or `'ceo'`) → `session !== null`, but `role !== 'developer'` → returns `{ authorized: false, status: 403, error: 'Forbidden: Developer privileges required' }`.
4. **Runtime Seeding Defect & Empty Catalog Handling:**
   - The runtime seeding in `GET /api/receipt-templates` (lines 65–86) violates REST GET idempotency, creates unique-index conflict risks with `receipt_templates_single_default_idx`, and currently fails with PostgreSQL error `42703` anyway because of the invalid `tenant_id` property.
   - Live inspection of `src/components/dev-panel/DevReceiptTemplatesView.tsx` (lines 425–454) confirms the frontend has an explicit native empty state UI (`"No receipt templates yet"` with a `+ Create Template` action) that gracefully handles `templates: []`.
   - Canonical migration `20260925_06_receipt_templates.sql` already idempotently seeds the default template, and `/assign` provides a resilient 3-tier fallback.

---

### Issue B — Migration Tracking Drift & CLI Safety Analysis

**Verdict: ALL THREE MIGRATIONS ARE FULLY ACTIVE ON LIVE DATABASE; RE-RUNNING SQL IS STRICTLY PROHIBITED; WORK DEFERRED BY OWNER.**

1. **Live Object Verification (100% Confirmed):**
   - `20261008_01_rate_limit_system.sql`: Table `rate_limit_entries` exists. Atomic functions `check_rate_limit_atomic` and `reset_rate_limit_atomic` exist. Policy `rate_limit_service_role_all` **CONFIRMED PRESENT** (verified live via `pg_policies`).
   - `20261008_02_revoked_sessions.sql`: Table `revoked_sessions` exists. Index `idx_revoked_sessions_expires_at` **CONFIRMED PRESENT** (verified live via `pg_indexes`). Policy `revoked_sessions_service_role_all` **CONFIRMED PRESENT** (verified live via `pg_policies`).
   - `20261009_01_supabase_advisor_reconciliation.sql`: Search path pinned on 6 functions (`["search_path=public, pg_temp"]`). Execution privileges revoked from `PUBLIC`, `anon`, `authenticated` and granted to `service_role` on 18 functions. 17 `service_role` RLS policies confirmed present.
2. **PostgreSQL Function Replacement Behavior Verified:**
   - In PostgreSQL, `CREATE OR REPLACE FUNCTION` replaces the entire function definition in `pg_proc`. While ownership and permissions (`proacl`) are preserved, configuration settings (`proconfig`, which stores `SET search_path`) are **reset to NULL** if the new statement does not include an explicit `SET` clause.
   - In `supabase/migrations/20261008_01_rate_limit_system.sql` lines 26–75 and 78–86, `check_rate_limit_atomic` and `reset_rate_limit_atomic` omit `SET search_path`.
   - In `20261009_01_supabase_advisor_reconciliation.sql` lines 17–18, `ALTER FUNCTION ... SET search_path = public, pg_temp` was applied to both functions.
   - Re-running `20261008_01` would execute `CREATE OR REPLACE FUNCTION` and **clear `proconfig` on both functions**, re-opening the mutable `search_path` vulnerability (`SA-TASK-01`).
   - Therefore, **re-running migration SQL to reconcile migration tracking is technically hazardous and prohibited.**
3. **Supabase CLI 2.120.0 Versioning & Repository Pattern:**
   - The remote tracking table `supabase_migrations.schema_migrations` contains 26 rows. All 26 rows use 14-digit timestamps (`YYYYMMDDHHmmss`). The tracking column is named `version` (TEXT), not `version_id`.
   - All 25 migration files in `supabase/migrations/` use the non-standard format `YYYYMMDD_NN_...` (e.g. `20260924_01_...` through `20261009_01_...`).
   - Because the owner has deferred migration tracking reconciliation, no CLI operations or filename alterations will be performed.

---

## 3. Issue A — Deep Security & Tenant-Isolation Analysis

### 3.1 Complete Route & Authentication Architecture

Inspection of `src/app/api/receipt-templates/route.ts` reveals the following security model:

```
┌────────────────────────────────────────────────────────────────────────┐
│               src/app/api/receipt-templates/route.ts                   │
├─────────┬──────────────────────┬───────────────────────────────────────┤
│ Method  │ Current Guard        │ Approved Target Guard (Option A)      │
├─────────┼──────────────────────┼───────────────────────────────────────┤
│ GET     │ requireTenantAuth    │ requireDevAuth (Developer ONLY)       │
│ POST    │ requireDevAuth       │ requireDevAuth (Developer ONLY)       │
│ PATCH   │ requireDevAuth       │ requireDevAuth (Developer ONLY)       │
│ DELETE  │ requireDevAuth       │ requireDevAuth (Developer ONLY)       │
└─────────┴──────────────────────┴───────────────────────────────────────┘
```

In contrast, the tenant-specific assignment route `src/app/api/receipt-templates/assign/route.ts` enforces:
- `GET ?tenant_id=<id>`: Enforces `requireTenantAuth(req, tenant_id)`. Non-developers are strictly confined to their own tenant ID (or sister branches for CEOs). Returns the tenant-assigned template or falls back to platform default.
- `GET` (all tenants): Enforces `requireDevAuth(req)`.
- `POST` / `DELETE`: Enforces `requireDevAuth(req)`.

### 3.2 Code Path & Status Code Tracing in `requireDevAuth`

Inspection of `src/lib/session.ts` (lines 199–233) confirms the exact logic:
```typescript
export async function requireDevAuth(req: NextRequest) {
  const session = await getSession(req);

  if (session && session.role === 'developer') {
    return { authorized: true, session };
  }

  // Fallback devCookie / devToken check
  ...
  if (!session) {
    return { authorized: false, error: 'Unauthorized: Login session required', status: 401, session: null };
  }

  return { authorized: false, error: 'Forbidden: Developer privileges required', status: 403, session };
}
```

When called in `src/app/api/receipt-templates/route.ts`:
```typescript
const auth = await requireDevAuth(req);
if (!auth.authorized) {
  return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
}
```

**Verified Behavior Matrix:**
1. **Unauthenticated Caller:** `session` is `null` → Route returns HTTP `401` with `{ success: false, error: 'Unauthorized: Login session required' }`.
2. **Authenticated Tenant Caller (Staff / CEO):** `session` exists with `role !== 'developer'` → Route returns HTTP `403` with `{ success: false, error: 'Forbidden: Developer privileges required' }`.
3. **Developer Caller:** `session.role === 'developer'` → `auth.authorized === true` → Route returns HTTP `200` with templates array or template object.

### 3.3 Callers & Blast Radius Analysis

An exhaustive repository search across all source and test files identifies every caller:

| Caller Component | Route Invoked | Auth Role | Behavior & Bug Exposure |
|---|---|---|---|
| `DevReceiptTemplatesView.tsx` | `GET /api/receipt-templates` | `developer` | **No bug exposed.** Passes `isDeveloper === true`, completely bypassing the line 58 filter. |
| `DevReceiptTemplatesView.tsx` | `POST /api/receipt-templates` | `developer` | Works as intended. |
| `DevReceiptTemplatesView.tsx` | `PATCH /api/receipt-templates` | `developer` | Works as intended. |
| `DevReceiptTemplatesView.tsx` | `DELETE /api/receipt-templates?id=...` | `developer` | Works as intended. |
| `DevTemplateAssignView.tsx` | `GET /api/receipt-templates/assign` | `developer` | Works as intended. |
| `PosBilling.tsx` | `GET /api/receipt-templates/assign?tenant_id=...` | `staff`/`ceo` | **Uses assignment route.** Never calls the master catalog endpoint. |
| `SalesHistory.tsx` | `GET /api/receipt-templates/assign?tenant_id=...` | `staff`/`ceo` | **Uses assignment route.** Never calls the master catalog endpoint. |
| Direct API Client | `GET /api/receipt-templates` | `staff`/`ceo` | **Fails with HTTP 500** due to PostgreSQL 42703 error on line 58. Under Option A, will cleanly return HTTP 403 Forbidden. |

### 3.4 Developer Panel Empty State Verification

Inspection of `src/components/dev-panel/DevReceiptTemplatesView.tsx` lines 425–454 proves that the developer panel explicitly handles `templates.length === 0`:
- When the API returns `{ success: true, templates: [] }`, the UI does not crash or loop.
- It displays a dedicated empty state with message: `"No receipt templates yet — Create your first print layout or seed the standard thermal 80mm format."`
- It provides a `+ Create Template` action button that launches the designer (`handleCreateNew()`).
- In addition, the live database currently contains an active default template (`"Thermal Standard"`, ID `5b48311e-acaf-4ac0-92d7-b923e812dd6a`).
- The existing runtime seeding block in `route.ts` was already broken (crashed with 42703 on empty catalog due to `tenant_id`). Removing it restores GET idempotency and eliminates crash hazards.

---

## 4. Issue B — Migration Tracking & SQL Safety Deep Dive

### 4.1 Live Database Object Audit

Verified directly against PostgreSQL system catalogs on live database `ignspvajzblmsbertmmv`:

| Object Name | Object Type | Migration File | Status | Verification Source |
|---|---|---|:---:|---|
| `rate_limit_entries` | Table | `20261008_01` | **CONFIRMED** | `information_schema.tables` |
| `rate_limit_service_role_all` | RLS Policy | `20261008_01` | **CONFIRMED** | `pg_policies` |
| `check_rate_limit_atomic` | Function | `20261008_01` | **CONFIRMED** | `information_schema.routines` |
| `reset_rate_limit_atomic` | Function | `20261008_01` | **CONFIRMED** | `information_schema.routines` |
| `revoked_sessions` | Table | `20261008_02` | **CONFIRMED** | `information_schema.tables` |
| `idx_revoked_sessions_expires_at` | Index | `20261008_02` | **CONFIRMED** | `pg_indexes` (`tablename='revoked_sessions'`) |
| `revoked_sessions_service_role_all` | RLS Policy | `20261008_02` | **CONFIRMED** | `pg_policies` (`tablename='revoked_sessions'`) |
| 6 Function search paths | Config | `20261009_01` | **CONFIRMED** | `pg_proc.proconfig` = `["search_path=public, pg_temp"]` |
| 18 Function privileges | ACL | `20261009_01` | **CONFIRMED** | `has_function_privilege` (anon=f, auth=f, svc=t) |
| 17 Service Role Policies | RLS Policy | `20261009_01` | **CONFIRMED** | `pg_policies` on 17 tables |

**Conclusion:** All DDL and DCL statements from all three migrations are 100% physically present and active in the live PostgreSQL instance. The application is completely functional.

### 4.2 Future Risks of Deferred Migration Tracking

While the owner has deferred migration tracking reconciliation, the following future deployment risks are documented for long-term awareness:
1. **CLI `db push` Incompatibility:** If a developer runs `supabase db push` in the future without linking and repairing tracking, the CLI may attempt to re-execute migrations that it does not see in `schema_migrations`.
2. **Branching/CI Conflict:** Future automated CI/CD pipelines relying on strict Supabase CLI migration verification may fail if local and remote tracking ledgers diverge.
3. **Mitigation:** When migration reconciliation is eventually scheduled, it must follow the staged procedure (verifying CLI parsing before executing repair, and strictly avoiding re-running SQL).

---

## 5. Confirmed Facts vs. Unresolved Items

### Confirmed Facts (Evidence-Based)

| # | Fact | Evidence |
|---|---|---|
| 1 | `receipt_templates` physically has **8 columns** (`id`, `name`, `description`, `paper_size`, `template_json`, `is_default`, `is_deleted`, `created_at`) | Live `information_schema.columns` query |
| 2 | `receipt_templates` has no `tenant_id` column and no `updated_at` column | Live `information_schema.columns` query |
| 3 | Line 58 `.or()` causes PostgreSQL `42703` on non-developer list calls | Code inspection & schema confirmation |
| 4 | Line 74 INSERT causes PostgreSQL `42703` on empty catalog seeding | Code inspection & schema confirmation |
| 5 | Line 37 `data.tenant_id !== callerTenantId` silently evaluates `undefined` | Code inspection |
| 6 | Developer GET requests bypass line 58 filter (`!isDeveloper` check) | Code inspection |
| 7 | PosBilling and SalesHistory use `/api/receipt-templates/assign`, not `/api/receipt-templates` | Full repository grep |
| 8 | Only Developer UI (`DevReceiptTemplatesView.tsx`) calls `GET /api/receipt-templates` | Full repository grep |
| 9 | `DevReceiptTemplatesView.tsx` (lines 425–454) contains explicit empty state handling for `templates: []` | Code inspection |
| 10 | Live database currently contains active default template `"Thermal Standard"` | Live database query |
| 11 | `requireDevAuth` returns status 401 when unauthenticated and status 403 when non-developer session | Code inspection in `src/lib/session.ts` |
| 12 | `rate_limit_entries` and `revoked_sessions` tables exist on live DB | `information_schema.tables` query |
| 13 | `idx_revoked_sessions_expires_at` index exists on live DB | `pg_indexes` query |
| 14 | `rate_limit_service_role_all` and `revoked_sessions_service_role_all` policies exist | `pg_policies` query |
| 15 | Search paths on 6 functions pinned to `public, pg_temp` | `pg_proc.proconfig` query |
| 16 | 18 SECURITY DEFINER functions have execution revoked from public/anon/auth | `has_function_privilege` query |
| 17 | 17 service_role RLS policies exist on target tables | `pg_policies` query |
| 18 | `schema_migrations` tracking column is named `version` (TEXT), 26 rows | `information_schema.columns` & `schema_migrations` query |
| 19 | Three migrations absent from `schema_migrations` | `schema_migrations` query |
| 20 | PostgreSQL `CREATE OR REPLACE FUNCTION` resets `proconfig` if `SET` clause is omitted | PostgreSQL engine specification & docs |
| 21 | Supabase CLI version is 2.120.0 | `npx supabase --version` |
| 22 | All 25 migration files in `supabase/migrations/` use `YYYYMMDD_NN_...` format | Repository directory listing |
| 23 | Pre-existing untracked file `supabase/.temp/cli-latest` exists in workspace | Local directory inspection |
| 24 | Owner explicitly approved Option A (Developer-Only Catalog) on 2026-10-11 | User instruction |
| 25 | Owner explicitly deferred migration tracking reconciliation on 2026-10-11 | User instruction |

---

## 6. Modification Confirmation

**Zero modifications to application code, tests, database schema, database records, migration history, configuration, or Git history were made during this investigation.** Only audit documentation has been updated.
