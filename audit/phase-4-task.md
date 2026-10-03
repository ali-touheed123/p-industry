# PHASE 4 AUDIT TASK LIST — API & BACKEND REMEDIATION

- [ ] **Task 4.1: Fix IDOR Vulnerability in `PATCH /api/invoices`** (FINDING-API-001)
  - [ ] Add `.eq('tenant_id', auth.session.tenantId)` to initial invoice fetch in `src/app/api/invoices/route.ts`.
  - [ ] Verify `oldInvoice.tenant_id === auth.session.tenantId` and reject with 403 Forbidden on mismatch.
  - [ ] Bind `tenant_id` on all invoice item deletions and updates.

- [ ] **Task 4.2: Fix IDOR & Tenant Reassignment in `PATCH /api/items`** (FINDING-API-002)
  - [ ] Strip `tenant_id` from allowed update fields in `src/app/api/items/route.ts`.
  - [ ] Scope `.update()` query by `.eq('tenant_id', auth.session.tenantId)`.

- [ ] **Task 4.3: Secure Authorization in `PATCH /api/branch-orders`** (FINDING-API-003)
  - [ ] Validate caller tenant matches `from_tenant_id` or `to_tenant_id` in `src/app/api/branch-orders/route.ts`.
  - [ ] Enforce status mutation restrictions (dispatch by sender, receive by recipient).

- [ ] **Task 4.4: Atomic Invoice Modifications via Stored Procedure** (FINDING-API-004)
  - [ ] Write `update_invoice_atomic` PostgreSQL stored procedure.
  - [ ] Refactor `PATCH /api/invoices` to invoke `update_invoice_atomic`.

- [ ] **Task 4.5: Atomic Purchase Order Stock Ingestion** (FINDING-API-005)
  - [ ] Write `create_purchase_atomic` PostgreSQL stored procedure.
  - [ ] Refactor `POST /api/purchases` to use atomic stored procedure.

- [ ] **Task 4.6: Atomic Inter-Branch Stock Transfers** (FINDING-API-006)
  - [ ] Write `process_branch_order_status_change` PostgreSQL stored procedure.
  - [ ] Refactor `PATCH /api/branch-orders` dispatch/receive stock logic to use RPC.

- [ ] **Task 4.7: Sanitize PostgREST Input Parameters** (FINDING-API-007 & FINDING-API-008)
  - [ ] Create PostgREST parameter sanitizer utility function in `src/lib/utils.ts`.
  - [ ] Sanitize search string inputs in `GET /api/invoices` and `GET /api/tenants`.

- [ ] **Task 4.8: Strip Employee Directory from Unauthenticated Tenant Lookup** (FINDING-API-009)
  - [ ] Remove `app_users` relation query from `GET /api/tenants?slug=...`.

- [ ] **Task 4.9: Fix Missing Resource Authorization Fallbacks** (FINDING-API-010 & FINDING-API-011)
  - [ ] Return 404 immediately if resource missing before calling `requireTenantAuth` in `held-invoices` and `items`.

- [ ] **Task 4.10: Implement Missing Vendor Maintenance Handlers** (FINDING-API-012)
  - [ ] Add `PATCH /api/suppliers` handler.
  - [ ] Add `DELETE /api/suppliers` soft-delete handler.

- [ ] **Task 4.11: Fix Predictable Random Code Generators** (FINDING-API-013)
  - [ ] Add unique collision retry helper for Client, Supplier, and Voucher code generation.

- [ ] **Task 4.12: Enforce Hard Failures on Reconciliation Errors** (FINDING-API-014)
  - [ ] Remove fallback to `body.expected_cash` on shift close reconciliation failure in `src/app/api/shifts/route.ts`.

- [ ] **Task 4.13: Enforce Scope & Default Pagination on Catalog GET Handlers** (FINDING-API-015 & FINDING-API-016)
  - [ ] Add tenant-scoping to `GET /api/receipt-templates`.
  - [ ] Add default pagination parameters (`limit = 50`) across all catalog GET routes.
