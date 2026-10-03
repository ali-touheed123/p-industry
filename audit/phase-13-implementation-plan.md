# PHASE 13 IMPLEMENTATION PLAN — MASTER CROSS-MODULE REMEDIATION ROADMAP

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 13 — Final Cross-Module Reconciliation Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO IMPLEMENTATION CHANGES  

---

## 1. Executive Summary & Remediation Strategy

This Master Cross-Module Implementation Plan establishes the authoritative remediation roadmap derived from the Phase 13 Final Reconciliation. All 47 surviving verified findings are mapped into 4 sequential execution waves ordered strictly by technical dependency, systemic risk, and security severity.

Remediation must proceed wave-by-wave. No downstream wave may begin until the preceding wave has passed full unit, integration, and security verification.

> [!IMPORTANT]
> **AUDIT-ONLY GOVERNANCE:** This document is an architectural blueprint. Absolutely no code, database migrations, package dependencies, or configuration changes may be applied during the audit phase.

---

## 2. Master Execution Waves Overview

- **WAVE 1: Critical Security, IDOR & Transaction Isolation (P1 — Immediate Gate)**  
  Targets the 4 CRITICAL vulnerabilities that threaten multi-tenant isolation, core financial ledgers, and authentication integrity.
- **WAVE 2: High Operational & Financial Integrity (P2 — High Priority)**  
  Resolves the 16 HIGH severity defects across perimeter edge defense, purchase shift bleed, invoice edit atomicity, and performance fan-outs.
- **WAVE 3: Concurrency, AI Quotas & Database Integrity (P3 — Medium Priority)**  
  Addresses the 15 MEDIUM severity findings regarding session invalidation, AI gateway persistence, secondary RPC atomicity, and UI workflow gaps.
- **WAVE 4: Thermal Printing, UI Polish & Legacy Cleanup (P4 — Maintenance & Polish)**  
  Finalizes the 12 LOW severity items including slip canvas layout scaling, identifier collision resistance, dead code removal, and header modernization.

---

## 3. Wave 1: Critical Security, IDOR & Transaction Isolation (P1)

### Task 13.1.1: Record Ownership Filter Enforcement for Client & Supplier IDOR
- **Final Finding ID:** `MF-AUTH-001`
- **Original Finding IDs:** `SEC-009`, `FINDING-AUTH-001`, `FINDING-API-001`, `MF-002`
- **Exact Location:** `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`
- **Root Cause:** Route handlers authenticate caller tenant, but execute update queries on target ID without `.eq('tenant_id', tenantId)`, permitting cross-tenant record tampering.
- **Proposed Remediation:** Append `.eq('tenant_id', auth.tenantId)` to all `PATCH` and `DELETE` queries in both endpoints.
- **Dependencies:** None.
- **Verification Criteria:** Issue `PATCH /api/clients` with valid Tenant A session targeting Tenant B `client_id`; verify HTTP 404/403 and zero database row mutation.
- **Rollback Considerations:** Pure query filter addition; easily reverted via git commit rollback.

### Task 13.1.2: Atomic Supplier Purchase Order RPC (`create_purchase_atomic`)
- **Final Finding ID:** `MF-ATOM-001`
- **Original Finding IDs:** `MF-001`, `FINDING-API-005`, `FINDING-PROC-001`, `FINDING-E2E-001`
- **Exact Location:** `supabase/migrations/`, `src/app/api/purchases/route.ts`
- **Root Cause:** Sequential JavaScript calls handle purchase header insert, item inserts, stock increments, supplier balance update, and token retention mark-used.
- **Proposed Remediation:** Author a PostgreSQL PL/pgSQL function `create_purchase_atomic(p_purchase_data, p_items, p_token_ids)` executing all operations within a single transaction with automatic rollback on exception. Update `src/app/api/purchases/route.ts` to call this RPC.
- **Dependencies:** Database migration.
- **Verification Criteria:** Simulate mid-flight database error during purchase creation; confirm zero orphaned records, zero partial stock increases, and untouched token statuses.
- **Rollback Considerations:** Retain legacy route logic behind feature flag until migration is verified.

