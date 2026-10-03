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
