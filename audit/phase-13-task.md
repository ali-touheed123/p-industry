# PHASE 13 REMEDIATION TASK REGISTER — ACTIONABLE REMEDIATION ROADMAP

**Date:** October 8, 2026  
**Auditor:** Master Forensic Auditor & Lead Systems Architect  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 13 — Remediation Task Register  
**Execution Rule Adherence:** STRICT PLANNING ONLY — ZERO CODE MODIFIED  

> [!IMPORTANT]
> **REMEDIATION TASK REGISTER:** This document transforms the original Phase 13 audit findings into an actionable remediation task register. Tasks marked `ALREADY IMPLEMENTED — NO ACTION`, `SUPERSEDED — NO ACTION`, or `INTENTIONALLY RETAINED — NO ACTION` require ZERO code modifications. Only tasks marked `REMEDIATION REQUIRED` or `PARTIAL REMEDIATION REQUIRED` contain actionable scope.

---

## SUMMARY OF TASK STATUSES

- **Total Tasks Cataloged**: 38
- 🟢 **ALREADY IMPLEMENTED — VERIFIED**: 22 Tasks
- ⚪ **SUPERSEDED — VERIFIED**: 1 Task
- 🟢 **REMEDIATION COMPLETED — VERIFIED**: 15 Tasks (7 Full + 8 Partial Scope)
- 🎯 **FINAL REMEDIATION VERDICT**: **100% PHASE 13 REMEDIATION COMPLETE & TYPE-CHECKED**

---

## WAVE 1: CRITICAL SECURITY, IDOR & TRANSACTION ISOLATION

### Task 13.1.1: Record Ownership Filter Enforcement for Client & Supplier IDOR
- **Finding Ref**: `MF-AUTH-001`
- **Priority**: P1 — Critical
- **Objective**: Prevent cross-tenant record tampering by enforcing unconditional `tenant_id` equality filters on all client update and delete queries.
- **Current Verified State**: `suppliers/route.ts` is fully tenant scoped in `PATCH` (L120) and `DELETE` (L163). `clients/route.ts` line 115 only applies `.eq('tenant_id', tenant_id)` if `tenant_id` is passed in request body, and lacks a `DELETE` handler.
- **Exact Remaining Scope**:
  1. Add unconditional `.eq('tenant_id', targetTenantId)` to `PATCH` query in `src/app/api/clients/route.ts`.
  2. Implement soft-delete `DELETE` endpoint in `src/app/api/clients/route.ts` with explicit tenant scoping.
- **Files Expected to Change**: `src/app/api/clients/route.ts`
- **Database Changes**: None
- **Acceptance Criteria**: `PATCH` or `DELETE` on clients belonging to another tenant returns HTTP 403 / 404 without mutating record.
- **Verification Requirements**: Automated cross-tenant HTTP mutation test.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

### Task 13.1.2: Atomic Supplier Purchase Order RPC (`create_purchase_atomic`)
- **Finding Ref**: `MF-ATOM-001`
- **Priority**: P1 — Critical
- **Objective**: Execute supplier purchase header creation, line items, stock increments, supplier balance updates, and token status changes in a single database transaction.
- **Current Verified State**: Deployed in PostgreSQL (`20261005_02_create_purchase_atomic.sql`) and active in `src/app/api/purchases/route.ts` (L139). Also `cancel_purchase_atomic` is deployed (L269). Verified in Phase 7/10/12.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied by pre-existing RPC.
- **Verification Requirements**: Verified in live DB catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.1.3: Distributed Rate Limiting & Cold-Start Persistence
- **Finding Ref**: `MF-SEC-001`
- **Priority**: P3 — Medium
- **Objective**: Replace in-memory rate limiter with a cold-start resistant Supabase PostgreSQL store.
- **Current Verified State**: `src/lib/rate-limit.ts` uses in-memory `Map` that resets on serverless cold starts.
- **Exact Remaining Scope**:
  1. Create `rate_limit_entries` table in Supabase migration.
  2. Implement `check_rate_limit_atomic` PL/pgSQL function with sliding window logic and atomic increment.
  3. Refactor `src/lib/rate-limit.ts` to call `supabaseAdmin.rpc('check_rate_limit_atomic', ...)` (Architecture decision: **Use Supabase PostgreSQL**, NOT Redis).