### Task 13.1.3: Distributed Rate Limiting & Cold-Start Persistence
- **Final Finding ID:** `MF-SEC-001`
- **Original Finding IDs:** `SEC-003`, `FINDING-API-017`
- **Exact Location:** `src/lib/rate-limit.ts`
- **Root Cause:** In-memory `Map` resets on serverless cold starts, permitting brute-force credential stuffing.
- **Proposed Remediation:** Migrate rate limiter to Upstash Redis or Supabase PostgreSQL unlogged rate-limit table with TTL index.
- **Dependencies:** Upstash Redis credentials or Supabase rate-limit table migration.
- **Verification Criteria:** Trigger serverless cold start; verify rate-limit counter retains count and blocks requests exceeding threshold.
- **Rollback Considerations:** Retain in-memory fallback if external rate limit store is unreachable.

### Task 13.1.4: Harmonize Core Cash Reconciliation & Movement Formulas
- **Final Finding ID:** `MF-FIN-001`
- **Original Finding IDs:** `FINDING-REP-001`
- **Exact Location:** `src/app/api/shifts/route.ts`, `src/components/ShiftDrawer.tsx`, `src/components/FinancialLedgers.tsx`
- **Root Cause:** Cash returns, petty expenses, and supplier cash payments are double-subtracted or handled asymmetrically between drawer and ledgers.
- **Proposed Remediation:** Establish single mathematical specification for Expected Cash: `Opening Cash + Cash Sales - Cash Returns - Petty Expenses - Supplier Cash Payouts - Token Cash Payouts`. Centralize calculation into shared utility `src/utils/cashReconciliation.ts`.
- **Dependencies:** None.
- **Verification Criteria:** Execute complete shift with split sales, return, petty expense, and supplier payout; verify drawer expected cash matches financial ledger to the exact cent.
- **Rollback Considerations:** Revert utility import in UI components.

---

## 4. Wave 2: High Operational & Financial Integrity (P2)

### Task 13.2.1: Enforce Tenant Scope on Inventory Item Mutations
- **Final Finding ID:** `MF-AUTH-002`
- **Original Finding IDs:** `FINDING-AUTH-002`, `FINDING-API-002`, `FINDING-INV-001`
- **Exact Location:** `src/app/api/items/route.ts`
- **Root Cause:** `PATCH /api/items` updates records by `id` without verifying `tenant_id`.
- **Proposed Remediation:** Add `.eq('tenant_id', auth.tenantId)` filter to all `PATCH` and `DELETE` item operations.
- **Dependencies:** None.
- **Verification Criteria:** Attempt modifying item of another tenant; verify operation fails with HTTP 404/403.
- **Rollback Considerations:** Standard route query rollback.

### Task 13.2.2: Strict Authentication & Scoping on Branch Orders
- **Final Finding ID:** `MF-AUTH-003`
- **Original Finding IDs:** `SEC-006`, `FINDING-API-003`, `FINDING-E2E-008`
- **Exact Location:** `src/app/api/branch-orders/route.ts`
- **Root Cause:** Branch orders fetched from DB before tenant authentication check; defensive null auth fallback present.
- **Proposed Remediation:** Relocate `requireTenantAuth` check to top of handler; eliminate null auth fallback.
- **Dependencies:** None.
- **Verification Criteria:** Invoke endpoint without valid bearer token; ensure instant 401 without database query execution.
- **Rollback Considerations:** Standard handler rollback.

### Task 13.2.3: Atomic Invoice Modification RPC (`edit_invoice_atomic`)
- **Final Finding ID:** `MF-ATOM-002`
- **Original Finding IDs:** `SEC-008`, `FINDING-API-004`, `FINDING-E2E-004`
- **Exact Location:** `supabase/migrations/`, `src/app/api/invoices/route.ts`
- **Root Cause:** Multi-step stock revert and re-deduction loops executed in Node.js runtime.
- **Proposed Remediation:** Create `edit_invoice_atomic` PL/pgSQL function to reverse prior line items, deduct new line items, and adjust customer balance in a single database transaction.
- **Dependencies:** Database migration.
- **Verification Criteria:** Simulate mid-edit failure; verify stock levels and customer balances remain at original values.
- **Rollback Considerations:** Retain prior handler as fallback.

