# PHASE 8 IMPLEMENTATION PLAN — FINANCIAL LEDGERS REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 8 — Financial Ledgers & Customer/Supplier Accounts Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 3 financial voucher atomicity, voucher code collision, and query pagination defects identified in the Phase 8 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 1: High Severity Atomicity Fixes

#### Task 8.1: Encapsulate Voucher Processing in Atomic Stored Procedure (FINDING-LEDG-001)
- **Target Files:** `supabase/migrations/`, `src/app/api/vouchers/route.ts`
- **Actions:**
  1. Create stored procedure `create_voucher_atomic(p_tenant_id, p_voucher_data, p_token_ids)` that inserts the voucher, updates token usage, and adjusts customer or supplier balance within a single database transaction.
  2. Refactor `POST /api/vouchers` to call `create_voucher_atomic`.

---

### Priority 2: Medium Severity Identifier & Performance Fixes

#### Task 8.2: Unique Voucher Code Generation (FINDING-LEDG-002)
- **Target File:** `src/app/api/vouchers/route.ts`
- **Actions:**
  1. Replace 4-digit random number generator for `voucher_no` with high-entropy collision-resistant format or retry loop.

#### Task 8.3: Enforce Pagination on Voucher Fetch Endpoint (FINDING-LEDG-003)
- **Target File:** `src/app/api/vouchers/route.ts`
- **Actions:**
  1. Add `limit` parameter (default `100`, max `500`) to `GET /api/vouchers`.
