# PHASE 13 — MASTER REMEDIATION IMPLEMENTATION PLAN

**Date:** October 8, 2026  
**Author:** Lead Systems Architect & Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 13 — Remediation Implementation Plan  
**Execution Rule Adherence:** STRICT PLANNING ONLY — ZERO CODE OR MIGRATIONS EXECUTED  

---

## 1. Executive Summary

This Master Remediation Implementation Plan translates the authoritative findings of `audit/phase-13-audit-report.md` into an actionable, dependency-aware remediation roadmap for Phase 13.

### Audit Result Reconciliation
The Phase 13 forensic audit reconciled 38 master tasks against current source code, database migrations, and live Supabase PostgreSQL function catalogs:
- **22 Tasks (`ALREADY IMPLEMENTED`)**: Fully implemented during Phases 7–12. No remediation required.
- **1 Task (`SUPERSEDED`)**: Task 13.4.6 (Held Invoice Inventory TTL Reservation) was superseded by Phase 12's live stock re-check and warning notification on restore.
- **8 Tasks (`PARTIALLY IMPLEMENTED`)**: Foundational work complete; targeted remediation required only for remaining gaps.
- **7 Tasks (`NOT IMPLEMENTED`)**: Genuinely open findings requiring complete implementation.

### Final Phase 13 Objective
To execute targeted remediation for the **7 open** and **8 partial** items without re-implementing already verified architecture, maintaining 100% backward compatibility, and enforcing zero regressions across POS checkout, inventory movement, and financial ledgers.

---

## 2. Scope Classification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PHASE 13 TASK CLASSIFICATION                      │
├─────────────────────────────────────────────────────────────────────────┤
│ 🟢 ALREADY IMPLEMENTED (22 Tasks) — No Remediation Action Needed        │
│    13.1.2, 13.2.1, 13.2.2, 13.2.3, 13.2.4, 13.2.5, 13.2.6, 13.2.7,       │
│    13.2.9, 13.2.10, 13.2.12, 13.2.13, 13.2.14, 13.3.1, 13.3.2, 13.3.4,    │
│    13.3.9, 13.3.11, 13.3.13, 13.4.2, 13.4.3, 13.4.4, 13.4.5, 13.4.7        │
├─────────────────────────────────────────────────────────────────────────┤
│ 🟡 PARTIALLY IMPLEMENTED (8 Tasks) — Target Remaining Scope Only         │
│    13.1.1, 13.2.8, 13.2.11, 13.3.6, 13.3.8, 13.3.10, 13.4.8, 13.4.9      │
├─────────────────────────────────────────────────────────────────────────┤
│ 🔴 NOT IMPLEMENTED (7 Tasks) — Full Remediation Required                │
│    13.1.3, 13.1.4, 13.3.3, 13.3.5, 13.3.7, 13.3.12, 13.4.1               │
├─────────────────────────────────────────────────────────────────────────┤
│ ⚪ SUPERSEDED (1 Task) — Preserved Phase 12 Resolution                   │
│    13.4.6 (Replaced by live stock re-check on restore in PosBilling.tsx)│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Remediation Matrix

