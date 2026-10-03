# PHASE 6 AUDIT TASK LIST — INVENTORY & CATALOG REMEDIATION

- [ ] **Task 6.1: Fix IDOR & Tenant Reassignment in `PATCH /api/items`** (FINDING-INV-001)
  - [ ] Strip `tenant_id` from update payload in `src/app/api/items/route.ts`.
  - [ ] Scope update predicate with `.eq('tenant_id', auth.session.tenantId)`.

- [ ] **Task 6.2: Atomic Stock Receiving with GRN Logging** (FINDING-INV-002)
  - [ ] Write `receive_goods_atomic` stored procedure.
  - [ ] Refactor `POST /api/items/receive` to execute atomic stored procedure.

- [ ] **Task 6.3: Require Explicit Cost Price Entry** (FINDING-INV-003)
  - [ ] Remove `retail * 0.75` arbitrary cost price default in `src/components/StockInventory.tsx`.

- [ ] **Task 6.4: Server-Side Duplicate SKU Error Handling** (FINDING-INV-004)
  - [ ] Display server-returned duplicate SKU constraint errors in inventory form modal.

- [ ] **Task 6.5: Persist Custom Packaging Units** (FINDING-INV-005)
  - [ ] Post newly added custom packaging units to `/api/custom-units` table in database.
