# PyntFlow — Comprehensive End-to-End Project Audit Report

**Date of Audit:** September 26, 2026  
**Audit Mode:** Complete System Read-Only Verification  
**Repository:** `d:\bestow\p-industry` (Pyntflow POS & Industrial ERP)  
**TypeScript Verification:** Clean compilation (`npx tsc --noEmit` exited with code 0)  
**Database Connection:** Supabase project `ignspvajzblmsbertmmv` (verified live via SQL engine)  

---

## 1. Overall Architecture & Data-Flow Analysis

PyntFlow is structured as a **Multi-Tenant Hybrid Desktop/Mobile Point of Sale (POS) and Industrial ERP** built with **Next.js (App Router), React 19, Supabase (PostgreSQL), and Jose (JWT)**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT LAYER (BROWSER)                                 │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│    Marketing Landing     │      Branch POS Shell       │      Dev Infra Console        │
│      `src/app/page.tsx`  │    `src/app/[slug]/page.tsx`│     `src/app/dev/page.tsx`    │
│    (Public SEO Catalog)  │   (Cashier / CEO Workspace) │  (Master PIN Multi-Tenant)    │
└────────────┬─────────────┴──────────────┬──────────────┴───────────────┬───────────────┘
             │                            │                              │
             ▼                            ▼                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SERVER & BACKEND FOR FRONTEND (BFF)                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Authentication & Session Tokens (`src/lib/session.ts` via HTTP-only Cookies & JWT)   │
│ • Next.js Route Handlers (`src/app/api/*`)                                             │
│ • Developer & Tenant Authorization Filters (`requireTenantAuth`, `requireDevAuth`)     │
│ • Google Gemini Vision Integration (`src/app/api/ai-invoice-scan/route.ts`)            │
│ • Admin Client Gateway (`src/lib/supabase.ts` with `SUPABASE_SERVICE_ROLE_KEY`)        │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE LAYER (SUPABASE POSTGRES)                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • 19 Relational Public Tables (`tenants`, `invoices`, `items`, `shifts`, etc.)         │
│ • 69 Covering & Performance Indexes                                                    │
│ • Row Level Security (RLS) Active on all 19 tables (Default-Deny for Anon Key)         │
│ • Concurrency RPCs (`adjust_item_stock`, `adjust_item_stock_by_code`)                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Key Characteristics
1. **Server-Gateway (BFF) Pattern**: The browser client **never** makes direct database requests via the Supabase Client SDK using anon keys. All frontend components communicate exclusively through Next.js server route handlers (`/api/*`).
2. **Session Model**: Two distinct session types operate simultaneously:
   - **`pyntflow_session` (Cookie)**: Signed HS256 JWT for Branch Staff and CEOs containing `userId`, `username`, `role`, `tenantId`, and `ceoTenants`.
   - **`aura_dev_token` (Cookie & Bearer Header)**: Signed HS256 JWT for Developer Super-Admin access, taking precedence in session resolution.
3. **Multi-Tenancy Isolation**: Tenancy is scoped by `tenant_id` (UUID). Sister branches belonging to the same CEO are resolved dynamically through matching `owner_name` or `email` across the `tenants` table.

---

## 2. Module & Panel-by-Panel Audit Findings

### 2.1 Developer Console (`src/components/dev-panel/*`)
* **Overview & Statistics**: Correctly aggregates real branch counts, total user accounts, and system-wide metrics.
* **Branch Management**: Supports full lifecycle (creation, update of name/slug/owner, status toggle, and deletion cascade). Dynamic slug prefixing for counter accounts (`${slug}_counter1`) prevents username collisions.
* **User Management**: Role-aware tenant dropdowns (Developer = Global, CEO = Multi-branch, Staff = Single branch). Password update is strictly optional during editing.
* **Receipt Templates Designer**: Full 80mm thermal and A4 visual designer with live preview and branch assignment. Test printing uses isolated iframe printing without blank popups.
* **Security & Lock**: "Lock Console" triggers server-side cookie deletion via `DELETE /api/auth/dev-pin`. Master PIN has sliding-window IP rate limiting (5 attempts per 15 min).

