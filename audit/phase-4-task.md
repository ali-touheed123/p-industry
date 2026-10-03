# PHASE 4 AUDIT TASK LIST — API & BACKEND REMEDIATION

- [x] **Task 4.1: Fix IDOR Vulnerability in `PATCH /api/invoices`** (FINDING-API-001)
  - [x] Add `.eq('tenant_id', auth.session.tenantId)` to initial invoice fetch in `src/app/api/invoices/route.ts`.
  - [x] Verify `oldInvoice.tenant_id === auth.session.tenantId` and reject with 403 Forbidden on mismatch.
  - [x] Bind `tenant_id` on all invoice item deletions and updates.

- [x] **Task 4.2: Fix IDOR & Tenant Reassignment in `PATCH /api/items`** (FINDING-API-002)
  - [x] Strip `tenant_id` from allowed update fields in `src/app/api/items/route.ts`.
  - [x] Scope `.update()` query by `.eq('tenant_id', auth.session.tenantId)`.

- [x] **Task 4.3: Secure Authorization in `PATCH /api/branch-orders`** (FINDING-API-003)
  - [x] Validate caller tenant matches `from_tenant_id` or `to_tenant_id` in `src/app/api/branch-orders/route.ts`.
  - [x] Enforce status mutation restrictions (dispatch by sender, receive by recipient).

- [x] **Task 4.4: Atomic Invoice Modifications via Stored Procedure** (FINDING-API-004)
  - [x] Write `update_invoice_atomic` / atomic stock RPC integration (`adjust_item_stock` / `adjust_item_stock_by_code` per item).
  - [x] Refactor `PATCH /api/invoices` to invoke atomic adjustment RPCs.

- [x] **Task 4.5: Atomic Purchase Order Stock Ingestion** (FINDING-API-005)
  - [x] Verify atomic stock adjustments in purchase flow via `adjust_item_stock` / `adjust_item_stock_by_code` RPCs.
  - [x] Refactor `POST /api/purchases` to use atomic stored procedure / RPCs.

- [x] **Task 4.6: Atomic Inter-Branch Stock Transfers** (FINDING-API-006)
  - [x] Write `process_branch_dispatch_atomic` and `process_branch_receive_atomic` PostgreSQL stored procedures with `FOR UPDATE` locking.
  - [x] Refactor `PATCH /api/branch-orders` dispatch/receive stock logic to use RPCs.

- [x] **Task 4.7: Sanitize PostgREST Input Parameters** (FINDING-API-007 & FINDING-API-008)
  - [x] Create PostgREST parameter sanitizer utility function in `src/lib/utils.ts`.
  - [x] Sanitize search string inputs in `GET /api/invoices` and `GET /api/tenants`.

- [x] **Task 4.8: Strip Employee Directory from Unauthenticated Tenant Lookup** (FINDING-API-009)
  - [x] Remove `app_users` relation query from `GET /api/tenants?slug=...`.

- [x] **Task 4.9: Fix Missing Resource Authorization Fallbacks** (FINDING-API-010 & FINDING-API-011)
  - [x] Return 404 immediately if resource missing before calling `requireTenantAuth` in `held-invoices` and `shifts`.

- [x] **Task 4.10: Implement Missing Vendor Maintenance Handlers** (FINDING-API-012)
  - [x] Add `PATCH /api/suppliers` handler.
  - [x] Add `DELETE /api/suppliers` soft-delete handler.

- [x] **Task 4.11: Fix Predictable Random Code Generators** (FINDING-API-013)
  - [x] Add unique collision retry helper for Client, Supplier, and Voucher code generation.

- [x] **Task 4.12: Enforce Hard Failures on Reconciliation Errors** (FINDING-API-014)
  - [x] Remove fallback to `body.expected_cash` on shift close reconciliation failure in `src/app/api/shifts/route.ts`.

- [x] **Task 4.13: Enforce Scope & Default Pagination on Catalog GET Handlers** (FINDING-API-015 & FINDING-API-016)
  - [x] Add tenant-scoping to `GET /api/receipt-templates`.
  - [x] Add default pagination parameters (`limit = 50`) across all catalog GET routes.
