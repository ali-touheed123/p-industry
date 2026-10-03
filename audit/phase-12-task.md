# PHASE 12 AUDIT TASK LIST — END-TO-END WORKFLOW REMEDIATION

**Date:** October 3, 2026
**Phase:** PHASE 12 — End-to-End Real Workflow Testing Forensic Audit
**Status:** AUDIT COMPLETE — Implementation Pending

---

## Priority 1 — HIGH Severity

- [ ] **Task 12.1: Atomic Supplier Purchase Creation & Token Marking** (FINDING-E2E-001)
  - [ ] Create create_purchase_atomic PostgreSQL RPC (purchase header + items + stock + supplier balance + token marking in one transaction)
  - [ ] Refactor POST /api/purchases to call create_purchase_atomic
  - [ ] Remove standalone token marking block (L153-167 purchases/route.ts)

- [ ] **Task 12.2: Atomic Invoice PATCH — create update_invoice_atomic RPC** (FINDING-E2E-004)
  - [ ] Create update_invoice_atomic PostgreSQL RPC (stock revert + item delete + item insert + stock apply + balance delta + header update)
  - [ ] Replace PATCH /api/invoices sequential operations (L445-563) with single RPC call

- [ ] **Task 12.3: Branch Order PATCH — Fix Null Tenant Auth** (FINDING-E2E-008)
  - [ ] Inspect src/lib/session.ts to confirm requireTenantAuth(req, null) behavior
  - [ ] Replace requireTenantAuth(req, null) with tenant-bound call using order party IDs
  - [ ] Validate by action direction: accept/reject -> to_tenant_id, received -> from_tenant_id

---

## Priority 2 — MEDIUM Severity

- [ ] **Task 12.4: Explicit Shift Scoping for Supplier Cash Purchases** (FINDING-E2E-002)
  - [ ] Add shift_id UUID column (nullable FK) to purchases table (Supabase migration)
  - [ ] Update POST /api/purchases to accept and persist shift_id
  - [ ] Update PATCH /api/shifts expected_cash calculation to filter purchases by shift_id (replace L270-283)

- [ ] **Task 12.5: Atomic Voucher Token Marking** (FINDING-E2E-006)
  - [ ] Create create_voucher_atomic PostgreSQL RPC (voucher insert + token marking + balance adjust)
  - [ ] Refactor POST /api/vouchers to call create_voucher_atomic

- [ ] **Task 12.6: Atomic Branch Order Dispatch Stock Deduction** (FINDING-E2E-009)
  - [ ] Replace per-item select+compute+update loop (L298-313 branch-orders/route.ts) with adjust_item_stock RPC calls
  - [ ] Consider branch_order_dispatch_atomic RPC for full atomicity

- [ ] **Task 12.7: Atomic Token Settle-Vendor** (FINDING-E2E-010)
  - [ ] Create settle_tokens_atomic PostgreSQL RPC accepting array of allocations
  - [ ] Replace sequential loop (L449-512 tokens/route.ts) with single RPC call

---

## Priority 3 — LOW Severity / UX Enhancements

- [ ] **Task 12.8: Printable Claim Token Receipt for Walk-In Token Retention** (FINDING-E2E-003)
  - [ ] Generate unique serial claim code when client_id is null on token issuance
  - [ ] Add token claim voucher block to thermal receipt print in PosBilling.tsx

- [ ] **Task 12.9: Held Invoice Stock Re-Check Warning on Restore** (FINDING-E2E-005)
  - [ ] On held invoice restore, compare held item quantities vs current live stock_qty
  - [ ] Show warning modal if any held quantity exceeds current available stock

- [ ] **Task 12.10: Petty Expense Server-Side Amount Upper-Bound Validation** (FINDING-E2E-007)
  - [ ] Add server-side max amount validation in POST /api/expenses
  - [ ] Require supervisor flag for amounts above configurable threshold

---

## Prerequisite Research Tasks

- [ ] Inspect src/lib/session.ts — confirm requireTenantAuth(req, null) exact behavior (for Task 12.3)
- [ ] Inspect DB migration source of cancel_invoice_atomic PostgreSQL function
- [ ] Inspect DB migration source of redeem_tokens_atomic PostgreSQL function
- [ ] Human decision required: Max petty expense threshold value (for Task 12.10)
- [ ] Human decision required: Supplier cash shift attribution model (for Task 12.4)
- [ ] Human decision required: Held invoice stock reservation policy (for Task 12.9)

---

## Execution Order

1. Prerequisite research (session.ts + DB RPC source inspection)
2. Task 12.1 — create_purchase_atomic RPC
3. Task 12.2 — update_invoice_atomic RPC
4. Task 12.3 — Branch order null tenant auth fix
5. Task 12.4 — purchases.shift_id migration + reconciliation fix
6. Task 12.5 — create_voucher_atomic RPC
7. Task 12.6 — Branch dispatch atomic stock fix
8. Task 12.7 — settle_tokens_atomic RPC
9. Task 12.8 — Walk-in token claim receipt
10. Task 12.9 — Held invoice stock re-check
11. Task 12.10 — Expense amount bound validation

---

## Audit Confirmation

NONE — AUDIT ONLY. Zero source code, database, configuration, or dependency changes
were made during Phase 12. All tasks above are scheduled for a future implementation phase.
