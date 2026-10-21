# Test Plan: Special Receipt Feature

**Product:** PyntFlow POS & Industrial ERP  
**Scope:** Special Receipt Designer, POS Blink Button, Pre-Print Rate Editing, Audit Logging, Immutability Guards, Reprints, and CEO Review  
**Status:** DRAFT — Awaiting User Approval  
**Target Database:** PostgreSQL 17 (Supabase `ignspvajzblmsbertmmv`)  

---

## Matrix of Test Scenarios

| Scenario ID | Test Name | Key Objective | Target Area |
| :--- | :--- | :--- | :--- |
| `TC-SR-01` | **Permission Toggle (ON/OFF)** | Verify UI and backend visibility toggles strictly on `can_use_special_receipt` | Dev Panel & POS |
| `TC-SR-02` | **Zero Identity Leak (Blank Canvas)** | Confirm blank receipt has zero store name, logo, phone, address, or branding | Print Engine |
| `TC-SR-03` | **Brand Match & Button Blink Hint** | Confirm button blinks only when matching brand is in cart; F6 shortcut works | POS Invoice Screen |
| `TC-SR-04` | **Mixed Invoice Item Inclusion** | Ensure all items (selected and non-selected brands) appear on special receipt | Special Print Modal |
| `TC-SR-05` | **Option A Content Rule & Zero Disclosure** | Confirm locked unit rates, line discounts only, and zero discount disclosure on paper | Database & Print |
| `TC-SR-06` | **Day Close & Cash Reconciliation** | Confirm Shift Drawer and Day Close match the actual cash collected | Accounting & Shifts |
| `TC-SR-07` | **Single Transaction Atomicity** | Verify invoice save + log insert commit atomically via `create_special_invoice_atomic` | Transaction & Print |
| `TC-SR-08` | **Immutability Triggers & Cascade Delete** | Verify direct UPDATE/DELETE/TRUNCATE blocked; tenant cascade delete allowed | Database Security |
| `TC-SR-09` | **Multi-Tenant & Role Isolation** | Confirm POS cannot read logs; CEO cannot access competitor tenants' logs | Security & RLS |
| `TC-SR-10` | **Regular Receipt Zero-Regression** | Ensure regular Save & Print (F5), template fallback, and shortcuts are untouched | POS Regular Flow |
| `TC-SR-11` | **Fresh Permission Revocation (Anti-Stale)** | Verify revoking permission in dev panel immediately yields 403 on active session | Auth Security |
| `TC-SR-12` | **Unrelated Tenants Same Owner Name (403)** | Verify CEO cannot access another tenant sharing the same owner_name string | Multi-Branch Auth |
| `TC-SR-13` | **Double-Click & Network Drop Resilience** | Verify double-click prevention and network drop idempotency handling | Concurrency & Network |
| `TC-SR-14` | **Browser Header/Footer & PDF Filename** | Verify `@page { margin: 0 }` suppresses headers/footers; PDF filename is "Receipt.pdf" | Browser Print Driver |
| `TC-SR-15` | **Special Reprint: Staff Only, Blocked on Cancelled (A4, D2)** | Verify staff can reprint active invoices; CEO and cancelled invoices strictly blocked | Sales History & API |
| `TC-SR-16` | **Quantity Lock & Server-Side Totals** | Verify Qty input is strictly disabled; master/printed/charged totals computed by DB | Special Print Modal |
| `TC-SR-17` | **Regular Checkout Rejects `printed_as`** | Verify standard `/api/invoices` ignores or rejects `printed_as = 'special'` | Backend API |
| `TC-SR-18` | **Anon / Authenticated Direct RPC Denied** | Verify direct PostgREST RPC call by anon or authenticated fails with permission error | PostgreSQL ACL |
| `TC-SR-19` | **Special Return Flow & Accepted Normal Return Risk** | Verify Sales History special return flow; document accepted risk on standard returns | POS Returns |
| `TC-SR-20` | **Special Invoice Edit Block (D1)** | Verify editing items/prices is blocked for all roles; wrong sale = cancel + new sale | Sales History & RPC |
| `TC-SR-21` | **Idempotency Collision Guards (B1)** | Verify duplicate invoice_no from non-special or other user raises exception | PostgreSQL RPC |
| `TC-SR-22` | **Line Item Strict Validation (B2)** | Verify qty <= 0, price < 0, discount overflow, and total_price mismatch reject | Server Validation |
| `TC-SR-23` | **Tender Breakdown & Credit Validation (0.02 Tolerance)** | Verify tender mismatch (with 0.02 tolerance) and walk-in credit sales are rejected | Server Validation |
| `TC-SR-24` | **Return Invoice Type Rejection (B4)** | Verify `invoice_type = 'return'` is rejected by create_special_invoice_atomic | PostgreSQL RPC |
| `TC-SR-25` | **Strict Catalog Item Lookup (B5)** | Verify missing catalog item ID raises exception without fallback | PostgreSQL RPC |
| `TC-SR-26` | **Receipt Text Override Isolation (B6)** | Verify receipt_name override appears in snapshot but not invoice_items | Data Integrity |
| `TC-SR-27` | **Print Strictly from Returned Snapshot (B7)** | Verify modal prints using server-returned snapshot and template | Print Pipeline |
| `TC-SR-28` | **CEO Log Status & Sums Exclusion (C4)** | Verify cancelled status visible and reprint/return rows excluded from sums | CEO Panel |
| `TC-SR-D4` | **Token Suppression on All Paper Receipts (Decision 1)** | Verify no token claim slip or token note text appears on any receipt type | Print Engine |
| `TC-SR-D4b` | **Token Logic Pass-Through in Special RPC (Decision 1)** | Verify tokens are accepted, token_transactions rows created, logic identical | PostgreSQL RPC |
| `TC-SR-29` | **Phase 8: Special Return at Charged Rate** | Verify return refunds at original special charged rate, not catalog price; populates original_invoice_item_id | Phase 8 Returns |
| `TC-SR-29b` | **Phase 8: Credit-Sale Return with Server Khata Offset** | Verify credit-sale return calculates server khata_offset, reduces client debt, sets paid_amount for cash/card remainder, and protects drawer cash | Phase 8 Returns |
| `TC-SR-30` | **Phase 8: Returnable Quantity Guard** | Verify return qty cannot exceed (sold qty − already returned qty) using original_invoice_item_id | Phase 8 Returns |
| `TC-SR-31` | **Phase 8: Option E Paperless Return (Zero Print)** | Verify return completes in DB and drawer; ZERO paper receipt printed | Phase 8 Returns |
| `TC-SR-32` | **Phase 8: Cash Refund Reduces Day Close** | Verify cash refund on special return subtracts from expected drawer cash | Phase 8 Returns |
| `TC-SR-33` | **Phase 8: Token Handling & Lid-Open Policy on Return** | Verify special return flow skips token issuance, rejects opened buckets, and refunds full charged price | Phase 8 Returns |
| `TC-SR-34` | **Phase 8: Return Blocked on Cancelled Invoice** | Verify create_special_return_atomic rejects return if original invoice is cancelled | Phase 8 Returns |

