# PyntFlow — Post-Audit Master Task Checklist

Track the sequential execution of all remediation tasks from [`implementation-plan.md`](file:///d:/bestow/p-industry/implementation-plan.md) and [`final-project-audit.md`](file:///d:/bestow/p-industry/final-project-audit.md).

---

## Task Progress Overview

- [x] **Phase 1: Critical Financial & Loading Fixes (P0)**
  - [x] **Task 1.1: Server-Side Shift Close Expenses Table Query Fix**
  - [x] **Task 1.2: Customer Advance Payments Zero-Clamp Fix in Vouchers**
  - [x] **Task 1.3: Fresh Cashier Login Inventory Loading Fix in POS Shell**

- [x] **Phase 2: Multi-Tenant Isolation & Session Hardening (P1)**
  - [x] **Task 2.1: Server-Side Tenancy Scoping in `GET /api/tenants`**
  - [x] **Task 2.2: Branch Deletion Foreign Key Cascade (`branch_orders`)**
  - [x] **Task 2.3: POS Server-Side Cookie Invalidation / Logout Route**

- [x] **Phase 3: Database & Concurrency Hardening (P2)**
  - [x] **Task 3.1: Clean Dead `ceo_tenants` Queries in User Management**
  - [x] **Task 3.2: Atomic Stock Adjustments in Invoice Edits (`PATCH /api/invoices`)**
  - [x] **Task 3.3: Atomic Stock Adjustments in Purchases (`POST /api/purchases`)**
  - [x] **Task 3.4: Atomic Stock Adjustments in Warehouse Receiving / GRN (`POST /api/items/receive`)**

- [x] **Phase 4: Financial Metric Accuracy & Performance Optimization (P3)**
  - [x] **Task 4.1: Delivery Charge Inclusion in Overview Net Sales**
  - [x] **Task 4.2: Lightweight Invoice Summary Mode for High-Volume Queries**
  - [x] **Task 4.3: Deprecate Legacy Secret Developer URL Directory**

- [x] **Phase 5: End-to-End Verification & Quality Assurance**
  - [x] **Task 5.1: Full TypeScript Compilation Check (`npx tsc --noEmit`)**
  - [x] **Task 5.2: Verification of All 11 Remediated Workflows**

- [ ] **Phase 6: Paint Token Management System**
  - [x] **Task 6.1: Database Schema & Migration for Paint Tokens**
  - [x] **Task 6.2: Brand, Series & Token Configuration Engine (APIs & UI)**
  - [x] **Task 6.3: Product Catalog & Bulk Product Entry Token Inheritance**
  - [x] **Task 6.4: Atomic POS Checkout & Invoice Edit Token Reversals**
  - [x] **Task 6.5: Multi-Line Customer Redemption Dialog & Cash Drawer Integration**
  - [x] **Task 6.6: Stockpile Aggregation, Brand Settlement & Write-Off**
  - [x] **Task 6.7: Comprehensive Test Execution & TypeScript Validation**

---

## Detailed Task Breakdown

### Phase 1: Critical Financial & Loading Fixes (P0)

- [x] **Task 1.1: Server-Side Shift Close Expenses Table Query Fix**
  - **Audit Ref:** Bug 1 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/shifts/route.ts` (lines 286–292)
  - **Required Changes:** Change `.from('expenses')` to `.from('petty_expenses')` so server recalculation of expected cash deducts real shift expenses.
  - **Database/API Impact:** Queries live `petty_expenses` table; fixes `shifts.expected_cash` and `difference` columns.
  - **Testing/Verification:** Close a shift with recorded petty expenses; verify `shifts.expected_cash` in Supabase accurately reflects deducted expenses.
  - **Potential Risks:** Low risk. Re-establishes math parity with client drawer.

- [x] **Task 1.2: Customer Advance Payments Zero-Clamp Fix in Vouchers**
  - **Audit Ref:** Bug 3 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/vouchers/route.ts` (lines 198–200)
  - **Required Changes:** Remove `Math.max(0, ...)` when updating client balance, allowing negative values to denote valid contractor advance credits.
  - **Database/API Impact:** `clients.current_balance` preserves advance credit without zero-clamping.
  - **Testing/Verification:** Post receipt voucher greater than client debt; verify negative balance persists and displays in customer ledger.
  - **Potential Risks:** Low risk. Matches invoice and purchase credit logic.

- [x] **Task 1.3: Fresh Cashier Login Inventory Loading Fix in POS Shell**
  - **Audit Ref:** Bug 2 (`final-project-audit.md`)
  - **Affected Files:** `src/app/[slug]/page.tsx` (lines 98–101, 130–158)
  - **Required Changes:** Trigger `await refreshItems()` inside `handleLogin()` immediately after user authentication, or bind item fetching to `currentUser` state.
  - **Database/API Impact:** Calls existing `GET /api/items?tenant_id=...` with newly established session cookie.
  - **Testing/Verification:** Open incognito window, navigate to branch slug, log in; verify product inventory populates immediately in POS without manual refresh.
  - **Potential Risks:** Very low risk. Resolves cold-start empty catalog.

---

### Phase 2: Multi-Tenant Isolation & Session Hardening (P1)

- [x] **Task 2.1: Server-Side Tenancy Scoping in `GET /api/tenants`**
  - **Audit Ref:** Issue 4 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/tenants/route.ts` (lines 41–73)
  - **Required Changes:** Enforce server-side filtering on `GET /api/tenants`: return all tenants only if caller is `developer`; return sister branches for `ceo`; return single branch for `staff`.
  - **Database/API Impact:** Eliminates cross-tenant data leak of all store names, emails, phones, and counter accounts over the wire.
  - **Testing/Verification:** Query `GET /api/tenants` using cashier token, CEO token, and developer token; verify payload is strictly scoped by role.
  - **Potential Risks:** Low risk. Ensure `CeoSuite.tsx` and `DevBranchesView.tsx` receive expected formats.

- [x] **Task 2.2: Branch Deletion Foreign Key Cascade (`branch_orders`)**
  - **Audit Ref:** Issue 5 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/tenants/route.ts` (lines 380–415)
  - **Required Changes:** In `DELETE /api/tenants`, delete `branch_order_items` and `branch_orders` referencing the tenant ID (as sender or receiver) prior to tenant deletion.
  - **Database/API Impact:** Prevents foreign key constraint violations on `branch_orders.to_tenant_id` and `from_tenant_id`.
  - **Testing/Verification:** Delete a test branch that has inter-branch order history in Dev Panel; verify deletion succeeds cleanly without DB constraint errors.
  - **Potential Risks:** Low risk. Restricted to Developer Super Admins.

- [x] **Task 2.3: POS Server-Side Cookie Invalidation / Logout Route**
  - **Audit Ref:** Issue 7 (`final-project-audit.md`)
  - **Affected Files:**
    - Create: `src/app/api/auth/logout/route.ts`
    - Update: `src/app/[slug]/page.tsx` (lines 415, 555), `src/components/CeoDashboard.tsx`
  - **Required Changes:** Create `POST /api/auth/logout` clearing `pyntflow_session` cookie; call it on POS/CEO logout before setting state to null.
  - **Database/API Impact:** Fully terminates server session on user logout.
  - **Testing/Verification:** Log out from POS; verify cookie is removed and subsequent API calls require re-authentication.
  - **Potential Risks:** Low risk. Standard session cleanup.

---

### Phase 3: Database & Concurrency Hardening (P2)

- [x] **Task 3.1: Clean Dead `ceo_tenants` Queries in User Management**
  - **Audit Ref:** Issue 6 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/users/route.ts` (lines 81–85, 151–162)
  - **Required Changes:** Remove phantom queries attempting to insert, upsert, or delete from non-existent table `ceo_tenants`.
  - **Database/API Impact:** Eliminates silent DB rejection logs on CEO user creation/update.
  - **Testing/Verification:** Create and edit CEO accounts via Dev Panel; verify clean success without ghost table queries.
  - **Potential Risks:** None. Table never existed.

- [x] **Task 3.2: Atomic Stock Adjustments in Invoice Edits (`PATCH /api/invoices`)**
  - **Audit Ref:** Issue 8 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/invoices/route.ts` (lines 524–542, 565–581)
  - **Required Changes:** Replace non-atomic read-then-write updates with calls to atomic stored procedure `adjust_item_stock`.
  - **Database/API Impact:** Enforces PostgreSQL row-level `FOR UPDATE` locking during invoice edits.
  - **Testing/Verification:** Edit an existing invoice to add items; verify stock quantities update atomically.
  - **Potential Risks:** Low risk. Stored procedure is already active in `POST /api/invoices`.

- [x] **Task 3.3: Atomic Stock Adjustments in Purchases (`POST /api/purchases`)**
  - **Audit Ref:** Issue 8 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/purchases/route.ts` (lines 206–224)
  - **Required Changes:** Use `adjust_item_stock` RPC for purchase receipts (positive delta) and purchase returns (negative delta).
  - **Database/API Impact:** Concurrency-safe inventory incrementing on procurement.
  - **Testing/Verification:** Record purchases and purchase returns; verify atomic stock updates.
  - **Potential Risks:** Low risk.

- [x] **Task 3.4: Atomic Stock Adjustments in Warehouse Receiving / GRN (`POST /api/items/receive`)**
  - **Audit Ref:** Issue 8 (`final-project-audit.md`)
  - **Affected Files:** `src/app/api/items/receive/route.ts` (lines 56–65)
  - **Required Changes:** Replace `select` -> `update` in GRN receiving with atomic `adjust_item_stock` RPC call.
  - **Database/API Impact:** Prevents stock collisions between warehouse receiving and counter checkouts.
  - **Testing/Verification:** Submit a GRN in Inventory; verify atomic stock update and audit log creation.
  - **Potential Risks:** Low risk.

---

### Phase 4: Financial Metric Accuracy & Performance Optimization (P3)

- [x] **Task 4.1: Delivery Charge Inclusion in Overview Net Sales**
  - **Audit Ref:** Issue 9 (`final-project-audit.md`)
  - **Affected Files:** `src/components/ceo-panel/OverviewView.tsx` (lines 161–165)
  - **Required Changes:** Calculate `netSales = Math.max(0, salesNet - returnNet)` using invoice net totals so delivery fees are preserved in collected revenue.
  - **Database/API Impact:** None. Frontend calculation alignment.
  - **Testing/Verification:** View CEO Overview with invoices containing delivery charges; verify Net Sales matches POS Day Close.
  - **Potential Risks:** Low risk.

- [x] **Task 4.2: Lightweight Invoice Summary Mode for High-Volume Queries**
  - **Audit Ref:** Issue 10 (`final-project-audit.md`)
  - **Affected Files:**
    - `src/app/api/invoices/route.ts` (lines 39–44)
    - `src/components/ceo-panel/CustomersView.tsx` (line 33)
  - **Required Changes:** Add `summary=true` parameter in `GET /api/invoices` to omit `invoice_items(*)` on high-volume ledger views.
  - **Database/API Impact:** Reduces JSON response payload by ~80% for 5,000-row customer invoice requests.
  - **Testing/Verification:** Open CEO Customers view; verify fast response, reduced payload, and accurate aging calculation.
  - **Potential Risks:** Low risk. Full item retrieval remains the default.

- [x] **Task 4.3: Deprecate Legacy Secret Developer URL Directory**
  - **Audit Ref:** Issue 11 (`final-project-audit.md`)
  - **Affected Files:** Remove `src/app/dev/alitouheedrajput01042005/page.tsx`
  - **Required Changes:** Delete legacy personal route folder; verify `/dev` remains primary console entry point.
  - **Database/API Impact:** None. Routing hygiene.
  - **Testing/Verification:** Navigate to `/dev` (verifies active); navigate to old URL (verifies 404).
  - **Potential Risks:** None.

---

### Phase 5: End-to-End Verification & Quality Assurance

- [x] **Task 5.1: Full TypeScript Compilation Check (`npx tsc --noEmit`)**
  - **Objective:** Verify zero compilation errors across the entire codebase.
  - **Verification:** Run `npx tsc --noEmit` and confirm exit code 0.

- [x] **Task 5.2: Verification of All 11 Remediated Workflows**
  - **Objective:** Systematically verify all 11 fixes against active Supabase database.
  - **Workflows to Verify:**
    1. Shift close expected cash reflects true expenses.
    2. Customer advance payments in vouchers persist without zero-clamping.
    3. Fresh cashier login displays full inventory catalog immediately.
    4. Non-developer callers of `GET /api/tenants` only receive authorized branches.
    5. Deleting a branch with transfer history cascades cleanly.
    6. User management creates/edits CEO accounts without phantom `ceo_tenants` queries.
    7. POS logout destroys `pyntflow_session` cookie on the server.
    8. Stock adjustments in invoice edits, purchases, and GRN execute atomically.
    9. Overview Net Sales includes delivery fees.
    10. Customer view fetches lightweight invoice summaries.
    11. Developer console operates exclusively on `/dev`.

---

### Phase 6: Paint Token Management System

- [x] **Task 6.1: Database Schema & Migration for Paint Tokens**
  - **Audit Ref:** Section 3 (`token-system-audit.md`), Section 30 Phase 2 (`full_user_spec.md`)
  - **Affected Files:** Created and applied [`supabase/migrations/20261002_01_paint_token_management.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261002_01_paint_token_management.sql)
  - **Required Changes:** Create `brands`, `brand_series`, `custom_units`, `series_token_configs`, `token_redemptions`, `token_redemption_items`, and re-architect `token_transactions` with 4-part identity (`brand_name`, `series_name`, `unit_name`, `token_value`). Add `series_id` and `brand_id` to `items`.
  - **Database Impact:** Schema creation with cascade constraints and tenant scoping. All existing products linked to normalized brands and default series.

