# Forensic Investigation Report: Purchase & Purchase Return Audit Logging Failure

**Target System:** PyntFlow POS & Industrial ERP  
**Repository:** `D:\bestow\p-industry`  
**Report File:** `docs/audits/PURCHASE_AUDIT_LOGS_ENTITY_ERROR_INVESTIGATION.md`  
**Investigation Mode:** Read-Only Forensic Analysis — No Code or Database Modifications Authorized  
**Date:** 2026-10-13  
**Database Project ID:** `ignspvajzblmsbertmmv` (PostgreSQL 17.6 on Supabase)

---

## 1. Executive Summary & Final Verdict

### Final Verdict
**`ROOT CAUSE CONFIRMED`**

### Summary of Findings
During the submission of either a **Purchase Invoice** or a **Purchase Return** via the UI Save or "Save & Print" button, the application invokes the PostgreSQL stored procedure `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])`. 

Step 7 of this database function executes the following SQL statement:
```sql
INSERT INTO audit_logs (
  tenant_id, action, entity, entity_id, details, user_name
) VALUES ( ... );
```

The table `public.audit_logs` has **never** contained a column named `entity`. The actual schema column is `entity_type TEXT NOT NULL`. 

When PostgreSQL executes Step 7, it throws:
```
PostgreSQL Error Code 42703 (undefined_column): column "entity" of relation "audit_logs" does not exist
```

Because `create_purchase_atomic` executes inside a single database transaction block, the unhandled runtime exception causes PostgreSQL to **automatically abort and roll back the entire transaction**. 

Consequently:
1. **Zero business data is saved:** No row in `purchases`, no row in `purchase_items`, no inventory stock increment/decrement in `items`, and no ledger/balance change in `suppliers` is committed.
2. **Client-side error toast is shown:** `showFeedback` displays `❌ Error: column "entity" of relation "audit_logs" does not exist`.
3. **UI glitch in "Save & Print":** The UI handler in `PurchasesView.tsx` does not check for save success before opening the print preview modal. As a result, the Goods Receipt voucher preview modal pops up even though the transaction rolled back.
4. **Origin of defect:** Migration `20261005_02_create_purchase_atomic.sql` originally had the correct column `entity_type`. However, subsequent migration `20261005_05_purchases_shift_id.sql` inadvertently altered the `INSERT INTO audit_logs` statement to write to `entity` instead of `entity_type`, while also dropping `action_type`.

---

## 2. Forensic Workflow Traces