### Task 13.2.4: Centralized Edge Route Perimeter Middleware
- **Final Finding ID:** `MF-ARCH-001`
- **Original Finding IDs:** `SEC-001`, `FINDING-ARCH-001`
- **Exact Location:** `src/middleware.ts` (New file)
- **Root Cause:** Missing Next.js Edge Middleware allows unauthenticated requests to reach API route handlers before rejection.
- **Proposed Remediation:** Implement `src/middleware.ts` validating session cookies/JWT on protected paths (`/api/*`, `/[slug]/*`) while whitelisting public login routes.
- **Dependencies:** Next.js Edge runtime compatibility.
- **Verification Criteria:** Request protected route without session cookie; verify Edge layer returns 401/302 before hitting route handlers.
- **Rollback Considerations:** Delete or disable middleware file.

### Task 13.2.5: Purge Hardcoded Developer PIN (`dev2026`)
- **Final Finding ID:** `MF-SEC-002`
- **Original Finding IDs:** `SEC-004`, `FINDING-ARCH-002`, `FINDING-ARCH-003`
- **Exact Location:** `src/lib/auth-passwords.ts:25-27`, `src/app/api/auth/dev-pin/route.ts`
- **Root Cause:** Fallback to static string `dev2026` in code.
- **Proposed Remediation:** Require `DEV_MASTER_PIN` in environment variables; disable developer PIN route entirely when `NODE_ENV === 'production'`.
- **Dependencies:** Environment configuration.
- **Verification Criteria:** Send `dev2026` in production mode; verify immediate 403 Forbidden.
- **Rollback Considerations:** Environment variable adjustment.

### Task 13.2.6: Redact Staff Records from Unauthenticated Tenant Slug Route
- **Final Finding ID:** `MF-SEC-003`
- **Original Finding IDs:** `SEC-005`, `FINDING-API-009`
- **Exact Location:** `src/app/api/tenants/route.ts`
- **Root Cause:** Public `GET ?slug=` query returns full tenant record including staff UUIDs and names.
- **Proposed Remediation:** Restrict public response to `id`, `name`, `slug`, `branding`, and `active_status`; require authenticated session for staff list.
- **Dependencies:** Verify frontend login screen only consumes whitelisted tenant branding fields.
- **Verification Criteria:** Query `GET /api/tenants?slug=demo`; verify staff list is omitted or requires bearer token.
- **Rollback Considerations:** Standard route handler rollback.

### Task 13.2.7: Scope Shift Reconciliation to Explicit `shift_id`
- **Final Finding ID:** `MF-SHFT-001`
- **Original Finding IDs:** `FINDING-REP-004`, `FINDING-E2E-002`, `MF-005`
- **Exact Location:** `supabase/migrations/`, `src/app/api/purchases/route.ts`, `src/app/api/shifts/route.ts`
- **Root Cause:** Purchases table lacks `shift_id`; shift drawer queries purchases by timestamp `.gte('created_at', startTime)`, leaking late-night purchases across shifts.
- **Proposed Remediation:** Add `shift_id UUID REFERENCES shifts(id)` to `purchases` table. Pass `shift_id` on purchase creation. Query shift cash deductions by `shift_id`.
- **Dependencies:** Database migration.
- **Verification Criteria:** Create cash purchase backdated or during an overlapping shift; verify it is attributed exclusively to the assigned `shift_id`.
- **Rollback Considerations:** Allow nullable `shift_id` during transition.

### Task 13.2.8: Cursor Pagination for Invoices & Financial Ledgers
- **Final Finding ID:** `MF-PERF-001`
- **Original Finding IDs:** `PERF-001`, `FINDING-REP-007`, `FINDING-API-016`
- **Exact Location:** `src/app/api/invoices/route.ts`, `src/app/api/clients/route.ts`
- **Root Cause:** Default 500-1000 record limits without pagination causes high memory usage and latency.
- **Proposed Remediation:** Implement keyset cursor pagination (`created_at`, `id`) with max page size of 100 records.
- **Dependencies:** Update frontend infinite scrolling / paginated table components.
- **Verification Criteria:** Load ledger with 5,000 records; verify API returns exactly page size with `next_cursor`.
- **Rollback Considerations:** Standard query parameter adjustment.