| Task ID | Finding Ref | Existing State | Remaining Remediation Work | Priority | Dependencies | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **13.1.1** | `MF-AUTH-001` | `suppliers/route.ts` scoped. `clients/route.ts` only scopes `tenant_id` if provided in body. | Enforce unconditional `.eq('tenant_id', auth.tenantId)` on `clients/route.ts` `PATCH` & add soft `DELETE`. | P1 | None | HTTP 403 cross-tenant PATCH test |
| **13.1.3** | `MF-SEC-001` | In-memory `Map` in `rate-limit.ts` resets on serverless cold starts. | Build persistent Supabase PostgreSQL `rate_limit_entries` table & atomic check RPC. | P3 | None | Cold-start simulated hit limit test |
| **13.1.4** | `MF-FIN-001` | `salesMath.ts` handles sales metrics; shift cash drawer formula duplicated. | Create `src/utils/cashReconciliation.ts` for drawer expected cash & wire into `ShiftDrawer` & `DayClose`. | P2 | 13.2.11 | Cash drawer ledger balance match |
| **13.2.8** | `MF-PERF-001` | `invoices/route.ts` has keyset cursor pagination (`next_cursor`, `limit: 50`). | Add keyset cursor pagination (`created_at`, `id`) to client and supplier ledger query endpoints. | P4 | None | Payload size < 50KB & pagination test |
| **13.2.11** | `MF-FIN-002/003` | `salesMath.ts` used in `SalesHistory`, `SalesView`, `OverviewView`. | Refactor `ShiftDrawer.tsx` and `DayClose.tsx` to consume `salesMath.ts` functions. | P2 | None | Formula audit parity check |
| **13.3.3** | `MF-AUTH-004` | 7-day JWTs without server-side revocation mechanism. | Create `revoked_sessions` table in Supabase, lookup check in `session.ts`, populate on `POST /api/auth/logout`. | P3 | None | Logout token reuse rejection test (401) |
| **13.3.5** | `MF-SEC-005` | `src/lib/supabase.ts` uses fallback `'service_key_placeholder'`. | Add strict startup assertion throwing a fatal error if `SUPABASE_SERVICE_ROLE_KEY` is missing or placeholder. | P1 | None | Node process startup error test |
| **13.3.6** | `MF-DEP-001` | `pg` moved to `devDependencies` in `package.json`. | Verify zero imports of `pg` / `@types/pg` in codebase and purge package references from `package.json`. | P4 | None | `npm ls pg` & clean build |
| **13.3.7** | `MF-UI-003` | Backend RPC `cancel_invoice_atomic` active; frontend UI missing. | Add "Cancel Invoice" button & supervisor PIN modal in `SalesHistory.tsx` invoking `cancel_invoice_atomic`. | P2 | None | UI cancellation click-through test |
| **13.3.8** | `MF-DB-001` | `adjust_item_stock` RPC clamps to 0 via `GREATEST(0, ...)`. | Confirm business decision: preserve `GREATEST(0, ...)` clamping for checkout resilience or parameterize strict floor. | P4 | None | DB RPC behavior confirmation |
| **13.3.10** | `MF-PERF-004` | API token config O(N) indexing done in `items/route.ts`. | Verify UI component category rendering in `StockInventory.tsx` and optimize category map if needed. | P4 | None | Component render time profiling |
| **13.3.12** | `MF-INV-001` | `items/route.ts` permits `cost_price = 0` (L315). | Enforce `cost_price > 0` validation on server (`items/route.ts`) & client (`StockInventory.tsx`) for new items. | P2 | None | Zero cost item creation rejection test |
| **13.4.1** | `MF-SEC-006/007` | `next.config.ts` has HSTS & Permissions-Policy; CSP missing. | Add Content-Security-Policy header in `next.config.ts` and remove deprecated `X-XSS-Protection` header. | P3 | None | SecurityHeaders.com / HTTP response check |
| **13.4.8** | `MF-DEP-002/LEG-001` | Dead route `app/api/route.ts` deleted; `--webpack` retained. | **INTENTIONALLY RETAINED**: Keep `--webpack` in `package.json` due to Windows SWC native module constraints. | P4 | None | Windows build stability check |
| **13.4.9** | `MF-ARCH-002/DB-002` | Legacy SQL archived to `supabase/migrations/archive/`. | Consolidate duplicated TypeScript interfaces between `src/types/index.ts` and `src/types/ceo.ts`. | P4 | None | `npx tsc --noEmit` exit 0 |

---

## 4. Detailed Implementation Plan

### 4.1 Task 13.1.1 — Client IDOR Tenant Scoping (`MF-AUTH-001`) [P1 - Critical]
- **Objective**: Prevent cross-tenant record tampering by enforcing unconditional `tenant_id` equality filters on all client update and delete queries.
- **Current Implementation**: `suppliers/route.ts` enforces `.eq('tenant_id', existingSupplier.tenant_id)` in PATCH and DELETE. `clients/route.ts` line 115 only applies `.eq('tenant_id', tenant_id)` if `tenant_id` is supplied in the request body, and lacks a DELETE handler.
- **Target Files**: `src/app/api/clients/route.ts`
- **Remediation Actions**:
  1. Modify `PATCH` handler in `src/app/api/clients/route.ts`:
     - Unconditionally append `.eq('tenant_id', targetTenantId)` to the update query.
  2. Implement `DELETE` handler in `src/app/api/clients/route.ts`:
     - Fetch existing client by ID, verify `existingClient.tenant_id` via `requireTenantAuth`.
     - Perform soft-delete (`is_deleted = true`) scoped to `.eq('id', id).eq('tenant_id', existingClient.tenant_id)`.
