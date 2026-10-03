# PHASE 3 IMPLEMENTATION PLAN — AUTHENTICATION & ACCESS CONTROL HARDENING

**Status:** AWAITING HUMAN APPROVAL (AUDIT ONLY — DO NOT IMPLEMENT YET)  
**Phase:** Phase 3 — Auth / Authorization / Tenant Isolation  
**Dependencies:** Requires human review and Phase 4 API audit completion

---

## 1. Overview
This implementation plan specifies fixes for the critical and high severity IDOR vulnerabilities and session hardening items identified during Phase 3 of the Master Forensic Audit.

---

## 2. Planned Changes

### PLAN-AUTH-001: Eliminate IDOR Vulnerability in Invoice Modifications
- **Problem:** `PATCH /api/invoices` allows a tenant user to modify another tenant's invoice and reverse their inventory by passing an ID from a foreign tenant.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-001`
- **Root Cause:** Query `invoices` selected `WHERE id = id` without verifying `tenant_id = target_tenant_id` and failed to compare `oldInvoice.tenant_id === auth.session.tenantId`.
- **Required Behavior:**
  1. Fetch old invoice with `.eq('id', id).eq('tenant_id', tenant_id)`.
  2. If not found or `oldInvoice.tenant_id !== tenant_id`, reject with HTTP 403 Forbidden.
  3. Ensure all downstream updates and stock adjustments are locked to the verified `tenant_id`.
- **Files Affected:** `src/app/api/invoices/route.ts`
- **Database Objects Affected:** `invoices`, `invoice_items`
- **API/RPCs Affected:** `PATCH /api/invoices`
- **Frontend Areas Affected:** Sales history invoice edit modal in `SalesHistory.tsx`
- **Verification Criteria:** Attempting to update Tenant B's invoice with a Tenant A JWT returns HTTP 403/404; legitimate same-tenant updates proceed smoothly.

---

### PLAN-AUTH-002: Eliminate IDOR & Reassignment in Catalog Item Updates
- **Problem:** `PATCH /api/items` allows reassigning an item from one tenant to another or modifying foreign items.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-002`
- **Root Cause:** Caller-supplied `updateFields.tenant_id` took precedence over the database record's existing `tenant_id`.
- **Required Behavior:**
  1. Query `items` to retrieve `existingItem.tenant_id`.
  2. Verify `auth.session.tenantId === existingItem.tenant_id` (or developer/authorized CEO).
  3. Strip `tenant_id` from `updateFields` to prevent cross-tenant reassignment.
  4. Execute update with `.eq('id', id).eq('tenant_id', existingItem.tenant_id)`.
- **Files Affected:** `src/app/api/items/route.ts`
- **Database Objects Affected:** `items` table
- **API/RPCs Affected:** `PATCH /api/items`
- **Frontend Areas Affected:** Product catalog editor in `StockInventory.tsx`
- **Verification Criteria:** Attempting to update or reassign Tenant B's item returns HTTP 403.

---

### PLAN-AUTH-003: Session Expiration & Invalidation Hardening
- **Problem:** 7-day static stateless JWTs cannot be revoked immediately on logout.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-003`
- **Required Behavior:** Provide configurable session lifespan (e.g. 12-hour session or daily shift alignment) and evaluate Redis/database revocation tokens for high-security environments.
- **Files Affected:** `src/lib/session.ts`, `src/app/api/auth/login/route.ts`
- **Verification Criteria:** Sessions expire within the specified timeframe.