---

## Detailed Test Cases

### TC-SR-01: Permission Toggle Enforcement (UI & Server-Side)
- **Preconditions:**
  - Cashier User `cashier1` has `role = 'staff'` and `can_use_special_receipt = false`.
  - Cashier User `cashier2` has `role = 'staff'` and `can_use_special_receipt = true`.
- **Test Steps:**
  1. Log in to POS as `cashier1`. Check billing summary sidebar and Receipt Settings.
  2. Attempt direct API POST to `/api/special-receipt-templates` and `/api/invoices/special` using `cashier1` session.
  3. Log out. Log in as `cashier2`.
  4. Inspect billing summary and Receipt Settings.
- **Expected Results:**
  - For `cashier1`: "SPECIAL SAVE & PRINT (F6)" button is completely absent. "Special Receipt" tab in Receipt Settings is hidden. Pressing `F6` triggers no action. API requests return `403 Forbidden`.
  - For `cashier2`: Button is visible. Designer tab is accessible.

---

### TC-SR-02: Blank Template Zero Identity Leakage
- **Preconditions:**
  - Cashier has `can_use_special_receipt = true`.
  - Special receipt template has not been customized (starts from default blank canvas).
- **Test Steps:**
  1. Open Special Receipt Designer in POS.
  2. Inspect rendered receipt preview HTML.
  3. Perform a test print to a virtual PDF printer.
  4. Search output text for: branch name, address, phone, cashier username, system branding ("Powered by Pyntflow"), token claim slips.
- **Expected Results:**
  - All store branding, headers, phone numbers, addresses, logos, and system watermarks are **100% absent**.
  - Document contains only table headers (Item, Qty, Rate, Total) and numeric amounts.

---

### TC-SR-03: Brand Selection & Dynamic Button Blink Logic
- **Preconditions:**
  - Branch has Brand A ("Dulux") and Brand B ("Standard Paint").
  - In Special Receipt Settings, only Brand A ("Dulux") is selected in `special_receipt_brands`.
- **Test Steps:**
  1. Open POS screen with empty cart. Observe "SPECIAL SAVE & PRINT (F6)" button.
  2. Add an item from Brand B. Observe button.
  3. Add an item from Brand A. Observe button.
  4. Press `F6` on keyboard.
  5. Remove the Brand A item from cart. Observe button.
- **Expected Results:**
  - Steps 1 & 2: Button is stationary.
  - Step 3: Button immediately begins pulsing/glowing (`pos-btn-special-blink` class applied).
  - Step 4: Special Print Modal opens immediately via `F6`.
  - Step 5: Button stops pulsing immediately once Brand A item is removed.

---

### TC-SR-04: Mixed Invoice All-Items Inclusion
- **Preconditions:**
  - Cart contains 3 items: Item 1 (Brand A - Selected), Item 2 (Brand B - Non-Selected), Item 3 (Unbranded Base).
- **Test Steps:**
  1. Click "SPECIAL SAVE & PRINT (F6)".
  2. Inspect item list inside Special Print pre-print modal.
- **Expected Results:**
  - All 3 items are listed in the modal and appear on the receipt. Customer receives a single consolidated receipt for the entire sale.

---

### TC-SR-05: Option A Content Rule (Line Discounts Only & Zero Paper Disclosure)
- **Preconditions:**
  - Product `Dulux WeatherShield 4L`: Catalog Retail Price = Rs. 3,450, Cost Price = Rs. 2,600, Stock Qty = 20.
- **Test Steps:**
  1. Add 2 units of `Dulux WeatherShield 4L` to cart (Pre-discount Unit Rate = Rs. 3,450, Total = Rs. 6,900).
  2. Click "SPECIAL SAVE & PRINT (F6)".
  3. In pre-print modal, verify unit rate (Rs. 3,450) and Qty (2) are strictly locked / read-only.
  4. Apply a line discount of Rs. 450 per unit (Total Line Discount = Rs. 900, Charged Total = Rs. 6,000).
  5. Complete checkout and print.
  6. Inspect database tables (`invoices`, `invoice_items`, `items`, `special_print_log`) and printed paper output.
- **Expected Results:**
  - **POS Storage Rule Enforcement (Decision 1):**
    - `invoices.subtotal` = **Rs. 6,000** (sum of line totals AFTER line discounts).
    - `invoices.discount` = **0** (strictly zero for special sales; line discounts live exclusively in `invoice_items.discount`).
    - `invoices.net_total` = **Rs. 6,000** (subtotal − invoice discount = 6000 − 0).
    - `invoices.printed_as` = `'special'`.
    - *(Worked Example equivalent: 2 x 2,000 with 300 discount yields subtotal: 3,400, discount: 0, net_total: 3,400).*
  - `invoice_items.unit_price` = Rs. 3,450, `invoice_items.discount` = Rs. 900 (total line discount for 2 units at Rs. 450 per unit), `invoice_items.total_price` = Rs. 6,000.
  - `items.retail_price` remains **Rs. 3,450** (unchanged). Stock decreases by 2 units to **18**.
  - `special_print_log`:
    - `master_total` = **Rs. 6,900** (catalog price * 2)
    - `printed_total` = **Rs. 6,900** (pre-discount unit price * 2)
    - `charged_total` = **Rs. 6,000** (actual charged net money)
    - `delivery_charge` = **0**
    - `receipt_snapshot.total_variance` = **Rs. −900** (`(6000 - 0) - 6900`)
  - **Printed Paper Verification:**
    - Shows pre-discount rate: Rs. 3,450.
    - Shows derived printed total: Rs. 6,900.
    - **Zero discount rows, zero discount percentages, and zero occurrence of the word "Discount" anywhere on the paper.**
    - Payment breakdown (paid/change/balance) is hidden by default.

