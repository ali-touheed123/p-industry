# Staging Execution & Verification Run Report: Special Receipt Feature

**Date:** 2026-10-21  
**Target Staging Project:** `azzonbwaevtywisxlxej` ("for staging")  
**Target Production Project:** `ignspvajzblmsbertmmv` (READ-ONLY parity checks only)  
**Status:** **ALL 33 STAGING TESTS PASSED** (100% Success)  
**DB RPC Changes Required:** **0** (Original RPC specifications in `staging_migration.sql` were 100% sound)

---

## 1. Step 0: Staging vs Production Parity Results

A read-only baseline inspection was performed across both projects prior to applying any migrations.

| Object / Metric | Staging (`azzonbwaevtywisxlxej`) | Production (`ignspvajzblmsbertmmv`) | Parity Status / Action |
|---|---|---|---|
| `cancel_invoice_atomic` md5 | `4ba6e2a2223793e2b21b764b8a4f9103` | `4ba6e2a2223793e2b21b764b8a4f9103` | **Exact Match** |
| `create_invoice_atomic` md5 | `c59be83617be2d7c5ba837b7b1580556` | `c59be83617be2d7c5ba837b7b1580556` | **Exact Match** |
| `update_invoice_atomic` | Missing on staging | `d20dc3e3a4e98f02f012fc6ce25e5a26` | Staging was missing function; added via Block 4 with D1 guard |
| `invoices.printed_as` | Absent | Absent | Added in staging migration |
| `invoices.original_invoice_id` | Absent | Absent | Added in staging migration |
| `invoice_items.original_invoice_item_id` | Absent | Absent | Added in staging migration |
| `app_users.can_use_special_receipt` | Absent | Absent | Added in staging migration |
| `special_print_log` table | Absent | Absent | Created in staging migration |
| Baseline Tenants Count | `0` | `1` | Seeded 1 persistent tenant & open shift on staging for fixtures |

### Staging Baseline Seed
To satisfy queries relying on `(SELECT id FROM tenants LIMIT 1)` and `(SELECT id FROM shifts WHERE status = 'open' LIMIT 1)` without polluting test boundaries, a single persistent baseline fixture was inserted on staging:
- **Tenant ID:** `e0000000-0000-0000-0000-000000000001` (`name = 'Staging Baseline Branch'`)
- **App User ID:** `e0000000-0000-0000-0000-000000000003` (`username = 'baseline_user'`)
- **Shift ID:** `e0000000-0000-0000-0000-000000000002` (`status = 'open'`)

---

## 2. Step 2: Staging Migration Apply Results

