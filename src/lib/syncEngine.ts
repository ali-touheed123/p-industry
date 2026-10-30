/**
 * src/lib/syncEngine.ts
 *
 * Phase 6: Automatic Sync Engine with Multi-Tab Lock & FIFO Processing
 *
 * Guarantees:
 * - Multi-tab mutual exclusion: Web Locks API (`navigator.locks.request`)
 *   prevents duplicate concurrent syncs from multiple open browser tabs.
 * - Strict FIFO: Items are processed sequentially in ascending order of `createdAtLocal`.
 * - Poison item containment: A business rule rejection (4xx) moves the item
 *   to `needs_attention` without blocking subsequent valid sales.
 * - Shift wait: If server returns `WAITING_FOR_OPEN_SHIFT` (422), item remains pending
 *   and sync pauses until a shift is opened.
 * - Network backoff: Exponential backoff with random jitter on network/5xx failures.
 * - Resumable after crash: Idempotency keys make repeated attempts strictly safe.
 */

import { fetchWithTimeout, isNetworkOrTimeoutError } from './fetchWithTimeout';
import {
  OutboxItem,
  getOutboxItems,
  updateOutboxItem,
  removeOutboxItem,
  getOutboxSummary,
} from './offlineQueueStore';

type SyncListener = () => void;
const listeners: Set<SyncListener> = new Set();

export function subscribeToSyncUpdates(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySyncUpdates(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error('[SyncEngine] Listener notification error:', e);
    }
  }
}

let isSyncing = false;
let syncIntervalTimer: any = null;

/**
 * Calculate backoff delay in milliseconds based on attempt count.
 * Backoff steps: ~5s, ~15s, ~60s, ~5m, ~15m with +/- 20% jitter.
 */
function calculateBackoffMs(attempts: number): number {
  const steps = [5000, 15000, 60000, 300000, 900000];
  const base = steps[Math.min(attempts, steps.length - 1)];
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(2000, Math.round(base + jitter));
}

/**
 * Execute the sync loop under a Web Lock to avoid multi-tab collisions.
 */
export async function syncOfflineQueue(tenantId: string): Promise<{
  synced: number;
  failed: number;
  needsAttention: number;
  waitingForShift: boolean;
}> {
  if (!tenantId || typeof window === 'undefined') {
    return { synced: 0, failed: 0, needsAttention: 0, waitingForShift: false };
  }

  // Use Web Locks API if available
  if (navigator?.locks?.request) {
    return navigator.locks.request(
      `pyntflow_sync_lock_${tenantId}`,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          // Another tab is actively syncing
          return { synced: 0, failed: 0, needsAttention: 0, waitingForShift: false };
        }
        return processQueueInternal(tenantId);
      }
    );
  }

  // Fallback for browsers without Web Locks
  if (isSyncing) {
    return { synced: 0, failed: 0, needsAttention: 0, waitingForShift: false };
  }
  isSyncing = true;
  try {
    return await processQueueInternal(tenantId);
  } finally {
    isSyncing = false;
  }
}

/**
 * Internal FIFO worker processing pending outbox items.
 */
