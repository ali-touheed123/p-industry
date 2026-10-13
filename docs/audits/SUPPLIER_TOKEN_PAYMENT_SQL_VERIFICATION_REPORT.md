# PyntFlow — Supplier Token Payment Defects: SQL Migration Verification Report

**Document Path:** `docs/audits/SUPPLIER_TOKEN_PAYMENT_SQL_VERIFICATION_REPORT.md`  
**Related Implementation Plan:** `docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md` (Revision 12 FINAL)  
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)  
**Target Supabase Production:** `ignspvajzblmsbertmmv` (PostgreSQL 17.6)  
**Date:** October 13, 2026  
**Status:** `MIGRATIONS PREPARED — STATIC VERIFICATION COMPLETE — NOT EXECUTED`

---

## ⛔ Execution Authorization Notice

**THESE SQL MIGRATION FILES AND ROLLBACK ARTIFACTS HAVE BEEN PREPARED AND STATICALLY VERIFIED ONLY.**  
No SQL migrations have been executed. No DDL or DML statements have been run against Supabase production or staging. No database records or schema configurations were altered. Execution remains strictly unauthorized until Gate B and Gate C approvals are granted and a dedicated staging instance is provisioned.

---

## 1. Created Artifact Register

The following four SQL files have been created in the repository:

