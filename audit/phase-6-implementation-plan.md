# PHASE 6 IMPLEMENTATION PLAN — INVENTORY & CATALOG REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 6 — Inventory, Stock & Catalog Management Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 5 catalog, receiving atomicity, cost price calculation, and tenant isolation defects identified in the Phase 6 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 0: Critical Security & IDOR Fixes

#### Task 6.1: Fix IDOR & Tenant Reassignment in `PATCH /api/items` (FINDING-INV-001)
- **Target File:** `src/app/api/items/route.ts`
- **Actions:**
  1. Strip `tenant_id` from `updateFields` payload to prevent cross-tenant item reassignment.
  2. Append `.eq('tenant_id', auth.session.tenantId)` to update query.

---

### Priority 1: High Severity Atomicity & Financial Valuation Fixes

#### Task 6.2: Atomic Stock Receiving with GRN Logging (FINDING-INV-002)
- **Target Files:** `supabase/migrations/`, `src/app/api/items/receive/route.ts`
- **Actions:**
  1. Create stored procedure `receive_goods_atomic(p_tenant_id, p_item_id, p_qty, p_batch_no, p_supplier_ref, p_received_by)` that logs a GRN ledger entry and increments inventory atomically.
  2. Refactor `POST /api/items/receive` to invoke `receive_goods_atomic`.

#### Task 6.3: Require Explicit Cost Price Entry (FINDING-INV-003)
- **Target File:** `src/components/StockInventory.tsx`
- **Actions:**
  1. Remove `Math.round(retail * 0.75)` arbitrary cost price calculation in `handleSaveProduct`.
  2. Default `cost_price` to `0` or require explicit cost price input from user.

---

### Priority 2: Medium Severity SKU Validation & Custom Unit Persistence

#### Task 6.4: Server-Side Duplicate SKU Error Handling (FINDING-INV-004)
- **Target File:** `src/components/StockInventory.tsx`
- **Actions:**
  1. Handle HTTP 409 / DB unique constraint errors returned by `/api/items` gracefully in UI.

#### Task 6.5: Persist Custom Packaging Units (FINDING-INV-005)
- **Target Files:** `src/components/StockInventory.tsx`, `src/app/api/custom-units/route.ts`
- **Actions:**
  1. Save custom packaging units created in inventory modal to `/api/custom-units` database table.

---

## 3. Actual Implementation — Results

**Implementation Date:** October 4, 2026

### Task 6.1 — FINDING-INV-001 (IDOR in PATCH /api/items)
- **Status:** COMPLETE (already implemented in baseline codebase)
- **Actual Implementation:** `src/app/api/items/route.ts` PATCH handler:
  - Fetches item from DB first (`SELECT id, tenant_id, ... FROM items WHERE id = ?`)
  - Calls `requireTenantAuth(req, existingItem.tenant_id)` — tenant derived from DB, not request
  - `delete (updateFields as any).tenant_id` — strips payload hijacking vector
  - Final update query uses `.eq('tenant_id', targetTenantId)` as double guard
- **Deviation from Plan:** Plan said "append .eq('tenant_id', auth.session.tenantId)" — actual implementation is stronger: tenant is fetched from DB first, not from session claim, and then session is validated against that DB tenant.

### Task 6.2 — FINDING-INV-002 (Atomic GRN)
- **Status:** COMPLETE
- **Database Changes:** `supabase/migrations/20261004_04_atomic_goods_receive.sql`
  - Function `receive_goods_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT)` created with `SECURITY DEFINER`
  - `SELECT ... FOR UPDATE` row-level lock on items table
  - Stock update + audit_log insert in single atomic transaction
  - Sequential GRN numbering (`GRN-YYYY-NNNN`) via COUNT of prior GRN records
  - GRANT to `service_role`
- **API Changes:** `src/app/api/items/receive/route.ts` refactored from manual multi-step to single `supabaseAdmin.rpc('receive_goods_atomic', {...})` call with tenant-scoped parameters.

### Task 6.3 — FINDING-INV-003 (Explicit Cost Price)
- **Status:** COMPLETE (two locations fixed)
- **Files Changed:**
  - `src/components/StockInventory.tsx` line 496–497: `const cost = Number(formCostPrice) || 0`
  - `src/app/api/items/route.ts` line 301–302: `const cost = Number(row.cost_price) || 0` (bulk POST path — found during verification)
- **Deviation from Plan:** Plan only listed frontend fix. During verification, the server-side bulk POST path also had the same `retail * 0.75` fallback and was fixed.

### Task 6.4 — FINDING-INV-004 (Duplicate SKU Error Display)
- **Status:** COMPLETE (two gaps fixed)
- **Files Changed:** `src/components/StockInventory.tsx`
  - Added `const [formError, setFormError] = useState<string | null>(null)` state
  - Replaced all `alert()` calls with `setFormError(...)` calls (local validation + server errors)
  - Added inline error banner JSX at line 1362–1368 with `role="alert"` (found missing during verification — state was set but never rendered)
- **Deviation from Plan:** Plan framed this as handling HTTP 409 responses. Actual implementation handles all API error strings returned in `data.error`, not just 409.

### Task 6.5 — FINDING-INV-005 (Custom Unit Persistence)
- **Status:** COMPLETE
- **Files Changed:** `src/components/StockInventory.tsx`
  - `handleAddNewUnit` made `async`; `POST /api/custom-units` with `{ tenant_id, name }` on unit addition
  - `fetchBrandsAndSeries` now fetches `GET /api/custom-units?tenant_id=...` on component mount — loaded units populate `customUnits` state
- **Tenant Isolation:** Both fetch and POST include `tenant_id`; server-side API enforces tenant auth.

---

## 4. Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Exit code 0 — zero errors |
| Jest (inventory pattern) | ✅ Exit code 0 — no tests found (`--passWithNoTests`) |
| INV-001 static check | ✅ DB-fetched tenant, stripped payload, double-guarded query |
| INV-002 static check | ✅ RPC called with `p_tenant_id`, migration confirmed |
| INV-003 static check | ✅ No `0.75` pattern in any item-related file |
| INV-004 static check | ✅ `formError` state set + rendered in JSX at line 1363 |
| INV-005 static check | ✅ `POST /api/custom-units` in `handleAddNewUnit`, fetch on mount |

---

## 5. Deferred Issues

None. All 5 approved Phase 6 tasks were completed.

## 6. Out-of-Scope Issues Not Modified

- Bulk product creation cost price labelling in UI (no `cost_price` placeholder text was changed — only the server-side default was corrected)
- `audit_logs` table schema (used as-is; `grn_receive` action_type added via stored procedure only)
- Custom units `api/custom-units` route itself (already existed; only consumption was added)

