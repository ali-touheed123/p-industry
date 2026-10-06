# PHASE 12 AUDIT TASK LIST — END-TO-END WORKFLOW REMEDIATION

**Date:** October 7, 2026
**Phase:** PHASE 12 — End-to-End Real Workflow Testing Implementation & Verification
**Status:** IMPLEMENTATION COMPLETE — All 10 Tasks Verified

---

## Priority 1 — HIGH Severity

- [x] **Task 12.1: Atomic Supplier Purchase Creation & Token Marking** (FINDING-E2E-001)
  - [x] Create create_purchase_atomic PostgreSQL RPC (purchase header + items + stock + supplier balance + token marking in one transaction) *(Pre-existing from Phase 7/10 verified)*
  - [x] Refactor POST /api/purchases to call create_purchase_atomic *(Pre-existing from Phase 7/10 verified)*
  - [x] Remove standalone token marking block (L153-167 purchases/route.ts) *(Pre-existing verified)*

- [x] **Task 12.2: Atomic Invoice PATCH — create update_invoice_atomic RPC** (FINDING-E2E-004)
  - [x] Create update_invoice_atomic PostgreSQL RPC (stock revert + item delete + item insert + stock apply + balance delta + header update) *(Implemented in `supabase/migrations/20261007_01_update_invoice_atomic.sql` & deployed to live DB)*
  - [x] Replace PATCH /api/invoices sequential operations (L445-563) with single RPC call *(Implemented in `src/app/api/invoices/route.ts`)*

- [x] **Task 12.3: Branch Order PATCH — Fix Null Tenant Auth** (FINDING-E2E-008)
  - [x] Inspect src/lib/session.ts to confirm requireTenantAuth(req, null) behavior *(Completed: passing null skips tenant matching)*
  - [x] Replace requireTenantAuth(req, null) with tenant-bound call using order party IDs *(Implemented: replaced with getSession(req) strict session check + post-fetch role/tenant validation in `src/app/api/branch-orders/route.ts`)*
  - [x] Validate by action direction: accept/reject -> to_tenant_id, received -> from_tenant_id *(Verified)*

---

## Priority 2 — MEDIUM Severity

- [x] **Task 12.4: Explicit Shift Scoping for Supplier Cash Purchases** (FINDING-E2E-002)
  - [x] Add shift_id UUID column (nullable FK) to purchases table (Supabase migration) *(Pre-existing in live DB schema)*
  - [x] Update POST /api/purchases to accept and persist shift_id *(Pre-existing in `src/app/api/purchases/route.ts`)*
  - [x] Update PATCH /api/shifts expected_cash calculation to filter purchases by shift_id *(Pre-existing via `shift_id.eq.${id}` query in `src/app/api/shifts/route.ts`)*

- [x] **Task 12.5: Atomic Voucher Token Marking** (FINDING-E2E-006)
  - [x] Create create_voucher_atomic PostgreSQL RPC (voucher insert + token marking + balance adjust) *(Pre-existing from Phase 8 verified)*
  - [x] Refactor POST /api/vouchers to call create_voucher_atomic *(Pre-existing from Phase 8 verified)*

- [x] **Task 12.6: Atomic Branch Order Dispatch Stock Deduction** (FINDING-E2E-009)
  - [x] Replace per-item select+compute+update loop (L298-313 branch-orders/route.ts) with adjust_item_stock RPC calls *(Pre-existing from Phase 7/API verified)*
  - [x] Consider branch_order_dispatch_atomic RPC for full atomicity *(Pre-existing `branch_order_dispatch_atomic` RPC in live DB)*

- [x] **Task 12.7: Atomic Token Settle-Vendor** (FINDING-E2E-010)
  - [x] Create settle_tokens_atomic PostgreSQL RPC accepting array of allocations *(Implemented in `supabase/migrations/20261007_02_settle_tokens_atomic.sql` & deployed to live DB)*
  - [x] Replace sequential loop (L449-512 tokens/route.ts) with single RPC call *(Implemented in `src/app/api/tokens/route.ts`)*

---

## Priority 3 — LOW Severity / UX Enhancements

- [x] **Task 12.8: Printable Claim Token Receipt for Walk-In Token Retention** (FINDING-E2E-003)
  - [x] Generate unique serial claim code when client_id is null on token issuance *(Implemented in `src/app/api/tokens/route.ts` & `src/components/PosBilling.tsx`)*
  - [x] Add token claim voucher block to thermal receipt print in PosBilling.tsx *(Implemented in `src/components/PosBilling.tsx` thermal print template)*

- [x] **Task 12.9: Held Invoice Stock Re-Check Warning on Restore** (FINDING-E2E-005)
  - [x] On held invoice restore, compare held item quantities vs current live stock_qty *(Implemented in `src/components/PosBilling.tsx`)*
  - [x] Show warning modal/notification if any held quantity exceeds current available stock *(Implemented in `src/components/PosBilling.tsx`)*

- [x] **Task 12.10: Petty Expense Server-Side Amount Upper-Bound Validation** (FINDING-E2E-007)
  - [x] Add server-side max amount validation in POST /api/expenses *(Implemented in `src/app/api/expenses/route.ts` with Rs. 50,000 threshold)*
  - [x] Require supervisor flag / voucher redirect for amounts above configurable threshold *(Implemented in `src/app/api/expenses/route.ts`)*

---

## Prerequisite Research Tasks

- [x] Inspect src/lib/session.ts — confirm requireTenantAuth(req, null) exact behavior (for Task 12.3)
- [x] Inspect DB migration source of cancel_invoice_atomic PostgreSQL function
- [x] Inspect DB migration source of redeem_tokens_atomic PostgreSQL function
- [x] Human decision resolved: Max petty expense threshold value Rs. 50,000 (for Task 12.10)
- [x] Human decision resolved: Supplier cash shift attribution model via shift_id FK (for Task 12.4)
- [x] Human decision resolved: Held invoice stock warning policy without hard blocking (for Task 12.9)

---

## Final Verification Status

- [x] `npx tsc --noEmit` passed with exit code 0
- [x] Live PostgreSQL database verified for all atomic functions
- [x] Git diff inspected file-by-file