- **Acceptance Criteria**: `PATCH` or `DELETE` requests targeting another tenant's `client_id` return HTTP 403 / 404 without mutating data.

### 4.2 Task 13.1.3 — Distributed Rate Limiting via Supabase PostgreSQL (`MF-SEC-001`) [P3 - Medium]
- **Objective**: Replace in-memory sliding window rate limiter with a persistent, cold-start resistant Supabase PostgreSQL store.
- **Architecture Decision**: **Use Supabase PostgreSQL** (Do NOT use Redis or Upstash).
- **Database Objects Required**:
  - Table: `rate_limit_entries` (`key TEXT PRIMARY KEY`, `count INT`, `reset_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`).
  - Stored Function: `check_rate_limit_atomic(p_key TEXT, p_max_attempts INT, p_window_seconds INT)` returning `(allowed BOOLEAN, remaining INT, retry_after_sec INT)`.
- **Target Files**: `supabase/migrations/20261008_01_rate_limit_system.sql`, `src/lib/rate-limit.ts`
- **Remediation Actions**:
  1. Author migration creating `rate_limit_entries` table with unlogged storage optimization and periodic cleanup trigger.
  2. Implement `check_rate_limit_atomic` PL/pgSQL function using `INSERT ... ON CONFLICT (key) DO UPDATE` with row locking (`FOR UPDATE`).
  3. Refactor `src/lib/rate-limit.ts` to execute `supabaseAdmin.rpc('check_rate_limit_atomic', ...)` with fallback to fail-closed in production.
- **Acceptance Criteria**: Rate limits persist across serverless restarts and enforce max 5 attempts per 15 minutes per IP/key.

### 4.3 Task 13.1.4 — Centralized Cash Reconciliation Formula (`MF-FIN-001`) [P2 - High]
- **Objective**: Establish a single authoritative cash reconciliation utility across cashier shift drawers, day close, and financial ledgers.
- **Formula Requirement**:
  $$\text{Expected Closing Cash} = \text{Opening Cash} + \text{Cash Sales} - \text{Cash Returns} - \text{Petty Expenses} - \text{Supplier Cash Payouts} - \text{Token Cash Payouts}$$
- **Target Files**: `src/utils/cashReconciliation.ts` (New), `src/components/ShiftDrawer.tsx`, `src/components/DayClose.tsx`
- **Remediation Actions**:
  1. Create `src/utils/cashReconciliation.ts` exporting `calculateExpectedClosingCash(params)`.
  2. Import and replace inline calculations in `ShiftDrawer.tsx` and `DayClose.tsx`.
- **Acceptance Criteria**: Zero cash discrepancy between cashier drawer closing preview and manager day close ledger summaries.

### 4.4 Task 13.2.8 — Cursor Pagination for Client & Supplier Ledgers (`MF-PERF-001`) [P4 - Low]
- **Objective**: Extend keyset cursor pagination to client and supplier ledger listing endpoints to eliminate unbounded DB payload transfers.
- **Current Implementation**: `invoices/route.ts` already has cursor pagination (`next_cursor`, `has_more`, `limit: 50`).
- **Target Files**: `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`
- **Remediation Actions**:
  1. Add `cursor` and `limit` (default 50, max 200) query parameter handling to `GET /api/clients` and `GET /api/suppliers`.
  2. Return structured pagination metadata (`next_cursor`, `has_more`).
- **Acceptance Criteria**: JSON responses return $\le 50$ records with `next_cursor` when requesting un-capped ledger views.

### 4.5 Task 13.2.11 — Standardize Sales Math across Shift Drawer & Day Close (`MF-FIN-002/003`) [P2 - High]
- **Objective**: Wire `src/utils/salesMath.ts` into remaining reporting and shift drawer components.
- **Current Implementation**: `salesMath.ts` is already used in `SalesHistory.tsx`, `SalesView.tsx`, and `OverviewView.tsx`.
- **Target Files**: `src/components/ShiftDrawer.tsx`, `src/components/DayClose.tsx`
- **Remediation Actions**:
  1. Refactor gross sales, net sales, tax, and discount calculation blocks in `ShiftDrawer.tsx` and `DayClose.tsx` to call `calculateSalesSummary()` from `@/utils/salesMath`.