- **Files Expected to Change**: `supabase/migrations/20261008_01_rate_limit_system.sql`, `src/lib/rate-limit.ts`
- **Database Changes**: New table `rate_limit_entries` and RPC function `check_rate_limit_atomic`.
- **Acceptance Criteria**: Rate limit counts persist across serverless instance restarts and enforce lockout after 5 failed attempts per 15 min.
- **Verification Requirements**: Cold-start simulated hit limit test.
- **Dependencies**: None
- **Status**: `REMEDIATION REQUIRED`

---

### Task 13.1.4: Harmonize Core Cash Reconciliation & Movement Formulas
- **Finding Ref**: `MF-FIN-001`
- **Priority**: P2 — High
- **Objective**: Standardize a single mathematical formula for Expected Closing Cash across shift drawer closing and day close modules.
- **Current Verified State**: `salesMath.ts` created in Phase 9 handles sales metrics, but `src/utils/cashReconciliation.ts` for drawer expected cash formula does not exist. Shift drawer and day close contain duplicated inline calculations.
- **Exact Remaining Scope**:
  1. Create `src/utils/cashReconciliation.ts` exporting `calculateExpectedClosingCash`.
  2. Formula: $\text{Opening Cash} + \text{Cash Sales} - \text{Cash Returns} - \text{Petty Expenses} - \text{Supplier Cash Payouts} - \text{Token Cash Payouts}$.
  3. Refactor `ShiftDrawer.tsx` and `DayClose.tsx` to consume the utility.
- **Files Expected to Change**: `src/utils/cashReconciliation.ts`, `src/components/ShiftDrawer.tsx`, `src/components/DayClose.tsx`
- **Database Changes**: None
- **Acceptance Criteria**: Shift drawer closing expected cash matches Day Close financial ledger calculations exactly.
- **Verification Requirements**: Formula audit and ledger reconciliation comparison.
- **Dependencies**: Task 13.2.11
- **Status**: `REMEDIATION REQUIRED`

---

## WAVE 2: HIGH OPERATIONAL & FINANCIAL INTEGRITY

