# PHASE 13 AUDIT TASK LIST — MASTER REMEDIATION ROADMAP

## WAVE 1: CRITICAL SECURITY & ATOMICITY

- [ ] **Task 13.1: Atomic Supplier Purchase RPC (`create_purchase_atomic`)** (MF-001)
  - [ ] Create `create_purchase_atomic` stored procedure in Supabase.
  - [ ] Refactor `src/app/api/purchases/route.ts` to call atomic RPC.

- [ ] **Task 13.2: Record Ownership Filter Enforcement for Client/Supplier IDOR** (MF-002)
  - [ ] Add `.eq('tenant_id', tenantId)` filter to `PATCH /api/clients`.
  - [ ] Add `.eq('tenant_id', tenantId)` filter to `PATCH /api/suppliers`.

- [ ] **Task 13.3: Atomic Token Redemption RPC (`redeem_tokens_atomic`)** (MF-003)
  - [ ] Create `redeem_tokens_atomic` RPC with `FOR UPDATE` balance lock.
  - [ ] Refactor `src/app/api/token-redemptions/route.ts` to invoke atomic RPC.

---

## WAVE 2: OPERATIONAL INTEGRITY

- [ ] **Task 13.4: Atomic Default Receipt Template Switching** (MF-004)
  - [ ] Wrap `is_default` reset in single transaction block in `src/app/api/receipt-templates/route.ts`.

- [ ] **Task 13.5: Shift Scoping for Supplier Cash Purchases** (MF-005)
  - [ ] Add `shift_id` column to `purchases` migration.
  - [ ] Scope shift reconciliation cash calculations in `src/app/api/shifts/route.ts` to `shift_id`.

---

## WAVE 3: THERMAL PRINTING & UX POLISH

- [ ] **Task 13.6: Dynamic Canvas Paper Width Scaling for Thermal Receipts** (MF-006)
  - [ ] Add paper size dynamic scaling in `src/utils/receiptCanvas.ts`.

- [ ] **Task 13.7: Extend Safety Timeout in Hidden Iframe Printer** (MF-007)
  - [ ] Extend iframe cleanup timer from 3s to 30s in `src/utils/iframePrint.ts`.

- [ ] **Task 13.8: Walk-In Customer Token Claim Receipt Generation** (MF-008)
  - [ ] Generate serial claim code and render token slip block in `src/components/PosBilling.tsx`.
