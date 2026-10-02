# POS Panel End-to-End Comprehensive Audit

**Date of Audit:** September 2026  
**Audited Systems:** POS Core UI, Shift Management, Cart & Pricing Engine, Tax & Discount Logic, Multi-Branch Inventory Requisitions, Token Lifecycle, Client Recovery & Ledger, Purchase & Supplier Integration, Database & REST APIs.  
**Scope:** Read-only exhaustive trace across UI components (`src/components/Pos*.tsx`, `ShiftDrawer.tsx`, `HoldInvoices.tsx`, `SalesHistory.tsx`, `PurchasesView.tsx`, `StockInventory.tsx`, `BranchOrders.tsx`, `FinancialLedgers.tsx`, `ClientCreditRecovery.tsx`, `TokenRedemption.tsx`, `TokenLedger.tsx`) and underlying API endpoints (`src/app/api/**`).

---

## Executive Summary

The Point of Sale (POS) architecture represents a mature, feature-dense industrial retail and wholesale engine supporting real-time branch switching, barcode scanning, token schemes, dynamic tax rules, credit recovery aging, split tenders, and day-close cash reconciliation.

However, deep code and database tracing identified several **critical financial discrepancies, data loss vulnerabilities, and operational blocks** that directly impact revenue accounting, cash drawer balancing, and branch supply chains:
1. **Critical Shift Reconciliation Discrepancy:** The client-side shift drawer formula accounts for `cashReturns` and `supplierCashPaid`, whereas the server-side shift closing API completely ignores both, resulting in artificial drawer shortages and corrupted shift accounting.
2. **Double-Deduction & Clamping in Customer Sales Returns:** When processing a return with cash refund for a credit customer, the API simultaneously refunds cash AND reduces the customer's outstanding balance, causing a duplicate financial deduction. Furthermore, clamping balances to 0 prevents store credit balances.
3. **Inter-Branch Requisition Inventory Lock:** Requisitioning items from the Central Godown or another branch checks the *requesting* branch's local stock instead of allowing reorder when local stock is zero.
4. **Hold Invoice Premature Deletion:** Held invoices are deleted from Supabase immediately upon clicking "Resume", before being successfully checked out or re-held. A browser crash or disconnect results in permanent data loss.
5. **Fictitious Shift Fallbacks on API Errors:** POS creates an unpersisted in-memory shift ID (`Date.now()`) if the network fails during shift creation, orphaning transactions from SQL foreign keys.

Below is the complete section-by-section audit.

---

## 1. What Works Correctly

The POS system demonstrates solid engineering across core standard retail and wholesale flows:

- **Cart Item Calculation & Tier Pricing:**
  - `PosBilling.tsx`: Line total calculations accurately support unit conversions (carton / dozen / unit) with correct wholesale vs. retail base prices.
  - Line-level discount logic correctly supports percentage and flat rate calculations without negative subtotal inversions.
  - Tax calculation (`tax_amount = (subtotal - discount) * (taxRate / 100)`) matches standard GST/VAT conventions.
- **Split Payment Allocation:**
  - `PosBilling.tsx` enforces that `cash_paid + card_paid + bank_paid + credit_applied == grand_total` before completing sales.
  - Accurately splits records for multi-tender reporting.
- **Credit Limit & Overdue Aging Enforcement:**
  - Validates `client.credit_limit` and checks `has_overdue_credit` (30+ days overdue) before permitting credit sale finalize.
- **Stock Deductions on Sale:**
  - `api/invoices/route.ts`: Accurately decrements `branch_items.stock_qty` on standard sales and increments `stock_qty` on sales returns.
  - Accurately generates corresponding `stock_transactions` audit logs (`sale` vs `sales_return`).
- **Token Redemption Rules:**
  - Strict validation preventing double-redemption of scanned coupon tokens.
  - Enforcement of daily redemption limits and client binding.