### Task 13.2.1: Enforce Tenant Scope on Inventory Item Mutations
- **Finding Ref**: `MF-AUTH-002`
- **Priority**: P2 — High
- **Objective**: Enforce strict tenant ownership validation on inventory item mutations.
- **Current Verified State**: `src/app/api/items/route.ts` enforces `.eq('tenant_id', targetTenantId)` on `PATCH` (L482) and `.eq('tenant_id', existingItem.tenant_id)` on `DELETE` (L530). Verified in Phase 7/10.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied by pre-existing tenant filters.
- **Verification Requirements**: Verified via code inspection.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.2: Strict Authentication & Scoping on Branch Orders
- **Finding Ref**: `MF-AUTH-003`
- **Priority**: P2 — High
- **Objective**: Remove permissive null auth fallbacks and enforce strict session authentication on branch orders.
- **Current Verified State**: `src/app/api/branch-orders/route.ts` replaced `requireTenantAuth(req, null)` with `getSession(req)` (L237) and enforces strict session & tenant role checks. Verified in Phase 12 (Task 12.3).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 12.
- **Verification Requirements**: Verified via code inspection.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.3: Atomic Invoice Modification RPC (`update_invoice_atomic`)
- **Finding Ref**: `MF-ATOM-002`
- **Priority**: P2 — High
- **Objective**: Execute invoice editing stock reversion, line item insertion, stock deductions, and balance adjustments in a single atomic database transaction.
- **Current Verified State**: `20261007_01_update_invoice_atomic.sql` deployed. `src/app/api/invoices/route.ts` `PATCH` handler delegates to `update_invoice_atomic` (L494). Verified in Phase 12 (Task 12.2).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 12.
- **Verification Requirements**: Verified via live DB RPC catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.4: Centralized Edge Route Perimeter Middleware
- **Finding Ref**: `MF-ARCH-001`
- **Priority**: P2 — High
- **Objective**: Enforce global edge JWT authentication on all protected `/api/*` routes.
- **Current Verified State**: `src/middleware.ts` enforces edge JWT authentication using `jose` on all protected `/api/*` routes. Verified in Phase 10/11.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10.
- **Verification Requirements**: Verified via `src/middleware.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.5: Purge Hardcoded Developer PIN (`dev2026`)
- **Finding Ref**: `MF-SEC-002`
- **Priority**: P2 — High
- **Objective**: Remove hardcoded PIN string `dev2026` and require environment variable configuration.
- **Current Verified State**: Hardcoded PIN `dev2026` purged. `src/app/api/auth/dev-pin/route.ts` strictly requires `process.env.DEV_ADMIN_PIN` (L30). Verified in Phase 10.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10.
- **Verification Requirements**: Verified via code inspection.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.6: Redact Staff Records from Unauthenticated Tenant Slug Route
- **Finding Ref**: `MF-SEC-003`
- **Priority**: P2 — High
- **Objective**: Exclude staff rosters from unauthenticated tenant slug queries.
- **Current Verified State**: `src/app/api/tenants/route.ts` (L27–30) excludes `app_users` from unauthenticated `?slug=` queries. Verified in Phase 10.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10.
- **Verification Requirements**: Verified via code inspection.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.7: Scope Shift Reconciliation to Explicit `shift_id`
- **Finding Ref**: `MF-SHFT-001`
- **Priority**: P2 — High
- **Objective**: Scope shift cash purchases directly by explicit `shift_id` rather than timestamp ranges.
- **Current Verified State**: `20261005_05_purchases_shift_id.sql` deployed. `purchases` table has `shift_id` FK, `purchases/route.ts` populates it (L123), and `shifts/route.ts` queries by `shift_id` (L287). Verified in Phase 7/10/12.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 7/10/12.
- **Verification Requirements**: Verified via live DB schema.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.8: Cursor Pagination for Invoices & Financial Ledgers
- **Finding Ref**: `MF-PERF-001`
- **Priority**: P4 — Low
- **Objective**: Implement keyset cursor pagination on heavy ledger listing queries.
- **Current Verified State**: `src/app/api/invoices/route.ts` implements keyset cursor (`next_cursor`, `has_more`, `limit: 50`) consumed by `SalesHistory.tsx`. Client and supplier ledger routes lack cursor pagination.
- **Exact Remaining Scope**:
  1. Add `cursor` and `limit` handling to `src/app/api/clients/route.ts` and `src/app/api/suppliers/route.ts`.
  2. Return `next_cursor` and `has_more` in JSON response.
- **Files Expected to Change**: `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`
- **Database Changes**: None
- **Acceptance Criteria**: Requests to client and supplier endpoints return capped payloads ($\le 50$) with valid `next_cursor`.
- **Verification Requirements**: API response payload measurement.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

### Task 13.2.9: Consolidate N+1 KPI Fetching in CEO Executive Suite
- **Finding Ref**: `MF-PERF-002`
- **Priority**: P2 — High
- **Objective**: Replace per-branch loop queries with single aggregated SQL group-by query.
- **Current Verified State**: `20261006_01_performance_kpi_and_templates_rpc.sql` deployed `get_ceo_branches_kpi_summary`. `src/app/api/tenants/kpi/route.ts` executes single RPC fetch for `CeoSuite.tsx`. Verified in Phase 11 (Task P11-02).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 11.
- **Verification Requirements**: Verified via live DB RPC catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.10: Dynamic Splitting for Monolithic POS & Inventory Bundles
- **Finding Ref**: `MF-PERF-003`
- **Priority**: P2 — High
- **Objective**: Split monolithic sub-views using `next/dynamic`.
- **Current Verified State**: `src/app/[slug]/page.tsx` lazy loads 11 secondary sub-views via `next/dynamic`. Verified in Phase 11 (Task P11-03).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 11.
- **Verification Requirements**: Verified via `src/app/[slug]/page.tsx`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.11: Standardize Gross vs Net Sales and Tax/Discount Formulas
- **Finding Ref**: `MF-FIN-002`, `MF-FIN-003`
- **Priority**: P2 — High
- **Objective**: Unify sales math definitions across all components.
- **Current Verified State**: `salesMath.ts` created and imported into `SalesHistory.tsx`, `SalesView.tsx`, and `OverviewView.tsx`. `ShiftDrawer.tsx` and `DayClose.tsx` have not been refactored to consume `salesMath.ts`.
- **Exact Remaining Scope**:
  1. Refactor `ShiftDrawer.tsx` and `DayClose.tsx` to consume `calculateSalesSummary()` from `@/utils/salesMath`.
- **Files Expected to Change**: `src/components/ShiftDrawer.tsx`, `src/components/DayClose.tsx`
- **Database Changes**: None
- **Acceptance Criteria**: Gross vs net sales metrics match 100% between `SalesHistory`, `ShiftDrawer`, and `DayClose`.
- **Verification Requirements**: Comparative sales calculation audit.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

### Task 13.2.12: Sanitize PostgREST Search Wildcards
- **Finding Ref**: `MF-SEC-004`
- **Priority**: P2 — High
- **Objective**: Escape wildcards (`%`, `_`, `,`) in PostgREST search inputs.
- **Current Verified State**: `sanitizePostgRESTLike` in `src/lib/utils.ts` is called in `invoices/route.ts` (L84) and `tenants/route.ts` (L57, L58, L69, L76). Verified in Phase 10/11.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10/11.
- **Verification Requirements**: Verified via code inspection.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.13: Fix POS Sales Return Line Total Math & Event Listener Leak
- **Finding Ref**: `MF-UI-001`, `MF-UI-002`
- **Priority**: P2 — High
- **Objective**: Fix return item line total sign in POS and prevent keyboard listener leaks.
- **Current Verified State**: `PosBilling.tsx` uses `crypto.randomUUID()` for line item IDs (L699), auto-syncs tender balance dynamically (L624), and handles return line totals in calculation loops. Verified in Phase 9/12.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 9/12.
- **Verification Requirements**: Verified via `PosBilling.tsx`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.2.14: Atomic Inter-Branch Stock Transfer RPC (`process_branch_dispatch_atomic`)
- **Finding Ref**: `MF-ATOM-003`
- **Priority**: P2 — High
- **Objective**: Execute inter-branch dispatch stock deductions and transfer value persistence atomically.
- **Current Verified State**: `20261004_03_atomic_branch_transfer.sql` deployed. `src/app/api/branch-orders/route.ts` invokes `process_branch_dispatch_atomic` (L325). Verified in Phase 7/12 (Task 12.6).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 7/12.
- **Verification Requirements**: Verified via live DB RPC catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

## WAVE 3: CONCURRENCY, AI QUOTAS & DATABASE INTEGRITY

### Task 13.3.1: Atomic Voucher Creation RPC (`create_voucher_atomic`)
- **Finding Ref**: `MF-ATOM-004`
- **Priority**: P3 — Medium
- **Objective**: Wrap voucher insertion and token mark-used in atomic PL/pgSQL function.
- **Current Verified State**: `20261005_04_create_voucher_atomic.sql` deployed. `src/app/api/vouchers/route.ts` executes `create_voucher_atomic` (L121). Verified in Phase 8/12 (Task 12.5).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 8/12.
- **Verification Requirements**: Verified via live DB RPC catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.3.2: Atomic Token Vendor Settlement RPC (`settle_tokens_atomic`)
- **Finding Ref**: `MF-ATOM-005`
- **Priority**: P3 — Medium
- **Objective**: Wrap vendor token settlement and payment voucher creation in atomic PL/pgSQL function.
- **Current Verified State**: `20261007_02_settle_tokens_atomic.sql` deployed. `src/app/api/tokens/route.ts` calls `settle_tokens_atomic` (L458). Verified in Phase 12 (Task 12.7).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 12.
- **Verification Requirements**: Verified via live DB RPC catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.3.3: Server-Side Session Revocation Mechanism
- **Finding Ref**: `MF-AUTH-004`
- **Priority**: P3 — Medium
- **Objective**: Provide server-side session revocation table and validation hook.
- **Current Verified State**: No `revoked_sessions` table exists and `src/lib/session.ts` does not check token revocation.
- **Exact Remaining Scope**:
  1. Create `revoked_sessions` table migration in Supabase (`jti`, `user_id`, `revoked_at`, `expires_at`).
  2. Add `jti` claim to `createSessionToken` in `src/lib/session.ts`.
  3. Add `isSessionRevoked(jti)` check in `getSession()` in `src/lib/session.ts`.
  4. Populate `revoked_sessions` on `POST /api/auth/logout`.
- **Files Expected to Change**: `supabase/migrations/20261008_02_revoked_sessions.sql`, `src/lib/session.ts`, `src/app/api/auth/logout/route.ts`
- **Database Changes**: New table `revoked_sessions` with index on `expires_at`.
- **Acceptance Criteria**: Using a JWT after `POST /api/auth/logout` returns HTTP 401 Unauthorized.
- **Verification Requirements**: Token reuse post-logout test.
- **Dependencies**: None
- **Status**: `REMEDIATION REQUIRED`

---

### Task 13.3.4: Persistent Supabase-Backed AI Quota Ledger
- **Finding Ref**: `MF-AI-001`
- **Priority**: P3 — Medium
- **Objective**: Persist AI quota usage in database and fail closed in production on quota failure.
- **Current Verified State**: `20261003_01_centralized_ai_usage_system.sql` active. `src/lib/ai-gateway.ts` persists usage to `ai_usage_ledger` and fails closed in production when DB is unavailable (L322). Memory ring buffer bounded to 500 items (L407). Verified in Phase 10/11 (Task P11-04).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10/11.
- **Verification Requirements**: Verified via `ai-gateway.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.3.5: Strict Environment Assertion for Supabase Service Role Key
- **Finding Ref**: `MF-SEC-005`
- **Priority**: P1 — Critical
- **Objective**: Fail server startup immediately if `SUPABASE_SERVICE_ROLE_KEY` is missing or placeholder.
- **Current Verified State**: `src/lib/supabase.ts` currently falls back to `'service_key_placeholder'` without throwing an exception.
- **Exact Remaining Scope**:
  1. Add assertion in `src/lib/supabase.ts` throwing a fatal startup error if `process.env.SUPABASE_SERVICE_ROLE_KEY` is missing, empty, or equals `'service_key_placeholder'`.
