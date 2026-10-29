# Invoice & Voucher Uniqueness Audit (Corrected)
**Project:** p-industry (Supabase: `ignspvajzblmsbertmmv`)  
**Date:** 2026-10-29 (Updated to align with Bug-Fix & Hardening Plan — D1–D6 review fixes applied)  

---

## Summary

| Document Type | DB Constraint | Generator Method | Duplicate / Loss Risk |
|---|---|---|---|
| Sales Invoice (`invoices`) | ✅ `UNIQUE(tenant_id, invoice_no)` | Client-side `INV-${Date.now().slice(-4)}${rand(10-99)}` | 🔴 **HIGH (Silent Lost-Sale Hazard)** |
| Special Invoice (`invoices`) | ✅ same constraint | Same client generator | 🔴 **HIGH (Silent Lost-Sale Hazard)** |
| Purchase Invoice (`purchases`) | ✅ `uq_purchases_tenant_purchase_no` (Live DB) | User-typed + AI fallback `PINV-${rand}` | 🔴 **HIGH (False Constraint Hazard)** |
| Branch Order (`branch_orders`) | ❌ **No unique constraint on `order_no`** (B10 adds it) | Server-side `BO-${Date.now().slice(-6)}-${rand(100-999)}` | 🟢 **LOW** |
| Voucher (`vouchers`) | ✅ `UNIQUE(tenant_id, voucher_no)` | RPC-generated `IBT-${order_no}` etc. | 🟢 **LOW — errors raised by design** |

---

## 1. Sales & Special Invoices — 🔴 HIGH RISK (Silent Lost-Sale Hazard)

### DB Constraint
```sql
CREATE UNIQUE INDEX uq_invoices_tenant_invoice_no 
  ON public.invoices (tenant_id, invoice_no);
```
**Scope:** per-tenant. Two different tenants can have the same `invoice_no`.

### Generator (Client-side) — PosBilling.tsx:133, 980, 1242, 1441 and SpecialPrintModal.tsx:69
```ts
`INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`
// Example: INV-163421  (last 4 digits of ms + 2-digit rand = 6-char suffix)
```

### Risk Analysis & Evidence of Silent Lost Sales
- **Namespace space:** The last 4 digits of `Date.now()` (0000–9999 = 10,000 values) multiplied by 2 random digits (10–99 = 90 values) gives only **900,000 possible numbers** over the entire lifetime of a tenant.
- Under the **Birthday Paradox**, for a shop issuing 100 invoices/day:
  - Day 1 (100 invoices): 0.55% chance of collision.
  - Day 7 (700 invoices): 23.8% chance of collision.
  - Day 11 (1,117 invoices): **50.00% probability of collision**.
  - Day 30 (3,000 invoices): **99.33% probability of collision**.
- **Silent Lost Sale Hazard (Code Evidence):**
  - When a collision occurs, `create_invoice_atomic` returns `{ success: true, is_duplicate: true, invoice: <OLD_ROW> }` and aborts before inserting items or deducting stock.
  - `/api/invoices/route.ts` returns HTTP 200 with `success: true`.
  - In `PosBilling.tsx:1148`, the POS only checks `if (data.success)`. It completely ignores `is_duplicate`.
  - The POS prints the receipt, clears the line items from the screen, resets state for the next customer, and says `"Invoice finalized"`.
  - **Result:** The new sale is **silently lost**. The customer walks out with physical goods, but no invoice items are stored, no inventory is deducted, no customer ledger is updated, and no cash is recorded.
- **Verdict:** Resolved via B6 — per-request UUID idempotency key + DB-level tenant sequence allocation inside the RPC.

> [!NOTE]
> **D5 — Number allocation timing:** The invoice number is allocated **after** all validations (N4 blocks) and **before** the `invoices` INSERT. Stock checks follow the INSERT inside the atomic transaction; a stock failure rolls back the entire transaction including the counter increment. Concurrent race-loser transactions may burn one sequence number when the `INSERT INTO tenant_invoice_counters ... ON CONFLICT DO UPDATE` increments before the transaction rolls back. Numbering is therefore **monotonically increasing but not guaranteed gapless**.

> [!CAUTION]
> **D6 — Legacy path risk:** Until every deployed POS build sends `idempotency_key`, the legacy code path (no key) can still return a silent `is_duplicate: true` response on a client-generated `invoice_no` collision. The C3 client-side guard (show warning, do not clear cart) is a stop-gap until all clients are updated.

---

## 2. Purchase Invoices — 🔴 HIGH RISK (Cross-Supplier Collision & Double Entry)

### DB Constraint Status (Live Database Audit)
The earlier audit incorrectly claimed there was no constraint. In fact, `pg_constraint` and `pg_indexes` confirm:
```sql
ALTER TABLE public.purchases ADD CONSTRAINT uq_purchases_tenant_purchase_no UNIQUE (tenant_id, purchase_no);
```

