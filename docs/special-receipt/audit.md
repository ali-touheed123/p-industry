# Codebase Audit: Special Receipt Feature

**Product:** PyntFlow POS & Industrial ERP  
**Architecture:** Next.js (App Router, React 19 / TSX) + Supabase (PostgreSQL 15, RLS) + Vercel Multi-Tenant  
**Audit Target Date:** 2026-10-21  
**Scope:** Phase 1 Codebase Audit covering the 9 required audit vectors plus billing summary button placement and keyboard shortcuts.

---

## 1. Regular Receipt Architecture & Print Mechanism

### Core Components & Modules
- **Rendering Engine:** [`src/utils/receiptRenderCore.ts`](file:///d:/bestow/p-industry/src/utils/receiptRenderCore.ts) (934 lines).
  A pure, framework-agnostic utility with zero external runtime dependencies. Key functions:
  - `renderReceiptDocument(data, templateOrRaw, paperSize)` (lines 919–933): Deeply normalizes template JSON, renders body HTML, wraps it with embedded CSS, and injects dynamic thermal height measurement scripts.
  - `renderReceiptBodyHtml(data, normalized)` (lines 514–914): Constructs HTML sections:
    1. Header (Logo, Shop Name, Address, Phone, Duplicate Notice, Return Banner)
    2. Invoice Meta (`Invoice #`, `Date:`, `Customer:`, `Staff:`, `Payment:`)
    3. Items Table (Tabular or 2-line compact layout, custom column visibility)
    4. Totals (Subtotal, Discount, GST tax, Net Total, Paid, Balance Due, Change)
    5. Footer (Notice lines 1 & 2, WhatsApp, `Powered by Pyntflow`, QR code placeholder)
    6. Token Claim Slip (Ticket slip for walk-in cash customer token redemptions)
  - `normalizeTemplate(rawTemplate, paperSize)` (lines 217–396): Normalizes runtime JSON against [`DEFAULT_TEMPLATE_JSON`](file:///d:/bestow/p-industry/src/types/receipt.ts#L155-L230).
  - `buildReceiptPageCss(layout, paperSize)` (lines 158–209): Generates `@page` media rules and font typography (`mono`, `sans`, `serif`).
- **Data Adapters:** [`src/utils/receiptAdapters.ts`](file:///d:/bestow/p-industry/src/utils/receiptAdapters.ts) (142 lines):
  - `buildPosThermalHtml(...)` (lines 10–79): Adapts active checkout invoice state into `RenderReceiptData`.
  - `buildSalesHistoryThermalHtml(...)` (lines 86–141): Adapts historical invoice records into duplicate receipt format (`isReprint = true`).
- **Printing Mechanism:** [`src/utils/iframePrint.ts`](file:///d:/bestow/p-industry/src/utils/iframePrint.ts) (115 lines):
  - `printViaIframe(htmlContent)`: Injects a hidden `<iframe>` with `id="pyntflow-print-frame"`, writes raw HTML document content, waits for resources/images to load, and calls `frame.contentWindow.print()`. Prevents browser popup blockers encountered on asynchronous promises.
- **Paper Sizes:** Defined in [`src/types/receipt.ts`](file:///d:/bestow/p-industry/src/types/receipt.ts#L148-L153):
  - `thermal_80` (80mm roll, 302px default width)
  - `thermal_58` (58mm roll, 219px default width)
  - `a4` (210mm portrait, 794px default width)
  - `a5` (148mm portrait, 559px default width)
- **Live Preview Simulator:** [`src/components/dev-panel/DevReceiptPreview.tsx`](file:///d:/bestow/p-industry/src/components/dev-panel/DevReceiptPreview.tsx) (503 lines):
  - Renders a live preview either via HTML `iframe` `srcDoc` (pixel-perfect print parity) or direct React DOM.
- **Canvas Fallback:** [`src/utils/receiptCanvas.ts`](file:///d:/bestow/p-industry/src/utils/receiptCanvas.ts) (462 lines):
  - Used for bitmap rasterization if required for raw ESC/POS thermal printer communication.

---

## 2. Receipt Settings & Global-vs-Branch Template Fallback

### Database Schema
Created in migration [`supabase/migrations/20260925_06_receipt_templates.sql`](file:///d:/bestow/p-industry/supabase/migrations/20260925_06_receipt_templates.sql):
- **`receipt_templates` Table:**
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `name TEXT NOT NULL`
  - `description TEXT`
  - `paper_size TEXT NOT NULL DEFAULT 'thermal_80'`
  - `template_json JSONB NOT NULL DEFAULT '{}'`
  - `is_default BOOLEAN NOT NULL DEFAULT FALSE`
  - `is_deleted BOOLEAN NOT NULL DEFAULT FALSE`
  - `created_at / updated_at TIMESTAMPTZ`
  - Unique partial index: `receipt_templates_single_default_idx ON receipt_templates (is_default) WHERE is_default = TRUE AND is_deleted = FALSE`.
- **`tenant_receipt_template` Table (Branch Assignment):**
  - `tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE`
  - `template_id UUID NOT NULL REFERENCES public.receipt_templates(id) ON DELETE CASCADE`
  - `assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### Fallback Logic ([`src/app/api/receipt-templates/branch/route.ts`](file:///d:/bestow/p-industry/src/app/api/receipt-templates/branch/route.ts))
1. **GET `/api/receipt-templates/branch?tenant_id=...`:**
   - Queries `tenant_receipt_template` for `tenant_id`.
   - If found and template is not deleted: returns the branch's assigned template with `is_custom = (!assignedTmpl.is_default)`.
   - If NOT found (or soft-deleted): queries `receipt_templates` where `is_default = true`, returning it with `is_custom = false`.
   - If no default exists in DB: falls back to hardcoded `DEFAULT_TEMPLATE_JSON`.
2. **POST `/api/receipt-templates/branch`:**
   - If branch is currently using the platform default, it **never modifies the default record**. Instead, it creates a brand new row in `receipt_templates` (`is_default: false`) and updates `tenant_receipt_template` to point to the new custom ID.
   - If branch already has an exclusive custom template (`count == 1`), it updates that row in place.
   - If the custom template is shared by multiple tenants, it clones a new independent row to prevent cross-tenant side effects.
3. **DELETE `/api/receipt-templates/branch?tenant_id=...`:**
   - Removes row from `tenant_receipt_template`. The branch immediately reverts to the platform default template.
4. **POS User UI ([`src/components/BranchReceiptSettings.tsx`](file:///d:/bestow/p-industry/src/components/BranchReceiptSettings.tsx)):**
   - Live visual editor embedded in POS sidebar tab `Receipt Settings` (accessible when `activeTab === 'receipt'`).
   - Split view: left column has 7 configuration tabs (Store & Header, Paper & Page, Invoice Meta, Table Columns, Totals & Tax, Footer & Notes, Custom Labels), right column has interactive thermal preview.

---

## 3. POS Invoice Screen Structure, Cart State & Button Placement

### Screen Component
- **Component File:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx) (2,650 lines).
- **Cart State:**
  - `lineItems: InvoiceLineItem[]` (lines 142–143).
  - Each `InvoiceLineItem` interface (lines 54–79) stores:
    - `id: string`
    - `item?: Item` (live DB product object)
    - `code: string` (item code / barcode)
    - `productName: string`
    - `brand?: string` (brand name string, e.g. "Dulux", "Berger")
    - `brand_id?: string` (UUID foreign key to `brands.id`)
    - `series_id?: string`, `series_name?: string`
    - `category?: string`, `shadeCode: string`
    - `qty: number`, `unit: string`, `packSize: string`
    - `rate: number` (current unit price for this invoice)
    - `originalRate?: number` (reference price before token discount)
    - `discountPercent: number`
    - `hasToken?: boolean`, `tokenValue?: number`, `tokenAction?: 'keep' | 'remove'`
- **Current Cart Price Editing:**
  - In the line items table (lines 1620–1870), `code`, `productName`, and `shadeCode` are editable via inputs.
  - Line `rate` is currently rendered as read-only text:
    `item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })` (line 1821).
  - Rate overrides currently occur when adding an item or through token removal (`handleToggleTokenAction` lines 200–215). There is no inline rate input in the main billing table.
- **Brand Access per Product:**
  - When products are loaded via [`/api/items?tenant_id=...`](file:///d:/bestow/p-industry/src/app/api/items/route.ts#L143-L195), each product record contains `brand` (string) and `brand_id` (UUID).
  - When added to `lineItems` via `handleAddItem` (lines 672–696), `prod.brand` and `prod.brand_id` are explicitly assigned to `newLineItem.brand` and `newLineItem.brand_id`.
  - Therefore, **the cart already has instant access to every item's `brand_id` and `brand` name without requiring additional queries.**
- **Existing Billing Summary & Button Placement (Lines 2064–2108):**
  Located in the right-hand billing summary sidebar (`<aside className="pos-sidebar">`):
  1. `pos-btn-checkout` (Primary Save & Print):
     `<button onClick={() => handleCheckout(true)} className="pos-btn-checkout">Save & Print (F5)</button>` (orange background `#f97316`).
  2. Side-by-side action buttons:
     - `Save (F2)` (`onClick={() => handleCheckout(false)}`)
     - `Hold (F7)` (`onClick={handleHoldInvoice}`)
  3. Outline Cancel button:
     - `Cancel Invoice (F9)` (`onClick={handleCancelInvoice}`)
- **Keyboard Shortcuts Map (Lines 98–106 & Lines 1145–1183):**
  - `F2`: Save invoice without printing
  - `F3`: Focus product search input
  - `F4`: Add selected product to cart
  - `F5`: Save & Print regular receipt
  - `F7`: Hold current invoice
  - `F8`: Open held invoices modal
  - `F9`: Cancel/clear invoice
  - `Escape`: Close modals / dropdowns
  - **Conflict check for F6:** `F6` is **completely unused** across `PosBilling.tsx` and the entire repository. Proposing `F6` for `SPECIAL SAVE & PRINT` is completely collision-free.

---

## 4. Invoice Persistence & Data Integrity Across Day Close, Reports, Stock & Profit

### Invoice Creation Flow
1. POS triggers `handleCheckout` in [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L864-L1003).
2. Sends `POST` to [`src/app/api/invoices/route.ts`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L116-L332).
3. Route validates amounts (VAL-03 bounds check, client credit limits) and calls PostgreSQL RPC `create_invoice_atomic`:
   [`supabase/migrations/20261002_02_atomic_invoice_tokens.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261002_02_atomic_invoice_tokens.sql#L64-L245).
4. `create_invoice_atomic` executes within an atomic transaction:
   - Inserts row into `public.invoices` with `subtotal`, `discount`, `net_total`, `paid_amount`, `due_amount`, `payment_type`, `cash_paid`, etc.
   - Inserts rows into `public.invoice_items` with `item_id`, `item_code`, `item_name`, `qty`, `unit_price`, `discount`, `total_price`.
   - Deducts stock from `public.items`:
     `UPDATE items SET stock_qty = stock_qty - v_item_qty WHERE id = v_item_id;`
   - **Crucial verification:** `create_invoice_atomic` **NEVER touches `items.retail_price` or `items.cost_price`**. The product master price is completely immutable during checkout.
   - Updates client Khata balance if credit sale: `UPDATE clients SET current_balance = current_balance + v_due_amount WHERE id = v_client_id;`.

### Impact of Saving at Edited Price
Let's trace how downstream consumers read sales and prices:

| Subsystem | File & Lines | Data Source | Impact of Edited Price |
| :--- | :--- | :--- | :--- |
| **Cashier Shift Drawer** | [`src/components/ShiftDrawer.tsx:215-260`](file:///d:/bestow/p-industry/src/components/ShiftDrawer.tsx#L215-L260) | `invoices.net_total`, `invoices.cash_paid`, `invoices.due_amount` | **100% Consistent.** Reads cash actually collected on the invoice. Cash drawer reconciliation remains exact. |
| **Day Close Reconciliation** | [`src/utils/cashReconciliation.ts:20-28`](file:///d:/bestow/p-industry/src/utils/cashReconciliation.ts#L20-L28) | `cashSales - cashReturns - expenses - payouts` | **100% Consistent.** Uses cash collected from invoice headers. |
| **CEO Executive P&L** | [`src/components/ceo-panel/OverviewView.tsx:185-235`](file:///d:/bestow/p-industry/src/components/ceo-panel/OverviewView.tsx#L185-L235) | `netSales` from `invoices.net_total`; COGS from `items.cost_price * qty` | **100% Consistent.** `Gross Profit = netSales - COGS`. Since `netSales` uses the invoice's saved total and COGS uses master `cost_price`, profit reflects the exact realized sale margin. |
| **Inventory Stock Level** | `create_invoice_atomic:229-245` | `items.stock_qty - v_item_qty` | **100% Consistent.** Deducts physical unit quantity sold; price has zero effect on stock quantity. |
| **Inventory Valuation** | [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts) | `SUM(stock_qty * cost_price)` | **100% Consistent.** Evaluated using `cost_price` from master catalogue, which is never modified. |

### Critical Danger / Mismatch Risk
If the POS user edits an item price in the Special Receipt flow:
- `lineItem.rate` must be updated.
- Line `total_price = lineItem.qty * edited_rate * (1 - discountPercent / 100)`.
- Invoice `subtotal` must equal `SUM(line_total_prices)`.
- Invoice `net_total` must equal `subtotal - invoice_discount + delivery_charge`.
- Tender amounts (`paid_amount`, `cash_paid`, `due_amount`) must be recalculated against the new `net_total`.
**If only the receipt print text is edited without recalculating the invoice payload, `invoices.net_total` will disagree with `invoice_items` and Day Close cash will be mismatched.** Saving the invoice with recalculated totals eliminates this mismatch entirely.

---

## 5. Developer Panel User Permissions & Existing Permission Patterns

### User Table & Model
- The system user table is **`public.app_users`** (NOT `pos_users`).
  Migration reference: [`supabase/migrations/20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261012_01_app_users_fk_cascade.sql).
- Schema of `public.app_users`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `username TEXT UNIQUE NOT NULL`
  - `password_hash TEXT NOT NULL`
  - `full_name TEXT NOT NULL`
  - `email TEXT`
  - `role TEXT NOT NULL CHECK (role IN ('developer', 'ceo', 'staff', 'godown_staff'))`
  - `tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE`
  - `is_active BOOLEAN NOT NULL DEFAULT TRUE`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Existing User Management in Developer Panel:**
  - View component: [`src/components/dev-panel/DevUsersView.tsx`](file:///d:/bestow/p-industry/src/components/dev-panel/DevUsersView.tsx) (413 lines).
  - Modal component: [`src/components/dev-panel/DevUserModal.tsx`](file:///d:/bestow/p-industry/src/components/dev-panel/DevUserModal.tsx) (271 lines).
  - API endpoint: [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts) (GET, POST, PUT, DELETE).
- **Pattern to Follow:**
  Add `can_use_special_receipt BOOLEAN NOT NULL DEFAULT FALSE` to `app_users`.
  In `DevUserModal.tsx`, when role is `staff` (POS user), show a toggle switch:
  `Allow Special Receipt Designer & Printing`.
  The `/api/users` PUT and POST endpoints pass this boolean to `app_users`.
  Login endpoint [`src/app/api/auth/login/route.ts`](file:///d:/bestow/p-industry/src/app/api/auth/login/route.ts#L71-L76) returns `can_use_special_receipt` in `sanitizedUser` and encodes it in JWT `UserSession` ([`src/lib/session.ts`](file:///d:/bestow/p-industry/src/lib/session.ts#L13-L21)).

---

## 6. Roles & Multi-Tenancy Enforcement (RLS, Tenants & Gaps)

### Multi-Tenancy Identifiers
- **Branch / Shop Entity:** The canonical branch entity in PyntFlow is **`public.tenants`** (`id UUID`, `slug TEXT`, `name TEXT`, `type TEXT`).
- In all database tables (`invoices`, `items`, `brands`, `clients`, `vouchers`, `purchases`, `app_users`), the branch foreign key is named **`tenant_id`**.
- There is **no table named `shops` or column named `shop_id`** in the existing database.
- A CEO account owns multiple branches by matching `owner_name` or `email` across `tenants` ([`src/lib/session.ts:150-185`](file:///d:/bestow/p-industry/src/lib/session.ts#L150-L185)).

### Role Enforcement & RLS Pattern
- The Next.js backend uses `supabaseAdmin` (the `service_role` key) for API execution.
- Security and tenancy isolation are enforced at the API route layer using:
  - `requireDevAuth(req)`: Developer super-admin only.
  - `requireTenantAuth(req, tenantId)`: Verifies caller's session belongs to `tenantId` (or CEO sister branch list).
- Database-Level RLS:
  Migration [`supabase/migrations/20261004_01_harden_rls_policies.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261004_01_harden_rls_policies.sql) restricted public access to `FOR ALL TO service_role USING (true) WITH CHECK (true)`.
- **Identified Gap & Requirement:**
  For `special_print_log`, requirement 8 states:
  *"RLS: insert only by a POS user with the permission; select only by the CEO of that shop; no update or delete for anyone."*
  Because Pyntflow API routes use `supabaseAdmin` (which bypasses RLS by default), enforcement must occur at **both** levels:
  1. In the Next.js API route (`/api/special-print-log`), verify JWT session has `role === 'staff'` and `can_use_special_receipt === true` on POST, and `role === 'ceo'` on GET.
  2. In PostgreSQL, enable RLS on `special_print_log` with `NO UPDATE` and `NO DELETE` policies, and restrict direct inserts and queries.

---

## 7. Brand Model: Products, Brands & Branches

### Relational Schema
- Migration [`supabase/migrations/20261002_01_paint_token_management.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261002_01_paint_token_management.sql):
  - **`brands` Table:**
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
    - `name TEXT NOT NULL`
    - `status TEXT DEFAULT 'active'`
    - Unique constraint: `UNIQUE (tenant_id, name)`.
  - **`brand_series` Table:**
    - `id UUID PRIMARY KEY`, `tenant_id UUID`, `brand_id UUID REFERENCES brands(id) ON DELETE CASCADE`, `name TEXT`.
  - **`items` Table (Products):**
    - `tenant_id UUID NOT NULL REFERENCES public.tenants(id)`
    - `brand TEXT`, `brand_id UUID REFERENCES brands(id) ON DELETE SET NULL`
    - `series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL`
    - `code TEXT NOT NULL`, `name TEXT NOT NULL`, `retail_price NUMERIC`, `stock_qty NUMERIC`.
- **How Branches Relate to Brands:**
  - Brands are tenant-scoped (`brands.tenant_id`). Each branch has its own brand catalogue.
  - Items in that branch reference `items.brand_id`.
  - Therefore, `special_receipt_brands` linking `(branch_id, brand_id)` translates cleanly in this schema to `(tenant_id, brand_id)` where both `tenant_id` and `brand_id` reference existing tables.

---

## 8. Automatic Shop Identity Leaks on Receipts

In [`src/utils/receiptRenderCore.ts`](file:///d:/bestow/p-industry/src/utils/receiptRenderCore.ts), the regular receipt renderer has multiple default fallbacks that automatically print store identity:

| Line Reference | Leaking Code / Fallback | Current Behavior | Special Receipt Requirement |
| :--- | :--- | :--- | :--- |
| **Line 536** | `header.showShopName ? escapeHtml(header.customShopName \|\| data.tenantName \|\| 'PyntFlow Store')` | If `showShopName` is true and `customShopName` is blank, falls back to `data.tenantName` or `'PyntFlow Store'`. | Must start fully blank (`showShopName: false`, `customShopName: ''`). |
| **Line 539** | `const effectiveAddress = header.customAddress?.trim() \|\| data.tenantAddress?.trim() \|\| 'Retail & Industrial Paint Hub'` | If address enabled, falls back to branch address or hardcoded default. | Must start blank (`showAddress: false`, `customAddress: ''`). |
| **Line 546** | `header.showPhone && effectivePhone` (using `data.tenantPhone`) | Injects branch phone number. | Must start blank (`showPhone: false`, `customPhone: ''`). |
| **Line 523–527** | `header.showLogo && header.logoUrl` | If enabled, renders branch logo image. | Must start blank (`showLogo: false`, `logoUrl: ''`). |
| **Line 600–605** | `invoiceInfo.showCashier && data.staffName` | Renders `Staff: Counter Staff`. | Must start blank (`showCashier: false`). |
| **Line 872–874** | `if (footer.showPoweredBy) footer.poweredByText \|\| 'Powered by Pyntflow'` | Injects `'Powered by Pyntflow'` at the bottom of the receipt! | **CRITICAL LEAK.** Must be explicitly `showPoweredBy: false`, `poweredByText: ''`. |
| **Line 889–904** | `tokenClaimSlipSection` | If invoice items have paint tokens, automatically prints a dashed Token Claim Slip. | **CRITICAL LEAK.** Must be `tokenClaimSlip.enabled: false`. |
| **Line 256–260** | `showInvoiceNo: true; showDate: true; showGrandTotal: true;` | Hardcoded locked `true` in `normalizeTemplate` for audit compliance. | For Special Receipt, POS user must have total blank-canvas freedom to toggle or relabel these fields. |
| **Line 926** | `const title = Receipt ${data.invoiceNo \|\| ''}` | Injects document `<title>` in print window. | Keep generic (`Receipt`) or empty. |

**Audit Conclusion for Identity Leaks:**
To fulfill Requirement 1b ("must start fully empty. No shop name, number, address, logo, or system branding unless the POS user adds it manually"), we cannot pass a Special Receipt through standard `normalizeTemplate` without creating a specialized `BLANK_SPECIAL_TEMPLATE_JSON` and a dedicated `normalizeSpecialTemplate` routine that disables all branding defaults.

---

## 9. System Risks & Edge Cases

1. **Risk of Breaking Regular Receipt:**
   - The regular receipt is used by all branches daily. Any shared edits to `DEFAULT_TEMPLATE_JSON` or `normalizeTemplate` could cause visual regressions or broken columns on standard thermal receipts.
   - *Mitigation:* Special receipt templates must be stored in a dedicated table `special_receipt_templates` and rendered using isolated normalization defaults.
2. **Race Condition: Log Insert vs. Print Dialog:**
   - Browsers freeze JS execution while the native `window.print()` dialog is open. If print is triggered before log insertion resolves, a user could close the tab and print a receipt without a log record.
   - *Mitigation:* Strict sequence:
     `await saveInvoice()` $\rightarrow$ `await insertSpecialPrintLog()` $\rightarrow$ `if (logSuccess) printViaIframe()`. If log insertion fails, display an error modal and never open the print dialog.
3. **Offline Behavior:**
   - PyntFlow POS requires network connectivity to finalize sales (`/api/invoices`). If the counter loses connection, neither the invoice nor the log can be saved.
   - *Mitigation:* No offline bypass for Special Print. If offline, the transaction is rejected at checkout.
4. **Duplicate Prints & Sales History Reprints (Decision D2 & A4):**
   - Currently, clicking Reprint in `SalesHistory.tsx` uses `assignedTemplate` (the regular template) and appends `DUPLICATE RECEIPT`.
   - If an invoice was printed as `printed_as = 'special'`, reprinting it with the regular template would leak the shop's identity!
   - *Mitigation (D2 & A4):* If `invoices.printed_as === 'special'`, Reprint is strictly restricted to staff with fresh `can_use_special_receipt` in that branch. It uses `log_special_reprint_atomic` to fetch the snapshot, record an audit row (`event_type = 'reprint'`), and print via iframe. Reprints are strictly blocked if `invoices.status = 'cancelled'`. CEO and developer cannot trigger paper reprints.
5. **Invoice Edit Blocked & Return Flows (Decisions D1, D4 & Return Architecture - Verified against Live DB):**
   - *Live Function Audit:* `update_invoice_atomic`, `create_invoice_atomic`, and `cancel_invoice_atomic` were inspected via `pg_get_functiondef` on the live database (`ignspvajzblmsbertmmv`). Live `update_invoice_atomic` deletes and re-inserts `invoice_items` and updates `invoices`. It currently does not know about `printed_as`.
   - *Decision D1:* Special invoices cannot have items or prices edited by anyone (staff, CEO, or developer). Wrong sale = cancel invoice + create new special sale. `update_invoice_atomic` must be patched to reject any invoice where `printed_as = 'special'`.
   - *Standard Returns vs. Special Returns (Accepted Risk):* Standard POS returns (`invoice_type = 'return'`) in PyntFlow create freestanding credit notes with no foreign key or column linking back to an original sale invoice (`invoices` has no `original_invoice_id`). Consequently, **it is impossible to block a cashier from returning a special-sale item via the standard POS return screen**. This risk (refunding at catalog price where shop loses money) is an accepted business risk until POS return screen adds special invoice validation.
   - *Special Returns Architecture (Option a Chosen - F1 & F2):* Dedicated return flow initiated exclusively from Sales History on special invoices, calling `create_special_return_atomic`.
      - **Choice of Option (a) over Option (b):** Live `create_invoice_atomic` does NOT insert `original_invoice_item_id`. An update loop matching by `item_id` is ambiguous if the same item appears on two lines of an invoice (e.g. different tinting or separate packings). Furthermore, live `create_invoice_atomic` has a severe double-refund bug for card refunds (computing `v_cash_refunded := 0` when `payment_type = 'card'`, causing `v_store_credit := v_net_total` to reduce client balance even though funds were returned to the card).
      - **Safety of Option (a):** `create_special_return_atomic` inserts return invoice headers and return `invoice_items` directly with exact `original_invoice_item_id = original_line.id`. When two lines on an original invoice share the same `item_id`, returning from Line 2 links exclusively to Line 2's ID. Line 1's returnable quantity (`original_qty - sum(returned_qty where original_invoice_item_id = line1.id)`) remains 100% unaffected.
      - **Tender Field Semantics (F2 & R1c):**
        - Cash refund: `cash_paid = refund_total, card_paid = 0, paid_amount = refund_total, payment_type = 'cash'`. Reduces drawer cash; client balance unchanged.
        - Card refund: `cash_paid = 0, card_paid = refund_total, paid_amount = refund_total, payment_type = 'card'`. Drawer cash unchanged; client balance unchanged.
        - Store credit: `cash_paid = 0, card_paid = 0, paid_amount = 0, payment_type = 'credit'`. Reduces `clients.current_balance` (credits customer ledger); drawer cash unchanged.
        - Mixed tender: `cash_paid = cash, card_paid = card, paid_amount = cash + card, payment_type = 'mixed'`. `clients.current_balance` is reduced by store credit only (`p_store_credit`). Drawer cash reduced by `cash_paid`.
        - Walk-in cash refund: `client_id = null, cash_paid = refund_total, paid_amount = refund_total, payment_type = 'cash'`. Reduces drawer cash; store credit forbidden for walk-ins.
      - **Cancel Asymmetry Note & Real Cancel Endpoints:** Live `cancel_invoice_atomic:907–917` computes store credit whenever `v_invoice.net_total - v_cash_ref > 0`. Because it has no awareness of `card_paid`, cancelling a return with card or mixed tender treats `card_paid` as store credit and credits `clients.current_balance`, corrupting the ledger. The real cancellation routes are `PATCH /api/invoices` (`action: 'cancel'`) and `DELETE /api/invoices` (`src/app/api/invoices/route.ts:371–385, 535–546`). Decision D5 enforces blocking cancellation of return invoices at the API layer. Residual risk remains that `cancel_invoice_atomic` is `SECURITY DEFINER` and could be invoked directly via PostgREST RPC if exposed.
      - **Option E Mandate:** **NO receipt of any kind is printed for special returns** (no customer slip, no internal copy).
6. **Token Behavior on Special Return (Decision 3 & Phase 8):**
   - *Regular POS Parity:* In `src/components/PosBilling.tsx:1700–1728`, return lines with paint tokens provide a toggle for `tokenReturnedWithBucket`. If unchecked (`tokenReturnedWithBucket === false`), the frontend UI deducts the token value from the refund rate: `effectiveRate = Math.max(0, rate - tokenValue)`.
   - *Special Return Flow:* The Special Return UI mirrors this client-side rate deduction before submitting to `create_special_return_atomic`.
   - *Token Transactions on Returns:* Live `create_invoice_atomic:643` writes NO token transactions for returns (`-- Returns do not issue tokens or create stockpile entries`). Special returns follow this exact rule; `create_special_return_atomic` has no `p_tokens` parameter and skips token creation entirely.
   - *Receipt Suppression Rule D4:* Tokens are never mentioned on any receipt paper (and special returns print no paper anyway).
7. **Delivery Charge Consistency (F7):**
   - *Paper Receipt:* Delivery charge is shown as an explicit separate line item at full value (`delivery_charge`).
   - *`printed_total`:* Includes delivery charge (`sum(qty * printed_rate) + delivery_charge`).
   - *`charged_total` (`net_total`):* Includes delivery charge (`sum(qty * charged_rate) + delivery_charge`).
   - *`master_total` (`special_receipt_snapshots.master_total`):* Strictly **EXCLUDES** delivery charge (`sum(qty * master_rate)`). Delivery is a logistics service fee, not inventory product value; excluding it prevents distorting the CEO inventory markup/pricing variance (`charged_total - master_total`).
8. **Invoice-Level Discount Handling (F8):**
   - On special sales, invoice-level discounts are strictly prohibited (line discounts only).
   - If a client or caller submits `discount <> 0` to `/api/invoices/special` or `create_special_invoice_atomic`, the system must **REJECT** with: `'Invoice-level discount is not allowed on special invoices (must be 0). Apply discounts at line-level only.'` (Do not silently ignore).
9. **Return Discount & Fee Guard Cleanup (F9):**
   - Dead variables (`v_line_discount`, `v_return_discount`) are removed from `create_special_return_atomic`.
   - Delivery charges from the original invoice are not refunded on returns (return `delivery_charge = 0`).
   - If an original invoice somehow has `invoices.discount > 0`, the return RPC rejects with an error requiring manual review.
10. **Shift Ownership & Binding (Evidence for F5):**
    - Code inspection of `src/app/api/shifts/route.ts:126`, `src/app/[slug]/page.tsx:179, 766`, `src/components/PosBilling.tsx:945`, and `src/app/api/invoices/route.ts:260` proves regular POS checkout binds `shift_id` by passing the tenant's active open shift from the client session.
    - Special Sale and Special Return API routes mirror this: they accept `shift_id` from the client or lookup the active open shift of the tenant, rather than having the database RPC guess an arbitrary open shift.
11. **Authoritative Impact of `others_paid` on Drawer Cash (Evidence for F6):**
    - In `src/utils/salesMath.ts:147–150`, returns with `paid_amount > 0` but `cash_paid = 0, card_paid = 0, bank_paid = 0` fall back to `invCash = paid` and subtract that amount from `physicalCash` (the cash drawer).
    - In `src/app/api/shifts/route.ts:271`, `payment_type = 'others'` with `cash_paid = 0` does not affect `cashReturns`.
    - In `src/components/ShiftDrawer.tsx:234–241`, `cashReturns` only adds when `cash_paid > 0` or `payment_type = 'cash'`.
    - In `get_ceo_branches_kpi_summary`, returns are completely excluded (`COALESCE(i.invoice_type, '') <> 'return'`).
    - *Precautionary Rule:* To prevent `salesMath.ts` from subtracting cash on store credit returns, store credit returns must pass `cash_paid = 0, card_paid = 0, bank_paid = 0, others_paid = 0, paid_amount = 0, payment_type = 'credit'`.
12. **Invoice Storage Rule (Owner Decision 1):**
    - `invoices.subtotal` represents the sum of line totals **AFTER** line discounts.
    - `invoices.discount` stores the **invoice-level discount only** (strictly 0 for special sales).
    - Line discounts are stored strictly in `invoice_items.discount` and reflected in `invoice_items.total_price`.

---

## 10. Live Database State Verification Summary

*Status: Verified against live production database (`ignspvajzblmsbertmmv`) and staging project (`azzonbwaevtywisxlxej`) on 2026-10-21 via Supabase MCP (READ-ONLY).*

| Entity / Object | Live DB State | Impact on Special Receipt Plan | Evidence / Tool Call |
| :--- | :--- | :--- | :--- |
| `public.invoices.printed_as` | **Does NOT exist** | Added via migration: `TEXT NOT NULL DEFAULT 'regular' CHECK (printed_as IN ('regular', 'special'))`. | `information_schema.columns` query on `invoices` |
| `public.invoices.original_invoice_id` | **Does NOT exist** | Added via migration: nullable plain `UUID` without FK, links special return back to original sale. | `information_schema.columns` query on `invoices` |
| `public.invoice_items.original_invoice_item_id` | **Does NOT exist** | Added via migration: nullable plain `UUID` without FK, tracks returned quantity per line item cleanly. | `information_schema.columns` query on `invoice_items` |
| `public.app_users.can_use_special_receipt` | **Does NOT exist** | Added via migration: `BOOLEAN NOT NULL DEFAULT FALSE`. | `information_schema.columns` query on `app_users` |
| `public.special_receipt_templates` | **Does NOT exist** | Created via migration. | `information_schema.tables` query |
| `public.special_receipt_brands` | **Does NOT exist** | Created via migration. | `information_schema.tables` query |
| `public.special_print_log` | **Does NOT exist** | Created via migration: `master_total`, `printed_total`, `charged_total`, `original_invoice_id`. | `information_schema.tables` query |
| `update_invoice_atomic` | **Verified live definition** | Security definer, lacks `printed_as` check. Patched to reject D1 edits. | `pg_get_functiondef` on `update_invoice_atomic` |
| `create_invoice_atomic` | **Verified live definition** | Has card refund double-refund bug (L622-632); does not insert `original_invoice_item_id`. Return flow bypassed via Option (a). | `pg_get_functiondef` on `create_invoice_atomic` |
| `cancel_invoice_atomic` | **Verified live definition** | Security definer; reverses stock, client balances, and token transactions. Note cancel asymmetry for card refunds. | `pg_get_functiondef` on `cancel_invoice_atomic` |
| `shifts` columns | **Verified live schema** | Columns: `id, tenant_id, opened_by, closed_by, start_time, end_time, opening_cash, expected_cash, actual_cash, difference, notes, status, created_at, previous_closing_cash, handover_variance, handover_notes`. *(NO user_id column)*. | `information_schema.columns` query |
| `brands` columns | **Verified live schema** | Columns: `id, tenant_id, name, status, created_at, updated_at`. *(NO description/is_active columns)*. | `information_schema.columns` query |
| `brand_series` columns | **Verified live schema** | Columns: `id, tenant_id, brand_id, name, status, created_at, updated_at`. | `information_schema.columns` query |
| `series_token_configs` columns | **Verified live schema** | Columns: `id, tenant_id, series_id, unit_name, is_enabled, token_value, is_drum_auto, created_at, updated_at`. | `information_schema.columns` query |
| `clients` columns | **Verified live schema** | Columns: `id, tenant_id, code, name, phone, city, area, address, credit_limit, current_balance, created_at, token_balance`. | `information_schema.columns` query |
| `token_transactions` columns | **Verified live schema** | Columns: `id, tenant_id, type, invoice_id, redemption_id, client_id, client_name, brand_id, brand_name, series_id, series_name, unit_name, token_value, quantity, remaining_quantity, total_amount, usage_status, shift_id, notes, write_off_reason, settled_vendor_name, used_against_purchase_id, used_against_voucher_id, parent_transaction_id, created_by, created_at`. | `information_schema.columns` query |
| Table RLS Status | **Verified** | Tables in `public` have RLS enabled with `FOR ALL TO service_role USING (true) WITH CHECK (true)`. Database access is restricted to `service_role` and SECURITY DEFINER RPCs. | `pg_tables` & `pg_policies` query |
| Staging Project `azzonbwaevtywisxlxej` | **Verified** | Confirmed via Supabase MCP `list_projects`: project name `"for staging"`, region `"ap-northeast-2"`, status `"ACTIVE_HEALTHY"`, engine `"17.11.0.003"`. | `supabase-mcp-server:list_projects` tool call |
| Core Receipt Files | **Verified repo paths** | `src/utils/receiptRenderCore.ts` and `src/utils/receiptAdapters.ts`. | Filesystem inspection |

*(All unlisted items, such as physical printer drivers and client OS font rendering, are marked **UNVERIFIED** until target hardware testing.)*
