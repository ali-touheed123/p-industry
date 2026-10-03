# PHASE 6 REPORT — INVENTORY, STOCK & CATALOG MANAGEMENT FORENSIC AUDIT

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 6 — Inventory, Stock & Catalog Management Forensic Audit  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE MODIFIED  

---

## 1. Scope

Comprehensive forensic audit of the catalog management engine, product master data integrity, bulk item creation, stock receiving/GRN workflows, unit conversion logic, low-stock alerts, and brand/series token inheritance:
- Stock Inventory UI & Filter Engine (`src/components/StockInventory.tsx`)
- Item Catalog Route Handler (`src/app/api/items/route.ts`)
- Inward Goods Receiving Handler (`src/app/api/items/receive/route.ts`)
- Master Brands & Series APIs (`src/app/api/brands/route.ts`, `src/app/api/brand-series/route.ts`)
- Packaging Units API (`src/app/api/custom-units/route.ts`)

---

## 2. Files Inspected

- [src/components/StockInventory.tsx](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/StockInventory.tsx) (1,672 lines) — Main inventory workspace, catalog table, low-stock alerts, single/bulk product creation modals, GRN receiving modal
- [src/app/api/items/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/route.ts) (508 lines) — Item CRUD handler & bulk item insertion engine
- [src/app/api/items/receive/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/receive/route.ts) (105 lines) — Inward goods receiving & stock increment RPC
- [src/app/api/brands/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/brands/route.ts) (165 lines) — Brand master CRUD
- [src/app/api/brand-series/route.ts](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/brand-series/route.ts) (220 lines) — Brand series CRUD

---

## 3. Database Objects Inspected

- `public.items` (`id`, `tenant_id`, `code`, `name`, `category`, `brand`, `brand_id`, `series_id`, `unit`, `pack_size`, `shade_code`, `cost_price`, `retail_price`, `stock_qty`, `min_stock_alert`, `has_token`, `token_value`)
- `public.brands` (`id`, `tenant_id`, `name`)
- `public.brand_series` (`id`, `tenant_id`, `brand_id`, `name`, `is_active`)
- `public.token_configs` (`id`, `tenant_id`, `series_id`, `unit_name`, `token_value`, `is_enabled`)
- Stored Procedure: `adjust_item_stock`

---

## 4. Inventory Module Audit Matrix

| Component / Endpoint | Functionality | Tenant Scoping | Concurrency & Atomicity | SKU Uniqueness Check |
|---|---|---|---|---|
| `StockInventory.tsx` | Catalog UI & Filtering | ✅ Bound via props | N/A (Client View) | ⚠️ **MEDIUM (Local state scope limit)** |
| `POST /api/items` (Single) | Create Item | ✅ Bound via session | ✅ Single insert | ✅ Enforced via unique constraint |
| `POST /api/items` (Bulk) | Bulk Product Import | ✅ Bound via session | ⚠️ **HIGH (Non-atomic loop insertion)** | ✅ Error array returned |
| `PATCH /api/items` | Edit Product | 🚨 **CRITICAL FAIL (IDOR)** | ✅ Single update | ✅ Code validation |
| `POST /api/items/receive` | Inward Goods (GRN) | ✅ Bound via session | 🚨 **HIGH (Non-atomic stock adjustment)** | N/A |

---

## 5. Verified Correct (Inventory Strengths)

1. **Automatic Token Value Inheritance:**
   - `StockInventory.tsx:132-139` dynamically resolves token values for items based on their `series_id` and packaging `unit` configuration (`resolveInheritedToken`). Cashiers and inventory managers cannot manually override token values at the product level, preventing token fraud.
2. **Flexible Bulk Product Creation Modal:**
   - `StockInventory.tsx:326-398` provides a multi-row bulk product entry modal with auto-generated composite item names (`BRAND CATEGORY SHADE`).
3. **Covering Inventory Valuation Metrics:**
   - Top KPI bar accurately computes total SKUs, total units in stock, low stock alert count, and total stock valuation at cost (`totalValuation`).

---

## 6. Detailed Findings