- **Acceptance Criteria**: All reporting screens produce 100% identical gross vs net sales and discount totals for any given date range.

### 4.6 Task 13.3.3 — Server-Side Session Revocation Mechanism (`MF-AUTH-004`) [P3 - Medium]
- **Objective**: Implement server-side JWT session revocation to support explicit user logout and immediate token invalidation.
- **Database Objects Required**:
  - Table: `revoked_sessions` (`jti TEXT PRIMARY KEY`, `user_id UUID`, `revoked_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`).
  - Index: `idx_revoked_sessions_expires ON revoked_sessions(expires_at)`.
- **Target Files**: `supabase/migrations/20261008_02_revoked_sessions.sql`, `src/lib/session.ts`, `src/app/api/auth/logout/route.ts`
- **Remediation Actions**:
  1. Create `revoked_sessions` table migration.
  2. Update `createSessionToken` in `src/lib/session.ts` to include unique `jti` (UUID) claim.
  3. Add `isSessionRevoked(jti)` check in `getSession()` in `src/lib/session.ts`.
  4. Update `POST /api/auth/logout` to insert the session `jti` into `revoked_sessions`.
- **Acceptance Criteria**: Transmitting a previously valid JWT after `POST /api/auth/logout` returns HTTP 401 Unauthorized.

### 4.7 Task 13.3.5 — Strict Supabase Service Role Key Startup Assertion (`MF-SEC-005`) [P1 - Critical]
- **Objective**: Fail immediately at server startup if `SUPABASE_SERVICE_ROLE_KEY` is unconfigured or set to placeholder string.
- **Target Files**: `src/lib/supabase.ts`
- **Remediation Actions**:
  1. Inspect `process.env.SUPABASE_SERVICE_ROLE_KEY` on module load.
  2. Throw fatal `Error('[FATAL SECURITY EXCEPTION] SUPABASE_SERVICE_ROLE_KEY is unconfigured or invalid placeholder.')` if key is missing, empty, or equals `'service_key_placeholder'`.
- **Acceptance Criteria**: Node.js server crashes immediately on initialization if service role key is unconfigured.

### 4.8 Task 13.3.6 — Purge Unused `pg` Dependency (`MF-DEP-001`) [P4 - Low]
- **Objective**: Completely remove unused `pg` and `@types/pg` dependencies from `package.json`.
- **Current Implementation**: Moved to `devDependencies` in Phase 11.
- **Target Files**: `package.json`
- **Remediation Actions**:
  1. Verify zero imports of `'pg'` across `src/`.
  2. Remove `"pg": "^8.23.1"` from `devDependencies` in `package.json`.
- **Acceptance Criteria**: `npm ls pg` returns empty and `npx tsc --noEmit` succeeds with exit code 0.

### 4.9 Task 13.3.7 — Frontend Invoice Cancellation Workflow (`MF-UI-003`) [P2 - High]
- **Objective**: Provide a supervisor PIN-guarded "Cancel Invoice" button in Sales History connected to `cancel_invoice_atomic`.
- **Current Implementation**: Backend RPC `cancel_invoice_atomic` is fully operational in PostgreSQL and `invoices/route.ts` `DELETE` handler.
- **Target Files**: `src/components/SalesHistory.tsx`
- **Remediation Actions**:
  1. Add "Cancel Invoice" action button to invoice detail modal in `SalesHistory.tsx`.
  2. Trigger Supervisor PIN modal prompting for cancellation reason.
  3. Send `DELETE /api/invoices?id=<id>&tenant_id=<tenant_id>&reason=<reason>`.
  4. Refresh sales table and display success notification upon completion.
- **Acceptance Criteria**: Cashier can successfully cancel an invoice with supervisor approval, triggering backend stock & balance reversal.