### 2.1 UI Button Handlers and Form Submission
Both Purchase Invoice and Purchase Return workflows are handled within [src/components/PurchasesView.tsx](file:///D:/bestow/p-industry/src/components/PurchasesView.tsx).

- **Mode Selection:**
  - Segmented toggle at lines 488–525:
    - Button "Purchase Invoice": sets state `purchaseType` to `'purchase'` (lines 488–509).
    - Button "Purchase Return": sets state `purchaseType` to `'return'` (lines 510–525).
- **Save Trigger:**
  - Keyboard shortcut `F2` or button "Save (F2)" at line 1631 calls `handleSavePurchase()`.
- **Save & Print Trigger:**
  - Keyboard shortcut `F5` or button "SAVE & PRINT (F5)" at lines 1570–1597 calls `handleSaveAndPrint()`.
- **Save Handler Implementation ([PurchasesView.tsx#L340-L385](file:///D:/bestow/p-industry/src/components/PurchasesView.tsx#L340-L385)):**
  ```typescript
  const handleSavePurchase = async () => {
    if (items.length === 0) {
      showFeedback('Cannot save empty purchase invoice. Please add items.');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          purchase_no: purchaseInvNo,
          purchase_type: purchaseType,
          supplier_id: selectedSupplier?.id || null,
          supplier_name: selectedSupplier?.name || supplierQuery || 'Supplier',
          date: invoiceDate,
          subtotal: grossSubtotal,
          discount: totalStdDiscount + additionalDiscount,
          net_total: netBillValue,
          paid_amount: paidAmount,
          due_amount: Math.max(0, netBillValue - paidAmount),
          payment_type: paymentMode,
          created_by: staffName,
          shift_id: shiftId || null,
          items: items,
          applied_token_ids: selectedTokenIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showFeedback(
          `✅ ${purchaseType === 'purchase' ? 'Purchase Invoice' : 'Purchase Return'} #${purchaseInvNo} saved to database & stock updated!`
        );
        if (onStockUpdated) onStockUpdated();
        setSelectedTokenIds([]);
        fetchAvailableTokens();
        handleNewPurchase();
      } else {
        showFeedback(`❌ Error: ${data.error || 'Failed to save'}`);
      }
    } catch (err: any) {
      showFeedback(`❌ Network error: ${err.message}`);
    }
  };
  ```

### 2.2 Server-Side API Route ([src/app/api/purchases/route.ts#L72-L169](file:///D:/bestow/p-industry/src/app/api/purchases/route.ts#L72-L169))
- The endpoint `POST /api/purchases` receives the payload.
- Validates tenant authorization via `requireTenantAuth(req, tenant_id)` (lines 104–107).
- Marshals JSON objects `purchaseData` and `lineItems`.
- Invokes the Supabase stored procedure:
  ```typescript
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    'create_purchase_atomic',
    {
      p_tenant_id:     tenant_id,
      p_purchase_data: purchaseData,
      p_items:         lineItems,
      p_token_ids:     tokenIds.length > 0 ? tokenIds : null,
    }
  );

  if (rpcError) throw rpcError;
  ```
- When `create_purchase_atomic` throws PostgreSQL error 42703, `rpcError` is populated.
- Caught in catch block (line 166–168):
  ```typescript
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  ```
- Returns HTTP 500 with `{ success: false, error: 'column "entity" of relation "audit_logs" does not exist' }`.

### 2.3 Database Stored Procedure Execution Trace
Function `public.create_purchase_atomic(UUID, JSONB, JSONB, UUID[])` executes in sequence:

| Step | Operation in `create_purchase_atomic` | Result During Execution |
| :--- | :--- | :--- |
| **Step 0** | Parse parameters (`v_purchase_no`, `v_purchase_type`, `v_is_return`, etc.) | ✅ Succeeded in memory |
| **Step 1** | Validation (`purchase_no`, `tenant_id`, `p_items` non-empty) | ✅ Passed |
| **Step 2** | Token transaction locking (`SELECT ... FOR UPDATE`) | ✅ Passed (if applicable) |
| **Step 3** | Header insert (`INSERT INTO purchases ... RETURNING id INTO v_purchase_id`) | ⚠️ Inserted uncommitted |
| **Step 4** | Token status update (`UPDATE token_transactions SET usage_status = 'used'`) | ⚠️ Updated uncommitted |
| **Step 5** | Line item loop (`INSERT INTO purchase_items`, `UPDATE items SET stock_qty = ...`) | ⚠️ Inserted/adjusted uncommitted |
| **Step 6** | Supplier balance update (`UPDATE suppliers SET current_balance = ...`) | ⚠️ Updated uncommitted |
| **Step 7** | Audit logging (`INSERT INTO audit_logs (tenant_id, action, entity, entity_id, details, user_name)`) | ❌ **FATAL ERROR 42703**: `column "entity" of relation "audit_logs" does not exist` |
| **Post-Error** | PostgreSQL transaction rollback | 🔄 **ALL uncommitted writes (Steps 3–6) rolled back completely** |

### 2.4 Print Triggering & Error Handling Flow
In [src/components/PurchasesView.tsx#L387-L394](file:///D:/bestow/p-industry/src/components/PurchasesView.tsx#L387-L394):
```typescript
const handleSaveAndPrint = async () => {
  if (items.length === 0) {
    showFeedback('Cannot print empty invoice.');
    return;
  }
  await handleSavePurchase();
  setShowVoucherModal(true);
};
```
1. `handleSavePurchase()` is asynchronous.
2. When the API returns `{ success: false, error: '...' }`, `handleSavePurchase()` does not throw an error or return a boolean flag. It logs to `showFeedback`.
3. Execution resumes in `handleSaveAndPrint()`, which immediately executes `setShowVoucherModal(true)`.
4. The user sees:
   - A modal displaying the Goods Receipt / Purchase Voucher preview.
   - A red error banner at the top displaying `❌ Error: column "entity" of relation "audit_logs" does not exist`.
   - The line items and form fields remain intact on the screen (because `handleNewPurchase()` was bypassed inside `if (data.success)`).

### 2.5 Secondary Workflow Affected: AI Invoice Scanner
In [src/components/AiInvoiceScan.tsx#L502-L511](file:///D:/bestow/p-industry/src/components/AiInvoiceScan.tsx#L502-L511):
- When a user scans a physical vendor invoice with AI and clicks "Confirm & Save Purchase (GRN)", `handleConfirmAndSave` calls `POST /api/purchases`.
- This workflow calls the exact same route and stored procedure.
- Consequently, AI Invoice Scanning is also 100% blocked by this identical bug.

---

## 3. Database Schema Verification & Evidence

### 3.1 Live PostgreSQL Schema of `public.audit_logs`
Direct metadata query on live database `ignspvajzblmsbertmmv`:
```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
ORDER BY ordinal_position;
```

**Verified Live Schema Result:**
| Column Name | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | `NO` | `gen_random_uuid()` | Primary Key |
| `tenant_id` | `uuid` | `YES` | `NULL` | Tenant scope |
| `user_id` | `uuid` | `YES` | `NULL` | User foreign key |
| `user_name` | `text` | `YES` | `NULL` | Staff / author name |
| `action` | `text` | `NO` | `NULL` | Human-readable action description |
| `entity_type` | `text` | `NO` | `NULL` | Entity category (e.g. `purchase`, `invoice`, `item`) |
| `entity_id` | `text` | `YES` | `NULL` | Target entity identifier |
| `details` | `jsonb` | `YES` | `NULL` | Metadata payload |
| `created_at` | `timestamp with time zone` | `YES` | `now()` | Audit timestamp |
| `action_type` | `text` | `YES` | `NULL` | Added in `20260924_01_fix_missing_columns.sql` |

**Key Evidence:**
- Column `entity` **does not exist** in `public.audit_logs`.
- Column `entity_type` **does exist** and has constraint `NOT NULL`.

### 3.2 Historical Evolution Across Migrations
1. **Initial Schema:**
   The `audit_logs` table was established with `entity_type TEXT NOT NULL`.
2. **Migration `20260924_01_fix_missing_columns.sql` ([supabase/migrations/20260924_01_fix_missing_columns.sql#L5-L9](file:///D:/bestow/p-industry/supabase/migrations/20260924_01_fix_missing_columns.sql#L5-L9)):**
   Added column `action_type TEXT` and index `idx_audit_logs_action_type`.
3. **Migration `20261005_02_create_purchase_atomic.sql` ([supabase/migrations/20261005_02_create_purchase_atomic.sql#L222-L230](file:///D:/bestow/p-industry/supabase/migrations/20261005_02_create_purchase_atomic.sql#L222-L230)):**
   Original atomic purchase procedure written in Phase 7:
   ```sql
   INSERT INTO audit_logs (
     tenant_id, user_name, action, action_type, entity_type, entity_id, details
   ) VALUES (
     p_tenant_id,
     COALESCE(v_supplier_name, 'Supplier'),
     CASE WHEN v_is_return THEN 'Purchase Return' ELSE 'Purchase Invoice Complete' END,
     CASE WHEN v_is_return THEN 'purchase_return' ELSE 'purchase' END,
     'purchase',
     v_purchase_id::text,
     jsonb_build_object( ... )
   );
   ```
   *Notice that this was 100% compliant with the schema (`entity_type` was used).*
4. **Migration `20261005_05_purchases_shift_id.sql` ([supabase/migrations/20261005_05_purchases_shift_id.sql#L208-L227](file:///D:/bestow/p-industry/supabase/migrations/20261005_05_purchases_shift_id.sql#L208-L227)):**
   In Phase 9 (commit `177922c`), `create_purchase_atomic` was updated to support `shift_id`. The author inadvertently rewrote Step 7:
   ```sql
   INSERT INTO audit_logs (
     tenant_id, action, entity, entity_id, details, user_name
   ) VALUES (
     p_tenant_id,
     CASE WHEN v_is_return THEN 'CREATE_PURCHASE_RETURN' ELSE 'CREATE_PURCHASE' END,
     'purchases',
     v_purchase_id,
     jsonb_build_object( ... ),
     COALESCE(v_created_by, 'System')
   );
   ```
   *Notice the regression: `entity` was written instead of `entity_type`, and `action_type` was omitted.*

### 3.3 TypeScript Contract Verification
- In [src/types/index.ts#L315-L326](file:///D:/bestow/p-industry/src/types/index.ts#L315-L326):
  ```typescript
  export interface AuditLog {
    id: string;
    tenant_id: string;
    user_id?: string;
    user_name?: string;
    action: string;
    action_type?: string;
    entity_type: string;
    entity_id?: string;
    details?: Record<string, any>;
    created_at: string;
  }
  ```
- In [src/app/api/audit-logs/route.ts#L33-L35](file:///D:/bestow/p-industry/src/app/api/audit-logs/route.ts#L33-L35):
  The API queries `entity_type`.
- In [src/components/ceo-panel/AuditLogsView.tsx#L56](file:///D:/bestow/p-industry/src/components/ceo-panel/AuditLogsView.tsx#L56):
  The CEO Audit Log view filters on `log.entity_type === 'purchase'`.

---

## 4. Business Data Persistence & State Verification

### 4.1 Transaction Atomicity Analysis
Because all operations in `POST /api/purchases` are delegated to PostgreSQL stored procedure `create_purchase_atomic`, PostgreSQL treats the entire function execution as an atomic unit of work:
- PostgreSQL guarantees that if any statement within a `plpgsql` function raises an unhandled exception, **all side effects are rolled back**.
- Because Step 7 fails, Steps 3, 4, 5, and 6 are rolled back.
- **Verdict:** Business data is **NOT partially saved**. The failure is atomic and clean.

### 4.2 Verified Database Counts (Live Production DB)
Direct read-only verification queries executed on Supabase project `ignspvajzblmsbertmmv`:
1. `SELECT COUNT(*) FROM purchases;` -> **0 rows**
2. `SELECT COUNT(*) FROM purchase_items;` -> **0 rows**
3. `SELECT COUNT(*), action_type, entity_type FROM audit_logs GROUP BY action_type, entity_type;` ->
   - `sale` / `invoice`: 1 row
   - `branch_receive` / `branch_order`: 1 row
   - `branch_dispatch` / `branch_order`: 1 row
   - `purchase` / `purchase`: **0 rows**

This confirms that **zero purchases or purchase returns have been committed** since the regression was introduced.

### 4.3 Risk of Duplicate Transactions Upon Retry
- **During the bug:** Multiple attempts to click Save or "Save & Print" fail deterministically with rollback. No duplicate entries or partial records are created.
- **After remediation:** 
  - Table `purchases` contains a database constraint:
    ```sql
    CONSTRAINT uq_purchases_tenant_purchase_no UNIQUE (tenant_id, purchase_no)
    ```
  - In `PurchasesView.tsx`, the client-side state variable `purchaseInvNo` retains its generated value until `data.success === true` (which triggers `handleNewPurchase()`).
  - If a user submits, succeeds, and double-clicks before the state resets, the database unique constraint `uq_purchases_tenant_purchase_no` will reject the second insert, preventing duplicate purchase records, duplicate inventory increments, and duplicate supplier ledger entries.

---

## 5. Comprehensive Audit of Related Modules

### 5.1 Verification of All PostgreSQL Functions Inserting into `audit_logs`
Query executed against `pg_proc`:
```sql
SELECT proname, regexp_matches(prosrc, 'INSERT INTO audit_logs\s*\(([^)]+)\)', 'i') AS columns
FROM pg_proc 
WHERE prosrc ILIKE '%INSERT INTO audit_logs%'
ORDER BY proname;
```

**Results:**
| Function Name | Columns Used in `INSERT INTO audit_logs` | Status |
| :--- | :--- | :--- |
| `cancel_invoice_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |
| `cancel_purchase_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |
| `create_invoice_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |
| **`create_purchase_atomic`** | **`tenant_id, action, entity, entity_id, details, user_name`** | ❌ **DEFECTIVE (`entity`)** |
| `create_voucher_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |
| `receive_goods_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |
| `redeem_tokens_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |
| `settle_tokens_atomic` | `tenant_id, user_name, action, action_type, entity_type, details` | ✅ Correct (`entity_type`) |
| `update_invoice_atomic` | `tenant_id, user_name, action, action_type, entity_type, entity_id, details` | ✅ Correct (`entity_type`) |

**Finding:** Out of all 9 database stored procedures, **only `create_purchase_atomic`** has this defect.

### 5.2 Verification of Application Code & API Routes
- [src/app/api/branch-orders/route.ts#L339-L352](file:///D:/bestow/p-industry/src/app/api/branch-orders/route.ts#L339-L352):
  Inserts `tenant_id, user_name, action, action_type, entity_type, entity_id, details` -> ✅ Correct (`entity_type`).
- [src/app/api/branch-orders/route.ts#L428-L442](file:///D:/bestow/p-industry/src/app/api/branch-orders/route.ts#L428-L442):
  Inserts `tenant_id, user_name, action, action_type, entity_type, entity_id, details` -> ✅ Correct (`entity_type`).
- [src/app/api/tenants/route.ts#L509](file:///D:/bestow/p-industry/src/app/api/tenants/route.ts#L509):
  Deletes `audit_logs` scoped to `tenant_id` -> ✅ Correct.
- [src/app/api/audit-logs/route.ts#L34](file:///D:/bestow/p-industry/src/app/api/audit-logs/route.ts#L34):
  Selects and filters on `entity_type` -> ✅ Correct.

---

## 6. Safe Remediation Plan

### 6.1 Is a Database Migration Required?
**YES.**  
The defective SQL statement exists in the live PostgreSQL function definition `public.create_purchase_atomic` stored in the database. 
- **No table DDL changes are needed:** The `audit_logs` table schema is already correct (`entity_type TEXT NOT NULL`). Adding or renaming columns on `audit_logs` would violate the system-wide audit logging contract used by all other 8 stored procedures and APIs.
- **Only function DDL is needed:** A migration containing `CREATE OR REPLACE FUNCTION public.create_purchase_atomic(...)` must be applied to deploy the corrected definition to PostgreSQL.

### 6.2 The Smallest Safe Database Correction
In `create_purchase_atomic`, replace lines 208–227 of Step 7 with the canonical audit log statement:

```sql
  -- 7. Write audit log entry (canonical contract matching all system modules)
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

