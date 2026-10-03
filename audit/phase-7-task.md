# PHASE 7 AUDIT TASK LIST — PROCUREMENT REMEDIATION

- [ ] **Task 7.1: Encapsulate Purchase Execution in Atomic Stored Procedure** (FINDING-PROC-001)
  - [ ] Write `create_purchase_atomic` PostgreSQL procedure.
  - [ ] Refactor `POST /api/purchases` to use atomic RPC.

- [ ] **Task 7.2: Implement Purchase Modification Endpoints** (FINDING-PROC-002)
  - [ ] Add `PATCH /api/purchases` handler.
  - [ ] Add `DELETE /api/purchases` cancellation handler.

- [ ] **Task 7.3: Unique Purchase Order Identifier Generation** (FINDING-PROC-003)
  - [ ] Replace `Math.random()` 4-digit purchase invoice generator with collision-resistant format.
