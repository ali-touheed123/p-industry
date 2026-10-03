# PHASE 5 REPORT — POS FRONTEND & CASHIER EXPERIENCE FORENSIC AUDIT

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 5 — POS Frontend & Cashier Experience Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

---

## 1. Scope

Comprehensive forensic audit of the cashier POS workspace, cart state management, checkout validation, split tender handling, held order parking/restoration, shift register drawer management, and thermal receipt printing infrastructure:
- Root POS Page Shell (`src/app/[slug]/page.tsx`)
- POS Billing Terminal Component (`src/components/PosBilling.tsx`)
- Parked Cart & Held Invoices Interface (`src/components/HoldInvoices.tsx`)
- Cash Register Shift & Float Management (`src/components/ShiftDrawer.tsx`)
- Sales History & Returns Processing (`src/components/SalesHistory.tsx`)
- Customer Credit Settlement UI (`src/components/ClientCreditRecovery.tsx`)
- AI Token Redemption Dialog (`src/components/TokenRedemption.tsx`)
- Hidden Iframe Thermal Receipt Renderer (`src/utils/iframePrint.ts`, `src/utils/receiptCanvas.ts`)

---

## 2. Files Inspected

- [src/app/[slug]/page.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/%5Bslug%5D/page.tsx) (936 lines) — Branch POS router, tenant state, shift open gate, navigation shell
- [src/components/PosBilling.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx) (2,569 lines) — POS Billing engine, cart state, item lookup, split tender, keyboard shortcuts, print integration
- [src/components/HoldInvoices.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/HoldInvoices.tsx) (701 lines) — Persistent parked invoices modal & restoration handlers
- [src/components/ShiftDrawer.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/ShiftDrawer.tsx) (1,563 lines) — Cash register drawer, denominations count, petty expenses, shift close reconciliation
- [src/components/SalesHistory.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/SalesHistory.tsx) (2,310 lines) — Invoice history listing, invoice edit, returns modal, thermal reprint
- [src/components/ClientCreditRecovery.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/ClientCreditRecovery.tsx) (512 lines) — Customer debt recovery & payment logging
- [src/components/TokenRedemption.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/TokenRedemption.tsx) (1,120 lines) — Bucket token redemption dialog
- [src/utils/iframePrint.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/utils/iframePrint.ts) (84 lines) — Hidden iframe thermal printing utility
- [src/utils/receiptCanvas.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/utils/receiptCanvas.ts) (210 lines) — Thermal canvas image generator

---

## 3. Database Objects Inspected

- `public.held_invoices` (`id`, `tenant_id`, `hold_no`, `client_name`, `items_json`, `net_total`)
- `public.shifts` (`id`, `tenant_id`, `opened_by`, `opening_cash`, `actual_cash`, `expected_cash`, `status`)
- `public.petty_expenses` (`id`, `tenant_id`, `shift_id`, `amount`, `category`, `title`)
- `public.invoices`, `public.invoice_items`
- `public.receipt_templates`, `public.tenant_receipt_templates`

---

## 4. POS Component Audit Matrix

| Component File | Role / Responsibility | State Integrity | Keyboard Hotkey Hygiene | Error Shielding | Thermal Print Parity |
|---|---|---|---|---|---|
| `[slug]/page.tsx` | App Shell & Shift Gate | ⚠️ **MEDIUM (Race condition in shift check)** | N/A | ✅ Good error screens | N/A |
| `PosBilling.tsx` | Cart & Billing Terminal | 🚨 **CRITICAL (Return price payload mismatch)** | 🚨 **HIGH (Hotkey listener leak on every render)** | ✅ Good credit & stock checks | ✅ Excellent iframe print integration |
| `HoldInvoices.tsx` | Parked Cart Manager | ✅ State preserved until checkout | N/A | ✅ Good DB fallback | N/A |
| `ShiftDrawer.tsx` | Register & Float Reconciliation | ✅ Excellent denomination math | N/A | ✅ Good expense validation | ✅ Thermal shift report |
| `SalesHistory.tsx` | Sales & Returns | ✅ Accurate return credit math | N/A | ✅ Good cancel protection | ✅ Reprint support |

