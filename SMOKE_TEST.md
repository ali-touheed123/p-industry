# PYNTFLOW POS — Manual Smoke Test Guide (Example Shop)

**Target Test Environment:** Test Tenant `example` / `example-branch-2`  
**Base URL:** Local `http://localhost:3000` or staging URL  
**Scope:** Full verification of online operations, special billing, credit hold fallback, vouchers, register shifts, Karachi timezone business dates, and the Phase 6 offline queue.

---

## 1. Register Shift Lifecycle
1. **Open Register Shift:**
   - Log in to tenant `example`.
   - Open Shift Drawer (`F8` or click Register icon).
   - Enter opening cash (e.g., `Rs. 5,000`). Submit.
   - Verify shift status displays **OPEN** and drawer expected cash initializes to `Rs. 5,000`.
2. **Close Register Shift (At End of Testing):**
   - After conducting transactions below, return to Shift Drawer.
   - Verify the cash breakdown matches: `Opening Cash + Cash Sales - Cash Returns + Voucher Receipts - Voucher Payments`.
   - Enter closing cash count and close shift. Confirm status transitions to **CLOSED**.

---

## 2. Standard Online POS Sale & Idempotency
1. **Add Items & Checkout:**
   - Add 2 items to the cart (`F2` search or barcode scan).
   - Select customer: Walk-in or credit customer (`Ali Paint Center`).
   - Click **Checkout** (`F9`) $\to$ Cash tender $\to$ Confirm.
   - Verify receipt dialog prints with official sequential invoice number (e.g., `INV-20261030-0001`).
   - Confirm item inventory decreases by the sold quantity.
2. **Network Timeout / Retry Idempotency:**
   - In DevTools Network tab, throttle to "Offline" right after clicking Checkout, or simulate network drop.
   - Click "Try Again / Re-verify".
   - Confirm POS verifies via `idempotency_key` and returns the existing invoice without generating duplicate stock deductions or duplicate bills.

---

## 3. Special Receipt (Quotation / Net Rate Billing)
1. **Create Special Sale:**
   - Press `F7` or click "Special Print / Quotation".
   - Add line items with custom net rates or direct discounts.
   - Click **Print Special Receipt**.
   - Confirm receipt prints with custom header and non-standard layout (without tax/cost leak).
   - In Sales History, verify invoice appears with badge `special`.
2. **Special Sale Immutability:**
   - Attempt to click "Edit Invoice" on the special sale in Sales History.
   - Verify edit is blocked (special sales cannot be edited; must be cancelled or returned).

---

## 4. Cart Hold & Local Hold Recovery (Phase 5)
1. **Online Hold:**
   - Add items to the cart $\to$ Click **Hold Order** (`F6`).
   - Verify order appears in "Held Orders" modal.
   - Restore held order $\to$ verify cart items restore accurately.
2. **Offline Fallback Hold:**
   - Turn off Wi-Fi or set browser DevTools to Offline.
   - Add items $\to$ Click **Hold Order**.
   - Verify hold saves locally with toast *"Saved to local device holds"*.
   - Turn Wi-Fi back on $\to$ open Held Orders $\to$ verify local hold syncs automatically with server.

---

## 5. Customer Payment Vouchers & Ledgers
1. **Receipt Voucher (Payment Received):**
   - Navigate to Customer Recovery / Voucher Module (`F4`).
   - Select a customer with an outstanding balance $\to$ Enter `Rs. 1,000` Cash.
   - Submit voucher $\to$ verify voucher number generated (e.g. `RCP-20261030-XXXX`).
   - Verify customer ledger decreases balance by `Rs. 1,000`.
   - Verify Shift Drawer expected cash increases by `Rs. 1,000`.
2. **Ledger & Business Date Verification:**
   - Check Customer Ledger (`/api/ledgers` or Client Profile).
   - Verify the recorded date shows today's date in Pakistan Standard Time (`Asia/Karachi`, UTC+5), never rolling back to yesterday's date during late-night hours (00:00–04:59 PKT).

---

## 6. Phase 6 Offline Queue & Auto-Sync Test (Full Matrix)
1. **Go Offline:**
   - Disconnect Wi-Fi or set Network to Offline in DevTools.
   - Notice the header badge updates from green `Online` to amber/red `Offline (0 queued)`.
2. **Process 3 Consecutive Offline Sales:**
   - **Sale 1:** Walk-in cash sale (1 can of Super Emulsion). Click Checkout.
     - Confirm receipt prints with slip number format: `<DEVICE_CODE>-0001` (e.g., `K7F2-0001`). No confusing "Temporary" watermark.
   - **Sale 2:** Walk-in card/bank sale. Click Checkout.
     - Confirm receipt prints with slip number `<DEVICE_CODE>-0002`.
   - **Sale 3:** Credit sale to `Ali Paint Center`. Click Checkout.
     - Confirm receipt prints with slip number `<DEVICE_CODE>-0003`.
   - Notice the header pill reads: `Offline (3 queued)`.
   - Verify local stock on the POS screen decrements immediately (local overlay prevents overselling).
3. **Hard Page Refresh (IndexedDB Persistence):**
   - While still offline, press `Ctrl+F5` to reload the page.
   - Open POS Billing.
   - Verify header badge still shows `Offline (3 queued)`. Open Offline Queue modal $\to$ verify all 3 sales are listed in FIFO order with their local receipt numbers.
4. **Reconnect & Auto-Sync:**
   - Restore internet connection.
   - Verify within 5 seconds the sync engine triggers via Web Locks.
   - Watch the sync progress: `Syncing (3 left) ... Syncing (2 left) ... Syncing (1 left) ... Online (All synced)`.
   - Open Sales History: Confirm all 3 sales are present with official invoice numbers (`INV-...`) and searchable slip numbers (`[Slip #K7F2-0001]`).
   - Verify each sale landed **exactly once** (no duplicate stock deductions).
5. **Slip Number Search in Sales History:**
   - In Sales History search bar, type `K7F2-0001`.
   - Verify the exact invoice is returned instantly.
6. **Late-Sync Shift Reconciliation Test:**
   - Disconnect internet.
   - Ring up an offline sale under Shift 1.
   - Reconnect internet only *after* Shift 1 has been closed and Shift 2 is opened.
   - Confirm sale syncs into Shift 2 with flag `is_late_sync = true`.
   - Check Shift Drawer for Shift 2: Verify the sale's cash is **EXCLUDED** from Shift 2's expected drawer cash and appears in the distinct amber *"Late-synced offline sales"* panel.
