# Task Checklist: Special Receipt Feature

**Product:** PyntFlow POS & Industrial ERP  
**Mode:** AUDIT & PLANNING ONLY (Implementation paused pending user approval)  
**Risk Levels:** Low, Medium, High  
**Target Database:** PostgreSQL 17 (Supabase `ignspvajzblmsbertmmv`)  

> [!IMPORTANT]
> Tasks marked with **`[REQUIRES USER APPROVAL]`** must receive explicit written confirmation before work begins. No code, migration, or DB writes will be executed until authorization is granted.

---

## Phase 0: Pre-Migration Safeguards & Staging Rollout

### `TASK-SR-00` — Staging Verification & Pre-Migration Backup [STAGING VERIFIED]
- **Status:** **STAGING VERIFIED** (See [staging_run_report.md](file:///d:/bestow/p-industry/docs/special-receipt/staging_run_report.md))
  - Applied migration script [staging_migration.sql](file:///d:/bestow/p-industry/docs/special-receipt/staging_migration.sql) to dedicated staging project `azzonbwaevtywisxlxej`.
  - All 33 automated tests in [staging_sql_tests.sql](file:///d:/bestow/p-industry/docs/special-receipt/staging_sql_tests.sql) executed and **PASSED (100%)**.
  - Production backup remains prerequisite immediately prior to future production apply.
- **Dependencies:** None
- **Acceptance Criteria:**
  - Zero syntax errors on PostgreSQL 17 (Verified).
  - All 33 staging tests pass cleanly (Verified).
- **Risk Level:** Low (staging verified; production untouched).

---

## Phase 1: Database Schema & Migrations

### `TASK-SR-01` [REQUIRES USER APPROVAL] — Create Database Migration for Special Receipt System
- **Description:** Create migration file `supabase/migrations/20261021_01_special_receipt_system.sql` containing:
  - `app_users.can_use_special_receipt` (`boolean NOT NULL DEFAULT false`).
  - `invoices.printed_as` (`text NOT NULL DEFAULT 'regular' CHECK (printed_as IN ('regular', 'special'))`).
  - `invoices.original_invoice_id` (`uuid` NULL, plain UUID without FK, used to link special returns to the original special invoice).
  - `invoice_items.original_invoice_item_id` (`uuid` NULL, plain UUID without FK, used to link special return line items to original sales lines).
  - `special_receipt_templates` table (`id`, `tenant_id` unique FK to `tenants(id) ON DELETE CASCADE`, `paper_size`, `template_json`, `updated_by`).
  - `special_receipt_brands` table (`tenant_id` FK to `tenants(id) ON DELETE CASCADE`, `brand_id` FK to `brands(id) ON DELETE CASCADE`, PK `(tenant_id, brand_id)`).
  - `special_print_log` table:
    - `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`.
    - `invoice_id UUID` (plain UUID, **NO** FK constraint, **NO** `ON DELETE SET NULL`).
    - `invoice_no TEXT NOT NULL` (denormalized copy).
    - `printed_by TEXT NOT NULL` (cashier name copy).
    - `user_id UUID` (plain UUID, **NO** FK constraint, **NO** `ON DELETE SET NULL`).
    - `event_type TEXT NOT NULL DEFAULT 'sale' CHECK (event_type IN ('sale', 'reprint', 'return'))`.
    - `master_total NUMERIC NOT NULL DEFAULT 0` (server-side sum of catalog `items.retail_price * qty`).
    - `printed_total NUMERIC NOT NULL DEFAULT 0` (server-side sum of `pre-discount unit_price * qty` shown on receipt).
    - `charged_total NUMERIC NOT NULL DEFAULT 0` (server-side actual billed money after line discounts).
    - `receipt_snapshot JSONB NOT NULL`.
    - `template_snapshot JSONB NOT NULL`.
    - `original_invoice_id UUID` (plain UUID, links return logs to original sale).
  - Partial unique index: `CREATE UNIQUE INDEX idx_special_print_log_sale ON public.special_print_log(invoice_id) WHERE event_type = 'sale';`
  - Immutability row trigger `trg_immutable_special_print_log`:
    - Checks `IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;` to permit cascade deletion when parent tenant is deleted (preserving developer panel tenant cleanup). Direct `DELETE` or `UPDATE` (depth = 1) raises exception.
  - Immutability statement trigger `trg_immutable_special_print_log_truncate`: blocks any `TRUNCATE` statement.
  - Privilege revocations:
    - `REVOKE ALL ON public.special_receipt_templates, public.special_receipt_brands, public.special_print_log FROM anon, authenticated;`
    - `REVOKE UPDATE, DELETE, TRUNCATE ON public.special_print_log FROM service_role;`
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`
- **Dependencies:** `TASK-SR-00`
- **Acceptance Criteria:**
  - SQL syntax valid for PostgreSQL 17 (Supabase live DB engine).
  - Deleting a tenant cascades cleanly without trigger exception; direct update/delete on `special_print_log` is rejected.
- **Risk Level:** Medium (DDL changes on core tables `app_users`, `invoices`, and `invoice_items`).

### `TASK-SR-01b` [SEPARATE APPROVAL REQUIRED] — Proposal: Explicit Multi-Branch Tenant Hierarchy
- **Description:** Propose migration adding an explicit foreign key column to `public.tenants` (e.g. `company_group_id UUID` or `owner_user_id UUID REFERENCES public.app_users(id)`) to replace the `owner_name` / `email` text heuristic currently used by CEO views.
- **Status:** PROPOSED — Will NOT be included in initial Special Receipt migration until explicitly authorized (Deferred per Decision 6).

---

## Phase 2: Atomic Transaction RPCs & Backend APIs

### `TASK-SR-02` [REQUIRES USER APPROVAL] — Deploy Atomic RPCs `create_special_invoice_atomic` & `log_special_reprint_atomic`
- **Description:** Implement PostgreSQL RPCs in `supabase/migrations/20261021_01_special_receipt_system.sql`:
  1. `create_special_invoice_atomic`:
     - **Advisory Lock & Idempotency (A10):** Takes session advisory lock `pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || v_invoice_no))`. If already saved by this user, returns existing response shape idempotently; handles `unique_violation` gracefully.
     - **Permission Check:** Verifies caller in `app_users`: `id = p_user_id`, `is_active = true`, `can_use_special_receipt = true`, `role = 'staff'`, `tenant_id = v_tenant_id`.
     - **Shift Validation (R1g):** Validates `p_invoice_data->>'shift_id'` exists, belongs to tenant, and has `status = 'open'`.
     - **Decision 1 Token Pass-Through:** Passes `p_tokens` through to `create_invoice_atomic`. Token business logic operates identically for special and regular sales.
     - **Option A Content Rule & Line Validation:** Cashier can only apply line discounts. Pre-discount unit rates and quantities are locked. Validates `0 <= discount <= qty * unit_price`, `total_price` matches `qty * unit_price - discount` within 0.02.
     - **POS Invoice Storage Rule (Decision 1):**
       - `invoices.subtotal = sum(line totals after line discount) = charged_total - delivery_charge` (e.g., 3,400 for 2 x 2,000 with 300 discount).
       - `invoices.discount = 0` (strictly 0 for special sales; line discounts live exclusively in `invoice_items.discount`).
       - `invoices.net_total = charged_total` (3,400).
     - **Server-Derived Totals:**
       - `master_total = sum(qty * catalog items.retail_price)`.
       - `printed_total = sum(qty * pre-discount unit_price) + delivery_charge`.
       - `charged_total = sum(line totals) + delivery_charge`.
       - `total_variance = (charged_total - delivery_charge) - master_total` (R4).
     - **Payments Validation (A6):** Checks tender totals ≈ paid_amount, paid_amount + due_amount ≈ charged_total (both using `ABS(ROUND(...,2)) > 0.02` tolerance). Requires `client_id` if `due_amount > 0`.
     - **Catalog Lookup:** Authoritatively queries `retail_price` and `name` from `items WHERE id = v_item_id AND tenant_id = v_tenant_id`. Overrides forced to catalog name for `invoice_items`.
     - **Receipt Snapshot Hardening (R5b):** Explicit whitelist for per-item keys (`item_id`, `item_code`, `item_name`, `receipt_name`, `receipt_shade`, `receipt_pack_size`, `receipt_notes`, `qty`, `unit_price`, `pre_discount_rate`, `discount`, `total_price`, `catalog_name`, `list_price`, `charged_rate`, `line_discount`, `line_variance`). Raw `v_item` is NEVER merged. Top-level keys whitelisted (`header_note`, `footer_note`, `delivery_charge`, `items`, totals).
     - **Template Resolution (R5c):** Authoritatively loads template from `special_receipt_templates` for `tenant_id` on the server. If no template exists in DB, uses server constant `BLANK_SPECIAL_TEMPLATE_JSON` matching `src/types/receipt.ts`. Parameter `p_template_snap` removed from function signature.
     - **Atomic Persistence:** Executes `create_invoice_atomic`, updates `invoices.printed_as = 'special'`, inserts immutable `special_print_log` row (including `delivery_charge`).
  2. `log_special_reprint_atomic` (A4, D2, R5d):
     - **Ordering of Checks:** Verifies user, verifies branch match, and verifies `printed_as = 'special'` FIRST before checking status.
     - **Uniform Error (R5d):** If invoice not found or tenant mismatch, raises uniform exception: `'Invoice not found or access denied'`.
     - **A4 Cancellation Check:** Rejects reprint if `invoices.status = 'cancelled'`. (If partially/fully returned, reprint is permitted and logged).
     - **D2 Permission Check:** Verifies caller is **staff with fresh `can_use_special_receipt` in that branch**. CEO and Developer roles are strictly rejected.
     - Inserts immutable reprint row (`event_type = 'reprint'`).
  3. Execution hardening:
     - `REVOKE EXECUTE ON FUNCTION public.create_special_invoice_atomic FROM PUBLIC, anon, authenticated;`
     - `GRANT EXECUTE ON FUNCTION public.create_special_invoice_atomic TO service_role;`
     - `REVOKE EXECUTE ON FUNCTION public.log_special_reprint_atomic FROM PUBLIC, anon, authenticated;`
     - `GRANT EXECUTE ON FUNCTION public.log_special_reprint_atomic TO service_role;`
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`
- **Dependencies:** `TASK-SR-01`
- **Acceptance Criteria:**
  - 100% transactional atomicity between invoice save and audit log write.
  - Zero execution privileges for anon or authenticated roles.
  - Tokens processed in DB without error; reprint on cancelled invoice rejected.
- **Risk Level:** High (Core financial & inventory transaction).

### `TASK-SR-02b` [REQUIRES USER APPROVAL] — Deploy Live DB Patch to `update_invoice_atomic` (D1)
- **Description:** Patch `update_invoice_atomic` to reject edits on special invoices:
  - Add check at the top after locking invoice:
    ```sql
    IF v_old_invoice.printed_as = 'special' THEN
      RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
    END IF;
    ```
  - Preserves exact live function definition verified via `pg_get_functiondef` in live database.
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`
- **Dependencies:** `TASK-SR-01`
- **Acceptance Criteria:**
  - Standard invoices edit normally. Special invoices reject edits with descriptive exception.
- **Risk Level:** High (Modifies core edit RPC).

### `TASK-SR-03` — Special Receipt Templates Backend API
- **Description:** Create route `/api/special-receipt-templates` supporting `GET` (fetch branch special template or fallback to blank), `POST` (save branch special template), and `DELETE` (reset to blank).
  - Handler queries `app_users.can_use_special_receipt` fresh from the database on **BOTH `GET` and `POST`** calls.
- **Files Touched:** `src/app/api/special-receipt-templates/route.ts`
- **Dependencies:** `TASK-SR-01`
- **Acceptance Criteria:**
  - Requires valid tenant session and fresh `can_use_special_receipt === true`.
  - Rejects revoked users immediately with `403 Forbidden`.
- **Risk Level:** Low.

### `TASK-SR-04` — Special Receipt Brands Backend API
- **Description:** Create route `/api/special-receipt-brands` supporting `GET` and `POST`.
  - Handler queries `app_users.can_use_special_receipt` fresh from the database on **BOTH `GET` and `POST`** calls.
- **Files Touched:** `src/app/api/special-receipt-brands/route.ts`
- **Dependencies:** `TASK-SR-01`
- **Acceptance Criteria:**
  - Scoped strictly to caller's `tenant_id`.
  - Rejects unauthorized users with `403 Forbidden`.
- **Risk Level:** Low.

### `TASK-SR-05` — Special Print Log Backend API (CEO Read-Only Query & Decision 6)
- **Description:** Create route `/api/special-print-log` supporting:
  - `GET`: CEO-only query for branch log records with date, status, and search filtering.
    - Strictly validates caller's database `role === 'ceo'`. Developer role is rejected (`403 Forbidden`).
    - Uses existing `requireTenantAuth` sister-branch resolution matching other CEO views.
    - Returns live `invoice_status` alongside each log record.
  - **POST / PUT / DELETE removed:** Any mutating HTTP method returns `405 Method Not Allowed`.
- **Files Touched:** `src/app/api/special-print-log/route.ts`
- **Dependencies:** `TASK-SR-01`, `TASK-SR-02`
- **Acceptance Criteria:**
  - CEO can query logs for their authorized branch.
  - Staff and Developer roles receive `403 Forbidden`.
- **Risk Level:** Medium.

### `TASK-SR-05b` — Special Receipt Snapshot & Reprint API (A4 & D2)
- **Description:** Create endpoints:
  - `GET /api/special-print-log/snapshot?invoice_id=...`: Returns `receipt_snapshot` and `template_snapshot` for a single invoice. Authorized for staff with fresh branch permission or CEO of that branch.
  - `POST /api/special-print-log/reprint`: Calls `log_special_reprint_atomic`. Authorized strictly for staff with fresh `can_use_special_receipt` in that branch. CEO and Developer are rejected (`403 Forbidden`). Rejects cancelled invoices.
- **Files Touched:**
  - `src/app/api/special-print-log/snapshot/route.ts`
  - `src/app/api/special-print-log/reprint/route.ts`
- **Dependencies:** `TASK-SR-02`
- **Acceptance Criteria:**
  - Permits reprint snapshot retrieval only for authorized staff.
  - Rejects reprint if invoice is cancelled.
  - Rejects CEO reprint requests with `403 Forbidden`.
- **Risk Level:** Low.

### `TASK-SR-05c` — Dedicated Special Invoice Checkout API (A5 Parity Suite)
- **Description:** Create route `/api/invoices/special` handling special checkouts with complete validation parity to `/api/invoices`:
  - `requireTenantAuth` branch verification.
  - Staff role verification (`role === 'staff'`). CEO and Developer rejected with 403.
  - Fresh DB query verifying `is_active === true` and `can_use_special_receipt === true`.
  - Session-derived `created_by` and `printed_by`.
  - Active shift lookup (rejects sale if no open shift).
  - VAL-03 price & margin bounds check.
  - Registered client requirement and credit limit verification when `due_amount > 0`.
  - Rate limiting matching `/api/invoices`.
  - Calls `create_special_invoice_atomic`.
- **Files Touched:** `src/app/api/invoices/special/route.ts`
- **Dependencies:** `TASK-SR-02`
- **Acceptance Criteria:**
  - All parity validations enforce identical financial standards to regular checkout.
- **Risk Level:** Medium.

---

## Phase 3: Developer Panel (User Permission Toggle)

### `TASK-SR-06` — Update User Types & Session
- **Description:** Add `can_use_special_receipt?: boolean` to:
  - `UserItem` in `src/types/dev.ts`
  - `AppUser` in `src/types/index.ts`
  - `UserSession` in `src/lib/session.ts`
  - Login endpoint in `src/app/api/auth/login/route.ts`
- **Files Touched:**
  - `src/types/dev.ts`
  - `src/types/index.ts`
  - `src/lib/session.ts`
  - `src/app/api/auth/login/route.ts`
- **Dependencies:** `TASK-SR-01`
- **Acceptance Criteria:**
  - User objects carry `can_use_special_receipt`.
- **Risk Level:** Low.

### `TASK-SR-07` — Developer Panel User Modal Toggle
- **Description:** Add a toggle in `DevUserModal.tsx` for `can_use_special_receipt` when user role is `staff`. Update `DevUsersView.tsx` with special receipt status badge.
- **Files Touched:**
  - `src/components/dev-panel/DevUserModal.tsx`
  - `src/components/dev-panel/DevUsersView.tsx`
  - `src/app/api/users/route.ts`
- **Dependencies:** `TASK-SR-06`
- **Acceptance Criteria:**
  - Developer can toggle permission per POS user on and off.
  - Persists to `app_users.can_use_special_receipt`.
- **Risk Level:** Low.

---

## Phase 4: POS Special Receipt Designer & Global Token Print Suppression

### `TASK-SR-08` — Blank Template Constant, Specialized Normalizer
- **Description:** Define `BLANK_SPECIAL_TEMPLATE_JSON` in `src/types/receipt.ts` and `normalizeSpecialTemplate` in `src/utils/receiptRenderCore.ts`.
- **Files Touched:**
  - `src/types/receipt.ts`
  - `src/utils/receiptRenderCore.ts`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Zero store identity defaults (no logo, no shop name, no address, no phone, no powered-by, no token slip).
- **Risk Level:** Low.

### `TASK-SR-08d` — Global Token Print Suppression (Owner Decision 1)
- **Description:** Patch `src/utils/receiptRenderCore.ts` and `receiptAdapters.ts` to suppress token claim slip and token note text across **ALL receipt types** (regular, special, reprint):
  - Disable `tokenClaimSlipSection` output entirely (returns empty string).
  - Disable `tokenNoteHtml` output (returns empty string).
  - **Business logic remains untouched:** Token balances, transactions, and redemptions in DB operate identically. Walk-in customers generate codes in DB without paper output.
- **Files Touched:**
  - `src/utils/receiptRenderCore.ts`
  - `src/utils/receiptAdapters.ts`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Zero token claim text or token notes on any printed receipt (regular or special).
  - Regular token ledger logic continues to operate seamlessly.
- **Risk Level:** Low (Render-layer only).

### `TASK-SR-09` — POS Special Receipt Designer Component
- **Description:** Build `src/components/SpecialReceiptSettings.tsx` allowing POS user to customize the blank canvas special receipt with live thermal preview.
- **Files Touched:**
  - `src/components/SpecialReceiptSettings.tsx`
  - `src/app/[slug]/page.tsx`
- **Dependencies:** `TASK-SR-03`, `TASK-SR-08`
- **Acceptance Criteria:**
  - Visible only when `currentUser?.can_use_special_receipt === true`.
- **Risk Level:** Low.

### `TASK-SR-10` — Brand Selection Interface in Designer
- **Description:** Add "Brand Triggers" section to `SpecialReceiptSettings.tsx` where POS user checks/unchecks brands triggering the Special Print button pulse.
- **Files Touched:**
  - `src/components/SpecialReceiptSettings.tsx`
- **Dependencies:** `TASK-SR-04`, `TASK-SR-09`
- **Acceptance Criteria:**
  - Fetches branch brands from `/api/brands?tenant_id=...`.
  - Saves selections to `/api/special-receipt-brands`.
- **Risk Level:** Low.

---

## Phase 5: POS Invoice Screen, Option A Modal & Atomic Print Flow

### `TASK-SR-11` — Load Special Brands & Permission in `PosBilling`
- **Description:** In `PosBilling.tsx`, load the current branch's selected special brand IDs into a lookup `Set<string>`. Receive `canUseSpecialReceipt` prop from user state.
- **Files Touched:**
  - `src/components/PosBilling.tsx`
  - `src/app/[slug]/page.tsx`
- **Dependencies:** `TASK-SR-04`, `TASK-SR-06`
- **Risk Level:** Low.

### `TASK-SR-12` — Billing Summary "SPECIAL SAVE & PRINT" Button Placement & Visibility
- **Description:** Add the full-width "SPECIAL SAVE & PRINT" button directly ABOVE regular orange `SAVE & PRINT (F5)` in billing summary.
- **Files Touched:**
  - `src/components/PosBilling.tsx`
  - `src/app/globals.css`
- **Dependencies:** `TASK-SR-11`
- **Acceptance Criteria:**
  - Visible ONLY if `canUseSpecialReceipt === true`.
- **Risk Level:** Low.

### `TASK-SR-13` — Dynamic Blink / Pulse Animation on Brand Match
- **Description:** Implement `shouldBlinkSpecial` in `PosBilling.tsx`. Apply class `pos-btn-special-blink` when matching brand is in cart.
- **Files Touched:**
  - `src/components/PosBilling.tsx`
  - `src/app/globals.css`
- **Dependencies:** `TASK-SR-12`
- **Risk Level:** Low.

### `TASK-SR-14` — Keyboard Shortcut `F6` Registration (Decision 3)
- **Description:** Bind `F6` to trigger Special Save & Print action in `PosBilling.tsx`. F6 is strictly Save & Print (no save-without-print).
- **Files Touched:**
  - `src/components/PosBilling.tsx`
- **Dependencies:** `TASK-SR-12`
- **Risk Level:** Low.

### `TASK-SR-15` — Special Print Pre-Print Editor Modal (Option A Content Rule)
- **Description:** Build `SpecialPrintModal.tsx`:
  - **Invoice No Generation:** Generated **ONCE** when modal opens and reused across any retry attempts.
  - **Rates and Quantities STRICTLY LOCKED:** Unit rates and `Qty` are strictly disabled/read-only. Cashier CANNOT edit rates or the total.
  - **Line Discounts Only:** Cashier can apply line discounts only. Invoice-level discount is disallowed.
  - **POS Storage Rule Enforcement (Decision 1):** `invoices.subtotal` = sum of line totals after line discount (e.g. Rs. 3,400 for 2 x Rs. 2,000 with Rs. 300 discount), `invoices.discount = 0` (strictly 0 for special sales), `net_total = 3,400`. Line discounts live exclusively in `invoice_items.discount` and `invoice_items.total_price`.
  - **Receipt-Only Overrides (B6):** Line item descriptions (`receipt_name`) and shade notes (`receipt_shade`) are editable for print layout without altering database catalog names (`invoice_items.item_name`).
  - **Totals Bar:** Displays Master Catalog Total, Printed Total, Charged Total, and Variance.
  - **Zero Discount Disclosure on Paper:** Renderer hides discount lines and the word "Discount" completely. Paper displays pre-discount rates (2 x 2,000) and derived total (4,000). Payment breakdown lines hidden by default.
- **Files Touched:**
  - `src/components/SpecialPrintModal.tsx`
  - `src/components/PosBilling.tsx`
- **Dependencies:** `TASK-SR-12`, `TASK-SR-08`
- **Acceptance Criteria:**
  - Unit rates and quantities cannot be edited.
  - Zero discount text appears on printed paper.
- **Risk Level:** Medium.

### `TASK-SR-16` [REQUIRES USER APPROVAL] — Single-Transaction Execution Pipeline & Print (B7)
- **Description:** Implement execution sequence in `SpecialPrintModal.tsx`:
  1. Cashier clicks "Confirm & Print Special Receipt" (or presses F6).
  2. Disables submit button immediately (`submitting = true`).
  3. Invokes `/api/invoices/special` calling `create_special_invoice_atomic`.
  4. On 200 OK, receives the server-returned `snapshot` and `template` (B7), asserting POS rule values (`subtotal = 3400, discount = 0, net_total = 3400`).
  5. Renders print HTML using the server-returned `snapshot` and calls `printViaIframe(specialReceiptHtml)`.
  6. If transaction fails, aborts with alert; print dialog is NEVER called.
- **Files Touched:**
  - `src/components/SpecialPrintModal.tsx`
- **Dependencies:** `TASK-SR-05c`, `TASK-SR-15`
- **Acceptance Criteria:**
  - 100% transactional atomicity.
  - Print dialog only opens after DB commit and prints strictly from the server-returned snapshot.
- **Risk Level:** High.

---

## Phase 6: CEO Audit Log, Sales History Reprints & Leak Prevention

### `TASK-SR-17` — CEO Navigation Entry
- **Description:** Add `special-print-log` to `CEOSection` type, `NAV_ITEMS` in `ExecutiveSidebar.tsx`, and route in `CeoSuite.tsx`.
- **Files Touched:**
  - `src/components/ceo-panel/ExecutiveSidebar.tsx`
  - `src/components/ceo-panel/CeoSuite.tsx`
- **Dependencies:** None
- **Acceptance Criteria:**
  - Appears in CEO sidebar; accessible only to role `'ceo'`.
- **Risk Level:** Low.

### `TASK-SR-18` — CEO Special Print Log View Component (Decision 2 & 6)
- **Description:** Build `src/components/ceo-panel/SpecialPrintLogView.tsx` with date filter, search, cashier filter, and log table:
  - Branch Selector: Shows active branch logs using existing sister-branch mechanism.
  - Columns: Date/Time, Branch, Cashier, Invoice #, Invoice Status (`completed`, `cancelled`), Event Type (`Sale`, `Reprint`, `Return`), Master Total, Printed Total, Charged Total, Delivery Charge, Price Variance.
  - **Financial Sums Rule:** Total Master Value, Total Charged Value, Total Delivery Value, and Price Variance metric cards strictly exclude `event_type IN ('reprint', 'return')` rows.
  - **Price Variance Formula (R4):** `sum(charged_total - delivery_charge) - sum(master_total)`.
  - **Badges:** Prominently labels `reprint` rows with blue "REPRINT", `return` rows with orange "RETURN", and cancelled invoices with red "CANCELLED".
- **Files Touched:**
  - `src/components/ceo-panel/SpecialPrintLogView.tsx`
- **Dependencies:** `TASK-SR-05`, `TASK-SR-17`
- **Risk Level:** Low.

### `TASK-SR-19` — Click-to-Open Receipt Preview Modal
- **Description:** Build `SpecialReceiptLogDetailModal.tsx` displaying the exact printed receipt reconstructed from `log.receipt_snapshot` and `log.template_snapshot`, plus 3-way line comparison: Master Catalog Price, Printed Paper Rate, Actual Charged Rate, Line Variance. Read-only; no reprint button for CEO.
- **Files Touched:**
  - `src/components/ceo-panel/SpecialReceiptLogDetailModal.tsx`
  - `src/components/ceo-panel/SpecialPrintLogView.tsx`
- **Dependencies:** `TASK-SR-18`
- **Risk Level:** Low.

### `TASK-SR-20` — Sales History Special Reprint Engine (A4 & D2)
- **Description:** Update `SalesHistory.tsx` reprint logic:
  - When user clicks "Reprint" on an invoice:
    - If `inv.printed_as === 'special'`:
      - Block if `inv.status === 'cancelled'`.
      - Check if caller is **staff with fresh `can_use_special_receipt` in that branch**.
      - CEO and unauthorized staff have the button hidden or disabled.
      - Call `POST /api/special-print-log/reprint` to log reprint and fetch original snapshot.
      - Render HTML using special blank renderer and print via iframe.
- **Files Touched:**
  - `src/components/SalesHistory.tsx`
- **Dependencies:** `TASK-SR-05b`, `TASK-SR-08`
- **Acceptance Criteria:**
  - Special invoices reprint with zero store identity leaks.
  - Cancelled invoices cannot be reprinted.
  - CEO cannot reprint.
- **Risk Level:** Medium.

### `TASK-SR-21` — Neutral Document Title & Print Header/Footer Suppression
- **Description:** In `renderReceiptDocument` and iframe print wrapper:
  - Wrap styling with `@media print { @page { margin: 0 !important; size: auto; } body { margin: 0; padding: 3mm; } }`.
  - Set `<title>Receipt</title>` (ensures default PDF save name is `Receipt.pdf`).
  - Remove all URL-bearing or hyperlink elements.
- **Files Touched:**
  - `src/utils/receiptRenderCore.ts`
  - `src/utils/iframePrint.ts`
- **Dependencies:** `TASK-SR-08`
- **Acceptance Criteria:**
  - Zero URL text or shop slugs printed in margins on Chromium browsers.
- **Risk Level:** Low.

### `TASK-SR-22` — Invoice Edit Block (D1), Cancel & Accepted Return Risk
- **Description:** Update invoice modification routines:
  - **D1 Edit Block:**
    - `PATCH /api/invoices`: Rejects edit if `printed_as = 'special'` (`400 Bad Request`).
    - `SalesHistory.tsx`: Hide/disable "Edit / Add in POS" button when `selectedInvoice.printed_as === 'special'`.
  - `cancel_invoice_atomic`: Confirmed to produce no print; preserves `printed_as = 'special'`.
  - **Accepted Return Risk (Decision 4 / C2):** Normal POS return screen has no link to original invoice. The risk that a cashier returns a special-sale item through the normal return flow (refunding at catalog price) is accepted. Do NOT claim that POS blocks normal returns of special sales.
- **Files Touched:**
  - `src/app/api/invoices/route.ts`
  - `src/components/SalesHistory.tsx`
- **Dependencies:** `TASK-SR-08`
- **Acceptance Criteria:**
  - Special invoices cannot be edited by any role.
- **Risk Level:** Medium.

---

## Phase 7: Verification & Staging Gate

### `TASK-SR-23` — Comprehensive System Test Execution (Phases 0–6)
- **Description:** Execute all test scenarios defined in `test_plan.md` across POS, Developer Panel, Sales History, and CEO Suite on the staging project (`azzonbwaevtywisxlxej`).
- **Files Touched:** None (Testing only)
- **Dependencies:** All Phase 0–6 tasks
- **Acceptance Criteria:**
  - All test cases pass with zero regressions.
  - Token test cases (TC-SR-D4, TC-SR-D4b) pass explicitly.
  - Staging gate passed before deploying Phase 8.
- **Risk Level:** Low.

---

## Phase 8: Special Return Engine (Dedicated Flow & Option E Zero-Print)

> [!IMPORTANT]
> Phase 8 begins ONLY after `TASK-SR-23` staging acceptance is confirmed.

### `TASK-SR-24` [REQUIRES USER APPROVAL] — Deploy Special Return RPC `create_special_return_atomic`
- **Description:** Deploy `create_special_return_atomic` implementing Option (a) direct-insert strategy with all defect fixes:
  - Validates staff caller with fresh `can_use_special_receipt` in the invoice's branch.
  - **Shift Validation (R1g):** Accepts `p_shift_id uuid` from caller; validates shift exists, belongs to tenant, and is active/open.
  - **Advisory Lock:** Takes session advisory lock `pg_advisory_xact_lock(hashtext(v_user_rec.tenant_id::text || ':return:' || p_original_invoice_id::text))` to serialize concurrent returns.
  - **Original Invoice Guard (R1b):** Locks original invoice `FOR UPDATE`. Enforces `invoice_type = 'sales' AND printed_as = 'special'`. Rejects cancelled invoices.
  - **F9 Original Discount Guard:** Rejects return if `original_invoice.discount > 0` with exception requiring manual review. Original delivery charge is NOT refunded (`delivery_charge = 0`).
  - **In-Request Duplicate Guard (R1a):** Aggregates requested quantities per `original_item_id` to ensure total requested across duplicate lines does not exceed returnable quantity.
  - **Cents Rule across ALL Returns (R1f):** For each line, queries prior non-cancelled returns: if current return completes the line's remaining quantity, `refund = orig_total_price - already_refunded_for_line`, else `ROUND(qty * (orig_total_price / orig_qty), 2)`.
  - **Tender Validation & Server Khata Offset (R1c, Owner Decision):**
    - NO store credit / no client advance. Refunds are cash, card, or cash+card (`mixed`).
    - Credit-sale returns: Server computes `khata_offset = LEAST(return_net, original.due_amount - SUM(prior offsets), clients.current_balance)` floored at 0. Prior offsets dynamically derived as `SUM(net_total - paid_amount)` over prior non-cancelled returns.
    - Cashier refund (`cash_paid + card_paid`) must equal `return_net - khata_offset` (0.02 tolerance). Cashier only splits the remainder between cash and card.
    - Walk-in (`client_id IS NULL`): `khata_offset = 0`, cashier refunds full `return_net`.
    - Client balance is reduced by `khata_offset` only (`clients.current_balance = current_balance - khata_offset`). Balance never goes negative.
    - Return invoice header: `paid_amount = cash_paid + card_paid`, `net_total = return_net`, `due_amount = 0`.
    - `payment_type = 'mixed'` if cash > 0 and card > 0, else `'card'`, else `'cash'`.
  - **Lid-Open Policy & Zero Token Deduction (Owner Decision):** Buckets with opened lids are strictly rejected; accepted returns refund the full original unit charged price with zero token deduction.
  - **Option (a) Direct Insert:** Inserts `invoices` header and `invoice_items` directly with `original_invoice_item_id` pointing to original line PK.
  - **Stock Replenishment (R1e):** Locks `items` row `FOR UPDATE`, scopes by `AND tenant_id = v_user_rec.tenant_id`, and validates `item_id IS NOT NULL`.
  - **Audit Logging (R1d):** Inserts exact row into `public.audit_logs` matching live columns: `tenant_id, user_name, action, action_type, entity_type, entity_id, details`.
  - **Special Print Log:** Inserts audit row with `event_type = 'return'`, `original_invoice_id`, and `delivery_charge = 0`.
  - **p_tokens Removed (R1i):** Parameter removed entirely from function signature.
  - **Option E Paperless Completion:** Returns `print_receipt: false`. Zero paper receipt printed.
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`
- **Dependencies:** `TASK-SR-23` (staging gate)
- **Risk Level:** High.

### `TASK-SR-25` — Special Return Backend API
- **Description:** Deploy `/api/invoices/special-return` route (staff only, fresh `can_use_special_receipt` check, validates tender amounts, looks up active shift and passes `p_shift_id`, `p_cash_refunded`, `p_card_refunded` to RPC). Returns `{ success, return_invoice_id, return_invoice_no, refund_total, khata_offset, cashier_refund, print_receipt: false }`.
- **Files Touched:** `src/app/api/invoices/special-return/route.ts`
- **Dependencies:** `TASK-SR-24`
- **Risk Level:** Medium.

### `TASK-SR-26` — Special Return UI in Sales History
- **Description:** Add "Special Return" action in Sales History for special invoices:
  - Visible only to staff with fresh `can_use_special_receipt` in that branch. Hidden for cancelled invoices.
  - Opens modal displaying original lines: sold qty, already returned, returnable qty.
  - Cashier enters return quantity only. Unit rate is locked.
  - Tender picker: cash, card, or cash+card (`mixed`). Displays server-computed khata offset reducing customer debt on credit sales, and prompts cashier to disburse the remaining payout via cash/card.
  - Completes with toast confirmation and drawer update. **NO print dialog is opened (Option E)**.
- **Files Touched:** `src/components/SalesHistory.tsx`
- **Dependencies:** `TASK-SR-25`
- **Risk Level:** Medium.

### `TASK-SR-27` — CEO Log View: Return Rows & Badges
- **Description:** Update CEO Special Print Log View to display `event_type = 'return'` rows with an orange "RETURN" badge, original invoice reference, and exclude return rows from total sales revenue cards.
- **Files Touched:** `src/components/ceo-panel/SpecialPrintLogView.tsx`
- **Dependencies:** `TASK-SR-26`
- **Risk Level:** Low.

### `TASK-SR-28` — Phase 8 Staging Acceptance & Final Production Deploy
- **Description:** Run full Phase 8 return test cases on staging. Confirm all return scenarios pass cleanly before final production sign-off.
- **Dependencies:** `TASK-SR-24` through `TASK-SR-27`
- **Risk Level:** Low.

---

## Architectural & Review Fix Tasks (R1–R7)

### `TASK-FIX-01` [REQUIRES USER APPROVAL] — Variance Formula & Delivery Column (R4)
- **Description:**
  - Add `delivery_charge NUMERIC NOT NULL DEFAULT 0` column to `special_print_log`.
  - Fix variance formula in `create_special_invoice_atomic`: `'total_variance', ((v_charged_total - v_delivery_calc) - v_master_total)`.
  - Update CEO log view formula to `sum(charged_total - delivery_charge) - sum(master_total)`.
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`, `src/components/ceo-panel/SpecialPrintLogView.tsx`
- **Risk Level:** Low.

### `TASK-FIX-02` [REQUIRES USER APPROVAL] — Block Cancellation of Special Return Invoices at API Layer in BOTH Routes (R2, D5)
- **Description:**
  - In `src/app/api/invoices/route.ts`:
    - In `PATCH /api/invoices` (lines 371–385: `status === 'cancelled' || body.action === 'cancel'`), reject if `invoice.invoice_type === 'return' AND invoice.printed_as === 'special'` with `400 Bad Request`.
    - In `DELETE /api/invoices` (lines 535–546), reject if `invoice.invoice_type === 'return' AND invoice.printed_as === 'special'` with `400 Bad Request`.
  - Hide/disable Cancel button in Sales History UI for special return invoices.
  - Document residual risk that `cancel_invoice_atomic` is `SECURITY DEFINER` and could be called directly via PostgREST RPC if exposed.
- **Files Touched:** `src/app/api/invoices/route.ts`, `src/components/SalesHistory.tsx`
- **Risk Level:** Medium.

### `TASK-FIX-03` [OUT OF SCOPE] — Document Live `create_invoice_atomic` Card Refund Double-Debit Bug
- **Description:** Live `create_invoice_atomic` lines 622–632 computes `v_cash_refunded := 0` when `payment_type = 'card'`, causing `v_store_credit := v_net_total` to debit client balance on card returns. Recorded as out-of-scope; special returns bypass this via Option (a) direct insert.
- **Status:** OUT OF SCOPE — Requires separate owner sign-off.

### `TASK-FIX-04` [OPTIONAL FUTURE] — Server-Side Token Deduction on Special Returns (F3 / Open Question 5)
- **Description:** Add `token_returned_with_bucket: boolean` per line in special return. Authoritatively query `series_token_configs` on server and deduct `token_value` from refund price.
- **Status:** OPTIONAL FUTURE — Owner decision established that buckets with opened lids are strictly rejected and not accepted for return; accepted returns refund the full original unit charged price with zero token deduction. Retained as optional future documentation.

### `TASK-FIX-05` [REQUIRES USER APPROVAL] — Remove `p_template_snap` from `create_special_invoice_atomic` (R5c)
- **Description:** Remove `p_template_snap` parameter from `create_special_invoice_atomic`. Authoritatively load template from DB or use `BLANK_SPECIAL_TEMPLATE_JSON`.
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`, `src/app/api/invoices/special/route.ts`
- **Risk Level:** Medium.

### `TASK-FIX-06` [REQUIRES USER APPROVAL] — Whitelist Receipt Snapshot Keys in `create_special_invoice_atomic` (R5b)
- **Description:** Enforce strict key whitelist in `v_enriched_items` (do NOT merge raw `v_item`) and top-level snapshot fields to prevent JSON payload injection.
- **Files Touched:** `supabase/migrations/20261021_01_special_receipt_system.sql`
- **Risk Level:** Low.
