# PyntFlow — Supplier Token Payment Defects: Implementation Plan & Task Register

**Document Path:** `docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md`  
**Related Forensic Report:** (Session artifact: `supplier_token_payment_forensic_report.md`)  
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)  
**Baseline Commit:** `bdfea3576de0d3f9a1c1e49d9ec359ceece8003f`  
**Target Supabase Production Project:** `ignspvajzblmsbertmmv` (PostgreSQL 17.6)  
**Status:** `REVISION 12A — STATUS UPDATE — STATIC VERIFICATION COMPLETE — RUNTIME EXECUTION NOT AUTHORIZED`  
**Date:** October 13, 2026  
**Last Updated:** October 13, 2026 (Rev 12A Status Update)

---

## ⛔ IMPLEMENTATION STRICTLY NOT AUTHORIZED

**THIS IS A PLANNING, ARCHITECTURAL SPECIFICATION, AND TASK REGISTER UPDATE ONLY.**  
No implementation is authorized. No database migrations, DDL, DML, application code changes, configuration alterations, staging project creation, or test accounting records may be applied until all required authorization gates (Gate B and independent Gate C approvals) are formally opened and required staging infrastructure is provisioned.

**PLANNING NOTICE:** This document was finalized as **Revision 12 — FINAL**. Revision 12A is a **status update only** — it reconciles task statuses, records verified findings (Q-FIN-01 resolution, SQL static verification results, committed artifact locations), and documents staging readiness without altering the architectural specification, scope, or authorization boundaries established in Rev 12.

---

## 1. Explicit Business Decisions Recorded

### 1.1 Decision Q1 — Partial-Batch Token Selection
- **Status:** **APPROVED BUSINESS REQUIREMENT — PARTIAL-BATCH SELECTION**
- **Decision Record:** The cashier must be able to select a specific quantity from each eligible supplier token batch when applying token value to a supplier payment voucher. The previous checkbox-only, full-batch design is permanently retired as a target architecture.
- **Mandatory Domain Rules:**
  1. The cashier can select an eligible token batch and specify how many units from that batch to apply (`requested_quantity`).
  2. **Strict Integer & Range Policy:** Quantity must be an integer with value $1 \le \text{quantity} \le 2,147,483,647$. The API route rejects fractional numbers, non-numbers, negative numbers, and non-integer inputs (`typeof qty === 'number' && Number.isInteger(qty) && qty > 0 && qty <= 2147483647`). The database independently enforces JSON number type (`jsonb_typeof(elem->'quantity') = 'number'`), whole integer validation (`quantity::numeric = floor(quantity::numeric)`), positive range (`quantity > 0`), 32-bit limits, and stock availability.
  3. The requested quantity must not exceed the batch's current eligible `remaining_quantity` (`requested_quantity <= remaining_quantity`).
  4. The monetary contribution of each selected batch is:
     $$\text{contribution} = \text{token\_value} \times \text{requested\_quantity}$$
  5. The UI payment preview, submitted API request, authoritative server-side calculation, resulting voucher amount, supplier balance adjustment, and audit log entries must agree on the identical settlement total.
  6. **Final Lifecycle Model (Uniform Consumption Slice Architecture):**
     - To ensure absolute audit traceability and eliminate reporting discrepancies between partial and full consumption, **every token allocation applied to a voucher creates an explicit child consumption slice** in `token_transactions`:
       $$\text{child.quantity} = \text{requested\_quantity}, \quad \text{child.remaining\_quantity} = 0, \quad \text{child.total\_amount} = \text{requested\_quantity} \times \text{token\_value}$$
       with `child.usage_status = 'used'`, `child.used_against_voucher_id = voucher_id`, `child.parent_transaction_id = parent.id`, and explicit `child.shift_id = NULL` (nullable schema column `shift_id UUID REFERENCES shifts(id)`).
     - The parent batch's available balance is decremented:
       $$\text{parent.remaining\_quantity} = \text{parent.remaining\_quantity} - \text{requested\_quantity}$$
       $$\text{parent.total\_amount} = \text{parent.remaining\_quantity} \times \text{parent.token\_value}$$
     - When a parent batch is completely exhausted ($\text{parent.remaining\_quantity} = 0$), its status transitions to `usage_status = 'used'`, but its `used_against_voucher_id` remains `NULL`. The individual consumption events remain linked exclusively to their respective child slice rows.
  7. A failed voucher transaction must leave all token quantities, supplier balances, vouchers, and audit records untouched via the atomic transaction boundary.
  8. Concurrent requests from multiple terminals must not consume more units than are available; deterministic row-level locks (`FOR UPDATE`) are mandatory.
  9. The server RPC must derive the actual eligible quantity from locked database rows, validate the requested quantity against the locked rows, and reject stale, depleted, cross-tenant, invalid, or already-linked tokens.
  10. The system must **never** trust client-submitted monetary totals or frontend preview calculations as the authoritative settlement amount.

### 1.2 Decision Q2 — Accounting Treatment of `total_amount` (Model 1 Approved)
- **Status:** **APPROVED BUSINESS DECISION — MODEL 1 (DYNAMIC RESIDUAL BOOK VALUE)**
- **Decision Record:** The business owner has formally selected **Model 1 (Dynamic Residual Book Value)** for token stockpile accounting:
  $$\text{total\_amount} = \text{remaining\_quantity} \times \text{token\_value}$$
- **Scope, Reporting & Reconciliation Rules:**
  1. **Active Stockpile Scope (Parent Batches):**
     - For available parent batches, `total_amount` reflects current remaining book value:
       $$\text{parent.total\_amount} = \text{parent.remaining\_quantity} \times \text{parent.token\_value}$$
     - Upon consumption, parent `remaining_quantity` decreases by `requested_quantity`, and parent `total_amount` decreases proportionally.
  2. **Consumed Slice Scope (Child Rows):**
     - Consumed child rows record the historical monetary value of the consumed units:
       $$\text{child.total\_amount} = \text{child.quantity} \times \text{parent.token\_value}$$
       with `child.remaining_quantity = 0`, `child.usage_status = 'used'`, and `child.used_against_voucher_id = voucher_id`.
  3. **Full Depletion of Parent Batch:**
     - When all remaining units of a parent batch are consumed ($\text{remaining\_quantity} = 0$), its remaining book value is zeroed:
       $$\text{parent.remaining\_quantity} = 0, \quad \text{parent.total\_amount} = 0, \quad \text{parent.usage\_status} = \text{'used'}$$
  4. **Reporting Isolation & Reconciliation Rules:**
     - **Inviolable Reporting Query Constraint:** To prevent double-counting child row values, **all safe inventory and stockpile valuation queries must explicitly filter `WHERE usage_status = 'available'` (and/or `WHERE remaining_quantity > 0`)**.
     - Total active safe stockpile value is strictly:
       $$\text{Total Safe Stock Value} = \sum_{\text{usage\_status} = \text{'available'}} \text{total\_amount} \equiv \sum_{\text{usage\_status} = \text{'available'}} (\text{remaining\_quantity} \times \text{token\_value})$$
  5. **Alignment with `settle_tokens_atomic`:**
     - `settle_tokens_atomic` already decrements `total_amount` on partial surrender; the planned alignment will also zero `total_amount` on full surrender.
  6. **Inviolable Invariant:**
     - Regardless of stored `total_amount`, **the settlement RPC never reads `total_amount` for valuation**; valuation strictly evaluates $\text{requested\_quantity} \times \text{token\_value}$.

### 1.3 Audit Status of Original Batch Creation History
- **Claim Scrutiny:** Prior discussions posited that original batch creation values are "immutably preserved" in the base table `token_transactions.quantity` column.
- **Evidence Verification:** `[LIVE-DB-VERIFIED]`
  1. Inspection of `information_schema.triggers` confirmed that **zero database triggers exist on `token_transactions`**.
  2. Inspection of `pg_constraint` confirmed that no check constraint or rule prevents an `UPDATE` mutation on `quantity`.
  3. No append-only historical shadow table or cryptographic ledger exists for `token_transactions`.
- **Classification:** **`[NOT-VERIFIED — APPLICATION CONVENTION ONLY]`**.
  - Immutability of original batch sizes is an application-level convention only, not a database-enforced guarantee.
  - Any authorized database role or errant query can mutate `quantity` without schema error.
  - Therefore, claiming that original batch creation history is immutably preserved in the base table remains **strictly unverified** unless an existing, immutable audit log record (e.g. in `audit_logs`) or tamper-proof event stream is evidenced.

### 1.4 Decision Q-SMOKE — Post-Deployment Verification Environment
- **Status:** **APPROVED BUSINESS REQUIREMENT — DEDICATED STAGING SUPABASE PROJECT**
- **Decision Record:** End-to-end supplier token payment verification tests must run against a dedicated staging Supabase project, never against the production project (`ignspvajzblmsbertmmv`).
- **Environmental Status & Readiness:**
  - `[LIVE-DB-VERIFIED]` Discovery inspection of available Supabase projects via management API returned 3 projects:
    1. `bvykqfccfndttejulaen` (`ali-touheed123's Project`, region `ap-south-1`, status: `INACTIVE`).
    2. `kadkryylyzfwtxknvcic` (`Tawakkal Paint House`, region `ap-northeast-1`, status: `ACTIVE_HEALTHY`).
    3. `ignspvajzblmsbertmmv` (`p-industry`, region `ap-south-1`, status: `ACTIVE_HEALTHY` — Production).
  - **Readiness Conclusion:** A dedicated, active staging project for `p-industry` is **NOT YET PROVISIONED OR CONFIGURED**.
  - **Operational Constraint:** End-to-end verification under Task T11 is marked **BLOCKED ON STAGING INFRASTRUCTURE PROVISIONING**.
  - **Prohibition:** No staging project creation, credential provisioning, or configuration modification is permitted in this task.
  - **Production Guard:** Zero test vouchers, token transactions, suppliers, or test records may be created in production. Production verification is strictly limited to read-only structural checks (`pg_get_functiondef`, grant queries, and non-mutating schema checks).

