# PyntFlow — Token System Complete Deep Technical Audit

> **Audit Date:** September 30, 2026  
> **Target System:** PyntFlow Paint ERP / POS Multi-Tenant Platform  
> **Audit Scope:** Full Stack (Database Schemas, Migrations, Backend APIs, POS Engine, Inventory & Shades, Ledger & Accounting, Shift Drawer & Cash Reconciliation, CEO/Manager/Dev Panels, Security & Multi-Tenancy)  
> **Status:** Code & Database Frozen (Pure Audit & Verification — Zero Modifications Made)

---

## 1. Executive Summary

In the Pakistani paint retail market (brands such as Master Paints, Brighto, Berger, Diamond, Dulux, Kansai), **paint tokens** are high-value physical incentives (plastic tokens, printed coins, or scratch cards) placed inside or beneath the lid of paint buckets (typically 16L drums and 4L gallons). They have real monetary value (typically Rs. 200 to Rs. 2,000 per bucket).

The PyntFlow Token System was implemented to handle:
1. Token issuance or instant discount deduction at POS checkout.
2. Customer / Painter token redemptions.
3. Safe-deposit physical token stockpile tracking.
4. Surrendering accumulated tokens to paint company sales reps or applying them against supplier purchase invoices.

### Audit Verdict
While PyntFlow has an extensive UI and dedicated database tables for tokens across POS, Purchases, Ledgers, Shift Close, and the CEO Suite, **the Token System contains architectural flaws, mathematical discrepancies in cash reconciliation, asynchronous non-atomic operations, and a critical conflation between physical token identities and purchased product shades**. 

---

## 2. Domain Reality vs. Current PyntFlow Implementation

| Domain Reality (Pakistani Paint Retail) | Current PyntFlow Implementation | Audit Finding / Gap |
| :--- | :--- | :--- |
| **Physical Token Identity:** A token represents a **Brand + Product Series / Bucket Size + Denomination** (e.g., *Master Super Emulsion 16L Bucket — Rs. 500*). Factory tokens **never have shade codes or tint names** on them because paint bases are manufactured and packed before tinting. | Token configuration is attached directly to the `items` table per shade SKU (`has_token`, `token_value`). | **Critical Flaw:** If a shop has 50 shades of "Master Super Emulsion", there are 50 separate `item_id`s. System checks token balance against specific shade `item_id`, preventing cross-shade redemption. |
| **Token Action at Sale:** Customer buys a bucket. If customer leaves token at shop ("Remove"), customer gets instant discount; shop retains physical token. If customer takes token ("Keep"), customer leaves with physical token intact. | Supported in POS (`PosBilling.tsx`): `tokenAction: 'keep' \| 'remove'`. 'Remove' adjusts line rate down by `token_value`. | **Working partially, but:** Generates non-atomic asynchronous POST requests to `/api/tokens` from client-side loop after invoice creation. |
| **Customer Token Redemption Event:** A painter brings 5 physical Master tokens (Rs. 500 each = Rs. 2,500) to the counter. The painter can either: <br>a) Take **Cash payout** (Rs. 2,500). <br>b) Buy **completely different paint/shades** (e.g. 2 gallons of Brighto Weathercoat) and tender the Rs. 2,500 tokens as payment. | Redemption Modal (`TokenRedemption.tsx`) only supports **Cash Payout**. Tender during POS billing (`PosBilling.tsx`) only allows registered clients with a virtual `token_balance`—**walk-in painters cannot tender physical tokens during a bill**. | **Architectural Disconnect:** When tokens are tendered in POS billing, no physical token identity (brand, denomination, count) is collected. System creates a phantom `redeemed` record with `brand = null`. |
| **Physical Stockpile in Shop Safe:** Shop holds physical tokens collected from: <br>1. Buckets opened at sale (tokens removed). <br>2. Customer cash redemptions. <br>3. Tokens accepted as billing tender. | Managed in `token_transactions` with `usage_status = 'available'`. | When virtual client token balance is applied at POS, a record with `brand = null` enters the stockpile as brand `'General'` worth whatever random invoice discount was applied. |
| **Vendor Settlement:** Shop surrenders physical tokens to the manufacturer's sales representative for cash, or hands them over with a purchase order to reduce supplier invoice payable. | Supported in `TokenLedger.tsx` (`settle_vendor`), `PurchasesView.tsx` (`applied_token_ids`), and `FinancialLedgers.tsx` (Supplier Payment Voucher). | Purchases and Vouchers require applying entire transaction rows; they cannot partially split a multi-token row. |

