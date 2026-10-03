# PHASE 12 IMPLEMENTATION PLAN — END-TO-END WORKFLOW REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 12 — End-to-End Real Workflow Testing Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the cross-module integration and state consistency defects identified in the Phase 12 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 1: High Severity Integration Fixes

#### Task 12.1: Atomic Supplier Purchase Creation & Token Status Marking (FINDING-E2E-001)
- **Target File:** `src/app/api/purchases/route.ts` & Supabase Database Migration (`create_purchase_atomic` RPC)
- **Actions:**
  1. Create database stored procedure `create_purchase_atomic` that handles purchase header insertion, line item insertion, stock adjustment, supplier balance updates, and token status updates within a single isolated transaction block.
  2. Refactor `POST /api/purchases` to delegate execution to `create_purchase_atomic`.

---

## Priority 2: Medium Severity Business Logic Fixes

#### Task 12.2: Explicit Shift Scoping for Supplier Cash Purchases (FINDING-E2E-002)
- **Target File:** `src/app/api/purchases/route.ts` & `src/app/api/shifts/route.ts`
- **Actions:**
  1. Add `shift_id` foreign key column to `purchases` table.
  2. Update purchase creation to capture active `shift_id`.
  3. Update `PATCH /api/shifts` reconciliation logic to filter supplier cash payments by `shift_id` instead of timestamp range `.gte('created_at', startTime)`.

---

## Priority 3: Low Severity UX & Verification Enhancements

#### Task 12.3: Printable Claim Token Receipt for Walk-In Token Retention (FINDING-E2E-003)
- **Target File:** `src/components/PosBilling.tsx` & `src/utils/iframePrint.ts`
- **Actions:**
  1. Generate unique serial claim code for walk-in token transactions (`client_id = NULL`).
  2. Print token claim voucher block on thermal receipt when walk-in customer retains physical tokens.
