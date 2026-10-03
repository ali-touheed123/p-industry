# PHASE 12 IMPLEMENTATION PLAN — END-TO-END WORKFLOW REMEDIATION

**Date:** October 3, 2026
**Auditor:** Master Forensic Auditor
**Project:** PyntFlow POS & Industrial ERP (p-industry)
**Phase:** PHASE 12 — End-to-End Real Workflow Testing Forensic Audit
**Execution Rule:** AUDIT ONLY — No implementation performed in this phase

---

## 1. Overview

This plan captures the remediation strategy for all 10 findings identified across 14
end-to-end workflow tests in the Phase 12 Forensic Audit. Findings are grouped by
priority and dependency order.

---

## 2. Priority 1 — HIGH Severity (Immediate Remediation Required)

### Task 12.1: Atomic Supplier Purchase Creation & Token Status Marking
- Finding: FINDING-E2E-001
- Severity: HIGH
- Root Cause: POST /api/purchases performs token status marking as a separate query
  after purchase header insert. If downstream steps fail, tokens are permanently locked.
- Target Files:
  - src/app/api/purchases/route.ts
  - Supabase migration (new RPC: create_purchase_atomic)
- Actions:
  1. Create create_purchase_atomic PostgreSQL stored procedure wrapping:
     - Purchase header insert
     - purchase_items insert
     - adjust_item_stock per line item
     - Supplier current_balance update
     - token_transactions status marking (usage_status='used', used_against_purchase_id)
  2. Refactor POST /api/purchases to call create_purchase_atomic instead of
     sequential queries.
  3. Remove inline token marking block (L153-167 purchases/route.ts) once RPC deployed.
- Dependency: None

---

### Task 12.2: Atomic Invoice PATCH (Edit) — create update_invoice_atomic RPC
- Finding: FINDING-E2E-004
- Severity: HIGH
- Root Cause: PATCH /api/invoices performs 6 sequential await operations (stock revert,
  item delete, item insert, stock apply, balance adjust, header update) with no wrapping
  DB transaction. Partial failure leaves inventory and client balance inconsistent.
- Target Files:
  - src/app/api/invoices/route.ts
  - Supabase migration (new RPC: update_invoice_atomic)
- Actions:
  1. Create update_invoice_atomic PostgreSQL stored procedure wrapping all 6 steps:
     - Fetch old invoice items
     - Revert old stock adjustments
     - Delete old invoice_items
     - Insert new invoice_items
     - Apply new stock adjustments
     - Adjust client current_balance delta
     - Update invoice header
  2. Replace PATCH handler body (L445-563 invoices/route.ts) with single RPC call.
- Dependency: None

---

### Task 12.3: Branch Order PATCH — Fix Null Tenant Auth
- Finding: FINDING-E2E-008
- Severity: HIGH
- Root Cause: requireTenantAuth(req, null) passes null as tenantId on branch order
  PATCH, weakening tenant-level session isolation.
- Target File: src/app/api/branch-orders/route.ts:243
- Actions:
  1. Inspect src/lib/session.ts to confirm requireTenantAuth(req, null) behavior.
  2. Replace requireTenantAuth(req, null) with a call that validates against both
     parties of the order:
     - For accept/reject: validate against currentOrder.to_tenant_id (supplier)
     - For dispatch: validate against currentOrder.to_tenant_id
     - For received: validate against currentOrder.from_tenant_id
  3. Alternatively, pass a list of valid tenant IDs and update requireTenantAuth to
     accept an array, returning authorized if session.tenantId is in the list.
- Dependency: Audit src/lib/session.ts first (see Unknown section of audit report)

---

## 3. Priority 2 — MEDIUM Severity

### Task 12.4: Explicit Shift Scoping for Supplier Cash Purchases
- Finding: FINDING-E2E-002
- Severity: MEDIUM
- Root Cause: Shift close reconciliation queries supplier purchases by created_at
  timestamp range instead of shift_id FK, causing cross-shift attribution errors.
- Target Files:
  - src/app/api/purchases/route.ts
  - src/app/api/shifts/route.ts
  - Supabase migration (add shift_id column to purchases)
- Actions:
  1. Add shift_id UUID column (nullable, FK to shifts.id) to purchases table.
  2. Update POST /api/purchases to accept and persist shift_id from request body.
  3. Update PATCH /api/shifts expected_cash calculation (L270-283) to filter
     supplier purchases by shift_id instead of .gte('created_at', startTime).
- Dependency: None (but coordinate with Task 12.1 if create_purchase_atomic is created)

---

### Task 12.5: Atomic Voucher Token Marking
- Finding: FINDING-E2E-006
- Severity: MEDIUM
- Root Cause: POST /api/vouchers marks tokens as used in a separate query after
  voucher insert. On failure, balance is decremented but tokens remain available.
- Target File: src/app/api/vouchers/route.ts
- Actions:
  1. Create create_voucher_atomic PostgreSQL RPC wrapping:
     - Voucher insert
     - Token status marking (usage_status='used', used_against_voucher_id)
     - Party balance adjustment (client or supplier)
  2. Refactor POST /api/vouchers to call create_voucher_atomic.
