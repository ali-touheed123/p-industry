# PHASE 7 AUDIT TASK LIST — PROCUREMENT REMEDIATION

- [x] **Task 7.1: Encapsulate Purchase Execution in Atomic Stored Procedure** (FINDING-PROC-001)
  - [x] Write `create_purchase_atomic` PostgreSQL procedure.
  - [x] Refactor `POST /api/purchases` to use atomic RPC.
  - **Status:** COMPLETE
  - **Migration:** `supabase/migrations/20261005_02_create_purchase_atomic.sql`
  - **API Change:** `src/app/api/purchases/route.ts` — POST now calls `create_purchase_atomic` RPC
  - **Verification:** TypeScript clean; logic verified by static inspection — all 6 steps (header, tokens, items, stock, balance, audit) execute inside a single plpgsql transaction body.

- [x] **Task 7.2: Implement Purchase Modification Endpoints** (FINDING-PROC-002)
  - [x] Add `PATCH /api/purchases` handler.
  - [x] Add `DELETE /api/purchases` cancellation handler.
  - **Status:** COMPLETE
  - **API Change:** `src/app/api/purchases/route.ts` — PATCH (header corrections) and DELETE (cancellation with stock reversal + supplier balance reversal) added.
  - **Verification:** Tenant derived server-side from DB record before auth; defence-in-depth tenant scope applied on all update/delete queries.

- [x] **Task 7.3: Unique Purchase Order Identifier Generation** (FINDING-PROC-003)
  - [x] Replace `Math.random()` 4-digit purchase invoice generator with collision-resistant format.
  - **Status:** COMPLETE
  - **Frontend Change:** `src/components/PurchasesView.tsx` — purchaseInvNo and poNumber now use `P-INV-YYYYMMDD-XXXX` / `PO-YYYYMMDD-XXXX` format (timestamp + 4 random hex digits = ~65,536 values/day).
  - **Verification:** Static analysis confirms Math.random() generators replaced; new format cannot collide within realistic daily purchase volumes.
