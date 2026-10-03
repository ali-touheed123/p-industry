# PHASE 5 AUDIT TASK LIST — POS FRONTEND REMEDIATION

- [ ] **Task 5.1: Fix Sales Return Unit Price Payload** (FINDING-POS-001)
  - [ ] Calculate `effectiveRate` during sales returns when tokens are retained by customer in `src/components/PosBilling.tsx`.
  - [ ] Pass `unit_price: effectiveRate` in `invoicePayload.items` to match DB line totals with header net return totals.

- [ ] **Task 5.2: Refactor Global Hotkey Listener to Mount-Once** (FINDING-POS-002)
  - [ ] Store transient POS state in `useRef` inside `src/components/PosBilling.tsx`.
  - [ ] Remove 12 state variables from `useEffect` dependency array for keyboard shortcuts.

- [ ] **Task 5.3: Cryptographically Secure Cart Item Identifiers** (FINDING-POS-003)
  - [ ] Replace `Math.random()` 4-character ID generator with `crypto.randomUUID()` in `src/components/PosBilling.tsx`.

- [ ] **Task 5.4: Shift Gate Server Verification on Login** (FINDING-POS-005)
  - [ ] Re-verify active shift status asynchronously from server during cashier login in `src/app/[slug]/page.tsx`.

- [ ] **Task 5.5: Manual Cash Edit Reset Action** (FINDING-POS-004)
  - [ ] Add auto-sync reset button to clear `isCashManuallyEdited` state in `src/components/PosBilling.tsx`.

- [ ] **Task 5.6: Dynamically Resolve Default Tenant Name Fallback** (FINDING-POS-006)
  - [ ] Update default prop fallback for `tenantName` in `src/components/PosBilling.tsx`.