### 4.10 Task 13.3.8 — Clarify & Confirm Stock Floor Constraint Behavior (`MF-DB-001`) [P4 - Low]
- **Objective**: Confirm business decision regarding stock deduction floor clamping vs exception throwing in `adjust_item_stock` RPC.
- **Current Implementation**: `adjust_item_stock` in `20260925_05_atomic_stock_adjust.sql` clamps stock to 0 via `GREATEST(0, v_current + p_qty_delta)` to prevent negative inventory without crashing cashier checkout.
- **Action**: Preserve existing `GREATEST(0, ...)` clamping behavior as the accepted ERP checkout resilience strategy and document as confirmed business behavior.

### 4.11 Task 13.3.10 — Verify Catalog Item Category Map Optimization (`MF-PERF-004`) [P4 - Low]
- **Objective**: Verify whether component-level category map pre-computation in `StockInventory.tsx` is required.
- **Current Implementation**: API-level token config map indexing (`configsBySeries = new Map()`) was completed in `items/route.ts` in Phase 11.
- **Action**: Profile `StockInventory.tsx` rendering. If category lookup is $\le 2\text{ms}$, preserve existing component code without unnecessary churn.

### 4.12 Task 13.3.12 — Mandatory Positive Cost Price Validation (`MF-INV-001`) [P2 - High]
- **Objective**: Prevent accidental zero or negative item cost price entries during catalog creation.
- **Target Files**: `src/app/api/items/route.ts`, `src/components/StockInventory.tsx`
- **Remediation Actions**:
  1. In `POST /api/items` (single and bulk mode): reject new item creation if `cost_price <= 0` with HTTP 400 error (`"Cost price must be a positive number greater than 0"`).
  2. In `StockInventory.tsx`: add client-side form validation blocking submit if `cost_price <= 0`.
  3. Preserve historical catalog items with zero cost price without invalidating existing records.
- **Acceptance Criteria**: Creating a new product with `cost_price = 0` returns HTTP 400 error.