### 1.5 Status of Secondary Inquiries (Q3)
- **Q3 (Historical Purchase Discrepancy Reconciliation):** `[LIVE-DB-VERIFIED]` Read-only audit confirmed that within the 5 existing purchase records in `ignspvajzblmsbertmmv`, exactly 0 applied tokens. Therefore, historical purchase discrepancy reconciliation is resolved with zero affected records in the current database state.

---

## 2. Evidentiary Taxonomy & Verified Baseline

### 2.1 Evidentiary Taxonomy
- `[LIVE-DB-VERIFIED]`: Directly queried and confirmed on live Supabase production project `ignspvajzblmsbertmmv`.
- `[SRC-VERIFIED]`: Confirmed by direct inspection of repository source files.
- `[GIT-VERIFIED]`: Confirmed via Git tree analysis, commit logs, or diffs against baseline `c56a31c`.
- `[TEST-VERIFIED]`: Confirmed via local static verification or test runner execution.
- `[REPORTED-FORENSIC]`: Derived from prior forensic investigation sessions; verified consistent with code.
- `[ASSUMED]`: Logical architectural inference; requires validation prior to deployment.
- `[NOT-VERIFIED]`: Explicitly unverified pending environmental access or authorization.

### 2.2 Baseline Verification
- **Git Status:** `[GIT-VERIFIED]`
  - Original Baseline Commit: `bdfea3576de0d3f9a1c1e49d9ec359ceece8003f`
  - Current HEAD (Rev 12A): `fe31b18` ("supplier token payment fixes") — contains committed migration files (`_03`, `_04`), rollback files, implementation plan, and verification report.
  - Working Tree (Rev 12A): Only `docs/audits/SUPPLIER_TOKEN_PAYMENT_SQL_VERIFICATION_REPORT.md` is modified (uncommitted documentation updates). All migration and rollback SQL files are clean relative to HEAD.
- **TypeScript Static Verification:** `[TEST-VERIFIED]`
  - Command: `npx tsc --noEmit`
  - Result: Exit code `0` (clean compile, zero errors).
- **Live Database Routines, Constraints & Schema:** `[LIVE-DB-VERIFIED]`
  - `token_transactions`: Column `used_date` confirmed **ABSENT**.
  - Verified Constraints (`pg_constraint` on `token_transactions`):
    * `token_transactions_parent_transaction_id_fkey`: `FOREIGN KEY (parent_transaction_id) REFERENCES token_transactions(id) ON DELETE SET NULL`
    * `token_transactions_quantity_check`: `CHECK ((quantity > 0))`
    * `token_transactions_remaining_quantity_check`: `CHECK ((remaining_quantity >= 0))`
    * `token_transactions_token_value_check`: `CHECK ((token_value >= (0)::numeric))` (Notice: schema permits `token_value >= 0` for non-payment records, but voucher settlement domain rule strictly requires `token_value > 0` as zero-value tokens cannot discharge debt)
    * `token_transactions_total_amount_check`: `CHECK ((total_amount >= (0)::numeric))`
    * `token_transactions_type_check`: `CHECK ((type = ANY (ARRAY['issued'::text, 'shop_retained'::text, 'redeemed'::text, 'opening_stock'::text, 'settle_vendor'::text, 'write_off'::text, 'used_purchase'::text, 'reversal'::text])))`
    * `token_transactions_usage_status_check`: `CHECK ((usage_status = ANY (ARRAY['available'::text, 'settled'::text, 'used'::text, 'written_off'::text, 'reversed'::text, 'n_a'::text])))`
    * `token_transactions_used_against_voucher_id_fkey`: `FOREIGN KEY (used_against_voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL`
  - Nullability Constraints (`information_schema.columns`):
    * `quantity`: `NOT NULL DEFAULT 1`
    * `remaining_quantity`: `NOT NULL DEFAULT 0` (Verified NOT NULL — cannot be NULL in DB)
    * `token_value`: `NOT NULL DEFAULT 0`
    * `total_amount`: `NOT NULL DEFAULT 0`
    * `brand_name`, `series_name`, `unit_name`, `type`, `tenant_id`, `usage_status`: `NOT NULL` (all 10 NOT NULL columns verified)
    * `shift_id`: `NULLABLE` (ForeignKey to `shifts(id) ON DELETE SET NULL`)
  - Triggers: `information_schema.triggers` confirmed **0 triggers on `token_transactions`**.
  - Live Function Definitions:
    * `create_voucher_atomic`: Defective line `used_date = NOW()` and quantity-ignoring accumulator confirmed live.
    * `create_purchase_atomic`: Quantity-ignoring accumulator confirmed live.
    * `settle_tokens_atomic`: Parent-child splitting using `parent_transaction_id` confirmed live.
  - Execution Grants: Confirmed restricted to `postgres` and `service_role`. `PUBLIC`, `anon`, and `authenticated` execute grants are revoked.

---

## 3. Confirmed Defect Register