---

## 5. Verified Correct (Frontend Strengths)

1. **Strict Credit Limit & Walk-In Debt Prevention:**
   - `handleCheckout` in `PosBilling.tsx:885-903` explicitly blocks credit sales (`balanceDue > 0`) for walk-in customers who do not have a registered customer account.
   - Enforces `credit_limit` verification for registered accounts, rejecting transactions if `current_balance + new_due > credit_limit`.
2. **Crash-Safe Parked Cart Operations:**
   - Resuming a held invoice in `HoldInvoices.tsx:70-75` does NOT prematurely delete the record from Supabase. The parked record is retained in the database until checkout is successfully completed (`PosBilling.tsx:1039`), protecting carts against power outages or browser crashes.
3. **Multi-Tender Split Payment Math:**
   - Multi-tender splits (Cash + Card + Bank + Other) enforce `nonCashPaid <= netTotal` and automatically calculate exact cash change returned (`PosBilling.tsx:865-877`).
4. **Thermal Printer Integration via Hidden Iframe:**
   - `printViaIframe` in `src/utils/iframePrint.ts` creates a non-modal hidden iframe for thermal receipt rendering. This avoids browser popup blockers triggered by asynchronous fetch calls during checkout.

---

## 6. Detailed Findings

### FINDING-POS-001
- **Severity:** HIGH
- **Category:** Payload Mismatch / Sales Return Line Total Desynchronization
- **Location:** [src/components/PosBilling.tsx:567-575](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx#L567-L575) & [L963](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx#L963)
- **Component:** `PosBilling.tsx` (`itemSubtotal` vs `invoicePayload.items`)
- **Evidence:**
  ```typescript
  // Lines 567-575: Computes effectiveRate for UI display during returns
  if (invoiceType === 'return' && item.hasToken && item.tokenReturnedWithBucket === false) {
    effectiveRate = Math.max(0, effectiveRate - (item.tokenValue || 0));
  }

  // Lines 963-966: API Payload in handleCheckout sends raw unit_price:
  items: lineItems.map((ci) => ({
    ...
    unit_price: ci.rate, // Sends un-adjusted rate!
    total_price: ci.rate * ci.qty * (1 - ci.discountPercent / 100),
  }))
  ```
- **Actual Behavior:** During a sales return where a bucket token is kept by the customer (`tokenReturnedWithBucket === false`), the UI displays a reduced refund rate (`effectiveRate`). However, `handleCheckout` constructs the API payload using `ci.rate` without subtracting `tokenValue`. The backend receives the un-adjusted rate, causing a discrepancy between the client-calculated net total and the item totals stored in the database.
- **Expected Behavior:** `handleCheckout` must pass `effectiveRate` as `unit_price` when building `invoicePayload.items` for returns.
- **Impact:** Financial audit log mismatch between DB line items and invoice header net totals on sales returns.
- **Verification Status:** VERIFIED

---

### FINDING-POS-002
- **Severity:** HIGH
- **Category:** Performance / Keyboard Event Listener Memory Leak
- **Location:** [src/components/PosBilling.tsx:1084-1121](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx#L1084-L1121)
- **Component:** `PosBilling.tsx` (`useEffect` for keyboard shortcuts)
- **Evidence:**
  ```typescript
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { ... };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lineItems, selectedClient, customerSearch, invoiceDiscount, deliveryCharge, cashPayment, cardPayment, bankPayment, othersPayment, submitting, selectedProduct, filteredCatalog]);
  ```
- **Actual Behavior:** The global `keydown` event listener is destroyed and re-bound on every keystroke, quantity update, or cart modification due to 12 state dependencies in the `useEffect` array.
- **Expected Behavior:** The keyboard listener should be attached once on mount using mutable refs (`useRef`) for transient state values.
- **Impact:** CPU overhead, memory churn, dropped hotkeys during rapid barcode scanning or fast typing.
- **Verification Status:** VERIFIED

---

### FINDING-POS-003
- **Severity:** MEDIUM
- **Category:** Cart State / Key Collision Risk
- **Location:** [src/components/PosBilling.tsx:666](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx#L666)
- **Component:** `PosBilling.tsx` (`handleAddItem`)
- **Evidence:**
  ```typescript
  id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
  ```
- **Actual Behavior:** `Math.random().toString(36).substr(2, 4)` generates a 4-character random string. When scanning barcodes rapidly, multiple items can be added within the same millisecond, risking key collisions.
- **Expected Behavior:** Use `crypto.randomUUID()` or high-entropy nanoid for unique cart item IDs.
- **Impact:** Duplicate key warnings in React, potential cart state corruption.
- **Verification Status:** VERIFIED

---

### FINDING-POS-004
- **Severity:** MEDIUM
- **Category:** UX State Sync / Stale Manual Cash Override
- **Location:** [src/components/PosBilling.tsx:591-601](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx#L591-L601)
- **Component:** `PosBilling.tsx` (`isCashManuallyEdited`)
- **Evidence:**
  Once a cashier manually edits the cash input field, `isCashManuallyEdited` is set to `true`. If items are subsequently added or removed from the cart, `cashPayment` is no longer auto-updated to match `netTotal`.
- **Actual Behavior:** Cash payment remains fixed at the previous manual value, causing unexpected `balanceDue` or `changeReturned` unless manually edited again.
- **Expected Behavior:** Provide a reset toggle or automatically clear manual cash edit state when cart items change significantly.
- **Impact:** Minor cashier confusion during multi-item transaction adjustments.
- **Verification Status:** VERIFIED

---

### FINDING-POS-005
- **Severity:** MEDIUM
- **Category:** Shift Opening Handover Race Condition
- **Location:** [src/app/[slug]/page.tsx:158-177](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/%5Bslug%5D/page.tsx#L158-L177)
- **Component:** `TenantAppPage` (`handleLogin`)
- **Evidence:**
  `handleLogin` checks `if (!activeShift)` during user login to trigger `setShowOpenShiftModal(true)`. However, `activeShift` is fetched asynchronously in `useEffect` on page mount. If `handleLogin` executes before `fetchTenant` finishes, `activeShift` is `null` in closure, prompting the cashier to open a new shift even if one is already active.
- **Expected Behavior:** Re-query active shift status directly from the server during `handleLogin` before opening the shift modal.
- **Impact:** Duplicate shift prompt for cashiers logging into existing open shifts.
- **Verification Status:** VERIFIED

---

### FINDING-POS-006
- **Severity:** LOW
- **Category:** Receipt Branding Fallback
- **Location:** [src/components/PosBilling.tsx:203](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PosBilling.tsx#L203)
- **Component:** `PosBilling.tsx` (`tenantName` default prop)
- **Evidence:** `tenantName = 'Main Godown & Retail Counter #1'`.
- **Actual Behavior:** If `tenantName` is not passed by parent container, printed receipts display the hardcoded default name instead of the actual branch title.
- **Expected Behavior:** Fall back to `tenant?.name` or `'PyntFlow Store'`.
- **Impact:** Minor branding defect on receipts if prop is omitted.
- **Verification Status:** VERIFIED

---

## 7. Recommended Remediation Order

1. **P0 (HIGH):** Fix sales return line total payload in `PosBilling.tsx:963` (FINDING-POS-001) to use `effectiveRate` when bucket tokens are retained by customer.
2. **P1 (HIGH):** Refactor keyboard shortcut `useEffect` in `PosBilling.tsx:1084` (FINDING-POS-002) to use `useRef` and attach listener once on mount.
3. **P1 (MEDIUM):** Replace 4-character random key generator in `PosBilling.tsx:666` (FINDING-POS-003) with `crypto.randomUUID()`.
4. **P2 (MEDIUM):** Re-verify active shift status from server inside `handleLogin` in `[slug]/page.tsx:158` (FINDING-POS-005) before opening shift modal.
5. **P3 (LOW):** Provide a cash reset button in `PosBilling.tsx` (FINDING-POS-004) to clear `isCashManuallyEdited`.
