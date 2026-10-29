/**
 * src/lib/localHoldStore.ts
 *
 * Phase 5: Local Hold Fallback
 *
 * When the server is unreachable, a hold order is saved locally in localStorage
 * so the cashier can park a cart and restore it offline. Local holds are synced
 * to the server (held_invoices table) as soon as connectivity returns.
 *
 * Security:
 * - Stored: line items, customer info, amounts, hold metadata.
 * - NEVER stored: passwords, JWT tokens, CEO approval tokens, card data.
 * - Scoped by tenantId:branchId:userId — never visible across tenants/users.
 * - Wiped on logout (call clearAllLocalHolds() from logout handler).
 *
 * Idempotency:
 * - Each local hold has a stable UUID `localHoldId`. When syncing to the server
 *   the same UUID is sent as `local_hold_id`. Server dedupes on it (UNIQUE column).
 *   A re-send after network failure is always safe.
 *
 * Schema versioning:
 * - `schemaVersion: 1` is embedded. On version mismatch the stale hold is
 *   discarded rather than crashing.
 */

import { InvoiceLineItem } from '@/components/PosBilling';

export const LOCAL_HOLD_SCHEMA_VERSION = 1;
export const LOCAL_HOLD_STORAGE_PREFIX = 'pyntflow_local_holds:';

/** Status of a local hold item. */
export type LocalHoldStatus =
  | 'pending'       // Not yet synced to server
  | 'syncing'       // Sync in flight
  | 'synced'        // Server confirmed — safe to remove
  | 'needs_attention'; // Server rejected for a business reason (not network)

export interface LocalHoldItem {
  /** Stable UUID; used as idempotency key when syncing to server. */
  localHoldId: string;
  schemaVersion: number;

  // Scope
  tenantId: string;
  branchId: string;
  userId: string;

  // Hold content
  hold_no: string;
  clientId: string | null;
  clientName: string;
  invoiceType: 'sales' | 'return';
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  netTotal: number;
  remarks: string;

  // Metadata
  createdAt: string;   // ISO 8601 in device local time
  status: LocalHoldStatus;
  syncError?: string;  // Set when status = 'needs_attention'
}

// ─── Storage helpers ───────────────────────────────────────────────────────────

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Builds the localStorage key for the local holds list of a given scope.
 * All holds for one user/branch/tenant are stored under a single key as a JSON array.
 */
export function buildLocalHoldKey(tenantId: string, branchId: string, userId: string): string {
  const safeTenant = (tenantId || 'unknown_tenant').trim();
  const safeBranch = (branchId || safeTenant).trim();
  const safeUser = (userId || 'anonymous').trim();
  return `${LOCAL_HOLD_STORAGE_PREFIX}${safeTenant}:${safeBranch}:${safeUser}`;
}

// ─── CRUD operations ───────────────────────────────────────────────────────────

/**
 * Reads all local holds for the given scope from localStorage.
 * Discards any item with an incompatible schema version.
 * Never throws — returns [] on error.
 */
export function loadLocalHolds(tenantId: string, branchId: string, userId: string): LocalHoldItem[] {
  const storage = getStorage();
  if (!storage || !tenantId || !userId) return [];

  const key = buildLocalHoldKey(tenantId, branchId, userId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: LocalHoldItem[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter to compatible schema and correct scope
    return parsed.filter(
      (h) =>
        h &&
        h.schemaVersion === LOCAL_HOLD_SCHEMA_VERSION &&
        h.tenantId === tenantId &&
        h.userId === userId,
    );
  } catch {
    return [];
  }
}

/**
 * Persists the full list of local holds for a scope to localStorage.
 * Returns true on success, false if storage write failed (quota / security).
 */
function saveLocalHolds(
  tenantId: string,
  branchId: string,
  userId: string,
  holds: LocalHoldItem[],
): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const key = buildLocalHoldKey(tenantId, branchId, userId);
  try {
    storage.setItem(key, JSON.stringify(holds));
    return true;
  } catch (err) {
    console.warn('[LocalHoldStore] Failed to save holds (quota or access error):', err);
    return false;
  }
}

/**
 * Adds a new local hold to localStorage.
 * The hold is saved BEFORE the caller clears the cart; the caller must check
 * the return value and only clear the cart if it returns true.
 *
 * @returns true if saved successfully, false if storage write failed.
 */
export function addLocalHold(hold: LocalHoldItem): boolean {
  const existing = loadLocalHolds(hold.tenantId, hold.branchId, hold.userId);
  // Deduplicate by localHoldId (idempotent)
  const filtered = existing.filter((h) => h.localHoldId !== hold.localHoldId);
  return saveLocalHolds(hold.tenantId, hold.branchId, hold.userId, [hold, ...filtered]);
}

/**
 * Updates the status (and optional error) of an existing local hold.
 * Used by the sync engine when a hold transitions states.
 */
export function updateLocalHoldStatus(
  tenantId: string,
  branchId: string,
  userId: string,
  localHoldId: string,
  status: LocalHoldStatus,
  syncError?: string,
): boolean {
  const holds = loadLocalHolds(tenantId, branchId, userId);
  const updated = holds.map((h) =>
    h.localHoldId === localHoldId ? { ...h, status, syncError: syncError ?? h.syncError } : h,
  );
  return saveLocalHolds(tenantId, branchId, userId, updated);
}

/**
 * Removes a local hold by its localHoldId.
 * Call ONLY after the server has confirmed success (status = 'synced').
 * Never call before server confirmation — see Ground Rule 5.
 */
export function removeLocalHold(
  tenantId: string,
  branchId: string,
  userId: string,
  localHoldId: string,
): boolean {
  const holds = loadLocalHolds(tenantId, branchId, userId);
  const filtered = holds.filter((h) => h.localHoldId !== localHoldId);
  return saveLocalHolds(tenantId, branchId, userId, filtered);
}

/**
 * Clears all local holds for the given scope.
 * Called when the user logs out (shared terminal cleanup).
 */
export function clearScopedLocalHolds(
  tenantId: string,
  branchId: string,
  userId: string,
): void {
  const storage = getStorage();
  if (!storage) return;
  const key = buildLocalHoldKey(tenantId, branchId, userId);
  try {
    storage.removeItem(key);
  } catch (err) {
    console.warn('[LocalHoldStore] Failed to clear scoped local holds:', err);
  }
}

/**
 * Clears ALL local holds for all tenants/users stored in localStorage.
 * Called on logout to ensure clean state on shared POS terminals.
 */
export function clearAllLocalHolds(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(LOCAL_HOLD_STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch (err) {
    console.warn('[LocalHoldStore] Failed to clear all local holds:', err);
  }
}

/**
 * Generates a display-friendly hold number for local (offline) holds.
 * Format: "HOLD-OFF-XXXX" so cashier can visually distinguish offline holds.
 */
export function generateOfflineHoldNo(): string {
  return `HOLD-OFF-${Date.now().toString().slice(-4)}`;
}

/**
 * Returns all pending local holds (status = 'pending') across a scope.
 * Used by the sync engine to find items that need to be pushed to the server.
 */
export function getPendingLocalHolds(
  tenantId: string,
  branchId: string,
  userId: string,
): LocalHoldItem[] {
  return loadLocalHolds(tenantId, branchId, userId).filter(
    (h) => h.status === 'pending',
  );
}

