# PyntFlow — Purchase & Purchase Return Audit Failure Implementation Plan

**Document Path:** `docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_IMPLEMENTATION_PLAN.md`  
**Related Forensic Report:** [`docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md`](file:///d:/bestow/p-industry/docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md)  
**Related Task Register:** [`docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_TASK_REGISTER.md`](file:///d:/bestow/p-industry/docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_TASK_REGISTER.md)  
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)  
**Status:** `REVISION 10 — GATE A APPROVED · GATE B COMPLETED · GATE C DEPLOYMENT & SMOKE TESTS COMPLETED`  
**Execution Mode:** Production Database Migration Applied & Verified — Project `ignspvajzblmsbertmmv`  
**Target Database:** Supabase Project `ignspvajzblmsbertmmv` (PostgreSQL 17.6 on Supabase)  
**Date:** October 13, 2026 (Revision 10 — Gate C Applied & Smoke Tests Executed)  

---

## 1. Problem Statement & Operational Context

In PyntFlow POS & Industrial ERP, when an operator enters line items in the **Purchase Invoice** or **Purchase Return** screen ([src/components/PurchasesView.tsx](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx)) and clicks either **Save (F2)** or **SAVE & PRINT (F5)**, the database transaction fails immediately with:

```
Error: column "entity" of relation "audit_logs" does not exist
```

### User-Visible Symptoms:
1. **Red Error Toast:** The screen displays `❌ Error: column "entity" of relation "audit_logs" does not exist`.
2. **Premature Voucher Preview:** In the "Save & Print" flow, the Goods Receipt Voucher modal opens on screen despite the transaction having failed and rolled back.
3. **Form Retention:** Draft line items remain on screen without clearing (because form reset `handleNewPurchase()` is gated on `data.success === true`).
4. **Complete Rollback:** No purchase invoice or return is created, inventory stock is not adjusted, and supplier balances remain unchanged.
5. **AI Scanner Blocked:** When capturing vendor invoices via [src/components/AiInvoiceScan.tsx](file:///d:/bestow/p-industry/src/components/AiInvoiceScan.tsx), clicking "Confirm & Save Purchase (GRN)" fails with the same error.

### Operational Context & Environment Reality:
- According to the system owner's current understanding, the active Supabase project (`ignspvajzblmsbertmmv`) currently hosts development and dummy shops only, and no real external production shops have yet onboarded.
- However, this operational context **must not** be treated as a license for uncontrolled testing or disposable data mutation. Strict tenant isolation, audit immutability, and controlled test data policies remain mandatory.

---

## 2. Evidentiary Taxonomy & Root-Cause Analysis

All technical findings in this plan are classified according to strict evidentiary boundaries:
- `[REPORTED-INVESTIGATION]`: Technical finding reported by the prior forensic investigation report ([PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md](file:///d:/bestow/p-industry/docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md)).
- `[SRC-VERIFIED]`: Verified directly from local repository source files and migration history during this task.
- `[FUTURE-REQUIREMENT]`: Pre-implementation or pre-deployment validation requirement that remains incomplete and requires separate authorization.

### Summary of Reconciled Findings:
1. **[REPORTED-INVESTIGATION] Stored Procedure Defect:**
   The live PostgreSQL function `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` in database `ignspvajzblmsbertmmv` executes an invalid audit insert at Step 7:
   ```sql
   INSERT INTO audit_logs (
     tenant_id, action, entity, entity_id, details, user_name
   ) VALUES ( ... );
   ```
2. **[REPORTED-INVESTIGATION] Missing Database Column:**
   `public.audit_logs` has **never** possessed a column named `entity`. The actual schema column is `entity_type TEXT NOT NULL`.
3. **[SRC-VERIFIED] Latent Bug Mechanism — Deferred PL/pgSQL Plan Caching (F-01):**
   - In PostgreSQL, executing `CREATE OR REPLACE FUNCTION` parses the outer PL/pgSQL function syntax, but **does not bind or validate the column names of embedded SQL statements at DDL execution time**.
   - PL/pgSQL compiles SPI execution plans for embedded statements on **first runtime execution**.
   - Consequently, migration `20261005_05_purchases_shift_id.sql` applied cleanly with zero errors despite containing an invalid column name.
   - **Crucial Rule:** Successful migration execution or read-only `pg_proc` catalog inspection does **not** prove that embedded SQL queries have valid column references.
4. **[SRC-VERIFIED] Regression Origin:**
   - In [`supabase/migrations/20261005_02_create_purchase_atomic.sql#L222-L230`](file:///d:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql#L222-L230), the Phase 7 audit statement used correct `entity_type` and `action_type` columns.
   - In [`supabase/migrations/20261005_05_purchases_shift_id.sql#L207-L227`](file:///d:/bestow/p-industry/supabase/migrations/20261005_05_purchases_shift_id.sql#L207-L227) (Phase 9), Step 7 was rewritten with `entity` (invalid) instead of `entity_type`, and `action_type` was omitted.
5. **[SRC-VERIFIED] Rollback Baseline Divergence and Confirmed Behavioral Decisions (F-02 / C-01 / C-02):**
   - `20261005_02_create_purchase_atomic.sql` (Phase 7) does **not** include `shift_id` in the `DECLARE` block, the header extraction, or the `purchases` INSERT statement ([L119-L129](file:///d:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql#L119-L129)).
   - Therefore **restoring `20261005_02` verbatim as a rollback would silently drop Phase 9 `shift_id` functionality**.
   - The rollback artifact must be a **safe hybrid** retaining Phase 9 `shift_id` elements with a corrected Step 7 audit contract.
   - Confirmed business decisions C-01 (strict item exception) and C-02 (supplier payment metadata update) have been resolved by the business owner and are incorporated into both the forward migration and the safe hybrid rollback baseline.
6. **[SRC-VERIFIED] UI Control-Flow Defect:**
   In [`src/components/PurchasesView.tsx#L387-L394`](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L387-L394), `handleSaveAndPrint()` unconditionally calls `setShowVoucherModal(true)` without evaluating whether `handleSavePurchase()` succeeded.
7. **[SRC-VERIFIED] Invoice Number Generation and Retry Safety:**
   - `generatePurchaseInvoiceNo()` ([L89-L94](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L89-L94)) generates a date-prefixed string with 4 random hex digits (e.g. `P-INV-20261013-3A7F`). It is called once at component mount and again inside `handleNewPurchase()`.
   - `handleNewPurchase()` is called **only** on `data.success === true` ([L378](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L378)). On any failure or network error, the invoice number is **not advanced** and the draft is retained — which is correct.
   - However, the current `catch` block ([L382-L384](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L382-L384)) does not distinguish between a network exception (unknown outcome) and an application error (confirmed failure); both display `❌ Network error: ...`.
   - The unique constraint `uq_purchases_tenant_purchase_no UNIQUE (tenant_id, purchase_no)` ([`20260924_02_business_constraints.sql#L14`](file:///d:/bestow/p-industry/supabase/migrations/20260924_02_business_constraints.sql#L14)) scoped to `(tenant_id, purchase_no)` ensures that if a purchase with the same invoice number was already committed, a retry request will be safely rejected with a constraint violation error (Supabase returns HTTP 409 or 500 with a unique violation message). The user must be informed of this behavior — it protects against duplication but the error message must not be confused with a system failure.
8. **[SRC-VERIFIED] System-Wide Convention:**
   All other stored procedures in the repository writing to `audit_logs` use `entity_type` and `action_type`.

---

## 3. Scope, Rigid Boundaries & Explicit Non-Goals

### In-Scope:
- **Reconstruction of `create_purchase_atomic`:** Prepare a forward-only migration based on the intended procedure specification (incorporating Phase 9 `shift_id`), implementing confirmed C-01 strict item validation and confirmed C-02 supplier payment metadata update, and correcting Step 7 to write to canonical `entity_type` and `action_type`.
- **UI Control-Flow & Concurrency Hardening:** Refactor `handleSavePurchase()` in `PurchasesView.tsx` to return an explicit `Promise<boolean>` success status, implement synchronous double-submission locking via React `useRef`, guard `setShowVoucherModal(true)` on confirmed success, and handle unknown network outcomes.
- **Offline Static Pattern Conformance Checks:** Create an offline test script in `scripts/test-purchase-audit-offline.mjs` verifying pattern rules and mocked UI control flow.
- **Pre-Deployment Readiness & Recovery Planning:** Define pre-deployment schema cross-checks and a verified rollback procedure.

### Explicit Non-Goals & Prohibitions:
- **Strictly Prohibited Table DDL Changes:** Do NOT add an `entity` column to `public.audit_logs`. The table schema is correct; adding an alias column would corrupt the unified audit logging architecture.
- **No Blind Reversion to Historical Migrations:** Do NOT blindly reapply `20261005_02_create_purchase_atomic.sql`, as that would drop `shift_id` support and regress Phase 9 functionality.
- **No Uncontrolled Live Register Testing:** Prohibit running test purchases against shared live branch registers.
- **No In-Flight Assumptions:** Do NOT assume that previous reports or claimed source-code observations have been verified during document revision.
- **Zero Premature Implementation:** Zero source code modifications, zero migration creations, and zero database queries are authorized during this planning phase.

---

## 4. Affected Files & Database Objects (Planned Scope)

| Component | Target Path / Object Name | Planned Action (Requires Gate B/C) | Current Status |
| :--- | :--- | :--- | :--- |
| **Database Migration** | `supabase/migrations/20261013_01_fix_create_purchase_atomic_audit_log.sql` | Forward-only migration containing `CREATE OR REPLACE FUNCTION public.create_purchase_atomic(...)` with canonical Step 7 audit insert and `service_role` security grants. | Planned (Uncreated) |
| **Rollback Artifact** | `supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql` | Standalone rollback migration restoring a verified working procedure baseline (isolated outside active migrations root). | Planned (Uncreated) |
| **UI Component** | [`src/components/PurchasesView.tsx`](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx) | Update `handleSavePurchase` to return `Promise<boolean>`, add synchronous `useRef` double-submission lock, guard `setShowVoucherModal(true)`, and handle network timeouts. | Planned (Unmodified) |
| **Offline Test Script** | `scripts/test-purchase-audit-offline.mjs` | Node.js test script for migration pattern inspection, TypeScript interface conformance, and mocked UI control-flow verification. | Planned (Uncreated) |
| **Live Database** | `public.create_purchase_atomic(UUID, JSONB, JSONB, UUID[])` | Target PostgreSQL stored procedure in project `ignspvajzblmsbertmmv` (updated only at Gate C). | Planned (Unmodified) |

---

## 5. Database Stored Procedure Remediation Strategy

### 5.0 Complete Behavioral Comparison: Phase 7 vs Phase 9 Migrations

Source-verified comparison between [`20261005_02_create_purchase_atomic.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql) (Phase 7) and [`20261005_05_purchases_shift_id.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261005_05_purchases_shift_id.sql) (Phase 9). Both documents and all planned artifacts reference this table to resolve ambiguity.

| Aspect | Phase 7 — `20261005_02` | Phase 9 — `20261005_05` | Status for Forward Migration |
| :--- | :--- | :--- | :--- |
| **Function qualifier** | `create_purchase_atomic` (no `public.` prefix) | `create_purchase_atomic` (no `public.` prefix) | Forward migration must use `public.create_purchase_atomic` |
| **Signature** | `(UUID, JSONB, JSONB, UUID[]) RETURNS JSONB` | `(UUID, JSONB, JSONB, UUID[]) RETURNS JSONB` | Identical — retained |
| **SECURITY DEFINER** | ✅ Present | ✅ Present | Required — retained |
| **search_path** | `SET search_path = public, pg_temp` | `SET search_path = public, pg_temp` | Required — retained |
| **`v_shift_id`** | ❌ Absent from DECLARE | ✅ Present (`UUID`) | Required — taken from Phase 9 |
| **shift_id extraction** | ❌ Absent | ✅ `NULLIF(p_purchase_data->>'shift_id','')::UUID` | Required — taken from Phase 9 |
| **purchases INSERT shift_id** | ❌ Absent from column list | ✅ Present | Required — taken from Phase 9 |
| **Token validation error text** | `'One or more token IDs not found for this tenant'` | `'One or more tokens do not belong to this tenant or do not exist'` | Trivial wording difference — either acceptable |
| **item_id NOT FOUND** | `RAISE EXCEPTION` | `RAISE EXCEPTION` | Identical — retained |
| **`item_code` NOT FOUND** | `RAISE EXCEPTION` ([L183-L185](file:///d:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql#L183-L185)) | Silent skip — no RAISE ([L173-L177](file:///d:/bestow/p-industry/supabase/migrations/20261005_05_purchases_shift_id.sql#L173-L177)) | ✅ **C-01 Confirmed:** Strict exception (`RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;`) |
| **Supplier UPDATE fields** | `current_balance` + `last_payment_amount` + `last_payment_date` ([L213-L217](file:///d:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql#L213-L217)) | `current_balance` only ([L201-L203](file:///d:/bestow/p-industry/supabase/migrations/20261005_05_purchases_shift_id.sql#L201-L203)) | ✅ **C-02 Confirmed:** `current_balance = v_new_balance`; update `last_payment_amount = v_paid_amount` and `last_payment_date = v_date` when `paid_amount > 0` |
| **Audit Step 7 columns** | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` ✅ | `tenant_id, action, entity, entity_id, details, user_name` ❌ BROKEN | Corrected — canonical 7-column contract |
| **Audit `entity_type` value** | `'purchase'` | `'purchases'` (as `entity`) | `'purchase'` (singular) — see §5.2 |
| **Audit `action_type` value** | `'purchase'` / `'purchase_return'` | Absent | Required — see §5.2 |
| **Audit `user_name` value** | `COALESCE(v_supplier_name, 'Supplier')` | `COALESCE(v_created_by, 'System')` | `COALESCE(v_created_by, 'System')` — see §5.2 |
| **Audit `entity_id` cast** | `v_purchase_id::text` | `v_purchase_id` (UUID, no cast) | **Must cast to `::text`** — see C-05 in §5.2 |
| **Audit `details` payload** | Minimal (`purchase_no`, `net_total`, `paid_amount`, `due_amount`, `items_count`) | Rich (adds `supplier_id`, `supplier_name`, `payment_type`, `shift_id`, `tokens_applied_amount`) | Rich payload retained from Phase 9 |
| **REVOKE** | ❌ Absent in `20261005_02` | ❌ Absent in `20261005_05` | Required — sourced from [`20261009_01_supabase_advisor_reconciliation.sql#L50-L51`](file:///d:/bestow/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql#L50-L51) |
| **GRANT** | `TO service_role` only ([L250](file:///d:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql#L250)) | `TO authenticated, service_role` ([L237](file:///d:/bestow/p-industry/supabase/migrations/20261005_05_purchases_shift_id.sql#L237)) | `TO service_role` only — see C-06 in §8.2 |

---

### 5.1 Procedure Reconstruction Baseline
The replacement function must **not** be a blind copy of historical migration `20261005_02_create_purchase_atomic.sql`, nor can it simply snapshot the broken live function. It must be reconstructed to embody the complete, intended business logic with confirmed business decisions C-01 and C-02 incorporated.

1. **Parameter Signature:** `public.create_purchase_atomic(p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]) RETURNS jsonb`.
2. **Shift Linkage (Phase 9):** Extract `shift_id := NULLIF(p_purchase_data->>'shift_id', '')::UUID` and record it in `purchases.shift_id` and audit details.
3. **Token Stockpile Management:** Lock rows `FOR UPDATE`, validate ownership and status (`usage_status <> 'used'`), accumulate `tokens_applied_amount`, and update status to `'used'`.
4. **Header Persistence:** Insert header row into `purchases` including `tokens_applied_amount` and `shift_id`.
5. **Line Item & Inventory Logic — item_id path:** Insert into `purchase_items`. Compute directional stock delta (Purchase: `+qty`; Return: `-qty`). Lock item row `FOR UPDATE`, set `stock_qty = GREATEST(0, stock_qty + v_qty_delta)`. Raise exception if item not found by `item_id`.
6. **Line Item & Inventory Logic — item_code fallback path (C-01 Confirmed):**
   - Confirmed Business Rule: Strict validation. Query `items` using `WHERE tenant_id = p_tenant_id AND code = v_item_code FOR UPDATE`.
   - If not found, execute `RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;`.
   - This prevents unrecorded inventory deltas and rolls back the transaction immediately if an item code does not exist.
7. **Supplier Balance Updates & Payment Metadata (C-02 Confirmed):**
   - Confirmed Business Rule: When saving a purchase invoice or return, update `suppliers.current_balance = v_new_balance`.
   - When `v_paid_amount > 0` at purchase creation time, also update `last_payment_amount = v_paid_amount` and `last_payment_date = v_date` (which directly updates the supplier ledger card in `PurchasesView.tsx`).
   - When `v_paid_amount = 0`, preserve existing `last_payment_amount` and `last_payment_date` values unchanged.
   - Supplier balance is adjusted exactly once. This flow reflects payment at time of purchase without double accounting against formal supplier payment vouchers.
8. **Security Attributes & Grants:**
   - `SECURITY DEFINER SET search_path = public, pg_temp`.
   - `REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;` (sourced from `20261009_01_supabase_advisor_reconciliation.sql#L50-L51`).
   - `GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;`.

### 5.2 Canonical Audit-Log Semantics Reconciliation (F-06 / C-05)
A comparison between `20261005_02` and `20261005_05` reveals several historical discrepancies that must be reconciled. The values below are **planned contract values** pending required schema and convention checks specified in §5.3.

| Field | `20261005_02` Baseline | `20261005_05` Baseline | Planned Canonical Value | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **`entity_type`** | `'purchase'` | `'purchases'` (as invalid `entity` column) | **`'purchase'` (singular)** | Matches `AuditLog` interface (`entity_type: string`) and `AuditLogsView.tsx` filter (`entity === 'purchase'`). Confirmed by source review. |
| **`action_type`** | `'purchase'` / `'purchase_return'` | *Omitted* | **`'purchase'` / `'purchase_return'`** | Matches `AuditLogsView.tsx` filter: `actType === 'purchase'` / `actType === 'purchase_return'`. Confirmed by source review. |
| **`user_name`** | `COALESCE(v_supplier_name, 'Supplier')` | `COALESCE(v_created_by, 'System')` | **`COALESCE(v_created_by, 'System')`** | Operator-identity intent confirmed: UI sends `created_by: staffName` to the API. `v_supplier_name` in Phase 7 was incorrect. |
| **`action`** | `'Purchase Invoice Complete'` / `'Purchase Return'` | `'CREATE_PURCHASE'` / `'CREATE_PURCHASE_RETURN'` | **`'Purchase Invoice Complete'` / `'Purchase Return'`** | Human-readable convention matching `AuditLogsView.tsx` filter: `act.includes('purchase')`. Confirmed by source review. |
| **`entity_id`** | `v_purchase_id::text` ✅ | `v_purchase_id` (UUID, no cast) ❌ | **`v_purchase_id::text`** — **C-05: explicit `::text` cast required** | TypeScript `AuditLog.entity_id` is `string?`. PostgreSQL `uuid` is not implicitly compatible with a `text` column. The cast is mandatory. |
| **`details`** | Minimal payload | Rich payload with `shift_id`, `tokens` | **Rich payload with `shift_id`** | Retains Phase 9 shift and token tracking metadata. |

> **C-05 Note:** The `entity_id` value **must** use `v_purchase_id::text` in the INSERT. Using the raw `UUID` variable without the `::text` cast will either silently coerce (if `entity_id` is `text`) or fail (if column type differs). The cast must be explicit and present in both the forward migration and the rollback artifact.

#### Planned Canonical Step 7 Statement (pending C-04 schema verification):
```sql
  -- 7. Write audit log entry (canonical contract — pending schema cross-check in §5.3)
  INSERT INTO audit_logs (
    tenant_id,
    user_name,
    action,
    action_type,
    entity_type,
    entity_id,        -- C-05: must be v_purchase_id::text
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

### 5.3 Authoritative Schema Cross-Check Requirement (F-01 / C-04)
The `CREATE TABLE audit_logs` DDL is **absent from the local migration history**. The table predates tracked migrations. Local evidence establishes that `action_type TEXT` was added by [`20260924_01_fix_missing_columns.sql#L5-L6`](file:///d:/bestow/p-industry/supabase/migrations/20260924_01_fix_missing_columns.sql#L5-L6) and that `entity_id` is inferred nullable from the TypeScript interface and stored procedure usage.

Regarding `tenant_id`: forensic report §3.1 catalog query shows `is_nullable: YES`, while application conventions treat it as conceptually mandatory. This discrepancy is preserved without inventing a NOT NULL schema constraint until live preflight verification in Task T7.

| Column | Expected Name | Expected PostgreSQL Type | Expected Nullability | Local Evidence Basis | Live Verification Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tenant_id` | `tenant_id` | `uuid` | nullable (reported) / mandatory (app) | Forensic report §3.1 shows `is_nullable: YES`; app conventions treat as required. Discrepancy preserved without inventing schema facts | ✅ Required in T7 preflight |
| `user_name` | `user_name` | `text` | nullable | `AuditLog.user_name?: string` in `src/types/index.ts#L319` | ✅ Required in T7 preflight |
| `action` | `action` | `text` | NOT NULL | `AuditLog.action: string` (required field) | ✅ Required in T7 preflight |
| `action_type` | `action_type` | `text` | nullable | Added as `ADD COLUMN IF NOT EXISTS action_type TEXT` (nullable) | ✅ Required in T7 preflight |
| `entity_type` | `entity_type` | `text` | NOT NULL | `AuditLog.entity_type: string` (required field) | ✅ Required in T7 preflight |
| `entity_id` | `entity_id` | `text` | nullable | `AuditLog.entity_id?: string`; `settle_tokens_atomic` omits it without errors | ✅ Required in T7 preflight |
| `details` | `details` | `jsonb` | nullable | `AuditLog.details?: Record<string, any>` | ✅ Required in T7 preflight |

*Rule:* **This live schema inspection is NOT authorized during the current planning phase or Gate B offline preparation.** To preserve strict gate boundaries, Task T6 performs offline contract checks only. Live schema verification is moved strictly into Task T7 (Gate C) as a separately authorized live preflight step immediately prior to applying migration DDL. If any column is absent or has an incompatible type during the T7 preflight, deployment is aborted.

---

## 6. UI Control Flow, Concurrency & Network Failure Safeguards

### 6.1 Synchronous Double-Submission Protection (F-04)
Inspection of [src/components/PurchasesView.tsx](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx) confirms that `handleSavePurchase` has zero in-flight submission locking. Because React state updates are asynchronous, a cashier rapidly double-clicking can trigger concurrent HTTP requests before state-based disabling takes effect.

#### Required Guard Architecture:
```typescript
const isSubmittingRef = useRef<boolean>(false);
const [isSaving, setIsSaving] = useState<boolean>(false);

const handleSavePurchase = async (): Promise<boolean> => {
  // Synchronous ref check prevents microsecond double-clicks
  if (isSubmittingRef.current) return false;
  if (items.length === 0) {
    showFeedback('Cannot save empty purchase invoice. Please add items.');
    return false;
  }

  isSubmittingRef.current = true;
  setIsSaving(true);

  try {
    const res = await fetch('/api/purchases', { ... });
    // response handling
  } finally {
    isSubmittingRef.current = false;
    setIsSaving(false);
  }
};
```
- Controls (`Save`, `Save & Print`) must bind `disabled={isSaving}` for visual feedback.

### 6.2 Four-Branch Transaction Outcome & Network Failure Handling (F-05)
A client network failure (`TypeError: fetch failed` or timeout) does **not** prove that the database transaction failed; the database may have committed the purchase before the connection dropped.

**Source-verified behavior:** The current `catch` block ([`PurchasesView.tsx#L382-L384`](file:///d:/bestow/p-industry/src/components/PurchasesView.tsx#L382-L384)) conflates genuine network exceptions (unknown outcome) with HTTP-level application errors (confirmed failure). Both display `❌ Network error: ...`. This must be corrected by distinguishing `catch (err)` (fetch/network exception → unknown outcome) from `res.ok === false` or `data.success === false` (confirmed API/DB failure).

**Invoice number retry safety (source-verified):** `generatePurchaseInvoiceNo()` is called once at mount and again only inside `handleNewPurchase()`, which is only invoked on confirmed success. This means the invoice number is **not** auto-advanced on failure or network error — the draft and invoice number are retained for the user to inspect and retry manually. This is the correct behavior.

**Unique constraint protection:** Database constraint `uq_purchases_tenant_purchase_no UNIQUE (tenant_id, purchase_no)` ([`20260924_02_business_constraints.sql#L14`](file:///d:/bestow/p-industry/supabase/migrations/20260924_02_business_constraints.sql#L14)) ensures that if the network timed out but the purchase was already committed, a retry with the **same invoice number** will be safely rejected by PostgreSQL with a unique constraint violation. Supabase surfaces this as a JSON error body. The UI advisory must explain this to the user so they do not misinterpret the constraint violation message as a new failure.

The UI flow must explicitly distinguish four outcomes:
1. **Confirmed Success (`res.ok` and `data.success === true`):**
   - Display success feedback (`✅ Purchase Invoice #... saved`).
   - Call `onStockUpdated?.()`.
   - Clear token selections and refresh available tokens.
   - Call `handleNewPurchase()` to reset form fields and advance record number.
   - If called from `handleSaveAndPrint()`, open voucher modal (`setShowVoucherModal(true)`).
   - Return `true`.
2. **HTTP Application / Database Error — Parseable HTTP Response Received (`!res.ok` or `data.success === false` with JSON body):**
   - An HTTP response was received from the Next.js server with parseable JSON. In the common case, `rpcError` from Supabase will have caused PostgreSQL to abort and roll back the transaction.
   - **Race Window Exception:** There is a rare edge window where the database committed and the server terminated before returning HTTP 200 (resulting in an unexpected 500). Do not blindly assume all HTTP 500s represent guaranteed rollback.
   - Display error feedback (`❌ Error: ...`) with the message from `data.error`.
   - Retain draft line items and invoice number unchanged on screen.
   - Do **not** open voucher modal.
   - Do **not** call `handleNewPurchase()`.
   - *Unique constraint advisory:* If the error message includes a unique constraint violation on `uq_purchases_tenant_purchase_no` (PostgreSQL error code `23505`), display specific advisory: *"This invoice number was already saved in a prior attempt. Check purchase history before retrying."*
   - Return `false`.
3. **Response Parsing Failure — HTTP Response Received but Unparseable (`res` received, but `res.json()` throws SyntaxError):**
   - An HTTP response arrived from a proxy, gateway, or server crash (e.g. 502/504 HTML error page from Cloudflare or Nginx), but its body cannot be parsed as JSON.
   - The database outcome is **unknown** (the gateway may have timed out while PostgreSQL was committing, or rejected the connection before reaching Next.js).
   - Do **not** claim definite failure or success.
   - Do **not** clear draft items or advance the invoice number.
   - Do **not** open voucher modal.
   - Display clear advisory notice:
     ```
     ⚠️ Communication error: Server responded with unparseable format.
     Check purchase history to see if the purchase committed before retrying.
     ```
   - Return `false`.
4. **Network Transport Failure — No HTTP Response Received (`fetch` throws TypeError, client offline, connection reset, or DNS timeout):**
   - Zero HTTP response was received. The client disconnected or timed out before receiving headers.
   - The database outcome is **completely unknown** (the request may never have reached the server, or the transaction committed and the response dropped on the return path).
   - Do **not** claim the purchase definitely failed or succeeded.
   - Do **not** advance invoice number or clear line items.
   - Do **not** open voucher modal.
   - Display clear advisory notice:
     ```
     ⚠️ Network error: Could not reach the server.
     Check purchase history before retrying. If you retry with the same
     invoice number and it was already saved, it will be safely rejected.
     ```
   - Retain draft items and invoice number for operator inspection.
   - Return `false`.

---

## 7. Credible Offline Testing Strategy & Tooling Limitations (F-01)

### 7.1 Explicit Tooling Limitations
- **No In-Process PostgreSQL Parser:** Static Node.js scripts using regex or string pattern matching are **static lexical conformance checks only**. They do **not** compile PL/pgSQL, build an AST, or validate SQL grammar.
- **No Runtime Proof:** Passing static lexical checks does **not** prove that embedded SQL queries have valid column references at runtime.
- **Rollback Dry-Run Limitation:** Executing a function inside a transaction that rolls back (`BEGIN; ... ROLLBACK;`) only validates SQL statements that are **actually executed** during that specific code path. If conditional branches are not reached, deferred PL/pgSQL errors remain untested.

### 7.2 What Future Offline Tests (`scripts/test-purchase-audit-offline.mjs`) Genuinely Verify:
1. **Migration Structural Conformance:** Verifies regex match for required function signature, presence of `entity_type` and `action_type`, absence of `entity` in the audit column list, extraction of `shift_id`, and `service_role` security grants.
2. **TypeScript Interface Alignment:** Verifies that properties match `interface AuditLog` in `src/types/index.ts`.
3. **Mocked UI Control-Flow Logic:** Unit-tests `PurchasesView` guard logic against mocked API states (empty items, HTTP 500, network error, confirmed success).

---

## 8. Deployment, Rollback & Dummy-Shop Testing Architecture

### 8.1 Target Environment Verification
- **Target Project:** `ignspvajzblmsbertmmv` (`p-industry` on Supabase).
- Project ID must be explicitly verified before any deployment operation.

### 8.2 Safe Rollback Strategy (F-02 / C-06)
- **Defective Snapshot Rejected:** Restoring a snapshot of the *currently deployed* function is rejected because the current function is the broken procedure containing column `entity`.
- **Blind Phase 7 Reversion Rejected:** Restoring `20261005_02_create_purchase_atomic.sql` verbatim is also **rejected** because that baseline does not include `v_shift_id` extraction, `shift_id` in the `purchases` header INSERT, or shift details in the audit payload. Reverting to it would silently drop Phase 9 shift tracking for all new purchases.
- **Rollback Artifact Purpose & Strict Limitations:**
  The rollback artifact (`supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql`) is authored as a safe hybrid:
  - **Purpose:** Prepares a pre-validated, standby emergency restoration script that can be applied if unexpected runtime edge cases emerge post-deployment, safely isolated in `supabase/rollbacks/` outside the active migrations root to prevent accidental execution by forward migration runners.
  - **Strict Limitations:**
    1. Must **NEVER** reintroduce the broken column reference `entity` from `20261005_05` (doing so would immediately restore runtime error 42703 and abort all purchases).
    2. Must **NEVER** drop Phase 9 `shift_id` behavior: retains `v_shift_id UUID` DECLARE, `v_shift_id := NULLIF(p_purchase_data->>'shift_id', '')::UUID` extraction, and `shift_id` column in the `purchases` INSERT.
    3. Implements confirmed business decision C-01 (strict item exception on missing `code`).
    4. Implements confirmed business decision C-02 (updates `suppliers.last_payment_amount` and `last_payment_date` when `paid_amount > 0`).
    5. Replaces Step 7 with the identical canonical audit contract defined in §5.2 (correct `entity_type`, `action_type`, `v_created_by`, and explicit `v_purchase_id::text` cast).
    6. **C-06 — Preserves Authoritative Security Posture:** Sourced authoritatively from [`20261009_01_supabase_advisor_reconciliation.sql#L50-L51`](file:///d:/bestow/p-industry/supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql#L50-L51):
       ```sql
       REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
       GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;
       ```
    7. **Data Reality:** Rolling back function DDL modifies routine code only; it does **not** undo or reverse business transactions (purchases, stock adjustments, supplier balance changes) committed while the patch was active. Data remediation for committed records requires a separate, explicitly authorized reconciliation procedure.
- **Artifact Status:** `supabase/rollbacks/rollback_20261013_01_fix_create_purchase_atomic.sql` is a planned deliverable under Gate B, isolated outside the active migrations root.

### 8.3 Production & Dummy-Shop Testing Policy (F-03)
- **General Rule:** Uncontrolled test purchases against production or shared live registers are strictly prohibited.
- **Staging Preference:** A dedicated, isolated staging project is preferred whenever available.
- **Shared Project Dummy-Tenant Exception:**
  Testing against a dedicated dummy tenant in the shared project (`ignspvajzblmsbertmmv`) is permitted **only as an explicitly authorized exception**, subject to:
  1. Formal verification of tenant isolation (UUID scoping).
  2. Documented pre-test snapshot of relevant business state (supplier balance, item stock).
  3. Pre-defined test purchase with designated test supplier and test item.
  4. Immediate post-test reversal/cancellation using `cancel_purchase_atomic`.
  5. Formal recognition that cancellation reverses stock and balance, but **does not remove append-only audit history**.
  6. Post-test verification that no other tenant's records were affected.
- **Default Gate C Deployment Proof:** The default Gate C deployment verification is strictly read-only catalog verification targeting the exact signature `SELECT pg_get_functiondef('public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])'::regprocedure);` and routine privileges restricted to `service_role`. Runtime functional testing requires a separate, explicit authorization gate.

---

## 9. Dependency Sequence & Authorization Gate Architecture (F-07)

Execution is strictly partitioned across three independent authorization gates:

```
┌────────────────────────────────────────────────────────┐
│ Gate A: Plan Review & Local Baseline                   │
│ (Planning & Local Repo Review — COMPLETED)             │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Task T1: Local Baseline Inspection (COMPLETED)         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Gate B: Implementation Authorization                   │
│ (Authorized by Business Owner — COMPLETED)             │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐
│ Task T2: Migration DDL    ││ Task T3: UI Synchronous   │
│ Construction (COMPLETED)  ││ Guard & Timeout (COMPLETED)
└─────────────┬─────────────┘└─────────────┬─────────────┘
              │                            │
              └─────────────┬──────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Task T4: Offline Static Inspection Script (COMPLETED)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Task T5: TypeScript Compilation & Tests (COMPLETED)    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Task T6: Pre-Deployment Readiness & Rollback (COMPLETED)
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Gate C: Production Database Deployment Authorization   │
│ (STRICTLY NOT APPROVED — AWAITING EXPLICIT APPROVAL)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Task T7: Production Migration Apply & Read-Only Check  │
│ (PLANNED — Requires Gate C User Approval)              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Task T8: Optional Sandbox/Dummy-Tenant Verification   │
│ (PLANNED — Requires Separate Functional Test Approval) │
└────────────────────────────────────────────────────────┘
```

---

## 10. Summary of Plan Revisions

| Finding | Section | Summary of Revision |
| :--- | :--- | :--- |
| **F-01** | §2, §5.3, §7 | Explained deferred PL/pgSQL plan caching; classified offline tests as static lexical checks only; required pre-deployment schema cross-checks. |
| **F-02** | §2 (Finding 5), §5.0, §8.2 | Source-verified that `20261005_02` does not contain `shift_id`; mandated safe hybrid rollback rather than verbatim reversion; clarified rollback limitations. |
| **F-03** | §1, §8.3 | Formulated dummy-shop test policy; prohibited uncontrolled live testing; recognized audit immutability; made read-only catalog check the default Gate C proof targeting exact signature. |
| **F-04** | §6.1 | Specified synchronous `useRef` in-flight locking before first `await` to prevent rapid double-click race conditions. |
| **F-05** | §2 (Finding 7), §6.2 | Source-verified invoice number generation: not auto-advanced on failure. Unique constraint source-verified. Four-branch outcome model updated with precise advisory text and constraint violation guidance. |
| **F-06** | §5.2 | Reconciled `20261005_02` vs `20261005_05` semantics: canonical `v_created_by`, `'Purchase Invoice Complete'`, and singular `'purchase'`. |
| **F-07** | §9 | Removed live database access from Gate A and Task T1; established strict gate boundaries (Gate A, B, C all NOT APPROVED). |
| **C-01** | §5.0, §5.1, §8.2 | **Resolved by Business Owner:** Confirmed strict item validation. Missing `code` raises exception (`RAISE EXCEPTION`), rolling back transaction immediately. |
| **C-02** | §5.0, §5.1, §8.2 | **Resolved by Business Owner:** Confirmed supplier payment metadata update on purchase creation (`paid_amount > 0` updates `last_payment_amount` and `last_payment_date`). Confirmed single balance adjustment without duplicate accounting. |
| **C-03** | §6.2 | Corrected outcome-2 language: HTTP 500 is *expected* rollback in the common case (rpcError triggers PG rollback), but there is a rare race window where DB may have committed before server crash. Softened "confirmed" to "expected." Added unique constraint advisory precision. |
| **C-04** | §5.3, §8.3 | Preserved `tenant_id` nullable discrepancy in schema table; realigned gate boundaries so live schema verification is strictly executed during Gate C preflight in Task T7. |
| **C-05** | §5.2 | Added explicit requirement: `entity_id` must be `v_purchase_id::text` in all INSERT statements. Raw UUID without `::text` cast is invalid. Applies to forward migration, rollback, and Task T2 acceptance criteria. |
| **C-06** | §5.1, §8.2 | Documented that `20261009_01_supabase_advisor_reconciliation.sql#L50-L51` is the authoritative source for the REVOKE/GRANT posture targeting exact signature `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])`. |
| **Rollback Isolation** | §4, §8.2, §10 | Relocated rollback artifact from `supabase/migrations/` to isolated directory `supabase/rollbacks/` to ensure it is never picked up or accidentally executed by forward migration runners or tooling globs. |
| **C-07** | §5.1, §8.2, §10 | **Gate C Preflight Finding & Remediation (Option A):** Live catalog confirmed `token_transactions` lacks `used_date`. Removed `used_date = NOW()` from Step 4 in both forward migration and safe-hybrid rollback artifact; updated offline tests (21/21 passed); preserved `usage_status = 'used'` and `used_against_purchase_id = v_purchase_id`. |
| **C-08** | §8.3, §10 | **Gate C Post-Deployment Smoke Test Pre-Existing Constraint Finding:** Identified that `token_transactions.usage_status` has an existing check constraint `token_transactions_usage_status_check` (`CHECK (usage_status IN ('available', 'settled', 'written_off', 'reversed', 'n_a'))`) that excludes `'used'`. Reported for separate schema remediation; standard purchases and purchase returns are 100% operational. |

---

**Current Status: Gate C Deployment & Smoke Tests Completed. Migration `20261013_01_fix_create_purchase_atomic_audit_log.sql` applied and verified on production Supabase project `ignspvajzblmsbertmmv`. All standard purchase and purchase return workflows are fully operational.**