---

### TC-SR-06: Day Close & Cash Reconciliation Accuracy
- **Preconditions:**
  - Opening drawer cash = Rs. 5,000.
  - Invoice 1: Regular sale of Rs. 2,000 cash.
  - Invoice 2: Special sale originally Rs. 1,800, edited and sold for Rs. 1,500 cash.
- **Test Steps:**
  1. Complete Invoice 1 and Invoice 2.
  2. Open Shift Drawer (`/shift`).
  3. Inspect `Gross Sales`, `Cash Sales`, and `Expected Closing Cash`.
- **Expected Results:**
  - `Cash Sales` = Rs. 2,000 + Rs. 1,500 = **Rs. 3,500** (uses the edited price).
  - `Expected Closing Cash` = Rs. 5,000 (opening) + Rs. 3,500 = **Rs. 8,500**.
  - Counting physical cash in drawer matches Rs. 8,500 exactly (0 variance).

---

### TC-SR-07: Single Transaction Atomicity (`create_special_invoice_atomic`)
- **Preconditions:**
  - Cashier enters pre-print editor with valid items.
- **Test Steps (Standard Flow):**
  1. Click "Confirm & Print Special Receipt".
  2. Verify unified RPC `create_special_invoice_atomic` executes.
  3. Confirm both `invoices` and `special_print_log` contain the newly generated ID.
- **Test Steps (Simulated Abort Flow):**
  4. Artificially cause an error inside the RPC (e.g. invalid item ID).
  5. Inspect database tables `invoices`, `invoice_items`, `items`, and `special_print_log`.
- **Expected Results:**
  - Standard Flow: Both invoice and log records exist simultaneously.
  - Abort Flow: Transaction cleanly rolls back. **Zero rows created in `invoices` or `special_print_log`**, no stock deducted, and print dialog is never opened.

---

### TC-SR-08: Immutability Triggers & Cascade Deletion Behavior
- **Preconditions:**
  - `special_print_log` contains at least one record.
- **Test Steps:**
  1. Via database client, attempt `UPDATE special_print_log SET charged_total = 0 WHERE id = '...';`.
  2. Attempt direct SQL `DELETE FROM special_print_log WHERE id = '...';`.
  3. Attempt `TRUNCATE TABLE special_print_log;`.
  4. In Developer Panel, delete a test tenant that has existing rows in `special_print_log`.
- **Expected Results:**
  - Step 1 fails with exception: `special_print_log is an immutable audit trail. Updates and direct deletes are prohibited.`.
  - Step 2 fails with exception: `special_print_log is an immutable audit trail. Updates and direct deletes are prohibited.`.
  - Step 3 fails with statement trigger exception: `special_print_log is an immutable audit trail. Truncating is prohibited.`.
  - Step 4 succeeds: Deleting the parent tenant cascades cleanly because `pg_trigger_depth() > 1`, allowing developer panel tenant cleanup without errors.

---

### TC-SR-09: Multi-Tenant & Role Isolation
- **Preconditions:**
  - Tenant A ("City Branch") and Tenant B ("North Branch").
- **Test Steps:**
  1. As POS cashier of Tenant A, query `GET /api/special-print-log?tenant_id=Tenant_B_ID`.
  2. As CEO of Tenant A, query `GET /api/special-print-log?tenant_id=Tenant_B_ID`.
- **Expected Results:**
  - Step 1 returns `403 Forbidden` (POS users have zero log read access).
  - Step 2 returns `403 Forbidden` (CEOs cannot view logs of competitor/unauthorized tenants).

---

### TC-SR-10: Regular Receipt Zero-Regression
- **Preconditions:**
  - Branch has a custom regular receipt template configured in `BranchReceiptSettings`.
- **Test Steps:**
  1. Create a sale with multiple items in POS.
  2. Click the regular orange `SAVE & PRINT (F5)` button (or press `F5`).
  3. Inspect the printed thermal receipt.
- **Expected Results:**
  - Regular receipt prints with the branch's customized layout, shop name, address, phone, and logo.
  - `invoices.printed_as` is recorded as `'regular'`. No log entry written to `special_print_log`.

---

### TC-SR-11: Fresh Permission Revocation (Anti-Stale Token Rule)
- **Preconditions:**
  - Cashier `cashier1` is currently logged in with active JWT session and `can_use_special_receipt = true`.
- **Test Steps:**
  1. In another browser, open Developer Panel as developer.
  2. Edit `cashier1` and uncheck "Special Receipt Permission", saving changes to `app_users`.
  3. In `cashier1`'s existing un-refreshed POS session, attempt to click "SPECIAL SAVE & PRINT (F6)" or call `/api/special-receipt-templates`.
- **Expected Results:**
  - The API queries `app_users` fresh from the database.
  - The API immediately returns `403 Forbidden: Special receipt permission denied or revoked`.
  - Stale JWT session cannot bypass the revoked permission.

---

### TC-SR-12: Unrelated Tenants Sharing Same Owner Name
- **Preconditions:**
  - Tenant 1: Company A, `owner_name = 'Muhammad Ali'`, `tenant_id = 't1'`.
  - Tenant 2: Company B (completely unrelated business), `owner_name = 'Muhammad Ali'`, `tenant_id = 't2'`.
- **Test Steps:**
  1. Log in to CEO Suite as CEO of Tenant 1 (`auth.session.tenantId = 't1'`).
  2. Attempt to query `GET /api/special-print-log?tenant_id=t2`.
- **Expected Results:**
  - API does NOT use the unsafe `owner_name` text comparison.
  - Query for `t2` returns **`403 Forbidden: Access to branch denied`**. Cross-tenant data leak is completely prevented.

---

### TC-SR-13: Double-Click & Network Drop Resilience
- **Preconditions:**
  - Cashier is in the Special Print modal.
- **Test Steps:**
  1. Rapidly double-click "Confirm & Print Special Receipt".
  2. In simulated network environment, sever network connection immediately after RPC response leaves database. Re-submit form with the same `invoice_no`.