### Task 13.2.9: Consolidate N+1 KPI Fetching in CEO Executive Suite
- **Final Finding ID:** `MF-PERF-002`
- **Original Finding IDs:** `PERF-002`
- **Exact Location:** `src/app/api/ceo/executive-suite/route.ts`
- **Root Cause:** Sequentially fires database queries per branch inside loop.
- **Proposed Remediation:** Replace loop with single aggregated SQL query grouping metrics by `branch_id`.
- **Dependencies:** None.
- **Verification Criteria:** Compare response time and DB query count on tenant with 10 branches; confirm 1 query instead of 10.
- **Rollback Considerations:** Standard query refactor rollback.

### Task 13.2.10: Dynamic Splitting for Monolithic POS & Inventory Bundles
- **Final Finding ID:** `MF-PERF-003`
- **Original Finding IDs:** `PERF-003`
- **Exact Location:** `src/app/[slug]/page.tsx`, `src/components/PosBilling.tsx`, `src/components/StockInventory.tsx`
- **Root Cause:** Heavy client components (2000+ lines) loaded statically on initial page load.
- **Proposed Remediation:** Implement `next/dynamic` with SSR disabled for modals and secondary views (Day Close, Thermal Settings, Barcode Generator).
- **Dependencies:** None.
- **Verification Criteria:** Verify initial bundle size reduction in Next.js build stats.
- **Rollback Considerations:** Revert dynamic imports to static imports.

### Task 13.2.11: Standardize Gross vs Net Sales and Tax/Discount Formulas
- **Final Finding IDs:** `MF-FIN-002`, `MF-FIN-003`
- **Original Finding IDs:** `FINDING-REP-002`, `FINDING-REP-003`, `FINDING-REP-005`
- **Exact Location:** `src/components/ShiftDrawer.tsx`, `src/components/DayClose.tsx`, `src/components/FinancialLedgers.tsx`
- **Root Cause:** Divergent mathematical definitions of Gross Sales and inconsistent treatment of delivery charges.
- **Proposed Remediation:** Define enterprise accounting standard:  
  - `Gross Sales = Sum(Item Line Totals before invoice-level discount)`  
  - `Net Sales = Gross Sales - Invoice Discounts + Delivery Charges`  
  - Ensure all reports, drawers, and dashboards consume these shared formulas.
- **Dependencies:** None.
- **Verification Criteria:** Compare totals across Sales History, Shift Drawer, and Day Close; ensure exact mathematical parity.
- **Rollback Considerations:** Component math revert.

### Task 13.2.12: Sanitize PostgREST Search Wildcards
- **Final Finding ID:** `MF-SEC-004`
- **Original Finding IDs:** `SEC-007`, `FINDING-API-007`, `FINDING-API-008`
- **Exact Location:** `src/app/api/invoices/route.ts`, `src/app/api/tenants/route.ts`
- **Root Cause:** Raw user input interpolated into PostgREST `ilike.%${search}%` filter.
- **Proposed Remediation:** Sanitize user input by escaping `%`, `_`, and commas prior to query generation.
- **Dependencies:** Sanitization utility.
- **Verification Criteria:** Pass search query containing `%` and commas; verify query executes as literal search without filter syntax errors.
- **Rollback Considerations:** Utility removal.

### Task 13.2.13: Fix POS Sales Return Line Total Math & Event Listener Leak
- **Final Finding IDs:** `MF-UI-001`, `MF-UI-002`
- **Original Finding IDs:** `FINDING-POS-001`, `FINDING-POS-002`
- **Exact Location:** `src/components/PosBilling.tsx`
- **Root Cause:** Return quantity calculation produces inverted line total; window keyboard shortcut listener missing cleanup return in `useEffect`.
- **Proposed Remediation:** Correct sign handling in cart line total calculation; return `() => window.removeEventListener(...)` in `useEffect`.
- **Dependencies:** None.
- **Verification Criteria:** Add return item to cart, verify total deductions; navigate away and inspect attached window listeners in Chrome DevTools.
- **Rollback Considerations:** Component revert.

### Task 13.2.14: Atomic Inter-Branch Stock Transfer RPC (`transfer_stock_atomic`)
- **Final Finding ID:** `MF-ATOM-003`
- **Original Finding IDs:** `SEC-016`, `FINDING-API-006`, `FINDING-E2E-009`
- **Exact Location:** `supabase/migrations/`, `src/app/api/branch-orders/route.ts`
- **Root Cause:** Dispatch and Receive iterate through items without database transaction wrapping.
- **Proposed Remediation:** Implement `transfer_stock_atomic(p_order_id, p_action)` executing dispatch/receive and inventory movements in a single transaction.
- **Dependencies:** Database migration.
- **Verification Criteria:** Simulate network failure during 10-item transfer dispatch; verify neither source nor destination stock changes partially.
- **Rollback Considerations:** Retain legacy sequential handlers.