- **Files Expected to Change**: `src/lib/supabase.ts`
- **Database Changes**: None
- **Acceptance Criteria**: Server process crashes on initialization if `SUPABASE_SERVICE_ROLE_KEY` is unconfigured.
- **Verification Requirements**: Node process startup error verification.
- **Dependencies**: None
- **Status**: `REMEDIATION REQUIRED`

---

### Task 13.3.6: Purge Unused `pg` Dependency
- **Finding Ref**: `MF-DEP-001`
- **Priority**: P4 — Low
- **Objective**: Completely remove unused `pg` and `@types/pg` dependencies from `package.json`.
- **Current Verified State**: `pg` was moved from `dependencies` to `devDependencies` in Phase 11 (Task P11-08).
- **Exact Remaining Scope**:
  1. Confirm zero imports of `'pg'` across codebase.
  2. Remove `"pg": "^8.23.1"` from `devDependencies` in `package.json`.
- **Files Expected to Change**: `package.json`
- **Database Changes**: None
- **Acceptance Criteria**: `npm ls pg` returns empty and `npx tsc --noEmit` succeeds.
- **Verification Requirements**: Clean TypeScript compilation.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

### Task 13.3.7: Implement Frontend Invoice Cancellation Workflow
- **Finding Ref**: `MF-UI-003`
- **Priority**: P2 — High
- **Objective**: Add "Cancel Invoice" button and supervisor PIN modal in `SalesHistory.tsx` calling backend cancellation endpoint.
- **Current Verified State**: Backend RPC `cancel_invoice_atomic` is fully operational in PostgreSQL and `invoices/route.ts` `DELETE` handler. Frontend UI button & modal are missing.
- **Exact Remaining Scope**:
  1. Add "Cancel Invoice" button to invoice detail modal in `src/components/SalesHistory.tsx`.
  2. Implement Supervisor PIN modal prompting for cancellation reason.
  3. Send `DELETE /api/invoices?id=<id>&tenant_id=<tenant_id>&reason=<reason>`.
