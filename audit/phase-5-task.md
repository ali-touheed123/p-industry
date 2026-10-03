# PHASE 5 AUDIT TASK LIST — POS FRONTEND REMEDIATION

- [x] **Task 5.1: Fix Sales Return Unit Price Payload** (FINDING-POS-001)
  - **Status:** ✅ COMPLETE
  - **Files Changed:** `src/components/PosBilling.tsx`
  - **Acceptance Criteria:**
    - [x] Calculate `effectiveRate` during sales returns when tokens are retained by customer in `src/components/PosBilling.tsx`.
    - [x] Pass `unit_price: effectiveRate` in `invoicePayload.items` to match DB line totals with header net return totals.
    - [x] Normal sales continue using normal rate without modification.
    - [x] Printed receipt line item rates reflect effective rate during returns.
  - **Verification Result:** PASS (Deterministic unit calculation tests verified 1000 -> 850 unit_price and 1800 -> 1530 line totals).

- [x] **Task 5.2: Refactor Global Hotkey Listener to Mount-Once** (FINDING-POS-002)
  - **Status:** ✅ COMPLETE
  - **Files Changed:** `src/components/PosBilling.tsx`
  - **Acceptance Criteria:**
    - [x] Store transient POS state and action handlers in `useRef` inside `src/components/PosBilling.tsx`.
    - [x] Remove 12 state variables from `useEffect` dependency array for keyboard shortcuts (`[]` mount-once).
    - [x] All 8 hotkeys ([F2], [F3], [F4], [F5], [F7], [F8], [F9], [Escape]) remain fully operational.
  - **Verification Result:** PASS (Zero re-binding churn on cart/input updates; latest handlers accessed via ref).

- [x] **Task 5.3: Cryptographically Secure Cart Item Identifiers** (FINDING-POS-003)
  - **Status:** ✅ COMPLETE
  - **Files Changed:** `src/components/PosBilling.tsx`
  - **Acceptance Criteria:**
    - [x] Replace `Math.random()` 4-character ID generator with `crypto.randomUUID()` in `src/components/PosBilling.tsx`.
    - [x] Zero duplicate React keys under rapid barcode scanning / addition.
  - **Verification Result:** PASS (High-entropy UUID v4 generated on every line item addition).

- [x] **Task 5.4: Shift Gate Server Verification on Login** (FINDING-POS-005)
  - **Status:** ✅ COMPLETE
  - **Files Changed:** `src/app/[slug]/page.tsx`
  - **Acceptance Criteria:**
    - [x] Re-verify active shift status asynchronously from server during cashier login in `src/app/[slug]/page.tsx`.
    - [x] Already-active shift skips open-shift modal and directs cashier to POS workspace.
    - [x] Genuinely missing shift retrieves last closed shift and opens open-shift modal.
  - **Verification Result:** PASS (Direct API verification against `/api/shifts?status=open` prevents state race conditions).

- [x] **Task 5.5: Manual Cash Edit Reset Action** (FINDING-POS-004)
  - **Status:** ✅ COMPLETE
  - **Files Changed:** `src/components/PosBilling.tsx`
  - **Acceptance Criteria:**
    - [x] Add auto-sync reset button to clear `isCashManuallyEdited` state in `src/components/PosBilling.tsx`.
    - [x] Clicking Auto-sync resets manual cash override and immediately recalculates remaining cash against `netTotal`.
  - **Verification Result:** PASS (Auto-sync button conditionally displayed when `isCashManuallyEdited` is true).

- [x] **Task 5.6: Dynamically Resolve Default Tenant Name Fallback** (FINDING-POS-006)
  - **Status:** ✅ COMPLETE
  - **Files Changed:** `src/components/PosBilling.tsx`
  - **Acceptance Criteria:**
    - [x] Update default prop fallback for `tenantName` in `src/components/PosBilling.tsx` from `'Main Godown & Retail Counter #1'` to `'PyntFlow Store'`.
    - [x] Defensively sanitize receipt builder fallback to avoid printing placeholder names.
  - **Verification Result:** PASS (Verified safe generic branding fallback without hardcoded demo strings).