---

## 3. Database Architecture & Schema Trace

### 3.1 Tables and Columns

#### 1. Table: `items`
Added in migration [feature_2_paint_token_system.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_paint_token_system.sql):
- `brand` (`TEXT NOT NULL DEFAULT 'General'`)
- `has_token` (`BOOLEAN DEFAULT FALSE`)
- `token_value` (`NUMERIC(10,2) DEFAULT 0`)

#### 2. Table: `clients`
Added in migration [feature_2_paint_token_system.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_paint_token_system.sql):
- `token_balance` (`NUMERIC(10,2) DEFAULT 0`) — Stores running unredeemed loyalty credit balance for registered clients.

#### 3. Table: `token_transactions` (Core Ledger)
Defined across 5 migrations:
- [feature_2_paint_token_system.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_paint_token_system.sql)
- [feature_2_token_claims.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_token_claims.sql)
- [feature_2_token_stockpile_usage.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_token_stockpile_usage.sql)
- [feature_2_token_stockpile_redeemed_and_vouchers.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_token_stockpile_redeemed_and_vouchers.sql)
- [feature_2_token_enhancements.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_token_enhancements.sql)

```sql
CREATE TABLE token_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_type        TEXT NOT NULL CHECK (transaction_type IN ('issued', 'redeemed', 'shop_retained', 'opening_stock', 'write_off')),
  invoice_id              UUID REFERENCES invoices(id) ON DELETE SET NULL,
  client_id               UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name             TEXT,
  item_id                 UUID REFERENCES items(id) ON DELETE SET NULL,
  item_name               TEXT,
  brand                   TEXT,
  category                TEXT,
  token_value             NUMERIC(10,2) NOT NULL DEFAULT 0,
  token_count             INTEGER DEFAULT 1,
  unit_token_value        NUMERIC(10,2) DEFAULT 0,
  remaining_count         INTEGER DEFAULT 1,
  is_external             BOOLEAN DEFAULT FALSE,
  redeemed_amount         NUMERIC(10,2) DEFAULT 0,
  remaining_balance       NUMERIC(10,2) DEFAULT 0,
  shift_id                UUID REFERENCES shifts(id) ON DELETE SET NULL,
  notes                   TEXT,
  claim_status            TEXT DEFAULT NULL,
  claimed_date            TIMESTAMPTZ DEFAULT NULL,
  claim_reference         TEXT DEFAULT NULL,
  usage_status            TEXT DEFAULT NULL,
  write_off_reason        TEXT DEFAULT NULL,
  settlement_type         TEXT DEFAULT NULL,
  parent_transaction_id   UUID REFERENCES token_transactions(id) ON DELETE SET NULL,
  used_against_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  used_against_voucher_id  UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  used_date               TIMESTAMPTZ DEFAULT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Table: `purchases`
Added in migration [feature_2_token_stockpile_usage.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_token_stockpile_usage.sql):
- `tokens_applied_amount` (`NUMERIC(10,2) DEFAULT 0`)

#### 5. Table: `vouchers`
Referenced in migration [feature_2_token_stockpile_redeemed_and_vouchers.sql](file:///d:/bestow/p-industry/supabase/migrations/feature_2_token_stockpile_redeemed_and_vouchers.sql):
- Linked via `token_transactions.used_against_voucher_id`
- Supported `payment_method = 'tokens'` and compound descriptions.

### 3.2 Indexes on `token_transactions`
Verified active indexes:
- `idx_token_transactions_tenant` on `(tenant_id)`
- `idx_token_transactions_shift` on `(shift_id)`
- `idx_token_transactions_client` on `(client_id)`
- `idx_token_transactions_claim_status` on `(claim_status)`
- `idx_token_transactions_usage_status` on `(usage_status)`
- `idx_token_transactions_purchase` on `(used_against_purchase_id)`
- `idx_token_transactions_voucher` on `(used_against_voucher_id)`
- `idx_token_transactions_parent` on `(parent_transaction_id)`
- `idx_token_transactions_is_external` on `(is_external)`
- `idx_token_transactions_invoice_id` on `(invoice_id)`
- `idx_token_transactions_item_id` on `(item_id)`

---

## 4. End-to-End Workflow Tracing & Verification

### 4.1 Flow 1: Item Catalog & Shade Setup
- **File:** [src/components/StockInventory.tsx](file:///d:/bestow/p-industry/src/components/StockInventory.tsx#L210-L310) and [src/app/api/items/route.ts](file:///d:/bestow/p-industry/src/app/api/items/route.ts#L80-L190)
- **Behavior:**
  - When creating or editing an item, user sets `has_token` (boolean) and `token_value` (numeric).
  - Bulk Add (`handleBulkSave`) applies the same `bulkHasToken` and `bulkTokenValue` across all generated shades.
  - **Inconsistency:** Because each shade is an independent row in `items`, every shade gets a duplicated copy of `token_value`. The system treats the shade SKU as the token identity rather than the base bucket container.

---

### 4.2 Flow 2: POS Billing & Issuance / Shop Retention
- **File:** [src/components/PosBilling.tsx](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L995-L1055)
- **Step 1: In Cart:**
  - For items with `has_token = true`, the cashier toggles `keep` or `remove`.
  - If `remove`, `handleToggleTokenAction` immediately discounts the line rate:
    $$\text{adjustedRate} = \max(0, \text{baseRate} - \text{tokenVal})$$
- **Step 2: On Invoice Completion:**
  - POS creates the invoice via `POST /api/invoices`.
  - **After** the invoice returns success, POS runs a client-side `for` loop over `lineItems`:
    ```typescript
    for (const item of lineItems) {
      if (item.hasToken && (item.tokenValue || 0) > 0) {
        const isRemoved = item.tokenAction === 'remove';
        const tokenType = isRemoved ? 'shop_retained' : 'issued';
        await fetch('/api/tokens', {
          method: 'POST',
          body: JSON.stringify({
            type: tokenType,
            tenant_id: tenantId,
            invoice_id: savedInvoiceId,
            client_id: isRemoved ? null : selectedClient?.id || null,
            token_value: (item.tokenValue || 0) * item.qty,
            token_count: item.qty,
            unit_token_value: item.tokenValue || 0,
            remaining_count: item.qty,
            ...
          })
        });
      }
    }
    ```
  - If `tokenType === 'issued'` and `client_id` is present, `/api/tokens` increments `clients.token_balance`:
    $$\text{token\_balance}_{\text{new}} = \text{token\_balance}_{\text{old}} + \text{parsedTokenValue}$$
  - If `tokenType === 'shop_retained'`, record is marked `usage_status = 'available'`, `claim_status = 'pending'`, entering the shop safe stockpile.

---

### 4.3 Flow 3: Customer / Painter Cash Redemption
- **File:** [src/components/TokenRedemption.tsx](file:///d:/bestow/p-industry/src/components/TokenRedemption.tsx) & [src/app/api/tokens/route.ts](file:///d:/bestow/p-industry/src/app/api/tokens/route.ts#L330-L452)
- **Step 1: Mode Selection:** Registered Customer vs Walk-in.
- **Step 2: Item Selection & Guard:**
  - Cashier selects item from inventory.
  - Client makes GET request:
    `/api/tokens?tenant_id=${tenantId}&item_id=${selectedItemId}&summary=redeemable`
  - Server calculates:
    $$\text{redeemable\_balance} = \sum(\text{issued token\_value for item\_id}) - \sum(\text{redeemed redeemed\_amount for item\_id})$$
  - If `parsedAmount > redeemable_balance`, the server **rejects** the redemption unless `allow_external = true`.
- **Step 3: Account Balance Deduction (Registered Only):**
  - If registered client, `/api/tokens` deducts amount from `clients.token_balance`.
- **Step 4: Stockpile Ingestion:**
  - The redemption transaction is saved with:
    `transaction_type: 'redeemed'`, `usage_status: 'available'`, `claim_status: 'pending'`.
  - The physical tokens handed in by the customer are now added to the shop's physical stockpile.

---

### 4.4 Flow 4: Stockpile Safe Management & Brand Groups
- **File:** [src/components/TokenLedger.tsx](file:///d:/bestow/p-industry/src/components/TokenLedger.tsx) & [src/components/ceo-panel/TokensView.tsx](file:///d:/bestow/p-industry/src/components/ceo-panel/TokensView.tsx)
- Available stockpile is computed from transactions where:
  $$\text{transaction\_type} \in (\text{'shop\_retained'}, \text{'redeemed'}, \text{'opening\_stock'})$$
  $$\text{AND } \text{usage\_status} \neq \text{'used'} \text{ AND } \text{usage\_status} \neq \text{'written\_off'}$$
  $$\text{AND } \text{used\_against\_purchase\_id IS NULL} \text{ AND } \text{used\_against\_voucher\_id IS NULL}$$
- **Features supported in TokenLedger:**
  1. **Opening Stockpile Entry:** User can seed initial physical drawer counts (`opening_stock`).
  2. **Write-Off Damaged/Rejected Tokens:** Marks `usage_status = 'written_off'` with reason.
  3. **Direct Settlement with Vendor Rep:** Surrenders discrete counts of tokens to company rep for Cash or creates a Supplier Credit Voucher (`settle_vendor`).

---

### 4.5 Flow 5: Applying Stockpiled Tokens against Supplier Purchases
- **File:** [src/components/PurchasesView.tsx](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L160-L255) and [src/app/api/purchases/route.ts](file:///d:/bestow/p-industry/src/app/api/purchases/route.ts#L80-L165)
- User opens Purchase Bill modal.
- Fetches `/api/tokens?tenant_id=...&usage_status=available`.
- Filters available tokens by supplier brand match or allows selecting any available tokens.
- Formula:
  $$\text{netBillValue} = \max(0, \text{netBillValueBeforeTokens} - \text{tokensAppliedAmount})$$
- On purchase save:
  - Database marks applied token rows:
    `usage_status = 'used'`, `used_against_purchase_id = purchase.id`, `used_date = now()`, `remaining_count = 0`.
  - Stores `tokens_applied_amount` in the `purchases` table.

---

### 4.6 Flow 6: Applying Stockpiled Tokens in Supplier Payment Vouchers
- **File:** [src/components/FinancialLedgers.tsx](file:///d:/bestow/p-industry/src/components/FinancialLedgers.tsx#L1220-L1470) and [src/app/api/vouchers/route.ts](file:///d:/bestow/p-industry/src/app/api/vouchers/route.ts#L55-L225)
- In Supplier Ledger, user clicks "Add Payment / Return".
- Can select physical tokens from safe stockpile to tender as payment.
- Formula:
  $$\text{totalSettlementAmount} = \text{cashAmount} + \text{tokensAmount}$$
  $$\text{supplier.current\_balance}_{\text{new}} = \text{supplier.current\_balance}_{\text{old}} - \text{totalSettlementAmount}$$
- Marks selected tokens as `usage_status = 'used'`, `used_against_voucher_id = voucher.id`.

---

## 5. Critical Verification: Physical Token Identity vs. Redeemed Product / Shade

> **Specific Audit Check:** Verify whether **physical token identity** and **customer token redemption product/shade** are correctly separated in the system.

### Verification Finding: **THEY ARE NOT CORRECTLY SEPARATED**

Detailed analysis of the code confirms a major architectural conflation:

#### Proof 1: Shade-Level Isolation Lockout in `TokenRedemption.tsx`
In [TokenRedemption.tsx lines 102-114](file:///d:/bestow/p-industry/src/components/TokenRedemption.tsx#L102-L114), the modal forces the cashier to choose an `Item` from the catalog.
Then in [src/app/api/tokens/route.ts lines 38-68](file:///d:/bestow/p-industry/src/app/api/tokens/route.ts#L38-L68):
```typescript
const { data: issuedTxns } = await supabaseAdmin
  .from('token_transactions')
  .select('token_value')
  .eq('tenant_id', tenantId)
  .eq('item_id', itemId) // <-- STRICT FILTER BY SHADE ITEM ID
  .eq('transaction_type', 'issued');
