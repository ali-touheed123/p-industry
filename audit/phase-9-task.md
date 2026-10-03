# PHASE 9 AUDIT TASK LIST — AI PAINT TOKEN REMEDIATION

- [ ] **Task 9.1: Encapsulate Vendor Token Surrender in Atomic Stored Procedure** (FINDING-TOK-001)
  - [ ] Write `settle_tokens_vendor_atomic` PostgreSQL procedure.
  - [ ] Refactor `POST /api/tokens` (`type = 'settle_vendor'`) to use atomic RPC.

- [ ] **Task 9.2: Unique Token Voucher Code Generation** (FINDING-TOK-003)
  - [ ] Replace 2-digit random suffix for token vouchers in `src/app/api/tokens/route.ts` with collision-resistant format.

- [ ] **Task 9.3: Deprecate Legacy Summary API Parameter Stub** (FINDING-TOK-002)
  - [ ] Remove legacy `summary=redeemable` parameter stub from `src/app/api/tokens/route.ts`.
