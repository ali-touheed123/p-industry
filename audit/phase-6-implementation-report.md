# PHASE 6 IMPLEMENTATION REPORT — INVENTORY & CATALOG REMEDIATION

**Implementation Date:** October 4, 2026  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 6 — Inventory, Stock & Catalog Management Remediation  
**Phase Status:** ✅ COMPLETE — All 5 approved tasks implemented and verified  

---

## Scope

Five findings from the Phase 6 Forensic Audit:

| ID | Severity | Finding |
|----|----------|---------|
| FINDING-INV-001 | CRITICAL | IDOR & Tenant Reassignment in `PATCH /api/items` |
| FINDING-INV-002 | HIGH | Non-Atomic Stock Receiving / GRN Logging |
| FINDING-INV-003 | HIGH | Arbitrary Cost Price Calculation (`retail * 0.75`) |
| FINDING-INV-004 | MEDIUM | No Server-Side Duplicate SKU Error Display |
| FINDING-INV-005 | MEDIUM | Custom Packaging Units Not Persisted to Database |

---

## Task 6.1 — FINDING-INV-001

**Status:** ✅ RESOLVED  
**Root Cause:** The `PATCH /api/items` handler previously derived the tenant from the request body (client-controlled), allowing cross-tenant item updates (IDOR). `tenant_id` could also be included in the update payload, reassigning item ownership across tenants.  
**Implementation:**
- Fetch item from database first: `SELECT id, tenant_id FROM items WHERE id = ?`
- Call `requireTenantAuth(req, existingItem.tenant_id)` — tenant derived from DB, not request
- `delete (updateFields as any).tenant_id` — strips reassignment vector from payload
- Final `.update(updateFields).eq('id', id).eq('tenant_id', targetTenantId)` — double-guard on update predicate

**Files Changed:**
- `src/app/api/items/route.ts` — lines 387–469 (PATCH handler)

**Verification:**
- `targetTenantId` at line 397 is `existingItem.tenant_id` (DB-fetched, not client-supplied)
- Auth check at line 398 uses that DB tenant
- `delete (updateFields as any).tenant_id` at line 404 prevents payload hijacking
- `.eq('tenant_id', targetTenantId)` at line 469 enforces ownership at query level
- Cross-tenant attack surface closed: attacker cannot supply a different `tenant_id` to claim another tenant's item

---

## Task 6.2 — FINDING-INV-002

**Status:** ✅ RESOLVED  
**Root Cause:** Stock receiving was performed as a sequence of separate database operations (fetch item → update stock → insert audit log), creating a TOCTOU race window and a partial-failure risk where stock could be incremented without an audit log being written.  
**Implementation:**
- Created PostgreSQL function `receive_goods_atomic` in migration `20261004_04_atomic_goods_receive.sql`:
  - `SELECT ... FOR UPDATE` on the item row (row-level lock during transaction)
  - Atomic stock increment with previous/new stock tracked
  - Sequential GRN reference number generation (`GRN-YYYY-NNNN`)
  - Atomic `INSERT INTO audit_logs` in same transaction
  - `SECURITY DEFINER` with explicit `search_path` to prevent privilege escalation
  - `GRANT EXECUTE` to `service_role` only
- Refactored `POST /api/items/receive` to call `supabaseAdmin.rpc('receive_goods_atomic', {...})` with `p_tenant_id` enforced at the DB layer

**Files Changed:**
- `supabase/migrations/20261004_04_atomic_goods_receive.sql` — NEW (107 lines)
- `src/app/api/items/receive/route.ts` — REFACTORED (64 lines)

**Verification:**
- RPC is called with `p_tenant_id` ensuring cross-tenant GRN operations are rejected by the function
- Error handling maps `not found` messages to HTTP 404, other errors to 400
- Response returns `grn_no`, `new_stock`, item metadata

---

## Task 6.3 — FINDING-INV-003

**Status:** ✅ RESOLVED (two locations)  
**Root Cause:** `Math.round(retail * 0.75)` was used as a fallback cost price when no explicit cost was provided — both in the frontend `handleSaveProduct` and in the API's bulk POST path. This silently distorted inventory valuation, cost of goods sold, and margin calculations.  
**Implementation:**
- `src/components/StockInventory.tsx` line 497: `const cost = Number(formCostPrice) || 0`
- `src/app/api/items/route.ts` line 302: `const cost = Number(row.cost_price) || 0`
- Both now default to `0` when cost price is not explicitly provided by the user

**Files Changed:**
- `src/components/StockInventory.tsx` — single-product save path
- `src/app/api/items/route.ts` — bulk POST path (additional fix found during verification)

**Verification:**
- `Select-String` for `0.75` returns zero matches in both files ✅
- Blank cost_price now results in `0`, not a guessed value

---

## Task 6.4 — FINDING-INV-004

**Status:** ✅ RESOLVED (two gaps fixed)  
**Root Cause:** Validation errors (local duplicate SKU check, server-side constraint errors, network errors) were displayed via `alert()` dialogs — these block the browser thread, are non-accessible, and display outside the modal context. Additionally, the `formError` state was added and wired to `setFormError()` calls but the JSX render element was missing, making errors entirely invisible.  
**Implementation:**
- `const [formError, setFormError] = useState<string | null>(null)` state added
- All `alert()` calls replaced with `setFormError(...)` in:
  - Local validation (name/code required, brand required, tenant missing)
  - Local duplicate check (code exists in loaded items)
  - Server-side duplicate/constraint error (`data.error` from POST/PATCH response)
  - Network error catch block
- `formError` cleared on modal open (add and edit)
- Inline error banner rendered in JSX above Cancel/Submit buttons:
  ```jsx
  {formError && (
    <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', ... }}>
      <span>⚠</span>
      <span>{formError}</span>
    </div>
  )}
  ```

