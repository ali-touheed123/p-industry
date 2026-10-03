# PHASE 3 IMPLEMENTATION PLAN — AUTHENTICATION & ACCESS CONTROL HARDENING

**Status:** ✅ IMPLEMENTED & VERIFIED  
**Phase:** Phase 3 — Auth / Authorization / Tenant Isolation  
**Completion Date:** October 4, 2026

---

## 1. Overview
This implementation plan specifies fixes for the critical and high severity IDOR vulnerabilities and session hardening items identified during Phase 3 of the Master Forensic Audit.

---

## 2. Planned & Implemented Changes

### PLAN-AUTH-001: Eliminate IDOR Vulnerability in Invoice Modifications ✅ IMPLEMENTED
- **Problem:** `PATCH /api/invoices` allows a tenant user to modify another tenant's invoice and reverse their inventory by passing an ID from a foreign tenant.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-001`
- **Root Cause:** Query `invoices` selected `WHERE id = id` without verifying `tenant_id = target_tenant_id` and failed to compare `oldInvoice.tenant_id === auth.session.tenantId`.
- **Implemented Remediation:**
  1. Fetch old invoice with `.eq('id', id).eq('tenant_id', tenant_id)`.
  2. Guard against foreign tenant with explicit check `if (oldInvoice.tenant_id !== tenant_id) return 403`.
  3. Ensure client balance adjustment query and update enforce `.eq('tenant_id', tenant_id)`.
  4. Ensure final invoice update query enforces `.eq('tenant_id', tenant_id)`.
- **Files Modified:** `src/app/api/invoices/route.ts`
- **Database Objects Affected:** `invoices`, `invoice_items`, `clients`
- **API/RPCs Affected:** `PATCH /api/invoices`
- **Verification Criteria:** Attempting to query/update Tenant B's invoice with a Tenant A JWT returns HTTP 404/403; legitimate same-tenant updates proceed smoothly.
- **Status:** ✅ VERIFIED (14/14 tests passed)

---

### PLAN-AUTH-002: Eliminate IDOR & Reassignment in Catalog Item Updates ✅ IMPLEMENTED
- **Problem:** `PATCH /api/items` allows reassigning an item from one tenant to another or modifying foreign items.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-002`
- **Root Cause:** Caller-supplied `updateFields.tenant_id` took precedence over the database record's existing `tenant_id`.
- **Implemented Remediation:**
  1. Query `items` to retrieve `existingItem.tenant_id` directly from database; if missing return 404.
  2. Verify authorization via `requireTenantAuth(req, existingItem.tenant_id)`.
  3. Strip `updateFields.tenant_id` (`delete (updateFields as any).tenant_id`) to prevent cross-tenant reassignment.
  4. Execute update with `.eq('id', id).eq('tenant_id', existingItem.tenant_id)`.
  5. In `DELETE`, lookup `existingItem` first, authenticate against `existingItem.tenant_id`, and scope delete with `.eq('tenant_id', existingItem.tenant_id)`.
- **Files Modified:** `src/app/api/items/route.ts`
- **Database Objects Affected:** `items` table
- **API/RPCs Affected:** `PATCH /api/items`, `DELETE /api/items`
- **Verification Criteria:** Attempting to update, reassign, or delete Tenant B's item returns HTTP 403/404.
- **Status:** ✅ VERIFIED (14/14 tests passed)

---

### PLAN-AUTH-003: Session Expiration & Invalidation Hardening (AUTH-003) — FORMALLY DEFERRED
- **Problem:** 7-day static stateless JWTs cannot be revoked immediately on logout.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-003`
- **Human Decision:** Confirmed to defer server-side session revocation table/Redis to Phase 13 Wave 3 (Task 13.3.3) and maintain current 7-day stateless JWT for Phase 3.
- **Status:** ✅ FORMALLY DEFERRED TO PHASE 13 WAVE 3 (TASK 13.3.3)
