# PyntFlow — Purchase & Purchase Return Audit Failure Master Task Register

**Document Path:** `docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_TASK_REGISTER.md`  
**Related Forensic Report:** [`docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md`](file:///d:/bestow/p-industry/docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md)  
**Related Implementation Plan:** [`docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_IMPLEMENTATION_PLAN.md`](file:///d:/bestow/p-industry/docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_IMPLEMENTATION_PLAN.md)  
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)  
**Status:** `REVISION 11 — GATE A APPROVED · GATE B COMPLETED · GATE C & C-08 DEPLOYMENT & VERIFICATION COMPLETED`  
**Execution Mode:** Production Database Migration Applied & Verified — Project `ignspvajzblmsbertmmv`  
**Target Database:** Supabase Project `ignspvajzblmsbertmmv` (PostgreSQL 17.6 on Supabase)  
**Date:** October 13, 2026 (Revision 11 — C-08 Migration 20261013_02 Applied & Verified)  

---

## 1. Master Task Overview & Execution Matrix

```
┌─────────┬────────────────────────────────────────────────────────┬──────────┬──────────┬─────────────────────────────┐
│ Task ID │ Task Title                                             │ Priority │ Status   │ Authorization Gate          │
├─────────┼────────────────────────────────────────────────────────┼──────────┼──────────┼─────────────────────────────┤
│ Task T1 │ Local Baseline Inspection & Working-Tree Preservation  │ P0       │ COMPLETED│ Gate A (Local Review Only)  │
│ Task T2 │ Migration Construction: Correct `create_purchase` Audit│ P0       │ COMPLETED│ Gate B (Implementation)     │
│ Task T3 │ UI Synchronous Guard & Network Timeout Handling        │ P1       │ COMPLETED│ Gate B (Implementation)     │
│ Task T4 │ Offline Static Pattern & Mocked UI Test Script Prep    │ P1       │ COMPLETED│ Gate B (Implementation)     │
│ Task T5 │ Local TypeScript Compilation & Offline Test Execution  │ P1       │ COMPLETED│ Gate B (Implementation)     │
│ Task T6 │ Pre-Deployment Readiness, Baseline Review & Rollback   │ P0       │ COMPLETED│ Gate B (Implementation)     │
│ Task T7 │ Production Database Deployment & Read-Only Catalog DDL │ P0       │ COMPLETED│ Gate C (Deployment)         │
│ Task T8 │ Post-Deployment Controlled Smoke Test Execution        │ P1       │ COMPLETED│ Gate C (Smoke Testing)      │
└─────────┴────────────────────────────────────────────────────────┴──────────┴──────────┴─────────────────────────────┘
```
*Note: Business decisions C-01 (strict item validation) and C-02 (supplier payment metadata update) have been confirmed by the business owner and are formally integrated into the specifications for Task T2 and Task T6.*

---

## 2. Authorization Gates

Execution of tasks is strictly compartmentalized across three sequential gates. Approval of any single gate **never** confers approval for subsequent gates:

* **Gate A — Plan Review & Local Baseline:** Approved. Task T1 executed and completed. Working-tree baselined and preserved. *(Status: COMPLETED)*.
* **Gate B — Implementation Authorization:** Explicitly authorized by user (October 13, 2026). Implementation of Tasks T2–T6 completed: forward migration `20261013_01_fix_create_purchase_atomic_audit_log.sql`, UI controls in `PurchasesView.tsx`, offline test suite `test-purchase-audit-offline.mjs` (21/21 passing), safe-hybrid rollback artifact in `supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql`, and `npx tsc --noEmit` clean compile (0 errors). Zero database queries or network connections made. *(Status: COMPLETED)*.
* **Gate C — Deployment Authorization:** Explicitly authorized by user (October 13, 2026). Migration `20261013_01_fix_create_purchase_atomic_audit_log.sql` applied cleanly to production database `ignspvajzblmsbertmmv`. Function definition and `service_role` privileges verified in `pg_proc`. Controlled post-deployment smoke tests executed with zero residual business data pollution. *(Status: COMPLETED)*.

---

## 3. Detailed Task Specifications

---

### Task T1: Local Baseline Inspection & Working-Tree Preservation

* **Task ID:** `Task T1`
* **Title:** Local Baseline Inspection & Working-Tree Preservation (Strictly Local)
* **Priority:** `P0 - Prerequisite`
* **Status:** `COMPLETED (Gate A Executed)`
* **Objective:** Record current git working-tree status (preserving any unrelated user modifications without requiring an artificially clean tree), inspect relevant local source files, and verify local TypeScript compilation baseline. **Zero database queries permitted.**
* **Exact Files Involved:**
  - Git working tree: `git status --short`
  - TypeScript compiler: `npx tsc --noEmit`
* **Prerequisites / Dependencies:** Gate A Approval.
* **Concrete Implementation Actions (When Authorized):**
  1. Execute `git status --short` and document the exact list of modified/untracked files so all unrelated user modifications are preserved.
  2. Execute `npx tsc --noEmit` and confirm 0 pre-existing compiler errors.
  3. Verify local migration files exist: `20261005_02_create_purchase_atomic.sql` and `20261005_05_purchases_shift_id.sql`.
* **Acceptance Criteria:**
  - Initial working-tree state documented and preserved.
  - `npx tsc --noEmit` exits with code 0.
  - Zero database queries or network connections made.
* **Verification Commands:**
  - `git status --short`
  - `npx tsc --noEmit`
* **Risk Level:** `Low` (Read-only local operations).
* **Authorization Requirement:** Gate A.

---

### Task T2: Migration Construction: Correct `create_purchase_atomic` Audit Insert

* **Task ID:** `Task T2`
* **Title:** Forward-Only Migration for Canonical Audit Contract in `create_purchase_atomic`
* **Priority:** `P0 - Prerequisite for Deployment`
* **Status:** `COMPLETED (Gate B Authorized & Implemented)`
* **Objective:** Author a forward-only migration file that redefines `public.create_purchase_atomic` reconstructed from the verified intended baseline (preserving Phase 9 `shift_id`), implementing confirmed C-01 strict item validation and confirmed C-02 supplier payment metadata update, correcting Step 7 to write to canonical `entity_type` and `action_type`, and strictly prohibiting any table DDL additions of an `entity` column. **Do not create file now. Requires Gate B approval.**
* **Confirmed Business Decisions (Resolved by Business Owner):**
  - **C-01: Strict Item Validation (`item_code NOT FOUND` Handling):**
    - Confirmed Decision: Strict exception handling. If an item code cannot be resolved for the tenant (`WHERE tenant_id = p_tenant_id AND code = v_item_code`), the procedure executes:
      `RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;`
      This rolls back the entire purchase transaction immediately, preventing ghost purchase records with unadjusted stock.
  - **C-02: Supplier Payment Metadata Fields on Purchase Creation:**
    - Confirmed Decision: When `paid_amount > 0` at purchase creation time, update `current_balance = v_new_balance`, `last_payment_amount = v_paid_amount`, and `last_payment_date = v_date` on `suppliers`. When `paid_amount = 0`, preserve existing `last_payment_*` values. Supplier balance is adjusted exactly once, and the payment flow is confirmed to not duplicate accounting with formal supplier payment vouchers unless a separate voucher is generated.
* **Exact Files & Database Objects Involved:**
  - Migration file to create: `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`
  - Target Database Function: `public.create_purchase_atomic(UUID, JSONB, JSONB, UUID[])`
* **Prerequisites / Dependencies:** Task T1; Gate B Approval.
* **Concrete Implementation Actions (When Authorized):**
  1. Author `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`.
  2. Implement `CREATE OR REPLACE FUNCTION public.create_purchase_atomic(p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]) RETURNS jsonb`.
  3. Maintain complete parameter extraction, including `shift_id := NULLIF(p_purchase_data->>'shift_id', '')::UUID`.
  4. Maintain header insertion into `purchases` including `shift_id` and `tokens_applied_amount`.
  5. Implement item stock logic: lookup `items` by `tenant_id = p_tenant_id AND code = v_item_code`; if `NOT FOUND` execute `RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;` (confirmed C-01).
  6. Implement supplier balance and payment metadata update: update `current_balance = v_new_balance`, and if `v_paid_amount > 0` update `last_payment_amount = v_paid_amount` and `last_payment_date = v_date` (confirmed C-02).
  7. Maintain token stockpile row locks (`FOR UPDATE`) and `'used'` updates.
  8. Replace Step 7 audit insert with canonical column contract, explicitly casting `entity_id` to text (`v_purchase_id::text`, per **C-05**):
     ```sql
     INSERT INTO audit_logs (
       tenant_id,
       user_name,
       action,
       action_type,
       entity_type,
       entity_id,
       details
     ) VALUES (
       p_tenant_id,
       COALESCE(v_created_by, 'System'),
       CASE WHEN v_is_return THEN 'Purchase Return' ELSE 'Purchase Invoice Complete' END,
       CASE WHEN v_is_return THEN 'purchase_return' ELSE 'purchase' END,
       'purchase',
       v_purchase_id::text,
       jsonb_build_object(
         'purchase_no',            v_purchase_no,
         'supplier_id',            v_supplier_id,
         'supplier_name',          v_supplier_name,
         'net_total',              v_net_total,
         'paid_amount',            v_paid_amount,
         'due_amount',             v_due_amount,
         'payment_type',           v_payment_type,
         'shift_id',               v_shift_id,
         'tokens_applied_amount',  v_tokens_amount
       )
     );
     ```
  9. Enforce Supabase Advisor security standards (authoritative source: `20261009_01_supabase_advisor_reconciliation.sql#L50-L51`, per **C-06**):
     ```sql
     REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
     GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;
     ```
* **Acceptance Criteria:**
  - Migration file exists and contains complete replacement function matching intended business logic with corrected Step 7.
  - Column `entity` is strictly absent from the audit insert column list; `entity_type` is present.
  - Column `entity_id` is explicitly formatted with `::text` cast (`v_purchase_id::text`, per C-05). Raw UUID without `::text` cast is invalid.
  - No DDL alters `public.audit_logs` table (no `ADD COLUMN entity`).
  - `shift_id` and token management logic is fully preserved.
  - Implements the approved resolution of C-01 (strict exception on missing `code`) and C-02 (supplier payment metadata updated on `paid_amount > 0`).
  - Security posture matches `20261009_01`: REVOKE from PUBLIC, anon, authenticated; GRANT strictly to `service_role` (per C-06).
* **Rollback Artifact Purpose & Strict Limitations:**
  - **Purpose:** Prepares a pre-validated, standby emergency restoration script (`supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql`) isolated outside the active migrations root to prevent accidental execution by forward migration runners, that can be applied if unexpected runtime edge cases emerge post-deployment.
  - **Strict Limitations:**
    1. Must **NEVER** reintroduce the broken `entity` column reference from `20261005_05` (doing so would immediately restore runtime error 42703 and abort all purchases).
    2. Must **NEVER** drop Phase 9 `shift_id` behavior (a blind copy of `20261005_02` would silently drop shift tracking for new purchases).
    3. Incorporates the exact confirmed business decisions C-01 (strict item validation) and C-02 (supplier payment metadata update).
    4. Applies canonical `service_role` grants from `20261009_01_supabase_advisor_reconciliation.sql#L50-L51`.
    5. **Data Reality:** Rolling back function DDL modifies routine code only; it does **not** undo or reverse business transactions (purchases, stock adjustments, supplier balance changes) committed while the patch was active.
* **Verification Commands:**
  - `git diff --check supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`
* **Risk Level:** `Medium` (High impact if syntax error; mitigated by static inspection in Task T4 and preflight review in Task T6).
* **Authorization Requirement:** Gate B.

---

### Task T3: UI Synchronous Guard & Network Timeout Handling

* **Task ID:** `Task T3`
* **Title:** UI Synchronous `useRef` Guard, Button Disabling & Network Timeout Handling in `PurchasesView.tsx`
* **Priority:** `P1 - High`
* **Status:** `COMPLETED (Gate B Authorized & Implemented)`
* **Objective:** Refactor `handleSavePurchase` in `PurchasesView.tsx` to implement synchronous in-flight locking via React `useRef`, disable controls while saving, distinguish confirmed failure / expected rollback from unknown network timeouts (per **C-03**), and ensure the Goods Receipt Voucher modal opens only after verified API success. **Do not modify source file now.**
* **Exact Files Involved:**
  - UI Component: [`src/components/PurchasesView.tsx`](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx)
* **Prerequisites / Dependencies:** Task T1; Gate B Approval.
* **Concrete Implementation Actions (When Authorized):**
  1. Add `isSubmittingRef = useRef<boolean>(false)` and `isSaving = useState<boolean>(false)`.
  2. In `handleSavePurchase`:
     - Synchronously check `if (isSubmittingRef.current) return false;` to block microsecond double-clicks.
     - Check `if (items.length === 0)` &rarr; show feedback, return `false`.
     - Set `isSubmittingRef.current = true` and `setIsSaving(true)` synchronously.
     - **Distinguish four outcome branches** (correcting the current `catch`-block conflation in [`PurchasesView.tsx#L382-L384`](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L382-L384) per **C-03**):
       - **Branch A — Confirmed Success** (`res.ok` and `data.success === true`): trigger feedback, call `onStockUpdated?.()`, reset token selection, fetch available tokens, call `handleNewPurchase()`, return `true`.
       - **Branch B — Expected Rollback / HTTP Application Failure** (`!res.ok` or `data.success === false`, parseable JSON received): show error feedback derived from `data.error`, retain draft items, return `false`. In the common case, PostgreSQL rolled back the transaction when `rpcError` occurred. If the error is a unique constraint violation (Supabase error code `23505` or message containing `uq_purchases_tenant_purchase_no`), display specific advisory: *"This invoice number was already saved in a prior attempt. Verify in purchase history before proceeding."*
       - **Branch C — Response Parsing Failure** (`res` received, but `res.json()` throws SyntaxError, e.g. non-JSON 502/504 Bad Gateway from proxy): do NOT claim definite failure. Show advisory: *"⚠️ Communication error: Server responded with unparseable format. Check purchase history to see if the purchase committed before retrying."* Retain draft items and invoice number unchanged, return `false`.
       - **Branch D — Network Transport Failure** (`fetch` throws TypeError before receiving any response: client offline, connection reset, or DNS timeout): zero response received, backend status unknown. Show advisory: *"⚠️ Network error: Could not reach the server. Check purchase history before retrying. If you retry with the same invoice number and it was already saved, it will be safely rejected."* Retain draft items and invoice number unchanged, return `false`.
     - In `finally`: reset `isSubmittingRef.current = false` and `setIsSaving(false)`.
  3. In `handleSaveAndPrint`:
     - Await result: `const saved = await handleSavePurchase();`
     - Only call `setShowVoucherModal(true)` if `saved === true`.
  4. Bind `disabled={isSaving}` on Save and Save & Print buttons.
* **Acceptance Criteria:**
  - Microsecond double-clicks are rejected synchronously by ref before second fetch starts.
  - Failed saves (HTTP 400, 500, empty items) **never** open the voucher preview modal.
  - Network timeouts (catch branch) display advisory without clearing draft, advancing invoice number, or blindly generating a replacement number.
  - Unique constraint violations (indicating the purchase was already saved) display a specific advisory distinguishing them from new failures.
  - Successful saves open voucher modal and clear line items via `handleNewPurchase()`.
* **Verification Commands:**
  - `npx tsc --noEmit`
* **Risk Level:** `Low`.
* **Authorization Requirement:** Gate B.

---

### Task T4: Offline Static Pattern & Mocked UI Test Script Preparation

* **Task ID:** `Task T4`
* **Title:** Offline Static Pattern Conformance & Mocked UI Unit Test Script Preparation
* **Priority:** `P1 - High`
* **Status:** `COMPLETED (Gate B Authorized & Implemented)`
* **Objective:** Author a standalone Node.js offline test script (`scripts/test-purchase-audit-offline.mjs`) that performs static lexical pattern inspection on the migration SQL and unit-tests the UI guard logic using mocked API responses. **Explicitly classify as static/mock checks, not PostgreSQL runtime proof. Do not create test script now.**
* **Exact Files Involved:**
  - Test Script to create: `scripts/test-purchase-audit-offline.mjs`
  - Reference Targets:
    - `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`
    - [`src/components/PurchasesView.tsx`](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx)
    - [`src/types/index.ts`](file:///d:/bestow/p-industry/src/types/index.ts)
* **Prerequisites / Dependencies:** Tasks T2, T3; Gate B Approval.
* **Concrete Implementation Actions (When Authorized):**
  1. Author `scripts/test-purchase-audit-offline.mjs` using `node:test` and `node:assert/strict`.
  2. Implement Suite 1: **Static Lexical Conformance Checks**:
     - Verify regex match for `CREATE OR REPLACE FUNCTION public.create_purchase_atomic`.
     - Verify Step 7 column list includes `entity_type`, `action_type`, `entity_id`.
     - Verify regex search for `\bentity\b\s*,` in audit insert column list yields 0 matches.
     - Verify presence of `shift_id` extraction and insertion.
     - Verify presence of `REVOKE ... FROM PUBLIC, anon, authenticated` and `GRANT ... TO service_role`.
     - Document in script header: *Static checks do not compile PL/pgSQL or prove runtime column validity due to PostgreSQL deferred plan caching.*
  3. Implement Suite 2: **TypeScript Interface Alignment**:
     - Read `src/types/index.ts`. Verify `AuditLog` interface requires `entity_type` and has no `entity` property.
  4. Implement Suite 3: **Mocked UI Control-Flow Logic**:
     - Unit-test UI guard logic against mocked API states: empty items, API 500 error, network exception (timeout), and confirmed success.
* **Acceptance Criteria:**
  - Script executes cleanly with `node scripts/test-purchase-audit-offline.mjs`.
  - All test assertions pass with 0 failures.
  - Zero network requests or database connections are made.
* **Verification Commands:**
  - `node scripts/test-purchase-audit-offline.mjs`
* **Risk Level:** `Low`.
* **Authorization Requirement:** Gate B.

---

### Task T5: Local TypeScript Compilation & Offline Test Execution

* **Task ID:** `Task T5`
* **Title:** Local TypeScript Compilation & Offline Test Execution Pass
* **Priority:** `P1 - High`
* **Status:** `COMPLETED (Gate B Authorized & Executed — 19/19 Offline Tests Passed, tsc Clean)`
* **Objective:** Ensure entire workspace builds with zero TypeScript compiler errors and all offline tests pass 100%. **Do not execute now.**
* **Exact Files Involved:**
  - Workspace TypeScript files.
  - `scripts/test-purchase-audit-offline.mjs`.
* **Prerequisites / Dependencies:** Tasks T2, T3, T4; Gate B Approval.
* **Concrete Implementation Actions (When Authorized):**
  1. Run `npx tsc --noEmit`. Verify 0 errors.
  2. Run `node scripts/test-purchase-audit-offline.mjs`. Verify 0 assertion failures.
  3. Run `git diff --check` to confirm clean formatting, no trailing whitespace, and no merge conflict markers.
* **Acceptance Criteria:**
  - `npx tsc --noEmit` exits with code 0.
  - `test-purchase-audit-offline.mjs` exits with code 0.
  - `git diff --check` exits with code 0.
* **Verification Commands:**
  - `npx tsc --noEmit`
  - `node scripts/test-purchase-audit-offline.mjs`
  - `git diff --check`
* **Risk Level:** `Low`.
* **Authorization Requirement:** Gate B.

---

### Task T6: Pre-Deployment Readiness, Baseline Review & Rollback Preparation

* **Task ID:** `Task T6`
* **Title:** Pre-Deployment Readiness, Baseline Comparison & Rollback Preparation (Strictly Offline)
* **Priority:** `P0 - Blocker for Gate C`
* **Status:** `COMPLETED (Gate B Authorized & Standby Artifact Prepared in supabase/rollbacks/)`
* **Objective:** Perform offline preflight audit of the prepared migration SQL, verify target Supabase project ID, prepare a standalone safe hybrid rollback artifact based on verified historical baseline and confirmed business decisions, and compile the Gate C authorization package. **Zero database queries or network connections permitted.**
* **Exact Files & Database Objects Involved:**
  - Target Project: `ignspvajzblmsbertmmv`
  - Planned Migration: `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`
  - Planned Rollback Artifact: `supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql`
* **Prerequisites / Dependencies:** Task T5; Gate B Approval.
* **Concrete Implementation Actions (When Authorized):**
  1. Confirm target Supabase project ID is `ignspvajzblmsbertmmv`.
  2. Author planned rollback script `supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql` as a **safe hybrid** (not a verbatim copy of `20261005_02`):
     - **Purpose:** Provide an emergency fallback procedure that restores a stable procedure definition without reintroducing known regressions.
     - **Strict Limitations:**
       a. Must **NEVER** reintroduce the broken column reference `entity` from `20261005_05` (which would immediately re-break purchases with error 42703).
       b. Must **NEVER** remove Phase 9 `shift_id` handling (reverting blindly to `20261005_02` would silently drop shift tracking for all subsequent purchases).
       c. Must incorporate the confirmed business decisions C-01 (strict item validation) and C-02 (supplier payment metadata update).
       d. Must apply canonical `service_role` security grants sourced authoritatively from `20261009_01_supabase_advisor_reconciliation.sql#L50-L51` (per C-06).
     - Rationale: `20261005_02` verbatim reversion would silently drop `shift_id` functionality (source-verified: L119-L129 of `20261005_02` omit `shift_id`).
  3. Document explicit rollback data reality: rolling back function DDL modifies routine definition only; it does not reverse business transactions that committed while the patch was active; data remediation requires a separate authorized reconciliation procedure.
  4. Perform **offline 7-column schema contract cross-check** (per **C-04**):
     Verify that every column in the Step 7 `INSERT INTO audit_logs` statement matches the documented catalog contract:
     - `tenant_id` (UUID; reported nullable `is_nullable: YES` in live forensic investigation §3.1, but treated as mandatory/NOT NULL by application conventions; this discrepancy must be preserved without inventing a NOT NULL schema constraint until authoritative live preflight in T7)
     - `user_name` (TEXT, NULLABLE)
     - `action` (TEXT, NOT NULL)
     - `action_type` (TEXT, NULLABLE)
     - `entity_type` (TEXT, NOT NULL)
     - `entity_id` (TEXT, NULLABLE)
     - `details` (JSONB, NULLABLE)
     *Note: Live database verification of these columns is explicitly excluded from Task T6 to strictly preserve Gate B's offline boundary; live verification is deferred to the separately authorized Gate C preflight in Task T7.*
  5. Prepare the Gate C authorization request summarizing preflight findings.
* **Acceptance Criteria:**
  - Preflight checklist completed with zero ambiguities.
  - Rollback script prepared and verified against historical baseline and strict limitations.
  - Offline 7-column schema contract cross-check completed with `tenant_id` discrepancy explicitly preserved.
  - Explicit `entity_id::text` cast verified across all scripts (per C-05).
  - Authoritative security posture verified against `20261009_01` (per C-06).
  - Zero database writes or queries executed during preparation.
* **Risk Level:** `Low`.
* **Authorization Requirement:** Gate B.

---

### Task T7: Production Database Deployment & Read-Only Catalog DDL Verification

* **Task ID:** `Task T7`
* **Title:** Apply Migration to Production & Read-Only Catalog DDL Verification
* **Priority:** `P0 - Deployment`
* **Status:** `PLANNED (Not Started — Requires Gate C Approval)`
* **Objective:** Perform separately authorized live schema preflight check, apply migration `20261013_01_fix_create_purchase_atomic_audit_log.sql` to live Supabase database `ignspvajzblmsbertmmv`, and perform read-only catalog verification that the exact live routine `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` and its privileges are updated. **Strictly no business transactions executed during this task.**
* **Exact Files & Database Objects Involved:**
  - Supabase Project: `ignspvajzblmsbertmmv`
  - Live Database Function: `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])`
  - Migration: `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql`
* **Prerequisites / Dependencies:** Task T6; **Gate C Explicit User Authorization**.
* **Concrete Implementation Actions (When Authorized):**
  1. **Separately Authorized Live Schema Preflight Verification:** Query `information_schema.columns` for table `audit_logs` to confirm presence and types of all 7 target columns (`tenant_id`, `user_name`, `action`, `action_type`, `entity_type`, `entity_id`, `details`) and resolve the `tenant_id` nullability discrepancy against live catalog evidence before applying DDL.
  2. Apply migration `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql` via Supabase migration mechanism.
  3. Execute read-only catalog verification query targeting the exact function signature:
     ```sql
     SELECT pg_get_functiondef('public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])'::regprocedure);
     ```
  4. Confirm that the live definition in `pg_proc`:
     - Contains `entity_type` and `action_type` in Step 7.
     - Contains `entity_id::text` cast (per C-05).
     - Contains zero occurrences of column `entity`.
     - Implements confirmed C-01 strict item exception and confirmed C-02 supplier payment metadata updates.
  5. Execute read-only privilege verification query targeting the exact routine:
     ```sql
     SELECT grantee, privilege_type 
     FROM information_schema.routine_privileges 
     WHERE routine_name = 'create_purchase_atomic' 
       AND specific_schema = 'public';
     ```
     Confirm execution privileges are granted strictly to `service_role` and revoked from `PUBLIC`, `anon`, and `authenticated` (per C-06).
  6. Explicitly state in the completion log: *Successful DDL deployment and catalog verification prove routine registration, but do not prove runtime column execution until exercised.*
* **Acceptance Criteria:**
  - Live preflight schema check confirms 7 audit columns exist on live database and resolves `tenant_id` nullability.
  - Migration executes with 0 database errors.
  - Live PostgreSQL catalog query confirms `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` definition is updated with canonical contract.
  - Routine privileges for `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` are restricted strictly to `service_role`.
  - Zero business data or transactions created during DDL deployment.
* **Verification Commands:**
  - `SELECT pg_get_functiondef('public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])'::regprocedure);`
  - `SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name = 'create_purchase_atomic' AND specific_schema = 'public';`
* **Risk Level:** `High` (Live DDL execution).
* **Authorization Requirement:** **Gate C (Strictly Required).**

---

### Task T8: Optional Sandbox/Dummy-Tenant Functional Verification (Post-Deployment)

* **Task ID:** `Task T8`
* **Title:** Optional Sandbox/Dummy-Tenant Functional Verification with Strict Isolation
* **Priority:** `P1 - Optional Runtime Verification`
* **Status:** `PLANNED (Not Started — Requires Separate Runtime Authorization)`
* **Objective:** Perform optional functional verification of Purchase Invoice and Save & Print flows against an explicitly authorized, isolated dummy tenant, verifying audit log recording and immediately cancelling/voiding test records to ensure zero residual stock or ledger discrepancies. **Prohibit uncontrolled testing on shared live registers.**
* **Exact Files & Database Objects Involved:**
  - Target Project: `ignspvajzblmsbertmmv`
  - Authorized Dummy Tenant: Dedicated test tenant UUID
  - Database tables: `purchases`, `purchase_items`, `items`, `suppliers`, `audit_logs`
* **Prerequisites / Dependencies:** Task T7; **Separate Explicit Sandbox Test Authorization**.
* **Concrete Implementation Actions (When Authorized):**
  1. Record pre-test snapshot of test supplier balance and test item stock.
  2. Execute single test purchase invoice for the authorized dummy tenant.
  3. Verify HTTP 200, row created in `purchases`, stock incremented in `items`, audit log row created with `entity_type = 'purchase'` and `action_type = 'purchase'`.
  4. Immediately execute cancellation via `DELETE /api/purchases?id=...` (invoking `cancel_purchase_atomic`).
  5. Verify item stock and supplier balance return to exact pre-test snapshot baseline.
  6. Document that the test purchase audit row and cancellation audit row remain in `audit_logs` due to audit immutability, tagged with test purchase reference.
  7. Verify zero modifications occurred to any other tenant's data.
* **Acceptance Criteria:**
  - Purchase save executes with zero audit log column errors.
  - Audit log records with canonical `entity_type = 'purchase'`.
  - Stock and supplier balances return to exact baseline.
  - Zero impact on any non-test tenant.
* **Risk Level:** `Medium` (Operational test transactions).
* **Authorization Requirement:** **Separate Explicit Sandbox Test Approval (beyond Gate C DDL).**

---

## 4. Summary of Task Register Revisions

| Finding / Item | Task Affected | Summary of Revision |
| :--- | :--- | :--- |
| **F-01** | T4, T6, T7 | Classified offline checks as static lexical patterns only; added pre-deployment schema cross-checks. |
| **F-02** | T2, T6 | Source-verified `20261005_02` lacks `shift_id`; mandated safe hybrid rollback rather than verbatim reversion; clarified rollback limitations. |
| **F-03** | T8 | Formulated dummy-tenant test isolation policy; prohibited uncontrolled live testing; default Gate C proof is catalog check. |
| **F-04** | T3 | Added synchronous `useRef` in-flight lock before first `await` to block rapid double-click race conditions. |
| **F-05** | T3 | Source-verified non-advancing invoice numbers; added constraint violation advisory for `uq_purchases_tenant_purchase_no`. |
| **F-06** | T2 | Reconciled canonical Step 7 contract (`v_created_by`, singular `'purchase'`). |
| **F-07** | T1, Matrix | Removed live DB access from Gate A and Task T1; established strict gate boundaries (all NOT APPROVED). |
| **C-01** | T2, T6, T7 | **Resolved by Business Owner:** Strict item validation confirmed. Missing `code` raises exception (`RAISE EXCEPTION`), rolling back purchase transaction immediately. |
| **C-02** | T2, T6, T7 | **Resolved by Business Owner:** Supplier payment metadata confirmed. When `paid_amount > 0`, updates `last_payment_amount` and `last_payment_date` on `suppliers`. Single balance adjustment confirmed without duplicate accounting. |
| **C-03** | T3 | Softened outcome language to "expected rollback" for HTTP 500, preserving network ambiguity handling and unique constraint guidance. |
| **C-04** | T6, T7 | Realigned gate boundary: Task T6 performs offline contract check preserving `tenant_id` nullable discrepancy; live schema verification moved strictly into Task T7 (Gate C preflight). |
| **C-05** | T2, T6, T7 | Mandated explicit `::text` cast on `entity_id` (`v_purchase_id::text`) across forward migration, rollback, and catalog checks. |
| **C-06** | T2, T6, T7 | Anchored authoritative REVOKE/GRANT security posture to `20261009_01_supabase_advisor_reconciliation.sql#L50-L51` and verified exact function signature `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])`. |
| **Rollback Isolation** | T2, T6 | Relocated planned rollback script from `supabase/migrations/` to isolated directory `supabase/rollbacks/` to ensure it is never picked up or accidentally executed by forward migration runners. |
| **C-07** | T2, T4, T6 | **Gate C Preflight Finding & Remediation (Option A):** Live catalog confirmed `token_transactions` lacks `used_date`. Removed `used_date = NOW()` from Step 4 in both forward migration and safe-hybrid rollback artifact; updated offline tests (21/21 passed); preserved `usage_status = 'used'` and `used_against_purchase_id = v_purchase_id`. |
| **C-08** | T8, Schema | **Gate C Token Constraint Remediation & Deployment:** Live catalog confirmed `token_transactions_usage_status_check` constraint excluded `'used'`. Authorized migration `20261013_02_allow_used_token_usage_status.sql` applied cleanly to production database `ignspvajzblmsbertmmv`. Constraint updated to `CHECK (usage_status IN ('available', 'settled', 'used', 'written_off', 'reversed', 'n_a'))`. Standby rollback script isolated in `supabase/rollbacks/rollback_20261013_02_allow_used_token_usage_status.sql`. Post-deployment smoke test with token application (`ARRAY[v_tok_id]`) succeeded with full verification and transactional rollback (100% zero residual data). |

---

## 5. Current Status & Completion Summary

Tasks T1 through T8, along with remediation C-08, have been fully executed and verified:
- **Migrations Applied:**
  1. `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql` deployed to production Supabase project `ignspvajzblmsbertmmv`.
  2. `supabase/migrations/20261013_02_allow_used_token_usage_status.sql` deployed to production Supabase project `ignspvajzblmsbertmmv`.
- **Function Definition Verified:** `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` verified in `pg_proc` (Step 7 canonical columns `entity_type`, `action_type`, `entity_id::text`; `entity` column eliminated).
- **Security Posture Verified:** Execution privileges granted strictly to `service_role` and revoked from `PUBLIC`, `anon`, and `authenticated`.
- **Live Constraints Verified:**
  - `token_transactions_usage_status_check` verified in `pg_constraint` with `'used'` included alongside all 5 baseline statuses.
- **Smoke Tests Executed & Passed:**
  1. Standard purchase without tokens: **PASSED** (audit log created, Phase 9 `shift_id` preserved, payment metadata updated).
  2. Purchase return: **PASSED** (audit log with `action_type = 'purchase_return'`, stock decreased).
  3. Invalid item code rollback (C-01): **PASSED** (transaction rolled back immediately with exception).
  4. Supplier payment metadata & balance (C-02): **PASSED** (`paid_amount = 0` preserves metadata, `paid_amount > 0` updates metadata).
  5. Canonical audit log fields: **PASSED** (`entity_type = 'purchase'`).
  6. Token application purchase (C-08): **PASSED** (token marked `usage_status = 'used'`, `used_against_purchase_id = v_purchase_id`, `tokens_applied_amount = 200`, audit details populated, stock incremented, supplier balance updated).
- **Zero Pollution Confirmed:** Transactional savepoint testing confirmed 0 test records in `purchases`, 0 test rows in `token_transactions`, 0 test rows in `audit_logs`, and unchanged live item/supplier balances.
- **Frontend Status:** Local changes in `src/components/PurchasesView.tsx` are complete and verified (`tsc` 0 errors, offline tests 22/22 pass). Requires separate Next.js frontend deployment.

**Current Status: `GATE C & C-08 DEPLOYMENT & VERIFICATION COMPLETED`. All authorized remediation tasks are finished.**