| File Path | Artifact Type | Target Routine | Purpose |
|---|---|---|---|
| [`supabase/migrations/20261013_03_fix_create_voucher_atomic.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261013_03_fix_create_voucher_atomic.sql) | Forward Migration | `create_voucher_atomic(uuid, jsonb, jsonb)` & `create_voucher_atomic(uuid, jsonb, uuid[])` | Fixes P0 defect `BUG-VA-01` (removes invalid `used_date`), implements quantity-aware valuation (`BUG-VA-02`), uniform child slice accounting (`BUG-VA-03`), deterministic row locking, and hardened legacy array wrapper. |
| [`supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql) | Forward Migration | `create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` | Fixes defect `BUG-PA-01` (Step 2 token accumulator multiplies `token_value * remaining_quantity`), adds deterministic `ORDER BY id ASC FOR UPDATE` locking, and zeroes residual balances in Step 4. |
| [`supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql`](file:///d:/bestow/p-industry/supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql) | Recovery Artifact | `create_voucher_atomic` | Safe containment script: drops JSONB overload and restores baseline UUID-array overload with the invalid `used_date` update removed. |
| [`supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///d:/bestow/p-industry/supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql) | Recovery Artifact | `create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` | Standby restoration script: restores the verified baseline definition from `20261013_01_fix_create_purchase_atomic_audit_log.sql`. |

---

## 2. Baseline Verification & Commit Discrepancy Reconciliation

### 2.1 Git Tree & Commit Discrepancy
- **Repository HEAD:** Commit `bdfea3576de0d3f9a1c1e49d9ec359ceece8003f` (`feat(purchases): add keyboard navigation and auto-scroll for search dropdowns`).
- **Plan Reference Discrepancy Noted:**
  - Section 2.2 line 114 of Revision 12 FINAL correctly identifies `bdfea3576de0d3f9a1c1e49d9ec359ceece8003f` as the baseline commit.
  - Section 2.1 line 106 referenced commit `c56a31c` (`fix(purchases): remediate purchase audit logs entity error...`).
  - **Resolution:** Commit `c56a31c` was the parent commit where the purchase audit log fix was authored. `bdfea35` is the subsequent HEAD commit incorporating dropdown navigation. The working tree was verified clean against HEAD `bdfea35` prior to migration drafting.

### 2.2 Pre-Migration Database Schema Baseline
1. `token_transactions`: Column `used_date` confirmed **ABSENT** (`information_schema.columns`).
2. `token_transactions.shift_id`: Confirmed **NULLABLE** (`UUID REFERENCES shifts(id) ON DELETE SET NULL`).
3. Mandatory `NOT NULL` columns on `token_transactions`: 10 columns confirmed (`tenant_id`, `type`, `brand_name`, `series_name`, `unit_name`, `token_value`, `quantity`, `remaining_quantity`, `total_amount`, `usage_status`).
4. Unique constraint on `vouchers`: `uq_vouchers_tenant_voucher_no UNIQUE (tenant_id, voucher_no)`.

---

## 3. Detailed Technical Verification of Forward Migrations

### 3.1 Migration `20261013_03_fix_create_voucher_atomic.sql`
1. **P0 Crash Remediation (`used_date` Removal):**
   - The defective assignment `used_date = NOW()` has been completely removed.
2. **Canonical JSONB Overload:**
   - Signature: `create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_allocations jsonb DEFAULT NULL) RETURNS jsonb`.
   - Independent cash validation: Validates non-negative numeric strings with at most 2 decimal places and range $\le 99,999,999.99$.
   - Strict JSON type validation: Explicitly validates `jsonb_typeof(elem->'token_id') = 'string'` and `jsonb_typeof(elem->'quantity') = 'number'`. Rejects JSON strings, booleans, arrays, objects, and nulls.
   - Numerical integrity: Validates unsigned integer format `^[0-9]+$`, strictly positive range $> 0$, 32-bit limit $\le 2147483647$, and whole integer equivalence `= floor()`.
   - Deterministic row locking: Parameterized cursor uses `ORDER BY t.id ASC FOR UPDATE OF t`.
   - Cardinality assertion: Rejects if `cardinality(v_locked_rows) <> jsonb_array_length(p_token_allocations)`.
3. **Voucher Number Concurrency Collision Handling:**
   - Previous revisions relied on `WHILE EXISTS (SELECT 1 FROM vouchers ...)` which was susceptible to race collisions under concurrent transactions before commit.
   - **Resolution Implemented:** Wrapped `INSERT INTO vouchers` in a `LOOP BEGIN ... EXCEPTION WHEN unique_violation THEN ... END LOOP` block. If two concurrent transactions generate identical candidate codes, the collision is caught via internal subtransaction savepoint, a fresh candidate code is generated, and insertion retries automatically.
4. **Uniform Consumption Slice Architecture:**
   - Parent row decrements `remaining_quantity` and `total_amount` proportionally; sets `usage_status = 'used'` upon full exhaustion ($\text{remaining} = 0$), preserving `used_against_voucher_id = NULL`.
   - Child slice inserted with `quantity = requested_qty`, `remaining_quantity = 0`, `total_amount = requested_qty * token_value`, `parent_transaction_id = parent.id`, `usage_status = 'used'`, `used_against_voucher_id = voucher.id`, and explicit `shift_id = NULL`.
   - All 10 NOT NULL columns are populated.
5. **Hardened Legacy Wrapper:**
   - Signature: `create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[]) RETURNS jsonb`.
   - Pre-validates tenant ownership and existence: `IF (SELECT count(*) FROM token_transactions WHERE id = ANY(p_token_ids) AND tenant_id = p_tenant_id) <> cardinality(p_token_ids) THEN RAISE EXCEPTION ...`.
   - Constructs JSON allocations using `LEFT JOIN` and `COALESCE(t.remaining_quantity, 0)`. Missing, foreign, or depleted tokens yield allocation objects that the canonical RPC authoritatively locks and rejects.
6. **Overload Resolution & Security:**
   - Parameter names differ (`p_token_allocations` vs `p_token_ids`), allowing PostgREST to resolve overloads unambiguously.
   - `SECURITY DEFINER` with `SET search_path = public, pg_temp`.
   - Execution revoked from `PUBLIC, anon, authenticated`; granted strictly to `service_role`.

### 3.2 Migration `20261013_04_fix_create_purchase_atomic_valuation.sql`
1. **Valuation Accumulator Correction:**
   - Step 2 accumulator updated from `v_tokens_amount + COALESCE(token_value, 0)` to `v_tokens_amount + (COALESCE(token_value, 0) * v_token.remaining_quantity)`.
   - Depleted batch guard: Explicitly rejects tokens with `remaining_quantity <= 0`.
2. **Deterministic Locking Order:**
   - Added `ORDER BY id ASC FOR UPDATE` to Step 2 cursor query, ensuring consistent lock acquisition across concurrent purchase sessions.
3. **Residual Balance Zeroing (Model 1):**
   - Step 4 updates `remaining_quantity = 0` and `total_amount = 0` alongside `usage_status = 'used'`, properly retiring the consumed stockpile batch.
4. **Preserved Integrations:**
   - Retains Phase 9 `shift_id` linkage, C-01 strict item code validation, C-02 supplier payment metadata updates, and canonical audit logging.
   - Restricted strictly to `service_role`.

---

## 4. Technical Verification of Recovery / Containment Artifacts

### 4.1 Rollback `rollback_20261013_03_fix_create_voucher_atomic.sql`
- **Contradiction Resolved:** Historical migration `20261005_04_create_voucher_atomic.sql` has `used_date = NOW()`, causing runtime error 42703. Reverting to it would restore a known crash.
- **Containment Design:**
  1. Executes `DROP FUNCTION IF EXISTS public.create_voucher_atomic(uuid, jsonb, jsonb);` to cleanly remove the canonical forward overload.
  2. Re-creates `public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[])` as a safe containment routine that omits `used_date = NOW()`.
  3. Preserves `FOR UPDATE` row locking, cash voucher creation, party balance adjustments, and audit logging.
  4. Restricts permissions strictly to `service_role`.

### 4.2 Rollback `rollback_20261013_04_fix_create_purchase_atomic_valuation.sql`
- **Baseline Target:** Restores the exact, verified definition established in `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`.
- **Integrity:** Retains the canonical audit contract, Phase 9 `shift_id` linkage, and strict item validation, while reverting Step 2 valuation to unit face value summation.

---

## 5. Verification Checks Summary

### 5.1 Static Checks Performed
1. **TypeScript Type Check:**
   - Command: `npx tsc --noEmit`
   - Result: Exit code `0` (clean compile, zero errors).
2. **Git Working Tree Audit:**
   - Command: `git status --short`
   - Verified that only the plan, newly created migrations, rollbacks, and this report exist. Zero changes made to application code or tracking branches.
3. **SQL AST & Syntax Inspection:**
   - Verified PL/pgSQL block structures, variable declarations, cursor syntax, subtransaction exception handling, and transaction boundaries.
   - Verified parameter name distinctness for PostgREST RPC overload resolution.
   - Verified column references against live PostgreSQL 17.6 schema (`token_transactions`, `vouchers`, `purchases`, `purchase_items`, `suppliers`, `clients`, `audit_logs`).

### 5.2 Checks Pending (Awaiting Staging / Authorization)
1. **PostgreSQL 17.6 Live Execution:**
   - Applying `20261013_03` and `20261013_04` against a live database remains pending until a dedicated staging instance is provisioned (`STAGING-INFRA`) and Gate B/C authorizations are opened.
2. **Empirical Concurrency & Lock Wait Testing:**
   - Concurrency race conditions (Test Cases 26–28) must be proven empirically on staging under coordinated sessions.
3. **End-to-End Staging Verification:**
   - All 38 planned test scenarios remain classified as `[PLANNED]` on staging.

---

## 6. Remaining Risks & Operational Recommendations

1. **Staging Project Provisioning (`STAGING-INFRA`):**
   - The business owner must provision a staging instance mirroring PostgreSQL 17.6 before executing forward migrations or test suites.
2. **Production Deployment Sequence:**
   - Forward migrations must be deployed sequentially under separate authorization gates:
     - Gate C-1: `20261013_03_fix_create_voucher_atomic.sql`
     - Gate C-2: `20261013_04_fix_create_purchase_atomic_valuation.sql`
3. **Data Remediation Scope:**
   - Rolling back function DDL modifies routine logic only; it does not retroactively alter committed transactions. Committed records created during any test window must be audited.

---

## 7. Targeted Correctness Review — October 13, 2026 (Post-Authoring)

**Review scope:** `20261013_03`, `20261013_04`, `rollback_20261013_03`, `rollback_20261013_04`.  
**Evidence sources read:** `20261002_01_paint_token_management.sql` (schema), `20261005_02_create_purchase_atomic.sql`, `20261005_04_create_voucher_atomic.sql` (baselines), `20261013_01` and `20261013_02` (prior fixes), `src/app/api/vouchers/route.ts`, `src/app/api/purchases/route.ts`.  
**Execution:** None. Static analysis only.

---

### 7.1 Voucher Number Handling (`_03` migration)

**Contract established from `vouchers/route.ts`:**  
The API caller **always** generates a `candidateVoucherNo` before invoking the RPC and passes it as `voucher_no` in the JSONB payload (L108). The RPC therefore always receives a non-empty candidate.

**Behavior in `_03`:**
- L247: If `v_voucher_no IS NULL OR trim(v_voucher_no) = ''` → generate. Correctly handles missing/empty values.
- L252: `WHILE EXISTS` pre-flight loop for re-generation on observed collisions.
- L257-284: `LOOP BEGIN INSERT ... EXCEPTION WHEN unique_violation THEN GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME` — correctly re-raises violations from any constraint other than `uq_vouchers_tenant_voucher_no`.
- Retry exhaustion guard: `IF v_retry_count > 10 THEN RAISE EXCEPTION` — safe terminal bound.

**Verdict:** ✅ Correct. Caller-supplied values are respected; the retry loop is correctly scoped to `uq_vouchers_tenant_voucher_no` and exhaustion fails safely.

---

### 7.2 Purchase Token Financial Semantics & Resolution of Q-FIN-01 (`_04` migration)

**Full Flow Trace Across UI → API → RPC → Supplier Balance:**

1. **Frontend UI Level (`src/components/PurchasesView.tsx`):**
   - **Line 281–284:** Calculates gross net bill before tokens:
     ```typescript
     const netBillValueBeforeTokens = Math.max(
       0,
       taxableValue + effectiveSalesTax - additionalDiscount + cartageFreight
     );
     ```
   - **Line 286–289:** **Tokens are deducted at the UI level from the net invoice total:**
     ```typescript
     const netBillValue = Math.max(
       0,
       netBillValueBeforeTokens - tokensAppliedAmount
     );
     ```
   - **Line 295–298:** Projected supplier balance calculates:
     ```typescript
     const projectedBalance =
       purchaseType === 'purchase'
         ? currentSupplierBalance + netBillValue - paidAmount
         : Math.max(0, currentSupplierBalance - netBillValue);
     ```
   - **Line 389–396:** The submitted POST payload sends:
     ```typescript
     net_total: netBillValue,
     paid_amount: paidAmount,
     due_amount: Math.max(0, netBillValue - paidAmount), // Already net of tokens!
     applied_token_ids: selectedTokenIds,
     ```

2. **API Route Level (`src/app/api/purchases/route.ts`):**
   - **Line 118–124:** Ingests `net_total`, `paid_amount`, `due_amount` and packages them into `purchaseData`:
     ```typescript
     net_total: Number(net_total) || 0,
     paid_amount: Number(paid_amount) || 0,
     due_amount: Number(due_amount) || 0,
     ```
   - **Line 139–147:** Passes `purchaseData` and `p_token_ids` to `create_purchase_atomic` without altering `due_amount`.

3. **Database Stored Procedure Level (`supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql`):**
   - **Line 83–85:** Extracts:
     ```sql
     v_net_total   := COALESCE((p_purchase_data->>'net_total')::NUMERIC, 0);
     v_paid_amount := COALESCE((p_purchase_data->>'paid_amount')::NUMERIC, 0);
     v_due_amount  := COALESCE((p_purchase_data->>'due_amount')::NUMERIC, 0);
     ```
   - **Line 107–145 (Step 2):** Calculates `v_tokens_amount` from locked token rows.
   - **Line 149–158 (Step 3):** Inserts purchase header, recording `tokens_applied_amount = v_tokens_amount`, `paid_amount = v_paid_amount`, and `due_amount = v_due_amount`.
   - **Line 228–257 (Step 6):** Adjusts supplier balance using `v_due_amount`:
     ```sql
     IF NOT v_is_return THEN
       v_new_balance := v_current_bal + v_due_amount;
     ...
     UPDATE suppliers SET current_balance = v_new_balance ...
     ```

**Empirical Resolution of Q-FIN-01:**
- **Evidence Finding:** The caller (`PurchasesView.tsx`) **already subtracts `tokensAppliedAmount`** from `netBillValue` and computes `due_amount = netBillValue - paidAmount`.
- **Double-Deduction Hazard:** If `create_purchase_atomic` were modified to subtract `v_tokens_amount` from `v_due_amount` at the database level, tokens would be deducted **twice** from the supplier's payable balance, erroneously reducing supplier liability by $2 \times$ the token face value.
- **Authoritative Recommendation:** Retain the existing contract in `20261013_04_fix_create_purchase_atomic_valuation.sql`. The caller provides the pre-computed `due_amount` (already net of tokens), and the RPC records `tokens_applied_amount` as an informational/audit field while updating supplier balance strictly by `v_due_amount`. No changes to `_04` SQL logic are required for Q-FIN-01.

---

### 7.3 Confirmed Defects Found and Corrected

#### Finding F-RV-01: `_04` migration — `p_items` NULL/non-array guard missing

**Root cause:** `IF jsonb_array_length(p_items) = 0` is called before validating that `p_items` is a non-null JSONB array. PostgreSQL returns NULL from `jsonb_array_length(NULL)` → the condition evaluates to NULL → branch not taken → runtime crash at the subsequent `jsonb_array_elements(p_items)` call. Non-array JSON inputs raise an unhelpful system error.

**Fix applied (`_04` forward migration, Lines 95–100):**
```sql
IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
  RAISE EXCEPTION 'p_items must be a non-null JSONB array';