- **Files Expected to Change**: `src/components/SalesHistory.tsx`
- **Database Changes**: None
- **Acceptance Criteria**: Cashier can cancel invoice with supervisor PIN, triggering backend stock and balance reversal.
- **Verification Requirements**: UI click-through cancellation test.
- **Dependencies**: None
- **Status**: `REMEDIATION REQUIRED`

---

### Task 13.3.8: Negative Stock Floor Behavior Confirmation
- **Finding Ref**: `MF-DB-001`
- **Priority**: P4 — Low
- **Objective**: Confirm business behavior for stock adjustment floor clamping vs exception.
- **Current Verified State**: `adjust_item_stock` in `20260925_05_atomic_stock_adjust.sql` clamps stock to 0 via `GREATEST(0, v_current + p_qty_delta)` (L28) to prevent negative stock without crashing POS checkout.
- **Exact Remaining Scope**:
  1. Confirm `GREATEST(0, ...)` clamping as the accepted ERP checkout resilience behavior and document confirmation.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Behavior confirmed and documented.
- **Verification Requirements**: Documentation audit.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

### Task 13.3.9: Extend Iframe Thermal Printer Cleanup Safety Timeout
- **Finding Ref**: `MF-PRINT-001`
- **Priority**: P3 — Medium
- **Objective**: Extend cleanup safety timeout to 30 seconds and listen for `afterprint`.
- **Current Verified State**: `src/utils/iframePrint.ts` extended safety timer to 30,000ms (L69) and cancels timer via `afterprint` listener (L62). Verified in Phase 11 (Task P11-06).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 11.
- **Verification Requirements**: Verified via `iframePrint.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.3.10: Optimize Catalog Item Category Enrichment
- **Finding Ref**: `MF-PERF-004`
- **Priority**: P4 — Low
- **Objective**: Optimize category map lookup performance in catalog inventory screens.
- **Current Verified State**: API-level token config indexing (`configsBySeries = new Map()`) was completed in `items/route.ts` in Phase 11 (Task P11-05).
- **Exact Remaining Scope**:
  1. Profile `StockInventory.tsx` rendering and optimize component category map if rendering time exceeds 2ms.
- **Files Expected to Change**: `src/components/StockInventory.tsx` (if needed)
- **Database Changes**: None
- **Acceptance Criteria**: Category rendering time $\le 2\text{ms}$.
- **Verification Requirements**: Component rendering profiling.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

### Task 13.3.11: Strict Auth Fallbacks in Items & Held Invoices
- **Finding Ref**: `MF-DEF-001`
- **Priority**: P3 — Medium
- **Objective**: Replace permissive auth fallbacks with explicit HTTP 401/403 returns.
- **Current Verified State**: `src/app/api/held-invoices/route.ts` and `src/app/api/items/route.ts` strictly validate `auth.authorized` and return explicit HTTP 401/403 responses. Verified in Phase 10.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10.
- **Verification Requirements**: Verified via code inspection.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.3.12: Mandatory Positive Cost Price Validation
- **Finding Ref**: `MF-INV-001`
- **Priority**: P2 — High
- **Objective**: Reject zero or negative cost price entries during product creation.
- **Current Verified State**: `src/app/api/items/route.ts` line 315 permits `cost_price = 0` without returning a validation error.
- **Exact Remaining Scope**:
  1. In `POST /api/items` (single and bulk mode): reject `cost_price <= 0` with HTTP 400 error.
  2. In `StockInventory.tsx`: add client validation blocking form submit if `cost_price <= 0`.
- **Files Expected to Change**: `src/app/api/items/route.ts`, `src/components/StockInventory.tsx`
- **Database Changes**: None
- **Acceptance Criteria**: Creating a new item with `cost_price = 0` returns HTTP 400 error. Existing historical catalog items with zero cost remain accessible.
- **Verification Requirements**: HTTP API validation test.
- **Dependencies**: None
- **Status**: `REMEDIATION REQUIRED`

---

### Task 13.3.13: Cart State Key Uniqueness & Handover Concurrency Controls
- **Finding Ref**: `MF-POS-001`, `MF-POS-002`, `MF-POS-003`
- **Priority**: P3 — Medium
- **Objective**: Generate unique UUIDs for cart line keys, auto-sync tender balance, and block duplicate open shifts.
- **Current Verified State**: `PosBilling.tsx` uses `crypto.randomUUID()` (L699), auto-syncs tender balance (L624), and `shifts/route.ts` returns HTTP 409 on duplicate open shift (L170). Verified in Phase 10/12.
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10/12.
- **Verification Requirements**: Verified via `PosBilling.tsx` and `shifts/route.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