- **Expected Results:**
  - Step 1: The first click sets `submitting = true`, disabling the button. Concurrent duplicates are rejected by `uq_invoices_tenant_invoice_no`.
  - Step 2: Idempotency check detects existing `(tenant_id, invoice_no)` and returns the already-saved invoice without creating duplicates.

---

### TC-SR-14: Browser Print Header/Footer Suppression & PDF Filename
- **Preconditions:**
  - Cashier triggers special print.
- **Test Steps:**
  1. When browser print dialog appears, explicitly check the box **"Headers and footers"** in print options.
  2. Select "Save as PDF" as destination. Inspect the default suggested file name.
  3. Inspect top header margin and bottom footer margin in the preview.
- **Expected Results:**
  - Default suggested filename is **`Receipt.pdf`** (from neutral `<title>Receipt</title>`).
  - Top header: No store slug or date/time printed.
  - Bottom footer: **Zero URL text** (no `http://.../[slug]/pos` appears).

---

### TC-SR-15: Special Reprint: Staff Only, Ordering of Checks & Blocked on Cancelled (A4, D2)
- **Preconditions:**
  - Invoice `INV-9001` was saved with `printed_as = 'special'`.
  - User A: Counter staff with `can_use_special_receipt = false`.
  - User B: Counter staff with `can_use_special_receipt = true` in branch.
  - User C: Branch CEO (`role = 'ceo'`).
- **Test Steps:**
  1. Log in as User A. Open Sales History. Inspect "Reprint" button on `INV-9001`.
  2. Log in as User B. Click "Reprint" on `INV-9001`. Inspect DB log.
  3. Log in as User C (CEO). Open Sales History. Inspect "Reprint" button on `INV-9001`.
  4. Attempt direct API POST to `/api/special-print-log/reprint` with User C's session.
  5. Attempt to reprint an invoice belonging to a different branch with User B's session.
  6. Attempt to reprint a non-special invoice (`printed_as = 'regular'`) with User B's session.
  7. Cancel invoice `INV-9001` via `PATCH /api/invoices` (`status = 'cancelled'`). As User B, attempt to reprint `INV-9001` via `POST /api/special-print-log/reprint`.
  8. For a special invoice with a completed partial return, attempt reprint with User B.
- **Expected Results:**
  - User A: "Reprint" button is disabled/hidden with tooltip *"Reprint restricted to authorized counter staff"*.
  - User B: Print dialog opens with the exact unbranded special receipt from `receipt_snapshot`. A new row is inserted into `special_print_log` with `event_type = 'reprint'`.
  - User C: "Reprint" button is completely absent. CEO only views snapshot in CEO Special Print Log. Direct API POST returns **`403 Forbidden: CEO reprint is not permitted`**.
  - Step 5 (Branch check order): RPC rejects with **`Special receipt permission denied or branch mismatch`** before checking status.
  - Step 6 (`printed_as` check order): RPC rejects with **`Invoice % is not a special receipt invoice`** before checking status.
  - Step 7 (Status check): RPC `log_special_reprint_atomic` rejects with **`Cannot reprint cancelled invoice %`**. UI hides/disables reprint on cancelled invoices.
  - Step 8 (Return reprint): Succeeded. Displays the original sale as it was printed at checkout, and an audit row is logged with `event_type = 'reprint'`.

---

### TC-SR-16: Option A Content Rule & Server-Side Totals Verification (POS Storage Rule)
- **Preconditions:**
  - Cart has 2 units of Item A (Catalog Retail Price = Rs. 2,000).
- **Test Steps:**
  1. Click "SPECIAL SAVE & PRINT (F6)".
  2. Inspect `Qty` and `Unit Rate` columns in `SpecialPrintModal.tsx`. Verify both are disabled / strictly read-only.
  3. Apply a line discount of Rs. 300 per unit (Total Line Discount = Rs. 600, Charged Total = Rs. 3,400).
  4. Submit and complete print.
  5. Inspect generated row in `special_print_log`, database `invoices` row, and printed receipt.
- **Expected Results:**
  - Cashier cannot edit unit rates or quantities.
  - **POS Storage Rule Verification (Decision 1):**
    - `invoices.subtotal` = **Rs. 3,400** (sum of line totals AFTER line discount).
    - `invoices.discount` = **0** (strictly 0 for special sales; line discounts live in `invoice_items.discount`).
    - `invoices.net_total` = **Rs. 3,400**.
    - `invoice_items.unit_price` = **Rs. 2,000**, `invoice_items.discount` = **Rs. 300**, `invoice_items.total_price` = **Rs. 3,400**.
    - *(Rejection of Option B: asserts `invoices.subtotal != 4000` and `invoices.discount != 600`).*
  - In `special_print_log`:
    - `master_total` = **Rs. 4,000** (computed server-side from `items.retail_price` * 2).
    - `printed_total` = **Rs. 4,000** (computed server-side from pre-discount `unit_price` * 2).
    - `charged_total` = **Rs. 3,400** (actual charged net money after line discount).
    - `receipt_snapshot.items[0]` contains `list_price: 2000` and `charged_rate: 1700`.
  - Printed paper displays pre-discount rate (Rs. 2,000) and printed total (Rs. 4,000). Zero discount rows or labels appear on paper.

---

### TC-SR-17: Regular Checkout Rejects `printed_as = 'special'`
- **Preconditions:**
  - Attacker or custom client attempts direct call to regular `POST /api/invoices`.
- **Test Steps:**
  1. Send `POST /api/invoices` with payload containing `printed_as: 'special'`.
  2. Inspect the created invoice in database.
- **Expected Results:**
  - Regular endpoint ignores or rejects `printed_as: 'special'`. The invoice is created with `printed_as = 'regular'`.
  - Special receipts can only be initiated through `/api/invoices/special`.

---

### TC-SR-18: Anon / Authenticated Direct RPC Denied
- **Preconditions:**
  - Client has Supabase anon or authenticated JWT.
- **Test Steps:**
  1. Attempt direct RPC call via Supabase client:
     `supabase.rpc('create_special_invoice_atomic', { ... })`.
- **Expected Results:**
  - PostgreSQL engine rejects call with: `permission denied for function create_special_invoice_atomic`.
  - RPC is executable strictly by `service_role`.

---

### TC-SR-19: Special Invoice Sales Return Flow & Option E Paperless Completion
- **Preconditions:**
  - Special invoice `INV-9001` exists: 2x item sold at pre-discount rate Rs. 1,700, line discount Rs. 300/unit, charged price Rs. 1,400/unit.
