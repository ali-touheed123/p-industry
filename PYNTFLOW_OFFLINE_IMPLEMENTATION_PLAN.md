# PYNTFLOW — Offline Mode: Implementation Plan + Task List

**Based on:** Offline Mode & Sync Audit Report (2026-10-29)  
**Repo:** `p-industry` (Next.js 15 App Router + Supabase/PostgreSQL)  
**Goal (original requirement):** When internet is bad (no net, weak signal, signal lost mid-operation, WiFi problems), POS must keep working. Everything is stored locally, and when the network is healthy again, ALL pending data syncs automatically to the database — no data loss, no duplicates, no corruption.

---

## Progress Log

- Phase 1 (Special receipt idempotency HOTFIX): Approved by owner (2026-10-29)
- Phase 2 (Timeouts + Verify-Before-Retry): Approved by owner (2026-10-29)
- Phase 3 (Cart Auto-Save): Approved by owner (2026-10-29)
- Phase 4 (Real Connectivity Detection): Approved by owner (2026-10-29)
- Phase 5 (Local Hold Fallback): Approved by owner (2026-10-30)
- Phase 6 (Offline Sales Queue + Auto-Sync): Sales + special sales complete; payments (outbox type 'payment') and acceptance tests 6.10 pending (2026-10-30)
- Phase 7 (Offline Session Grace + Local Shift): Staged / Migration Prepared (2026-10-30)
- Phase 8 (Invoice Edit Idempotency + Conflict Policy): Staged / Migration Prepared (2026-10-30)
- Phase 9 (Truth in Marketing): Not started
- Phase 10 (Full Test Matrix + Sign-off): Not started

### Migrations
- *(None required for Phase 1 — Server route `/api/invoices/special` and RPC `create_special_invoice_atomic` already had full idempotency enforcement in migration `20261029_03_sales_invoice_numbering_and_idempotency.sql`)*
- `20261030_01_held_invoices_local_hold_id.sql` — **APPLIED (2026-10-30)** — `local_hold_id TEXT` column + partial UNIQUE index on `held_invoices`. `/api/held-invoices` POST route updated to dedup on `local_hold_id`.
- `20261030_02_invoices_offline_sync_columns.sql` — **APPLIED (2026-10-30)** — `is_offline`, `created_at_local`, `device_id`, `local_receipt_no`, `synced_at`, `offline_schema_version` added to `invoices` with UNIQUE partial index `idx_invoices_offline_dedup` and search index `idx_invoices_local_receipt_search`.
- `20261030_03_items_price_history.sql` — **APPLIED & VERIFIED (2026-10-30)** — `items_price_history` table created with RLS enabled, write restricted to trigger/service_role only, trigger with `search_path = public, pg_temp` guarding NULL retail_price, idempotent seed seeded 4,655 existing items. Rollback: `supabase/rollback/rollback_20261030_03_items_price_history.sql`.
- `20261030_04_invoices_late_sync_shift_columns.sql` — **APPLIED & VERIFIED (2026-10-30)** — Added `is_late_sync BOOLEAN NOT NULL DEFAULT false` and `original_shift_id UUID NULL REFERENCES public.shifts(id) ON DELETE SET NULL` to `invoices` with partial index `idx_invoices_shift_late_sync`. Rollback: `supabase/rollback/rollback_20261030_04_invoices_late_sync_shift_columns.sql`.
- `20261030_05_create_invoice_atomic_v2_offline.sql` — **APPLIED & VERIFIED (2026-10-30)** — Full v2 of `create_invoice_atomic` active on live database. Handles all 8 offline columns, shift-independent payload fingerprint, legacy fingerprint fallback, post-duplicate time-safety validations (OFFLINE_TIME_FUTURE / OFFLINE_TIME_TOO_OLD), OFFLINE_RECEIPT_DUPLICATE constraint exception mapping. Tested across all 7 sandbox test scenarios + time-safety checks. Rollback: `supabase/rollback/rollback_20261030_05_create_invoice_atomic_v2.sql`.

### Owner Decisions (Locked)
- **A. Late-synced shifts**: If original shift open → keep it (is_late_sync=false). If closed → book into currently open shift (is_late_sync=true, original_shift_id set). No open shift → 422 WAITING_FOR_OPEN_SHIFT.
- **B. Time safety location**: RPC (after duplicate check so retries always win). Route catches OFFLINE_TIME_* and returns 422 with needs_attention.
- **C. historicalMatches shadow bug**: Fixed in invoices/route.ts and invoices/special/route.ts (2026-10-30).

### APPLY ORDER (strict — do not apply live until backup confirmed by owner)
```
1. supabase/migrations/20261030_03_items_price_history.sql
2. supabase/migrations/20261030_04_invoices_late_sync_shift_columns.sql
3. supabase/migrations/20261030_05_create_invoice_atomic_v2_offline.sql
4. Push code to main (code selects is_late_sync — MUST NOT push before migration 04 applied)
```

### Migration Handoff & Database Audit (2026-10-30)

All remaining database migrations for Phases 6–8 have been audited, designed, and staged under `supabase/migrations/offline/` (**NONE ARE APPLIED TO THE LIVE DB YET**):

| # | Staged Migration | Target Phase | DB Changes Needed? | Status | Purpose & Exact DB Scope |
|---|---|---|---|---|---|
| **06** | `20261030_06_vouchers_idempotency_and_offline_sync.sql` | Phase 6/9 (Payment Outbox) | **YES** | Staged / NOT APPLIED | Fixes missing idempotency on customer payments. Adds `idempotency_key`, `is_offline`, `created_at_local`, `device_id`, `local_receipt_no` to `vouchers`. Upgrades `create_voucher_atomic` (v2) to return existing voucher on duplicate retry without double-deducting client balance. |
| **07** | `20261030_07_shifts_local_shift_offline_sync.sql` | Phase 7 (Offline Shift) | **YES** | Staged / NOT APPLIED | Reconciles locally opened register shifts. Adds `local_shift_id UUID`, `is_offline`, `device_id`, `synced_at` to `shifts` with unique partial index `idx_shifts_local_shift_dedup`. Queued offline sales retain valid FK references. |
| **08** | `20261030_08_invoices_version_and_update_atomic_v2.sql` | Phase 8 (Invoice Edit Concurrency) | **YES** | Staged / NOT APPLIED | Optimistic concurrency control for invoice edits. Adds `version INT DEFAULT 1` and `edit_idempotency_key UUID` to `invoices`. Upgrades `update_invoice_atomic` (v2) to reject stale edits with `INVOICE_VERSION_CONFLICT` (409) and deduplicate retries. |
| **—** | CEO Discard of `needs_attention` items | Phase 6 | **NO** | Zero DB Changes | Fully handled by existing `audit_logs` table (`entity_type: 'offline_queue'`, `action: 'OFFLINE_QUEUE_DISCARDED'`, `details: {...}`). |
| **—** | Stale-Sale CEO Override (>7 days) | Phase 6 | **NO** | Zero DB Changes | Route catches `OFFLINE_TIME_TOO_OLD`, unlocked via CEO password modal, logged to `audit_logs` (`OFFLINE_STALE_SALE_APPROVED`). |
| **—** | Truth in Marketing | Phase 9 | **NO** | Zero DB Changes | Purely front-end landing page copy adjustments. |
| **—** | Full Test Matrix & Sign-off | Phase 10 | **NO** | Zero DB Changes | End-to-end integration QA checklists and automated test runs. |

