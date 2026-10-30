/**
 * src/lib/offlineQueueStore.ts
 *
 * Phase 6: IndexedDB Offline Queue & Device Meta Store
 *
 * Storage architecture:
 * - Database: `pyntflow-offline` (version 1)
 * - Object stores:
 *   1. `outbox` (keyPath: 'id'): queued sales, special sales, and payments.
 *      Indexes: 'tenantId', 'status', 'createdAtLocal'
 *   2. `meta` (keyPath: 'key'): device metadata, persistent sequence counter,
 *      server clock offset, and schema version.
 *
 * Guarantees:
 * - Stable deviceId: random UUID generated once per browser profile.
 * - Device short code: 4-character uppercase alphanumeric identifier (e.g. "K7F2").
 * - Local receipt number: `<shortCode>-<4-digit seq>` (e.g. "K7F2-0042").
 * - Atomic queue write: outbox entry write + sequence counter increment occur in
 *   a single IndexedDB transaction. Cart is only cleared if this succeeds.
 * - Clock skew calibration: adjusted with server clock offset from /api/health.
 */

export const OFFLINE_DB_NAME = 'pyntflow-offline';
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_SCHEMA_VERSION = 1;

export type OutboxItemType = 'sale' | 'special_sale';
export type OutboxItemStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'needs_attention';

export interface OutboxItem {
  id: string; // Idempotency key (UUID)
  type: OutboxItemType;
  tenantId: string;
  branchId?: string | null;
  userId?: string | null;
  deviceId: string;
  localReceiptNo: string;
  createdAtLocal: string; // ISO string calibrated with server clock
  schemaVersion: number;
  payload: any; // Raw payload expected by POST /api/invoices or /api/invoices/special
  rateSnapshot?: Record<string, number>;
  status: OutboxItemStatus;
  attempts: number;
  nextRetryAt?: string | null;
  lastError?: {
    code?: string;
    message: string;
    at: string;
  } | null;
  syncedInvoiceNo?: string | null;
  syncedAt?: string | null;
}

export interface DeviceMeta {
  deviceId: string;
  deviceShortCode: string;
  receiptSeq: number;
  schemaVersion: number;
  clockOffsetMs: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Open or upgrade the pyntflow-offline IndexedDB database.
 */
export function openOfflineDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Outbox Store
      if (!db.objectStoreNames.contains('outbox')) {
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
        outboxStore.createIndex('tenantId', 'tenantId', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
        outboxStore.createIndex('createdAtLocal', 'createdAtLocal', { unique: false });
      }

      // 2. Meta Store
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      // Request persistent storage if available
      tryRequestStoragePersistence();
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB database.'));
    };
  });

  return dbPromise;
}

/**
 * Request persistent browser storage to minimize eviction risk.
 */
async function tryRequestStoragePersistence(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        await navigator.storage.persist();
      }
    }
  } catch (err) {
    console.warn('[OfflineStore] Storage persistence request non-fatal error:', err);
  }
}

/**
 * Generate 4-character uppercase alphanumeric shortcode from UUID.
 */
function deriveShortCode(uuid: string): string {
  const clean = uuid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.slice(0, 4) || 'DEV1';
}

/**
 * Generate UUID safely across browsers.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or initialize device metadata (deviceId, deviceShortCode, sequence counter).
 */
export async function getDeviceMeta(): Promise<DeviceMeta> {
  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    const req = store.get('device_meta');

    req.onsuccess = () => {
      let meta: DeviceMeta | undefined = req.result?.value;
      if (!meta) {
        const deviceId = generateUUID();
        const deviceShortCode = deriveShortCode(deviceId);
        meta = {
          deviceId,
          deviceShortCode,
          receiptSeq: 0,
          schemaVersion: OFFLINE_SCHEMA_VERSION,
          clockOffsetMs: 0,
        };
        store.put({ key: 'device_meta', value: meta });
      }
      resolve(meta);
    };

    req.onerror = () => reject(req.error || new Error('Failed to read device meta.'));
  });
}

/**
 * Save calibrated server clock offset in metadata.
 */
export async function setServerClockOffset(offsetMs: number): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    const req = store.get('device_meta');

    req.onsuccess = () => {
      const meta: DeviceMeta = req.result?.value || {
        deviceId: generateUUID(),
        deviceShortCode: 'DEV1',
        receiptSeq: 0,
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        clockOffsetMs: 0,
      };
      meta.clockOffsetMs = offsetMs;
      store.put({ key: 'device_meta', value: meta });
      resolve();
    };

    req.onerror = () => reject(req.error || new Error('Failed to set clock offset.'));
  });
}

export interface EnqueueSaleOptions {
  type: OutboxItemType;
  tenantId: string;
  branchId?: string | null;
  userId?: string | null;
  payload: any;
  rateSnapshot?: Record<string, number>;
}

/**
 * Atomically assign next sequence number and write sale to outbox.
 * Sequence counter and outbox write occur in the SAME transaction.
 */
