# PHASE 8 AUDIT TASK LIST — FINANCIAL LEDGERS REMEDIATION

- [ ] **Task 8.1: Encapsulate Voucher Processing in Atomic Stored Procedure** (FINDING-LEDG-001)
  - [ ] Write `create_voucher_atomic` PostgreSQL procedure.
  - [ ] Refactor `POST /api/vouchers` to execute atomic RPC.

- [ ] **Task 8.2: Unique Voucher Code Generation** (FINDING-LEDG-002)
  - [ ] Replace `Math.random()` 4-digit voucher generator in `src/app/api/vouchers/route.ts` with collision-resistant format.

- [ ] **Task 8.3: Enforce Pagination on Voucher Fetch Endpoint** (FINDING-LEDG-003)
  - [ ] Add `limit` parameter to `GET /api/vouchers` query in `src/app/api/vouchers/route.ts`.