END IF;
IF jsonb_array_length(p_items) = 0 THEN
  RAISE EXCEPTION 'At least one line item is required';
END IF;
```
Same guard added to `rollback_20261013_04` for consistency.

---

#### Finding F-RV-02: `_04` migration — NULL element and duplicate token ID guards absent

**Root cause:** The UUID-array interface accepted NULL elements in `p_token_ids[]` (which `ANY()` silently ignores, understating the count check) and accepted duplicate UUIDs (resulting in the same row locked and applied twice, with `tokens_applied_amount` double-counted).

**Fix applied (`_04` forward migration, Step 2):**
```sql
IF array_position(p_token_ids, NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Token ID array cannot contain NULL elements';
END IF;
IF (SELECT count(DISTINCT u.id) FROM unnest(p_token_ids) AS u(id)) <> array_length(p_token_ids, 1) THEN
  RAISE EXCEPTION 'Duplicate token IDs supplied in purchase token request';
END IF;
```

---

#### Finding F-RV-03: `rollback_20261013_04` — FOR UPDATE loop missing `ORDER BY id ASC`

**Root cause:** The rollback script's token `FOR UPDATE` loop had no `ORDER BY`, creating deadlock risk under concurrent sessions locking the same token set in different orders. The forward `_04` migration had `ORDER BY id ASC` but the rollback did not.

**Fix applied (`rollback_20261013_04`, token loop):** Added `ORDER BY id ASC` before `FOR UPDATE`.

---

### 7.4 Items Inspected and Confirmed Correct (No Change)

| Item | Verified |
|---|---|
| `_03` Voucher: `total_amount` formula in parent UPDATE (`remaining_quantity - v_rec_qty) * token_value`) | ✅ Correct — unqualified column refs resolved to the row being updated |
| `_03` Voucher: cursor `ORDER BY t.id ASC FOR UPDATE OF t` | ✅ Correct |
| `_03` Voucher: cardinality post-cursor check `coalesce(cardinality(v_locked_rows), 0) <> jsonb_array_length(p_token_allocations)` | ✅ Correct |
| `_03` Legacy wrapper: depleted tokens yield `quantity: 0` → canonical RPC rejects with fail-closed error | ✅ Correct and documented |
| `_04` forward: `ORDER BY id ASC FOR UPDATE` on token loop | ✅ Already present before this review |
| `_04` forward: Step 4 sets `used_against_purchase_id`, not `used_against_voucher_id` | ✅ Correct |
| `_04` forward: Supplier balance incremented by `v_due_amount` (caller-computed), not affected by `v_tokens_amount` | ✅ Consistent with caller contract (Q-FIN-01 resolved) |
| `_03` rollback: `DROP FUNCTION IF EXISTS` targets the correct JSONB overload signature | ✅ Correct |
| SECURITY DEFINER + `SET search_path = public, pg_temp` on all four routines | ✅ Confirmed |
| `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role` | ✅ Confirmed on all four routines |
| `usage_status = 'used'` constraint: allowed by `20261013_02` migration | ✅ Confirmed |

---

### 7.5 Files Changed in This Review

> [!IMPORTANT]
> **Git Status Reconciliation:** The changes described below are **HISTORICAL** — they were applied to the files during their original authoring session and committed in Git commit `fe31b18` ("supplier token payment fixes"). `git status --short` correctly shows these migration and rollback files as **clean/unmodified** relative to HEAD. The only currently uncommitted file is this verification report (`SUPPLIER_TOKEN_PAYMENT_SQL_VERIFICATION_REPORT.md`). Section 7.5 describes what was changed *within the files during their creation*, not what is currently uncommitted.

| File | Change | Commit Status |
|---|---|---|
| [`supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql) | Added `p_items` NULL/non-array guard (F-RV-01); added NULL-element and duplicate-token-ID guards in Step 2 (F-RV-02) | Committed (`fe31b18`) |
| [`supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///d:/bestow/p-industry/supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql) | Added `p_items` NULL/non-array guard (F-RV-01); added `ORDER BY id ASC` to token FOR UPDATE loop (F-RV-03) | Committed (`fe31b18`) |

**On-disk presence verified (October 13, 2026):**
- F-RV-01 (`p_items` guard): Present at `_04` forward migration L98–L103, rollback `_04` L91–L96. ✅
- F-RV-02 (NULL element + duplicate ID guards): Present at `_04` forward migration L109–L116. ✅
- F-RV-03 (`ORDER BY id ASC` in rollback token loop): Present at rollback `_04` L114. ✅

**No changes made to:**  
- `20261013_03_fix_create_voucher_atomic.sql` — no defects found  
- `rollback_20261013_03_fix_create_voucher_atomic.sql` — no defects found  
- Application code, schema, database records, or any other file

---

### 7.6 Review Inquiries Status

1. **Purchase financial semantics (Q-FIN-01):** **RESOLVED.** Codebase analysis of `src/components/PurchasesView.tsx#L286-L289` and `#L389-L391` confirms that `due_amount` is calculated by the UI after already deducting tokens. The RPC must NOT subtract tokens again to prevent double-deduction.
2. **Live execution (Q-EXEC-01):** **PENDING.** All corrections remain statically verified only. Runtime correctness, lock behavior, and concurrency safety require execution against a PostgreSQL 17.6 staging instance once provisioned (`STAGING-INFRA`).

---

## 8. Staging Test Plan & Outstanding Operational Risks

### 8.1 Staging Test Matrix Summary (42 Cases)
Per Revision 12 FINAL Section 6, the test matrix comprises 42 formal cases divided into two strict execution categories:

1. **Transactional Staging Suite — Test Cases 1–38 (`[PLANNED]` on Staging):**
   - **Partial & Full Batch Depletion (Cases 1–4):** Tests full batch allocation, partial consumption slice creation, sequential partial slices, and complete exhaustion leaving parent `remaining_quantity = 0, total_amount = 0, usage_status = 'used'` with child slices preserving voucher IDs.
   - **Input Validation & Overdrafts (Cases 5–9):** Tests overdraft ($15 > 14$), zero quantity, negative quantity, fractional numbers ($2.5$), and already depleted batches ($0$ remaining).
   - **Structural & Payload Malformations (Cases 10–16):** Duplicate IDs in canonical array, duplicate IDs in legacy wrapper, nonexistent IDs, foreign-tenant IDs, malformed JSON structures, missing required keys, and invalid UUID regex strings.
   - **Status & Reference Guards (Cases 17–23):** Rejection of tokens with `status = 'used'`, `status = 'settled'`, `status IS NULL`, or already linked to a voucher (`used_against_voucher_id IS NOT NULL`) or purchase (`used_against_purchase_id IS NOT NULL`).
   - **Financial Tender & Mix Scenarios (Cases 24–25, 31–34):** Pure cash vouchers, combined cash + tokens, zero face value token rejection, negative face value rejection, heterogeneous batch mixing, and supplier credit balance preservation.
   - **Concurrency & Deadlock Prevention (Cases 26–28):** Two concurrent sessions competing for tokens from the same batch; verification that deterministic ascending UUID row locking (`ORDER BY id ASC FOR UPDATE`) prevents deadlocks and enforces stock re-validation upon lock unblocking.
   - **Atomicity & Recovery (Case 29–30):** Error injection during voucher creation to verify total transaction rollback; replay rejection.
   - **Purchase Parity & Reporting Isolation (Cases 35–38):** Audit log schema verification, `create_purchase_atomic` quantity valuation parity, non-token purchase regression verification, and stockpile inventory isolation filtering `WHERE usage_status = 'available'`.

2. **Baseline Production Assertions — Test Cases 39–42 (`[EXECUTED-PASS]` Read-Only):**
   - **Case 39:** Routine identity & `SECURITY DEFINER` assertion.
   - **Case 40:** Information schema confirmation: `used_date` column absent from `token_transactions`.
   - **Case 41:** Execute grant restriction: `PUBLIC`, `anon`, `authenticated` revoked; restricted strictly to `service_role`.
   - **Case 42:** Historical diagnostic query suite (HDA-Q1 to HDA-Q6): 0 anomalies across examined live records.

### 8.2 Outstanding Risks & Operational Safeguards

1. **`STAGING-INFRA` Blocker:**
   - A dedicated staging instance mirroring PostgreSQL 17.6 is not yet provisioned.
   - **Mitigation:** Zero mutating tests or forward migrations may be executed against production. Testing is strictly blocked until staging infrastructure is ready.
2. **PL/pgSQL Deferred Plan Compilation:**
   - PostgreSQL validates function syntax at definition time, but deferred plan compilation resolves certain table/column references only when a statement branch is first executed at runtime.
   - **Mitigation:** Staging test suite must achieve 100% branch execution coverage across all 38 planned test cases before Gate C production deployment.
3. **Rollback Data Mutation Scope:**
   - Rollback scripts (`rollback_20261013_03` and `rollback_20261013_04`) revert function DDL definitions only; they cannot undo committed transactional writes created while a migration was active.
   - **Mitigation:** Pre-deployment database snapshots and strict staging isolation prior to any production roll-out.
4. **Implementation Authorization Gate:**
   - In accordance with Revision 12 FINAL, implementation and deployment remain strictly UNAUTHORIZED until Gate B and Gate C are formally opened.

### 8.3 Future Hardening Recommendation — Server-Side Financial Consistency Validation

> [!NOTE]
> **Context:** Q-FIN-01 is resolved — the caller (UI) already deducts `tokensAppliedAmount` from `netBillValue` before computing `due_amount`, so the RPC correctly trusts the caller-supplied `due_amount` without subtracting tokens again. However, blindly trusting any caller-supplied financial field introduces a separate integrity concern: a malformed or tampered API request could submit inconsistent `net_total`, `paid_amount`, and `due_amount` values that don't match the actual locked token values.

**Recommended Future Enhancement (NOT in current scope — requires separate authorization):**

After token rows are locked and `v_tokens_amount` is calculated in Step 2, `create_purchase_atomic` could add a **non-deducting consistency assertion** that validates the caller's arithmetic without altering the existing financial contract:

```sql
-- FUTURE HARDENING (example — not authorized for implementation):
-- After Step 2 (v_tokens_amount calculated from locked rows):
IF v_tokens_amount > 0 THEN
  -- Verify: net_total + tokens_applied ≈ gross total (within rounding)
  -- Verify: due_amount + paid_amount + tokens_applied ≈ gross total
  -- Verify: due_amount >= 0
  IF v_due_amount < 0 THEN
    RAISE EXCEPTION 'due_amount cannot be negative: %', v_due_amount;
  END IF;
  IF v_paid_amount < 0 THEN
    RAISE EXCEPTION 'paid_amount cannot be negative: %', v_paid_amount;
  END IF;
END IF;
```

**Key constraint:** This validation must **never subtract** `v_tokens_amount` from `v_due_amount`. Doing so would double-deduct tokens (the caller already deducted them). The purpose is solely to catch arithmetic inconsistencies in the submitted payload before they are persisted.

**Status:** Documented as a future hardening opportunity. Not included in the current `_04` migration scope. Requires separate design review and authorization.

## 9. Discrepancy Reconciliation & Forensic Findings (Rev 12A Audit)

### 9.1 D1 — Voucher-Number Uniqueness and Concurrency Resolution
- **Committed Migration Evidence:** `supabase/migrations/20261013_03_fix_create_voucher_atomic.sql` (L257–L284) implements a subtransaction `LOOP ... BEGIN ... INSERT ... EXCEPTION WHEN unique_violation ... END; END LOOP;` block.
- **Constraint-Specific Handling:** Extracts `v_constraint_name = CONSTRAINT_NAME` via `GET STACKED DIAGNOSTICS`. Only collisions on `uq_vouchers_tenant_voucher_no` trigger the retry generator (up to 10 attempts with regenerated random hex suffix). All other uniqueness constraint violations are explicitly re-raised via `RAISE;`.
- **Concurrency Coverage:** Surrounds the actual `INSERT INTO vouchers` statement, guaranteeing safety against concurrent collision races between pre-check and commit.
- **Plan Discrepancy Resolution:** Implementation Plan Section 4.4 previously displayed a pre-insert `WHILE EXISTS` loop followed by a bare `INSERT` without the exception block. This was a documentation omission in the plan. Section 4.4 has been corrected in place to match the committed migration code.

### 9.2 D2 — Quantity Validation Across API and JSONB Boundaries
Detailed boundary analysis for the 11 target inputs:
| Input | Application API (`await req.json()`) | PostgreSQL RPC (`create_voucher_atomic`) | Contract Status |
|---|---|---|---|
| `2` | Accepted (`typeof === 'number'`, `isInteger`, within bounds) | Accepted (`jsonb_typeof='number'`, regex `^[0-9]+$`, > 0, floor match) | Accepted |
| `2.0` | Accepted (parsed by JS to IEEE-754 primitive `2`) | Rejected at text conversion if `->>` produces `'2.0'` (regex `^[0-9]+$` fails) | Strict Integer Guard |
| `2e0` | Accepted (parsed by JS to IEEE-754 primitive `2`) | Rejected at text conversion if `->>` preserves exponential format | Strict Integer Guard |
| `2.5` | Rejected (`Number.isInteger(2.5)` is false) | Rejected (regex `^[0-9]+$` and `numeric <> floor(numeric)`) | Rejected (Fractional) |
| `0` | Rejected (bounded `qty >= 1`) | Rejected (`numeric <= 0`) | Rejected (Non-positive) |
| `-2` | Rejected (bounded `qty >= 1`) | Rejected (regex fails on `-`, `numeric <= 0`) | Rejected (Negative) |
| `2147483647` | Accepted (32-bit signed int limit) | Accepted (`numeric <= 2147483647`) | Accepted |
| `2147483648` | Rejected (`qty > 2147483647`) | Rejected (`numeric > 2147483647`) | Rejected (Overflow) |
| `"2"` | Rejected (`typeof !== 'number'`) | Rejected (`jsonb_typeof <> 'number'`) | Rejected (String Type) |
| `null` | Rejected (`typeof === 'object'`) | Rejected (`jsonb_typeof = 'null'`) | Rejected (Null) |
| `true` | Rejected (`typeof !== 'number'`) | Rejected (`jsonb_typeof <> 'number'`) | Rejected (Boolean Type) |

### 9.3 D3 — Accurate SQL Execution Status Reconciliation
- **Read-Only Historical Diagnostic Queries:** Tasks HDA-Q1 to HDA-Q6 (Task T6) were executed live against production Supabase project `ignspvajzblmsbertmmv`. All 6 queries completed read-only with 0 anomalies confirmed across live records (`[EXECUTED-PASS]`).
- **Baseline Structural Assertions:** Cases 39–42 were executed read-only against production (`[EXECUTED-PASS]`).
- **Mutating SQL Status:** Forward migrations `20261013_03` (T2) and `20261013_04` (T3), and rollbacks `rollback_20261013_03` and `rollback_20261013_04` (T5) are authored and committed in Git `fe31b18` but have **NOT been executed against any database** (staging or production).
- **Transactional Staging Scenarios:** Cases 1–38 remain `[PLANNED]` pending staging infrastructure provisioning (`STAGING-INFRA`).

### 9.4 D4 — Authorization Gates and Scopes
- **Gate A (Forensic & Plan Verification):** Complete.
- **Gate B (Local Implementation & Testing):** Local code modifications (frontend T4, local unit tests, documentation) are authorized. Staging environment provisioning and staging SQL execution remain blocked on external infrastructure.
- **Gate C-1 (Production Deployment of Migration _03):** UNAUTHORIZED. Requires independent project owner approval following successful staging verification.
- **Gate C-2 (Production Deployment of Migration _04):** UNAUTHORIZED. Requires independent project owner approval separate from Gate C-1.

---
*End of SQL Migration Verification Report*