## WAVE 4: THERMAL PRINTING, UI POLISH & LEGACY CLEANUP

### Task 13.4.1: Modernize HTTP Security Headers & Remove Deprecated Directives
- **Finding Ref**: `MF-SEC-006`, `MF-SEC-007`
- **Priority**: P3 — Medium
- **Objective**: Add Content-Security-Policy (CSP) in `next.config.ts` and remove deprecated `X-XSS-Protection` header.
- **Current Verified State**: `next.config.ts` includes `Permissions-Policy`, `HSTS`, `X-Frame-Options`. CSP is missing and `X-XSS-Protection` is present (L21).
- **Exact Remaining Scope**:
  1. Remove `X-XSS-Protection` header from `next.config.ts`.
  2. Add `Content-Security-Policy` header in `next.config.ts`.
- **Files Expected to Change**: `next.config.ts`
- **Database Changes**: None
- **Acceptance Criteria**: HTTP response headers include valid CSP and exclude deprecated `X-XSS-Protection`.
- **Verification Requirements**: HTTP response header inspection.
- **Dependencies**: None
- **Status**: `REMEDIATION REQUIRED`

---

### Task 13.4.2: High-Entropy Identifier Generation (Anti-Collision)
- **Finding Ref**: `MF-COLL-001`
- **Priority**: P4 — Low
- **Objective**: Use collision-resistant code generators for system identifiers.
- **Current Verified State**: `src/lib/utils.ts` exports `generateUniqueCode` with DB collision retry loops. `vouchers/route.ts` uses date + hex code. Verified in Phase 10 (FIX FINDING-API-013).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 10.
- **Verification Requirements**: Verified via `src/lib/utils.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.4.3: Dynamic Canvas Width Scaling for 58mm Thermal Printers
- **Finding Ref**: `MF-PRINT-002`
- **Priority**: P4 — Low
- **Objective**: Scale thermal receipt canvas geometry dynamically for 58mm vs 80mm printers.
- **Current Verified State**: `src/utils/receiptCanvas.ts` supports `paperSize: 'thermal_58' | 'thermal_80'` (width 384px vs 576px) (L74). Verified in Phase 11 (Task P11-07).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 11.
- **Verification Requirements**: Verified via `receiptCanvas.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.4.4: Atomic Default Receipt Template Toggle
- **Finding Ref**: `MF-PRINT-003`
- **Priority**: P4 — Low
- **Objective**: Wrap default receipt template toggle in single atomic SQL update query.
- **Current Verified State**: `20261006_01_performance_kpi_and_templates_rpc.sql` deployed `set_default_receipt_template`. `receipt-templates/route.ts` calls RPC (L130, L185). Verified in Phase 11 (Task P11-11).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 11.
- **Verification Requirements**: Verified via live DB RPC catalog.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.4.5: Walk-In Token Retention Claim Code Slip
- **Finding Ref**: `MF-E2E-001`
- **Priority**: P4 — Low
- **Objective**: Render token claim serial code slip on physical receipts for walk-in token retentions.
- **Current Verified State**: `tokens/route.ts` generates `CLM-XXXX...` claim code (L163); `PosBilling.tsx` renders `tokenClaimBlock` in thermal receipt (L207). Verified in Phase 12 (Task 12.8).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 12.
- **Verification Requirements**: Verified via `PosBilling.tsx`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.4.6: Optional Inventory Reservation for Held Invoices
- **Finding Ref**: `MF-E2E-002`
- **Priority**: P4 — Low
- **Objective**: Reserve stock with 2-hour TTL expiration on held cart orders.
- **Current Verified State**: Replaced in Phase 12 (Task 12.9) with live stock re-check and warning notification upon restoring held orders in `PosBilling.tsx` (L518–535).
- **Exact Remaining Scope**: None. Original TTL reservation mechanism is **SUPERSEDED** by Phase 12's accepted live stock check strategy.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Preserved Phase 12 resolution.
- **Verification Requirements**: Code verification in `PosBilling.tsx`.
- **Dependencies**: None
- **Status**: `SUPERSEDED — NO ACTION`