async function processQueueInternal(tenantId: string): Promise<{
  synced: number;
  failed: number;
  needsAttention: number;
  waitingForShift: boolean;
}> {
  let synced = 0;
  let failed = 0;
  let needsAttention = 0;
  let waitingForShift = false;

  const items = await getOutboxItems(tenantId);
  const now = Date.now();

  // Filter items eligible for processing:
  // - status === 'pending'
  // - or status === 'syncing' that was abandoned (> 2 minutes ago)
  // - nextRetryAt is null or in the past
  const eligibleItems = items.filter((item) => {
    if (item.status === 'needs_attention') return false;
    if (item.status === 'synced') return false;

    if (item.status === 'syncing') {
      const lastAttempt = item.lastError?.at ? Date.parse(item.lastError.at) : 0;
      if (now - lastAttempt < 120000) {
        return false; // Still within reasonable lock window
      }
    }

    if (item.nextRetryAt && Date.parse(item.nextRetryAt) > now) {
      return false; // Backoff cooldown active
    }

    return true;
  });

  if (eligibleItems.length === 0) {
    notifySyncUpdates();
    return { synced, failed, needsAttention, waitingForShift };
  }

  notifySyncUpdates();

  for (const item of eligibleItems) {
    // Check if network is reported offline before each item
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      break;
    }

    await updateOutboxItem(item.id, { status: 'syncing' });
    notifySyncUpdates();

    try {
      const endpoint = item.type === 'special_sale' ? '/api/invoices/special' : '/api/invoices';

      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
        timeoutMs: 25000,
      });

      let resData: any = {};
      try {
        resData = await res.json();
      } catch {
        resData = { error: 'Invalid response from server' };
      }

      // ── 1. SUCCESS OR IDEMPOTENT DUPLICATE ──────────────────────────────────
      if (res.ok && resData.success) {
        const finalInvoiceNo =
          resData.invoice?.invoice_no ||
          resData.invoice_no ||
          resData.snapshot?.invoice_no ||
          item.localReceiptNo;

        await updateOutboxItem(item.id, {
          status: 'synced',
          syncedInvoiceNo: finalInvoiceNo,
          syncedAt: new Date().toISOString(),
          lastError: null,
        });

        // Safe removal from outbox
        await removeOutboxItem(item.id);
        synced++;
        notifySyncUpdates();
        continue;
      }

      // ── 2. AUTHENTICATION REQUIRED (401) ────────────────────────────────────
      if (res.status === 401) {
        await updateOutboxItem(item.id, {
          status: 'pending',
          lastError: {
            code: 'AUTH_REQUIRED',
            message: 'Session expired. Please log in again to sync queued sales.',
            at: new Date().toISOString(),
          },
        });
        failed++;
        notifySyncUpdates();
        break; // Stop engine until user logs in
      }

      // ── 3. WAITING FOR OPEN SHIFT (422) ─────────────────────────────────────
      if (res.status === 422 && resData.waiting_for_shift) {
        waitingForShift = true;
        await updateOutboxItem(item.id, {
          status: 'pending',
          lastError: {
            code: 'WAITING_FOR_OPEN_SHIFT',
            message: 'Cannot sync sale: No register shift is currently open. Sale will sync once a shift is opened.',
            at: new Date().toISOString(),
          },
          nextRetryAt: new Date(Date.now() + 30000).toISOString(), // check again in 30s
        });
        notifySyncUpdates();
        break; // Wait for cashier to open shift
      }

      // ── 4. PERMANENT / BUSINESS RULE REJECTION (4xx) ─────────────────────────
      // Poison item rule: move item to needs_attention and continue syncing next items
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        await updateOutboxItem(item.id, {
          status: 'needs_attention',
          lastError: {
            code: resData.code || `HTTP_${res.status}`,
            message: resData.error || 'Server validation rejected offline sale.',
            at: new Date().toISOString(),
          },
        });
        needsAttention++;
        notifySyncUpdates();
        continue;
      }

      // ── 5. TRANSIENT / SERVER ERROR (5xx, 429) ──────────────────────────────
      const nextAttempts = (item.attempts || 0) + 1;
      const delayMs = calculateBackoffMs(nextAttempts);
      await updateOutboxItem(item.id, {
        status: 'pending',
        attempts: nextAttempts,
        nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
        lastError: {
          code: `HTTP_${res.status}`,
          message: resData.error || `Server responded with status ${res.status}. Retrying in ${Math.round(delayMs / 1000)}s.`,
          at: new Date().toISOString(),
        },
      });
      failed++;
      notifySyncUpdates();
      break; // Stop current batch on 5xx to avoid pounding server

    } catch (err: any) {
      // ── 6. NETWORK ERROR OR TIMEOUT ─────────────────────────────────────────
      const nextAttempts = (item.attempts || 0) + 1;
      const delayMs = calculateBackoffMs(nextAttempts);

      await updateOutboxItem(item.id, {
        status: 'pending',
        attempts: nextAttempts,
        nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
        lastError: {
          code: isNetworkOrTimeoutError(err) ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR',
          message: err.message || 'Network connection failed. Retrying automatically.',
          at: new Date().toISOString(),
        },
      });
      failed++;
      notifySyncUpdates();
      break; // Network is down; stop iterating this batch
    }
  }

  notifySyncUpdates();
  return { synced, failed, needsAttention, waitingForShift };
}

/**
 * Initialize automatic sync listeners (online events, tab visibility, periodic polling).
 * Call once when the application starts or POS mounts.
 */
export function initSyncEngine(tenantId: string): () => void {
  if (typeof window === 'undefined' || !tenantId) {
    return () => {};
  }

  const handleOnline = () => {
    syncOfflineQueue(tenantId);
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      syncOfflineQueue(tenantId);
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  // Periodic poll every 30 seconds
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);
  syncIntervalTimer = setInterval(() => {
    getOutboxSummary(tenantId).then((summary) => {
      if (summary.pendingCount > 0) {
        syncOfflineQueue(tenantId);
      }
    });
  }, 30000);

  // Trigger immediate sync on init
  syncOfflineQueue(tenantId);

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (syncIntervalTimer) {
      clearInterval(syncIntervalTimer);
      syncIntervalTimer = null;
    }
  };
}