export async function enqueueOfflineSale(options: EnqueueSaleOptions): Promise<{
  outboxItem: OutboxItem;
  localReceiptNo: string;
}> {
  const db = await openOfflineDB();
  const id = options.payload.idempotency_key || generateUUID();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['outbox', 'meta'], 'readwrite');
    const outboxStore = tx.objectStore('outbox');
    const metaStore = tx.objectStore('meta');

    const metaReq = metaStore.get('device_meta');

    metaReq.onsuccess = () => {
      let meta: DeviceMeta = metaReq.result?.value;
      if (!meta) {
        const deviceId = generateUUID();
        meta = {
          deviceId,
          deviceShortCode: deriveShortCode(deviceId),
          receiptSeq: 0,
          schemaVersion: OFFLINE_SCHEMA_VERSION,
          clockOffsetMs: 0,
        };
      }

      // Increment sequence atomically
      meta.receiptSeq = (meta.receiptSeq || 0) + 1;
      metaStore.put({ key: 'device_meta', value: meta });

      const seqStr = String(meta.receiptSeq).padStart(4, '0');
      const localReceiptNo = `${meta.deviceShortCode}-${seqStr}`;

      // Calibrate local creation time with server offset
      const nowCalibrated = new Date(Date.now() + (meta.clockOffsetMs || 0)).toISOString();

      // Enrich payload with offline attributes
      const enrichedPayload = {
        ...options.payload,
        idempotency_key: id,
        is_offline: true,
        created_at_local: nowCalibrated,
        device_id: meta.deviceId,
        local_receipt_no: localReceiptNo,
        offline_schema_version: OFFLINE_SCHEMA_VERSION,
      };

      const item: OutboxItem = {
        id,
        type: options.type,
        tenantId: options.tenantId,
        branchId: options.branchId || null,
        userId: options.userId || null,
        deviceId: meta.deviceId,
        localReceiptNo,
        createdAtLocal: nowCalibrated,
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        payload: enrichedPayload,
        rateSnapshot: options.rateSnapshot,
        status: 'pending',
        attempts: 0,
        nextRetryAt: null,
        lastError: null,
      };

      outboxStore.put(item);

      tx.oncomplete = () => {
        resolve({ outboxItem: item, localReceiptNo });
      };

      tx.onerror = () => {
        reject(tx.error || new Error('Transaction failed while enqueueing offline sale.'));
      };
    };

    metaReq.onerror = () => {
      reject(metaReq.error || new Error('Failed to read device meta during enqueue.'));
    };
  });
}

/**
 * Fetch all items from outbox for a specific tenant.
 */
export async function getOutboxItems(tenantId: string): Promise<OutboxItem[]> {
  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const index = store.index('tenantId');
    const req = index.getAll(tenantId);

    req.onsuccess = () => {
      const items: OutboxItem[] = req.result || [];
      // Sort FIFO by createdAtLocal
      items.sort((a, b) => Date.parse(a.createdAtLocal) - Date.parse(b.createdAtLocal));
      resolve(items);
    };

    req.onerror = () => reject(req.error || new Error('Failed to fetch outbox items.'));
  });
}

/**
 * Fetch count of pending and needs_attention items for UI badge.
 */
export async function getOutboxSummary(tenantId: string): Promise<{
  pendingCount: number;
  syncingCount: number;
  needsAttentionCount: number;
  totalUnsynced: number;
}> {
  const items = await getOutboxItems(tenantId);
  let pendingCount = 0;
  let syncingCount = 0;
  let needsAttentionCount = 0;

  for (const it of items) {
    if (it.status === 'pending') pendingCount++;
    else if (it.status === 'syncing') syncingCount++;
    else if (it.status === 'needs_attention') needsAttentionCount++;
  }

  return {
    pendingCount,
    syncingCount,
    needsAttentionCount,
    totalUnsynced: pendingCount + syncingCount + needsAttentionCount,
  };
}

/**
 * Update the status, attempts, error, or synced invoice number of an item.
 */
export async function updateOutboxItem(
  id: string,
  updates: Partial<OutboxItem>
): Promise<void> {
  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const req = store.get(id);

    req.onsuccess = () => {
      const existing: OutboxItem = req.result;
      if (!existing) {
        resolve();
        return;
      }
      const updated = { ...existing, ...updates };
      store.put(updated);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to update outbox item.'));
  });
}

/**
 * Remove an item from the outbox (typically after confirmation of sync).
 */
export async function removeOutboxItem(id: string): Promise<void> {
  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete outbox item.'));
  });
}

/**
 * Local stock deduction overlay to prevent overselling on the current terminal while offline.
 */
const STOCK_OVERLAY_PREFIX = 'pyntflow_offline_stock_deductions:';

export function getOfflineStockOverlay(tenantId: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${STOCK_OVERLAY_PREFIX}${tenantId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function deductOfflineStock(tenantId: string, items: Array<{ item_id?: string | null; qty: number }>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getOfflineStockOverlay(tenantId);
    for (const it of items) {
      if (it.item_id) {
        current[it.item_id] = (current[it.item_id] || 0) + Number(it.qty || 0);
      }
    }
    window.localStorage.setItem(`${STOCK_OVERLAY_PREFIX}${tenantId}`, JSON.stringify(current));
  } catch (err) {
    console.warn('[OfflineStore] Failed to update local stock overlay:', err);
  }
}

export function clearOfflineStockOverlay(tenantId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${STOCK_OVERLAY_PREFIX}${tenantId}`);
  } catch {
    // ignore
  }
}