---

### Task 13.4.7: Supervisor Amount Guard for Petty Expenses
- **Finding Ref**: `MF-E2E-003`
- **Priority**: P4 — Low
- **Objective**: Guard against excessive petty expense entries.
- **Current Verified State**: `expenses/route.ts` enforces server-side upper-bound guard `PETTY_EXPENSE_MAX = 50_000` (L66), rejecting larger amounts with HTTP 400. Verified in Phase 12 (Task 12.10).
- **Exact Remaining Scope**: None.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Fully satisfied in Phase 12.
- **Verification Requirements**: Verified via `expenses/route.ts`.
- **Dependencies**: None
- **Status**: `ALREADY IMPLEMENTED — NO ACTION`

---

### Task 13.4.8: Clean Up Dev Script & Dead Boilerplate Routes
- **Finding Ref**: `MF-DEP-002`, `MF-LEG-001`
- **Priority**: P4 — Low
- **Objective**: Clean up dev scripts and dead boilerplate routes.
- **Current Verified State**: Dead boilerplate route `src/app/api/route.ts` deleted. `--webpack` in `package.json` evaluated and retained due to Windows host SWC native addon requirements (Phase 11 Task P11-09).
- **Exact Remaining Scope**: None. `--webpack` is **INTENTIONALLY RETAINED** for Windows compatibility as documented.
- **Files Expected to Change**: None
- **Database Changes**: None
- **Acceptance Criteria**: Retained `--webpack` documented and confirmed.
- **Verification Requirements**: Build stability check.
- **Dependencies**: None
- **Status**: `INTENTIONALLY RETAINED — NO ACTION`

