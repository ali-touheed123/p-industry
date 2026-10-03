# PHASE 9 IMPLEMENTATION PLAN — AI PAINT TOKEN REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 9 — AI Paint Token Management & Redemption System Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 3 vendor token surrender atomicity, token voucher code collision, and legacy summary API parameter defects identified in the Phase 9 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 1: High Severity Atomicity Fixes

#### Task 9.1: Encapsulate Vendor Token Surrender in Atomic Stored Procedure (FINDING-TOK-001)
- **Target Files:** `supabase/migrations/`, `src/app/api/tokens/route.ts`
- **Actions:**
  1. Create stored procedure `settle_tokens_vendor_atomic(p_tenant_id, p_allocations, p_settlement_type, p_claim_ref, p_supplier_id, p_supplier_name)` that updates token status and creates credit vouchers within a single database transaction.
  2. Refactor `POST /api/tokens` (`type = 'settle_vendor'`) to execute `settle_tokens_vendor_atomic`.

---

### Priority 2: Medium Severity Identifier & Maintenance Fixes

#### Task 9.2: Unique Token Voucher Code Generation (FINDING-TOK-003)
- **Target File:** `src/app/api/tokens/route.ts`
- **Actions:**
  1. Replace 2-digit random suffix for token vouchers with high-entropy collision-resistant format.

#### Task 9.3: Deprecate Legacy Summary API Parameter Stub (FINDING-TOK-002)
- **Target File:** `src/app/api/tokens/route.ts`
- **Actions:**
  1. Remove legacy `summary=redeemable` parameter stub returning hardcoded zeroes.
