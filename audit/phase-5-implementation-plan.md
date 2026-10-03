# PHASE 5 IMPLEMENTATION PLAN — POS FRONTEND REMEDIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 5 — POS Frontend & Cashier Experience Forensic Audit  
**Status:** ✅ ALL TASKS IMPLEMENTED & VERIFIED  

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
  3. Update receipt items payload to display accurate rates and line totals.
- **Implemented Changes:** Lines 956–980 & 1000–1020 updated to map `effectiveRate` into line item payloads and receipt data.
- **Important Decisions:** Normal sales remain completely untouched; only returns with unreturned tokens calculate the deducted rate.
- **Verification:** Verified via deterministic calculation test (full price Rs. 1,000 -> effective refund Rs. 850 with Rs. 150 token value).

---

### Priority 1: High Severity UI Performance & State Integrity Fixes

#### Task 5.2: Refactor Global Hotkey Listener to Mount-Once (FINDING-POS-002)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Create a `hotkeysStateRef` object via `useRef` holding current values and action handlers.
  2. Synchronize `hotkeysStateRef.current` on every render.
  3. Detach 12-variable dependency array from `useEffect` so `window.addEventListener('keydown', ...)` attaches once on component mount with `[]`.
- **Implemented Changes:** Added `hotkeysStateRef` and set `useEffect(..., [])`.
- **Important Decisions:** Keeps mutable reference pattern so all 8 POS keyboard shortcuts ([F2], [F3], [F4], [F5], [F7], [F8], [F9], [Escape]) execute with latest component state without recreating listeners.
- **Verification:** Verified that listener attaches once, and hotkey actions execute current handlers.

#### Task 5.3: Cryptographically Secure Cart Item Identifiers (FINDING-POS-003)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Replace `id: \`li-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`` in `handleAddItem` with `crypto.randomUUID()`.
- **Implemented Changes:** In `handleAddItem`, line item ID now uses `crypto.randomUUID()` with fallback.
- **Important Decisions:** Eliminates duplicate key warnings in React when scanning multiple products quickly.
- **Verification:** Verified high-entropy UUID generation.

---

### Priority 2: Medium Severity UX & Shift Gate Polish

#### Task 5.4: Shift Gate Server Verification on Login (FINDING-POS-005)
- **Target File:** `src/app/[slug]/page.tsx`
- **Actions:**
  1. In `handleLogin`, re-verify active shift status directly from `/api/shifts?tenant_id=...&status=open` before calling `setShowOpenShiftModal(true)`.
- **Implemented Changes:** `handleLogin` executes an asynchronous check against `/api/shifts` before evaluating shift presence.
- **Important Decisions:** Cashiers logging into an existing active shift are immediately routed to the POS terminal without being prompted to open a new shift.
- **Verification:** Verified logic eliminates race condition against mount-time `fetchTenant`.

#### Task 5.5: Manual Cash Edit Reset Action (FINDING-POS-004)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Add a small "Auto-sync" reset button near cash payment input to allow cashiers to clear `isCashManuallyEdited` state when cart contents change.
- **Implemented Changes:** Rendered an "Auto-sync" button inside the Cash input label header when `isCashManuallyEdited` is active.
- **Important Decisions:** Cashier can toggle back to auto-calculated cash tender at any point without manually typing the new balance.
- **Verification:** Verified button click triggers `setIsCashManuallyEdited(false)`.

---

### Priority 3: Low Severity Branding & Fallbacks

#### Task 5.6: Dynamically Resolve Default Tenant Name Fallback (FINDING-POS-006)
- **Target File:** `src/components/PosBilling.tsx`
- **Actions:**
  1. Update default prop `tenantName` fallback from `'Main Godown & Retail Counter #1'` to `'PyntFlow Store'`.
  2. Defensively sanitize `effectiveTenantName` in `buildPosThermalHtml`.
- **Implemented Changes:** Updated default prop in `PosBilling` signature and thermal receipt HTML generator.
- **Important Decisions:** Replaced hardcoded demo string with generic brand fallback while prioritizing actual tenant names passed as props.
- **Verification:** Verified receipts display accurate tenant names or safe fallback.

---

## 3. Deferred Items

None. All 6 tasks are fully implemented.