- **Barcode & Hotkey Navigation:**
  - Functional keyboard shortcuts (`F1` help, `F2` quick search, `F4` hold, `F8` discount focus, `F9` tender focus, `Enter` checkout).
  - Rapid barcode scanning buffer parsing.
- **Real-time Supabase Auth & Multi-Branch Tenancy:**
  - Branch context scoping is enforced across catalog queries, ensuring branch isolation for catalog display and shift sessions.

---

## 2. Bugs & Inconsistencies

### BUG-01: Shift Reconciliation Formula Mismatch (Severe Financial Bug)
- **Locations:**
  - Client: `src/components/ShiftDrawer.tsx` (Lines 275–282)
  - Server: `src/app/api/shifts/route.ts` (Lines 245–285)
- **Code Trace:**
  - **Client Formula:**
    ```typescript
    expectedCash = Math.max(0, openingCash + cashSales - cashReturns - supplierCashPaid - totalExpenses - tokensRedeemed);
    ```
  - **Server API Formula:**
    ```typescript
    // In api/shifts/route.ts:
    if ((inv.invoice_type || 'sales') === 'return') return; // SKIPS RETURNS ENTIRELY!
    // Supplier cash purchases from drawer are NOT subtracted at all!
    const expectedCash = Math.max(0, openingAmt + cashIn - totalExpenses - totalTokenPayouts);
    ```
- **Discrepancy:** The server completely skips subtracting customer cash returns (`cashReturns`) and drawer payouts for supplier purchases (`supplierCashPaid`).
- **Consequence:** If a cashier started with $500 cash, took $1,000 sales, paid $300 in customer cash returns, and paid $200 cash for a supplier COD delivery, the physical drawer has $1,000 cash. The UI computes expected cash as $1,000. But the server computes expected cash as $1,500, recording a **$500 drawer shortage** against the cashier upon shift close!

### BUG-02: Inter-Branch Requisition Local Stock Check Block
- **Location:** `src/components/BranchOrders.tsx` (Lines 91–95, 114–117)
- **Code Trace:**
  ```typescript
  const maxQty = item.stock_qty; // Local branch item quantity!
  if (existingQty + 1 > maxQty) {
    setFormError(`Only ${maxQty} units available at this branch`);
    return;
  }
  ```
- **Consequence:** When Branch A runs out of stock (`stock_qty = 0`) and creates an order requisition to restock from the Central Godown, the UI checks Branch A's local quantity (`item.stock_qty`), determines 0 units are available, and rejects adding the item to the transfer requisition. Branch transfers can only be requested if the requesting branch already has positive stock.

### BUG-03: Hold Invoices Premature Deletion & Race Condition
- **Location:** `src/components/HoldInvoices.tsx` (Lines 70–82)
- **Code Trace:**
  ```typescript
  const handleResume = async (held: HeldInvoice) => {
    // 1. Immediately delete from DB
    await fetch(`/api/held-invoices?id=${held.id}`, { method: 'DELETE' });
    // 2. Load into state
    onResume(held);
  };
  ```
- **Consequence:** If the cashier resumes a held transaction of 25 items, the server record is deleted instantly. If the customer suddenly asks for an extra item, or the browser tab is accidentally closed, or the POS computer restarts, that held order is permanently obliterated. It should remain held or soft-locked until checkout is committed.

### BUG-04: Sales History Misleading "Cash Inflow" Aggregation
- **Location:** `src/components/SalesHistory.tsx` (Lines 357 & 758)
- **Code Trace:**
  ```typescript
  const totalCashInflow = invoices
    .filter(i => i.invoice_type !== 'return')
    .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
  ```
- **Consequence:** The KPI card displayed to the cashier/manager is titled **"Cash Inflow"** with subtitle *"Direct cash received"*, but it sums `paid_amount` across **Card, Bank Transfer, and Cheque** transactions. Actual physical cash intake is obfuscated, leading managers to believe the cash drawer has significantly more cash than it actually holds.