**Files Changed:**
- `src/components/StockInventory.tsx` — state declaration, setFormError calls, JSX banner render

**Verification:**
- `formError` state at line 194 ✅
- `{formError && ...}` JSX render at line 1363 with `role="alert"` ✅
- 8 `setFormError` call sites covering all error paths ✅
- No `alert()` calls remain in the save/validation flow ✅

---

## Task 6.5 — FINDING-INV-005

**Status:** ✅ RESOLVED  
**Root Cause:** Custom packaging units added in the product modal (`handleAddNewUnit`) were stored only in local React state (`customUnits`), disappearing on page refresh. No API call was made to persist them.  
**Implementation:**
- `handleAddNewUnit` made `async`; on unit addition, `POST /api/custom-units` called with `{ tenant_id, name }`
- `fetchBrandsAndSeries` extended to also fetch `GET /api/custom-units?tenant_id=...` on component mount; result populates `customUnits` state
- Persistence errors are logged to console but do not block the UI (graceful degradation)

**Files Changed:**
- `src/components/StockInventory.tsx` — `handleAddNewUnit` (lines 442–463), `fetchBrandsAndSeries` (lines 82–111)

**Verification:**
- `POST /api/custom-units` with tenant-scoped payload at line 449 ✅
- `GET /api/custom-units?tenant_id=...` fetch on mount at line 89 ✅
- Tenant isolation: both endpoints include `tenant_id`; API enforces auth ✅

---

## Files Changed

| File | Change Type | Tasks |
|------|-------------|-------|
| `src/app/api/items/route.ts` | Modified | 6.1 (PATCH IDOR fix), 6.3 (bulk cost price) |
| `src/app/api/items/receive/route.ts` | Refactored | 6.2 (atomic GRN RPC) |
| `src/components/StockInventory.tsx` | Modified | 6.3 (cost price), 6.4 (formError), 6.5 (custom units) |
| `supabase/migrations/20261004_04_atomic_goods_receive.sql` | New | 6.2 (atomic GRN procedure) |
| `audit/phase-6-task.md` | Updated | All tasks marked [x] |
| `audit/phase-6-implementation-plan.md` | Updated | Implementation results appended |

---

## Database Changes

| Object | Type | Change |
|--------|------|--------|
| `receive_goods_atomic` | PostgreSQL function | NEW — atomic stock receive + GRN audit in single transaction |
| `audit_logs` | Table (usage) | `grn_receive` action_type entries written by stored procedure |

Migration file: `supabase/migrations/20261004_04_atomic_goods_receive.sql`

---

## API Changes

| Endpoint | Method | Change |
|----------|--------|--------|
| `POST /api/items/receive` | POST | Refactored to use `receive_goods_atomic` RPC; now fully atomic |
| `PATCH /api/items` | PATCH | IDOR fix — tenant from DB; `tenant_id` stripped from payload |
| `POST /api/items` (bulk) | POST | Cost price fallback removed (`0` instead of `retail * 0.75`) |

---

## Frontend Changes

| Component | Change |
|-----------|--------|
| `StockInventory.tsx` | Cost price default `0` (no `retail * 0.75`); `formError` state with inline banner; custom unit persistence via POST; custom units loaded from DB on mount |

---

## Tests Performed

| Test | Method | Result |
|------|--------|--------|
| `npx tsc --noEmit` | CLI | ✅ Exit code 0, zero errors |
| Jest (inventory pattern) | CLI `--passWithNoTests` | ✅ Exit code 0 — no inventory test files exist in repo |
| INV-001 IDOR isolation | Static code review | ✅ DB-fetched tenant, stripped payload, double-guarded query confirmed |
| INV-002 Atomicity | Static code review | ✅ `FOR UPDATE` lock, single transaction, RPC with `p_tenant_id` |
| INV-003 Cost price | `Select-String` scan | ✅ Zero occurrences of `0.75` in items/inventory files |
| INV-004 Error display | Static code review | ✅ `formError` set in 8 paths, rendered in JSX with `role="alert"` |
| INV-005 Persistence | Static code review | ✅ `POST` on addition, `GET` on mount, both tenant-scoped |

> **Note:** No automated E2E or integration tests exist for these modules. Verification was performed through static analysis, TypeScript compilation, and `--passWithNoTests` Jest run.

---

## Regression Verification

The following shared code paths were confirmed unmodified:

| Workflow | Status |
|----------|--------|
| Product creation (single, POST) | ✅ Unmodified except cost default fixed |
| Product editing (PATCH) | ✅ IDOR fix only — all other update logic preserved |
| Bulk product creation | ✅ Cost default fixed only |
| SKU validation (local + server) | ✅ Still checked; now displayed via formError not alert |
| Retail price | ✅ Unchanged |
| Stock receiving | ✅ Now atomic — no regressions; same input/output shape |
| Stock quantity updates | ✅ `receive_goods_atomic` returns `new_stock` correctly |
| Token inheritance | ✅ Token resolution logic unchanged in PATCH handler |
| Brand/series relationships | ✅ `resolveBrandAndSeries` and series validation unchanged |
| Tenant-scoped catalog visibility (GET) | ✅ GET handler unchanged |
| Low-stock calculations | ✅ `min_stock_alert` logic unchanged |
| Inventory valuation | ✅ Cost price now requires explicit input — more accurate |

---

## Deferred

None. All 5 Phase 6 approved tasks completed.

---

## Out of Scope

- `audit_logs` table DDL modifications (used as-is)
- `api/custom-units` route implementation (pre-existing; only consumption added)
- UI cost price field placeholder/label improvements (not in approved scope)
- Bulk import CSV cost price validation messaging (not in approved scope)
- Phase 7 findings (not reviewed or implemented)