- **Test Steps (Standard Return Screen - Accepted Risk):**
  1. Open standard POS return screen. Observe that standard returns have no link to an original invoice.
  2. Acknowledge that the risk of a cashier returning a special-sale item through the normal return flow (refunding at catalog price Rs. 1,700) is accepted by owner decision. POS does not claim to block this.
- **Test Steps (Special Return Flow - Phase 8 deployed):**
  3. Open Sales History. Select `INV-9001`. For authorized staff, click "Special Return".
  4. Verify modal displays original lines: sold qty (2), already returned (0), returnable (2).
  5. Enter return qty = 1. Unit price is locked at actual charged price (Rs. 1,400).
  6. Select "Cash Refund" as tender (Rs. 1,400).
  7. Submit return.
  8. Inspect print behavior and database.
- **Expected Results (Phase 8 deployed):**
  - Return refunds at Rs. 1,400 per unit (original charged rate), not Rs. 1,700.
  - **Option E Paperless Completion:** ZERO receipt of any kind is printed. No customer slip, no internal copy. Print dialog is NEVER opened.
  - Database: Return invoice created with `invoice_type = 'return'`, `original_invoice_id = INV-9001`, `printed_as = 'special'`.
  - Audit log row created with `event_type = 'return'`, `original_invoice_id = INV-9001`.
  - Day Close expected drawer cash is reduced by Rs. 1,400.

---

### TC-SR-20: Special Invoice Edit Block (D1)
- **Preconditions:**
  - Special invoice `INV-9001` exists (`printed_as = 'special'`).
  - Cashier, CEO, and Developer sessions available.
- **Test Steps:**
  1. Open Sales History as Cashier. Select `INV-9001`. Inspect "Edit / Add in POS" button.
  2. Attempt `PATCH /api/invoices` on `INV-9001` with modified prices or items.
  3. Attempt direct execution of `update_invoice_atomic` on `INV-9001`.
  4. Perform cancellation of `INV-9001` via `PATCH /api/invoices` (`{ action: 'cancel' }`).
- **Expected Results:**
  - Step 1: "Edit / Add in POS" button is completely hidden/disabled with tooltip: *"Special invoices cannot be edited. Cancel and re-issue a new special sale if incorrect."*
  - Step 2: `PATCH /api/invoices` rejects with `400 Bad Request: Special invoices cannot be edited`.
  - Step 3: `update_invoice_atomic` raises exception: `'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.'`
  - Step 4: `cancel_invoice_atomic` successfully cancels the invoice (`status = 'cancelled'`), restores inventory stock and client ledger balances safely.

---

### TC-SR-21: Idempotency Collision Guards (B1)
- **Preconditions:**
  - Regular invoice `INV-1001` exists (`printed_as = 'regular'`).
  - Special invoice `INV-2001` was created by User X (`printed_as = 'special'`).
- **Test Steps:**
  1. Call `create_special_invoice_atomic` with `invoice_no = 'INV-1001'`.
  2. Call `create_special_invoice_atomic` as User Y with `invoice_no = 'INV-2001'`.
  3. Call `create_special_invoice_atomic` as User X with `invoice_no = 'INV-2001'`.
- **Expected Results:**
  - Step 1: Raises exception: `'Invoice number INV-1001 already exists as a non-special invoice'`.
  - Step 2: Raises exception: `'Invoice number INV-2001 was created by another user'`.
  - Step 3: Returns `{ success: true, is_duplicate: true, invoice_id, master_total, charged_total, snapshot, template }` with the exact same shape as fresh return.

---

### TC-SR-22: Line Item Strict Server Validation (B2)
- **Preconditions:**
  - Authorized cashier session calling `POST /api/invoices/special`.
- **Test Steps:**
  1. Submit item with `qty = 0` or `qty = -2`.
  2. Submit item with `unit_price = -100`.
  3. Submit item with `discount = 600` on line gross `500`.
  4. Submit item with `qty = 2, unit_price = 1000, discount = 100`, but client sends `total_price = 1800` (correct is `1900`).
- **Expected Results:**
  - Step 1: Rejects with `'Invalid quantity: must be greater than zero'`.
  - Step 2: Rejects with `'Invalid unit price: cannot be negative'`.
  - Step 3: Rejects with `'Invalid discount: must be between 0 and line gross'`.
  - Step 4: Rejects with `'Total price mismatch for item: client sent 1800, calculated 1900'` (rejected, not silently fixed).

---

### TC-SR-23: Tender Breakdown & Credit Sale Validation (0.02 Tolerance)
- **Preconditions:**
  - Authorized cashier session.
- **Test Steps:**
  1. Charged total = 3,000. Send `paid_amount = 3000`, but tenders `cash_paid = 2000, card_paid = 500` (sum 2500). Difference = 500 (> 0.02 tolerance).
  2. Charged total = 3,000. Send `paid_amount = 2000, due_amount = 500` (sum 2500 != 3000). Difference = 500 (> 0.02).
  3. Charged total = 3,000. Send `client_id = null, due_amount = 1000, paid_amount = 2000`.
  4. Charged total = 3,000. Send `paid_amount = 3000`, tenders `cash_paid = 2999.985, card_paid = 0.015` (sum = 3000.000). Difference < 0.02 → accepted.
- **Expected Results:**
  - Step 1: Rejects with `'Tender breakdown does not equal paid_amount (within 0.02 tolerance)'`.
  - Step 2: Rejects with `'Paid amount plus due amount does not equal charged total (within 0.02 tolerance)'`.
  - Step 3: Rejects with `'Credit sales with balance due require a registered customer account'`.
  - Step 4: Accepted — difference is within 0.02 rounding tolerance.

---

### TC-SR-24: Return Invoice Type Rejection (B4)
- **Preconditions:**
  - Caller invokes `create_special_invoice_atomic`.
- **Test Steps:**
  1. Send payload with `invoice_type = 'return'`.
- **Expected Results:**
  - RPC immediately raises exception: `'create_special_invoice_atomic only accepts sales invoices. Return invoices are strictly prohibited.'`

---

### TC-SR-25: Strict Catalog Item Lookup (B5)
- **Preconditions:**
  - Caller invokes `create_special_invoice_atomic`.