### 2.2 POS Billing & Cart Engine (`src/components/PosBilling.tsx`)
* **Cart Calculations**: Real-time line item recalculations, item discount percentages, invoice-level discounts, delivery charges, and gross/net calculations.
* **Split Payments**: Accurately tracks multi-tender splits (`cash_paid`, `card_paid`, `bank_paid`, `others_paid`) and stamps payment type as `split` when multiple tenders are used.
* **Parked Invoices (Hold)**: Parked orders persist in database table `held_invoices` with complete item JSON, customer details, discounts, and delivery charges. Restoring orders is non-destructive (record remains in DB until completed or explicitly discarded).
* **Credit Limit Enforcement**: Blocks credit sales for walk-in accounts (`selectedClient === null`); blocks sales exceeding customer credit limits.
* **Receipt Printing**: Uses hidden isolated iframe (`printViaIframe` in `src/utils/iframePrint.ts`), preventing blank popups or parent DOM styling destruction.

### 2.3 Shift & Cash Drawer Management (`src/components/ShiftDrawer.tsx`)
* **Handover & Variance**: Pre-fills opening cash with the previous closed shift's cash balance. Live variance indicator flags overages and shortages.
* **Denomination Counter**: Interactive Pakistani rupee denomination grid (`5000`, `1000`, `500`, `100`, `50`, `20`, `10`) auto-calculates total physical cash.
* **Reconciliation Formula**:
  $$\text{Expected Cash} = \text{Opening} + \text{Cash Sales} - \text{Cash Returns} - \text{Supplier Cash Paid} - \text{Petty Expenses} - \text{Tokens Redeemed Cash}$$
* **Closing Enforcement**: Single active open shift rule enforced by both client UI and server unique partial constraint.

### 2.4 Sales History & Returns (`src/components/SalesHistory.tsx`)
* **Disaggregated KPIs**: Breakdowns for Total Cash Inflow, Card/Bank Inflow, Store Credit Billed, and Net Sales.
* **Return Processing**: Distinguishes cash refund vs credit note. Returns adjust stock upwards via atomic RPC.
* **WhatsApp Share**: Normalizes Pakistani phone numbers (`0300...` / `+92...` ➔ `92300...`) and opens pre-filled WhatsApp billing statements.

### 2.5 Inventory & Warehouse (`src/components/StockInventory.tsx`)
* **Catalog Management**: Live search, category filtering, stock status tags (`in_stock`, `low_stock`, `out_of_stock`), and manual stock adjustments.
* **Bulk Product Entry**: Batch entry grid with shared parent parameters (Brand, Category, Unit, Min Alert, Token) and dynamic shade rows.
* **Goods Received Notes (GRN)**: Inward stock receipt generates sequential reference numbers (`GRN-YYYY-XXXX`) with audit logging.
* **AI Invoice Scanning**: Integrated with Gemini 3.5 Flash Lite vision model to convert supplier paper bills into catalog stock items.

### 2.6 Customer Accounts & Recovery (`src/components/ClientCreditRecovery.tsx` & `FinancialLedgers.tsx`)
* **Ledger Statements**: Chronological timeline combining sales invoices, credit note returns, and cash receipt vouchers.
* **Aging Buckets**: Real invoice date aging (`0–30 days`, `31–60 days`, `61+ days`).
* **Canvas Statement Export**: High-resolution HTML5 Canvas PNG statement generator with dynamic text measurement (`ctx.measureText()`).

### 2.7 Branch Orders & Inter-Branch Transfers (`src/components/BranchOrders.tsx`)
* **Internal Requisition**: Allows requesting items with 0 stock.
* **Transfer Lifecycle**: Strict status flow: `pending` ➔ `accepted` ➔ `dispatched` ➔ `received`.
* **Automatic Stock Posting**: Dispatch deducts from supplying branch; receipt adds to requesting branch (auto-creates item record if not present).
* **Inter-Branch Accounting**: Posts mirrored IBT vouchers to `vouchers` table with real transfer cost prices.

### 2.8 CEO Executive Suite (`src/components/ceo-panel/*`)
* **Multi-Branch Switching**: Allows CEOs to seamlessly switch between authorized sister branches.
* **Financial Overview**: Net Sales, COGS (catalogue cost with 60% fallback), Gross Margin %, Petty Expenses, Commission, and Net Margin %.
* **Day Close Verification**: Visual shift audit comparing expected cash against counted cash with discrepancy flags.

---

## 3. Confirmed Bugs & Issues

