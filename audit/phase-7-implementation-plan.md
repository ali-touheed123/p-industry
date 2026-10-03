# PHASE 7 IMPLEMENTATION PLAN — PROCUREMENT REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 7 — Procurement, Vendor Purchases & Supplier Ledgers Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 3 procurement atomicity, API endpoint, and purchase order identifier defects identified in the Phase 7 Forensic Audit.

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
