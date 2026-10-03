# PHASE 7 REPORT — PROCUREMENT, VENDOR PURCHASES & SUPPLIER LEDGERS FORENSIC AUDIT

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 7 — Procurement, Vendor Purchases & Supplier Ledgers Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

---

## 1. Scope

Comprehensive forensic audit of the procurement workflow, purchase order creation, vendor line item stock ingestion, supplier credit/ledger tracking, stockpile token vendor settlements, and purchase return handling:
- Purchase Order & Receiving Terminal (`src/components/PurchasesView.tsx`)
- CEO Purchase Analytics & Token Settlement Panel (`src/components/ceo-panel/PurchaseView.tsx`)
- Supplier Ledger Detail Modal (`src/components/ceo-panel/SupplierDetailModal.tsx`)
- Purchase Route Handler (`src/app/api/purchases/route.ts`)
- Supplier Directory Handler (`src/app/api/suppliers/route.ts`)

---

## 2. Files Inspected

- [src/components/PurchasesView.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PurchasesView.tsx) (1,837 lines) — Purchase order entry workspace, supplier search, line item discounts, stockpile token deduction, PO printing
- [src/components/ceo-panel/PurchaseView.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/ceo-panel/PurchaseView.tsx) (800 lines) — CEO Purchase metrics, cash vs token vendor payout statistics
- [src/components/ceo-panel/SupplierDetailModal.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/ceo-panel/SupplierDetailModal.tsx) (450 lines) — Supplier account balance statement & payment history modal
- [src/app/api/purchases/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/purchases/route.ts) (275 lines) — Purchase header, line items, token mark, stock adjustment, and supplier balance handler
- [src/app/api/suppliers/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/suppliers/route.ts) (79 lines) — Supplier master directory handler

---

## 3. Database Objects Inspected

- `public.purchases` (`id`, `tenant_id`, `purchase_no`, `purchase_type`, `supplier_id`, `supplier_name`, `date`, `subtotal`, `discount`, `tokens_applied_amount`, `net_total`, `paid_amount`, `due_amount`, `payment_type`)
- `public.purchase_items` (`id`, `purchase_id`, `item_id`, `item_code`, `item_name`, `unit`, `qty`, `unit_price`, `total_price`)
- `public.suppliers` (`id`, `tenant_id`, `name`, `current_balance`, `last_payment_amount`, `last_payment_date`)
- `public.token_transactions` (`id`, `usage_status`, `used_against_purchase_id`)

---

## 4. Procurement Module Audit Matrix

| Component / Endpoint | Functionality | Tenant Scoping | Concurrency & Atomicity | Financial Balance Math |
|---|---|---|---|---|
| `PurchasesView.tsx` | Purchase Order Workspace | ✅ Bound via props | N/A (Client State) | ✅ Accurate net total calculation |
| `GET /api/purchases` | Fetch Purchase History | ✅ Bound via session | N/A (Read) | N/A |
| `POST /api/purchases` | Save PO & Stock Ingestion | ✅ Bound via session | 🚨 **HIGH (Non-atomic 6-step sequence)** | ✅ Correct vendor balance update |
| `GET /api/suppliers` | Vendor Directory | ✅ Bound via session | N/A (Read) | N/A |
| `POST /api/suppliers` | Create Vendor | ✅ Bound via session | ✅ Single insert | ✅ Clean initial balance |

---

## 5. Verified Correct (Procurement Strengths)

1. **Decoupled Stockpile Token Vendor Settlements:**
   - `PurchasesView.tsx:177-200` and `purchases/route.ts:98-127` support applying unredeemed Stockpile Tokens against vendor purchases. Stockpile tokens reduce cash payout without corrupting cash drawer balances.
2. **Accurate Purchase Return Payable Reduction:**
   - `purchases/route.ts:220-230` correctly reduces supplier payable debt when posting a purchase return (`newBalance = currentBal - returnCredit`).
3. **Multi-Item Line Discount & Tax Support:**
   - Supports line-item standard discounts, trade discounts, and tax percentage math alongside cartage freight additions.

---

## 6. Detailed Findings

### FINDING-PROC-001
- **Severity:** HIGH
- **Category:** Transaction Isolation / Non-Atomic Purchase Order Execution
- **Location:** [src/app/api/purchases/route.ts:130-241](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/purchases/route.ts#L130-L241)
- **Component:** `POST /api/purchases`
- **Evidence:**
  `POST /api/purchases` executes sequential non-transactional database calls:
  1. Insert `purchases` header.
  2. Update `token_transactions` (mark used).
  3. Insert `purchase_items` line items.
  4. Loop executing `adjust_item_stock` RPCs per line item.
  5. Update `suppliers` table (`current_balance`).
  6. Insert `audit_logs`.
- **Actual Behavior:** If step 4 or 5 fails mid-way (e.g. database timeout or constraint error), the purchase header and line items remain saved, but stock levels are left partially incremented and supplier balances remain out of sync.
- **Expected Behavior:** Wrap all purchase creation, line item insertion, token status updating, inventory stock incrementing, and supplier balance updating inside a single atomic PostgreSQL procedure `create_purchase_atomic`.
- **Impact:** Inventory desynchronization and supplier balance drift on partial failure.
- **Verification Status:** VERIFIED

---

### FINDING-PROC-002
- **Severity:** MEDIUM
- **Category:** Missing API Endpoints / Purchase Modification Gap
- **Location:** [src/app/api/purchases/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/purchases/route.ts)
- **Component:** `purchases/route.ts`
- **Evidence:** `purchases/route.ts` only exports `GET` and `POST` handlers.
- **Actual Behavior:** Users cannot edit or cancel an incorrectly saved purchase order via API.
- **Expected Behavior:** Implement `PATCH` and `DELETE` endpoints for purchase orders with atomic stock and balance reversals.
- **Impact:** Administrative inability to correct purchase entry errors via standard API.
- **Verification Status:** VERIFIED

---

### FINDING-PROC-003
- **Severity:** MEDIUM
- **Category:** Uniqueness Defect / Predictable PO Invoice Collision
- **Location:** [src/components/PurchasesView.tsx:104](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PurchasesView.tsx#L104) & [L110](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/PurchasesView.tsx#L110)
- **Component:** `PurchasesView.tsx`
- **Evidence:**
  `purchaseInvNo` defaults to `P-INV-${Math.floor(1000 + Math.random() * 9000)}` (9,000 possibilities) and `poNumber` to `PO-${Math.floor(1000 + Math.random() * 9000)}`.
- **Actual Behavior:** 4-digit random number generators cause high collision risk as purchase volumes increase, resulting in database unique constraint failures (`23505`).
- **Expected Behavior:** Use database sequence counters or UUIDs with collision retry logic.
- **Impact:** Failed purchase saves due to duplicate key violations.
- **Verification Status:** VERIFIED

---

## 7. Recommended Remediation Order

1. **P1 (HIGH):** Wrap purchase creation in atomic stored procedure `create_purchase_atomic` (FINDING-PROC-001).
2. **P2 (MEDIUM):** Implement `PATCH` and `DELETE` handlers for purchase order maintenance (FINDING-PROC-002).
3. **P2 (MEDIUM):** Replace 4-digit random number generators with collision-resistant PO identifier generation (FINDING-PROC-003).