---

## 5. Wave 3: Concurrency, AI Quotas & Database Integrity (P3)

### Task 13.3.1: Atomic Voucher Creation RPC (`create_voucher_atomic`)
- **Final Finding ID:** `MF-ATOM-004`
- **Original Finding IDs:** `SEC-012`, `FINDING-LEDG-001`, `FINDING-E2E-006`
- **Exact Location:** `supabase/migrations/`, `src/app/api/vouchers/route.ts`
- **Root Cause:** Token validation, voucher insertion, and token marking run sequentially.
- **Proposed Remediation:** Wrap voucher creation and token status updates in `create_voucher_atomic` PL/pgSQL RPC.
- **Dependencies:** Database migration.
- **Verification Criteria:** Attempt duplicate voucher creation on same token concurrently; confirm only one succeeds with 409 Conflict.
- **Rollback Considerations:** Route rollback.

### Task 13.3.2: Atomic Token Vendor Settlement RPC (`settle_vendor_atomic`)
- **Final Finding ID:** `MF-ATOM-005`
- **Original Finding IDs:** `FINDING-E2E-010`
- **Exact Location:** `supabase/migrations/`, `src/app/api/tokens/route.ts`
- **Root Cause:** Vendor settlement processes batch updates in iterative loop.
- **Proposed Remediation:** Implement `settle_vendor_atomic(p_tenant_id, p_vendor_id, p_token_ids)` executing batch status updates inside single transaction.
- **Dependencies:** Database migration.
- **Verification Criteria:** Process 100 tokens with 1 invalid ID; ensure entire batch rolls back cleanly.
- **Rollback Considerations:** Route rollback.

### Task 13.3.3: Server-Side Session Revocation Mechanism
- **Final Finding ID:** `MF-AUTH-004`
- **Original Finding IDs:** `SEC-010`, `FINDING-AUTH-003`
- **Exact Location:** `supabase/migrations/`, `src/lib/session.ts`, `src/app/api/auth/logout/route.ts`
- **Root Cause:** 7-day stateless JWT cannot be revoked on logout.
- **Proposed Remediation:** Maintain `revoked_sessions` or `session_nonces` table in Supabase; check session validity during auth validation.
- **Dependencies:** Database migration.
- **Verification Criteria:** Logout from device; attempt using previous JWT; verify request is rejected with 401 Unauthorized.
- **Rollback Considerations:** Feature flag bypass.

### Task 13.3.4: Persistent Supabase-Backed AI Quota Ledger
- **Final Finding ID:** `MF-AI-001`
- **Original Finding IDs:** `SEC-011`, `FINDING-PERF-004`, `FINDING-DB-004`
- **Exact Location:** `src/lib/ai-gateway.ts`
- **Root Cause:** In-memory fallback allows quota bypass on serverless cold starts.
- **Proposed Remediation:** Ensure all AI token tracking strictly persists to `ai_usage_ledger` in Supabase; fail closed rather than in-memory fallback if quota tracking fails.
- **Dependencies:** Verify Supabase connection reliability.
- **Verification Criteria:** Simulate serverless restart; verify AI quota limit remains enforced.
- **Rollback Considerations:** Gateway config revert.

### Task 13.3.5: Strict Environment Assertion for Supabase Service Role Key
- **Final Finding ID:** `MF-SEC-005`
- **Original Finding IDs:** `SEC-014`
- **Exact Location:** `src/lib/supabase.ts`
- **Root Cause:** Falls back to placeholder dummy string if environment variable is missing.
- **Proposed Remediation:** Throw an explicit, fatal startup exception if `SUPABASE_SERVICE_ROLE_KEY` is undefined or placeholder.
- **Dependencies:** Environment verification.
- **Verification Criteria:** Start app without env variable; verify app fails fast with clear error message.
- **Rollback Considerations:** Code revert.

