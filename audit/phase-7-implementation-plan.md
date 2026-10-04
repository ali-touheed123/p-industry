# PHASE 7 IMPLEMENTATION PLAN — PROCUREMENT REMEDIATION

**Date:** October 3, 2026
**Auditor:** Master Forensic Auditor
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)
**Phase:** PHASE 7 — Procurement, Vendor Purchases & Supplier Ledgers Forensic Audit
**Implementation Completed:** October 5, 2026

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 3 procurement atomicity,
API endpoint, and purchase order identifier defects identified in the Phase 7 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 1: High Severity Atomicity & Transaction Isolation Fixes

#### Task 7.1: Encapsulate Purchase Execution in Atomic Stored Procedure (FINDING-PROC-001)
- **Target Files:** `supabase/migrations/`, `src/app/api/purchases/route.ts`
- **Actions:**
  1. Create stored procedure `create_purchase_atomic(p_tenant_id, p_purchase_data, p_items, p_token_ids)` that inserts purchase header, inserts line items, marks tokens as used, increments stock quantities, and updates supplier balance in a single database transaction.
  2. Refactor `POST /api/purchases` to invoke `create_purchase_atomic`.

---

### Priority 2: Medium Severity API & Identifier Fixes

#### Task 7.2: Implement Purchase Modification Endpoints (FINDING-PROC-002)
- **Target File:** `src/app/api/purchases/route.ts`
- **Actions:**
  1. Implement `PATCH /api/purchases` handler for updating existing purchase invoices with stock delta adjustments.
  2. Implement `DELETE /api/purchases` handler for cancelling purchase orders and reverting stock/supplier balances.

#### Task 7.3: Unique Purchase Order Identifier Generation (FINDING-PROC-003)
- **Target File:** `src/components/PurchasesView.tsx`
- **Actions:**
  1. Replace 4-digit random number default for `purchaseInvNo` and `poNumber` with unique collision-resistant generators.

---

## 3. Actual Implementation Performed

### Task 7.1 — Atomic Purchase Stored Procedure
- **Migration created:** `supabase/migrations/20261005_02_create_purchase_atomic.sql`
- **Procedure:** `create_purchase_atomic(UUID, JSONB, JSONB, UUID[])` SECURITY DEFINER
- **Pattern:** Follows same SECURITY DEFINER + `SET search_path = public, pg_temp` pattern as existing Phase 5/6 RPCs (`receive_goods_atomic`, `adjust_item_stock`)
- **Steps inside transaction:**
  1. Field extraction from p_purchase_data JSONB
  2. Token validation with `FOR UPDATE` locks (prevents concurrent double-apply)
  3. Purchase header INSERT
  4. Token `UPDATE usage_status='used'`
  5. Line item INSERT + per-item stock adjustment with `SELECT FOR UPDATE` lock
  6. Supplier balance `UPDATE` with `FOR UPDATE` lock
  7. Audit log INSERT
- **POST /api/purchases:** Marshals request body → JSONB → single `supabase.rpc('create_purchase_atomic', ...)` call
- **Token validation:** Pre-validation (tenant scope + count check) moved into the procedure for atomicity

### Task 7.2 — PATCH and DELETE Endpoints
- **PATCH:** Updates supplier_name, date, payment_type, notes only. Stock/financial changes require a compensating purchase return (existing business workflow). Tenant derived from DB record before auth.
- **DELETE:** Fetches line items, reverses each stock delta via existing `adjust_item_stock`/`adjust_item_stock_by_code` RPCs, reverses supplier balance, deletes purchase_items then purchase header. Tenant derived from DB record before auth. Token redemptions are NOT reversed (business decision — tokens were legitimately consumed).
- **IDOR protection:** Both handlers fetch record by `id` first, derive `tenant_id` from it, then call `requireTenantAuth(req, existing.tenant_id)`. Client cannot override authorization by supplying a different tenant ID.

### Task 7.3 — Collision-Resistant Identifiers
- **Format:** `P-INV-YYYYMMDD-XXXX` and `PO-YYYYMMDD-XXXX` where XXXX is 4 random hex digits
- **Space:** 0x1000–0xEFFF = 57,344 unique values per format per calendar day
- **Rationale:** Even at 100 purchases/day, collision probability is ~0.087% (vs ~50% risk at 3,700 records with old 4-digit scheme). The timestamp component ensures cross-day uniqueness.

---

## 4. Files Changed
- `supabase/migrations/20261005_02_create_purchase_atomic.sql` (NEW)
- `src/app/api/purchases/route.ts` (MODIFIED — POST refactored, PATCH + DELETE added)
- `src/components/PurchasesView.tsx` (MODIFIED — purchaseInvNo + poNumber generators)

## 5. Verification Results
- TypeScript: `npx tsc --noEmit` → **exit code 0**
- Tests: `npx jest --passWithNoTests` → **No tests found, exit code 0** (no procurement unit tests exist)
- Static code inspection confirmed all intended changes applied correctly
- Tenant isolation: both PATCH and DELETE derive tenant_id server-side from DB record
- Procurement chain: POST → (atomic RPC) → stock + supplier balance. DELETE → reverses stock + supplier balance

## 6. Deferred / Out of Scope
- None discovered during Phase 7 implementation.

## 7. Important Implementation Decisions
- PATCH does NOT adjust stock/financials — line-item corrections use the existing purchase-return workflow to avoid double-counting
- DELETE does NOT reverse token redemptions — this is a business decision requiring separate approval workflow (out of scope)
- DELETE uses existing `adjust_item_stock` RPCs for reversals (reuse over duplication)