- Dependency: None

---

### Task 12.6: Atomic Branch Order Dispatch Stock Deduction
- Finding: FINDING-E2E-009
- Severity: MEDIUM
- Root Cause: Branch order dispatch deducts stock via sequential per-item
  select+compute+update loops instead of the existing adjust_item_stock RPC, creating
  race conditions with concurrent POS sales on the supplying branch.
- Target File: src/app/api/branch-orders/route.ts:298-313
- Actions:
  1. Replace per-item select+compute+update loop in the dispatched handler with
     adjust_item_stock RPC calls (same pattern used in invoices and purchases).
  2. Consider wrapping the entire dispatch action (stock deduction + transfer_value
     persist + audit log) in a branch_order_dispatch_atomic RPC for full atomicity.
- Dependency: None

---

### Task 12.7: Atomic Token Settle-Vendor
- Finding: FINDING-E2E-010
- Severity: MEDIUM
- Root Cause: settle_vendor processes token allocations in a sequential non-atomic
  loop. Mid-loop failure leaves partial settlement with no rollback.
- Target File: src/app/api/tokens/route.ts:449-512
- Actions:
  1. Create settle_tokens_atomic PostgreSQL RPC accepting array of allocations.
  2. Inside RPC: loop allocations within single transaction, update parent rows,
     insert child rows for partial surrender, update usage_status='settled'.
  3. Replace inline loop in settle_vendor handler with single RPC call.
- Dependency: None

---

## 4. Priority 3 — LOW Severity / UX & Control Enhancements

### Task 12.8: Printable Claim Token Receipt for Walk-In Token Retention
- Finding: FINDING-E2E-003
- Severity: LOW
- Target Files:
  - src/components/PosBilling.tsx
  - src/utils/iframePrint.ts
- Actions:
  1. Generate unique serial claim code for issued tokens when client_id is null.
  2. Print token claim voucher block on thermal receipt.
- Dependency: None

---

### Task 12.9: Held Invoice Stock Re-Check Warning on Restore
- Finding: FINDING-E2E-005
- Severity: LOW
- Target File: src/components/PosBilling.tsx (held invoice restore handler)
- Actions:
  1. On restore, compare held items quantities against current live stock_qty.
  2. Display a warning modal if any item's held quantity exceeds current available stock.
- Dependency: None

---

### Task 12.10: Petty Expense Server-Side Amount Upper-Bound Validation
- Finding: FINDING-E2E-007
- Severity: LOW
- Target File: src/app/api/expenses/route.ts
- Actions:
  1. Add server-side maximum amount validation (configurable per tenant, e.g., Rs. 50,000).
  2. Amounts above threshold require supervisor role confirmation flag in request body.
- Dependency: Human decision required on threshold value (see Phase 12 Ambiguities)

---

## 5. Prerequisite Research

Before implementing Task 12.3, inspect and document:
- src/lib/session.ts: Confirm exact behavior of requireTenantAuth(req, null)
  — does it allow any authenticated session or enforce tenant matching?
- DB source of cancel_invoice_atomic and redeem_tokens_atomic PostgreSQL functions
  (verify rollback behavior in DB migration files)

---

## 6. Execution Order (Dependency Graph)

`
Phase 12 Remediation Sequence:
  1. Prerequisite: Audit src/lib/session.ts + DB RPC sources
  2. Task 12.1: create_purchase_atomic RPC (HIGH)
  3. Task 12.2: update_invoice_atomic RPC (HIGH)
  4. Task 12.3: Branch order null tenant auth fix (HIGH)
  5. Task 12.4: purchases.shift_id column + shift reconciliation fix (MEDIUM)
  6. Task 12.5: create_voucher_atomic RPC (MEDIUM)
  7. Task 12.6: Branch dispatch atomic stock deduction (MEDIUM)
  8. Task 12.7: settle_tokens_atomic RPC (MEDIUM)
  9. Task 12.8: Walk-in token claim receipt (LOW)
  10. Task 12.9: Held invoice stock re-check warning (LOW)
  11. Task 12.10: Expense amount upper-bound validation (LOW)
`

---

## 7. Migration Impact Assessment

| Task | DB Migration Required | API Change | Frontend Change |
|---|---|---|---|
| 12.1 | YES — create_purchase_atomic RPC | YES | No |
| 12.2 | YES — update_invoice_atomic RPC | YES | No |
| 12.3 | No | YES | No |
| 12.4 | YES — shift_id column on purchases | YES | YES (pass shift_id on purchase create) |
| 12.5 | YES — create_voucher_atomic RPC | YES | No |
| 12.6 | No | YES | No |
| 12.7 | YES — settle_tokens_atomic RPC | YES | No |
| 12.8 | No | No | YES |
| 12.9 | No | No | YES |
| 12.10 | No | YES | Optional (threshold config) |

---

## 8. No Changes Made in This Phase

NONE — AUDIT ONLY. This plan documents required remediation. No source code,
database, configuration, or dependencies were modified during Phase 12.