### Task 13.3.6: Purge Unused `pg` Dependency
- **Final Finding ID:** `MF-DEP-001`
- **Original Finding IDs:** `FINDING-DEP-001`
- **Exact Location:** `package.json`, `package-lock.json`
- **Root Cause:** `pg` package installed during unauthorized previous audit session; unreferenced in application.
- **Proposed Remediation:** Run `npm uninstall pg @types/pg`.
- **Dependencies:** None.
- **Verification Criteria:** Ensure project builds and tests pass cleanly without `pg`.
- **Rollback Considerations:** `npm install pg`.

### Task 13.3.7: Implement Frontend Invoice Cancellation Workflow
- **Final Finding ID:** `MF-UI-003`
- **Original Finding IDs:** `FINDING-REP-006`
- **Exact Location:** `src/components/SalesHistory.tsx`
- **Root Cause:** Backend cancellation API exists, but UI has no trigger button.
- **Proposed Remediation:** Add "Cancel Invoice" button in `SalesHistory.tsx` with supervisor PIN modal calling `POST /api/invoices/cancel`.
- **Dependencies:** Verified backend RPC `cancel_invoice_atomic`.
- **Verification Criteria:** Cancel invoice from UI; verify inventory restored, balance reversed, and status set to 'cancelled'.
- **Rollback Considerations:** Remove UI button.

### Task 13.3.8: Negative Stock Floor Constraint in `adjust_item_stock` RPC
- **Final Finding ID:** `MF-DB-001`
- **Original Finding IDs:** `FINDING-DB-002`
- **Exact Location:** `supabase/migrations/`
- **Root Cause:** `adjust_item_stock` RPC permits negative stock levels.
- **Proposed Remediation:** Add optional `p_allow_negative BOOLEAN DEFAULT false` parameter and enforce `CHECK (stock >= 0)` when false.
- **Dependencies:** Database migration.
- **Verification Criteria:** Attempt stock adjustment exceeding available inventory; confirm exception raised.
- **Rollback Considerations:** Update RPC default to true if needed.

### Task 13.3.9: Extend Iframe Thermal Printer Cleanup Safety Timeout
- **Final Finding ID:** `MF-PRINT-001`
- **Original Finding IDs:** `PERF-006`, `FINDING-PRINT-003`, `MF-007`
- **Exact Location:** `src/utils/iframePrint.ts`
- **Root Cause:** 3-second cleanup timer removes print iframe before slow browser dialog completes.
- **Proposed Remediation:** Extend cleanup safety timer to 30 seconds; listen for `afterprint` event on window.
- **Dependencies:** None.
- **Verification Criteria:** Hold browser print dialog open for 15 seconds; confirm print completes normally without iframe detachment error.
- **Rollback Considerations:** Revert timeout value.

### Task 13.3.10: Optimize Catalog Item Category Enrichment
- **Final Finding ID:** `MF-PERF-004`
- **Original Finding IDs:** `FINDING-PERF-005`
- **Exact Location:** `src/components/StockInventory.tsx`
- **Root Cause:** Nested loops over items and categories in rendering cycle.
- **Proposed Remediation:** Build `categoryMap = new Map()` before render pass to achieve O(1) category lookups.
- **Dependencies:** None.
- **Verification Criteria:** Measure render time on catalog with 2,000 items; verify 0 lag.
- **Rollback Considerations:** Component revert.

### Task 13.3.11: Strict Auth Fallbacks in Items & Held Invoices
- **Final Finding ID:** `MF-DEF-001`
- **Original Finding IDs:** `FINDING-API-010`, `FINDING-API-011`
- **Exact Location:** `src/app/api/held-invoices/route.ts`, `src/app/api/items/route.ts`
- **Root Cause:** Defensive programming returns default/empty tenant strings on undefined auth context.
- **Proposed Remediation:** Eliminate permissive fallbacks; throw explicit 401 Unauthorized when auth context is undefined.
- **Dependencies:** None.
- **Verification Criteria:** Transmit request with malformed auth context; verify explicit 401.
- **Rollback Considerations:** Handler revert.

### Task 13.3.12: Mandatory Positive Cost Price Validation
- **Final Finding ID:** `MF-INV-001`
- **Original Finding IDs:** `FINDING-INV-003`
- **Exact Location:** `src/components/StockInventory.tsx`, `src/app/api/items/route.ts`
- **Root Cause:** Allows zero cost price fallback during item creation.
- **Proposed Remediation:** Enforce validation requiring `cost_price > 0` before saving inventory item.
- **Dependencies:** None.
- **Verification Criteria:** Attempt creating item with 0 or negative cost; confirm client and server validation error.
- **Rollback Considerations:** Revert validation rule.