```
**Consequence:**
- Suppose a store sells 10 buckets of *Master Super Emulsion (Shade: Off-White 101)*. The tokens are issued under `item_id = [Off-White-ID]`.
- Later, the painter brings back 2 physical tokens from those buckets. Physical paint tokens only say *"Master Super Emulsion Rs. 500"* — they **do not** specify shade codes.
- If the cashier searches for *Master Super Emulsion* and clicks *White 100* or *Ash White 104*, the API query checks `item_id = [Ash-White-ID]` and returns:
  `issued_total: 0, redeemable_balance: 0`.
- The system immediately displays:
  `All tokens for "Master Super Emulsion Ash White" have already been redeemed.`
- The cashier is blocked from redeeming a completely genuine token unless they toggle *"Accept Loose / External Brand Token"*, which circumvents tracking!

#### Proof 2: Phantom Tokens Created During POS Invoice Tender
When a customer uses their token balance to pay for a bill in POS ([PosBilling.tsx lines 1030-1055](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1030-L1055)):
```typescript
await fetch('/api/tokens', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'redeemed',
    tenant_id: tenantId,
    invoice_id: savedInvoiceId || null,
    client_id: selectedClient.id,
    client_name: selectedClient.name,
    redeemed_amount: appliedTokenAmount,
    shift_id: shiftId || null,
    notes: `Token balance applied at POS checkout against Invoice #${finalServerInvoiceNo}`,
  }),
});
```
Notice what is passed to `/api/tokens`:
- `item_id`: `undefined` / `null`
- `item_name`: `undefined` / `null`
- `brand`: `undefined` / `null`
- `token_count`: defaults to `1`
- `unit_token_value`: defaults to `appliedTokenAmount`

**Consequence:**
- In [TokenLedger.tsx lines 373-414](file:///d:/bestow/p-industry/src/components/TokenLedger.tsx#L373-L414), all `redeemed` transactions are treated as **physical tokens deposited into the shop safe** (`usage_status = 'available'`).
- Because `brand` is null, line 401 runs: `const b = t.brand || 'General';`.
- If a customer applies Rs. 3,850 of loyalty token balance against an invoice, the shop's safe ledger records:
  **"1 Token of Brand 'General' worth Rs. 3,850 in safe"**!
- No such physical token exists. The store safe count and physical token inventory are corrupted.

#### Proof 3: Inability to Tender Physical Tokens on Walk-in POS Bills
If a walk-in painter arrives with 3 physical tokens (Rs. 500 each) and wants to buy paint:
- In [PosBilling.tsx lines 1394-1415](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1394-L1415), the "Available Token Balance" button is **strictly conditionally rendered**:
  `{selectedClient && (selectedClient.token_balance || 0) > 0 && (...) }`
- A walk-in customer **cannot** use physical tokens directly as payment tender on a sale.
- The cashier must manually exit the POS, open the separate `TokenRedemption` modal, do a cash payout, and then ring up the sale for cash.

---

## 6. Calculations & Financial Reconciliation Trace

### 6.1 Shift Drawer & Cash Count Discrepancy (CRITICAL BUG)
In [src/components/ShiftDrawer.tsx lines 308-313](file:///d:/bestow/p-industry/src/components/ShiftDrawer.tsx#L308-L313):
```typescript
// Exact Daraz Reconciliation Formula:
// Expected Cash = Opening Cash + Cash Inflow (Sales) - Cash Outflow (Sales Returns + Supplier Cash + Expenses + Tokens Redeemed Cash)
const expectedCash = Math.max(
  0,
  openingCash + cashSales - cashReturns - supplierCashPaid - totalExpenses - tokensRedeemed
);
```
And in `PosBilling.tsx`:
- When a customer uses `appliedTokenAmount` on an invoice, POS records:
  - `others_paid: othersPayment + appliedTokenAmount`
  - `cash_paid: actualCashRetained` (only the physical cash handed over)
  - Creates a `redeemed` transaction for `appliedTokenAmount`.

**The Fatal Math Bug:**
1. In `ShiftDrawer.tsx`:
   `cashSales` only sums `cash_paid`. So if a Rs. 5,000 bill was paid with Rs. 1,000 token balance + Rs. 4,000 cash, `cashSales` correctly adds **Rs. 4,000**.
2. However, `tokensRedeemed` sums **all** transactions where `transaction_type === 'redeemed'`, including the Rs. 1,000 token tender!
3. The formula then computes:
   $$\text{expectedCash} = \dots + 4000 (\text{cash}) - 1000 (\text{token redeemed}) = +3000$$
4. The cashier actually has **Rs. 4,000** cash in drawer.
5. `ShiftDrawer` reports an artificial **Rs. 1,000 Cash Excess / Discrepancy**!
6. **Root Cause:** The formula assumes every `redeemed` transaction was a cash payout handed out of the till. When a token is tendered on an invoice, **no cash leaves the drawer**, so it must not be subtracted from expected cash.

---

### 6.2 Day Close View Double Deduction (HIGH BUG)
In [src/components/ceo-panel/DayCloseView.tsx lines 135-141 and 182](file:///d:/bestow/p-industry/src/components/ceo-panel/DayCloseView.tsx#L135-L182):
```typescript
// Line 135: Deducts cash returns from cashSales
const cashSales = salesInvs.reduce(...) - (returnInvs.reduce(...));

