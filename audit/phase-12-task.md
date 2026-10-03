# PHASE 12 AUDIT TASK LIST — END-TO-END WORKFLOW REMEDIATION

- [ ] **Task 12.1: Atomic Supplier Purchase Creation & Token Status Marking** (FINDING-E2E-001)
  - [ ] Create `create_purchase_atomic` RPC in Supabase.
  - [ ] Refactor `src/app/api/purchases/route.ts` to execute atomic RPC.

- [ ] **Task 12.2: Explicit Shift Scoping for Supplier Cash Purchases** (FINDING-E2E-002)
  - [ ] Add `shift_id` column to `purchases` migration.
  - [ ] Update `src/app/api/shifts/route.ts` server-side expected cash calculation to filter purchases by `shift_id`.

- [ ] **Task 12.3: Printable Claim Token Receipt for Walk-In Token Retention** (FINDING-E2E-003)
  - [ ] Add token claim code generator and receipt slip rendering for walk-in token issuance in `src/components/PosBilling.tsx`.
