# PyntFlow — Comprehensive Post-Audit Implementation Plan

**Plan Reference:** [`final-project-audit.md`](file:///d:/bestow/p-industry/final-project-audit.md) & [`system-quality-rating.md`](file:///d:/bestow/p-industry/system-quality-rating.md)  
**Target:** Remediate all 11 confirmed issues across critical financial calculations, login initialization, multi-tenant security, concurrency locking, and query performance.  
**Mode:** Planning Only (No code or database modifications during this phase).

---

## 1. Architecture & Dependency Roadmap

The implementation roadmap is structured into 5 sequential phases ordered by strict dependency and business criticality:

```
┌────────────────────────────────────────────────────────────────────────┐
│             PHASE 1: CRITICAL FINANCIAL & LOADING FIXES (P0)           │
│  • Task 1.1: Server Shift Close `petty_expenses` Table Query Fix       │
│  • Task 1.2: Customer Advance Payments Zero-Clamp Fix in Vouchers     │
│  • Task 1.3: Fresh Cashier Login Inventory Loading Fix in POS Shell    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│        PHASE 2: MULTI-TENANT ISOLATION & SESSION HARDENING (P1)        │
│  • Task 2.1: Server-Side Tenancy Scoping in `GET /api/tenants`         │
│  • Task 2.2: Branch Deletion Foreign Key Cascade (`branch_orders`)     │
│  • Task 2.3: POS Server-Side Cookie Invalidation / Logout Route        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             PHASE 3: CONCURRENCY & DATABASE CLEANLINESS (P2)           │
│  • Task 3.1: Clean Dead `ceo_tenants` Queries in User Management       │
│  • Task 3.2: Atomic Stock Deduction RPC in `PATCH /api/invoices`       │
│  • Task 3.3: Atomic Stock Increment RPC in `POST /api/purchases`       │
│  • Task 3.4: Atomic Stock Increment RPC in `POST /api/items/receive`   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│     PHASE 4: METRIC ACCURACY & PERFORMANCE OPTIMIZATION (P3)           │
│  • Task 4.1: Delivery Charge Inclusion in CEO Overview Net Sales       │
│  • Task 4.2: Lightweight Invoice Summary Mode (`select_fields=summary`)│
│  • Task 4.3: Deprecate Legacy Secret Developer URL Directory           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             PHASE 5: END-TO-END VERIFICATION & REGRESSION CHECK        │
│  • Task 5.1: Full TypeScript Compilation Check (`npx tsc --noEmit`)    │
│  • Task 5.2: Verification of All 11 Remediated Workflows               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Technical Specifications

---

### Phase 1: Critical Financial & Loading Fixes (P0)

#### Task 1.1: Server Shift Close Expenses Table Fix
* **Issue ID:** Bug 1 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/shifts/route.ts`](file:///d:/bestow/p-industry/src/app/api/shifts/route.ts#L286-L292)
* **Problem:** In `PATCH /api/shifts`, line 287 attempts to query `supabaseAdmin.from('expenses')`. In Supabase, the table is named `petty_expenses`. The query fails with error `42P01` (`relation "expenses" does not exist`), causing `totalExpenses` to evaluate to `0`. Consequently, `serverExpectedCash` does not deduct petty expenses incurred during the shift, saving an inflated expected cash balance and recording a false shortage against the cashier.
* **Required Changes:**
  - In `src/app/api/shifts/route.ts`, change `.from('expenses')` to `.from('petty_expenses')`.
  - Maintain the existing filters (`.eq('shift_id', id).eq('tenant_id', tenantId)`).
* **Database / API Impact:** Reads from the existing `petty_expenses` table; no schema migrations needed. API returns accurate `server_expected_cash` and `difference`.
* **Testing & Verification:**
  - Create or inspect a shift with linked petty expenses.
  - Call `PATCH /api/shifts` to close the shift.
  - Verify `shifts.expected_cash` in Supabase equals `Opening + Cash Sales - Cash Returns - Supplier Cash Paid - Petty Expenses - Tokens Redeemed Cash`.
* **Potential Risks:** Low risk. Re-aligns server calculation with the client formula in `ShiftDrawer.tsx`.

#### Task 1.2: Customer Advance Payments Zero-Clamp Fix in Vouchers
* **Issue ID:** Bug 3 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/vouchers/route.ts`](file:///d:/bestow/p-industry/src/app/api/vouchers/route.ts#L198-L200)
* **Problem:** Line 199 in `POST /api/vouchers` computes:
  ```typescript
  const updatedBal = Math.max(0, (client.current_balance || 0) - totalSettlementAmount);
  ```
  If a client makes an advance payment exceeding their current balance (e.g. paying Rs. 15,000 against a Rs. 5,000 balance), `updatedBal` is clamped to `0`, destroying the client's Rs. 10,000 advance payment credit.
* **Required Changes:**
  - In `src/app/api/vouchers/route.ts`, remove `Math.max(0, ...)` and compute:
    ```typescript
    const updatedBal = (Number(client.current_balance) || 0) - totalSettlementAmount;
    ```
* **Database / API Impact:** Updates `clients.current_balance` directly. Negative values correctly denote customer credit / advance balances, matching `invoices/route.ts` line 596.
* **Testing & Verification:**
  - Post a receipt voucher for a client with amount greater than current debt.
  - Verify `clients.current_balance` becomes negative (e.g. `-10000`).
  - Open `FinancialLedgers.tsx` and verify the advance balance displays properly without corruption.
* **Potential Risks:** Low risk. Restores accounting integrity for contractor prepayments.

#### Task 1.3: Fresh Cashier Login Inventory Loading Fix in POS Shell
* **Issue ID:** Bug 2 from `final-project-audit.md`
* **Affected Files:** [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L98-L101), [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L121-L158)
* **Problem:** `fetchTenant()` runs on mount before login. It calls `/api/items?tenant_id=...`, which returns `401 Unauthorized` because the user has no cookie yet, setting `items` to `[]`. When the user logs in via `handleLogin()`, `items` is never refreshed, causing the cashier to land on an empty product catalog until a manual refresh or completed sale.
* **Required Changes:**
  - In `src/app/[slug]/page.tsx`, define `refreshItems` or trigger item loading in `handleLogin()` immediately after successful login when `data.user` is received.
  - Alternatively, add `currentUser?.id` or `currentUser?.tenant_id` to the item fetching `useEffect` dependency array so items load automatically whenever the user session transitions from unauthenticated to authenticated.
* **Database / API Impact:** Calls existing `GET /api/items?tenant_id=...` with the newly established session cookie.
* **Testing & Verification:**
  - Clear all browser cookies/storage (or open an incognito window).
  - Navigate to `/[slug]` and log in as cashier.
  - Verify all branch products appear immediately in the POS billing grid without pressing manual refresh.
* **Potential Risks:** Very low risk. Fixes cold-start initialization.

---

### Phase 2: Multi-Tenant Isolation & Session Hardening (P1)

#### Task 2.1: Server-Side Tenancy Scoping in `GET /api/tenants`
* **Issue ID:** Issue 4 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L41-L73)
* **Problem:** `GET /api/tenants` without a `slug` calls `requireTenantAuth(req, null)`, which any authenticated user passes. It queries all tenants system-wide and sends all registered stores, owner names, emails, phones, and staff counts over the network.
* **Required Changes:**
  - In `src/app/api/tenants/route.ts`:
    - If `auth.session.role === 'developer'`, return all tenants.
    - If `auth.session.role === 'ceo'`, filter the query to only return tenants where `id === auth.session.tenantId` OR matching `owner_name` / `email` of the CEO's primary tenant.
    - If `auth.session.role === 'staff'` or `'godown_staff'`, only return the single tenant matching `auth.session.tenantId`.
* **Database / API Impact:** Restricts API response data to authorized branches only.
* **Testing & Verification:**
  - Call `GET /api/tenants` with a staff token: verify only 1 tenant is returned.
  - Call with a CEO token: verify only sister branches are returned.
  - Call with a developer token: verify all tenants are returned.
* **Potential Risks:** Ensure `CeoSuite.tsx` and `DevBranchesView.tsx` receive expected formats without breaking multi-branch navigation.

#### Task 2.2: Branch Deletion Foreign Key Cascade (`branch_orders`)
* **Issue ID:** Issue 5 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L380-L415)
* **Problem:** Foreign keys `branch_orders.to_tenant_id` and `from_tenant_id` have `delete_rule: NO ACTION`. `DELETE /api/tenants` deletes users, held invoices, items, and shifts, but does not clean up `branch_orders`. Deleting any branch that has participated in a transfer crashes with Postgres error `23503`.
* **Required Changes:**
  - In `DELETE /api/tenants`, before deleting child items and the tenant record, add:
    1. Query all order IDs from `branch_orders` where `from_tenant_id = id` or `to_tenant_id = id`.
    2. Delete child records from `branch_order_items` where `order_id` is in those IDs.
    3. Delete `branch_orders` where `from_tenant_id = id` or `to_tenant_id = id`.
* **Database / API Impact:** Clean cascade deletion on PostgreSQL tables; no schema migration required.
* **Testing & Verification:**
  - In Dev Panel, delete a test branch that has existing branch orders.
  - Verify deletion succeeds with `{ success: true }` and no foreign key constraint violations occur.
* **Potential Risks:** Low risk. Deletion is restricted to Developer Super Admins.

#### Task 2.3: POS Server-Side Cookie Invalidation / Logout Route
* **Issue ID:** Issue 7 from `final-project-audit.md`
* **Affected Files:**
  - Create: `src/app/api/auth/logout/route.ts`
  - Update: [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L415), [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L555), [`src/components/CeoDashboard.tsx`](file:///d:/bestow/p-industry/src/components/CeoDashboard.tsx)
* **Problem:** Clicking "Logout" in POS or CEO dashboard only sets `currentUser` state to `null`. The HTTP-only cookie `pyntflow_session` remains valid in the browser for up to 7 days.
* **Required Changes:**
  - Create `POST /api/auth/logout` that deletes `pyntflow_session` by setting the cookie with `maxAge: 0`, `path: '/'`, and `expires: new Date(0)`.
  - In `src/app/[slug]/page.tsx` and `CeoDashboard.tsx`, call `POST /api/auth/logout` during logout before setting `currentUser(null)`.
* **Database / API Impact:** New route handler `POST /api/auth/logout`.
* **Testing & Verification:**
  - Log in to POS. Observe `pyntflow_session` in Application Cookies.
  - Click "Logout". Verify `pyntflow_session` cookie is removed.
  - Refresh the page and verify protected API calls without credentials return `401 Unauthorized`.
* **Potential Risks:** Low risk. Standard web session cleanup.

---

### Phase 3: Concurrency & Database Cleanliness (P2)

#### Task 3.1: Clean Dead `ceo_tenants` Queries in User Management
* **Issue ID:** Issue 6 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts#L81-L85), [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts#L151-L162)
* **Problem:** `src/app/api/users/route.ts` contains dead queries to `ceo_tenants`, a table that does not exist in the database (sister branches are resolved dynamically via `owner_name` and `email` matching).
* **Required Changes:**
  - Remove phantom `supabaseAdmin.from('ceo_tenants')` inserts and upserts from `POST` and `PUT` in `src/app/api/users/route.ts`.
* **Database / API Impact:** Eliminates silent DB errors on user creation and updates.
* **Testing & Verification:**
  - Create and edit a CEO user via Dev Panel.
  - Verify user is created/updated cleanly without silent backend query rejections.
* **Potential Risks:** None. Table never existed.

#### Task 3.2: Atomic Stock Adjustments in Invoice Edits (`PATCH /api/invoices`)
* **Issue ID:** Issue 8 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L524-L542), [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L565-L581)
* **Problem:** `PATCH /api/invoices` uses non-atomic `select` -> `update` to revert old stock deductions and apply new stock deductions, which creates race conditions under concurrent operations.
* **Required Changes:**
  - Replace read-then-write loops in `PATCH /api/invoices` with calls to the atomic stored procedure:
    ```typescript
    // To revert old item:
    await supabaseAdmin.rpc('adjust_item_stock', { p_item_id: oldIt.item_id, p_qty_delta: Number(oldIt.qty) });
    // To apply new item:
    await supabaseAdmin.rpc('adjust_item_stock', { p_item_id: lineItem.item_id, p_qty_delta: -Number(lineItem.qty) });
    ```
* **Database / API Impact:** Uses existing PostgreSQL stored procedure `adjust_item_stock` with `FOR UPDATE` row-level locking.
* **Testing & Verification:**
  - Edit an existing invoice in Sales History / POS to add items.
  - Verify stock quantities update accurately and atomically in `items.stock_qty`.
* **Potential Risks:** Low risk. Stored procedure is already thoroughly tested in `POST /api/invoices`.

#### Task 3.3: Atomic Stock Adjustments in Purchases (`POST /api/purchases`)
* **Issue ID:** Issue 8 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/purchases/route.ts`](file:///d:/bestow/p-industry/src/app/api/purchases/route.ts#L206-L224)
* **Problem:** In `POST /api/purchases`, stock adjustment uses non-atomic `select` -> `update`.
* **Required Changes:**
  - Update stock adjustment in `POST /api/purchases` to use `adjust_item_stock`:
    ```typescript
    const qtyDelta = isReturn ? -lineItem.qty : lineItem.qty;
    await supabaseAdmin.rpc('adjust_item_stock', { p_item_id: resolvedItemId, p_qty_delta: qtyDelta });
    ```
* **Database / API Impact:** Row-level locking on purchase receipts and returns.
* **Testing & Verification:**
  - Record a purchase invoice and a purchase return in Purchases view.
  - Verify stock increases on purchase and decreases on return with atomic concurrency safety.
* **Potential Risks:** Low risk.

#### Task 3.4: Atomic Stock Adjustments in Warehouse Receiving / GRN (`POST /api/items/receive`)
* **Issue ID:** Issue 8 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/items/receive/route.ts`](file:///d:/bestow/p-industry/src/app/api/items/receive/route.ts#L56-L65)
* **Problem:** Inward Goods Received Notes (GRN) use non-atomic read-then-write updates.
* **Required Changes:**
  - Replace `select` -> `update` in `POST /api/items/receive` with:
    ```typescript
    const { data: updatedStock, error: rpcErr } = await supabaseAdmin.rpc('adjust_item_stock', {
      p_item_id: item_id,
      p_qty_delta: parsedQty,
    });
    ```
* **Database / API Impact:** Ensures stock receipts cannot collide with concurrent counter sales.
* **Testing & Verification:**
  - Submit a GRN in Inventory view. Verify stock increases atomically and audit log is created.
* **Potential Risks:** Low risk.

---

### Phase 4: Financial Metric Accuracy & Performance Optimization (P3)

#### Task 4.1: Delivery Charge Inclusion in Overview Net Sales
* **Issue ID:** Issue 9 from `final-project-audit.md`
* **Affected Files:** [`src/components/ceo-panel/OverviewView.tsx`](file:///d:/bestow/p-industry/src/components/ceo-panel/OverviewView.tsx#L161-L165)
* **Problem:** `OverviewView.tsx` calculates `netSales = Math.max(0, grossSales - discounts - returnTotal)` where `grossSales` is derived from `subtotal`. In POS, `net_total = subtotal - discount + delivery_charge`. The CEO calculation completely drops delivery charges from total net revenue.
* **Required Changes:**
  - In `OverviewView.tsx`, compute `netSales` directly from invoice net totals:
    ```typescript
    const salesNet = salesInvs.reduce((sum, i) => sum + Number(i.net_total || 0), 0);
    const returnNet = returnInvs.reduce((sum, i) => sum + Number(i.net_total || 0), 0);
    const netSales = Math.max(0, salesNet - returnNet);
    ```
* **Database / API Impact:** None. Frontend display parity only.
* **Testing & Verification:**
  - View CEO Overview for a date range with invoices containing delivery charges.
  - Verify Net Sales reflects true collected revenue matching POS Day Close.
* **Potential Risks:** Low risk.

#### Task 4.2: Lightweight Invoice Summary Mode for High-Volume Queries
* **Issue ID:** Issue 10 from `final-project-audit.md`
* **Affected Files:** [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L39-L44), [`src/components/ceo-panel/CustomersView.tsx`](file:///d:/bestow/p-industry/src/components/ceo-panel/CustomersView.tsx#L33)
* **Problem:** In `CustomersView.tsx`, fetching 5,000 invoices downloads `*, invoice_items(*)`. This sends thousands of unneeded line item objects over the network when only header amounts, dates, and client IDs are required.
* **Required Changes:**
  - In `src/app/api/invoices/route.ts`, support query parameter `summary=true`:
    ```typescript
    const isSummary = searchParams.get('summary') === 'true';
    const selectQuery = isSummary
      ? 'id, invoice_no, client_id, client_name, date, net_total, paid_amount, due_amount, payment_type, invoice_type, created_at, status'
      : '*, invoice_items(*)';
    ```
  - In `src/components/ceo-panel/CustomersView.tsx`, add `&summary=true` to the invoices fetch URL.
* **Database / API Impact:** Reduces JSON payload size by ~80% for high-volume customer ledger queries.
* **Testing & Verification:**
  - Open Customers view in CEO Suite. Verify network response payload size is drastically reduced and customer aging/balance calculations remain 100% accurate.
* **Potential Risks:** Low risk. Full `invoice_items(*)` remains the default when `summary` is not specified.

#### Task 4.3: Deprecate Legacy Secret Developer URL Directory
* **Issue ID:** Issue 11 from `final-project-audit.md`
* **Affected Files:** `src/app/dev/alitouheedrajput01042005/page.tsx`
* **Problem:** Redundant route file hardcoding personal name in the URL alongside `/dev`.
* **Required Changes:**
  - Remove `src/app/dev/alitouheedrajput01042005/page.tsx` and its parent directory.
* **Database / API Impact:** Eliminates duplicate page bundle from Next.js routing tree.
* **Testing & Verification:**
  - Verify `/dev` remains fully functional.
  - Verify navigating to the old secret route returns standard Next.js 404.
* **Potential Risks:** None. Dev panel is accessed via `/dev` with Master PIN.

---

### Phase 5: End-to-End Verification & Quality Assurance

#### Task 5.1: Full TypeScript Compilation & Build Check
* **Objective:** Ensure zero type errors and clean production build.
* **Actions:**
  - Run `npx tsc --noEmit`.
  - Verify exit code 0.
* **Acceptance Criteria:** Zero compilation errors, zero broken imports.

#### Task 5.2: Verification of All 11 Remediated Workflows
* **Objective:** Systematically verify all 11 fixes against active Supabase database.
* **Workflows to Verify:**
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
