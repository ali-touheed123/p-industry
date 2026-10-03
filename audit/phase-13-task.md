# PHASE 13 AUDIT TASK LIST — MASTER REMEDIATION ROADMAP

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 13 — Final Cross-Module Reconciliation Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

> [!IMPORTANT]
> **AUDIT-ONLY CHECKPOINT:** All checkboxes below represent planned remediation items derived from the Phase 13 Final Reconciliation. Absolutely NO remediation is to be executed during the audit phase.

---

## WAVE 1: CRITICAL SECURITY, IDOR & TRANSACTION ISOLATION (P1 - IMMEDIATE GATE)

- [ ] **Task 13.1.1: Record Ownership Filter Enforcement for Client & Supplier IDOR** (`MF-AUTH-001`)
  - [ ] Add `.eq('tenant_id', auth.tenantId)` filter to all `PATCH` and `DELETE` queries in `src/app/api/clients/route.ts`.
  - [ ] Add `.eq('tenant_id', auth.tenantId)` filter to all `PATCH` and `DELETE` queries in `src/app/api/suppliers/route.ts`.
  - [ ] Validate cross-tenant mutation rejection with HTTP 404/403.

- [ ] **Task 13.1.2: Atomic Supplier Purchase Order RPC (`create_purchase_atomic`)** (`MF-ATOM-001`)
  - [ ] Author `create_purchase_atomic` PL/pgSQL stored procedure in Supabase migrations wrapping purchase header, line items, stock increments, supplier balance, and paint token status mutations in a single transaction.
  - [ ] Refactor `src/app/api/purchases/route.ts` to execute `create_purchase_atomic` RPC.
  - [ ] Validate full rollback on simulated mid-flight database exceptions.

- [ ] **Task 13.1.3: Distributed Rate Limiting & Cold-Start Persistence** (`MF-SEC-001`)
  - [ ] Migrate in-memory rate limiter `src/lib/rate-limit.ts` to Upstash Redis or Supabase unlogged rate-limit table with TTL.
  - [ ] Verify rate limiting persists across serverless cold starts and prevents brute-force attempts.

- [ ] **Task 13.1.4: Harmonize Core Cash Reconciliation & Movement Formulas** (`MF-FIN-001`)
  - [ ] Standardize single mathematical formula for Expected Closing Cash: `Opening Cash + Cash Sales - Cash Returns - Petty Expenses - Supplier Cash Payouts - Token Cash Payouts`.
  - [ ] Create centralized utility `src/utils/cashReconciliation.ts` and import across `ShiftDrawer.tsx`, `DayClose.tsx`, and `FinancialLedgers.tsx`.
  - [ ] Verify zero cash discrepancy across shift drawer and accounting ledgers.

---

## WAVE 2: HIGH OPERATIONAL & FINANCIAL INTEGRITY (P2 - HIGH PRIORITY)

- [ ] **Task 13.2.1: Enforce Tenant Scope on Inventory Item Mutations** (`MF-AUTH-002`)
  - [ ] Add `.eq('tenant_id', auth.tenantId)` filter to `PATCH` and `DELETE` queries in `src/app/api/items/route.ts`.
  - [ ] Verify cross-tenant item hijacking attempts fail with HTTP 404/403.

- [ ] **Task 13.2.2: Strict Authentication & Scoping on Branch Orders** (`MF-AUTH-003`)
  - [ ] Relocate `requireTenantAuth` check to the top of route handler in `src/app/api/branch-orders/route.ts`.
  - [ ] Remove permissive null auth fallback conditions.

- [ ] **Task 13.2.3: Atomic Invoice Modification RPC (`edit_invoice_atomic`)** (`MF-ATOM-002`)
  - [ ] Create `edit_invoice_atomic` PL/pgSQL stored function in Supabase wrapping stock restoral, new stock deductions, and customer balance updates in a single transaction.
  - [ ] Refactor `src/app/api/invoices/route.ts` `PATCH` handler to call `edit_invoice_atomic`.

- [ ] **Task 13.2.4: Centralized Edge Route Perimeter Middleware** (`MF-ARCH-001`)
  - [ ] Create `src/middleware.ts` to enforce global edge authentication on all protected `/api/*` and `/[slug]/*` routes.
  - [ ] Whitelist public authentication routes (`/api/auth/login`, `/api/tenants?slug=`, etc.).

- [ ] **Task 13.2.5: Purge Hardcoded Developer PIN (`dev2026`)** (`MF-SEC-002`)
  - [ ] Remove hardcoded string `dev2026` from `src/lib/auth-passwords.ts:25-27` and `src/app/api/auth/dev-pin/route.ts`.
  - [ ] Require environment variable `DEV_MASTER_PIN` and disable developer PIN endpoint completely in production builds.

- [ ] **Task 13.2.6: Redact Staff Records from Unauthenticated Tenant Slug Route** (`MF-SEC-003`)
  - [ ] Modify `GET /api/tenants?slug=` in `src/app/api/tenants/route.ts` to exclude staff rosters for unauthenticated requests.
  - [ ] Require authenticated session to query staff user lists.