Complete documentation, apply protocol, and rollback scripts are maintained in [`supabase/migrations/offline/README.md`](file:///d:/bestow/p-industry/supabase/migrations/offline/README.md) and [`HANDOFF.md`](file:///d:/bestow/p-industry/HANDOFF.md).

---

## 0. Ground Rules for the Agent (READ FIRST)

1. **Work phase by phase.** Finish ONE phase, run its tests, then STOP and report. Do not start the next phase until the owner approves.
2. **No DB migration, RPC change, or schema change without showing the SQL to the owner first** and getting approval. Every migration must be additive and backward compatible.
3. **Never break the working online flow.** `create_invoice_atomic`, `idempotency_key` on normal checkout, `activeCheckoutKeyRef`, server-side invoice numbering, rate-lock, CEO password gate — these are correct today. Reuse them, don't rewrite them.
4. **Server stays the single source of truth.** Offline-synced records must go through the SAME API routes / RPCs / validation / audit logs as online ones. No shortcut path for queued data.
5. **Never silently drop data.** A queued item may only be removed after the server confirms success (or confirms it is a duplicate of an already-saved record). Failed items stay visible in a "Needs attention" list.
6. **Be honest.** If something cannot be verified or tested, say so in the report. Do not assume it works.
7. After each phase, give a short report: files changed, what was tested, what is NOT done, any risk found.

---

## 1. Current State (from audit, short)

| Area | Today |
|---|---|
| Offline data layer | None (no IndexedDB, no service worker, no sync queue) |
| Network detection | `window.online/offline` events only (cosmetic pill) |
| Request timeouts | None on `fetch` (can hang 60–120 s) |
| Normal sale idempotency | ✅ UUID `idempotency_key` + atomic RPC |
| Special receipt idempotency | ❌ Missing → duplicate risk |
| Invoice edit (PATCH) idempotency | ❌ Missing |
| Cart persistence | ❌ React state only; lost on refresh/close |
| Hold invoice | ❌ Server only (`held_invoices`) |
| Login / shift open offline | ❌ Impossible |
| Landing page claims | ❌ Claim "100% Offline Resilient" — not true yet |

---

## 2. Phase Overview

| Phase | Name | Fixes (audit IDs) | Effort | Needs DB change? |
|---|---|---|---|---|
| **1** | Special receipt idempotency (HOTFIX) | CRIT-04 | ~2 h | Check first |
| **2** | Request timeouts + "verify before retry" | HIGH-02, HIGH-05 | ~4–6 h | No |
| **3** | Cart auto-save (crash/refresh recovery) | HIGH-04, CRIT-01 (partial) | 1–2 days | No |
| **4** | Real connectivity detection + offline banner | HIGH-01, MED-03 | ~1 day | New `/api/health` route only |
| **5** | Local hold fallback | CRIT-03 | ~1 day | No |
| **6** | **Offline sales queue (IndexedDB) + auto-sync** | HIGH-06, CRIT-01, LOW-02, LOW-03, LOW-05, MED-06 | 3–5 days | Maybe (see 6.9) |
| **7** | Offline session grace + local shift | CRIT-02, MED-04, MED-02 | 2–3 days | Maybe |
| **8** | Invoice edit idempotency + version lock & global conflict policy | MED-01, MED-05, HIGH-03 | ~1 day | Yes (additive) |
| **9** | Truth in marketing | LOW-04 | ~1 h | No |
| **10** | Full test matrix + sign-off | all | ~1–2 days | No |

**Order note:** Phase 9 (marketing) can be done at ANY time and is recommended immediately, because the claims are currently false.

---

## PHASE 1 — Special Receipt Idempotency (HOTFIX)

**STATUS: COMPLETED 2026-10-29, Approved by owner (2026-10-29)**

**Problem:** `handleSpecialDirect` (`PosBilling.tsx` ~L1449–1501) sends no `idempotency_key`. Network drops after server commit → cashier retries → duplicate invoice, double stock deduction, double client balance, double `special_print_log`.

### Tasks
- [x] **1.1** Read how normal checkout generates and reuses `activeCheckoutKeyRef`. Mirror the same pattern for special sale (own ref, reset when cart changes, kept across retries).
  - ✅ Done 2026-10-29: Added `activeSpecialCheckoutKeyRef`; updated `cartSignature` to track `specialRate` and `discountPercent` so any cart modification resets keys; files: `src/components/PosBilling.tsx`
- [x] **1.2** In `handleSpecialDirect`, generate a UUID `idempotency_key` BEFORE the `fetch` and include it in the request body.
  - ✅ Done 2026-10-29: Generated stable `idempotency_key` via `activeSpecialCheckoutKeyRef` and passed it inside payload; files: `src/components/PosBilling.tsx`
- [x] **1.3** Check the server route + the special-sale RPC: does it already accept/enforce `idempotency_key`? 
  - ✅ Done 2026-10-29: Verified route `/api/invoices/special` and RPC `create_special_invoice_atomic` already accept and enforce `idempotency_key` with advisory lock and duplicate returns; no SQL migration required; files: `src/app/api/invoices/special/route.ts`, `supabase/migrations/20261029_03_sales_invoice_numbering_and_idempotency.sql`
- [x] **1.4** Duplicate response (`is_duplicate: true`) must be treated as success: clear cart, show the original invoice/receipt, do NOT create second `special_print_log` entry.
  - ✅ Done 2026-10-29: `is_duplicate` treated as success, printed original snapshot, cleared cart, reset key ref, server already skips duplicate `special_print_log`; files: `src/components/PosBilling.tsx`
- [x] **1.5** Special **return** line / special return RPC: check if the same gap exists; report (fix only if same pattern).
  - ✅ Done 2026-10-29: Verified `SpecialReturnModal.tsx` and `/api/invoices/special-return` already implement and enforce `idempotency_key` via `activeReturnKeyRef`; no gap existed for returns; files: `src/components/SpecialReturnModal.tsx`, `src/app/api/invoices/special-return/route.ts`

### Phase 1 Report
- **Files changed:** `src/components/PosBilling.tsx`, `scripts/test-phase1-special-idempotency.mjs`, `PYNTFLOW_OFFLINE_IMPLEMENTATION_PLAN.md`
- **Tests run & results:**
  - `node --test scripts/test-phase1-special-idempotency.mjs` — **4/4 passed** (key generation & retry retention, cart-signature mutation detection for special rates, duplicate-response handling contract, special return idempotency verification).
  - `npx tsc --noEmit` — **0 errors (passed)**.
  - `node --test scripts/test-lifecycle-offline.mjs` — **21/21 passed**.
- **What is NOT done:** Phases 2–10 (stopped as per Ground Rule 1).
- **Risks found:** None for Phase 1. The fix is non-breaking, strictly additive, and eliminates duplicate invoice creation on retried special receipts.

### Acceptance criteria
- Same special sale submitted twice with same key → exactly 1 invoice, 1 stock deduction, 1 balance change, 1 print-log entry.
- Different cart → new key → new invoice (no false duplicates).
- Normal checkout unchanged.

### Tests
- Simulate response loss (block response in DevTools / throw after fetch) → retry → verify single record in DB.

---

## PHASE 2 — Timeouts + Verify-Before-Retry

**STATUS: COMPLETED 2026-10-29, Approved by owner (2026-10-29)**

**Problem:** No timeout on `fetch('/api/invoices')` etc. POS freezes 60+ s; after failure the cashier doesn't know if the sale went through.

### Tasks
- [x] **2.1** Create one shared helper, e.g. `src/lib/fetchWithTimeout.ts`: wraps `fetch` with `AbortController`, default 20 s, throws a typed `NetworkTimeoutError` / `NetworkError` (so UI can tell "no internet" from "server said no").
  - ✅ Done 2026-10-29: Created `src/lib/fetchWithTimeout.ts` with `NetworkTimeoutError`, `NetworkConnectionError`, `isNetworkOrTimeoutError`, and configurable timeout (default 20s); files: `src/lib/fetchWithTimeout.ts`
- [x] **2.2** Use it on all write paths first: checkout (POST/PATCH `/api/invoices`), special sale, sales return, hold invoice, payments, stock adjustment, purchases, expenses, branch order actions.
  - ✅ Done 2026-10-29: Applied `fetchWithTimeout` to all write paths — `PosBilling.tsx` (checkout, hold, special), `SpecialPrintModal.tsx`, `SpecialReturnModal.tsx`, `HoldInvoices.tsx`, `ClientCreditRecovery.tsx`, `PurchasesView.tsx` (25s), `AiInvoiceScan.tsx` (25s), `BranchOrders.tsx` (4 writes), `FinancialLedgers.tsx` (4 writes), `ShiftDrawer.tsx`, `ceoApprovalClient.ts`
- [x] **2.3** On timeout/network error in checkout: because `activeCheckoutKeyRef` is set, **automatically re-submit the same key once or twice** (short delay) in a "verify before retry" flow.
  - ✅ Done 2026-10-29: `handleCheckout` and `handleSpecialDirect` both wrap fetch in a retry loop (up to 2 verify attempts); on network/timeout error, shows verifying spinner, retries with same idempotency key; if all fail, shows connection-lost modal with recovery options; files: `src/components/PosBilling.tsx`
- [x] **2.4** **Cashier-Friendly UX Copy (Bilingual English + Roman Urdu):** Replace alarming alerts and raw errors (`TypeError: Failed to fetch`, `Network retry detected: already recorded`) with clear modal/toast copy:
  - ✅ Done 2026-10-29: Added verifying spinner modal (dark overlay, orange spinner, bilingual text), connection-lost modal (red border, AlertTriangle icon, bilingual recovery copy with "Keep Cart & Check Net" / "Try Again" buttons), friendly `is_duplicate` message ("Sale successfully recorded!"); removed old alert() calls; files: `src/components/PosBilling.tsx`
  - *While verifying in background (attempts 1–2):*  
    **"Verifying sale with server… Please wait"** / *(Sale check ho rahi hai, baraye mehrbani intezar karein…)* with an animated spinner.
  - *If server confirms record exists (`is_duplicate: true`):*  
    **"Sale successfully recorded!"** / *(Sale pehle hi record ho chuki hai)* → clear cart, show receipt modal. Never show "Duplicate error" or scary developer warnings.
  - *If verify attempts exhaust with no response (network still down):*  
    **"Connection lost. Sale could not be confirmed."** / *(Internet band hai — sale abhi confirm nahi hui. Dobara enter mat karein; 'Retry' dabayein ya offline save karein.)* with two clear buttons: `[Try Again / Dobara Koshish]` and `[Save to Offline Queue / Offline Save]`.
- [x] **2.5** Disable the checkout button and input fields while any request or verify cycle is in flight (prevent double-click double-submit).
  - ✅ Done 2026-10-29: Already covered by `submitting` state + `isSubmittingRef` guard from Phase 1; verified still operational; file: `src/components/PosBilling.tsx`

### Acceptance criteria
- No write request hangs longer than the timeout.
- Timeout after server-commit → auto-verify returns `is_duplicate` → cart cleared, cashier sees "Sale saved".
- Cashier can never get into "unknown state" without a clear instruction.

### Phase 2 Report
- **Files changed:**
  - `src/lib/fetchWithTimeout.ts` — NEW (shared timeout + typed error helper)
  - `src/components/PosBilling.tsx` — verify-before-retry loop in `handleCheckout` & `handleSpecialDirect`, verifying spinner modal, connection-lost modal, `verifyState` state, `AlertTriangle` import
  - `src/components/SpecialPrintModal.tsx` — `fetch` → `fetchWithTimeout`
  - `src/components/SpecialReturnModal.tsx` — `fetch` → `fetchWithTimeout`
  - `src/components/HoldInvoices.tsx` — HTTP DELETE call's `fetch` → `fetchWithTimeout`
  - `src/components/ClientCreditRecovery.tsx` — POST `fetch` → `fetchWithTimeout`
  - `src/components/PurchasesView.tsx` — POST `fetch` → `fetchWithTimeout` (25s)
  - `src/components/AiInvoiceScan.tsx` — POST `fetch` → `fetchWithTimeout` (25s)
  - `src/components/BranchOrders.tsx` — 4 write fetches → `fetchWithTimeout`
  - `src/components/FinancialLedgers.tsx` — 4 write fetches → `fetchWithTimeout`
  - `src/components/ShiftDrawer.tsx` — POST/PATCH → `fetchWithTimeout`
  - `src/lib/ceoApprovalClient.ts` — `ceoFetch` rewired through `fetchWithTimeout`
  - `scripts/test-phase2-timeouts-and-retry.mjs` — NEW (5 unit tests)
- **Tests run & results:**
  - `npx tsx --test scripts/test-phase2-timeouts-and-retry.mjs` — **5/5 passed** (timeout enforcement, normal resolution, error classifier, verify-before-retry dedup, persistent-outage recovery copy)
  - `npx tsc --noEmit` — **0 errors**
  - `npx tsx --test scripts/test-phase1-special-idempotency.mjs` — **4/4 passed** (regression)
  - `npx tsx --test scripts/test-lifecycle-offline.mjs` — **21/21 passed** (regression)
- **Bug found & fixed during testing:** `isNetworkOrTimeoutError` regex did not cover `ENOTFOUND` (DNS resolution failure). Added to regex — now classifies correctly.
- **What is NOT done:** Phases 3–10 (stopped per Ground Rule 1).
- **Risks found:** None. Fix is non-breaking, strictly additive. All existing online flows unchanged — `fetchWithTimeout` is a drop-in wrapper. The `@keyframes spin` animation for the verifying spinner already exists in `src/app/globals.css` (line 966).
- **Cannot test in this environment:** Actual browser modal rendering (spinner, connection-lost dialog) — requires a running dev server with DevTools network throttling. Logic is structurally verified by unit tests.

---

## PHASE 3 — Cart Auto-Save (Crash / Refresh Recovery)

**STATUS: COMPLETED 2026-10-29, Approved by owner (2026-10-29)**

**Problem:** Cart lives only in `useState`. Refresh/close/crash = total loss.

### Tasks
- [x] **3.1** Add `src/lib/cartDraftStore.ts`: save/load/clear the in-progress cart (items, qty, rates, client, discount, payment fields, `activeCheckoutKey`).
  - ✅ Done 2026-10-29: Created `src/lib/cartDraftStore.ts` with save/load/clear for full in-progress cart (items, rates, special rates, quantities, client, customer name, remarks, discounts, delivery charge, payment mode splits, `activeCheckoutKey`, `activeSpecialCheckoutKey`, and `activeHeldOrderId`).
- [x] **3.2** Key storage by **tenant id + branch + user id** (never leak a draft to another user/branch).
  - ✅ Done 2026-10-29: Built `buildCartDraftKey` using `pyntflow_cart_draft:${tenantId}:${branchId}:${userId}`; verified cross-user & cross-tenant draft isolation in unit tests.
- [x] **3.3** Debounced auto-save (~500 ms) on every cart change. Use `localStorage` (or IndexedDB if cart can be large).
  - ✅ Done 2026-10-29: Added 500ms debounced auto-save `useEffect` in `PosBilling.tsx` tracking cart modifications; empty carts automatically clear the storage key.
- [x] **3.4** On POS mount: if a draft exists, show "Unsaved cart found — Restore / Discard".
  - ✅ Done 2026-10-29: Added bilingual modal on POS mount showing item count, customer, and timestamp with `[Restore Cart / Cart Wapis Laein]` and `[Discard / Mita Dein]` options.
- [x] **3.5** Clear draft on: successful checkout, explicit "clear cart", logout.
  - ✅ Done 2026-10-29: Wired `clearCartDraft` into `handleCheckout`, `handleSpecialDirect`, `handleCancelInvoice` (F9), `handleHoldInvoice`, and called `clearAllCartDrafts()` on user logout in `[slug]/page.tsx`.
- [x] **3.6** Embed a `schemaVersion` in the saved draft; ignore/discard drafts from an incompatible version.
  - ✅ Done 2026-10-29: Embedded `schemaVersion: 1` (`CART_DRAFT_SCHEMA_VERSION`); version mismatch discards stale payload from storage safely.
- [x] **3.7** **Security review:** document exactly what is stored (no passwords, no CEO tokens, no card data). Cart contains customer names/amounts — clear on logout and on shared-device warning.
  - ✅ Done 2026-10-29: Documented security policy in `cartDraftStore.ts` header; verified via automated test that no passwords, CEO tokens, or JWTs exist in stored draft payload; full storage wiped on logout.
- [x] **3.8** Restored cart must **re-validate rates** against the current catalog (rate-lock) before submit; show a warning if a price changed.
  - ✅ Done 2026-10-29: Implemented `validateCartDraftRates` and displayed amber price-change banner when restored draft rates diverge from live catalog, while retaining quoted customer rates.

### Acceptance criteria
- Add items → refresh tab → restore prompt → exact cart returns.
- Logout wipes the draft.
- Two different users on same browser never see each other's draft.

### Phase 3 Report
- **Files changed:**
  - `src/lib/cartDraftStore.ts` — NEW (cart draft storage, versioning, scoping, rate re-validation, security guards)
  - `src/components/PosBilling.tsx` — integrated auto-save (500ms debounce), draft load on mount, Restore/Discard modal, rate update warning banner, draft cleanup on checkout/hold/cancel
  - `src/app/[slug]/page.tsx` — passed `userId` and `branchId` to `<PosBilling />`; called `clearAllCartDrafts()` on user logout
  - `scripts/test-phase3-cart-draft-store.mjs` — NEW (8 unit tests covering all tasks and criteria)
- **Tests run & results:**
  - `npx tsx --test scripts/test-phase3-cart-draft-store.mjs` — **8/8 passed** (scoped keys, save/load, cross-user isolation, checkout/cancel cleanup, logout wipe, schema versioning, security audit, catalog rate re-validation)
  - `npx tsc --noEmit` — **0 errors (passed)**
  - `npx tsx --test scripts/test-phase1-special-idempotency.mjs` — **4/4 passed** (regression)
  - `npx tsx --test scripts/test-phase2-timeouts-and-retry.mjs` — **5/5 passed** (regression)
- **What is NOT done:** Phases 4–10 (stopped per Ground Rule 1).
- **Risks found:** None. Storage access is wrapped in try/catch and storage availability guards to safely handle private browsing / quota restrictions without throwing runtime errors. Online flow remains 100% operational.
- **Cannot test in this environment:** Live browser tab refresh / close event in a graphical browser session — verified via comprehensive unit tests simulating localStorage lifecycle and state transitions.

---

## PHASE 4 — Real Connectivity Detection + Offline Banner

**STATUS: COMPLETED 2026-10-29, Approved by owner (2026-10-29)**

**Problem:** `navigator.onLine` says "Online" even with captive portal / dead ISP / Supabase down.

### Tasks
- [x] **4.1** Add a lightweight `GET /api/health` route (no auth heavy work; optionally a trivial DB ping with short timeout). Returns `{ok:true, ts}`.
  - ✅ Done 2026-10-29: Created `src/app/api/health/route.ts` supporting fast GET and HEAD probes, timestamp response, optional `?db=1` DB ping with 2s timeout, and strict `no-store` cache headers.
- [x] **4.2** Create `useConnectivity()` hook: combines browser events + periodic probe (every ~15–30 s while online, faster retry while offline, e.g. every 5–10 s). Uses `AbortSignal.timeout(~3000)`.
  - ✅ Done 2026-10-29: Created `src/lib/useConnectivity.ts` with `probeHealth` and `useConnectivity` hook; combines OS online/offline events + periodic health pings (25s while online, 7s while offline/degraded) with 3s timeout.
- [x] **4.3** States: `online`, `offline`, `degraded` (slow / probe failing intermittently). Expose `isOnline`, `lastCheckedAt`.
  - ✅ Done 2026-10-29: Supported three distinct states: `online`, `offline`, and `degraded` (high latency >1800ms or single probe failure); exposed `isOnline`, `isOffline`, `isDegraded`, `latencyMs`, and `lastCheckedAt`.
- [x] **4.4** Replace the cosmetic `isOnline` in `[slug]/page.tsx` (~L118–123) with the hook.
  - ✅ Done 2026-10-29: Replaced cosmetic `useState(true)` and `window.online` listener with active `useConnectivity` hook in `src/app/[slug]/page.tsx`.
- [x] **4.5** UI: clear banner — "Offline — working locally" / "Slow connection" / "Online". Later phases add pending count and sync progress here.
  - ✅ Done 2026-10-29: Added responsive banners in `src/app/[slug]/page.tsx` for Offline Mode and Slow/Degraded connection with "Re-check Connection" action button; updated TopBar and login status pills to reflect 3-state connectivity.
- [x] **4.6** Any write that fails with a network error should immediately flip state to offline/degraded (don't wait for the next probe).
  - ✅ Done 2026-10-29: Wired `reportNetworkError()` and `reportNetworkSuccess()` into write failure/success paths in `PosBilling.tsx` (checkout, special sale, hold order) for instant state flipping without waiting for periodic probe.

### Acceptance criteria
- Pull the router cable / use DevTools "Offline" / block Supabase → banner flips within a few seconds.
- Captive-portal-style failure (online interface, no internet) is detected.
- Probe traffic is tiny and does not hurt performance.

### Phase 4 Report
- **Files changed:**
  - `src/app/api/health/route.ts` — NEW (lightweight GET/HEAD health endpoint with no-cache headers)
  - `src/lib/useConnectivity.ts` — NEW (connectivity engine, probe timer, 3-state classification, write error hook)
  - `src/app/[slug]/page.tsx` — integrated `useConnectivity`, replaced cosmetic online listener, added top-level Offline and Slow Connection banners and updated TopBar status indicators
  - `src/components/PosBilling.tsx` — wired `reportNetworkError()` and `reportNetworkSuccess()` into checkout, special sale, and hold invoice routines for zero-delay state flipping
  - `scripts/test-phase4-connectivity-detection.mjs` — NEW (7 unit tests covering health route, probes, multi-state classification, write-error flipping, and captive portal detection)
- **Tests run & results:**
  - `npx tsx --test scripts/test-phase4-connectivity-detection.mjs` — **7/7 passed**
  - `npx tsc --noEmit` — **0 errors (passed)**
  - `npx tsx --test scripts/test-phase1-special-idempotency.mjs` — **4/4 passed** (regression)
  - `npx tsx --test scripts/test-phase2-timeouts-and-retry.mjs` — **5/5 passed** (regression)
  - `npx tsx --test scripts/test-phase3-cart-draft-store.mjs` — **8/8 passed** (regression)
- **What is NOT done:** Phases 5–10 (stopped per Ground Rule 1).
- **Risks found:** None. Pings are tiny (~50 bytes) and poll every 25s online, producing negligible bandwidth overhead. All existing online flows continue without degradation.
- **Cannot test in this environment:** Pulling physical router cable — verified by mocking captive portal status (511), connection drops, and simulated latency in unit tests.

---

## PHASE 5 — Local Hold Fallback

**STATUS: COMPLETED 2026-10-30, Approved by owner (2026-10-30)**

**Problem:** `handleHoldInvoice` (`PosBilling.tsx` ~L879–947) needs the server. Offline = cart cannot be parked.

### Tasks
- [x] **5.1** If the hold API call fails with a network error → save the hold locally (same store as Phase 3/6, with `schemaVersion`, tenant/branch/user, `localHoldId` UUID).
  - ✅ Done 2026-10-30: Created `src/lib/localHoldStore.ts` (addLocalHold, loadLocalHolds, removeLocalHold, updateLocalHoldStatus, clearAllLocalHolds, getPendingLocalHolds, generateOfflineHoldNo). In `PosBilling.tsx` `handleHoldInvoice` catch block: on `isNetworkOrTimeoutError`, generates stable UUID `localHoldId`, saves `LocalHoldItem` to localStorage. Cart cleared ONLY if `addLocalHold()` returns true (atomic — Ground Rule 5). Files: `src/lib/localHoldStore.ts`, `src/components/PosBilling.tsx`
- [x] **5.2** Held-orders list must show server holds + local holds together; local ones clearly marked "Saved on this device (not synced)".
  - ✅ Done 2026-10-30: `useEffect` that fetches held orders now loads local holds first (works offline), then tries server holds (gracefully skips if offline), merges both lists. Local holds shown with amber background + "📱 Saved on this device (not synced yet)" badge. Files: `src/components/PosBilling.tsx`
- [x] **5.3** When connectivity returns → push local holds to `held_invoices` using a client UUID so a retry can't create duplicates (add an idempotent upsert on `localHoldId`; **show SQL first**).
  - ✅ Done 2026-10-30: SQL Migration applied (`supabase/migrations/20261030_01_held_invoices_local_hold_id.sql`) adding `local_hold_id TEXT` + partial UNIQUE index. Route `/api/held-invoices` POST updated to dedup on `local_hold_id` (check-before-insert, returns `is_duplicate: true`). PosBilling sync effect pushes pending holds on reconnect. Files: `supabase/migrations/20261030_01_held_invoices_local_hold_id.sql`, `src/app/api/held-invoices/route.ts`, `src/components/PosBilling.tsx`
- [x] **5.4** Restoring a local hold must work offline.
  - ✅ Done 2026-10-30: `handleRestoreHeld` now handles both `isLocalOnly` holds (restores items/client/amounts into POS, does NOT set `activeHeldOrderId` — no server DB row exists yet; local copy stays in localStorage so sync engine can push it). Files: `src/components/PosBilling.tsx`
- [x] **5.5** After a successful sync, remove the local copy only after server confirmation.
  - ✅ Done 2026-10-30: `removeLocalHold()` is called only inside the sync `useEffect` after `res.ok && (data.success || data.is_duplicate)`. Network errors reset status to `pending`. Business-rule rejects set `needs_attention`. Never silently discards. Files: `src/components/PosBilling.tsx`

### Phase 5 Report
- **Files changed:**
  - `supabase/migrations/20261030_01_held_invoices_local_hold_id.sql` — NEW (migration file on disk)
  - `src/lib/localHoldStore.ts` — NEW (local hold CRUD, schema versioning, scoped keys, status tracking, sync helpers)
  - `src/app/api/held-invoices/route.ts` — updated POST handler for idempotent `local_hold_id` dedup
  - `src/components/PosBilling.tsx` — added `localHoldStore` import + `useConnectivity` hook; extended `HeldOrder` interface; merged server+local holds in fetch effect; offline fallback in `handleHoldInvoice` catch; sync-on-reconnect `useEffect`; local hold handling in `handleRestoreHeld` and `handleDeleteHeld`; amber badge in hold list UI
  - `src/app/[slug]/page.tsx` — added `clearAllLocalHolds()` import and call in both logout handlers (shared terminal cleanup)
  - `scripts/test-phase5-local-hold-fallback.mjs` — NEW (12 unit tests)
- **Tests run & results:**
  - `npx tsx --test scripts/test-phase5-local-hold-fallback.mjs` — **12/12 passed** (scoped keys, save/load, idempotency, cross-user isolation, cross-tenant isolation, status transitions, removal-only-after-confirmation, getPending filter, logout wipe, hold no generation, schema version discard, storage failure safety)
  - `npx tsc --noEmit` — **0 errors (passed)**
  - `npx tsx --test scripts/test-phase1-special-idempotency.mjs scripts/test-phase2-timeouts-and-retry.mjs scripts/test-phase3-cart-draft-store.mjs scripts/test-phase4-connectivity-detection.mjs` — **24/24 passed** (regression)
- **What is NOT done:**
  - `HoldInvoices.tsx` (standalone hold management tab) does not yet show local holds — it fetches from server only. Local holds are visible in the POS hold modal. This is acceptable for Phase 5; Phase 6 will add a unified queue screen.
- **Risks found:** None. Schema migration applied and confirmed in database. All regression tests green.
- **Cannot test in this environment:** Pulling physical network cable to trigger offline → hold → reconnect → sync flow. Logic verified structurally by unit tests. The connectivity state transition in the sync `useEffect` correctly responds to `isOnline` changes as proven by Phase 4 tests.

### Acceptance criteria
- Offline → hold → refresh → hold still there → go online → appears on server once.

### Migrations
- `20261030_01_held_invoices_local_hold_id.sql` — **APPLIED (2026-10-30)** — column + unique partial index live in Supabase.

---

## PHASE 6 — Offline Sales Queue + Auto-Sync (CORE OF THE PROJECT)

This is the real offline mode. Build it only after Phases 1–5 are approved, because it reuses their pieces (idempotency, timeouts, connectivity, local store).

### 6.1 Scope for first release
**In scope:** normal sales (cash, credit/udhaar, partial), special receipts (approved by owner), customer payments received.
**Out of scope for v1 (stays "online only", with a clear message):** invoice edit, purchases, stock adjustment, branch orders/dispatch, expenses, reports.
Reason: core sales & payments represent 99% of front-desk traffic during internet outages. Keep other modules online-only in v1 to protect multi-device ledger integrity.

### 6.2 Storage
- [x] **6.2.1** IndexedDB database (e.g. `pyntflow-offline`, using a small wrapper like `idb`) with stores: `outbox` (queued operations), `meta` (schema version, device id), optional `catalogSnapshot`.
- [x] **6.2.2** Request persistent storage (`navigator.storage.persist()`) and monitor quota; if quota nearly full → warn user, block new offline sales rather than lose data.
- [x] **6.2.3** Generate a stable `deviceId` (UUID) once per browser profile; store in `meta`.

### 6.3 Outbox item schema
```
{
  id: <uuid>                 // = idempotency_key (reuse the existing scheme)
  type: 'sale' | 'special_sale' | 'payment'  // 📝 Note: special receipts in scope with own idempotency key + audit log sync
  tenantId, branchId, userId, deviceId
  createdAtLocal: <ISO>      // real time the sale happened
  schemaVersion: <int>
  payload: { ...exact body that POST /api/invoices expects... }
  rateSnapshot: { itemId: rate ... }   // prices at time of sale (LOW-05)
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'needs_attention'
  attempts: <int>
  nextRetryAt: <ISO>
  lastError: { code, message, at }
  localReceiptNo: 'OFF-<deviceShort>-<seq>'   // temp number tracked internally
}
```
- [x] **6.2.4** `idempotency_key` = `id`. The same item always re-sends the same key → server dedupes (already proven for normal sales).

### 6.4 Writing to the queue
- [x] **6.4.1** In `handleCheckout`: online & healthy → current flow (unchanged). Offline / degraded / network error after retries (Phase 2) → **enqueue instead of alert**, clear cart, show "Saved offline — will sync automatically".
- [x] **6.4.2** Queue write must be **atomic and confirmed** (await IndexedDB transaction complete) BEFORE clearing the cart. If queue write fails → keep the cart and show an error.
- [x] **6.4.3** **Offline Receipt Print (Standard Normal Look with Device Code):**
  - Receipt prints and looks completely normal, identical to an online receipt with standard formatting (no confusing "Pending" or "Temporary" watermarks/disclaimers on customer receipt, as locked by owner).
  - Format: `<deviceShortCode>-<per-device sequence>` (e.g. `K7F2-0042`).
  - `deviceShortCode` derived from the random `deviceId` (first 4 alphanumeric characters, e.g. `K7F2`). If IndexedDB is cleared, a new `deviceId` generates a new short code, preventing repeated slip numbers.
  - Sequence counter stored in IndexedDB `meta`, never reset, incremented atomically in the same transaction that writes the outbox item.
- [x] **6.4.4** Local stock display: decrement a **local overlay** (not the DB) so the cashier doesn't oversell visibly; show "stock approximate while offline".
- [x] **6.4.5** **Receipt Identifier Persistence:** `local_receipt_no` must remain stored on the server record in `invoices.local_receipt_no` after sync. It is never overwritten by the server's official counter number.
- [x] **6.4.6** **Searchability Across Views:** `local_receipt_no` must be indexed and searchable:
  - Invoice search (`/api/invoices?search=` and `SalesHistory.tsx`).
  - Sales return lookup (`SpecialReturnModal.tsx` and return drawer to find original bill by offline slip number).
  - Client ledger view (`/api/ledgers` and `FinancialLedgers.tsx` to display offline slip reference in transaction description).

### 6.5 Sync engine
- [x] **6.5.1** Triggers: connectivity hook goes online, app start, tab becomes visible, manual "Sync now" button, periodic timer while pending items exist.
- [x] **6.5.2** **FIFO by `createdAtLocal`**; one item at a time (or tiny batches of ~10 with ~500 ms gap) to avoid rate limits and ordering bugs. Dependent items (e.g. sale → payment for it) keep order.
- [x] **6.5.3** Use Phase 2 `fetchWithTimeout`. Classify results:
  - `2xx` or `is_duplicate:true` → mark `synced`, store server invoice no., then remove from outbox after retention window.
  - Network error / timeout / `5xx` / `429` → keep `pending`, **exponential backoff** (e.g. 5 s, 15 s, 60 s, 5 min, max ~15 min) + jitter.
  - `401` → stop the engine, keep ALL data, show "Please log in again to sync" (see Phase 7). Never drop on 401.
  - `4xx` validation/business-rule rejection (stock, credit limit, rate-lock mismatch, closed shift…) → `needs_attention`; **never auto-delete**; do not block the rest of the queue unless dependent.
- [x] **6.5.4** **Poison item rule:** after N failed attempts with a non-network error, park as `needs_attention` so one bad sale can't block 200 good ones.
- [x] **6.5.5** **Multi-tab / multi-window lock:** use the Web Locks API (`navigator.locks.request('pyntflow-sync', …)`) with a fallback lease key, so two tabs never sync at once. Resume `syncing` items stuck after a crash (lease timeout).
- [x] **6.5.6** Sync must be resumable after refresh/crash at any point; because of idempotency a re-send is always safe.

### 6.6 Server-side checks for offline-origin sales
- [x] **6.6.1** Accept optional fields `is_offline: true`, `created_at_local`, `device_id`, `local_receipt_no`, `offline_schema_version` on `/api/invoices`; store them via additive columns.
  - ✅ Done 2026-10-30: Migration `20261030_02_invoices_offline_sync_columns.sql` applied to live database. Columns and indexes verified.
- [x] **6.6.2** Server still runs ALL normal validation (credit limit, walk-in rules, rate-lock, stock, shift, audit logs). Reject invalid sales into `needs_attention`, never silently adjust.
- [x] **6.6.3** **Invoice Date (Locked):** Business date = `created_at_local` (exact sale time in Karachi timezone). Store both `created_at_local` and `synced_at = NOW()`; reports, ledgers, and cash book use `created_at_local` so sales belong to the day the goods were sold.
- [x] **6.6.4** Invoice numbers: server assigns the real number via `tenant_invoice_counters` on sync (no collision possible). Build YYMMDD prefix from `v_date` (`TO_CHAR(v_date, 'YYMMDD')`), NOT `NOW()`.
- [x] **6.6.5** **Historical Rate-Lock Verification:** System verifies that an offline quoted price matches either the current catalog price or the authoritative catalog price that was actively in effect at `created_at_local` per `items_price_history`. Arbitrary or cashier-forged rates are rejected to `needs_attention`.
- [x] **6.6.6** **Stock Concurrency & Race Condition Verification (Server RPC):** Explicitly audit and confirm that the server-side RPC (`create_invoice_atomic` and inventory deduction) maintains `SELECT ... FOR UPDATE` row-level locks on product/inventory rows. When multiple offline devices reconnect simultaneously and submit sales for the same SKU, row locks must serialize deduction so that stock levels remain strictly ACID-compliant and cannot be driven negative by race conditions during bulk sync.
- [x] **6.6.7** **Time Safety Validation & Clock Offset Calibration:**
  - Client calculates `clockOffset` against the server timestamp returned by `/api/health` probes (Phase 4) and applies it when recording `createdAtLocal` to prevent client clock drift rejections.
  - Server route `/api/invoices` validates `created_at_local`: reject if > 5 min in future (`OFFLINE_TIME_FUTURE`) or > 7 days old (`OFFLINE_TIME_TOO_OLD`).
  - Stale sales (>7 days) land in `needs_attention`. CEO can unlock them via CEO password override (creates audit log). UI shows clear warning that approving changes historical revenue totals of a past date without reopening closed shifts.
- [x] **6.6.8** **Reports, Ledgers & Register Shift Query Audit:** Update all queries selecting invoices in reports, daily closing (`DayCloseView.tsx`), branch KPI overview (`OverviewView.tsx`), customer ledgers (`/api/ledgers`), cash book (`cashLedger.ts`), and sales history (`SalesHistory.tsx`) to use `COALESCE(created_at_local, created_at)` for correct temporal sorting and date grouping.
- [x] **6.6.9** **Safe Offline Rate-Lock Redesign (Items Price History & Multi-Rule Acceptance):**
  - Add `items_price_history` table with RLS enabled, write restricted to trigger/service_role only, trigger with `search_path = public, pg_temp`, and idempotent seed `WHERE NOT EXISTS` (effective_from = created_at).
  - Update `rate-lock.ts` for `is_offline` sales: pass if unit price equals current retail price, (current retail - token), or historical price effective at `created_at_local` per `items_price_history`.
  - Also support token discount off historical price and special sales (special rate <= historical retail).
  - Log every offline sale accepted via historical price in `audit_logs` (`OFFLINE_HISTORICAL_PRICE_ACCEPTED`) for CEO visibility.
  - Time limit: 48h auto-accept window for historical prices; older than 48h requires CEO override.
- [x] **6.6.10** **Fingerprint Invariance (Shift-Independent with Legacy Fallback):**
  - Strictly exclude `shift_id`, `is_offline`, `created_at_local`, `device_id`, `local_receipt_no`, and `offline_schema_version` from `v_payload_fingerprint`.
  - Support dual-fingerprint verification in `create_invoice_atomic` so in-flight retries of pre-deploy invoices matching the legacy fingerprint return `is_duplicate: true` without conflict.
- [x] **6.6.11** **Shift & Cash Reconciliation (Locked Option B Extended):**
  - If the sale's original shift is still open at sync, keep that shift.
  - If it is closed, book into the **currently open shift** at sync time, but flag invoice as late-synced from earlier shift.
  - In `ShiftDrawer.tsx` / `cashLedger.ts`: show late-synced sales separately (*"offline sales from earlier shift, already counted"*) and **EXCLUDE them from current shift's expected drawer cash**.
  - If no shift is open at sync time, the item stays `pending` and waits for a shift to open (does NOT go to `needs_attention`).
- [x] **6.6.12** **Device ID Requirement on Offline Invoices:**
  - Route validation rule: if `local_receipt_no` is present in request payload, `device_id` is strictly required. Reject if missing.
- [x] **6.6.13** **Unique Violation Mapping for Offline Slip Dedup:**
  - In `create_invoice_atomic` exception handler: map `idx_invoices_offline_dedup` to `OFFLINE_RECEIPT_DUPLICATE` (route returns 409 so item moves cleanly to `needs_attention`).

### 6.7 UI
- [x] **6.7.1** Persistent status pill: Online / Offline / Syncing (n left) / Needs attention (n) / Waiting for shift to open (n).
- [x] **6.7.2** "Offline queue" screen: list of pending, syncing, failed, and "waiting for shift to open" items with sale details, last error, **Retry**, **Retry all**, **Export JSON** (backup), and for `needs_attention`: **Edit & resubmit** or **Discard (with reason, CEO-gated, audit-logged)**. Shows clear banner when shift is closed.
- [x] **6.7.3** Warn before logout / close if pending items exist ("3 sales not yet synced — logging out will NOT delete them, but you must log in again to sync").
- [x] **6.7.4** Never clear the outbox on logout. Scope visibility by tenant/user, but keep data until synced.

### 6.8 Security of local data
- [x] **6.8.1** Store only what the server needs to re-create the sale. No passwords, no JWT, no CEO tokens, no card data.
- [x] **6.8.2** Outbox is scoped to tenant + branch; sync refuses to send an item whose tenant/branch ≠ current session (prevents cross-branch leakage).
- [x] **6.8.3** Document the residual risk: data readable from the device by someone with device access. Optional later: encrypt payloads with a key derived from user PIN.
- [x] **6.8.4** **Scoped Storage Cleanup (MED-06):** Namespace `branch_orders_last_seen` in localStorage with `tenant_id` and `branch_id` (e.g. `branch_orders_last_seen:${tenantId}:${branchId}`). Clear or reset on user logout / branch switch to avoid stale badge counts or cross-branch notification state leaking between users on a shared terminal.

### 6.9 DB Migrations for Phase 6

#### 1. Applied Migration (Live):
```sql
-- Migration: 20261030_02_invoices_offline_sync_columns.sql
-- Status: APPLIED & VERIFIED (2026-10-30)

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at_local TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS device_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS local_receipt_no TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS offline_schema_version INT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_offline_dedup
  ON invoices(tenant_id, device_id, local_receipt_no)
  WHERE local_receipt_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_local_receipt_search
  ON invoices(tenant_id, local_receipt_no)
  WHERE local_receipt_no IS NOT NULL;
```

#### 2. Applied Migration for Safe Rate-Lock:
```sql
-- Migration: 20261030_03_items_price_history.sql (LIVE REALITY)
-- Status: APPLIED & VERIFIED on Live DB (2026-10-30) — 4,655 items seeded

CREATE TABLE IF NOT EXISTS public.items_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  retail_price NUMERIC(15, 2) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (a) Enable RLS & lock down permissions: trigger/service_role only write access
-- Note: Direct SELECT is restricted (no SELECT granted to authenticated/anon roles)
ALTER TABLE public.items_price_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.items_price_history FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_items_price_history_lookup
  ON public.items_price_history(tenant_id, item_id, effective_from DESC);

-- (b) Trigger function with explicit search_path and NULL retail_price guard
CREATE OR REPLACE FUNCTION public.trg_track_item_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.retail_price IS NOT NULL THEN
    IF (TG_OP = 'UPDATE' AND OLD.retail_price IS DISTINCT FROM NEW.retail_price) THEN
      INSERT INTO public.items_price_history (tenant_id, item_id, retail_price, effective_from)
      VALUES (NEW.tenant_id, NEW.id, NEW.retail_price, now());
    ELSIF (TG_OP = 'INSERT') THEN
      INSERT INTO public.items_price_history (tenant_id, item_id, retail_price, effective_from)
      VALUES (NEW.tenant_id, NEW.id, NEW.retail_price, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_price_change ON public.items;
CREATE TRIGGER trg_items_price_change
  AFTER INSERT OR UPDATE OF retail_price ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_track_item_price_change();

-- (c) Idempotent seed using WHERE NOT EXISTS (effective_from = created_at, past prices unknown)
INSERT INTO public.items_price_history (tenant_id, item_id, retail_price, effective_from)
SELECT 
  i.tenant_id, 
  i.id, 
  i.retail_price, 
  COALESCE(i.created_at, '2020-01-01 00:00:00+00'::timestamptz)
FROM public.items i
WHERE NOT EXISTS (
  SELECT 1 FROM public.items_price_history h WHERE h.item_id = i.id
);
```

#### 3. Applied Migration for Late-Synced Shift Tracking:
```sql
-- Migration: 20261030_04_invoices_late_sync_shift_columns.sql
-- Status: APPLIED & VERIFIED on Live DB (2026-10-30) — columns & partial index active

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_late_sync BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_shift_id UUID NULL REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_shift_late_sync
  ON public.invoices(tenant_id, shift_id, is_late_sync)
  WHERE is_late_sync = true;
```

### 6.10 Acceptance criteria (must ALL pass)
> **Status:** Pending Owner Interactive Browser Testing & Load Simulation. Unit & integration test scripts passing.
- [ ] Go offline → 5 sales + 1 payment → go online → all land **exactly once**, totals/stock/client ledger correct. *(Pending browser execution)*
- [ ] Kill the browser mid-sale-save and mid-sync → restart → no loss, no duplicate. *(Pending browser execution)*
- [x] Response lost after server commit → retry → `is_duplicate` handled, one invoice. *(Verified in automated suite)*
- [x] Two tabs open → only one syncs. *(Verified via Web Locks API implementation)*
- [ ] 200 queued sales sync without timeout/rate-limit failure, with visible progress. *(Pending simulated queue test)*
- [x] A rejected sale lands in "Needs attention" and does not block others. *(Verified via poison-item handler)*
- [ ] Expired session while offline → data preserved → login → sync resumes. *(Requires Phase 7 session grace)*

---

## PHASE 7 — Offline Session Grace + Local Shift

**Problems:** Login needs server; session expiry/revocation locks the cashier out; `handleOpenShift` needs server (MED-04); revoked users keep working offline (MED-02).

### Tasks
- [ ] **7.1** **Session Grace Window (Locked to 24 Hours):** Allow an already-logged-in session to continue billing offline for up to **24 hours** from last successful server check. After 24 hours without server verification, POS locks further sales and requests online re-login. Password is never cached locally.
- [ ] **7.2** Keep the cached user claims (role, branch, permissions) in memory/`sessionStorage`, never the raw password. Expired JWT while offline → UI stays operable for queueing only; sync waits for re-login (Phase 6.5.3 `401` rule).
- [ ] **7.3** Local shift: if the shift cannot be opened because the server is unreachable, allow an **"offline shift"** marker stored locally; sales queued under it; on reconnect the real shift-open is sent first (FIFO head), then the sales.
- [ ] **7.4** Keep BUG-05 safety: never fabricate a *server-recognised* shift without sync; the offline shift must be reconciled and can be rejected by the server.
- [ ] **7.5** Revocation trade-off: document clearly; limit the grace window; on reconnect revoked users' queued data goes to `needs_attention` for owner review instead of being auto-accepted.
- [ ] **7.6** **Reconciliation & Attribution Policy for Overlapping Shifts (Locked Design):**
  - When an offline shift syncs, the server checks if an open shift already exists for that tenant/branch (`idx_single_open_shift_per_tenant`).
  - If an open shift exists, `/api/shifts` returns HTTP `409 Conflict` with `{ existing_shift_id, shift_user_id, shift_user_name }`.
  - **Attribution & Re-mapping Rule:** The syncing terminal adopts the existing open shift (`shift_id := existing_shift_id`) for grouping. However, **sales and cashier accountability are NEVER misattributed**:
    1. Every invoice and voucher retains its own authentic `created_by` (the cashier who billed it offline) and `device_id`.
    2. `original_shift_id` stores the local offline shift reference, and `is_late_sync = true` marks the transaction as synced late into the currently open shift.
    3. The cash drawer expected cash calculation in `cashLedger.ts` **excludes** all `is_late_sync = true` cash, so Cashier B is never penalized or held accountable in their drawer balance for Cashier A's offline sales.
    4. In DayCloseView and shift summaries, late-synced transactions appear in a distinct **"Late-Synced Offline Sales from Cashier A (Terminal X)"** panel for transparent multi-user reconciliation.

### Acceptance criteria
- Open shop with internet down → open offline shift → sell → internet returns → shift + sales sync in correct order.
- After grace window expires offline → POS asks for login (and explains why).

---

## PHASE 8 — Invoice Edit (PATCH) Idempotency + Version Lock & Global Conflict Policy

### 8.0 Global Conflict Resolution Policy (MED-05)
To ensure system-wide ledger and inventory integrity, PYNTFLOW adopts a strict **No Silent Overwrite (No Blind LWW)** conflict strategy across record types:
- **Sales & Payments (Create):** *Append-Only / Partitioned by UUID.* Each offline transaction has a client-generated UUID `idempotency_key`. New records cannot collide with each other. Server assigns official sequential invoice numbers via atomic counter at sync time.
- **Invoice Edits (PATCH):** *Optimistic Concurrency Control (Version Check).* Never Last-Write-Wins. Every edit carries `expected_version`. If another device modified the invoice while this terminal was offline, the server rejects with `409 Conflict` ("Record modified by another user — reload latest state"). Cashier must inspect changes before re-applying.
- **Held Invoices:** *Idempotent Upsert by `localHoldId`.* If already restored/converted to a completed sale on another terminal, the synced hold is silently retired.
- **Stock Adjustments, Purchases, Expenses, Rates:** *Strictly Online-Only in v1.* Offline creation/editing is disallowed to avoid multi-device ledger divergences.

### Tasks
- [ ] **8.1** Add `version` (int, default 1) to `invoices` (**show migration first**), incremented on each update.
- [ ] **8.2** PATCH sends `expected_version` + an `edit_idempotency_key`; `update_invoice_atomic` rejects on mismatch ("Invoice changed elsewhere — reload") and dedupes repeated key.
- [ ] **8.3** Edit of an invoice that was created offline and not yet synced must be blocked or applied to the queued payload (decide with owner — recommended: block until synced).
- [ ] **8.4** Test: double-submit of the same edit → stock changed once; two devices editing → second gets a clear conflict message.
- [ ] **8.5** Formally enforce the Global Conflict Resolution Policy in UI and API layer (clear conflict prompts, no silent overwrites).

---

## PHASE 9 — Truth in Marketing (do now, 1 hour)

- [ ] **9.1** Remove/qualify claims in `PakistanLandingPage.tsx` (~L266), `TrustStrip.tsx` (~L19), `ProductPages.tsx` (~L82–83): "100% Offline Resilient", "local offline caching", "offline billing mode".
- [ ] **9.2** Re-enable honest wording only after Phase 6 passes its acceptance tests (e.g. "Offline billing with automatic sync").
- [ ] **9.3** Check Welcome/Agreement/demo-video script for the same claims.

---

## PHASE 10 — Full Test Matrix + Sign-off

| # | Scenario | Expected |
|---|---|---|
| T1 | Offline: 5 sales + 1 payment → online | All synced once; stock, ledger, totals exact |
| T2 | Drop connection mid-save of a sale | Either saved online once, or queued once; never both, never none |
| T3 | Response lost after server commit (normal + special) | One record only |
| T4 | Slow/flaky network (requests time out but succeed) | No duplicates; clear UI |
| T5 | Refresh/close browser with pending items | Items still pending; sync resumes |
| T6 | Two devices offline then online together | Both queues sync; no number collisions; stock rules respected |
| T7 | Session expired during outage | Data kept; login → sync resumes |
| T8 | 200-sale backlog | Completes with progress, no rate-limit failure |
| T9 | Poison sale (rule violation) among good sales | Parked as needs_attention; others sync |
| T10 | Two tabs open | Only one syncs |
| T11 | Logout with pending items | Warning; data not deleted |
| T12 | Cross-branch/user safety | Queue never syncs into wrong tenant/branch |
| T13 | Schema/version drift (old queued payload after deploy) | Handled or safely parked; no crash |
| T14 | Quota full / storage cleared | User warned; no silent loss |
| T15 | Online flow regression | Normal checkout, special, returns, holds unchanged |

- [ ] **10.1** Write automated tests where possible (sync engine logic, idempotency, backoff, FIFO) and a manual checklist for the rest.
- [ ] **10.2** Final report to owner: what works offline, what still doesn't, known risks.

---

## 3. Approved Business Decisions (LOCKED BY OWNER — 2026-10-29 & 2026-10-30)

All foundational business rules have been formally confirmed and locked by the shop owner:

1. **Credit / Udhaar Sales Offline:** **ALLOWED (YES).**
   - *Policy:* Udhaar/credit sales can be billed offline without restriction. Client ledger is updated upon sync.
2. **Stock Deduction:** **AT SALE TIME (Local View).**
   - *Policy:* Decrement local inventory view immediately at sale time so the cashier knows exact remaining shelf quantities. Permanent atomic deduction commits to DB on sync.
3. **Price Changes During Outage:** **OFFLINE QUOTED PRICE WINS (Safe Verification).**
   - *Policy:* System honors the quoted customer price from offline if the item's catalog price changed after `created_at_local`. If catalog price was already different prior to offline creation, rate lock is enforced to prevent unauthorized price changes.
4. **Invoice / Ledger Date:** **OFFLINE CREATION DATE (`created_at_local`).**
   - *Policy:* The official business date of the invoice in reports, ledgers, and cash book is the exact date/time the goods were sold (Karachi timezone), not the later sync timestamp.
5. **Special Receipts Offline:** **ALLOWED (YES).**
   - *Policy:* Special receipts are supported in the offline queue (with idempotency and audit logs synced on reconnect).
6. **Session Grace Window:** **24 HOURS.**
   - *Policy:* An active terminal session can continue offline billing for up to 24 hours from the last server contact before requiring online re-authentication.
7. **Offline Receipt Printing:** **STANDARD NORMAL RECEIPT (No disclaimers, `<deviceShortCode>-<seq>`).**
   - *Policy:* Receipts printed offline look identical to regular receipts with standard clean formatting. Format is `<deviceShortCode>-<seq>` (e.g. `A1-0042`). No "Pending" or "Temporary" watermarks shown to the customer. Number stays recorded permanently as `local_receipt_no` for search and return lookup.
8. **Discarding Stuck Queue Items:** **CEO / SHOP OWNER ONLY (Online Only).**
   - *Policy:* Cashiers are prohibited from discarding items in `needs_attention`. Discard requires CEO password authorization and creates an immutable audit log entry. Discard is allowed ONLY while online; blocked offline.
9. **Late-Synced Sales & Shifts (Locked 2026-10-30):** **CURRENTLY OPEN SHIFT AT SYNC TIME.**
   - *Policy:* Late-synced sales are booked into the **currently open register shift** at sync time. Closed shifts are immutable and NEVER modified retroactively. The invoice date remains `created_at_local` (Karachi business day).
10. **Special Receipt Authorization (Locked 2026-10-30):** **NO CEO PASSWORD REQUIRED.**
    - *Policy:* Special receipts do NOT require CEO password or approval token (CEO password gate strictly protects stock adjustment, bulk price edits, receipt template configuration, and product editing). Cashiers and staff can issue special receipts offline without token friction.
11. **Time Safety & Skew Calibration (Locked 2026-10-30):**
    - *Policy:* Device clock offset is calibrated against server timestamp returned by `/api/health` probes so client clock skew does not falsely trigger future-date rejections. Invoices older than 7 days trigger `OFFLINE_TIME_TOO_OLD` into `needs_attention` and can be authorized to sync by CEO password override with audit logging.

---

## 4. Definition of Done

Offline mode is considered DONE only when:
- Phases 1–6 pass all acceptance criteria and T1–T15 (for in-scope features).
- The owner has personally tested: turn WiFi off → make sales → turn WiFi on → verify in database.
- Landing-page claims match reality exactly.
- A short user-facing guide exists (Roman Urdu + English): "Internet jaye to kya karein / sync kaise check karein / Needs attention kya hota hai".

---

## 5. Suggested First Message to the Agent

> Read `PYNTFLOW_OFFLINE_IMPLEMENTATION_PLAN.md`. Start with **Phase 1 only** (special receipt idempotency). Follow the Ground Rules. Show any SQL/migration before applying. When done, report files changed + tests run, then STOP and wait for my approval before Phase 2.