- **Test Steps:**
  1. Send item with non-existent `item_id = '00000000-0000-0000-0000-000000000000'`.
- **Expected Results:**
  - RPC raises exception: `'Item with ID ... not found for tenant'`. Fallback to `item_price` is not executed.

---

### TC-SR-26: Receipt Text Override Isolation (B6)
- **Preconditions:**
  - Item in catalog is named `"Dulux Velvet Touch 4L"`.
- **Test Steps:**
  1. In Special Print Modal, enter description override `receipt_name = 'Special Silk Emulsion'`.
  2. Submit special sale.
  3. Inspect `invoice_items` in database for the created invoice.
  4. Inspect `special_print_log.receipt_snapshot`.
- **Expected Results:**
  - In `invoice_items.item_name`: Value is **`"Dulux Velvet Touch 4L"`** (pure catalog name preserved).
  - In `special_print_log.receipt_snapshot.items[0]`: Contains `receipt_name: "Special Silk Emulsion"` and `catalog_name: "Dulux Velvet Touch 4L"`.

---

### TC-SR-27: Print Strictly from Returned Snapshot (B7)
- **Preconditions:**
  - Cashier completes special checkout.
- **Test Steps:**
  1. Inspect network payload response from `POST /api/invoices/special`.
  2. Inspect the arguments passed to `printViaIframe`.
- **Expected Results:**
  - API response contains server-enriched `snapshot` and `template`.
  - Frontend passes `response.snapshot` and `response.template` directly to `buildSpecialThermalHtml` and `printViaIframe`. Local unsaved state is not printed.

---

### TC-SR-28: CEO Log Status & Sums Exclusion — Extended Worked Example with Delivery Charge (C4 & R4)
- **Preconditions:**
  - Branch has these special print log records:
    1. **Sale 1:** Invoice INV-8001, `event_type = 'sale'`, `master_total = 9,800`, `charged_total = 8,200`, `delivery_charge = 0`, `invoices.status = 'completed'`.
    2. **Sale 2:** Invoice INV-8002, `event_type = 'sale'`, `master_total = 6,000`, `charged_total = 5,000` (items Rs. 4,500 + delivery Rs. 500), `delivery_charge = 500`, `invoices.status = 'cancelled'`.
    3. **Reprint 1:** Invoice INV-8001, `event_type = 'reprint'`, `master_total = 9,800`, `charged_total = 8,200`, `delivery_charge = 0`.
    4. *(Phase 8 only)* **Return 1:** Invoice RET-8001, `event_type = 'return'`, `original_invoice_id = INV-8001`, `charged_total = 2,000`, `delivery_charge = 0`.
- **Test Steps:**
  1. Log in as CEO and navigate to Special Print Log View.
  2. Inspect table rows, badges, and event type labels.
  3. Inspect header summary cards.
- **Expected Results:**
  - **Table:** Displays all rows. Sale 2 has red "CANCELLED" badge. Reprint 1 has blue "REPRINT" badge. Return 1 has orange "RETURN" badge.
  - **Summary Cards (STRICTLY `event_type = 'sale'` ONLY):**
    - Total Sales Count: **2** (includes cancelled Sale 2 in count; CEO sees both)
    - Total Master Value: Rs. 9,800 + Rs. 6,000 = **Rs. 15,800**
    - Total Charged Value: Rs. 8,200 + Rs. 5,000 = **Rs. 13,200**
    - Total Delivery: Rs. 0 + Rs. 500 = **Rs. 500**
    - Total Price Variance: `sum(charged_total - delivery_charge) - sum(master_total)` = Rs. (13,200 − 500) − 15,800 = Rs. 12,700 − 15,800 = **Rs. −3,100**
  - **Excluded from sums:** Reprint (Rs. 8,200 duplicate) and Return (Rs. 2,000 refund) are NOT added to or subtracted from the summary cards.
  - **Reprint count** is tracked separately below the main metrics.

---

### TC-SR-D4: Token Suppression on All Paper Receipts (Owner Decision 1)
- **Preconditions:**
  - Branch has token configuration active. An item in the cart triggers a token action (keep or remove).
  - Registered customer and walk-in customer scenarios are tested across regular and special sales.
- **Test Steps:**
  1. Complete a **regular sale** (F5) with a token action. Inspect the printed receipt HTML.
  2. Complete a **special sale** (F6) with a token action. Inspect the printed receipt HTML.
  3. **Reprint** the regular sale from Sales History. Inspect output.
  4. **Reprint** the special sale from Sales History (authorized staff). Inspect output.
- **Expected Results:**
  - In all 4 scenarios:
    - **No** "Token Claim Slip" section (CLM-xxx code, claim text, scissors line) appears on paper.
    - **No** "Token Retained", "Token Discount", or "Tokens Issued" text lines appear on paper.
    - Walk-in customer who keeps a token: claim code is still generated and stored in DB, but nothing is printed.
    - Token **business logic** operates identically: `token_transactions` rows are created in DB, client token balances update.

---

### TC-SR-D4b: Token Business Logic Pass-Through in Special Sale RPC (Owner Decision 1)
- **Preconditions:**
  - Authorized cashier session. Token rule configured.
- **Test Steps:**
  1. Call `create_special_invoice_atomic` with non-empty `p_tokens = '[{"series_id": "...", "qty": 1, "action": "keep"}]'`.
  2. Inspect parameter definition of `create_special_return_atomic` to verify return RPC does NOT accept or process `p_tokens` (returns skip token creation).
- **Expected Results:**
  - `create_special_invoice_atomic` **ACCEPTS** non-empty `p_tokens` cleanly (no exception raised).
  - Tokens are passed directly to `create_invoice_atomic`.
  - `token_transactions` rows are created and saved in the database for sales.
  - `create_special_return_atomic` does not take `p_tokens` parameter; returns skip token creation entirely.
  - Zero token text appears on any printed receipt (render-layer suppression).

---

## Phase 8 Test Cases (Post-Staging Gate)

> [!NOTE]
> These tests apply only after Phase 8 (`TASK-SR-24` through `TASK-SR-28`) is deployed on staging.

### TC-SR-29: Special Return at Charged Rate (Phase 8)
- **Preconditions:**
  - Special invoice INV-9001: 2x "Dulux Velvet Touch" sold at Rs. 1,400 (catalog Rs. 1,700). Invoice-level discount = Rs. 0.