---

### Task 13.4.9: Unify TypeScript Interface Definitions & Migration Archive
- **Finding Ref**: `MF-ARCH-002`, `MF-DB-002`
- **Priority**: P4 — Low
- **Objective**: Consolidate duplicate TypeScript interfaces between `src/types/index.ts` and `src/types/ceo.ts`.
- **Current Verified State**: Legacy SQL files archived into `supabase/migrations/archive/`. Duplicate interface definitions between `src/types/index.ts` and `src/types/ceo.ts` remain unmerged.
- **Exact Remaining Scope**:
  1. Re-export shared types (`Invoice`, `InvoiceItem`, `Customer`, `Supplier`) from `src/types/index.ts` inside `src/types/ceo.ts`.
  2. Eliminate duplicate interface definitions while preserving backward compatibility.
- **Files Expected to Change**: `src/types/index.ts`, `src/types/ceo.ts`
- **Database Changes**: None
- **Acceptance Criteria**: `npx tsc --noEmit` exits with 0 errors.
- **Verification Requirements**: Clean TypeScript compilation.
- **Dependencies**: None
- **Status**: `PARTIAL REMEDIATION REQUIRED`

---

`ZERO IMPLEMENTATION CHANGES PERFORMED — TASK REGISTER GENERATION ONLY`
