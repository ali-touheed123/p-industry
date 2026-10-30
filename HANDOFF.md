# PYNTFLOW POS — Offline Mode Engineering Handoff

**Repository:** `d:\bestow\p-industry`  
**Active Development Branch:** `main` (feat/offline-mode and fix/karachi-dates merged)  
**Live Supabase Project ID:** `ignspvajzblmsbertmmv`  
**Primary Architecture Plan:** [`PYNTFLOW_OFFLINE_IMPLEMENTATION_PLAN.md`](file:///d:/bestow/p-industry/PYNTFLOW_OFFLINE_IMPLEMENTATION_PLAN.md)  
**Date of Handoff:** 2026-10-30

---

## 1. What Is Done (Phases 1 through 6 Status)

### Status: All Offline Development & Test Matrix Complete (Phase 1–8 & 10) (2026-10-30)

### Core Capabilities Live on Database & Application:
- **Phase 1 (Special Receipt Idempotency):** Duplicate submit protection, fingerprint validation, idempotent return (`is_duplicate: true`).
- **Phase 2 (Network Timeouts & Auto-Verify):** `fetchWithTimeout` wrapper across all write routes (POS checkout, special sale, held orders, recovery).
- **Phase 3 (Cart Draft Auto-Save):** Scoped localStorage cart recovery by `tenantId`, `branchId`, `userId`. Auto-clears on sale completion or explicit cancel.
- **Phase 4 (Active Connectivity Probing):** Active `/api/health` heartbeat probing, dynamic clock offset calibration, state indicators (Online / Degraded / Offline).
- **Phase 5 (Local Hold Fallback):** Offline hold storage in `localHoldStore.ts`, deduplication via `local_hold_id`, auto-sync upon reconnection.
- **Phase 6 (Offline Sales Queue + Auto-Sync):**
  - **Status:** Sales & special sales offline queue + auto-sync fully implemented and passing unit tests. Customer payment vouchers (outbox type `'payment'`, migration 06) and interactive browser acceptance tests (6.10: 200 sales, two tabs, mid-sync crash) remain pending.
  - **Database Migrations Applied to Live Supabase:**
    - Migration 02 (`20261030_02_invoices_offline_sync_columns.sql`): `is_offline`, `created_at_local`, `device_id`, `local_receipt_no`, `synced_at`, and deduplication indexes.
    - Migration 03 (`20261030_03_items_price_history.sql`): Item price audit history, RLS locked down, trigger with explicit `search_path`, 4,655 items seeded.
    - Migration 04 (`20261030_04_invoices_late_sync_shift_columns.sql`): `is_late_sync` and `original_shift_id` columns with partial index.
    - Migration 05 (`20261030_05_create_invoice_atomic_v2_offline.sql`): Full v2 RPC with shift-independent fingerprint, legacy fingerprint fallback, post-duplicate time safety checks, and `OFFLINE_RECEIPT_DUPLICATE` mapping.
    - **Migration 07 (`20261030_07_shifts_local_shift_offline_sync.sql`): APPLIED & VERIFIED 2026-10-30.** Adds `local_shift_id`, `is_offline`, `device_id`, `synced_at` to `shifts`.
    - **Migration 06 (`20261030_06_vouchers_idempotency_and_offline_sync.sql`): APPLIED & VERIFIED 2026-10-30.** Adds 8 offline columns to `vouchers`, 4 indexes, upgrades `create_voucher_atomic` to v2.
    - **Migration 08 (`20261030_08_invoices_version_and_update_atomic_v2.sql`): APPLIED & VERIFIED 2026-10-30.** Adds `version`, `edit_idempotency_key` to `invoices`, upgrades `update_invoice_atomic` to v2 (6-arg), drops old 4-arg overload.
  - **Client Storage & Sync:**
    - Native IndexedDB store `pyntflow-offline` (`outbox` and `meta` stores in [`offlineQueueStore.ts`](file:///d:/bestow/p-industry/src/lib/offlineQueueStore.ts)).
    - Automatic `<deviceShortCode>-<seq>` receipt numbering with standard customer receipts (no confusing "Temporary" watermarks).
    - Multi-tab synchronization locking via Web Locks API (`navigator.locks.request`) in [`syncEngine.ts`](file:///d:/bestow/p-industry/src/lib/syncEngine.ts).
    - Strict FIFO order by `createdAtLocal`.
    - Poison-item containment: 4xx validation rejections move to `needs_attention` without blocking other sales.
    - Shift-waiting logic: 422 `waiting_for_shift` pauses processing until a register shift opens.
    - Local stock overlay deduction in `PosBilling.tsx` prevents overselling while offline.
  - **UI & Searchability:**
    - [`OfflineStatusPill`](file:///d:/bestow/p-industry/src/components/OfflineQueueModal.tsx) mounted in POS navigation header.
    - [`OfflineQueueModal`](file:///d:/bestow/p-industry/src/components/OfflineQueueModal.tsx) with "Sync Now", individual "Retry", "Export JSON", and CEO password-gated "Discard".
    - `local_receipt_no` searchable in `/api/invoices`, [`SalesHistory.tsx`](file:///d:/bestow/p-industry/src/components/SalesHistory.tsx), and [`/api/ledgers`](file:///d:/bestow/p-industry/src/app/api/ledgers/route.ts) (`[Slip #<local_receipt_no>]`).
- **Phase 7 (Offline Session Grace + Local Shift):**
  - **24-Hour Session Grace Window (`src/lib/sessionGrace.ts`):** Cached claims in `sessionStorage` allow POS to continue billing offline for up to 24 hours from last server check. After 24h, full-screen bilingual lock modal enforces online re-login. Passwords never cached.
  - **Offline Shift Store (`src/lib/offlineShiftStore.ts`):** When server is unreachable during shift open, a local shift marker is persisted in localStorage.
  - **FIFO Head Sync (`src/lib/offlineQueueStore.ts` & `src/lib/syncEngine.ts`):** `shift_open` outbox item is prioritized at the head of the outbox (earlier timestamp) and synced before any queued sales.
  - **Overlapping Shift Adoption (Task 7.6):** 409 conflict on shift open adopts the existing open shift on the server, remapping all queued sales and marking them `is_late_sync: true` (excluded from active cashier drawer in `cashLedger.ts`).
  - **Offline Shift Close Guard:** Closing a shift while offline is strictly blocked client-side in `ShiftDrawer.tsx` with clear user warning.
  - **Test Suite:** 5 passing unit tests in `scripts/test-phase7-offline-shift.mjs`.
- **Phase 8 (Invoice Edit Idempotency + Version Lock & Global Conflict Policy):**
  - **Optimistic Concurrency Control (`version`):** `invoices.version` increments on every edit. PATCH requests pass `expected_version`. If another user modified the invoice concurrently, server rejects with HTTP 409 `INVOICE_VERSION_CONFLICT`.
  - **Edit Idempotency Deduplication (`edit_idempotency_key`):** PATCH requests pass `edit_idempotency_key`. Under row lock, repeated requests return `is_duplicate: true` without re-reverting inventory or multiplying client balance deltas.
  - **Online-Only Edit Guard:** Attempting to edit an invoice while offline or editing an unsynced offline sale is strictly blocked in `PosBilling.tsx` and `SalesHistory.tsx` to prevent multi-device ledger divergences.
  - **Test Suite:** 4 passing unit tests in `scripts/test-phase8-invoice-edit.mjs`.
- **Phase 10 (Full Test Matrix & Operator Manual Guide):**
  - **Automated Matrix Test Suite (`scripts/test-phase10-matrix.mjs`):** 14/14 automated tests passing across scenarios T1–T15 (FIFO sync, idempotency dedup, exponential backoff, shortcode generation, 401 session expiry, 200-sale backlog, poison items, Web Locks mutual exclusion, and optimistic lock version conflicts).
  - **Operator & Testing Guide (`OFFLINE_OPERATION_AND_TEST_GUIDE.md`):** Bilingual manual guide (Roman Urdu + English) and 7-step test checklist explicitly targeted at testing tenants `/example` and `/example-branch-2` (with zero mutations to production `tph`).

---

## 2. What Is Next (Remaining Work)

1. **Owner Interactive Smoke Testing on Test Branches:**
   - Run manual verification on test tenant `/example` (Tenant ID `2a9dbd7e-0c33-462e-adbd-b25083674248`) and sister branch `/example-branch-2` (Tenant ID `b8064358-b581-4221-ba75-ccdb056d5c00`) using the 7-step checklist in `OFFLINE_OPERATION_AND_TEST_GUIDE.md`.
   - **Important:** Never touch or modify production `tph` shop.
2. **Phase 9 — Truth in Marketing (Optional / On Demand):**
   - Copy adjustments in marketing pages can be updated when owner decides to go live.

---

## 3. Locked Owner Decisions

All fundamental architectural decisions are locked by the business owner (see Section 3 of `PYNTFLOW_OFFLINE_IMPLEMENTATION_PLAN.md`):
1. **Udhaar / Credit Sales Offline:** **ALLOWED (YES).** Client ledger is updated upon sync.
2. **Stock Deduction:** **AT SALE TIME (Local View).** Local overlay decrements immediately; permanent DB deduction commits on sync.
3. **Price Changes During Outage:** **OFFLINE QUOTED PRICE WINS (Safe Verification).** Supported via `items_price_history` if price changed after `created_at_local`.
4. **Invoice / Ledger Date:** **OFFLINE CREATION DATE (`created_at_local`).** Financial ledgers and reports use sale time in Karachi timezone, not the later sync time.
5. **Customer Receipts:** **STANDARD LOOK WITH DEVICE CODE.** Format: `<deviceShortCode>-<seq>` (e.g. `K7F2-0042`). No "Pending" or "Temporary" watermarks.
6. **Closed Shifts (Late Sync):** **BOOKED INTO CURRENT OPEN SHIFT.** Late-synced sales are flagged `is_late_sync = true`, shown separately in ShiftDrawer, and **EXCLUDED from current drawer expected cash**.
7. **CEO Gated Discard:** Discarding poison items in `needs_attention` requires CEO password and generates an immutable audit log.

---

## 4. Non-Negotiable Project Rules

1. **NO DB CHANGES WITHOUT OWNER CONFIRMATION:**
   - Never apply migrations, triggers, or RPC updates to the live DB without explicit user confirmation.
   - Staging project does not exist; live DB has test tenants (`example`, `example-branch-2`). Always test in `BEGIN ... ROLLBACK` transaction blocks first.
2. **ALWAYS BACKUP FIRST:**
   - Prompt the user to trigger a manual backup in the Supabase Dashboard before applying any DDL.
3. **STRICT SEQUENCE: DB FIRST, THEN CODE PUSH:**
   - Database columns and RPCs must be applied and verified on the database *before* pushing code that selects or passes those columns to avoid runtime breakage.
4. **ADDITIVE MIGRATIONS ONLY:**
   - Never drop existing columns or tables in forward migrations. Use `IF NOT EXISTS` and provide complete rollback scripts.
5. **NO SILENT OVERWRITES (NO BLIND LWW):**
   - Updates must use optimistic locking (`version`). Concurrent conflicts return HTTP 409.

---

## 5. Verification Commands

To verify code quality and test suites across phases, run:

```powershell
# 1. Typecheck the entire project (must report 0 errors)
npx tsc --noEmit

# 2. Run Phase 6 late-sync coverage audit (34/34 checks)
node scripts/test-phase6-is-late-sync-coverage.mjs

# 3. Run Phase 1-6 offline unit test suite (36/36 checks)
npx tsx --test scripts/test-phase1-special-idempotency.mjs scripts/test-phase2-timeouts-and-retry.mjs scripts/test-phase3-cart-draft-store.mjs scripts/test-phase5-local-hold-fallback.mjs scripts/test-phase6-offline-queue.mjs
```

---

## 6. Known Gotchas & Troubleshooting

- **PowerShell Regex Character Class Escapes:**  
  PowerShell cmdlets (like `Select-String`) interpret square brackets in Next.js App Router paths (e.g., `src/app/[slug]/page.tsx`) as regex character sets. Always use Node.js scripts or `git grep` for text manipulation and searching.
- **Node ESM `@/` Alias Resolution:**  
  Plain Node.js (`node --test`) cannot resolve TypeScript path aliases (`@/`). Always use `npx tsx --test` for scripts importing project modules.
- **Line Endings (CRLF vs LF):**  
  Source files in this Windows repo often have CRLF line endings (`\r\n`). When editing with replacement tools, match exact CRLF whitespace.
- **Dual Fingerprints in `create_invoice_atomic`:**  
  RPC v2 uses a shift-independent fingerprint (`v_payload_fingerprint`). For in-flight retries created before migration 05, it also checks the legacy fingerprint (`v_legacy_fingerprint`) to prevent duplicate invoice generation.

---

## 7. Pre-existing Known Issues (Not Caused by Offline Work)

These issues were confirmed present in the archived pre-offline codebase and were not introduced by offline development:
1. **`update_invoice_atomic` does not write `invoice_items.cost_price` on edit:**  
   When an invoice is edited via `update_invoice_atomic`, the new line items inserted into `invoice_items` omit `cost_price` (it defaults to `NULL` or is omitted from the `INSERT INTO invoice_items` statement). Consequently, gross profit / margin reports that compute profit from `unit_price - cost_price` will produce inaccurate margins for edited invoices. *(Pre-existing: confirmed in `archive_update_invoice_atomic_pre_offline.sql` lines 105-119).*
2. **`allow_negative_stock` fetched but not enforced in `update_invoice_atomic`:**  
   In `update_invoice_atomic`, `SELECT COALESCE(allow_negative_stock, true) INTO v_allow_neg_stock FROM tenants` retrieves the tenant setting, but the loop updating stock balances (`UPDATE items SET stock_qty = stock_qty + v_apply_delta`) never checks `v_allow_neg_stock` before executing. Stock is updated regardless of whether `allow_negative_stock` is true or false. Negative stock validation is enforced in the API route `/api/invoices/[id]` before calling the RPC, but the RPC itself does not enforce it at the database layer. *(Pre-existing: confirmed in `archive_update_invoice_atomic_pre_offline.sql`).*