### FINDING-INV-001
- **Severity:** CRITICAL
- **Category:** Insecure Direct Object References (IDOR) / Tenant Inventory Reassignment
- **Location:** [src/app/api/items/route.ts:462-466](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/route.ts#L462-L466)
- **Component:** `PATCH /api/items`
- **Evidence:**
  ```typescript
  // Line 392: Evaluates auth against update body tenant_id
  const auth = await requireTenantAuth(req, updateFields.tenant_id || existingItem.tenant_id);

  // Line 462: Executes update by ID alone without tenant_id predicate!
  const { data, error } = await supabaseAdmin
    .from('items')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();
  ```
- **Actual Behavior:** An attacker from Tenant A submits a `PATCH` request with `id = Item_ID_from_Tenant_B` and `updateFields.tenant_id = Tenant_A_ID`. The item is updated in place, reassigning its ownership to Tenant A.
- **Expected Behavior:** The update query MUST include `.eq('tenant_id', auth.session.tenantId)` and strip `tenant_id` from allowed update fields.
- **Impact:** Cross-tenant catalog item theft and inventory modification.
- **Verification Status:** VERIFIED

---

### FINDING-INV-002
- **Severity:** HIGH
- **Category:** Transaction Isolation / Non-Atomic Stock Receiving
- **Location:** [src/app/api/items/receive/route.ts:58-95](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/app/api/items/receive/route.ts#L58-L95)
- **Component:** `POST /api/items/receive`
- **Evidence:**
  Inward goods receiving executes an un-isolated `adjust_item_stock` RPC call without recording a Goods Received Note (GRN) ledger transaction row.
- **Actual Behavior:** Stock quantity is updated directly in `items.stock_qty`, but if audit logging or downstream purchase ledger insertion fails, no GRN record remains to trace the origin of the received stock.
- **Expected Behavior:** Stock receiving should execute inside an atomic database procedure `receive_goods_atomic` that creates a GRN receipt record and increments inventory within a single transaction block.
- **Impact:** Inventory audit trail gaps during warehouse receiving.
- **Verification Status:** VERIFIED

---

### FINDING-INV-003
- **Severity:** HIGH
- **Category:** Financial Integrity / Arbitrary Cost Price Fallback
- **Location:** [src/components/StockInventory.tsx:475-476](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/StockInventory.tsx#L475-L476)
- **Component:** `StockInventory.tsx` (`handleSaveProduct`)
- **Evidence:**
  ```typescript
  const retail = Number(formRetailPrice) || 0;
  const cost = Number(formCostPrice) || Math.round(retail * 0.75);
  ```
- **Actual Behavior:** When an inventory manager creates or edits a product and leaves `Cost Price` blank, the frontend automatically defaults cost price to 75% of the retail price (`retail * 0.75`), assuming a hardcoded 25% margin.
- **Expected Behavior:** Cost price should either be mandatory or default strictly to `0` unless explicitly entered by the user. Arbitrary margin assumptions distort inventory valuation and gross margin reports.
- **Impact:** Artificial cost price generation leading to inaccurate profit margin analytics in executive reports.
- **Verification Status:** VERIFIED

---

### FINDING-INV-004
- **Severity:** MEDIUM
- **Category:** Validation Scope / Local Duplicate SKU Check
- **Location:** [src/components/StockInventory.tsx:466-472](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/StockInventory.tsx#L466-L472)
- **Component:** `StockInventory.tsx` (`handleSaveProduct`)
- **Evidence:**
  ```typescript
  const duplicate = items.find(
    (it) => it.code?.trim().toUpperCase() === normalizedCode && it.id !== editingItemId
  );
  ```
- **Actual Behavior:** Duplicate code checking evaluates only against the `items` array currently loaded in local component memory. If pagination is active or catalog size exceeds the initial load limit, duplicate codes are not detected until the server database query fails.
- **Expected Behavior:** Validate SKU uniqueness against the complete backend catalog or handle unique constraint errors gracefully from the API response.
- **Impact:** Unhandled HTTP 400/500 errors when saving duplicate product codes not loaded in local state.
- **Verification Status:** VERIFIED

---

### FINDING-INV-005
- **Severity:** LOW
- **Category:** UX / Transient Custom Unit Storage
- **Location:** [src/components/StockInventory.tsx:422-445](file:///c:/Users/Alyan/Desktop/paint%20final/p-industry/src/components/StockInventory.tsx#L422-L445)
- **Component:** `StockInventory.tsx` (`handleAddNewUnit`, `handleAddNewCategory`)
- **Evidence:**
  Custom categories and packaging units added via "+ New" in the inventory modal are saved strictly to React component state (`customCategories`, `customUnits`).
- **Actual Behavior:** Newly created categories or units disappear when the page is reloaded.
- **Expected Behavior:** Persist newly added custom units to `/api/custom-units` in Supabase.
- **Impact:** Loss of custom unit preferences across browser sessions.
- **Verification Status:** VERIFIED

---

## 7. Recommended Remediation Order

1. **P0 (CRITICAL):** Fix IDOR vulnerability in `PATCH /api/items` (FINDING-INV-001) by removing `tenant_id` from update fields and binding `.eq('tenant_id', auth.session.tenantId)`.
2. **P1 (HIGH):** Wrap inward goods receiving in atomic stored procedure `receive_goods_atomic` (FINDING-INV-002).
3. **P1 (HIGH):** Require explicit cost price entry in `StockInventory.tsx:475` (FINDING-INV-003) and remove arbitrary 75% margin calculation.
4. **P2 (MEDIUM):** Rely on server-side unique constraint responses for SKU validation in `StockInventory.tsx:466` (FINDING-INV-004).
5. **P3 (LOW):** Persist custom units and categories to database via `/api/custom-units` (FINDING-INV-005).