- [ ] **Task 13.2.7: Scope Shift Reconciliation to Explicit `shift_id`** (`MF-SHFT-001`)
  - [ ] Add `shift_id UUID REFERENCES shifts(id)` column to `purchases` table migration.
  - [ ] Update `src/app/api/purchases/route.ts` to assign active `shift_id` on cash purchase entries.
  - [ ] Update `src/app/api/shifts/route.ts` to query shift cash purchases by `shift_id` instead of timestamp filter.

- [ ] **Task 13.2.8: Cursor Pagination for Invoices & Financial Ledgers** (`MF-PERF-001`)
  - [ ] Implement keyset cursor pagination (`created_at`, `id`) in `src/app/api/invoices/route.ts` and `src/app/api/clients/route.ts`.
  - [ ] Update frontend tables to consume paginated responses with `next_cursor`.

- [ ] **Task 13.2.9: Consolidate N+1 KPI Fetching in CEO Executive Suite** (`MF-PERF-002`)
  - [ ] Refactor `src/app/api/ceo/executive-suite/route.ts` to replace per-branch loop queries with single aggregated SQL group-by query.

- [ ] **Task 13.2.10: Dynamic Splitting for Monolithic POS & Inventory Bundles** (`MF-PERF-003`)
  - [ ] Split `PosBilling.tsx` and `StockInventory.tsx` using `next/dynamic` for heavy sub-modals (Day Close, Thermal Settings, Barcode Generator).

- [ ] **Task 13.2.11: Standardize Gross vs Net Sales and Tax/Discount Formulas** (`MF-FIN-002`, `MF-FIN-003`)
  - [ ] Unify sales calculations across `ShiftDrawer.tsx`, `DayClose.tsx`, and `FinancialLedgers.tsx`.
  - [ ] Enforce consistent delivery charge and invoice-level discount math.

- [ ] **Task 13.2.12: Sanitize PostgREST Search Wildcards** (`MF-SEC-004`)
  - [ ] Escape wildcards (`%`, `_`, `,`) in `src/app/api/invoices/route.ts` and `src/app/api/tenants/route.ts`.

- [ ] **Task 13.2.13: Fix POS Sales Return Line Total Math & Event Listener Leak** (`MF-UI-001`, `MF-UI-002`)
  - [ ] Fix return item line total sign in `src/components/PosBilling.tsx`.
  - [ ] Add listener cleanup return in `useEffect` for keyboard shortcuts in `src/components/PosBilling.tsx`.

- [ ] **Task 13.2.14: Atomic Inter-Branch Stock Transfer RPC (`transfer_stock_atomic`)** (`MF-ATOM-003`)
  - [ ] Create `transfer_stock_atomic` stored procedure in Supabase for dispatch and receive operations.
  - [ ] Refactor `src/app/api/branch-orders/route.ts` to call `transfer_stock_atomic`.

---

## WAVE 3: CONCURRENCY, AI QUOTAS & DATABASE INTEGRITY (P3 - MEDIUM PRIORITY)

- [ ] **Task 13.3.1: Atomic Voucher Creation RPC (`create_voucher_atomic`)** (`MF-ATOM-004`)
  - [ ] Wrap voucher insertion and token mark-used in `create_voucher_atomic` PL/pgSQL function.
  - [ ] Refactor `src/app/api/vouchers/route.ts` to invoke atomic RPC.

- [ ] **Task 13.3.2: Atomic Token Vendor Settlement RPC (`settle_vendor_atomic`)** (`MF-ATOM-005`)
  - [ ] Implement `settle_vendor_atomic` stored function for batch token status updates.
  - [ ] Refactor `src/app/api/tokens/route.ts` (`action=settle_vendor`) to invoke atomic RPC.

- [ ] **Task 13.3.3: Server-Side Session Revocation Mechanism** (`MF-AUTH-004`)
  - [ ] Create `revoked_sessions` table in Supabase.
  - [ ] Add session revocation check in `src/lib/session.ts` and populate table on `POST /api/auth/logout`.

- [ ] **Task 13.3.4: Persistent Supabase-Backed AI Quota Ledger** (`MF-AI-001`)
  - [ ] Refactor `src/lib/ai-gateway.ts` to strictly persist AI quota usage in `ai_usage_ledger` table; fail closed rather than in-memory fallback on quota failure.

- [ ] **Task 13.3.5: Strict Environment Assertion for Supabase Service Role Key** (`MF-SEC-005`)
  - [ ] Throw fatal startup exception in `src/lib/supabase.ts` if `SUPABASE_SERVICE_ROLE_KEY` is missing or placeholder.

- [ ] **Task 13.3.6: Purge Unused `pg` Dependency** (`MF-DEP-001`)
  - [ ] Remove `pg` and `@types/pg` from `package.json` and run clean build.