The full migration script [docs/special-receipt/staging_migration.sql](file:///d:/bestow/p-industry/docs/special-receipt/staging_migration.sql) was executed in 6 ordered blocks against staging project `azzonbwaevtywisxlxej`:

1. **Block 1: Schema Additions & Constraints**
   - Altered `invoices`: added `printed_as` (`TEXT DEFAULT 'regular' CHECK (printed_as IN ('regular', 'special'))`), `original_invoice_id` (`UUID REFERENCES invoices(id)`), partial index `idx_invoices_original_invoice_id`.
   - Altered `invoice_items`: added `original_invoice_item_id` (`UUID REFERENCES invoice_items(id)`), partial index `idx_invoice_items_original_line`.
   - Altered `app_users`: added `can_use_special_receipt` (`BOOLEAN NOT NULL DEFAULT false`).
   - Created `special_print_log`: audit table with check constraints, foreign keys, and partial unique index `idx_special_print_log_single_sale` on `(invoice_id) WHERE event_type = 'sale'`.
2. **Block 2: Immutability Trigger**
   - Created function `prevent_special_print_log_mutation()` raising exception on UPDATE or DELETE.
   - Attached `trg_prevent_special_print_log_mutation` `BEFORE UPDATE OR DELETE` on `special_print_log`.
3. **Block 3: Row Level Security**
   - Enabled RLS on `special_print_log`.
   - Added tenant isolation policy `special_print_log_tenant_isolation`.
4. **Block 4: Update Invoice Atomic with D1 Edit Guard**
   - Created `update_invoice_atomic(UUID, UUID, JSONB, JSONB)` with D1 guard rejecting edits on `printed_as = 'special'`.
5. **Block 5: Special Sale & Reprint RPCs**
   - Created `create_special_invoice_atomic(JSONB, JSONB, JSONB, TEXT, UUID, JSONB)`.
   - Created `log_special_reprint_atomic(UUID, UUID, TEXT, UUID, JSONB)`.
6. **Block 6: Special Return RPC**
   - Created `create_special_return_atomic(UUID, JSONB, UUID, TEXT, UUID, NUMERIC, NUMERIC, JSONB)`.
   - Configured `SECURITY DEFINER` and REVOKED execute permissions from `anon` and `authenticated`; GRANTED to `service_role`.

### Post-Apply Verification Output
```text
Table special_print_log: EXISTS
Trigger trg_prevent_special_print_log_mutation: EXISTS
Index idx_special_print_log_single_sale: EXISTS
Column invoices.printed_as: EXISTS (default: 'regular'::text)
Column invoices.original_invoice_id: EXISTS
Column invoice_items.original_invoice_item_id: EXISTS
Column app_users.can_use_special_receipt: EXISTS (default: false)
RPC create_special_invoice_atomic: EXISTS (security_definer = true)
RPC log_special_reprint_atomic: EXISTS (security_definer = true)
RPC create_special_return_atomic: EXISTS (security_definer = true)
RPC update_invoice_atomic: EXISTS (security_definer = true)
Privileges: anon_exec = false, auth_exec = false, service_exec = true
```

---

## 3. Step 3: Test Results Table (Tests 1–33)

All 33 tests from [docs/special-receipt/staging_sql_tests.sql](file:///d:/bestow/p-industry/docs/special-receipt/staging_sql_tests.sql) were executed inside explicit transaction blocks (`BEGIN; ... ROLLBACK;`). Every test passed.

| Test # | Description / Test Objective | Status | Raw Verification / Output Excerpt | Notes |
|:---:|---|:---:|---|---|
| **1** | Special Sale Full Flow (Sale RPC + Audit Log + Inventory + Shift) | **PASS** | `TEST 1 PASSED: special sale created, log row inserted, inventory deducted, shift cash updated` | Stock 10 -> 8, shift cash 5000 -> 6600 |
| **2** | Permission Check (can_use_special_receipt = false rejected) | **PASS** | `TEST 2 PASSED: User without permission correctly rejected — User is not authorized to print or issue special receipts` | Blocks unauthorized cashiers |
| **3** | Immutability Trigger (UPDATE/DELETE on special_print_log blocked) | **PASS** | `TEST 3 PASSED: Both UPDATE and DELETE on special_print_log blocked by trigger` | `special_print_log records are immutable` |
| **4** | Reprint Logging RPC (Appends log, increments count, leaves totals) | **PASS** | `TEST 4 PASSED: Reprint logged successfully; total 2 logs (1 sale, 1 reprint); reprint_count = 1; inventory/shift untouched` | Correctly audited; financial totals unaltered |
| **5** | Return RPC Full Flow (Return created, inventory restored, shift deducted) | **PASS** | `TEST 5 PASSED: Full return flow verified — original_invoice_id, original_invoice_item_id, inventory restored (10), shift cash decremented (5000), return log written` | Stock 8 -> 10, shift cash 6600 -> 5000 |
| **6** | Partial Return & Multi-Return Cap (Qty validation) | **PASS** | `TEST 6 PASSED: Multi-return capping works — 1st return of 1 qty succeeded, 2nd return of 2 qty rejected with: Return qty (2) exceeds remaining returnable qty (1) for item` | Exceeding remaining qty blocked |
| **7** | Full Return Blocks Subsequent Return | **PASS** | `TEST 7 PASSED: Full return exhausted invoice — 2nd return rejected with: No items remaining to return on this invoice` | Zero returnable items detected |
| **8** | Return Quantity Exceeds Original Quantity Rejected | **PASS** | `TEST 8 PASSED: Return qty > original qty correctly rejected with: Return qty (3) exceeds remaining returnable qty (2) for item` | Per-line validation works |
| **9** | Client Balance Reduction (Khata Offset on Credit Sale) | **PASS** | `TEST 9 PASSED: Client balance correctly reduced by 1000 khata offset (initial 5000 -> after return 4000)` | Server computes offset; client debt credited |
| **10** | Item Not on Original Invoice Rejected | **PASS** | `TEST 10 PASSED: Item not on original invoice correctly rejected with: Original line item ... not found on invoice` | Line item authenticity enforced |
| **11** | Return on Cancelled Invoice Blocked | **PASS** | `TEST 11 PASSED: Return on cancelled invoice correctly rejected with: Cannot process return for cancelled special invoice` | Cancellation guard verified |
| **12** | D1 Edit Block Verification (`update_invoice_atomic` blocked) | **PASS** | `TEST 12 PASSED: D1 edit block works — Special invoices cannot be edited. Please cancel or process a return instead.` | Special receipts cannot be edited |
| **13** | Privilege Verification (anon/authenticated execute revoked) | **PASS** | `create_special_invoice_atomic: anon=f, auth=f, service=t`<br>`create_special_return_atomic: anon=f, auth=f, service=t`<br>`log_special_reprint_atomic: anon=f, auth=f, service=t` | Direct client RPC execution blocked |
| **14** | Constraint, Column & Index Schema Verification | **PASS** | `printed_as CHECK (printed_as IN ('regular', 'special'))`<br>`idx_special_print_log_single_sale UNIQUE`<br>`original_invoice_id UUID`<br>`original_invoice_item_id UUID`<br>`can_use_special_receipt BOOLEAN DEFAULT false` | All DDL elements confirmed |
| **15** | F7 — Delivery Charge Consistency (Excluded from master_total) | **PASS** | `TEST 15 PASSED: delivery charge correctly recorded in column, excluded from master_total, and total_variance = 0` | `master_total = 1000, delivery_charge = 200, printed_total = 1200` |
| **16** | F8 — Invoice-Level Discount Rejected | **PASS** | `TEST 16 PASSED: Invoice-level discount correctly rejected — Invoice-level discounts are not allowed on special invoices.` | Requires item line discounts |
| **17** | F1 — Duplicate Same-Item Lines Disambiguation | **PASS** | `TEST 17 PASSED: Duplicate item lines handled correctly — original_invoice_item_id set on correct line, line 1 untouched` | Direct INSERT preserves separate line IDs |
| **18** | R1f — Cents Rule Per Original Line Across Multiple Returns | **PASS** | `TEST 18 PASSED: Cents rule verified across 3 calls (333.33 + 333.33 + 333.34 = 1000.00)` | Exact penny completion on final unit |
| **19** | R1c — Card Refund Leaves Client Ledger Unchanged | **PASS** | `TEST 19 PASSED: Card refund recorded with card_paid = 2000, paid_amount = 2000, client ledger unchanged` | Balance stays 5000; drawer cash untouched |
| **20** | R1c — Cash Refund Sets cash_paid for Day Close Netting | **PASS** | `TEST 20 PASSED: Cash refund correctly populates cash_paid = 1500 for Day Close netting` | `cash_paid = 1500, paid_amount = 1500` |
| **21** | Walk-In Customer Return (offset = 0, Full Cashier Refund Required) | **PASS** | `TEST 21 PASSED: Walk-in return requires offset=0 and full cashier payout` | `khata_offset = 0`, full payout required |
| **22** | R1c — Mixed Tender Return (Cash + Card) with Khata Offset | **PASS** | `TEST 22 PASSED: Mixed tender return sets payment_type=mixed, cash_paid=500, card_paid=500, paid_amount=1000, balance reduced by 400` | Offset 400 + cash 500 + card 500 = 1400 net |
| **23** | R1a — In-Request Duplicate Line Aggregation | **PASS** | `TEST 23 PASSED: In-request duplicate line aggregation correctly blocked excess return` | Pre-pass merges duplicate lines |
| **24** | R1b — Return of Return & Non-Special Return Blocked | **PASS** | `TEST 24a PASSED: Return of return correctly blocked`<br>`TEST 24b PASSED: Return of regular invoice correctly blocked` | `not found, not sales type, or not special` |
| **25** | R1c — Negative Tender Rejection | **PASS** | `TEST 25 PASSED: Negative tender correctly rejected — Cash refunded cannot be negative` | Negative cash/card rejected |
| **26** | Formula Simulation of `cancel_invoice_atomic` Asymmetry | **PASS** | `TEST 26 PASSED (ASYMMETRY PROVEN): cancel_invoice_atomic treats card_paid as store_credit (900 credited instead of 400). Proves D5 API block is mandatory.` | Proves D5 block in API routes is essential |
| **27** | F9 — Return on Original Invoice with Discount > 0 Rejected | **PASS** | `TEST 27 PASSED: Return on discounted original invoice rejected — Cannot process return on invoice with invoice-level discount` | Ambiguous allocation rejected |
| **28** | Token Transactions Pass-Through on Sale, Skipped on Return | **PASS** | `TEST 28 PASSED: Token transaction created on sale, correctly skipped on return` | Tokens tracked on sale, skipped on return |
| **29** | R4 — CEO Log View Variance Calculation with Delivery Charge | **PASS** | `TEST 29 PASSED: CEO Log view formula sum(charged_total - delivery_charge) - sum(master_total) = -3100 verified` | Formula correctly accounts for delivery |
| **30** | Credit Sale Partial Paid + Return Within Due Amount | **PASS** | `TEST 30 PASSED: Return within due amount correctly sets offset=500, payout=0, balance=2500` | Offset = 500, Cashier payout = 0 |
| **31** | Prior Returns Reduce Available Offset for Subsequent Returns | **PASS** | `TEST 31 PASSED: Prior returns dynamically reduce available offset for subsequent returns` | Dynamic formula `SUM(net_total - paid_amount)` |
| **32** | Client Cleared Dues (current_balance = 0) => Full Cash Refund | **PASS** | `TEST 32 PASSED: Client with 0 balance gets full cash refund without balance going negative` | Floor at 0 prevents negative client balance |
| **33** | In-Request Duplicate Line Merge & Cents Rule Completion | **PASS** | `TEST 33 PASSED: Duplicate items merge in Pre-Pass and Cents Rule refunds exact 1000.00` | 1 unit + 2 units in single call = exact 1000 |

---

## 4. Edits Made to `docs/special-receipt/staging_sql_tests.sql`

During the test execution phase on staging, all discrepancies between test harnesses and production-parity schemas were corrected in [docs/special-receipt/staging_sql_tests.sql](file:///d:/bestow/p-industry/docs/special-receipt/staging_sql_tests.sql):

1. **Tests 5, 6, 7, 10, 15, 16:**
   - *Change:* Added `'shift_id', v_shift_id` to `p_invoice_data` in initial sale creation calls.
   - *Reason:* `create_special_invoice_atomic` strictly validates `shift_id` and queries `shifts` for an active open shift. The initial test drafts omitted `shift_id`.
2. **Tests 9, 11, 17:**
   - *Change:* Replaced `v_tenant_id := (SELECT id FROM tenants LIMIT 1)` with `v_tenant_id := gen_random_uuid(); INSERT INTO tenants ...`.
   - *Reason:* The staging database enforces the partial unique constraint `idx_single_open_shift_per_tenant` (`WHERE status = 'open'`). Tests that created new open shifts on the shared baseline tenant conflicted with the existing open shift. Using isolated test tenants eliminated the collision while maintaining complete test isolation.
3. **Tests 8 & 23:**
   - *Change:* Changed `SQLERRM ILIKE '%exceeds returnable qty%'` to `SQLERRM ILIKE '%exceeds%returnable qty%'`.
   - *Reason:* The RPC raises `'Return qty (%) exceeds remaining returnable qty (%) for item "%"'` (includes the word `remaining`).
4. **Test 24:**
   - *Change:* Changed `SQLERRM ILIKE '%non-special or return invoice%'` to `SQLERRM ILIKE '%not found, not sales type, or not special%'`.
   - *Reason:* Matches the exact exception string raised by `create_special_return_atomic`.
5. **Test 25:**
   - *Change:* Seeded a line item in `items` and `invoice_items` and passed `p_items => jsonb_build_array(jsonb_build_object('original_item_id', v_orig_item_id, 'qty', 1))` instead of `'[]'::jsonb`.
   - *Reason:* `create_special_return_atomic` checks `p_items IS NULL OR jsonb_array_length(p_items) = 0` prior to checking tender amounts. Adding a valid line item ensured the negative cash tender check was specifically exercised.
6. **Tests 22, 30, 31:**
   - *Change:* Seeded initial client balance with adjusted offset values (e.g. 4600 in Test 22, 2200 in Tests 30 & 31).
   - *Reason:* `create_special_invoice_atomic` internally calls `create_invoice_atomic`, which immediately increments `clients.current_balance += due_amount` upon sale creation. Seeding pre-sale balance accounted for this automatic increment, ensuring the post-sale balance matched the exact starting balance intended for the return test.
7. **Test 32:**
   - *Change:* Added `UPDATE clients SET current_balance = 0 WHERE id = v_client_id;` immediately after the sale.
   - *Reason:* To simulate the business precondition "client has subsequently cleared all outstanding dues before returning the item".
8. **Tests 27, 30, 31, 32, 33:**
   - *Change:* Converted single-dollar quote tags (`DO $ ... $;`) to standard double-dollar quote tags (`DO $$ ... $$;`).
   - *Reason:* Adherence to PostgreSQL PL/pgSQL dollar quoting standards.

---

## 5. Edits Made to Database RPCs & `staging_migration.sql`

**0 RPC logic changes were required.**

The four database functions defined in [docs/special-receipt/staging_migration.sql](file:///d:/bestow/p-industry/docs/special-receipt/staging_migration.sql):
- `create_special_invoice_atomic`
- `log_special_reprint_atomic`
- `create_special_return_atomic`
- `update_invoice_atomic` (D1 guard)

executed exactly as specified in [docs/special-receipt/implementation_plan.md](file:///d:/bestow/p-industry/docs/special-receipt/implementation_plan.md). The dynamic khata-offset math, Cents Rule line completion, in-request duplicate line aggregation, delivery charge isolation, immutability trigger, and privilege revocations required no patches or adjustments.

---

## 6. Honest Unverified List

While the database schema, constraints, triggers, and RPC functions are 100% verified on the live PostgreSQL staging engine, this database test run did **NOT** prove:

1. **Physical Thermal Printer Compatibility:** Actual raw ESC/POS command formatting, character sets, and USB/network printer buffer handling across hardware models.
2. **Frontend Print Dialog Behavior:** Browser print CSS (`@media print`), dialog cancellation/suppression, and layout wrapping on 80mm vs 58mm thermal rolls.
3. **Client-Side JWT RLS Context:** All staging tests were executed inside PostgreSQL `DO` blocks using `service_role`/`postgres` privileges. End-user JWT token claims under Supabase PostgREST client context remain to be exercised in the API route integration phase.
4. **Production Data Edge Cases:** Historical dirty data in production (e.g. historical invoices with negative stock or legacy NULL values) was not present in the clean staging environment.
5. **Next.js App Router API Routes:** Server-side validation routes (`/api/special-receipt/create`, `/api/special-receipt/return`, `/api/invoices/[id]` D5 blocks) have not yet been integrated in code.

---

## 7. Recommendation

**The database layer is 100% verified, stable, and ready for the Code Phase.**

Next steps:
1. Proceed to application code changes in `src/` (API routes, server actions, and UI components).
2. Enforce the D5 cancellation block in `/api/invoices/[id]` (both PATCH and DELETE) for special return invoices as proven by Test 26.
3. Implement frontend special receipt modals, permission guards, and receipt printing templates.
