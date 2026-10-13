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

### 7.2 Purchase Token Financial Semantics (`_04` migration)

**Contract established from `purchases/route.ts`:**
- `paid_amount`, `due_amount`, and `net_total` are **computed and provided by the caller** from the UI before the RPC is called (L116-124).
- `applied_token_ids` is sent separately as `p_token_ids`.
- The RPC records `tokens_applied_amount` in the `purchases` table as an informational field; it does **not** adjust `paid_amount` or `due_amount`.
- Supplier `current_balance` is incremented by `v_due_amount` (L226), where `v_due_amount` is the caller-provided value — independent of `v_tokens_amount`.

**Finding — Financial semantics ambiguity (UNRESOLVED):**  
The RPC does not reduce `due_amount` or `paid_amount` by the `tokens_applied_amount`. Whether token value should offset the payable or remain a separate ledger entry cannot be determined from repository evidence alone. The caller passes pre-computed values from the UI; the RPC trusts them. This may be intentional or may be a design gap.

> [!WARNING]
> **Unresolved business question (unanswered from prior sessions):** Should `tokens_applied_amount` reduce the supplier payable (`due_amount`) at the database level, or is the caller responsible for computing the correct `due_amount` before invoking the RPC? **Do not change this behaviour without explicit business owner confirmation.**

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
| `_04` forward: Supplier balance incremented by `v_due_amount` (caller-computed), not affected by `v_tokens_amount` | ✅ Consistent with caller contract |
| `_03` rollback: `DROP FUNCTION IF EXISTS` targets the correct JSONB overload signature | ✅ Correct |
| SECURITY DEFINER + `SET search_path = public, pg_temp` on all four routines | ✅ Confirmed |
| `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role` | ✅ Confirmed on all four routines |
| `usage_status = 'used'` constraint: allowed by `20261013_02` migration | ✅ Confirmed |

---

### 7.5 Files Changed in This Review

| File | Change |
|---|---|
| [`supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql) | Added `p_items` NULL/non-array guard (F-RV-01); added NULL-element and duplicate-token-ID guards in Step 2 (F-RV-02) |
| [`supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql`](file:///d:/bestow/p-industry/supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql) | Added `p_items` NULL/non-array guard (F-RV-01); added `ORDER BY id ASC` to token FOR UPDATE loop (F-RV-03) |

**No changes made to:**  
- `20261013_03_fix_create_voucher_atomic.sql` — no defects found  
- `rollback_20261013_03_fix_create_voucher_atomic.sql` — no defects found  
- Application code, schema, database records, or any other file

---

### 7.6 Outstanding Unresolved Questions

1. **Purchase financial semantics (Q-FIN-01):** Does `tokens_applied_amount` reduce the supplier `due_amount` at DB level, or is the caller responsible for computing correct `due_amount`? Requires business owner confirmation before any financial logic is modified.
2. **Live execution (Q-EXEC-01):** All corrections remain statically verified only. Runtime correctness, lock behavior, and concurrency safety require execution against a PostgreSQL 17.6 staging instance.

---
*End of SQL Migration Verification Report*