### 🔴 CRITICAL SEVERITY

#### Issue 1: Server-Side Shift Close Queries Non-Existent `expenses` Table
* **File:** [`src/app/api/shifts/route.ts`](file:///d:/bestow/p-industry/src/app/api/shifts/route.ts#L286-L292)
* **Code:**
  ```typescript
  // Deduct cash expenses
  const { data: shiftExpenses } = await supabaseAdmin
    .from('expenses')
    .select('amount')
    .eq('shift_id', id)
    .eq('tenant_id', tenantId);
  const totalExpenses = (shiftExpenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  ```
* **Evidence:** In Supabase, the table is named `petty_expenses`. The table `expenses` does not exist in the database.
* **Impact:** `supabaseAdmin.from('expenses')` fails silently with error code `42P01` (`relation "expenses" does not exist`). `totalExpenses` evaluates to `0`. On shift close, server-side recalculation of `serverExpectedCash` **never deducts petty expenses**. The database records an artificially inflated `expected_cash` and a false cash shortage against the cashier.
* **Fix:** Change `.from('expenses')` to `.from('petty_expenses')`.

#### Issue 2: Fresh Cashier Login Lands on Empty Product Inventory
* **File:** [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L98-L101), [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L121-L158)
* **Code Trace:**
  1. On initial page load, before the user logs in, `fetchTenant()` runs:
     ```typescript
     const itemsRes = await fetch(`/api/items?tenant_id=${data.tenant.id}`);
     ```
  2. Because the user has no cookie yet, `requireTenantAuth` in `/api/items` returns `401 Unauthorized`.
  3. `fetchTenant()` catches the error and executes `setItems([])`.
  4. The user logs in via `handleLogin()`.
  5. `handleLogin()` sets `currentUser` and `activeTab('pos')`, but **never calls `refreshItems()`**.
* **Impact:** In any fresh browser window or incognito session, upon logging in, the POS billing screen starts with `items === []` (0 products displayed). Products only load if the cashier manually clicks the small refresh button or finishes an invoice.
* **Fix:** Call `await refreshItems()` inside `handleLogin()` immediately after successful authentication, or add a `useEffect` on `currentUser?.id`.

#### Issue 3: Customer Advance Payments Zero-Clamped in Vouchers
* **File:** [`src/app/api/vouchers/route.ts`](file:///d:/bestow/p-industry/src/app/api/vouchers/route.ts#L198-L200)
* **Code:**
  ```typescript
  if (party_type === 'client') {
    ...
    // Receipt decreases client debt (balance)
    const updatedBal = Math.max(0, (client.current_balance || 0) - totalSettlementAmount);
    await supabaseAdmin.from('clients').update({ current_balance: updatedBal }).eq('id', party_id);
  }
  ```
* **Evidence:** In `src/app/api/invoices/route.ts` line 596 and `src/app/api/purchases/route.ts` line 241, `Math.max(0, ...)` was deliberately removed to support customer advance credits. However, in `vouchers/route.ts`, `Math.max(0, ...)` remains.
* **Impact:** If a customer owes Rs. 5,000 and pays Rs. 15,000 in advance for a contractor project, `updatedBal` is clamped to 0. The customer's Rs. 10,000 advance payment is destroyed and lost from their balance.
* **Fix:** Remove `Math.max(0, ...)` and compute `(Number(client.current_balance) || 0) - totalSettlementAmount`.

---

### 🟠 HIGH SEVERITY

#### Issue 4: Cross-Tenant Data Leak in `GET /api/tenants`
* **File:** [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L41-L73), [`src/components/ceo-panel/CeoSuite.tsx`](file:///d:/bestow/p-industry/src/components/ceo-panel/CeoSuite.tsx#L52-L57)
* **Code Trace:**
  ```typescript
  // In src/app/api/tenants/route.ts:
  const auth = await requireTenantAuth(req, null); // Any logged in staff or CEO passes!
  const { data: tenants } = await supabaseAdmin.from('tenants').select('*');
  ...
  return NextResponse.json({ success: true, tenants: tenantsWithDetails });
  ```
* **Impact:** Any authenticated cashier at any shop can send `GET /api/tenants` and receive the entire database of all registered paint shops, owner names, emails, phone numbers, and counter lists. While `CeoSuite.tsx` filters the array in client React state, the full unredacted payload travels across the public network.
* **Fix:** In `GET /api/tenants`, if the caller is not a `developer`, filter the query on the server to only return tenants matching the caller's authorized tenant IDs, `owner_name`, or `email`.

#### Issue 5: Branch Deletion Violates Foreign Key on `branch_orders`
* **File:** [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L380-L415)
* **Evidence:** Live Supabase schema check confirms:
  ```json
  {"table_name":"branch_orders","column_name":"to_tenant_id","delete_rule":"NO ACTION"},
  {"table_name":"branch_orders","column_name":"from_tenant_id","delete_rule":"NO ACTION"}
  ```
* **Impact:** When deleting a branch in Dev Panel, `DELETE /api/tenants` deletes child users, held invoices, items, and shifts, but does not delete `branch_orders` referencing `to_tenant_id` or `from_tenant_id`. If the branch has ever placed or fulfilled a transfer order, deletion crashes with Postgres foreign key violation error `23503`.
* **Fix:** Add cleanup block in `DELETE /api/tenants` before tenant deletion:
  ```typescript
  await supabaseAdmin.from('branch_order_items').delete().in('order_id', 
    (await supabaseAdmin.from('branch_orders').select('id').or(`from_tenant_id.eq.${id},to_tenant_id.eq.${id}`)).data?.map(o => o.id) || []
  );
  await supabaseAdmin.from('branch_orders').delete().or(`from_tenant_id.eq.${id},to_tenant_id.eq.${id}`);
  ```

#### Issue 6: Non-Existent `ceo_tenants` Table Insertions in User Management
* **File:** [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts#L81-L85), [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts#L151-L162)
* **Code:**
  ```typescript
  if (role === 'ceo' && tenant_id) {
    await supabaseAdmin.from('ceo_tenants').insert({ user_id: newUser.id, tenant_id });
  }
  ```
* **Evidence:** Live Supabase query `SELECT table_name FROM information_schema.tables WHERE table_name = 'ceo_tenants'` returns empty `[]`. Sister branch linking is actually handled dynamically via `owner_name` and `email` matching in `src/app/api/auth/login/route.ts`.
* **Impact:** The query fails silently on every CEO user creation and update. Dead/ghost code trying to communicate with a non-existent table.
* **Fix:** Remove the references to `ceo_tenants` or create the table migration if explicit manual mapping is desired.

#### Issue 7: Incomplete Session Invalidation on POS Logout
* **File:** [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L415), [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L555)
* **Code:**
  ```typescript
  <button onClick={() => setCurrentUser(null)}>Logout</button>
  ```
* **Impact:** Clicking "Logout" only resets local React state. There is no `POST /api/auth/logout` endpoint, and the HTTP-only cookie `pyntflow_session` is not expired. If another person uses the same browser or requests an API route, the old session cookie remains valid for 7 days.
* **Fix:** Create `POST /api/auth/logout` that deletes the `pyntflow_session` cookie with `maxAge: 0`, and call it during logout.

---

### 🟡 MEDIUM SEVERITY

#### Issue 8: Concurrency Race Condition in Invoice Updates (`PATCH /api/invoices`)
* **File:** [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L535-L538), [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L574-L579)
* **Impact:** `POST /api/invoices` uses the atomic stored procedure `adjust_item_stock` with `FOR UPDATE` row locking. In contrast, `PATCH /api/invoices`, `POST /api/purchases`, and `POST /api/items/receive` use non-atomic read-then-write (`select` -> `update`). If stock is received or sold concurrently, stock counts can become desynchronized.
* **Fix:** Standardize all stock modifications onto `adjust_item_stock` RPC.

#### Issue 9: Overview Net Sales Omits Delivery Charges
* **File:** [`src/components/ceo-panel/OverviewView.tsx`](file:///d:/bestow/p-industry/src/components/ceo-panel/OverviewView.tsx#L161-L165)
* **Code:**
  ```typescript
  const grossSales = salesInvs.reduce((sum, i) => sum + Number(i.subtotal || i.net_total || 0), 0);
  const returnTotal = returnInvs.reduce((sum, i) => sum + Number(i.net_total || 0), 0);
  const discounts = salesInvs.reduce((sum, i) => sum + Number(i.discount || 0), 0);
  const netSales = Math.max(0, grossSales - discounts - returnTotal);
  ```
* **Impact:** In `PosBilling.tsx`, `net_total = subtotal - discount + delivery_charge`. In `OverviewView.tsx`, calculating `grossSales - discounts - returnTotal` completely drops `delivery_charge` from the net revenue and profit figures.
* **Fix:** Calculate `netSales = Math.max(0, salesInvs.reduce((s, i) => s + Number(i.net_total || 0), 0) - returnTotal)`.

#### Issue 10: Heavy Unpaginated Data Loads in `GET /api/invoices`
* **File:** [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L20-L44), [`src/components/ceo-panel/CustomersView.tsx`](file:///d:/bestow/p-industry/src/components/ceo-panel/CustomersView.tsx#L33)
* **Impact:** `CustomersView` requests `GET /api/invoices?limit=5000`. The API executes `select('*, invoice_items(*)')`. For busy stores with thousands of historical invoices, this returns 20,000+ line items in a single JSON response, causing high memory usage and slow mobile loading.
* **Fix:** Support `select_fields=summary` in `GET /api/invoices` to omit `invoice_items(*)` when only invoice totals and metadata are needed.

#### Issue 11: Duplicate Secret Dev URL Route
* **File:** [`src/app/dev/alitouheedrajput01042005/page.tsx`](file:///d:/bestow/p-industry/src/app/dev/alitouheedrajput01042005/page.tsx#L1-L8)
* **Impact:** An exact copy of `AuraDevPanel` is hosted under the hardcoded personal path `/dev/alitouheedrajput01042005` in addition to the standard `/dev`.
* **Fix:** Remove the legacy directory `src/app/dev/alitouheedrajput01042005/` to keep routing clean and professional.

---

## 4. Database Findings Matrix

| Table Name | RLS Active | Active Policies | Primary Key | Foreign Key Cascade Risks | Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `tenants` | Yes | 0 (Default Deny) | `id` (UUID) | Root parent entity | Operational |
| `app_users` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (SET NULL) | Operational |
| `items` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `invoices` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `invoice_items` | Yes | 0 (Default Deny) | `id` (UUID) | `invoice_id` (CASCADE) | Operational |
| `purchases` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `purchase_items` | Yes | 0 (Default Deny) | `id` (UUID) | `purchase_id` (CASCADE) | Operational |
| `shifts` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `petty_expenses` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `clients` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `suppliers` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `held_invoices` | Yes | 1 (Tenant Isolation) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `vouchers` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `token_transactions` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `branch_orders` | Yes | 0 (Default Deny) | `id` (UUID) | `to_tenant_id`, `from_tenant_id` (NO ACTION) | ⚠️ Foreign Key Delete Risk |
| `branch_order_items` | Yes | 0 (Default Deny) | `id` (UUID) | `order_id` (CASCADE) | Operational |
| `audit_logs` | Yes | 0 (Default Deny) | `id` (UUID) | `tenant_id` (CASCADE) | Operational |
| `receipt_templates` | Yes | 0 (Default Deny) | `id` (UUID) | Template catalog | Operational |
| `tenant_receipt_template`| Yes | 0 (Default Deny) | `tenant_id` (UUID) | `tenant_id` (CASCADE), `template_id` | Operational |

### Database Integrity Highlights
1. **Unique Constraints**: Unique business keys enforced on `(tenant_id, invoice_no)`, `(tenant_id, purchase_no)`, `(tenant_id, voucher_no)`, `(tenant_id, code)` on items, and `slug` on tenants.
2. **Atomic Procedures**: Functions `adjust_item_stock` and `adjust_item_stock_by_code` exist and enforce `FOR UPDATE` row locking.

---

## 5. Security & Permission Audit Findings

1. **Dev Master PIN Authentication**:
   - Master PIN is read strictly from `DEV_ADMIN_PIN` in production.
   - Sliding window rate limiting prevents automated brute force (5 attempts / 15 minutes per IP).
   - "Lock Console" triggers server-side cookie deletion with correct flags (`SameSite=Lax`, `Path=/`).
2. **Tenant IDOR Protection**:
   - All tenant-scoped routes enforce `requireTenantAuth(req, tenantId)`.
   - Multi-branch sister store switching verifies identity against `session.ceoTenants` and database ownership.
3. **HTTP Security Headers**:
   - `next.config.ts` enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security`.

---

## 6. Business Logic & Calculation Verification

| Calculation | Formula Verified in Code | Accuracy Status |
| :--- | :--- | :---: |
| **Gross Sales** | $\sum \text{line\_price} \times \text{qty} \times (1 - \text{disc}\%)$ | ✅ Verified |
| **Sales Discounts** | $\sum \text{line\_discount} + \text{invoice\_discount}$ | ✅ Verified |
| **Net Sales (POS)** | $\text{Subtotal} - \text{Discounts} + \text{Delivery Charge}$ | ✅ Verified |
| **Expected Cash (Client)**| $\text{Open} + \text{Cash Sales} - \text{Cash Ret} - \text{Supplier Cash} - \text{Expenses} - \text{Token Red}$ | ✅ Verified |
| **Expected Cash (Server)**| Same as client | ❌ Broken (`expenses` typo) |
| **Store Advance Balance** | Negative balance supported on clients and suppliers | ⚠️ Broken in vouchers (`Math.max(0)`) |
| **Supplier Balances** | $\text{Balance} + \text{Due Amount} - \text{Return Credit}$ | ✅ Verified |
| **Token Safe Liability** | $\sum \text{Issued} - \sum \text{Redeemed}$ | ✅ Verified |
| **Day Close Variance** | $\text{Actual Counted Cash} - \text{Expected Cash}$ | ✅ Verified |

---

## 7. Areas Verified as Working Correctly

1. **Full Type Safety**: `npx tsc --noEmit` verified with 0 errors across the entire codebase.
2. **Thermal Printing**: Isolated iframe printing via `src/utils/iframePrint.ts` completely resolves print dialog blanking and CSS leakage.
3. **Template Customization**: POS receipts dynamically adopt branch name, header title, WhatsApp number, and footer text from configured Dev Panel templates.
4. **Inter-Branch Transfer Flow**: Full state machine (`pending` ➔ `accepted` ➔ `dispatched` ➔ `received`) with automatic stock decrements and increments.
5. **AI Bill Scanning**: Multi-model Gemini fallback with paint industry terminology normalization.
6. **Live Latency Ping**: Real branch roundtrip latency ping in `DevBranchPortalModal.tsx`.
7. **Dynamic Developer Identity**: Derived dynamically from authenticated developer accounts in `DevSidebar.tsx`.

---

## 8. Prioritized Remediation Roadmap

### Priority 1: Critical Financial & Functional Fixes
1. **Fix Shift Close Expense Deduction**: In [`src/app/api/shifts/route.ts`](file:///d:/bestow/p-industry/src/app/api/shifts/route.ts#L287), change `.from('expenses')` to `.from('petty_expenses')`.
2. **Fix Initial Inventory Load on Login**: In [`src/app/[slug]/page.tsx`](file:///d:/bestow/p-industry/src/app/%5Bslug%5D/page.tsx#L152), call `await refreshItems()` inside `handleLogin()`.
3. **Fix Client Advance Payments in Vouchers**: In [`src/app/api/vouchers/route.ts`](file:///d:/bestow/p-industry/src/app/api/vouchers/route.ts#L199), remove `Math.max(0, ...)` to preserve advance credit balances.

### Priority 2: Security & Tenant Isolation Fixes
4. **Scope `GET /api/tenants` on Server**: In [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L42), ensure non-developer users only receive their own branch or sister branches.
5. **Add Server-Side Logout Route**: Create `POST /api/auth/logout` to delete `pyntflow_session` cookie on POS logout.
6. **Fix Branch Deletion Cascade**: Clean up `branch_orders` and `branch_order_items` in `DELETE /api/tenants` before deleting the tenant.

### Priority 3: Concurrency & Code Cleanliness
7. **Clean Dead `ceo_tenants` Queries**: Remove phantom table references in `src/app/api/users/route.ts`.
8. **Adopt Atomic Stock RPC Everywhere**: Update `PATCH /api/invoices`, `POST /api/purchases`, and `POST /api/items/receive` to use `adjust_item_stock`.
9. **Remove Duplicate Secret URL Route**: Delete `src/app/dev/alitouheedrajput01042005/page.tsx`.
10. **Include Delivery Charges in Overview Net Sales**: Update formula in `src/components/ceo-panel/OverviewView.tsx`.
