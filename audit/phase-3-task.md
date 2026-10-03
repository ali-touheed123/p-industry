# PHASE 3 TASK BREAKDOWN — AUTHENTICATION & ACCESS CONTROL HARDENING

**Status:** ✅ COMPLETE — All approved tasks implemented and verified (14/14 tests passed, tsc zero errors)  
**Phase:** Phase 3 — Auth / Authorization / Tenant Isolation  
**Completion Date:** October 4, 2026

---

### TASK-3.1: Enforce Tenant Matching in `PATCH /api/invoices` ✅ COMPLETE
- **Objective:** Prevent IDOR in `PATCH /api/invoices` by filtering the initial select with `.eq('tenant_id', tenant_id)` and adding an explicit ownership guard.
- **Problem Being Solved:** Prevents cross-tenant invoice item modification and unauthorized stock manipulation.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-001`
- **Exact Files:** `src/app/api/invoices/route.ts`
- **Exact Function:** `export async function PATCH(req: NextRequest)`
- **Database Changes:** None
- **API Changes:** 
  1. Updated `oldInvoice` lookup with `.eq('id', id).eq('tenant_id', tenant_id)`.
  2. Added explicit ownership check `if (oldInvoice.tenant_id !== tenant_id) return 403`.
  3. Added `.eq('tenant_id', tenant_id)` to client balance adjustment query and update.
  4. Added `.eq('tenant_id', tenant_id)` to final invoice update query.
- **Frontend Changes:** None
- **Acceptance Criteria:** Cross-tenant invoice modification attempts are blocked with 404/403; legitimate same-tenant updates succeed.
- **Verification Status:** ✅ VERIFIED (Runtime integration test against live DB + static AST checks passed)

---

### TASK-3.2: Lock Tenant Ownership & Prevent Reassignment in `PATCH /api/items` ✅ COMPLETE
- **Objective:** Fix `PATCH /api/items` to derive `targetTenantId` strictly from the existing database item and block caller attempts to overwrite `tenant_id`.
- **Problem Being Solved:** Prevents cross-tenant product catalog tampering and item hijacking.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-002`
- **Exact Files:** `src/app/api/items/route.ts`
- **Exact Function:** `export async function PATCH(req: NextRequest)`, `export async function DELETE(req: NextRequest)`
- **Database Changes:** None
- **API Changes:**
  1. In `PATCH`: Fetch `existingItem` first by ID; if not found return 404. Derive `targetTenantId` strictly from `existingItem.tenant_id`.
  2. Authenticate caller via `requireTenantAuth(req, targetTenantId)`.
  3. Strip `updateFields.tenant_id` (`delete (updateFields as any).tenant_id`) to prevent cross-tenant hijacking or reassignment.
  4. Add `.eq('tenant_id', targetTenantId)` to update query.
  5. In `DELETE`: Fetch `existingItem` first; if not found return 404. Authenticate caller via `requireTenantAuth(req, existingItem.tenant_id)`. Enforce `.eq('tenant_id', existingItem.tenant_id)` on delete.
- **Frontend Changes:** None
- **Acceptance Criteria:** Cross-tenant item modification, reassignment, or deletion is rejected with 403/404; legitimate same-tenant operations succeed.
- **Verification Status:** ✅ VERIFIED (Runtime integration test against live DB + static AST checks passed)

---

### TASK-3.3: Session Revocation Hardening (AUTH-003) — FORMAL DECISION RECORD
- **Decision:** Human decision confirmed to defer server-side session revocation table/Redis to Phase 13 Wave 3 (Task 13.3.3) and maintain current 7-day stateless JWT for Phase 3.
- **Action:** No architectural changes in Phase 3; formal deferral documented for Phase 13 remediation.

---

### TASK-3.4: Ambiguous Multi-Branch Login Resolution (AUTH-004) — VERIFIED MITIGATED
- **Status:** Evaluated and confirmed mitigated by global unique constraint on `app_users.username`. No Phase 3 code changes approved or required.