- **Test Steps:**
  1. Open Sales History, select INV-9001, click "Special Return".
  2. Return 1 unit. Verify pre-filled refund rate = Rs. 1,400.
  3. Select "Cash Refund" as tender.
  4. Submit return.
  5. Inspect database tables (`invoices`, `invoice_items`, `special_print_log`).
- **Expected Results:**
  - Return invoice: `net_total = 1,400`, `cash_paid = 1,400`, `others_paid = 0`, `printed_as = 'special'`, `invoice_type = 'return'`, `original_invoice_id = INV-9001 UUID`.
  - Return item: `invoice_items.original_invoice_item_id = original invoice_item.id`, `shade_code` matches original real shade_code (no `orig_line:` hack).
  - Audit log: `event_type = 'return'`, `charged_total = 1,400`, `original_invoice_id = INV-9001 UUID`.
  - **Option E Paperless Completion:** NO receipt of any kind is printed. Zero paper output.

---

### TC-SR-29b: Credit-Sale Return with Server Khata Offset (Phase 8)
- **Preconditions:**
  - Special credit sale INV-9003 for registered customer "Client A" with `current_balance = 5,000`: 1x Item sold at Rs. 2,000 net, with Rs. 500 paid in cash and Rs. 1,500 due (`due_amount = 1,500`).
  - Cashier shift open with Rs. 5,000 in drawer.
- **Test Steps:**
  1. Process special return for INV-9003 for 1 unit (return net = Rs. 2,000).
  2. Server calculates `khata_offset = LEAST(2000, 1500, 5000) = 1,500`. Cashier payout remainder = `2000 - 1500 = 500`.
  3. Cashier disburses remainder of Rs. 500 in cash (`p_cash_refunded = 500, p_card_refunded = 0`).
  4. Inspect return invoice tender fields, `clients.current_balance`, and drawer cash in `salesMath.ts`.
- **Expected Results:**
  - Return invoice header: `net_total = 2,000`, `paid_amount = 500`, `cash_paid = 500`, `card_paid = 0`, `due_amount = 0`, `payment_type = 'cash'`.
  - Client balance update: `clients.current_balance` reduces by `khata_offset` only (from 5,000 to 3,500; client debt is reduced by Rs. 1,500).
  - **Drawer Cash Protection:** Drawer cash in `salesMath.ts` is deducted strictly by the cash paid out (`physicalCash -= cash_paid = 500`), resulting in Rs. 4,500. The non-cash debt offset portion (`khata_offset = 1,500`) causes zero phantom cash deduction.

---

### TC-SR-30: Returnable Quantity Guard via `original_invoice_item_id` (Phase 8)
- **Preconditions:**
  - Special invoice INV-9002: 3x "Item A" sold at Rs. 1,000. 1 unit already returned in previous return.
- **Test Steps:**
  1. Open Special Return for INV-9002. Attempt to return 3 units.
  2. Attempt to return 2 units.
  3. Check SQL query summing `invoice_items.qty` where `original_invoice_item_id = $item_id`.
- **Expected Results:**
  - Step 1: RPC raises exception: `'Return qty (3) exceeds returnable qty (2) for item ...'`.
  - Step 2: Accepted. Returnable balance = 3 − 1 = 2. Return succeeds.
  - Step 3: Verified that already-returned calculation uses `ii.original_invoice_item_id = v_orig_item_id` across non-cancelled return invoices.

---

### TC-SR-31: Option E Paperless Return (Zero Print) (Phase 8)
- **Preconditions:**
  - Special return completed from TC-SR-29.
- **Test Steps:**
  1. Observe frontend POS / Sales History behavior on completion of special return.
  2. Check if browser print dialog opened or print iframe was generated.
  3. Check API response payload from `/api/invoices/special-return`.
- **Expected Results:**
  - Under Option E, **ZERO receipt of any kind is printed**.
  - No customer slip, no internal copy is generated.
  - Browser print dialog is NEVER opened.
  - API response returns `{ success: true, print_receipt: false }`.
  - Transaction is fully recorded in DB, `invoices`, and `special_print_log`.

---

### TC-SR-32: Cash Refund Reduces Day Close Expected Cash (Phase 8)
- **Preconditions:**
  - Shift opened with Rs. 5,000 opening balance.
  - 1 special sale: Rs. 3,000 cash received.
  - 1 special return: Rs. 1,000 cash refunded.
- **Test Steps:**
  1. Close the Day and inspect expected cash in drawer.
- **Expected Results:**
  - Expected drawer cash = Rs. 5,000 (opening) + Rs. 3,000 (sale cash) − Rs. 1,000 (return cash) = **Rs. 7,000**.
  - `salesMath.ts` calculates returns as subtractive from net cash collected.

---

### TC-SR-33: Return Token Behavior & Lid-Open Policy (Owner Decision & Phase 8)
- **Preconditions:**
  - Special invoice INV-9004 with product from token-eligible series.
- **Test Steps:**
  1. Customer returns bucket with unopened lid. Cashier accepts return.
  2. Customer attempts to return bucket with opened lid. Cashier inspects item.
  3. Inspect `token_transactions` in database.
- **Expected Results:**
  - Step 1: Accepted. `create_special_return_atomic` refunds full original charged unit price. Zero token deduction is made. Zero new token transactions created.
  - Step 2: Counter cashier rejects return per owner policy (lid open => return not accepted).
  - Zero token claim text appears on any document.

---

### TC-SR-34: Return Blocked on Cancelled Special Invoice (Phase 8)
- **Preconditions:**
  - Special invoice INV-9005 cancelled via `cancel_invoice_atomic` (`status = 'cancelled'`).
- **Test Steps:**
  1. Attempt to invoke `create_special_return_atomic` targeting INV-9005.
- **Expected Results:**
  - RPC raises exception: `'Cannot process return for cancelled special invoice ...'`.
  - No return invoice is created; inventory and balances remain untouched.

---

### TC-SR-35: Cents Rule Across Multiple Return Calls (R1f)
- **Preconditions:**
  - Original special invoice INV-9010 contains 1 line: 3 units of Item X at `total_price = 1000.00` (`unit_price = 333.3333...`).
- **Test Steps:**
  1. First call to `create_special_return_atomic`: return 1 unit.
  2. Second call to `create_special_return_atomic`: return 1 unit.
  3. Third call to `create_special_return_atomic`: return 1 unit (completes line remaining quantity).
