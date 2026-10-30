/**
 * src/lib/offlineShiftStore.ts
 *
 * Phase 7: Offline Shift Marker (localStorage-based)
 *
 * When the POS cannot reach the server during shift open, a local shift marker
 * is written to localStorage. The sync engine reads it and sends the shift-open
 * request as the FIRST item in the FIFO queue before flushing any queued sales.
 *
 * Key format: `pyntflow_offline_shift:<tenantId>:<userId>`
 *
 * Lifecycle:
 *   saved → pending_sync → (synced | adopted | failed)
 *
 * INVARIANTS:
 * - Password is NEVER stored here.
 * - Offline shift close is BLOCKED in v1 — user must go online first.
 * - serverShiftId is populated only after a successful server sync.
 */

export const OFFLINE_SHIFT_SCHEMA_VERSION = 1;

export type OfflineShiftStatus = 'pending_sync' | 'synced' | 'adopted' | 'failed';

export interface OfflineShiftMarker {
  /** Client-generated UUID used as local shift identifier and idempotency key */
  localShiftId: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  openedBy: string;       // full_name or username of the staff member
  openingCash: number;
  openedAtLocal: string;  // ISO string calibrated with server clock offset
  deviceId: string;
  status: OfflineShiftStatus;
  /** Populated once synced; server may give back an existing shift (adopted) */
  serverShiftId?: string | null;
  /** iso timestamp when synced to server */
  syncedAt?: string | null;
  schemaVersion: number;
}

function shiftKey(tenantId: string, userId: string): string {
  return `pyntflow_offline_shift:${tenantId}:${userId}`;
}

/**
 * Persist an offline shift marker to localStorage.
 */
export function saveOfflineShift(marker: OfflineShiftMarker): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      shiftKey(marker.tenantId, marker.userId),
      JSON.stringify(marker)
    );
  } catch (err) {
    console.error('[OfflineShiftStore] Failed to save offline shift marker:', err);
  }
}

/**
 * Retrieve the current offline shift marker for a tenant+user pair, or null.
 */
export function getOfflineShift(tenantId: string, userId: string): OfflineShiftMarker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(shiftKey(tenantId, userId));
    if (!raw) return null;
    return JSON.parse(raw) as OfflineShiftMarker;
  } catch {
    return null;
  }
}

/**
 * Mark an existing offline shift as successfully synced to the server.
 * Call this when POST /api/shifts returns 200.
 */
export function markOfflineShiftSynced(
  tenantId: string,
  userId: string,
  serverShiftId: string
): void {
  const existing = getOfflineShift(tenantId, userId);
  if (!existing) return;
  saveOfflineShift({
    ...existing,
    status: 'synced',
    serverShiftId,
    syncedAt: new Date().toISOString(),
  });
}

/**
 * Mark an existing offline shift as adopted (409 → server already has an open shift).
 * The adopted shift's server ID becomes the canonical shift for all queued sales.
 */
export function markOfflineShiftAdopted(
  tenantId: string,
  userId: string,
  existingServerShiftId: string
): void {
  const existing = getOfflineShift(tenantId, userId);
  if (!existing) return;
  saveOfflineShift({
    ...existing,
    status: 'adopted',
    serverShiftId: existingServerShiftId,
    syncedAt: new Date().toISOString(),
  });
}

/**
 * Mark an offline shift as failed (server rejected — non-409 error).
 */
export function markOfflineShiftFailed(tenantId: string, userId: string): void {
  const existing = getOfflineShift(tenantId, userId);
  if (!existing) return;
  saveOfflineShift({ ...existing, status: 'failed' });
}

/**
 * Remove the offline shift marker entirely.
 * Call after all pending sales under this shift are also synced/cleared.
 */
export function clearOfflineShift(tenantId: string, userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(shiftKey(tenantId, userId));
  } catch {
    // ignore
  }
}

