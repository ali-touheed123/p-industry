# PHASE 5 IMPLEMENTATION PLAN — POS FRONTEND REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 5 — POS Frontend & Cashier Experience Forensic Audit  

---

## 1. Overview

This document outlines the step-by-step remediation plan for resolving the 6 POS frontend UI, cart state, hotkey performance, and sales return calculation defects identified in the Phase 5 Forensic Audit.

---

## 2. Prioritized Remediation Tasks

### Priority 0: High Impact Calculation & Financial Parity Fixes

#### Task 5.1: Fix Sales Return Unit Price Payload (FINDING-POS-001)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. In `handleCheckout`, calculate `effectiveRate` for each line item when `invoiceType === 'return'` and `item.hasToken && item.tokenReturnedWithBucket === false`.
  2. Pass `unit_price: effectiveRate` in `invoicePayload.items` to align database line items with customer net return totals.

---

### Priority 1: High Severity UI Performance & State Integrity Fixes

#### Task 5.2: Refactor Global Hotkey Listener to Mount-Once (FINDING-POS-002)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Create a `stateRef` object via `useRef` holding current values of `lineItems`, `selectedClient`, `customerSearch`, `invoiceDiscount`, `deliveryCharge`, `cashPayment`, `cardPayment`, `bankPayment`, `othersPayment`, `submitting`, `selectedProduct`, `filteredCatalog`.
  2. Detach dependency array from `useEffect` so `window.addEventListener('keydown', ...)` attaches once on component mount.

#### Task 5.3: Cryptographically Secure Cart Item Identifiers (FINDING-POS-003)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Replace `id: \`li-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`` in `handleAddItem` with `crypto.randomUUID()`.

---

### Priority 2: Medium Severity UX & Shift Gate Polish

#### Task 5.4: Shift Gate Server Verification on Login (FINDING-POS-005)
- **Target File:** `src/app/[slug]/page.tsx`
- **Actions:**
  1. In `handleLogin`, re-verify active shift status directly from `/api/shifts?tenant_id=...&status=open` before calling `setShowOpenShiftModal(true)`.

#### Task 5.5: Manual Cash Edit Reset Action (FINDING-POS-004)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Add a small "Auto-sync Cash" reset button near cash payment input to allow cashiers to clear `isCashManuallyEdited` state when cart contents change.

---

### Priority 3: Low Severity Branding & Fallbacks

#### Task 5.6: Dynamically Resolve Default Tenant Name Fallback (FINDING-POS-006)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Update default prop `tenantName` fallback from `'Main Godown & Retail Counter #1'` to `'PyntFlow Store'`.
