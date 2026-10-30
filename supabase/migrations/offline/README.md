# Offline Mode Database Migrations (Phase 6–8)

This directory contains the forward migrations, rollback scripts, and standalone transactional SQL tests for the remaining offline mode phases of **PYNTFLOW POS**.

> [!IMPORTANT]
> **Migrations 06, 07, and 08 were APPLIED to the live DB on 2026-10-30 (owner authorized, manual backup taken first).**  
> Migrations for Phase 9 and Phase 10 are NOT YET APPLIED.
> Always take a manual Supabase backup immediately before applying any future migration.

---

## 1. Migration Status & Roadmap Table

| # | Migration File | Phase | Status | Depends On | Code Coupling | Rollback Script | Test Script |
|---|---|---|---|---|---|---|---|
| **06** | `20261030_06_vouchers_idempotency_and_offline_sync.sql` | Phase 6 / Phase 9 (Payment Outbox) | **APPLIED 2026-10-30** | `20261013_03` | Deploy together with outbox type `'payment'` in `syncEngine.ts` and `vouchers/route.ts` | `rollback_20261030_06_vouchers_idempotency.sql` | `test_20261030_06_vouchers_idempotency.sql` |
| **07** | `20261030_07_shifts_local_shift_offline_sync.sql` | Phase 7 (Offline Shift Open) | **APPLIED 2026-10-30** | `20261030_04` | Deploy together with `handleOpenShift` local fallback and `shifts/route.ts` UUID handling | `rollback_20261030_07_shifts_local_shift.sql` | `test_20261030_07_shifts_local_shift.sql` |
| **08** | `20261030_08_invoices_version_and_update_atomic_v2.sql` | Phase 8 (Invoice Edit Idempotency & Version Lock) | **APPLIED 2026-10-30** | `20261007_01` | Deploy together with `invoices/route.ts` PATCH `expected_version` validation and 409 mapping | `rollback_20261030_08_invoices_version.sql` | `test_20261030_08_invoices_version.sql` |

---

## 2. Detailed Migration Specifications

### Migration 06 — Vouchers Idempotency, Time Safety & Late Sync
- **File:** `20261030_06_vouchers_idempotency_and_offline_sync.sql`
- **Tables Modified:** `public.vouchers`
- **Columns Added:**
  - `idempotency_key UUID NULL`
  - `is_offline BOOLEAN NOT NULL DEFAULT false`
  - `created_at_local TIMESTAMPTZ NULL`
  - `device_id TEXT NULL`
  - `local_receipt_no TEXT NULL`
  - `synced_at TIMESTAMPTZ NULL`
  - `is_late_sync BOOLEAN NOT NULL DEFAULT false`
  - `original_shift_id UUID NULL REFERENCES public.shifts(id) ON DELETE SET NULL`
- **Indexes Added:**
  - `idx_vouchers_idempotency` ON `vouchers(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
  - `idx_vouchers_offline_dedup` ON `vouchers(tenant_id, device_id, local_receipt_no) WHERE local_receipt_no IS NOT NULL`
  - `idx_vouchers_local_receipt_search` ON `vouchers(tenant_id, local_receipt_no) WHERE local_receipt_no IS NOT NULL`
  - `idx_vouchers_shift_late_sync` ON `vouchers(tenant_id, shift_id, is_late_sync) WHERE is_late_sync = true`
- **RPC Upgraded:** `public.create_voucher_atomic` (v2)
  - Time safety checks: Rejects `created_at_local` > 5 min in future (`OFFLINE_TIME_FUTURE`) or > 7 days old (`OFFLINE_TIME_TOO_OLD`).
  - Payload Conflict Detection: Same `idempotency_key` with different amount, party, or voucher_type raises `IDEMPOTENCY_CONFLICT`.
  - Shift-at-Sync Reconciliation: Keeps original shift if open; if closed, reassigns to current open shift with `is_late_sync = true`; if no shift open, raises `WAITING_FOR_OPEN_SHIFT`.
  - Date calculation: Strictly defaults to `(NOW() AT TIME ZONE 'Asia/Karachi')::DATE` instead of UTC `CURRENT_DATE`.
- **Verification:** Run `test_20261030_06_vouchers_idempotency.sql` (BEGIN ... ROLLBACK).
- **Rollback:** Run `rollback_20261030_06_vouchers_idempotency.sql`.

---

### Migration 07 — Shifts Local Shift & Offline Sync
- **File:** `20261030_07_shifts_local_shift_offline_sync.sql`
- **Tables Modified:** `public.shifts`
- **Columns Added:**
  - `local_shift_id UUID NULL`
  - `is_offline BOOLEAN NOT NULL DEFAULT false`
  - `device_id TEXT NULL`
  - `synced_at TIMESTAMPTZ NULL`
- **Indexes Added:**
  - `idx_shifts_local_shift_dedup` ON `shifts(tenant_id, local_shift_id) WHERE local_shift_id IS NOT NULL`
  - `idx_shifts_offline_status` ON `shifts(tenant_id, status, is_offline) WHERE is_offline = true`
- **Design Decisions Clarified:**
  - **Server Primary Key:** The server always generates `shifts.id`. The client-generated UUID is stored in `local_shift_id`. The client maps `local_shift_id -> server id` upon response.
  - **Overlapping Open Shift:** If server already has an active open shift when an offline shift syncs, the server returns the existing open shift's ID instead of duplicating shifts. The client adopts that shift ID.
  - **Shift Close:** Strictly online-only in v1.
- **Verification:** Run `test_20261030_07_shifts_local_shift.sql` (BEGIN ... ROLLBACK).
- **Rollback:** Run `rollback_20261030_07_shifts_local_shift.sql`.

---

### Migration 08 — Invoices Version & update_invoice_atomic v2
- **File:** `20261030_08_invoices_version_and_update_atomic_v2.sql`
- **Tables Modified:** `public.invoices`
- **Columns Added:**
  - `version INT NOT NULL DEFAULT 1`
  - `edit_idempotency_key UUID NULL`
- **Indexes Added:**
  - `idx_invoices_edit_idempotency` ON `invoices(tenant_id, edit_idempotency_key) WHERE edit_idempotency_key IS NOT NULL`
- **RPC Upgraded:** `public.update_invoice_atomic` (v2)
  - Drops existing 4-arg function before recreating to eliminate function signature ambiguity.
  - Idempotency check executed under row lock (`FOR UPDATE`) to eliminate race conditions.
  - Replicates live privileges: `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role only`.
  - Rejects stale version updates with `INVOICE_VERSION_CONFLICT` exception (maps to HTTP 409).
  - Increments `version = version + 1` atomically on successful edit.
  - Returns `is_duplicate = true` on repeated `edit_idempotency_key`.
- **Verification:** Run `test_20261030_08_invoices_version.sql` (BEGIN ... ROLLBACK).
- **Rollback:** Run `rollback_20261030_08_invoices_version.sql`.

---

## 3. Strict Application Protocol

When the owner authorizes applying a migration:
1. **Take a Manual Supabase Backup** via dashboard (`Settings -> Database -> Backups`).
2. Run the corresponding test script (`test_...sql`) in the Supabase SQL Editor to confirm that the `BEGIN ... ROLLBACK` block passes with 0 errors.
3. Apply the migration file (`20261030_...sql`).
4. Re-run sandbox test cases to verify live behavior.
5. Deploy the accompanying application code.

