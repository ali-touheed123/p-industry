# PHASE 3 TASK BREAKDOWN — AUTHENTICATION & ACCESS CONTROL HARDENING

**Status:** AWAITING HUMAN APPROVAL (PLANNING ONLY — DO NOT EXECUTE YET)  
**Phase:** Phase 3 — Auth / Authorization / Tenant Isolation

---

### TASK-3.1: Enforce Tenant Matching in `PATCH /api/invoices`
- **Objective:** Prevent IDOR in `PATCH /api/invoices` by filtering the initial select with `.eq('tenant_id', tenant_id)` and adding an explicit ownership guard.
- **Problem Being Solved:** Prevents cross-tenant invoice item modification and unauthorized stock manipulation.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-001`
- **Exact Files:** `src/app/api/invoices/route.ts`
- **Exact Function:** `export async function PATCH(req: NextRequest)`
- **Database Changes:** None
- **API Changes:** Update line 449 to `.eq('id', id).eq('tenant_id', tenant_id)`. If not found, return HTTP 404/403.
- **Frontend Changes:** None
- **Acceptance Criteria:** Cross-tenant invoice modification attempts are blocked with 403/404; existing tests for valid invoice edits pass.

---

### TASK-3.2: Lock Tenant Ownership & Prevent Reassignment in `PATCH /api/items`
- **Objective:** Fix `PATCH /api/items` to derive `targetTenantId` strictly from the existing database item and block caller attempts to overwrite `tenant_id`.
- **Problem Being Solved:** Prevents cross-tenant product catalog tampering and item hijacking.
- **Evidence:** `audit/phase-3-audit-report.md#FINDING-AUTH-002`
- **Exact Files:** `src/app/api/items/route.ts`
- **Exact Function:** `export async function PATCH(req: NextRequest)`
- **Database Changes:** None
- **API Changes:** Fetch `existingItem` first, extract `existingItem.tenant_id`, call `requireTenantAuth(req, existingItem.tenant_id)`, delete `updateFields.tenant_id`, and add `.eq('tenant_id', existingItem.tenant_id)` to the update query.
- **Frontend Changes:** None
- **Acceptance Criteria:** Cross-tenant item modification or reassignment is rejected with 403.