### BUG-VA-01 — Critical: Nonexistent `used_date` Column in `create_voucher_atomic`
- **Severity:** P0 Critical (Hard crash on all token-assisted voucher payments).
- **Classification:** `[LIVE-DB-VERIFIED]` + `[SRC-VERIFIED]`
- **Location:** [`supabase/migrations/20261005_04_create_voucher_atomic.sql#L129`](file:///d:/bestow/p-industry/supabase/migrations/20261005_04_create_voucher_atomic.sql#L129) and live `pg_proc` definition.
- **Description:** Attempting to update non-existent column `used_date = NOW()` causes PostgreSQL error `42703 (undefined_column)` and immediate rollback of the entire transaction.

### BUG-VA-02 — High: Token Valuation Ignores Eligible Batch Quantity in `create_voucher_atomic`
- **Severity:** P0 High (Financial calculation error; understatement of supplier payment).
- **Classification:** `[LIVE-DB-VERIFIED]` + `[SRC-VERIFIED]`
- **Location:** [`supabase/migrations/20261005_04_create_voucher_atomic.sql#L82–L93`](file:///d:/bestow/p-industry/supabase/migrations/20261005_04_create_voucher_atomic.sql#L82-L93) and live `pg_proc` definition.
- **Description:** Accumulator sums `COALESCE(v_token.token_value, 0)` without multiplying by quantity, settling multi-token batches for a single unit's face value.

### BUG-VA-03 — High: `remaining_quantity` Not Decremented on Token Consumption
- **Severity:** P1 High (Data integrity anomaly).
- **Classification:** `[LIVE-DB-VERIFIED]` + `[SRC-VERIFIED]`
- **Description:** Previous Step 6 update set `usage_status = 'used'` but left `remaining_quantity` unchanged, creating reporting inconsistencies.

### BUG-FL-01 — High: Frontend Modal Preview Computes Unit Value Instead of Batch Value
- **Severity:** P0 High (Incorrect preview before submission).
- **Classification:** `[SRC-VERIFIED]`
- **Location:** [`src/components/FinancialLedgers.tsx#L269–L274`](file:///d:/bestow/p-industry/src/components/FinancialLedgers.tsx#L269-L274)
- **Description:** Accumulator sums `Number(t.token_value)` without multiplying by quantity, understating preview total.

### BUG-FL-02 — Medium: Per-Row Token Display Shows Unit Value Without Quantity Breakdown
- **Severity:** P2 Medium (UI ambiguity; no quantity input).
- **Classification:** `[SRC-VERIFIED]`
- **Location:** [`src/components/FinancialLedgers.tsx#L1350`](file:///d:/bestow/p-industry/src/components/FinancialLedgers.tsx#L1350)
- **Description:** Table row displays unit face value without quantity selector or breakdown, and allows selection of depleted rows.

### BUG-PA-01 — Medium: `create_purchase_atomic` Token Valuation Ignores Quantity
- **Severity:** P1 Medium (Monetary understatement in purchase invoice `tokens_applied_amount`).
- **Classification:** `[LIVE-DB-VERIFIED]`
- **Location:** `create_purchase_atomic` Step 2 live definition.
- **Description:** Accumulator sums `token_value` without multiplying by quantity for tokens applied to purchase invoices.

---

## 4. Architectural Design & Resolution of Technical Issues

### 4.1 Resolution of Full-Consumption History & Lifecycle Consistency
**Analysis of Defect in Previous Revisions:**  
In previous revisions, partial consumption created a child row, whereas consuming the final remaining units of a batch updated the parent row directly without creating a child row. This created severe reporting and relational defects:
1. **Double-Counting on Multi-Voucher Batches:** If a batch of 14 units had 5 units consumed on Voucher A (producing Child 1 with `qty=5`) and the remaining 9 units consumed on Voucher B (marking Parent with `qty=14` and `used_against_voucher_id = Voucher B`), querying `SUM(quantity) WHERE used_against_voucher_id IN (A, B)` yielded $14 + 5 = 19$ units from an original batch of 14.
2. **Quantity Asymmetry on Voucher Inquiries:** Voucher B's line detail would see a token row with `quantity = 14`, falsely reporting that 14 units were applied to Voucher B when only 9 were actually used.
3. **Loss of Parent Invariant:** The parent's `used_against_voucher_id` could only record the *last* voucher that depleted it, completely erasing parent linkage to earlier partial vouchers.

**Finalized Uniform Architecture:**  
To resolve this permanently and maintain 100% relational integrity:
- **Every voucher allocation slice creates an explicit child row:** Regardless of whether an allocation consumes 1 unit, 5 units, or all 14 units, an explicit child slice is inserted:
  `INSERT INTO token_transactions (quantity = alloc_qty, remaining_quantity = 0, total_amount = alloc_qty * val, parent_transaction_id = parent.id, usage_status = 'used', used_against_voucher_id = voucher_id, shift_id = NULL...)`
- **Parent Row acts strictly as Batch Origin & Unconsumed Pool:**
  `UPDATE token_transactions SET remaining_quantity = remaining_quantity - alloc_qty, total_amount = (remaining_quantity - alloc_qty) * val, usage_status = CASE WHEN remaining_quantity - alloc_qty = 0 THEN 'used' ELSE 'available' END WHERE id = parent.id`
  The parent row's `used_against_voucher_id` remains `NULL`.
- **Relational Invariants Guaranteed:**
  1. For any voucher $V$, `SUM(quantity) WHERE used_against_voucher_id = V` equals **exactly** the tokens applied to $V$.
  2. For any parent batch $P$, $\sum_{\text{child}} \text{child.quantity} + P.\text{remaining\_quantity} \equiv P.\text{quantity}$ holds with zero double-counting.
  3. Safe inventory queries filter `WHERE usage_status = 'available'`, perfectly excluding consumed child rows.

### 4.2 Validation Boundary & Strict Integer Policy
**JSON Parsing Normalization Reality vs. Lexical Claims:**  
Investigation of `src/app/api/vouchers/route.ts#L71` confirms that the API route ingests the incoming request body via `await req.json()`, which uses standard `JSON.parse`.  
- **Loss of Raw Lexemes:** Standard JSON deserialization converts all valid JSON numeric tokens (such as `2e0`, `2.0`, or `2`) directly into JavaScript IEEE-754 `number` primitives (evaluating to the number `2`). The raw textual lexeme is discarded during parsing. Therefore, claiming that the API can perform lexical regex inspection (such as `/e/i.test(rawQty)`) on a parsed JSON number is technically impossible because no raw string lexeme is preserved after JSON parsing.
- **PostgreSQL JSONB Normalization:** Similarly, PostgreSQL's native `jsonb` input parser automatically normalizes numeric representations (e.g., `'{"quantity": 2e0}'::jsonb` normalizes to `{"quantity": 2}`).

**Authoritative Dual-Layer Validation Architecture:**
1. **API Layer (`/api/vouchers` Route Contract):**
   - Receives parsed payload from `await req.json()`.
   - Rejects non-number types: enforces `typeof qty === 'number'`. Strings (including `"2e0"` or `"5"`), booleans, null, objects, and arrays are rejected.
   - Enforces integer contract: `Number.isInteger(qty)` (rejects fractional numbers like `2.5`).
   - Enforces positive 32-bit integer range: `qty > 0 && qty <= 2147483647`.
2. **Database RPC Layer (`create_voucher_atomic` Contract):**
   - Does not rely on API guarantees; independently enforces fail-closed checks directly on incoming JSONB:
   - **JSON Type Guard:** Strictly requires `jsonb_typeof(elem->'quantity') = 'number'`. Explicitly rejects JSON strings, booleans, arrays, objects, or nulls.
   - **Integer Format & Value Guard:** Checks extracted numeric text `(elem->>'quantity') ~ '^[0-9]+$'` and verifies `(elem->>'quantity')::NUMERIC = floor((elem->>'quantity')::NUMERIC)`.
   - **Range Bounds:** Enforces strictly positive range `(elem->>'quantity')::NUMERIC > 0` and 32-bit limit `(elem->>'quantity')::NUMERIC <= 2147483647`.
   - **Authoritative Database Stock Check:** Following deterministic row locking, revalidates `alloc_qty <= locked.remaining_quantity` and `locked.remaining_quantity > 0`.

### 4.3 Monetary Calculation & Financial Ledger Write Paths
**Detailed Write Path Verification:**  
Investigation of actual application endpoints (`api/vouchers`, `api/ledgers`, `api/shifts`) confirms the exact write and derivation boundaries:

```
Cashier Form Input:
  - Cash Paid: $C \ge 0$
  - Token Allocations: $\sum (q_i \times v_i) = T \ge 0$
  - Total Settlement: $S = C + T > 0$

Database Mutations within create_voucher_atomic:
  1. vouchers: INSERT 1 row with amount = S, payment_mode = 'Cash' (or Bank)
  2. token_transactions:
     - Parent: UPDATE remaining_quantity -= q_i, total_amount -= (q_i * v_i)
     - Child: INSERT child slice with quantity = q_i, total_amount = (q_i * v_i), usage_status = 'used', used_against_voucher_id = voucher.id, shift_id = NULL
  3. suppliers: UPDATE current_balance -= S
  4. audit_logs: INSERT 1 row with details = { amount: S, cash_paid_amount: C, tokens_applied_amount: T, allocations: [...] }
```

**Double-Counting Prevention in Downstream Reports:**
1. **Shift Drawer Reconciliation (`src/app/api/shifts/route.ts#L312–L326`):**
   - Shift drawer calculates expected cash: `Opening Cash + Cash Sales - Purchases Cash Paid - Expenses - Tokens Redeemed Cash`.
   - Token redemptions query filters `.eq('type', 'redeemed')` and `.eq('shift_id', id)`.
   - **Critical Guard:** Voucher token child rows set `shift_id = NULL`. Because `shift_id` is NULL, shift drawer calculations **never count voucher settlement tokens as cash payouts from the drawer**.
2. **Party Ledgers (`src/app/api/ledgers/route.ts#L152–L165`):**
   - Displays voucher credit: `vouchers.amount = S`. This correctly reflects the total liability reduction ($C + T$).
3. **Safe Stockpile Valuation:**
   - Filters `WHERE usage_status = 'available'`. Child rows (`usage_status = 'used'`) and depleted parents (`remaining_quantity = 0, usage_status = 'used'`) contribute Rs. 0 to active stock.

### 4.4 PostgreSQL 17 Executable SQL Specification
The canonical stored procedure `create_voucher_atomic` is statically verified for PostgreSQL 17 execution:

```sql
CREATE OR REPLACE FUNCTION public.create_voucher_atomic(
  p_tenant_id uuid,
  p_voucher_data jsonb,
  p_token_allocations jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_voucher_id       uuid;
  v_voucher_no       text;
  v_voucher_type     text;
  v_prefix           text;
  v_party_type       text;
  v_party_id         uuid;
  v_party_name       text;
  v_payment_mode     text;
  v_reference_no     text;
  v_remarks          text;
  v_created_by       text;
  v_date             date;
  v_amount           numeric(12,2) := 0.00;
  v_tokens_amount    numeric(12,2) := 0.00;
  v_total_settlement numeric(12,2) := 0.00;
  v_token_ids        uuid[];
  v_locked_rows      token_transactions[] := '{}';
  v_alloc_qtys       integer[] := '{}';
  v_rec              token_transactions;
  v_rec_qty          integer;
  v_elem             jsonb;
  v_supplier         suppliers%ROWTYPE;
  v_client           clients%ROWTYPE;
  v_new_balance      numeric(12,2);
  v_audit_details    jsonb;
  v_constraint_name  text;
  v_retry_count      integer := 0;
  i                  integer;

  -- Parameterized cursor selecting composite tuple 't' directly
  c_alloc_tokens CURSOR (cp_token_ids uuid[]) FOR
    SELECT t,
           (a.elem->>'quantity')::INTEGER AS requested_qty
      FROM token_transactions t
      JOIN jsonb_array_elements(p_token_allocations) a(elem)
        ON (a.elem->>'token_id')::UUID = t.id
     WHERE t.id = ANY(cp_token_ids)
       AND t.tenant_id = p_tenant_id
     ORDER BY t.id ASC
       FOR UPDATE OF t;
BEGIN
  -- ── 1. Basic Parameter Validation ──────────────────────────────────────────
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_voucher_data IS NULL OR jsonb_typeof(p_voucher_data) <> 'object' THEN
    RAISE EXCEPTION 'p_voucher_data must be a valid JSONB object';
  END IF;

  -- ── 2. Independent Cash Component Validation ───────────────────────────────
  IF p_voucher_data ? 'amount' AND (p_voucher_data->>'amount') IS NOT NULL AND (p_voucher_data->>'amount') <> '' THEN
    IF (p_voucher_data->>'amount') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Voucher cash amount must be a valid non-negative numeric string with at most 2 decimal places: %',
        p_voucher_data->>'amount';
    END IF;
    v_amount := (p_voucher_data->>'amount')::NUMERIC;
    IF v_amount < 0 THEN
      RAISE EXCEPTION 'Voucher cash amount cannot be negative: %', v_amount;
    END IF;
    IF v_amount > 99999999.99 THEN
      RAISE EXCEPTION 'Voucher cash amount exceeds maximum allowable limit (99,999,999.99): %', v_amount;
    END IF;
  ELSE
    v_amount := 0.00;
  END IF;

  -- ── 3. Token Allocations Structure Validation ──────────────────────────────
  IF p_token_allocations IS NOT NULL THEN
    IF jsonb_typeof(p_token_allocations) = 'null' THEN
      RAISE EXCEPTION 'p_token_allocations cannot be JSON null; must be a JSON array or SQL NULL';
    END IF;
    IF jsonb_typeof(p_token_allocations) <> 'array' THEN
      RAISE EXCEPTION 'p_token_allocations must be a JSONB array';
    END IF;

    IF jsonb_array_length(p_token_allocations) > 0 THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(p_token_allocations)
      LOOP
        IF jsonb_typeof(v_elem) <> 'object' THEN
          RAISE EXCEPTION 'Allocation array elements must be JSON objects';
        END IF;
        IF NOT (v_elem ? 'token_id') OR NOT (v_elem ? 'quantity') THEN
          RAISE EXCEPTION 'Allocation elements must contain both "token_id" and "quantity"';
        END IF;
        IF jsonb_typeof(v_elem->'token_id') = 'null' OR jsonb_typeof(v_elem->'quantity') = 'null' THEN
          RAISE EXCEPTION 'Allocation "token_id" and "quantity" values cannot be null';
        END IF;
        IF jsonb_typeof(v_elem->'token_id') <> 'string' THEN
          RAISE EXCEPTION 'Allocation token_id must be a JSON string: %', v_elem->'token_id';
        END IF;
        IF (v_elem->>'token_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          RAISE EXCEPTION 'Invalid UUID format for token_id: %', v_elem->>'token_id';
        END IF;
        IF jsonb_typeof(v_elem->'quantity') <> 'number' THEN
          RAISE EXCEPTION 'Allocation quantity must be a JSON number: %', v_elem->'quantity';
        END IF;
        IF (v_elem->>'quantity') !~ '^[0-9]+$' THEN
          RAISE EXCEPTION 'Allocation quantity must be an unsigned integer: %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC <= 0 THEN
          RAISE EXCEPTION 'Allocation quantity must be strictly greater than zero: %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC > 2147483647 THEN
          RAISE EXCEPTION 'Allocation quantity exceeds integer limit (2147483647): %', v_elem->>'quantity';
        END IF;
        IF (v_elem->>'quantity')::NUMERIC <> floor((v_elem->>'quantity')::NUMERIC) THEN
          RAISE EXCEPTION 'Allocation quantity cannot contain fractional units: %', v_elem->>'quantity';
        END IF;
      END LOOP;

      IF (SELECT count(DISTINCT (elem->>'token_id')::UUID) FROM jsonb_array_elements(p_token_allocations) elem)
         <> jsonb_array_length(p_token_allocations) THEN
        RAISE EXCEPTION 'Duplicate token IDs supplied in settlement allocations';
      END IF;
    END IF;
  END IF;

  -- ── 4. Deterministic Row Locking & In-Memory Retention ─────────────────────
  IF p_token_allocations IS NOT NULL AND jsonb_array_length(p_token_allocations) > 0 THEN
    v_token_ids := ARRAY(
      SELECT (elem->>'token_id')::UUID
        FROM jsonb_array_elements(p_token_allocations) elem
    );

    OPEN c_alloc_tokens(v_token_ids);
    LOOP
      FETCH c_alloc_tokens INTO v_rec, v_rec_qty;
      EXIT WHEN NOT FOUND;

      IF v_rec.usage_status IS DISTINCT FROM 'available' THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % is not available for settlement (status: %)', v_rec.id, v_rec.usage_status;
      END IF;

      IF v_rec.used_against_voucher_id IS NOT NULL OR v_rec.used_against_purchase_id IS NOT NULL THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % has already been applied to another transaction', v_rec.id;
      END IF;

      IF v_rec_qty > v_rec.remaining_quantity THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Requested quantity % exceeds available quantity % for token %',
          v_rec_qty, v_rec.remaining_quantity, v_rec.id;
      END IF;

      IF v_rec.remaining_quantity <= 0 THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % is depleted', v_rec.id;
      END IF;

      IF v_rec.token_value <= 0 THEN
        CLOSE c_alloc_tokens;
        RAISE EXCEPTION 'Token % has non-positive face value (%) and cannot be applied as payment tender',
          v_rec.id, v_rec.token_value;
      END IF;

      v_tokens_amount := v_tokens_amount + (v_rec.token_value * v_rec_qty);
      v_locked_rows   := array_append(v_locked_rows, v_rec);
      v_alloc_qtys    := array_append(v_alloc_qtys, v_rec_qty);
    END LOOP;
    CLOSE c_alloc_tokens;

    IF coalesce(cardinality(v_locked_rows), 0) <> jsonb_array_length(p_token_allocations) THEN
      RAISE EXCEPTION 'One or more requested tokens do not exist or belong to another tenant';
    END IF;
  END IF;

  -- ── 5. Total Settlement Calculation & Non-Zero Guard ───────────────────────
  v_total_settlement := v_amount + v_tokens_amount;
  IF v_total_settlement <= 0 THEN
    RAISE EXCEPTION 'Total settlement amount (cash + tokens) must be greater than zero';
  END IF;

  -- Extract voucher metadata
  v_voucher_no   := p_voucher_data->>'voucher_no';
  v_voucher_type := COALESCE(p_voucher_data->>'voucher_type', 'payment');
  v_party_type   := COALESCE(p_voucher_data->>'party_type', 'supplier');
  v_party_id     := (p_voucher_data->>'party_id')::UUID;
  v_party_name   := COALESCE(p_voucher_data->>'party_name', '');
  v_payment_mode := COALESCE(p_voucher_data->>'payment_mode', 'Cash');
  v_reference_no := p_voucher_data->>'reference_no';
  v_remarks      := p_voucher_data->>'remarks';
  v_created_by   := p_voucher_data->>'created_by';
  v_date         := COALESCE((p_voucher_data->>'date')::DATE, CURRENT_DATE);

  -- Collision-resistant voucher_no generation fallback (matching Phase 8 / DB-07 uniqueness)
  v_prefix := CASE WHEN v_voucher_type = 'receipt' THEN 'RCP' ELSE 'PMT' END;
  IF v_voucher_no IS NULL OR trim(v_voucher_no) = '' THEN
    v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
  END IF;

  WHILE EXISTS (SELECT 1 FROM vouchers WHERE tenant_id = p_tenant_id AND voucher_no = v_voucher_no) LOOP
    v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
  END LOOP;

  -- ── 6. Insert Voucher Header with Concurrency Collision Handling ───────────
  -- Robust insertion with subtransaction SAVEPOINT retry specifically on uq_vouchers_tenant_voucher_no
  LOOP
    BEGIN
      INSERT INTO vouchers (
        tenant_id, voucher_no, voucher_type, party_type, party_id,
        party_name, amount, payment_mode, reference_no, remarks,
        created_by, date
      ) VALUES (
        p_tenant_id, v_voucher_no, v_voucher_type, v_party_type, v_party_id,
        v_party_name, v_total_settlement, v_payment_mode, v_reference_no, v_remarks,
        v_created_by, v_date
      ) RETURNING id INTO v_voucher_id;

      EXIT; -- Insert succeeded
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
        -- Filter specifically for uq_vouchers_tenant_voucher_no collisions; re-raise any other constraint failure
        IF v_constraint_name = 'uq_vouchers_tenant_voucher_no' THEN
          v_retry_count := v_retry_count + 1;
          IF v_retry_count > 10 THEN
            RAISE EXCEPTION 'Exceeded maximum retry attempts (10) generating collision-free voucher_no';
          END IF;
          v_voucher_no := v_prefix || '-' || to_char(v_date, 'YYYYMMDD') || '-' || upper(to_hex(floor(4096 + random() * 61440)::int));
        ELSE
          RAISE; -- Re-raise unexpected unique constraint violations with original error
        END IF;
    END;
  END LOOP;

  -- ── 7. Token Mutation & Uniform Child Slice Creation ───────────────────────
  IF cardinality(v_locked_rows) > 0 THEN
    FOR i IN 1 .. cardinality(v_locked_rows)
    LOOP
      v_rec     := v_locked_rows[i];
      v_rec_qty := v_alloc_qtys[i];

      -- A. Decrement parent batch residual stock and book value
      UPDATE token_transactions
         SET remaining_quantity = remaining_quantity - v_rec_qty,
             total_amount       = (remaining_quantity - v_rec_qty) * token_value,
             usage_status       = CASE WHEN remaining_quantity - v_rec_qty = 0 THEN 'used' ELSE 'available' END
       WHERE id = v_rec.id;

      -- B. Insert child consumption slice (uniform for all allocations)
      INSERT INTO token_transactions (
        tenant_id, type, invoice_id, redemption_id, client_id, client_name,
        brand_id, brand_name, series_id, series_name, unit_name,
        token_value, quantity, remaining_quantity, total_amount,
        parent_transaction_id, usage_status, used_against_voucher_id,
        settled_vendor_name, notes, shift_id
      ) VALUES (
        p_tenant_id, v_rec.type, v_rec.invoice_id, v_rec.redemption_id,
        v_rec.client_id, v_rec.client_name,
        v_rec.brand_id, v_rec.brand_name,
        v_rec.series_id, v_rec.series_name, v_rec.unit_name,
        v_rec.token_value, v_rec_qty, 0, v_rec_qty * v_rec.token_value,
        v_rec.id, 'used', v_voucher_id,
        v_party_name,
        'Settlement against voucher ' || v_voucher_no,
        NULL
      );
    END LOOP;
  END IF;

  -- ── 8. Adjust Party Balance with Lock ───────────────────────────────────────
  IF v_party_type = 'supplier' THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_party_id AND tenant_id = p_tenant_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier % not found', v_party_id;
    END IF;

    UPDATE suppliers
       SET current_balance = current_balance - v_total_settlement
     WHERE id = v_party_id AND tenant_id = p_tenant_id
     RETURNING current_balance INTO v_new_balance;
  ELSIF v_party_type = 'client' THEN
    SELECT * INTO v_client
      FROM clients
     WHERE id = v_party_id AND tenant_id = p_tenant_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client % not found', v_party_id;
    END IF;

    UPDATE clients
       SET current_balance = current_balance - v_total_settlement
     WHERE id = v_party_id AND tenant_id = p_tenant_id
     RETURNING current_balance INTO v_new_balance;
  ELSE
    RAISE EXCEPTION 'Unsupported party_type: %', v_party_type;
  END IF;

  -- ── 9. Write Audit Log ─────────────────────────────────────────────────────
  v_audit_details := jsonb_build_object(
    'voucher_no', v_voucher_no,
    'voucher_type', v_voucher_type,
    'party_type', v_party_type,
    'party_id', v_party_id,
    'cash_paid_amount', v_amount,
    'tokens_applied_amount', v_tokens_amount,
    'total_settlement', v_total_settlement,
    'token_allocations', COALESCE(p_token_allocations, '[]'::jsonb)
  );

  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    p_tenant_id, COALESCE(v_created_by, 'System'), 'CREATE_VOUCHER', 'CREATE',
    'voucher', v_voucher_id::text, v_audit_details
  );

  RETURN jsonb_build_object(
    'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no,
    'amount', v_total_settlement,
    'cash_paid_amount', v_amount,
    'tokens_applied_amount', v_tokens_amount,
    'updated_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';
```

### 4.5 Hardened Legacy Wrapper Specification
```sql
CREATE OR REPLACE FUNCTION public.create_voucher_atomic(
  p_tenant_id uuid,
  p_voucher_data jsonb,
  p_token_ids uuid[]
) RETURNS jsonb AS $$
DECLARE
  v_allocations jsonb;
BEGIN
  IF p_token_ids IS NULL OR cardinality(p_token_ids) = 0 THEN
    RETURN public.create_voucher_atomic(p_tenant_id, p_voucher_data, NULL::jsonb);
  END IF;

  IF array_position(p_token_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Token ID array cannot contain NULL elements';
  END IF;

  IF (SELECT count(DISTINCT u.id) FROM unnest(p_token_ids) AS u(id)) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'Duplicate token IDs supplied in settlement request';
  END IF;

  -- Pre-validate existence and tenant ownership (fail-closed guard)
  -- Prevents missing, foreign-tenant, or invalid IDs from being silently ignored
  IF (SELECT count(*) FROM token_transactions WHERE id = ANY(p_token_ids) AND tenant_id = p_tenant_id) <> cardinality(p_token_ids) THEN
    RAISE EXCEPTION 'One or more requested tokens do not exist or belong to another tenant';
  END IF;

  -- Formatting conversion: LEFT JOIN ensures every requested ID is preserved
  -- Missing, foreign-tenant, or depleted tokens yield quantity: 0 (or null), which
  -- the canonical RPC deterministically locks and rejects with fail-closed errors.
  SELECT jsonb_agg(
           jsonb_build_object(
             'token_id', u.id,
             'quantity', COALESCE(t.remaining_quantity, 0)
           )
         )
    INTO v_allocations
    FROM unnest(p_token_ids) AS u(id)
    LEFT JOIN token_transactions t
      ON t.id = u.id AND t.tenant_id = p_tenant_id;

  RETURN public.create_voucher_atomic(p_tenant_id, p_voucher_data, v_allocations);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp';
```

### 4.6 Source & Schema Inspection: Overload Resolution, Locking, Reporting & Callers
1. **SQL Overload Resolution (`[SRC-VERIFIED]`):**
   - Function Signature 1 (Canonical): `create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_allocations jsonb DEFAULT NULL)`.
   - Function Signature 2 (Legacy Wrapper): `create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[])`.
   - PostgREST resolves RPC overloads based on parameter names matched from the incoming request payload. Because the third parameter has distinct names (`p_token_allocations` vs. `p_token_ids`), PostgREST resolves the target function unambiguously. When only `p_tenant_id` and `p_voucher_data` are passed, signature 1 is resolved via `DEFAULT NULL`.
2. **Cursor Locking & Fetch Behavior (`[SRC-VERIFIED]`):**
   - Cursor `c_alloc_tokens` enforces deterministic ordering `ORDER BY t.id ASC FOR UPDATE OF t`, guaranteeing consistent lock acquisition order across concurrent sessions to prevent deadlocks.
   - Rows are fetched into composite record `v_rec` (`token_transactions`) and `v_rec_qty` (`integer`).
   - Cardinality assertion `coalesce(cardinality(v_locked_rows), 0) <> jsonb_array_length(p_token_allocations)` verifies exact 1:1 matching between requested allocations and locked rows.
3. **Mandatory Insert Columns & Schema Constraints (`[LIVE-DB-VERIFIED]` + `[SRC-VERIFIED]`):**
   - Schema verification confirms 10 `NOT NULL` columns on `token_transactions`: `tenant_id`, `type`, `brand_name`, `series_name`, `unit_name`, `token_value`, `quantity`, `remaining_quantity`, `total_amount`, and `usage_status`. All 10 columns are explicitly populated in child slice insertion.
   - `shift_id` is a nullable column (`shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL`). Child slices explicitly insert `shift_id = NULL`.
   - Table `vouchers` enforces unique constraint `uq_vouchers_tenant_voucher_no UNIQUE (tenant_id, voucher_no)`. Canonical RPC includes retry generator to safeguard uniqueness.
4. **Downstream Reporting Compatibility (`[SRC-VERIFIED]`):**
   - **Shift Drawer:** `src/app/api/shifts/route.ts#L312–L326` filters `eq('type', 'redeemed')` and `eq('shift_id', id)` to compute drawer cash payouts. Setting `child.shift_id = NULL` ensures voucher token settlements are never deducted from shift drawer cash.
   - **Party Ledgers:** `src/app/api/ledgers/route.ts#L182–L195` credits `vouchers.amount = v_total_settlement` ($C + T$), matching the liability decrement in `suppliers.current_balance`.
   - **Stockpile Inventory:** Active stock queries in `FinancialLedgers.tsx#L227`, `PurchasesView.tsx#L200`, `TokenLedger.tsx#L412`, and `TokensView.tsx#L284` filter `usage_status = 'available'`. Consumed child rows (`usage_status = 'used'`) and depleted parent rows (`usage_status = 'used'`, `remaining_quantity = 0`) are excluded from active stock valuations, eliminating double-counting.
5. **Legacy Caller Audit (`[SRC-VERIFIED]`):**
   - Inspection confirms `src/app/api/vouchers/route.ts#L123` is the sole caller of `create_voucher_atomic` in the application, passing `p_token_ids`. The legacy wrapper ensures seamless backward compatibility until frontend Task T4 is implemented.

---

## 5. Master Task Matrix & Dependencies (T1–T11)

> [!IMPORTANT]
> **Rev 12A Status Update:** Tasks T2, T3, and T5 reflect SQL artifacts committed in `fe31b18`. These files are statically verified only — **no SQL has been executed against any database**. Runtime test execution (T7) and deployment (T9/T10) remain blocked on staging infrastructure and authorization.

```
┌─────────┬────────────────────────────────────────────────────┬──────────┬────────────────────────────────┬──────────────────────────────────┐
│ Task ID │ Task Title                                         │ Priority │ Status (Rev 12A)               │ Authorization Gate               │
├─────────┼────────────────────────────────────────────────────┼──────────┼────────────────────────────────┼──────────────────────────────────┤
│ Task T1 │ Pre-Implementation Baseline Verification           │ P0       │ COMPLETED                      │ Gate A (Plan Review)             │
│ Task T2 │ Forward Migration: Quantity-Aware Voucher RPC      │ P0       │ SQL AUTHORED & COMMITTED       │ Gate B (Execution Requires Auth) │
│ Task T3 │ Forward Migration: Fix Purchase RPC Qty Valuation  │ P1       │ SQL AUTHORED & COMMITTED       │ Gate B (Execution Requires Auth) │
│ Task T4 │ Frontend Fix: Quantity-Aware Supplier Token UI     │ P0       │ COMPLETED (Local Implemented)  │ Gate B (Local Verified)          │
│ Task T5 │ Recovery Artifacts & Containment Procedures (T2/T3)│ P0       │ ROLLBACKS AUTHORED & COMMITTED │ Gate B (Execution Pre-req for C) │
│ Task T6 │ Historical Data Diagnostic Audit (Read-Only)       │ P1       │ COMPLETED (6 Queries)          │ Gate A/B (Baseline Verified)     │
│ Task T7 │ Static Verification & Test Suite (42 Cases)        │ P1       │ STATIC DONE / RUNTIME BLOCKED  │ Gate B + STAGING-INFRA           │
│ Task T8 │ Pre-Deployment Readiness Review                    │ P0       │ PENDING T7 Runtime Results     │ Gate B (Pre-deploy review)       │
│ Task T9 │ Production Deployment: T2 Migration                │ P0       │ UNAUTHORIZED                   │ Gate C-1 (Separate auth from T10)│
│ Task T10│ Production Deployment: T3 Migration                │ P1       │ UNAUTHORIZED                   │ Gate C-2 (Separate auth from T9) │
│ Task T11│ Staging End-to-End Verification & Prod Verification │ P0       │ BLOCKED (Staging Not Provisioned)│ Gate C + Staging Project Ready   │
└─────────┴────────────────────────────────────────────────────┴──────────┴────────────────────────────────┴──────────────────────────────────┘
```

### Detailed Task Specifications

#### Task T1 — Pre-Implementation Baseline Verification
- **Scope:** Verify Git tree, HEAD commit, clean diff against `bdfea3576de0d3f9a1c1e49d9ec359ceece8003f`, and TypeScript compile status.
- **Deliverables:** Documented baseline commit and zero-error TypeScript static compilation output.
- **Dependencies:** None.
- **Acceptance Criteria:** Zero modified or staged tracked files in working tree (only the untracked planning document `docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md` present); `npx tsc --noEmit` exits code 0.
- **Verification Method:** Local shell execution.
- **Environment:** Local development repository.
- **Authorization Gate:** Gate A (Completed).
- **Current Status:** `COMPLETED (Baseline Verified)`.
- **Blockers:** None.

#### Task T2 — Forward Migration: Quantity-Aware Voucher RPC
- **Scope:** Author migration `supabase/migrations/20261013_03_fix_create_voucher_atomic.sql` implementing canonical JSONB RPC with uniform child slice creation, deterministic lock ordering, and legacy wrapper.
- **Deliverables:** Single idempotent SQL migration file.
- **Dependencies:** Gate B authorization for execution.
- **Acceptance Criteria:** `create_voucher_atomic` definition replaces `used_date` update with child slice creation; multiplies `token_value * alloc_qty`; enforces strict validation.
- **Verification Method:** Static SQL linting (done) and staging deployment (pending).
- **Environment:** Staging Supabase project.
- **Authorization Gate:** Gate B (execution).
- **Current Status (Rev 12A):** `SQL AUTHORED & COMMITTED` — File committed in Git `fe31b18`. Static verification complete per SQL Verification Report Section 2. **Not executed against any database.** Runtime verification blocked on staging provisioning.
- **Committed Artifact:** [`supabase/migrations/20261013_03_fix_create_voucher_atomic.sql`](file:///c:/Users/Alyan/Desktop/pyntflow/p-industry/supabase/migrations/20261013_03_fix_create_voucher_atomic.sql) (21,467 bytes)
- **Blockers:** Gate B authorization for SQL execution; staging infrastructure (`STAGING-INFRA`).

#### Task T3 — Forward Migration: Fix Purchase RPC Quantity Valuation
- **Scope:** Author migration `supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql` correcting Step 2 accumulator to multiply `token_value * remaining_quantity`.
- **Deliverables:** Single idempotent SQL migration file.
- **Dependencies:** Gate B authorization for execution (independent of T2).
- **Acceptance Criteria:** Multiplies `token_value * remaining_quantity`; maintains existing non-token purchase behavior; includes `p_items` NULL/non-array guard (F-RV-01), NULL-element and duplicate token ID guards (F-RV-02).
- **Verification Method:** Static SQL verification (done per SQL Verification Report) and staging execution (pending).
- **Environment:** Staging Supabase project.
- **Authorization Gate:** Gate B (execution).
- **Current Status (Rev 12A):** `SQL AUTHORED & COMMITTED` — File committed in Git `fe31b18`. Static verification complete per SQL Verification Report Sections 5 and 7.5. Includes hardening fixes F-RV-01 (p_items guard), F-RV-02 (NULL/duplicate token ID guards) verified on-disk at L98–L103, L109–L116. **Not executed against any database.**
- **Q-FIN-01 Resolution:** Verified `[SRC-VERIFIED]` — The caller (PurchasesView.tsx) already deducts `tokensAppliedAmount` from `netBillValue` before computing `due_amount`. The RPC correctly trusts caller-supplied `due_amount` and must NOT subtract token value a second time. See SQL Verification Report Section 7.2. **Do not change this behavior without explicit business owner confirmation.**
- **Committed Artifact:** [`supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///c:/Users/Alyan/Desktop/pyntflow/p-industry/supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql) (13,893 bytes)
- **Blockers:** Gate B authorization for SQL execution; staging infrastructure (`STAGING-INFRA`).

#### Task T4 — Frontend Fix: Quantity-Aware Supplier Token UI
- **Scope:** Update `src/components/FinancialLedgers.tsx` to support quantity selectors per batch row, line totals, dynamic preview, and payload mapping to `/api/vouchers`.
- **Deliverables:** Updated `FinancialLedgers.tsx` component.
- **Dependencies:** Gate B authorization.
- **Acceptance Criteria:** Cashier can input positive integer quantities; preview calculates `token_value * quantity`; depleted rows disabled.
- **Verification Method:** TypeScript type check and browser verification on staging.
- **Environment:** Local / Staging.
- **Authorization Gate:** Gate B.
- **Current Status (Rev 12A):** `COMPLETED (Local Implementation & Testing Complete)` — Implemented in `src/components/FinancialLedgers.tsx` and `src/app/api/vouchers/route.ts`. Local test suite passed (31/31 assertions in `scripts/test-supplier-token-payment-local.mjs`).
- **Blockers:** Staging runtime browser verification blocked pending staging infrastructure (`STAGING-INFRA`). Local implementation complete.

#### Task T5 — Recovery Artifacts & Containment Procedures
- **Scope:** Author emergency rollback / containment migration artifacts `supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql` and `rollback_20261013_04_fix_create_purchase_atomic_valuation.sql`.
- **Deliverables:** Two verified containment SQL scripts.
- **Dependencies:** T2 and T3 migration drafting (satisfied).
- **Rollback Contradiction Resolution:** Prior plan drafts ambiguously proposed rolling back by restoring the baseline production migration `20261005_04_create_voucher_atomic.sql`. However, baseline forensics confirmed that `20261005_04_create_voucher_atomic.sql` is inherently defective due to `BUG-VA-01` (`used_date = NOW()`, referencing a column that does not exist in `token_transactions`). Restoring that historical file would immediately reinstate a guaranteed runtime crash (`42703 undefined_column`) whenever tokens are applied. Because no prior working version of `create_voucher_atomic` exists in migration history, a historical safe rollback target remains unresolved. Therefore, Task T5 defines an explicit emergency containment procedure: the rollback artifact must synthesize a clean, minimal definition of `create_voucher_atomic(uuid, jsonb, uuid[])` that strips the erroneous `used_date` statement, providing a verified safe fallback.
- **Acceptance Criteria:** Rollback scripts safely restore valid routines without referencing `used_date`; static analysis and dry-run syntax verification pass.
- **Verification Method:** Dry-run syntax analysis (done) and staging rollback-apply-rollback cycle (pending).
- **Environment:** Local repository / Staging.
- **Authorization Gate:** Gate B (execution).
- **Current Status (Rev 12A):** `ROLLBACKS AUTHORED & COMMITTED` — Both rollback files committed in Git `fe31b18`. Static verification complete per SQL Verification Report Section 4. Rollback `_04` includes F-RV-03 fix (`ORDER BY id ASC` locking, verified on-disk at L114). **Not executed against any database.** Rollback-apply-rollback validation cycle awaiting staging provisioning.
- **Critical Safety Notice:** Reverting to baseline `20261005_04` is **FORBIDDEN** — it causes `42703 (undefined_column)` crash. Emergency containment requires the minimal fix provided in `rollback_20261013_03`.
- **Committed Artifacts:**
  - [`supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql`](file:///c:/Users/Alyan/Desktop/pyntflow/p-industry/supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql) (10,057 bytes)
  - [`supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///c:/Users/Alyan/Desktop/pyntflow/p-industry/supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql) (11,797 bytes)
- **Blockers:** Gate B authorization for rollback execution on staging; staging infrastructure (`STAGING-INFRA`).

#### Task T6 — Historical Data Diagnostic Audit
- **Scope:** Execute read-only diagnostics against production to check for existing anomalies.
- **Deliverables:** Diagnostic query record (HDA-Q1 through HDA-Q6).
- **Dependencies:** None.
- **Acceptance Criteria:** Zero pre-deployment anomalies confirmed on examined live records.
- **Verification Method:** Read-only SQL queries via management API.
- **Environment:** Production project `ignspvajzblmsbertmmv`.
- **Authorization Gate:** Gate A/B (Read-Only).
- **Current Status:** `COMPLETED (6 Queries Executed Live — 0 Anomalies Found)`.
- **Blockers:** None.

#### Task T7 — Static Verification & Test Suite Execution
- **Scope:** Execute local TypeScript checks and run the 38 planned transactional staging test scenarios (Cases 1–38) against the provisioned staging environment, while confirming that the 4 read-only baseline structural/diagnostic checks (Cases 39–42) remain valid.
- **Deliverables:** Test execution log across all 38 planned staging scenarios with pass/fail evidence.
- **Dependencies:** Staging project provisioning; migrations T2 and T3 applied to staging.
- **Acceptance Criteria:** All 38 planned staging test cases pass on staging; zero regressions; 4 baseline structural/diagnostic assertions confirm passing state.
- **Verification Method:** Automated test script on staging.
- **Environment:** Staging Supabase project (Cases 1–38) / Production read-only assertions (Cases 39–42).
- **Authorization Gate:** Gate B + `STAGING-INFRA` provisioned.
- **Current Status (Rev 12A):** `STATIC VERIFICATION COMPLETE — RUNTIME BLOCKED`
  - **Static verification done:** SQL Verification Report confirms structural correctness of `_03` and `_04` migration files. 42-case test matrix specified in Report Section 8.
  - **Runtime verification pending:** 38 transactional test cases (Cases 1–38) remain `PLANNED` — zero have been executed. No database has been touched.
  - **4 structural/diagnostic checks (Cases 39–42):** Previously `EXECUTED-PASS` against production (read-only). Remain valid.
- **Staging Execution Sequence (Planned):**
  1. **Setup:** Apply T2 migration (`_03`) then T3 migration (`_04`) to staging. Seed test tenant, supplier, and token batches.
  2. **Voucher Tests (Cases 1–25, 29–35):** Full/partial batch consumption, overdraft, zero/negative/fractional quantity, depleted batch, duplicate IDs, nonexistent tokens, foreign tenant, malformed JSON, status guards, reference guards, cash-only voucher, combined cash+tokens, concurrency, replay, face value guards, heterogeneous batches, supplier balance, audit log completeness.
  3. **Concurrency Tests (Cases 26–28):** Two-session coordinated race conditions validating deterministic lock ordering and deadlock freedom.
  4. **Purchase Tests (Cases 36–37):** Multi-token batch valuation and non-token regression.
  5. **Reporting Isolation (Case 38):** Stockpile query excludes child rows with `usage_status = 'used'`.
  6. **Rollback Validation:** Execute `rollback_20261013_03`, verify function reverted; re-apply `_03`. Execute `rollback_20261013_04`, verify function reverted; re-apply `_04`.
  7. **Post-Test Data Integrity:** Verify parent+child quantity invariants, zero orphaned rows, zero double-counted values.
- **Blockers:** Staging project provisioning (`STAGING-INFRA`).

#### Task T8 — Pre-Deployment Readiness Review
- **Scope:** Formal review of all staging test results, rollback artifacts, and deployment runbooks before production release.
- **Deliverables:** Signed off readiness report.
- **Dependencies:** Successful completion of Tasks T2–T7.
- **Acceptance Criteria:** 100% staging test pass rate; zero unresolved blockers.
- **Verification Method:** Peer review.
- **Environment:** Local / Staging.
- **Authorization Gate:** Gate B / Gate C Pre-requisite.
- **Current Status:** `PENDING T2-T7`.
- **Blockers:** Awaiting Gate B implementation and staging results.

#### Task T9 — Production Deployment: T2 Migration (Voucher RPC)
- **Scope:** Apply `20261013_03_fix_create_voucher_atomic.sql` to production project `ignspvajzblmsbertmmv`.
- **Deliverables:** Deployed production migration.
- **Dependencies:** Successful T8 review; Gate C-1 explicit authorization.
- **Acceptance Criteria:** `create_voucher_atomic` updated in production with zero errors; execution restricted to `service_role`.
- **Verification Method:** Read-only `pg_proc` assertion.
- **Environment:** Production `ignspvajzblmsbertmmv`.
- **Authorization Gate:** Gate C-1 (Separate production gate).
- **Current Status:** `UNAUTHORIZED`.
- **Blockers:** Requires Gate C-1 authorization.

#### Task T10 — Production Deployment: T3 Migration (Purchase RPC)
- **Scope:** Apply `20261013_04_fix_create_purchase_atomic_valuation.sql` to production project `ignspvajzblmsbertmmv`.
- **Deliverables:** Deployed production migration.
- **Dependencies:** Successful T8 review; Gate C-2 explicit authorization.
- **Acceptance Criteria:** `create_purchase_atomic` updated in production; execution restricted to `service_role`.
- **Verification Method:** Read-only `pg_proc` assertion.
- **Environment:** Production `ignspvajzblmsbertmmv`.
- **Authorization Gate:** Gate C-2 (Separate production gate).
- **Current Status:** `UNAUTHORIZED`.
- **Blockers:** Requires Gate C-2 authorization.

#### Task T11 — Staging End-to-End Verification & Post-Deploy Health Check
- **Scope:** Execute end-to-end transactional tests on staging, followed by non-mutating production post-deploy structural health checks.
- **Deliverables:** Staging verification report and production verification log.
- **Dependencies:** Staging project provisioned; production deployment completed.
- **Acceptance Criteria:** Zero production test records created; all staging tests pass.
- **Verification Method:** Staging test execution and production read-only queries.
- **Environment:** Staging (mutating) / Production (read-only).
- **Authorization Gate:** Gate C + Staging Project Provisioned.
- **Current Status:** `BLOCKED (Staging Infrastructure Setup)`.
- **Blockers:** Staging project not provisioned (`STAGING-INFRA`).

---

## 6. Final Test & Verification Matrix (42 Cases)

> ### ⚠️ Mandatory Evidentiary Classification:
> - **[PLANNED] (Test Cases 1–38):** Transactional, concurrency, overdraft, error-injection, and reporting test scenarios.  
>   **Concurrency safety, deadlock freedom, transactional rollback atomicity, and partial-batch residual book value correctness remain architectural hypotheses to be proven empirically on staging.** They are not assumed or claimed as proven.  
> - **[EXECUTED-PASS] (Test Cases 39–42):** Strictly limited to read-only schema assertions and diagnostic baseline queries executed against the live production database. No transactional test records were created.

| # | Test Scenario / Input | Expected Result / Outcome | Env | Test Status |
|---|---|---|---|---|
| **1** | Full batch consumption: batch of 14, request 14 | Rs. 5,600 applied. Parent `remaining_qty=0`, `total_amount=0`, `status='used'`, `voucher_id=NULL`. Child slice created (qty 14, `total_amount=5600`, `status='used'`, `voucher_id=V`). | STAGING | PLANNED |
| **2** | Partial batch consumption: batch of 14, request 5 | Rs. 2,000 applied. Parent `remaining_qty=9`, `total_amount=3600`, status `'available'`, `voucher_id=NULL`. Child slice created (qty 5, `total_amount=2000`, `status='used'`, `voucher_id=V`). | STAGING | PLANNED |
| **3** | Subsequent partial consumption: request 4 from remaining 9 | Rs. 1,600 applied. Parent `remaining_qty=5`, `total_amount=2000`. Second child slice created (qty 4, `total_amount=1600`, `status='used'`, `voucher_id=V2`). | STAGING | PLANNED |
| **4** | Exhaust final units: request 5 from remaining 5 | Rs. 2,000 applied. Parent `remaining_qty=0`, `total_amount=0`, `status='used'`, `voucher_id=NULL`. Third child slice created (qty 5, `total_amount=2000`, `status='used'`, `voucher_id=V3`). Sum of children = 14. | STAGING | PLANNED |
| **5** | Overdraft request: batch of 14, request 15 | **EXCEPTION:** Overdraft error; zero writes. | STAGING | PLANNED |
| **6** | Zero quantity requested: batch of 14, request 0 | **EXCEPTION:** Positive integer constraint violation; zero writes. | STAGING | PLANNED |
| **7** | Negative quantity requested: batch of 14, request -3 | **EXCEPTION:** Positive integer constraint violation; zero writes. | STAGING | PLANNED |
| **8** | Fractional quantity requested: batch of 14, request 2.5 | **EXCEPTION:** Whole integer constraint violation (`quantity::numeric = floor(quantity)`); zero writes. | STAGING | PLANNED |
| **9** | Depleted batch in allocations: `remaining_quantity = 0` | **EXCEPTION:** Rejected by zero-quantity check; zero writes. | STAGING | PLANNED |
| **10**| Canonical RPC duplicate IDs: `[{ID_A, 2}, {ID_A, 3}]` | **EXCEPTION:** Rejected by canonical duplicate ID check; zero writes. | STAGING | PLANNED |
| **11**| Legacy wrapper duplicate IDs: `[ID_A, ID_A]` | **EXCEPTION:** Rejected by wrapper duplicate ID check; zero writes. | STAGING | PLANNED |
| **12**| Nonexistent token ID in JSON allocations | **EXCEPTION:** Explicit not-found / tenant-mismatch exception; zero writes. | STAGING | PLANNED |
| **13**| Mixed valid & foreign-tenant allocations | **EXCEPTION:** Explicit tenant-isolation check failure (`COUNT <> array_length`); zero writes. | STAGING | PLANNED |
| **14**| Malformed JSON payload: string or object instead of array | **EXCEPTION:** Schema guard failure; zero writes. | STAGING | PLANNED |
| **15**| Missing `quantity` or `token_id` field in allocation object | **EXCEPTION:** Required field guard failure; zero writes. | STAGING | PLANNED |
| **16**| Invalid UUID format string in `token_id` | **EXCEPTION:** UUID regex format exception; zero writes. | STAGING | PLANNED |
| **17**| Status guard: Token with `usage_status = 'used'` | **EXCEPTION:** Rejected (`IS DISTINCT FROM 'available'`); zero writes. | STAGING | PLANNED |
| **18**| Status guard: Token with `usage_status = 'settled'` | **EXCEPTION:** Rejected (`IS DISTINCT FROM 'available'`); zero writes. | STAGING | PLANNED |
| **19**| Status guard: Token with `usage_status IS NULL` | **EXCEPTION:** Rejected by null-safe predicate; zero writes. | STAGING | PLANNED |
| **20**| Reference guard: `used_against_voucher_id IS NOT NULL` | **EXCEPTION:** Rejected as already linked; zero writes. | STAGING | PLANNED |
| **21**| Reference guard: `used_against_purchase_id IS NOT NULL` | **EXCEPTION:** Rejected as already linked; zero writes. | STAGING | PLANNED |
| **22**| Tenant security: Single token belonging to foreign tenant | **EXCEPTION:** Tenant count mismatch; zero writes. | STAGING | PLANNED |
| **23**| Mixed valid & invalid: 1 valid (5 units) + 1 depleted | **EXCEPTION:** Entire transaction aborted; zero writes. | STAGING | PLANNED |
| **24**| Pure cash voucher: `amount = 5000`, allocations NULL | Voucher created: Rs. 5,000. Token table untouched. | STAGING | PLANNED |
| **25**| Combined cash + tokens: `cash = 3000`, `tokens = 2000` | Settlement: Rs. 5,000. Balance reduced by Rs. 5,000. | STAGING | PLANNED |
| **26**| Concurrency Race: Two coordinated sessions competing for 10 units each from a batch of 14 units. | **Protocol:** Session A locks batch; Session B attempts lock and waits (`pg_stat_activity` confirms lock wait). Session A commits (10 units consumed). Session B unblocks, revalidates locked state, detects overdraft (4 available vs 10 requested), and raises exception.<br>**Invariant Assertion:** Exactly 1 session succeeds; exactly 1 session rolls back; final parent `remaining_quantity = 4`, `total_amount = 1600`; exactly 1 child row created. | STAGING | PLANNED |
| **27**| Concurrency Race: Two coordinated sessions competing for 7 units each from a batch of 14 units. | **Protocol:** Session A locks batch; Session B waits for lock. Session A consumes 7 units and commits. Session B unblocks, revalidates locked state (7 units available $\ge$ 7 requested), consumes remaining 7 units and commits.<br>**Invariant Assertion:** Both sessions succeed sequentially; final parent `remaining_quantity = 0`, `total_amount = 0`, `usage_status = 'used'`; exactly 2 child slices created (7 units each); total settlement Rs. 5,600. | STAGING | PLANNED |
| **28**| Concurrency Race: Legacy wrapper simultaneous invocations targeting identical batch. | **Protocol:** Two concurrent wrapper calls targeting same batch. Deterministic ascending lock acquisition prevents deadlocks; second caller revalidates locked state upon unblocking.<br>**Invariant Assertion:** Overdraft or double-consumption prevented; total units consumed cannot exceed initial available quantity. | STAGING | PLANNED |
| **29**| Transaction failure injection: Error after voucher insert | Complete rollback: no voucher, parent remaining qty and `total_amount` restored. | STAGING | PLANNED |
| **30**| Idempotency / Replay: Immediate replay of completed payload | Rejected because units were consumed or IDs marked used. | STAGING | PLANNED |
| **31**| Zero face value: `token_value = 0` | **EXCEPTION:** Rejected by settlement RPC tender guard ('Token has non-positive face value and cannot be applied as payment tender'); zero writes. DB schema permits 0 for non-payment records, but settlement strictly requires `token_value > 0`. | STAGING | PLANNED |
| **32**| Negative face value: `token_value = -400` | **EXCEPTION:** Rejected by DB check constraint `token_value >= 0`; zero writes. | STAGING | PLANNED |
| **33**| Heterogeneous batches: `(5 × Rs.400) + (2 × Rs.600)` | Token amount: `2000 + 1200 = Rs. 3,200`. Both batches split cleanly into child slices. | STAGING | PLANNED |
| **34**| Supplier balance credit preservation: advance balance | Balance decreases algebraically into credit. | STAGING | PLANNED |
| **35**| Audit log completeness: voucher creation | `entity_type='voucher'`, details include allocations, amounts, and breakdown. | STAGING | PLANNED |
| **36**| Purchase RPC parity: multi-token batch on purchase | Multiplies `token_value × remaining_qty` (no partial purchase). | STAGING | PLANNED |
| **37**| Purchase non-token regression: standard purchase | Line items, stock quantities, and due balance update cleanly. | STAGING | PLANNED |
| **38**| Stockpile reporting isolation: child rows with `usage_status = 'used'` | Aggregating available safe stock filters `usage_status = 'available'`; child `total_amount` values are excluded from available pool. | STAGING | PLANNED |
| **39**| Function signature & routine identity assertion | Verified live: `SECURITY DEFINER`, search_path `public, pg_temp`. | STRUCTURAL | EXECUTED-PASS |
| **40**| Information schema column confirmation | Verified live: `used_date` absent on `token_transactions`. | STRUCTURAL | EXECUTED-PASS |
| **41**| Information schema execute grants assertion | Verified live: only `postgres` and `service_role` have EXECUTE grant. | STRUCTURAL | EXECUTED-PASS |
| **42**| Historical baseline diagnostic query suite | 6 read-only queries executed live: 0 anomalies within examined rows. | DIAGNOSTIC | EXECUTED-PASS |

---

## 7. Scope-Narrowed Historical Data Diagnostic Record (Task T6)

### 7.1 Scope of Executed Investigation
The read-only diagnostic investigation was strictly bounded to the following six specific SQL queries executed on October 13, 2026, against project `ignspvajzblmsbertmmv`:
1. `HDA-Q1`: Evaluated whether any rows in `token_transactions` had `usage_status = 'used'` while `remaining_quantity > 0`. Result: `0` rows.
2. `HDA-Q2`: Evaluated whether any rows in `token_transactions` had `usage_status = 'available'` while `remaining_quantity = 0`. Result: `0` rows.
3. `HDA-Q3`: Evaluated whether any rows in `token_transactions` had `remaining_quantity IS NULL`. Result: `0` rows (schema enforces `NOT NULL`).
4. `HDA-Q4`: Enumerated total rows in `token_transactions`. Result: Exactly 2 rows present.
5. `HDA-Q5`: Evaluated whether any rows had `used_against_voucher_id IS NOT NULL`. Result: `0` rows.
6. `HDA-Q6`: Evaluated whether any rows in `purchases` had `tokens_applied_amount > 0`. Result: `0` rows across 5 total purchases.

### 7.2 Strict Diagnostic Conclusion
- **Verified Finding:** Within the 2 token rows and 5 purchase rows present in the live database, **no records exhibited the specific anomaly conditions tested by HDA-Q1 through HDA-Q6**.
- **Scope Limitation:** Executing 6 diagnostic queries on specific tables does not constitute an execution of transactional test cases, nor does it certify unexamined tables or historical client invoices. It confirms solely that the specific pre-deployment anomalies targeted by this implementation plan are absent from the examined live tables.

---

## 8. Open Technical & Operational Inquiries

| Inquiry ID | Technical Subject | Status & Action Required | Blocking Level |
|---|---|---|---|
| **STAGING-INFRA** | **Provisioning of Dedicated Staging Supabase Project** | An active staging project is **not yet provisioned**. The project owner must provision a staging instance mirroring PostgreSQL 17.6 and provide connection parameters during authorized setup. **Options:** (a) Create a new Supabase project on the free tier for staging, (b) Repurpose inactive project `bvykqfccfndttejulaen` if compatible with PostgreSQL 17.6. Both options require project owner approval. No `.env` staging configuration exists in the repository. | **BLOCKS T7 (runtime), T8, T11** |
| **Q-FIN-01** | **Purchase RPC Token Deduction Logic** | **RESOLVED** `[SRC-VERIFIED]` — The caller (`PurchasesView.tsx`) already deducts `tokensAppliedAmount` from `netBillValue` before computing `due_amount`. The RPC must NOT subtract token value again. Documented in SQL Verification Report Section 7.2. **Do not change without explicit business owner confirmation.** | Resolved — no block |
| **FH-01** | **Future Hardening: Server-Side Financial Consistency Validation** | **DOCUMENTED — NOT IN SCOPE.** A non-deducting consistency assertion for `net_total`/`paid_amount`/`due_amount` vs. actual locked token values is documented as a future enhancement in SQL Verification Report Section 8.3. Must never subtract `v_tokens_amount` from `v_due_amount` (double-deduction hazard). Requires separate design review and authorization. | Not a blocker — separate future scope |

*(Note: Decision Q1, Decision Q2, Decision Q-SMOKE, and Q-FIN-01 are fully resolved and recorded.)*

---

## 9. Revision History & Change Log

| Revision | Date | Author / Context | Summary of Changes |
|---|---|---|---|
| **Rev 1** | 2026-10-13 | Initial Forensic Draft | Identified `used_date` crash and batch valuation defect. Proposed flawed rollback. |
| **Rev 2** | 2026-10-13 | Planning Corrections | Corrected zero-quantity guard; elevated Q1 and Q-SMOKE to blockers. |
| **Rev 3** | 2026-10-13 | Rigorous Forensic Revision | Applied C-01 through C-12 corrections; established 5-pillar recovery; expanded to 33 tests. |
| **Rev 4** | 2026-10-13 | Architectural Specification | Recorded Q1 (partial-batch) and Q-SMOKE (staging project) approvals; formulated parent-child splitting and expanded to 38 tests. |
| **Rev 5** | 2026-10-13 | Schema Constraints & Contract Reconciliation | Verified schema constraints; clarified `/api/vouchers` amount semantics; reconciled lock ordering and Test #27. |
| **Rev 6** | 2026-10-13 | Hardened Wrapper & Reporting Reconciliation | Hardened legacy wrapper; detailed Q2 accounting models; verified child-row mapping and reporting impact. |
| **Rev 7** | 2026-10-13 | Concurrency Lock Validation & Safety Hardening | Hardened wrapper against silent ID dropping; required lock revalidation; aligned Test #28 with schema. |
| **Rev 8** | 2026-10-13 | Q2 Model 1 Approval & Canonical Validation Hardening | Recorded Q2 Model 1 approval; added canonical duplicate validation and fail-closed tenant checks; expanded to 42 tests. |
| **Rev 9** | 2026-10-13 | Lock-Set Reconciliation & Strict SQL Validation | Reconciled locking query parent columns; defined Model 1 reporting isolation; verified zero triggers on token table; specified regex and type checks; added Cases 16 and 38. |
| **Rev 10** | 2026-10-13 | Final Architectural Plan & Hardening Review | Replaced separate unlocked reads with cursor join; added cardinality proof; fixed wrapper alias and tenant validation; aligned Test #31 tender rule; verified child-row schema fields. |
| **Rev 11** | 2026-10-13 | Concurrency Coordination & Transaction Reconciliation | Reconciled wrapper pre-checks; added independent cash validation; selected composite `t` in cursor; justified child-row `type`; added accounting matrix; rewrote Tests 26–28. |
| **Rev 12 FINAL** | 2026-10-13 | Final Technical Corrections & Plan Finalization | **1. Legacy Wrapper ID Preservation:** Replaced INNER JOIN with LEFT JOIN and added explicit tenant/existence count pre-check to guarantee missing, foreign-tenant, or depleted IDs are never silently dropped.<br>**2. Canonical RPC JSON Type Alignment:** Added explicit `jsonb_typeof(quantity) <> 'number'` check before integer format, positive range ($1 \le \text{qty} \le 2147483647$), and locked stock availability validation.<br>**3. Scientific Notation Lexical Claim Correction:** Documented that API `await req.json()` parses numeric tokens into JS number primitives, discarding raw lexemes; replaced lexical regex claims with type and `Number.isInteger` validation.<br>**4. Rollback Target Resolution:** Explicitly recorded that restoring baseline `20261005_04_create_voucher_atomic.sql` reinstates the P0 `used_date` crash; noted historical safe rollback target remains unresolved; specified emergency containment script omitting `used_date`.<br>**5. Test Count & Scope Reconciliation:** Reconciled T7 scope to distinguish the 38 planned staging scenarios from the 4 executed read-only baseline checks (total 42 cases).<br>**6. Working Tree Criteria:** Reconciled T1 acceptance criteria to acknowledge the untracked plan document in the working tree.<br>**7. Explicit `child.shift_id = NULL` Insertion:** Explicitly included `shift_id` in child INSERT column list and passed `NULL`, aligning with nullable schema and protecting shift drawer cash reconciliation.<br>**8. Source & Schema Inspection:** Formulated Section 4.6 verifying PostgREST overload resolution, parameterized cursor locking, mandatory insert columns, reporting compatibility, and legacy caller audit.<br>**9. Planning Stopped:** Formally declared final planning state; no further revisions authorized. |
| **Rev 12A** | 2026-10-13 | Status Update — Staging Readiness Assessment | **Documentation-only update. No scope, architecture, or authorization changes.**<br>**1. Task Status Reconciliation:** Updated T2, T3, T5 statuses from `PLANNING SPEC COMPLETE` / `READY FOR DRAFTING` to `SQL AUTHORED & COMMITTED` based on Git commit `fe31b18` evidence. Updated T7 to `STATIC DONE / RUNTIME BLOCKED`.<br>**2. Q-FIN-01 Resolution Recorded:** Confirmed and documented that `PurchasesView.tsx` caller already deducts token value before computing `due_amount`; RPC must NOT deduct again. Added to Task T3 and Section 8 inquiries.<br>**3. Financial Consistency Hardening (FH-01):** Documented as out-of-scope future enhancement in Section 8 inquiries with cross-reference to SQL Verification Report Section 8.3. Must never double-deduct tokens.<br>**4. Staging Readiness Assessment:** Confirmed staging project is NOT provisioned. No `.env` staging configuration exists. Documented provisioning options (new project or repurpose `bvykqfccfndttejulaen`) requiring project owner approval. Staging blocks T7 runtime, T8, and T11.<br>**5. Runtime Verification Preparation:** Added detailed staging execution sequence to T7 covering setup, voucher/purchase/concurrency tests, rollback validation, and post-test integrity checks.<br>**6. Committed Artifact Registry:** Added file paths, sizes, and Git commit references for all 4 SQL artifacts (2 migrations + 2 rollbacks).<br>**7. Git Baseline Updated:** Recorded `fe31b18` as current HEAD with only verification report uncommitted. |

---
*End of Document — Revision 12A Implementation Plan & Task Register*  
*Status: STATUS UPDATE — Static verification complete. Runtime execution and deployment strictly unauthorized until staging infrastructure is provisioned and Gate B/C authorizations are granted.*