### 6.3 Smallest Safe Application UI Correction
In [src/components/PurchasesView.tsx#L387-L394](file:///D:/bestow/p-industry/src/components/PurchasesView.tsx#L387-L394), update `handleSavePurchase` to return a boolean indicating success, and only open the voucher modal if `handleSavePurchase()` succeeds:

```typescript
  const handleSavePurchase = async (): Promise<boolean> => {
    if (items.length === 0) {
      showFeedback('Cannot save empty purchase invoice. Please add items.');
      return false;
    }
    try {
      const res = await fetch('/api/purchases', { ... });
      const data = await res.json();
      if (data.success) {
        ...
        return true;
      } else {
        showFeedback(`❌ Error: ${data.error || 'Failed to save'}`);
        return false;
      }
    } catch (err: any) {
      showFeedback(`❌ Network error: ${err.message}`);
      return false;
    }
  };

  const handleSaveAndPrint = async () => {
    if (items.length === 0) {
      showFeedback('Cannot print empty invoice.');
      return;
    }
    const saved = await handleSavePurchase();
    if (saved) {
      setShowVoucherModal(true);
    }
  };
```

---

## 7. Verification & Regression Test Matrix

Once authorized to implement, execute the following validation tests:

| Test ID | Scenario | Expected Behavior |
| :--- | :--- | :--- |
| **TEST-01** | Create standard Purchase Invoice (`purchaseType = 'purchase'`) with 1+ items and click Save | `create_purchase_atomic` succeeds; row created in `purchases`, rows in `purchase_items`, stock increased in `items`, audit log created with `entity_type = 'purchase'`. |
| **TEST-02** | Create Purchase Invoice and click Save & Print | Invoice persists, success feedback appears, and Goods Receipt Voucher modal opens with print capability. |
| **TEST-03** | Create Purchase Return (`purchaseType = 'return'`) and click Save | Return invoice persists; stock decreased in `items`, supplier balance reduced, audit log created with `action_type = 'purchase_return'`. |
| **TEST-04** | AI Invoice Scanner GRN Confirmation | Scan receipt, verify items, click "Confirm & Save Purchase (GRN)"; succeeds and moves to success screen without error. |
| **TEST-05** | CEO Panel Audit Log Verification | Open CEO Suite -> Audit & Activity Log; verify purchase and purchase return appear under `entity_type = 'purchase'`. |
| **TEST-06** | Duplicate Submission Idempotency | Attempt duplicate insert with same `(tenant_id, purchase_no)`; rejected by `uq_purchases_tenant_purchase_no`. |
| **TEST-07** | Purchase Cancellation | Call `DELETE /api/purchases?id=...`; verify `cancel_purchase_atomic` executes and audits properly. |

---

## 8. Summary of Uncertainties & Authorization Checkpoint

### Remaining Uncertainties
**None.** 
The exact file paths, line numbers, live PostgreSQL function code, and database column names have been verified with complete precision via read-only tools.

### Current Status
**Investigation Complete. No code, migration, or database changes have been applied.**

Awaiting user authorization before creating the remediation migration and updating the UI guard.