### Task 13.3.13: Cart State Key Uniqueness & Handover Concurrency Controls
- **Final Finding IDs:** `MF-POS-001`, `MF-POS-002`, `MF-POS-003`
- **Original Finding IDs:** `FINDING-POS-003`, `FINDING-POS-004`, `FINDING-POS-005`
- **Exact Location:** `src/components/PosBilling.tsx`, `src/app/[slug]/page.tsx`
- **Root Cause:** React key collisions on custom units; stale tender override; shift opening race condition.
- **Proposed Remediation:** Generate unique line UUIDs for cart keys; dynamically recalculate tender balance when cart modifies; enforce single-active-shift DB constraint.
- **Dependencies:** Database constraint on active shifts.
- **Verification Criteria:** Add duplicate item with custom unit; verify no React key warnings; open two cashier sessions simultaneously; confirm second session receives active shift warning.
- **Rollback Considerations:** Component revert.

---

## 6. Wave 4: Thermal Printing, UI Polish & Legacy Cleanup (P4)

### Task 13.4.1: Modernize HTTP Security Headers & Remove Deprecated Directives
- **Final Finding IDs:** `MF-SEC-006`, `MF-SEC-007`
- **Original Finding IDs:** `SEC-002`, `SEC-013`, `SEC-015`, `FINDING-ARCH-005`
- **Exact Location:** `next.config.ts`
- **Root Cause:** Missing Content-Security-Policy; deprecated `X-XSS-Protection` header used.
- **Proposed Remediation:** Implement modern CSP policy; remove `X-XSS-Protection`; add `Permissions-Policy`.
- **Dependencies:** Verify external CDN/fonts in CSP directives.
- **Verification Criteria:** Inspect network headers with `curl -I`; verify headers comply with modern security baselines.
- **Rollback Considerations:** `next.config.ts` revert.

### Task 13.4.2: High-Entropy Identifier Generation (Anti-Collision)
- **Final Finding ID:** `MF-COLL-001`
- **Original Finding IDs:** `SEC-017`, `FINDING-API-013`, `FINDING-PROC-003`, `FINDING-LEDG-002`
- **Exact Location:** `src/app/api/vouchers/route.ts`, `src/components/PosBilling.tsx`
- **Root Cause:** 4-digit random numbers (`Math.floor(1000 + Math.random() * 9000)`) risk collision.
- **Proposed Remediation:** Replace with `nanoid(8)` or PostgreSQL sequence-backed format (`VCH-2026-XXXX`).
- **Dependencies:** None.
- **Verification Criteria:** Generate 10,000 codes in test script; verify zero duplicate collisions.
- **Rollback Considerations:** Code revert.

### Task 13.4.3: Dynamic Canvas Width Scaling for 58mm Thermal Printers
- **Final Finding ID:** `MF-PRINT-002`
- **Original Finding IDs:** `PERF-007`, `FINDING-PRINT-002`, `MF-006`
- **Exact Location:** `src/utils/receiptCanvas.ts`
- **Root Cause:** Hardcoded 600px width causes text clipping on 58mm printer slips.
- **Proposed Remediation:** Pass `paperWidth` parameter (576px for 80mm, 384px for 58mm) and scale font sizes dynamically.
- **Dependencies:** None.
- **Verification Criteria:** Generate receipt preview on 58mm setting; verify zero line clipping.
- **Rollback Considerations:** Utility revert.

### Task 13.4.4: Atomic Default Receipt Template Toggle
- **Final Finding ID:** `MF-PRINT-003`
- **Original Finding IDs:** `LEG-002`, `FINDING-PRINT-001`, `MF-004`
- **Exact Location:** `src/app/api/receipt-templates/route.ts`
- **Root Cause:** Two-step un-isolated update resets existing default before setting new default.
- **Proposed Remediation:** Wrap default template toggle in single database update transaction.
- **Dependencies:** None.
- **Verification Criteria:** Toggle default template; verify system always retains exactly one default template.
- **Rollback Considerations:** Route revert.

