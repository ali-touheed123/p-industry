# PHASE 6 AUDIT TASK LIST — INVENTORY & CATALOG REMEDIATION

- [x] **Task 6.1: Fix IDOR & Tenant Reassignment in `PATCH /api/items`** (FINDING-INV-001)
  - [x] Strip `tenant_id` from update payload in `src/app/api/items/route.ts`.
  - [x] Scope update predicate with `.eq('tenant_id', targetTenantId)` derived from DB lookup, not request.
  - **Status:** COMPLETE
  - **Files:** `src/app/api/items/route.ts` (lines 387–469)
  - **Acceptance Criteria Met:** DB-fetched tenant used for auth; `tenant_id` stripped from payload; double-guarded update predicate.
  - **Verification:** Static code review confirms `targetTenantId` is derived from `existingItem.tenant_id` (DB), `requireTenantAuth` called with DB tenant, `delete (updateFields as any).tenant_id` prevents payload hijacking, final `.update().eq('tenant_id', targetTenantId)` enforces ownership.

- [x] **Task 6.2: Atomic Stock Receiving with GRN Logging** (FINDING-INV-002)
  - [x] Write `receive_goods_atomic` stored procedure.
  - [x] Refactor `POST /api/items/receive` to execute atomic stored procedure.
  - **Status:** COMPLETE
  - **Files:** `supabase/migrations/20261004_04_atomic_goods_receive.sql`, `src/app/api/items/receive/route.ts`
  - **Acceptance Criteria Met:** Single stored procedure with `SELECT ... FOR UPDATE` row-level lock; stock update + audit log in one transaction; GRN number generated with sequential counter.
  - **Verification:** Static review confirms RPC call with `p_tenant_id` enforces tenant scope inside DB; error handling distinguishes not-found (404) vs bad input (400).

- [x] **Task 6.3: Require Explicit Cost Price Entry** (FINDING-INV-003)
  - [x] Remove `retail * 0.75` arbitrary cost price default in `src/components/StockInventory.tsx`.
  - [x] Remove `retail * 0.75` arbitrary cost price default in `src/app/api/items/route.ts` (bulk POST path — regression found during verification).
  - **Status:** COMPLETE
  - **Files:** `src/components/StockInventory.tsx` (line 496–497), `src/app/api/items/route.ts` (line 301–302)
  - **Acceptance Criteria Met:** Cost defaults to `0` when not explicitly provided; no margin guess in either frontend or API bulk path.
  - **Verification:** `Select-String` confirms no `0.75` pattern in either file.

- [x] **Task 6.4: Server-Side Duplicate SKU Error Handling** (FINDING-INV-004)
  - [x] Display server-returned duplicate SKU constraint errors in inventory form modal.
  - [x] Add inline `formError` banner rendered in JSX (found missing during verification — state was set but not rendered).
  - **Status:** COMPLETE
  - **Files:** `src/components/StockInventory.tsx` (lines 194, 299, 409, 468–553, 1362–1368)
  - **Acceptance Criteria Met:** `formError` state drives inline red banner in modal; local duplicate check (line 486–491) and server-side error (lines 532–549) both route through `setFormError`; `alert()` calls replaced.
  - **Verification:** JSX render at line 1363 confirmed; banner has `role="alert"` for accessibility.

- [x] **Task 6.5: Persist Custom Packaging Units** (FINDING-INV-005)
  - [x] Post newly added custom packaging units to `/api/custom-units` in database.
  - **Status:** COMPLETE
  - **Files:** `src/components/StockInventory.tsx` (lines 442–463, 82–111)
  - **Acceptance Criteria Met:** `handleAddNewUnit` POSTs to `/api/custom-units` with `tenant_id`; custom units fetched from DB on mount via `fetchBrandsAndSeries`; tenant-scoped by `tenant_id` parameter.
  - **Verification:** Static review confirms `POST /api/custom-units` with correct payload; fetch on load at line 89.