- [x] **Task 6.2: Brand, Series & Token Configuration Engine (APIs & UI)**
  - **Audit Ref:** Sections 3–10 (`full_user_spec.md`), A7
  - **Affected Files:**
    - Created: [`src/app/api/brands/route.ts`](file:///d:/bestow/p-industry/src/app/api/brands/route.ts), [`src/app/api/brand-series/route.ts`](file:///d:/bestow/p-industry/src/app/api/brand-series/route.ts), [`src/app/api/token-configs/route.ts`](file:///d:/bestow/p-industry/src/app/api/token-configs/route.ts), [`src/app/api/custom-units/route.ts`](file:///d:/bestow/p-industry/src/app/api/custom-units/route.ts)
    - Created: [`src/components/TokenManagementView.tsx`](file:///d:/bestow/p-industry/src/components/TokenManagementView.tsx)
    - Updated: [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/[slug]/page.tsx) (registered `"token_management"` sidebar tab)
  - **Required Changes:** CRUD for Brands, Series, and Token Configs. Drum default Gallon × 4 logic with manual override. Series rename automatically deactivates old Series for historical integrity and creates new active Series. Custom units reusable across all Series.


- [x] **Task 6.3: Product Catalog & Bulk Product Entry Token Inheritance**
  - **Audit Ref:** Section 4 & Section 30 Phase 4 (`full_user_spec.md`)
  - **Affected Files:**
    - Updated: [`src/app/api/items/route.ts`](file:///d:/bestow/p-industry/src/app/api/items/route.ts) (GET enrichment with dynamic token values from series configs, POST/PATCH with `brand_id`/`series_id` resolution and auto token inheritance)
    - Updated: [`src/components/StockInventory.tsx`](file:///d:/bestow/p-industry/src/components/StockInventory.tsx) (Brand dropdown + Series dropdown filtered by brand + inherited token badge in both Single Product Modal and Bulk Product Entry. Series name badge in inventory table rows.)
    - Updated: [`src/types/index.ts`](file:///d:/bestow/p-industry/src/types/index.ts) (Added `brand_id`, `series_id`, `series_name` to `Item` interface)
  - **Required Changes:** Connected Products to Series via `brand_id`/`series_id`. Token value auto-resolved dynamically from `series_token_configs` matching Series + Unit. No product-level token configuration. GET `/api/items` enriches each item with live inherited token values and series name. Brand auto-creation from name when no existing brand found.

- [x] **Task 6.4: Atomic POS Checkout & Invoice Cancellation Reversals**
  - **Audit Ref:** Sections 11–13, 27 (`full_user_spec.md`), A1, A5, A10
  - **Affected Files:** `src/app/api/invoices/route.ts`, `src/components/PosBilling.tsx`, `src/components/SalesReceipt.tsx`
  - **Required Changes:** Move token generation into `POST /api/invoices`. Keep Token records Issued activity log only (no virtual balance); Remove Token records Shop Retained stockpile + net price reduction. Remove legacy POS token-tender input and deprecate `clients.token_balance`. Normal invoice edits do NOT reverse or duplicate token records. Invoice cancellation atomically reverses token records according to physical/usage state while preserving historical integrity. Print token badges on POS receipts.

- [x] **Task 6.5: Multi-Line Customer Redemption Dialog & Cash Drawer Integration**
  - **Audit Ref:** Sections 15–19, 26 (`full_user_spec.md`), A4, A12
  - **Affected Files:** `src/components/TokenRedemption.tsx` (or new `TokenRedemptionModal.tsx`), `src/app/api/tokens/redeem/route.ts`, `src/components/ShiftDrawer.tsx`, `src/app/api/shifts/route.ts`
  - **Required Changes:** Multi-line redemption supporting multiple brands/series/units. Auto-populate read-only token value. Record cash payout under active shift. Deduct redemption payouts from expected drawer cash.

- [x] **Task 6.6: Stockpile Aggregation, Opening Stock Seeding, Brand Settlement & Write-Off**
  - **Audit Ref:** Sections 20–25 (`full_user_spec.md`), A2, A8
  - **Affected Files:** `src/components/TokenLedger.tsx`, `src/components/PurchasesView.tsx`, `src/components/FinancialLedgers.tsx`, `src/app/api/tokens/route.ts`
  - **Required Changes:** Implement first-class Opening Stock seeding flow (Brand, Series, Unit, Value, Count). Aggregate stockpile by `(Brand, Series, Unit, Value)` across origins (Shop Retained, Redeemed, Opening Stock). Brand-specific representative settlement with partial quantities. Write-off with reason (`Damaged`, `Lost`, `Invalid`, `Other`). Preserve supplier purchase/voucher token application.

- [x] **Task 6.7: Comprehensive Test Execution & TypeScript Validation**
  - **Audit Ref:** Section 31 (`full_user_spec.md`)
  - **Status:** ✅ COMPLETE — 2026-10-02
  - **Evidence:**
    - `npx tsc --noEmit` → **Exit Code: 0** (zero TypeScript errors)
    - `npx next build --webpack` → **Exit Code: 0** (33 pages compiled, all API routes built)
    - **36/36 Section 31 verification scenarios PASSED** (zero failures)
      - Section A (Config A1–A5): ✅ all pass
      - Section B (POS/Invoice Token Flow B1–B8): ✅ all pass
      - Section C (Customer Redemptions C1–C6): ✅ all pass
      - Section D (Stockpile/Settlement/Write-Off D1–D14): ✅ all pass
      - Section E (Cash Drawer Accounting E1): ✅ pass
      - Section F (Legacy Architecture Cleanup F1): ✅ pass
      - Section G (Cross-Tenant Security G1): ✅ pass
    - Test script: `scripts/verify-section31-all.mjs`
    - All temporary test records cleaned up after each run
  - **Bugs Fixed During Verification:**
    - `create_invoice_atomic` RPC: `v_date TEXT` → `v_date DATE` cast fix
    - `series_token_configs` upsert: replaced `.upsert()` with explicit select+update/insert
    - `SalesHistory.tsx`: `t.brand_name` → `t.brand` (TypeScript type mismatch)
    - `token-redemptions/route.ts`: `payout_method` now forwarded from body to RPC
    - `token-redemptions/route.ts`: `token_value` passed through for authoritative mismatch check
    - Test script C1–C3, C6: `data.redemption_id` → `data.redemption?.id`
    - Test script D13: `usage_status 'used'` → `'settled'` (check constraint compliance)
    - Test script D13: removed non-existent `used_date` column reference
    - Test script D13: `PUR-${runId}` → `PUR-D13-${Date.now()}` (unique constraint safety)