### BUG-05: Fictitious Shift Fallback on API Failure
- **Location:** `src/app/[slug]/page.tsx` (Lines 198–220)
- **Code Trace:**
  ```typescript
  const res = await fetch('/api/shifts', { method: 'POST', ... });
  if (!res.ok) {
    // Fallback: create mock local shift object
    const mockShift = { id: Date.now().toString(), ... };
    setCurrentShift(mockShift);
  }
  ```
- **Consequence:** If the initial shift creation request fails due to temporary network blip or database lock, the UI continues operating with a timestamp ID like `"1727192800000"`. When the cashier attempts to finalize invoices, all foreign-key constraints on `invoices.shift_id` fail, or transactions become permanently orphaned and cannot be audited during day close.

---

## 3. Incorrect or Risky Calculations

### CALC-01: Double-Deduction and Balance Clamping on Customer Returns
- **Location:** `src/app/api/invoices/route.ts` (Lines 284–305)
- **Code Trace:**
  ```typescript
  if ((invoice_type || 'sales') === 'return' && client_id) {
    const { data: client } = await supabase.from('clients').select('current_balance').eq('id', client_id).single();
    if (client) {
      const newBal = Math.max(0, Number(client.current_balance || 0) - netTotal);
      await supabase.from('clients').update({ current_balance: newBal }).eq('id', client_id);
    }
  }
  ```
- **Identified Flaws:**
  1. **Double Refund:** If the customer pays in cash on invoice #100, and returns the item receiving cash refund (`cash_paid = $100`), the cashier gives them $100 physical cash. The server ALSO deducts $100 from their account balance (`client.current_balance`). The store loses both the cash and credits the customer's account.
  2. **Destruction of Store Credit via `Math.max(0, ...)`:** If the customer had a $0 debt and is returning an item for store credit, clamping with `Math.max(0, ...)` sets their balance to 0 instead of -$100 (advance deposit / store credit). The customer is robbed of their return credit.

### CALC-02: Purchase Return Balance Clamping
- **Location:** `src/app/api/purchases/route.ts` (Lines 240–247)
- **Code Trace:**
  ```typescript
  if (purchase_type === 'return') {
    const newBal = Math.max(0, currentBal - Number(net_total));
    await supabase.from('suppliers').update({ current_balance: newBal }).eq('id', supplier_id);
  }
  ```
- **Identified Flaw:** If a business returns defective goods to a supplier whose outstanding balance is currently $0 (e.g. previously settled in full), the supplier now owes the business money. `Math.max(0, ...)` zeroes out the transaction, wiping out the supplier debit note.

### CALC-03: Token Valuation Discrepancy Between Billing Cart and Redemption Module
- **Location:** `PosBilling.tsx` (Lines 441–460) vs `TokenRedemption.tsx` (Lines 112–130)
- **Discrepancy:**
  - In `PosBilling.tsx`, tokens are deducted as a flat currency amount from the subtotal.
  - In `TokenRedemption.tsx`, tokens have varying redemption valuations depending on whether they are manufacturer coupons, customer loyalty tokens, or scrap tokens.
  - If a cashier accepts a token in POS Billing, the token is not marked as `is_redeemed = true` in the `tokens` table until an asynchronous, separate background sync runs. A customer can present the same token barcode at another register or redemption counter simultaneously.

---

## 4. Missing Validations

### VAL-01: No Concurrency / Optimistic Lock on Stock Deductions
- **Location:** `src/app/api/invoices/route.ts` (Lines 160–185)
- **Issue:** Stock quantity decrement performs `select stock_qty` followed by `update stock_qty = current - sold`.
- **Risk:** Under multi-till concurrent checkout (e.g., two cashiers ringing up the last 5 bags of cement at the exact same second), a classic race condition occurs where both read 5, both sell 5, and the resulting stock is set to 0 instead of -5, hiding negative stock discrepancies without row-level locking (`FOR UPDATE`) or an atomic RPC (`UPDATE ... stock_qty = stock_qty - X`).