- [ ] **Task 13.3.7: Implement Frontend Invoice Cancellation Workflow** (`MF-UI-003`)
  - [ ] Add "Cancel Invoice" button and supervisor PIN modal in `src/components/SalesHistory.tsx` connected to `POST /api/invoices/cancel`.

- [ ] **Task 13.3.8: Negative Stock Floor Constraint in `adjust_item_stock` RPC** (`MF-DB-001`)
  - [ ] Update `adjust_item_stock` stored function in Supabase migration to enforce `CHECK (stock >= 0)` by default.

- [ ] **Task 13.3.9: Extend Iframe Thermal Printer Cleanup Safety Timeout** (`MF-PRINT-001`)
  - [ ] Extend cleanup safety timer from 3s to 30s in `src/utils/iframePrint.ts` and listen for `afterprint`.

- [ ] **Task 13.3.10: Optimize Catalog Item Category Enrichment** (`MF-PERF-004`)
  - [ ] Build `categoryMap = new Map()` before render pass in `src/components/StockInventory.tsx`.

- [ ] **Task 13.3.11: Strict Auth Fallbacks in Items & Held Invoices** (`MF-DEF-001`)
  - [ ] Replace permissive auth fallbacks with explicit HTTP 401 returns in `src/app/api/held-invoices/route.ts` and `src/app/api/items/route.ts`.

- [ ] **Task 13.3.12: Mandatory Positive Cost Price Validation** (`MF-INV-001`)
  - [ ] Add client and server validation enforcing `cost_price > 0` in `src/components/StockInventory.tsx` and `src/app/api/items/route.ts`.

- [ ] **Task 13.3.13: Cart State Key Uniqueness & Handover Concurrency Controls** (`MF-POS-001`, `MF-POS-002`, `MF-POS-003`)
  - [ ] Generate unique UUIDs for cart item keys in `src/components/PosBilling.tsx`.
  - [ ] Dynamically update tender balance on cart modifications.
  - [ ] Enforce database constraint preventing multiple concurrent active shifts for the same register.

---

## WAVE 4: THERMAL PRINTING, UI POLISH & LEGACY CLEANUP (P4 - MAINTENANCE & POLISH)

- [ ] **Task 13.4.1: Modernize HTTP Security Headers & Remove Deprecated Directives** (`MF-SEC-006`, `MF-SEC-007`)
  - [ ] Add Content-Security-Policy and Permissions-Policy in `next.config.ts`.
  - [ ] Remove deprecated `X-XSS-Protection` header.

- [ ] **Task 13.4.2: High-Entropy Identifier Generation (Anti-Collision)** (`MF-COLL-001`)
  - [ ] Replace 4-digit random numbers with `nanoid(8)` or DB sequence in `src/app/api/vouchers/route.ts` and `src/components/PosBilling.tsx`.

- [ ] **Task 13.4.3: Dynamic Canvas Width Scaling for 58mm Thermal Printers** (`MF-PRINT-002`)
  - [ ] Pass `paperWidth` parameter (576px / 384px) to `src/utils/receiptCanvas.ts` and scale font sizes dynamically.

- [ ] **Task 13.4.4: Atomic Default Receipt Template Toggle** (`MF-PRINT-003`)
  - [ ] Wrap default receipt template toggle in single atomic SQL update query in `src/app/api/receipt-templates/route.ts`.

- [ ] **Task 13.4.5: Walk-In Token Retention Claim Code Slip** (`MF-E2E-001`)
  - [ ] Generate claim serial code and render token claim block on POS thermal receipt for walk-in token retentions in `src/components/PosBilling.tsx`.

- [ ] **Task 13.4.6: Optional Inventory Reservation for Held Invoices** (`MF-E2E-002`)
  - [ ] Add optional `reserve_stock` boolean flag with 2-hour TTL expiration in `src/app/api/held-invoices/route.ts`.

- [ ] **Task 13.4.7: Supervisor Amount Guard for Petty Expenses** (`MF-E2E-003`)
  - [ ] Require supervisor PIN authorization for petty expenses exceeding threshold in `src/app/api/petty-expenses/route.ts` and `src/components/ShiftDrawer.tsx`.

- [ ] **Task 13.4.8: Clean Up Dev Script & Dead Boilerplate Routes** (`MF-DEP-002`, `MF-LEG-001`)
  - [ ] Remove deprecated `--webpack` parameter from `package.json`.
  - [ ] Delete dead boilerplate route handler `src/app/api/route.ts`.

- [ ] **Task 13.4.9: Unify TypeScript Interface Definitions & Migration Archive** (`MF-ARCH-002`, `MF-DB-002`)
  - [ ] Consolidate duplicated TypeScript interfaces between `src/types/index.ts` and `src/types/ceo.ts`.
  - [ ] Archive unversioned legacy SQL files into `supabase/migrations/legacy/`.

---

## 5. Summary of Zero Implementation Changes

`ZERO IMPLEMENTATION CHANGES PERFORMED — AUDIT ONLY`  
This task list documents all actionable remediation items in 1:1 parity with the Final Authoritative Findings Register. No implementation code or migrations were created or modified during Phase 13.
