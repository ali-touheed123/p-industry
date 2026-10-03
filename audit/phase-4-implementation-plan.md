# PHASE 4 IMPLEMENTATION PLAN — API & BACKEND REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 4 — API / Backend Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 17 backend security, atomicity, and API contract defects discovered during the Phase 4 Forensic Audit.

---

## 2. Prioritized Remediation Steps

### Priority 0: Critical Security & IDOR Vulnerabilities

#### Task 4.1: Fix IDOR Vulnerability in `PATCH /api/invoices` (FINDING-API-001)
- **Target File:** `src/app/api/invoices/route.ts`
- **Actions:**
  1. Add `.eq('tenant_id', auth.session.tenantId)` to initial `oldInvoice` fetch query.
  2. Verify `oldInvoice.tenant_id === auth.session.tenantId`. If mismatch, immediately throw HTTP 403 Forbidden.
  3. Ensure all downstream queries (`invoice_items` delete, invoice update, stock updates) pass `auth.session.tenantId`.

#### Task 4.2: Fix IDOR & Tenant Reassignment in `PATCH /api/items` (FINDING-API-002)
- **Target File:** `src/app/api/items/route.ts`
- **Actions:**
  1. Strip `tenant_id` from `updateFields` payload before executing DB query to prevent item theft.
  2. Modify `.update(updateFields).eq('id', id)` to `.update(updateFields).eq('id', id).eq('tenant_id', auth.session.tenantId)`.

#### Task 4.3: Secure Authorization in `PATCH /api/branch-orders` (FINDING-API-003)
- **Target File:** `src/app/api/branch-orders/route.ts`
- **Actions:**
  1. Query `branch_orders` record and check that `auth.session.tenantId` matches either `from_tenant_id` or `to_tenant_id`.
  2. Restrict status transition permissions: Only `from_tenant_id` can dispatch, only `to_tenant_id` can receive.

---

### Priority 1: High Severity Atomicity & Injection Defects

#### Task 4.4: Atomic Invoice Modifications via Stored Procedure (FINDING-API-004)
- **Target File:** `supabase/migrations/` & `src/app/api/invoices/route.ts`
- **Actions:**
  1. Create stored procedure `update_invoice_atomic(p_invoice_id, p_tenant_id, p_updates, p_new_items)` handling stock reversal, item deletion, item re-insertion, new stock deduction, and ledger update in a single DB transaction.
  2. Refactor `PATCH /api/invoices` handler to invoke `update_invoice_atomic`.

#### Task 4.5: Atomic Purchase Order Stock Ingestion (FINDING-API-005)
- **Target File:** `supabase/migrations/` & `src/app/api/purchases/route.ts`
- **Actions:**
  1. Create stored procedure `create_purchase_atomic(p_tenant_id, p_purchase_data, p_items)`.
  2. Replace loop of un-isolated `adjust_item_stock` RPCs in `POST /api/purchases` with `create_purchase_atomic`.

#### Task 4.6: Atomic Inter-Branch Stock Transfers (FINDING-API-006)
- **Target File:** `supabase/migrations/` & `src/app/api/branch-orders/route.ts`
- **Actions:**
  1. Create stored procedure `process_branch_order_status_change(p_order_id, p_tenant_id, p_new_status)`.
  2. Perform dual-store stock deductions/additions inside single atomic transaction.

#### Task 4.7: Sanitize PostgREST Input Parameters (FINDING-API-007 & FINDING-API-008)
- **Target Files:** `src/app/api/invoices/route.ts`, `src/app/api/tenants/route.ts`
- **Actions:**
  1. Implement a PostgREST parameter sanitizer utility function in `src/lib/utils.ts` to strip PostgREST special syntax characters (`,`, `(`, `)`, `.`, `:`).
  2. Wrap search strings in `GET /api/invoices` and owner email variables in `GET /api/tenants` using the sanitizer function.

---

### Priority 2: Medium Severity Data Exposure & Maintenance Gaps

#### Task 4.8: Strip Employee List from Unauthenticated Tenant Lookup (FINDING-API-009)
- **Target File:** `src/app/api/tenants/route.ts`
- **Actions:**
  1. Remove `app_users(id, username, full_name, role)` from `GET /api/tenants?slug=...` query select list.

#### Task 4.9: Fix Missing Resource Authorization Fallbacks (FINDING-API-010 & FINDING-API-011)
- **Target Files:** `src/app/api/held-invoices/route.ts`, `src/app/api/items/route.ts`
- **Actions:**
  1. If target resource does not exist, return HTTP 404 immediately before authorization evaluation.
  2. Always pass `auth.session.tenantId` to `requireTenantAuth`.

#### Task 4.10: Implement Missing Vendor Maintenance Handlers (FINDING-API-012)
- **Target File:** `src/app/api/suppliers/route.ts`
- **Actions:**
  1. Add `PATCH /api/suppliers` handler for updating supplier details.
  2. Add `DELETE /api/suppliers` handler for soft-deleting suppliers (`is_deleted = true`).

#### Task 4.11: Fix Predictable Random Code Generators (FINDING-API-013)
- **Target Files:** `src/app/api/clients/route.ts`, `src/app/api/suppliers/route.ts`, `src/app/api/vouchers/route.ts`
- **Actions:**
  1. Implement unique identifier generation utility with collision retry loop.

---

### Priority 3: Low Severity Quality & Infrastructure Enhancements

#### Task 4.12: Hard Failure on Shift Cash Reconciliation Errors (FINDING-API-014)
- **Target File:** `src/app/api/shifts/route.ts`
- **Actions:** Remove silent fallback to `body.expected_cash` on server reconciliation exception. Throw HTTP 500.

#### Task 4.13: Enforce Scope & Default Pagination on GET Catalog Endpoints (FINDING-API-015 & FINDING-API-016)
- **Target Files:** Catalog route handlers (`/api/items`, `/api/clients`, `/api/suppliers`, `/api/receipt-templates`)
- **Actions:**
  1. Add tenant-scoping to `GET /api/receipt-templates`.
  2. Enforce default pagination (`limit=50`) on all mass catalog endpoints.