### VAL-02: Missing Cash Denomination Breakdown Validation on Shift Close
- **Location:** `src/components/ShiftDrawer.tsx` (Lines 285–320)
- **Issue:** Cashier manually types a single raw number into `Closing Cash`. There is no required bill/coin breakdown (e.g., 5000s, 1000s, 500s, 100s, 50s, 20s, 10s).
- **Risk:** High fraud risk and clerical error during shift handover. Physical counting mistakes cannot be diagnosed without denomination tallies.

### VAL-03: Negative Discount / Price Manipulation in Payload
- **Location:** `src/app/api/invoices/route.ts` (Lines 110–140)
- **Issue:** The API accepts client-submitted `unit_price`, `discount_amount`, and `net_total` directly without re-verifying against the catalog `items.selling_price` or verifying `discount_amount <= subtotal`.
- **Risk:** A compromised client or rogue cashier can alter JSON payloads to checkout items at $0.01 or apply $10,000 negative discounts, generating arbitrary cash payouts.

### VAL-04: Credit Limit Override Authorization Missing
- **Location:** `src/components/PosBilling.tsx` (Lines 520–545)
- **Issue:** If an invoice exceeds the customer's credit limit or the customer is flagged overdue, the checkout is disabled. However, there is no supervisor/manager pin override mechanism. Operations stall if a manager is standing right there to approve an emergency credit extension.

---

## 5. Broken or Incomplete Flows

### FLOW-01: Incomplete Invoice Return & Credit Note Flow
- **Trace:**
  - When returning an invoice in POS, cashier toggles "Return Mode".
  - The return does not reference the original `invoice_id` or `invoice_number`.
  - Cashier can return any item at any price, even if the customer never purchased that item or purchased it at a heavily discounted promotional rate.
  - Return items are restocked immediately even if marked damaged or defective, re-introducing bad inventory into saleable stock without quarantine.

### FLOW-02: Hold Invoices Lack Customer & Tender Preservation
- **Trace:**
  - `src/components/HoldInvoices.tsx` only serializes `cart_items` and basic `note`.
  - If a customer was selected (`client_id`), or a custom discount was agreed upon, or loyalty tokens were scanned, these are dropped when the invoice is put on hold. Upon resume, the cashier must re-select the client and re-apply discounts.

### FLOW-03: AI Invoice Scan (Purchase Order / Bill Intake)
- **Location:** `src/components/AiInvoiceScan.tsx`
- **Issue:** Scans supplier invoices via OCR. However, if the vendor's scanned item names do not exactly match the system's SKU or barcode, it fails silently or requires manual re-selection without offering an alias-mapping table (e.g., vendor SKU -> internal SKU).

---

## 6. Database & API Issues

### DB-01: Non-Atomic Multi-Table Updates in Invoices API
- **Location:** `src/app/api/invoices/route.ts` (Lines 140–320)
- **Trace:** The API updates:
  1. `invoices` (insert)
  2. `invoice_items` (insert bulk)
  3. `branch_items` (multiple sequential updates for each line item)
  4. `stock_transactions` (insert bulk)
  5. `clients` (balance update)
  6. `financial_ledger` (insert entry)
- **Issue:** These 6 operations run sequentially across multiple HTTP calls to Supabase REST without a PostgreSQL database transaction (`BEGIN ... COMMIT`).
- **Critical Failure Mode:** If step 3 succeeds for 4 out of 5 items, and the 5th item fails (e.g., constraint error, timeout), the invoice is recorded, 4 items are deducted, 1 item is NOT deducted, the client balance is NOT updated, and the financial ledger entry is NEVER written. The database is left in a corrupted state.
- **Remedy:** Encapsulate complete invoice settlement in a single atomic PostgreSQL stored procedure / RPC (`create_pos_invoice(...)`).