### Task 13.4.5: Walk-In Token Retention Claim Code Slip
- **Final Finding ID:** `MF-E2E-001`
- **Original Finding IDs:** `FINDING-E2E-003`, `MF-008`
- **Exact Location:** `src/components/PosBilling.tsx`, `src/utils/receiptCanvas.ts`
- **Root Cause:** Walk-in customers retaining tokens receive no claim receipt.
- **Proposed Remediation:** Generate unique claim serial code and render dedicated token claim block on POS thermal receipt.
- **Dependencies:** None.
- **Verification Criteria:** Perform walk-in sale with retained tokens; verify receipt includes printed token claim voucher code.
- **Rollback Considerations:** Component revert.

### Task 13.4.6: Optional Inventory Reservation for Held Invoices
- **Final Finding ID:** `MF-E2E-002`
- **Original Finding IDs:** `FINDING-E2E-005`
- **Exact Location:** `src/app/api/held-invoices/route.ts`
- **Root Cause:** Held invoices do not reserve stock.
- **Proposed Remediation:** Add optional `reserve_stock` boolean flag to held invoice schema with automatic 2-hour TTL expiration.
- **Dependencies:** Database schema update.
- **Verification Criteria:** Hold cart with reserved stock flag; confirm available stock drops; verify stock restored on hold cancellation.
- **Rollback Considerations:** Route rollback.

### Task 13.4.7: Supervisor Amount Guard for Petty Expenses
- **Final Finding ID:** `MF-E2E-003`
- **Original Finding IDs:** `FINDING-E2E-007`
- **Exact Location:** `src/app/api/petty-expenses/route.ts`, `src/components/ShiftDrawer.tsx`
- **Root Cause:** Accepts arbitrary expense amounts without supervisor authorization.
- **Proposed Remediation:** Require supervisor PIN for petty expense amounts exceeding configurable threshold (e.g. 5,000 PKR).
- **Dependencies:** None.
- **Verification Criteria:** Enter expense above threshold; verify supervisor PIN modal triggers.
- **Rollback Considerations:** Component revert.

### Task 13.4.8: Clean Up Dev Script & Dead Boilerplate Routes
- **Final Finding IDs:** `MF-DEP-002`, `MF-LEG-001`
- **Original Finding IDs:** `FINDING-DEP-002`, `FINDING-LEG-001`
- **Exact Location:** `package.json`, `src/app/api/route.ts`
- **Root Cause:** Deprecated `--webpack` parameter; dead root API route.
- **Proposed Remediation:** Remove `--webpack` from `package.json`; delete dead boilerplate `src/app/api/route.ts`.
- **Dependencies:** None.
- **Verification Criteria:** Run `npm run dev`; confirm no deprecation warnings and API routes function normally.
- **Rollback Considerations:** Git restore.

### Task 13.4.9: Unify TypeScript Interface Definitions & Migration Archive
- **Final Finding IDs:** `MF-ARCH-002`, `MF-DB-002`
- **Original Finding IDs:** `FINDING-ARCH-004`, `FINDING-DB-003`
- **Exact Location:** `src/types/`, `supabase/migrations/`
- **Root Cause:** Dual type declarations (`index.ts` vs `ceo.ts`); unversioned legacy SQL files.
- **Proposed Remediation:** Consolidate shared interfaces into `src/types/schema.ts`; move unversioned migrations to `supabase/migrations/legacy/`.
- **Dependencies:** TypeScript type check pass.
- **Verification Criteria:** Run `npx tsc --noEmit`; verify zero compiler errors.
- **Rollback Considerations:** Git restore.

---

## 7. Refuted Finding Register (Do Not Implement)

| Finding ID | Original IDs | Reason Refuted / No Action |
|---|---|---|
| **MF-REFUTED-001** | `MF-003`, `FINDING-DB-001` | **CONTRADICTED BY CODEBASE:** Inspection of `src/app/api/token-redemptions/route.ts` line 114 proves `redeem_tokens_atomic` RPC is already actively utilized with full transaction encapsulation and row-level locking. No fix required. |

---

## 8. Summary of Zero Implementation Changes

`ZERO IMPLEMENTATION CHANGES PERFORMED — AUDIT ONLY`  
This implementation plan serves exclusively as an architectural remediation specification. No code, configuration, database records, or migrations were modified during this phase.