- **Expected Results:**
  - Call 1: Partial return (`v_cum_returned_qty (1) < v_orig_item.qty (3)`). Refund = `ROUND(1 * 1000.00 / 3, 2)` = **333.33**.
  - Call 2: Partial return (`v_cum_returned_qty (2) < v_orig_item.qty (3)`). Refund = `ROUND(1 * 1000.00 / 3, 2)` = **333.33**. Already refunded for line = 333.33 + 333.33 = 666.66.
  - Call 3: Completing return (`v_cum_returned_qty (3) = v_orig_item.qty (3)`). Refund = `line.total_price - already_refunded_for_line` = `1000.00 - 666.66` = **333.34**.
  - Sum of refunds across 3 calls = `333.33 + 333.33 + 333.34 = 1000.00` exactly. Zero penny discrepancy.

---

### TC-SR-36: Mixed Tender Return (Cash + Card) with Server Khata Offset (R1c, Owner Decision)
- **Preconditions:**
  - Special invoice INV-9011 for registered customer (Client A) with `current_balance = 5,000`. Original credit sale was Rs. 1,400 net (paid 1000 cash, due 400).
  - 1 item returned for total refund of Rs. 1,400.
- **Test Steps:**
  1. Invoke `create_special_return_atomic` with cash and card: `p_cash_refunded = 500`, `p_card_refunded = 500`.
  2. Inspect return invoice fields in `invoices` table.
  3. Inspect `clients.current_balance`.
- **Expected Results:**
  - Server computes `khata_offset = LEAST(1400, 400, 5000) = 400`.
  - Cashier refund needed = `1400 - 400 = 1000`. Cashier splits between cash 500 and card 500.
  - In `invoices`: `cash_paid = 500`, `card_paid = 500`, `paid_amount = 1000`, `net_total = 1400`, `payment_type = 'mixed'`, `due_amount = 0`.
  - In `clients`: `current_balance = 5,000 - 400 = 4,600` (reduced by khata_offset 400; balance never goes negative).

---

### TC-SR-37: In-Request Duplicate Item Aggregation (R1a)
- **Preconditions:**
  - Special invoice INV-9012 has 1 line with `qty = 2`. No units previously returned.
- **Test Steps:**
  1. Call `create_special_return_atomic` with `p_items` array containing duplicate entries for the same `original_invoice_item_id`: `[{"original_invoice_item_id": "...", "qty": 1.5}, {"original_invoice_item_id": "...", "qty": 1.0}]`. (Total requested = 2.5).
  2. Call `create_special_return_atomic` with duplicates within limit: `[{"original_invoice_item_id": "...", "qty": 1.0}, {"original_invoice_item_id": "...", "qty": 1.0}]`. (Total requested = 2.0).
- **Expected Results:**
  - Step 1: Exception raised: `'Return qty (2.50) exceeds returnable qty (2.00) for item ...'`.
  - Step 2: Accepted. Exactly 2 units returned.

---

### TC-SR-38: Original Invoice Sales and Special Status Guard (R1b)
- **Preconditions:**
  - Special return RET-9001 (`invoice_type = 'return'`).
  - Regular invoice INV-regular (`printed_as = 'regular'`).
- **Test Steps:**
  1. Attempt to invoke `create_special_return_atomic` targeting RET-9001 as `p_original_invoice_id`.
  2. Attempt to invoke `create_special_return_atomic` targeting INV-regular as `p_original_invoice_id`.
- **Expected Results:**
  - Step 1: Exception raised: `'Cannot process return for non-special or return invoice ...'`.
  - Step 2: Exception raised: `'Cannot process return for non-special or return invoice ...'`.

---

### TC-SR-39: Negative Tender Rejection (R1c)
- **Preconditions:**
  - Valid special invoice eligible for return of Rs. 1,000.
- **Test Steps:**
  1. Call `create_special_return_atomic` with `p_cash_refunded = -100`.
  2. Call `create_special_return_atomic` with `p_card_refunded = -50`.
- **Expected Results:**
  - In both steps: Exception raised: `'Refund amounts cannot be negative'`.

---

### TC-SR-40: Shift Validation in Special Sale and Return RPCs (R1g & R1d)
- **Preconditions:**
  - Tenant A with an open shift `shift_open_A`, a closed shift `shift_closed_A`.
  - Tenant B with an open shift `shift_open_B`.
- **Test Steps:**
  1. Call `create_special_invoice_atomic` with `p_shift_id = NULL`.
  2. Call `create_special_invoice_atomic` with `p_shift_id = shift_closed_A`.
  3. Call `create_special_invoice_atomic` with `p_shift_id = shift_open_B` (cross-tenant).
  4. Repeat steps 1–3 for `create_special_return_atomic`.
- **Expected Results:**
  - Missing shift: Exception `'Shift ID is required'`.
  - Closed shift: Exception `'Shift ... is not open'`.
  - Cross-tenant / nonexistent shift: Exception `'Shift not found or access denied'`.

---

### TC-SR-41: Cancellation Route Verification and RPC Residual Risk (R2)
- **Preconditions:**
  - Special invoice INV-9020.
- **Test Steps:**
  1. Verify real API cancellation entry points in Next.js codebase (`src/app/api/invoices/route.ts`).
  2. Attempt to cancel special invoice via `PATCH /api/invoices` (`action: 'cancel'`).
  3. Attempt to cancel special invoice via `DELETE /api/invoices`.
  4. Inspect direct PostgREST RPC accessibility to `cancel_invoice_atomic`.
- **Expected Results:**
  - Step 1: Confirmed real cancel routes are `PATCH /api/invoices` (lines 371–385) and `DELETE /api/invoices` (lines 535–546). No `/api/invoices/cancel` route exists.
  - Step 2: Next.js API route blocks special invoice cancellation: `400 Bad Request - 'Special invoices cannot be cancelled'`.
  - Step 3: Next.js API route blocks special invoice cancellation: `400 Bad Request - 'Special invoices cannot be cancelled'`.
  - Step 4: Residual risk documented: PostgREST RPC `POST /rest/v1/rpc/cancel_invoice_atomic` is `SECURITY DEFINER` and could bypass Next.js route if called directly with service/authenticated credentials unless SQL check is added.