### DB-02: Shift Table Foreign Key Constraint on Branch Orders
- **Location:** `src/app/api/branch-orders/route.ts`
- **Issue:** Branch orders do not link to the active `shift_id`. Inter-branch transfer requests raised by cashiers during their shift cannot be audited as part of that cashier's shift activity log.

---

## 7. Security & Permission Issues

### SEC-01: Missing Role Checks on Sales Return in POS
- **Location:** `src/app/api/invoices/route.ts`
- **Issue:** Any authenticated user with basic cashier credentials can issue negative sales (returns) and dispense cash from the drawer without requiring manager authentication or a 4-digit supervisor PIN.

### SEC-02: Manual Price Modification in Cart
- **Location:** `src/components/PosBilling.tsx` (Lines 290–310)
- **Issue:** Cashiers can freely edit the line item unit price directly on the billing screen if enabled in state, without an audit log entry recording who authorized the price reduction.

### SEC-03: Shift Open Bypass
- **Location:** `src/app/[slug]/page.tsx`
- **Issue:** While POS views show an overlay blocking access until a shift is opened, an API call directly to `/api/invoices` does not strictly reject requests where `shift_id` is null or invalid. Invoices can be submitted outside of any open shift window.

---

## 8. UX & Logic Issues

### UX-01: Receipt Printing Pop-up Blocker
- **Location:** `src/components/PosBilling.tsx` & `SalesHistory.tsx`
- **Issue:** Uses `window.open(...)` for thermal receipt printing after an asynchronous `await fetch()` call.
- **Behavior:** Modern browsers (Chrome, Edge, Safari) identify popup windows spawned after async ticks as unsolicited popups and block them by default, requiring cashiers to manually whitelist popups or miss thermal printing.

### UX-02: WhatsApp Share Link Encoding
- **Location:** `src/components/SalesHistory.tsx` (Lines 760–785)
- **Issue:** WhatsApp message string concatenation uses raw newlines and unescaped ampersands (`&`), which truncates multi-item receipts on WhatsApp Web / Mobile URL handlers.

### UX-03: Customer Balance Real-Time Stale Display
- **Location:** `src/components/PosBilling.tsx`
- **Issue:** When a customer is selected, their balance is loaded from the cached client list. If the customer just paid off a bill at another terminal 2 minutes prior, the current terminal displays the outdated balance until the user performs a hard refresh.

---

## 9. Edge Cases

| ID | Edge Case | Current Behavior | Desired Safe Behavior |
|---|---|---|---|
| **EC-01** | Zero Total / 100% Discount Invoice | Throws validation error if `net_total <= 0` even for valid warranty/promotional free samples. | Allow $0 settlement if authorized with 'promotional/warranty' reason code. |
| **EC-02** | Decimal / Fractional Quantities (Kg, Meters) | Rounding errors in line item discount calculation (`Math.round` vs `toFixed(2)`). | Standardize on 2-decimal bank rounding (`Math.round((val + Number.EPSILON) * 100) / 100`). |
| **EC-03** | Partial Payments on POS | UI forces either full payment or full credit; does not cleanly support partial cash + remainder to customer ledger if not configured as split. | Allow partial cash tender with remainder automatically booked to client's outstanding balance if credit is allowed. |
| **EC-04** | Offline Network Disconnect during Checkout | Spinner spins indefinitely; no offline IndexedDB queue exists to save offline transactions. | Warn cashier immediately; queue sale in IndexedDB with pending status. |
| **EC-05** | Bulk Return of Discontinued SKU | If an item was deleted or archived in catalog (`items.is_active = false`), return fails with foreign key / item not found error. | Allow return processing with archived items marked for return-to-vendor. |

---

## 10. Recommended Fixes Prioritized by Severity

### Priority 0: Critical (Must Fix Immediately to Prevent Financial & Inventory Loss)