// Line 182: Deducts cashReturns AGAIN in fallback expected cash formula
const expCash = ... Math.max(0, openAmt + cashSales - cashReturns - totalExpensesAmt - tokensRedeemedAmt);
```
`cashReturns` is subtracted **twice**, causing the expected cash in CEO Day Close to diverge from the Shift Drawer and reality.

---

### 6.3 Sales History vs. Shift Drawer Discrepancy (MEDIUM BUG)
In [src/components/SalesHistory.tsx lines 463-477](file:///d:/bestow/p-industry/src/components/SalesHistory.tsx#L463-L477):
- The `physicalCash` metric on the top summary card sums `invCash` from invoices.
- It completely ignores `tokenRedemptions` (cash payouts given to painters via `TokenRedemption.tsx`).
- Therefore:
  $$\text{SalesHistory.physicalCash} \neq \text{ShiftDrawer.expectedCash}$$
  Staff and managers see conflicting figures for cash on hand across different tabs.

---

## 7. Returns, Cancellations & Edits Trace

### 7.1 Returns Issue Tokens Instead of Reversing (CRITICAL BUG)
In [src/components/PosBilling.tsx lines 996-1027](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L996-L1027):
```typescript
// 1. Process Token Transactions for items with tokens
for (const item of lineItems) {
  if (item.hasToken && (item.tokenValue || 0) > 0) {
    const isRemoved = item.tokenAction === 'remove';
    const tokenType = isRemoved ? 'shop_retained' : 'issued';
    await fetch('/api/tokens', {
      method: 'POST',
      body: JSON.stringify({
        type: tokenType,
        ...
```
When `invoiceType === 'return'`:
1. Line 1722 of `PosBilling.tsx` has a checkbox `tokenReturnedWithBucket`.
2. But the invoice completion loop **never checks `invoiceType` or `tokenReturnedWithBucket`**!
3. If a customer returns a paint bucket that had a token:
   - If `tokenAction !== 'remove'`, POS sends `type: 'issued'`, **giving the returning customer another token credit**!
   - If `tokenAction === 'remove'`, POS sends `type: 'shop_retained'`, logging another token into the shop safe!
4. The system **never reverses** the original token and **never reclaims** client token balance on a return.

### 7.2 Backend Invoice API Ignorance
In [src/app/api/invoices/route.ts](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts):
- A comprehensive search for pattern `"token"` reveals **zero occurrences**.
- The invoice backend knows nothing about tokens.
- Token transactions are dispatched via loose asynchronous `fetch` calls from the browser.
- If the browser crashes, loses connection, or is refreshed midway through the loop, the invoice is saved but token records are orphaned or lost.
- If an invoice is edited or marked cancelled in the backend, token transactions are not updated or rolled back.

### 7.3 Purchase / Voucher Deletion
In [src/app/api/purchases/route.ts](file:///d:/bestow/p-industry/src/app/api/purchases/route.ts) and [src/app/api/vouchers/route.ts](file:///d:/bestow/p-industry/src/app/api/vouchers/route.ts):
- When tokens are applied, they are set to `usage_status = 'used'`.
- The foreign keys have `ON DELETE SET NULL`.
- If a purchase or voucher is deleted or cancelled, `used_against_purchase_id` becomes `NULL`, but `usage_status` remains `'used'`.
- The tokens are permanently lost in limbo and never return to `'available'` status.

---

## 8. Multi-Tenancy, Permissions & Security

### 8.1 Multi-Tenancy Scoping
- Verified: All queries in `/api/tokens` require `tenant_id` and validate via `requireTenantAuth(req, tenantId)` from [src/lib/session.ts](file:///d:/bestow/p-industry/src/lib/session.ts).
- All database queries filter by `.eq('tenant_id', tenantId)`.
- Foreign keys cascade on `tenants(id) ON DELETE CASCADE`.

### 8.2 Missing Role-Based Access Control (RBAC) (HIGH RISK)
In [src/app/api/tokens/route.ts lines 170-182](file:///d:/bestow/p-industry/src/app/api/tokens/route.ts#L170-L182):
- Any authenticated user with access to the branch can call:
  - `type: 'write_off'` — Can write off any amount of company tokens without manager/CEO approval.
  - `type: 'opening_stock'` — Can create arbitrary token value balances.
  - `type: 'settle_vendor'` — Can mark stockpiled tokens as claimed and settled.
- There is **no role verification** (`session.role !== 'ceo'`) on these sensitive financial adjustments.

### 8.3 Row-Level Security (RLS)
- The table `token_transactions` does **not** have Row-Level Security enabled (`ENABLE ROW LEVEL SECURITY`).
- All reads and writes rely entirely on `supabaseAdmin` service role key inside API handlers.
- While the API layer enforces tenant checks, direct database access via client Supabase libraries would be unconstrained if exposed.

---

## 9. Comprehensive Bug & Vulnerability Register

| ID | Severity | Component | Issue Description | Root Cause / File Reference |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-TOK-01** | **CRITICAL** | `ShiftDrawer.tsx` | Shift Expected Cash is corrupted when tokens are used as tender in POS. | Subtracts `tokensRedeemed` indiscriminately, assuming all redemptions were cash outflows from till. [ShiftDrawer.tsx:312](file:///d:/bestow/p-industry/src/components/ShiftDrawer.tsx#L312) |
| **BUG-TOK-02** | **CRITICAL** | `PosBilling.tsx` | Returns issue new tokens instead of reversing tokens. | POS post-sale loop ignores `invoiceType === 'return'` and always creates `issued` or `shop_retained` rows. [PosBilling.tsx:996](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L996) |
| **BUG-TOK-03** | **CRITICAL** | `TokenRedemption.tsx` | Shade SKU locking prevents valid token redemptions. | Checks redeemable balance strictly against `item_id` of the selected shade, blocking cross-shade redemptions of same product line. [TokenRedemption.tsx:104](file:///d:/bestow/p-industry/src/components/TokenRedemption.tsx#L104) & [route.ts:44](file:///d:/bestow/p-industry/src/app/api/tokens/route.ts#L44) |
| **BUG-TOK-04** | **CRITICAL** | `PosBilling.tsx` | POS token balance payment creates phantom "General" tokens in safe stockpile. | Tendered token balance logs `redeemed` record with null brand/item, which enters the safe stockpile as brand `'General'` worth arbitrary invoice discount amounts. [PosBilling.tsx:1033](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1033) & [TokenLedger.tsx:401](file:///d:/bestow/p-industry/src/components/TokenLedger.tsx#L401) |
| **BUG-TOK-05** | **HIGH** | `DayCloseView.tsx` | Cash returns are double-subtracted in CEO Day Close expected cash calculation. | Subtracted in `cashSales` computation and subtracted again in the final `expCash` formula. [DayCloseView.tsx:135,182](file:///d:/bestow/p-industry/src/components/ceo-panel/DayCloseView.tsx#L135-L182) |
| **BUG-TOK-06** | **HIGH** | `invoices/route.ts` & `PosBilling.tsx` | Non-atomic token creation via client-side loop. | Invoices are saved on backend, but token records are created via separate sequential frontend HTTP requests. Network failure leads to inconsistent state. [PosBilling.tsx:996-1055](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L996-L1055) |
| **BUG-TOK-07** | **HIGH** | `api/tokens/route.ts` | Lack of RBAC on token write-offs and opening stock. | Counter cashiers can write off stockpiled tokens or inject opening stock with no supervisor PIN or role check. [route.ts:178](file:///d:/bestow/p-industry/src/app/api/tokens/route.ts#L178) |
| **BUG-TOK-08** | **MEDIUM** | `PosBilling.tsx` | Walk-in customers cannot tender physical tokens during checkout. | Payment token button only renders when `selectedClient` has `token_balance > 0`. Walk-in painters with physical tokens cannot pay with them directly. [PosBilling.tsx:1394](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1394) |
| **BUG-TOK-09** | **MEDIUM** | `PurchasesView.tsx` & `vouchers/route.ts` | No partial token count selection on purchases or vouchers. | User can only select entire rows (`token_transactions.id`). If a transaction has 10 tokens (Rs. 5,000), cashier cannot apply only 3 tokens against a supplier bill. [route.ts:70](file:///d:/bestow/p-industry/src/app/api/vouchers/route.ts#L70) |
| **BUG-TOK-10** | **MEDIUM** | `SalesHistory.tsx` | Cash metric excludes token redemption payouts. | `physicalCash` in Sales History ignores cash paid out to painters for redeemed tokens, causing a discrepancy with Shift Close cash counts. [SalesHistory.tsx:472](file:///d:/bestow/p-industry/src/components/SalesHistory.tsx#L472) |
| **BUG-TOK-11** | **LOW** | `dev-panel/AuraDevPanel.tsx` | Dev Panel lacks token debugging or inspection utilities. | No developer tooling exists to inspect orphaned token transactions, repair stock counts, or audit token integrity across tenants. |

---

## 10. Architectural Recommendations for Remediation

1. **Decouple Physical Token Identity from Catalog Shades:**
   - Create a dedicated `paint_token_denominations` or `brand_tokens` catalog:
     - `brand` (e.g. Master, Brighto)
     - `series` / `container_size` (e.g. Super Emulsion 16L Bucket, Weathercoat 4L Gallon)
     - `face_value` (e.g. Rs. 500)
   - Items should point to this token definition rather than having standalone numeric fields per shade.
   - When redeeming tokens, the cashier selects the **Brand & Denomination**, completely separate from which shade or product is being purchased.

2. **Differentiate Token Redemption Modes:**
   - **Mode A: Cash Payout (Expense Outflow):** Painter hands in physical token $\to$ receives physical Cash. (Affects cash drawer as outflow).
   - **Mode B: Invoice Tender (Payment Tender):** Painter hands in physical token $\to$ receives paint product. (Does NOT affect cash drawer; physical token enters safe stockpile, product stock decreases).
   - **Mode C: Virtual Account Credit:** Registered client deposits tokens to credit ledger or redeems virtual balance.

3. **Atomic Backend Invoice-Token Transaction:**
   - Move token processing inside `POST /api/invoices`.
   - The invoice payload should include `token_actions` and `token_tenders`.
   - Database operations (invoice creation, stock adjustments, client balance, token transaction logging) must execute in a single atomic database transaction.

4. **Fix Reconciliation Formulas:**
   - In `ShiftDrawer.tsx` and `DayCloseView.tsx`, distinguish between `token_cash_payouts` and `token_invoice_tenders`.
   - Only subtract cash payouts from expected drawer cash:
     $$\text{expectedCash} = \text{opening} + \text{cashSales} - \text{cashReturns} - \text{expenses} - \text{supplierCash} - \mathbf{\text{tokenCashPayouts}}$$

5. **Implement Role-Based Guard on Stockpile Adjustments:**
   - Restrict `write_off`, `opening_stock`, and `settle_vendor` to users with role `ceo` or `developer`, or require a supervisor PIN authorization.

---
*Audit completed by Antigravity AI Code Analysis Engine. Zero files modified during this audit phase.*