### Generator — AiInvoiceScan.tsx:308 and :482, PurchasesView.tsx:437
```ts
// AI scan fallback:
setInvoiceNo(data.invoice_no || `PINV-${Math.floor(100000 + Math.random() * 900000)}`);

// Submit fallback:
purchase_no: invoiceNo.trim() || `PINV-${Date.now().toString().slice(-6)}`
```

### Correction to Earlier Audit Recommendation (D1)
- **Earlier audit incorrectly recommended adding:** `UNIQUE(tenant_id, purchase_no)`.
- **Why this is wrong:** `purchase_no` holds the **external supplier's bill/invoice number**. Different suppliers regularly use identical simple invoice numbers (e.g. `101`, `INV-001`, `2024-1`). With `UNIQUE(tenant_id, purchase_no)`, when Supplier A issues bill `101` and Supplier B later issues bill `101`, Supplier B's bill is blocked with a `23505` error!
- **Correct Rule (Plan B7):** Drop `uq_purchases_tenant_purchase_no`. Add a **partial unique index** scoped per registered supplier:
  ```sql
  CREATE UNIQUE INDEX uq_purchases_tenant_supplier_purchase_no
    ON public.purchases (tenant_id, supplier_id, purchase_no)
    WHERE supplier_id IS NOT NULL;
  ```
  This allows different suppliers to use the same bill number; it blocks the same registered supplier from having a duplicate bill number.
- **For unnamed/ad-hoc suppliers (`supplier_id IS NULL`):** Uniqueness cannot be enforced by the database constraint (null values are outside the partial index). Protection is provided by the **advisory duplicate warning endpoint** (`GET /api/purchases/check-duplicate`), which matches `(tenant_id, purchase_no)` where `supplier_id IS NULL` AND `supplier_name` matches (case-insensitive). This is advisory only — not race-proof — and is displayed at scan time and save time in the UI.

---

## 3. Branch Order Numbers — 🟢 LOW RISK

### DB Constraint
```
branch_orders table: Only PRIMARY KEY (id). NO unique index on order_no.
(B10 adds uq_branch_orders_order_no as part of this hardening.)
```

### Generator — src/app/api/branch-orders/route.ts:275
```ts
const order_no = `BO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
// Example: BO-661733-158
```

### Collision Space Analysis (D3)
- `Date.now().toString().slice(-6)` gives the last 6 digits of a millisecond timestamp. These last 6 digits cycle every **16.7 minutes** (1,000,000 ms = 1,000 seconds).
- Within any 16.7-minute window, the random segment provides **900 distinct values** (100–999). This means the effective collision space at any point in time is **only 900 combinations**, not 900 million.
- For a shop placing only a few branch orders per day, collisions are still extremely unlikely in practice. Risk is **LOW** — but the unique index (`uq_branch_orders_order_no`) is a prerequisite for the B10 retry loop to function correctly.

### Correction to Earlier Audit (D3)
- **Earlier audit suggested:** `ON CONFLICT (order_no) DO NOTHING` retry loop.
- **Why this was wrong:** `ON CONFLICT DO NOTHING` silently fails and returns empty/null rows, masking failures and leaving the UI hanging.
- **Correct Rule (Plan B10):** Add a UNIQUE index on `branch_orders.order_no`. In the POST route, catch PostgreSQL error code `23505` (`unique_violation`) explicitly. Retry up to 3 times (`continue` on attempt < MAX_RETRIES-1; `break` on last attempt), and throw any non-23505 error immediately. Return HTTP 500 if all 3 retries fail. Do **NOT** use `ON CONFLICT DO NOTHING`.

---

## 4. Vouchers — 🟢 LOW — Errors Raised by Design

### DB Constraint
```sql
CREATE UNIQUE INDEX uq_vouchers_tenant_voucher_no 
  ON public.vouchers (tenant_id, voucher_no);
```

### Clarification on Voucher Exception Handling (D4)
- **Earlier audit claimed:** "All voucher inserts are inside BEGIN/EXCEPTION WHEN unique_violation THEN NULL; END blocks → idempotent."
- **Fact check:** No function in the codebase contains `EXCEPTION WHEN unique_violation THEN NULL;`.
  - The audit confused this with `create_invoice_atomic` (which catches `unique_violation` on invoices to return `is_duplicate: true`) and `create_voucher_atomic` (which catches `unique_violation` on `uq_vouchers_tenant_voucher_no` to retry up to 10 times with a new hex suffix).
  - In `process_branch_receive_atomic` (migration 01), voucher inserts have **NO exception handler**. If an `IBT-` voucher collides on `uq_vouchers_tenant_voucher_no`, the entire transaction raises `23505` and rolls back.
  - **This error raising is correct and intentional for accounting integrity:** financial vouchers must never silently swallow collisions with `THEN NULL`, as that would produce unbalanced books.
- **Risk classification: LOW — errors raised by design.** The strict error surfacing is the correct behaviour here.