1. **Reconcile Shift Closing Cash Formula (BUG-01):**
   - Align `src/app/api/shifts/route.ts` with `ShiftDrawer.tsx`.
   - Update server formula:
     ```typescript
     // In api/shifts/route.ts:
     const expectedCash = Math.max(0,
       openingCash
       + cashSales
       - cashReturns
       - supplierCashPaid
       - totalExpenses
       - totalTokenPayouts
     );
     ```
   - Accurately query cash sales returns and cash supplier purchases associated with the `shift_id`.

2. **Fix Sales Return Double-Deduction & Clamping (CALC-01):**
   - In `src/app/api/invoices/route.ts`, if `cash_paid > 0` on a return, do NOT deduct from `client.current_balance`.
   - If customer elects store credit (`cash_paid == 0`), deduct from `client.current_balance` WITHOUT clamping to 0 (`newBal = currentBal - netTotal`), allowing negative balances (advance customer credit).

3. **Unlock Branch Transfer Requisitions (BUG-02):**
   - In `src/components/BranchOrders.tsx`, remove the check against local branch stock (`item.stock_qty`).
   - Replace with validation against destination/source stock, or permit requisition creation regardless of local zero-stock.

4. **Wrap Invoice Settlement in Atomic RPC (DB-01):**
   - Implement `create_pos_invoice` PostgreSQL function to execute invoice creation, stock deduction, client balance adjustment, and financial ledger posting within a single ACID transaction.

---

### Priority 1: High (Data Integrity & Cashier Operations)

5. **Safe Hold Invoice Restoration (BUG-03):**
   - Change `HoldInvoices.tsx` to keep the held record in database with status `resumed` instead of immediate hard `DELETE`.
   - Only execute `DELETE` or mark `completed` once the invoice is successfully settled via POST `/api/invoices`.

6. **Correct Sales History "Cash Inflow" Metrics (BUG-04):**
   - Split Sales History KPI into:
     - **Physical Cash Received:** Sum of `cash_paid` across invoices.
     - **Digital / Bank / Card Received:** Sum of `card_paid + bank_paid`.
     - **Credit Extended:** Sum of `credit_applied`.

7. **Eliminate Fictitious Shift Fallback (BUG-05):**
   - Remove `mockShift` generation in `src/app/[slug]/page.tsx`.
   - If `/api/shifts` fails, display a clear retry alert rather than allowing cashiers to trade on a ghost shift.

8. **Server-Side Price & Discount Verification (VAL-03):**
   - In `api/invoices/route.ts`, verify that submitted item prices and discounts do not violate minimum allowed margins without manager authorization flag.

---

### Priority 2: Medium (UX, Security & Ledger Cleanliness)

9. **Supervisor PIN Authorization for Returns & High Discounts (SEC-01 & SEC-02):**
   - Add a lightweight modal requesting supervisor PIN for:
     - Invoice returns
     - Discounts exceeding 15%
     - Manual price adjustments

10. **Denomination Counting Matrix in Shift Close (VAL-02):**
    - Provide cash denomination counters in `ShiftDrawer.tsx` ($5000, $1000, $500, etc.) that automatically sum physical cash and cross-reference against expected cash.

11. **Reliable Thermal Receipt Printing (UX-01):**
    - Switch from post-async `window.open` to an embedded hidden `iframe` or direct WebUSB / ESC-POS thermal print service.

---

### Priority 3: Low (Nice to Have & Polishing)

12. **AI Invoice Scan Vendor Alias Matching (FLOW-03):**
    - Introduce an alias mapping dictionary in `AiInvoiceScan.tsx` to automatically resolve vendor SKU codes to internal SKUs.

13. **Customer Balance Live Query on Selection (UX-03):**
    - Trigger a quick fetch of `/api/clients?id={id}` upon selecting a customer in POS to guarantee 100% fresh ledger balance.