### 4.13 Task 13.4.1 — Modernize HTTP Security Headers & CSP (`MF-SEC-006/007`) [P3 - Medium]
- **Objective**: Configure a robust Content-Security-Policy (CSP) in `next.config.ts` and remove deprecated legacy security headers.
- **Current Implementation**: `next.config.ts` includes `Permissions-Policy`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`. CSP is missing and deprecated `X-XSS-Protection` is present.
- **Target Files**: `next.config.ts`
- **Remediation Actions**:
  1. Remove `X-XSS-Protection` header from `next.config.ts`.
  2. Add `Content-Security-Policy` header:
     ```text
     default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';
     ```
- **Acceptance Criteria**: Security headers check passes without deprecated headers and includes valid CSP.

### 4.14 Task 13.4.8 — Document Retained `--webpack` Flag (`MF-DEP-002 / MF-LEG-001`) [P4 - Low / Intentionally Retained]
- **Status**: **INTENTIONALLY RETAINED / DEFERRED**
- **Rationale**: Phase 11 evaluated Turbopack on Windows and verified that SWC native node addons fail on Windows hosts (`not a valid Win32 application`), requiring `--webpack` to remain in `package.json` for development server stability. Dead boilerplate route `src/app/api/route.ts` was already deleted.

### 4.15 Task 13.4.9 — Consolidate Duplicate TypeScript Interfaces (`MF-ARCH-002 / MF-DB-002`) [P4 - Low]
- **Objective**: Consolidate duplicated TypeScript interfaces between `src/types/index.ts` and `src/types/ceo.ts`.
- **Target Files**: `src/types/index.ts`, `src/types/ceo.ts`
- **Remediation Actions**:
  1. Re-export shared types (`Invoice`, `InvoiceItem`, `Customer`, `Supplier`) from `src/types/index.ts` inside `src/types/ceo.ts`.
  2. Eliminate duplicate interface definitions while preserving backward compatibility.
- **Acceptance Criteria**: `npx tsc --noEmit` exits with 0 errors.

---

## 5. Database Plan

### 5.1 Migrations Required
1. `supabase/migrations/20261008_01_rate_limit_system.sql`
   - Creates `rate_limit_entries` table.
   - Creates `check_rate_limit_atomic` PL/pgSQL RPC function.
2. `supabase/migrations/20261008_02_revoked_sessions.sql`
   - Creates `revoked_sessions` table with index on `expires_at`.

### 5.2 RLS & Security Considerations
- `rate_limit_entries` and `revoked_sessions` tables are restricted to `service_role` execution only (no public RLS exposure).

---

## 6. Dependency & Ordering Plan

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                      REMEDIATION EXECUTION PHASING                            │
├───────────────────────────────────────────────────────────────────────────────┤
│ PHASE 13A: CRITICAL SECURITY & IDOR (Priority 1)                              │
│   • Task 13.1.1 — Client IDOR Tenant Scoping                                  │
│   • Task 13.3.5 — Strict Supabase Service Role Key Assertion                  │
├───────────────────────────────────────────────────────────────────────────────┤
│ PHASE 13B: OPERATIONAL & FINANCIAL INTEGRITY (Priority 2)                     │
│   • Task 13.1.4 — Centralized Cash Reconciliation Utility                     │
│   • Task 13.2.11 — Standardize Sales Math across ShiftDrawer & DayClose       │
│   • Task 13.3.7 — Frontend Invoice Cancellation Workflow UI                   │
│   • Task 13.3.12 — Mandatory Positive Cost Price Validation                   │
├───────────────────────────────────────────────────────────────────────────────┤
│ PHASE 13C: ARCHITECTURE & SECURITY HARDENING (Priority 3)                     │
│   • Task 13.1.3 — Persistent Supabase PostgreSQL Rate Limiting                │
│   • Task 13.3.3 — Server-Side Session Revocation System                       │
│   • Task 13.4.1 — Modernize Security Headers & Content-Security-Policy       │
├───────────────────────────────────────────────────────────────────────────────┤
│ PHASE 13D: CODE HYGIENE & POLISH (Priority 4)                                 │
│   • Task 13.2.8 — Cursor Pagination for Client & Supplier Ledgers            │
│   • Task 13.3.6 — Purge `pg` Dependency from package.json                     │
│   • Task 13.4.9 — Consolidate Duplicate TypeScript Interfaces                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Regression Protection

1. **POS Checkout Isolation**: `create_invoice_atomic` and `PosBilling.tsx` static mounting preserved without modification.
2. **Token System Preservation**: `redeem_tokens_atomic` and physical token claim workflows untouched.
3. **Database Transaction Safety**: All new migrations execute inside explicit transactional bounds with zero schema breaking changes.

---

## 8. Verification Strategy

1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   Must exit with code 0 (0 errors).

2. **Production Webpack Build**:
   ```bash
   node ./node_modules/next/dist/bin/next build --webpack
   ```
   Must compile all 34 static and dynamic routes cleanly.

3. **Database RPC Verification**:
   - Verify `check_rate_limit_atomic` and `revoked_sessions` table in live PostgreSQL schema via MCP tools.

4. **Security Verification**:
   - Test cross-tenant `PATCH /api/clients` rejection (HTTP 403).
   - Test rate limit lockout persistence across serverless cold starts.
   - Test session token reuse post-logout (HTTP 401).

---

## 9. Git & Scope Rules

- **Zero Implementation Code Modified During Planning**: No application files modified during this planning step.
- **Strict File Boundary**: Only authorized target files for the 15 unresolved tasks will be touched during remediation.
- **No Direct Push to Main**: All changes committed locally after verification.

---

## 10. Deferred & Out of Scope

- **22 Already Implemented Tasks**: 13.1.2, 13.2.1, 13.2.2, 13.2.3, 13.2.4, 13.2.5, 13.2.6, 13.2.7, 13.2.9, 13.2.10, 13.2.12, 13.2.13, 13.2.14, 13.3.1, 13.3.2, 13.3.4, 13.3.9, 13.3.11, 13.3.13, 13.4.2, 13.4.3, 13.4.4, 13.4.5, 13.4.7.
- **Superseded Task 13.4.6**: Held invoice stock reservation superseded by Phase 12 live stock warning on restore.
- **Intentionally Retained `--webpack` (Task 13.4.8)**: Retained due to Windows host SWC native addon requirements.
- **Task 13.3.8 (Stock Floor Clamping)**: `GREATEST(0, ...)` clamping retained as accepted ERP checkout resilience policy.
- **Task 13.3.10 (Catalog Category Map)**: API O(N) indexing complete; component UI pre-computation deferred if performance is optimal.

---

`ZERO IMPLEMENTATION CHANGES PERFORMED — PLANNING ONLY`
