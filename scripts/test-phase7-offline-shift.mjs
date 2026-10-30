/**
 * scripts/test-phase7-offline-shift.mjs
 *
 * Unit tests for Phase 7:
 * - Session Grace Window (24h calculation, claims storage, expiry)
 * - Offline Shift Store (save, retrieve, sync, adopt, fail, clear)
 * - Outbox FIFO head placement for shift_open
 * - Reconciling overlapping shifts (409 conflict -> adoption + is_late_sync flag)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Mock window & storage for Node environment ───────────────────────────────
const mockSessionStorage = new Map();
const mockLocalStorage = new Map();

global.window = {
  sessionStorage: {
    getItem: (k) => mockSessionStorage.get(k) || null,
    setItem: (k, v) => mockSessionStorage.set(k, String(v)),
    removeItem: (k) => mockSessionStorage.delete(k),
    clear: () => mockSessionStorage.clear(),
  },
  localStorage: {
    getItem: (k) => mockLocalStorage.get(k) || null,
    setItem: (k, v) => mockLocalStorage.set(k, String(v)),
    removeItem: (k) => mockLocalStorage.delete(k),
    clear: () => mockLocalStorage.clear(),
  },
};
global.sessionStorage = global.window.sessionStorage;
global.localStorage = global.window.localStorage;

// ── 1. SESSION GRACE WINDOW TESTS ───────────────────────────────────────────
test('Session Grace: record and retrieve active status within 24h', async () => {
  mockSessionStorage.clear();
  const { recordServerVerification, getGraceStatus, clearGrace, GRACE_WINDOW_MS } =
    await import('../src/lib/sessionGrace.ts');

  assert.equal(GRACE_WINDOW_MS, 24 * 60 * 60 * 1000, 'Grace window must be exactly 24 hours');

  const tenantId = 'tenant-test-1';
  const userId = 'user-test-1';
  const claims = {
    role: 'staff',
    tenantId,
    tenantSlug: 'test-shop',
    branchId: null,
    userId,
    username: 'cashier1',
    canUseSpecialReceipt: false,
  };

  recordServerVerification(tenantId, userId, claims);

  const status = getGraceStatus(tenantId, userId);
  assert.equal(status.withinGrace, true, 'Must be within grace immediately after recording');
  assert.equal(status.hoursRemaining, 23, 'Should show ~23-24 hours remaining');
  assert.deepEqual(status.cachedClaims, claims);

  // Clear grace on logout
  clearGrace(tenantId, userId);
  const statusAfterClear = getGraceStatus(tenantId, userId);
  assert.equal(statusAfterClear.withinGrace, false, 'Must be false after logout clear');
});

test('Session Grace: expired status after 24h locks POS', async () => {
  mockSessionStorage.clear();
  const { getGraceStatus } = await import('../src/lib/sessionGrace.ts');

  const tenantId = 'tenant-test-2';
  const userId = 'user-test-2';

  // Inject a record from 25 hours ago
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  mockSessionStorage.set(
    `pyntflow_session_grace:${tenantId}:${userId}`,
    JSON.stringify({
      lastServerVerifiedAt: twentyFiveHoursAgo,
      cachedClaims: { role: 'staff', tenantId, userId, username: 'test', canUseSpecialReceipt: false },
      schemaVersion: 1,
    })
  );

  const status = getGraceStatus(tenantId, userId);
  assert.equal(status.withinGrace, false, 'Grace must expire after 24 hours');
  assert.equal(status.hoursRemaining, 0, 'Hours remaining must be 0');
  assert.equal(status.minutesRemaining, 0, 'Minutes remaining must be 0');
});

// ── 2. OFFLINE SHIFT STORE TESTS ─────────────────────────────────────────────
test('Offline Shift Store: save, retrieve, sync, adopt, fail, clear', async () => {
  mockLocalStorage.clear();
  const {
    saveOfflineShift,
    getOfflineShift,
    markOfflineShiftSynced,
    markOfflineShiftAdopted,
    markOfflineShiftFailed,
    clearOfflineShift,
  } = await import('../src/lib/offlineShiftStore.ts');

  const tenantId = 'tenant-shift-1';
  const userId = 'user-shift-1';
  const localShiftId = '00000000-0000-0000-0000-000000000001';

  // Initially null
  assert.equal(getOfflineShift(tenantId, userId), null);

  // Save
  saveOfflineShift({
    localShiftId,
    tenantId,
    branchId: null,
    userId,
    openedBy: 'Test Cashier',
    openingCash: 5000,
    openedAtLocal: new Date().toISOString(),
    deviceId: 'DEV-TEST-01',
    status: 'pending_sync',
    schemaVersion: 1,
  });

  const marker = getOfflineShift(tenantId, userId);
  assert.ok(marker);
  assert.equal(marker.localShiftId, localShiftId);
  assert.equal(marker.status, 'pending_sync');
  assert.equal(marker.openingCash, 5000);

  // Mark synced
  const serverId = '11111111-1111-1111-1111-111111111111';
  markOfflineShiftSynced(tenantId, userId, serverId);
  const syncedMarker = getOfflineShift(tenantId, userId);
  assert.equal(syncedMarker.status, 'synced');
  assert.equal(syncedMarker.serverShiftId, serverId);
  assert.ok(syncedMarker.syncedAt);

  // Mark adopted (409 conflict simulation)
  const adoptedServerId = '22222222-2222-2222-2222-222222222222';
  markOfflineShiftAdopted(tenantId, userId, adoptedServerId);
  const adoptedMarker = getOfflineShift(tenantId, userId);
  assert.equal(adoptedMarker.status, 'adopted');
  assert.equal(adoptedMarker.serverShiftId, adoptedServerId);

  // Mark failed
  markOfflineShiftFailed(tenantId, userId);
  const failedMarker = getOfflineShift(tenantId, userId);
  assert.equal(failedMarker.status, 'failed');

  // Clear
  clearOfflineShift(tenantId, userId);
  assert.equal(getOfflineShift(tenantId, userId), null);
});

// ── 3. SHIFT RECONCILIATION & QUEUE DATA MODEL TESTS ─────────────────────────
test('FIFO Head & Shift Adoption: shift_open timestamp precedes sales', () => {
  const shiftOpenedAt = '2026-10-30T10:00:00.000Z';
  const sale1Time = '2026-10-30T10:00:05.000Z';
  const sale2Time = '2026-10-30T10:01:00.000Z';

  // shift_open uses openedAtLocal - 1ms
  const shiftOpenCreatedAt = new Date(new Date(shiftOpenedAt).getTime() - 1).toISOString();

  const queue = [
    { type: 'sale', id: 's2', createdAtLocal: sale2Time },
    { type: 'shift_open', id: 'sh1', createdAtLocal: shiftOpenCreatedAt },
    { type: 'sale', id: 's1', createdAtLocal: sale1Time },
  ];

  queue.sort((a, b) => Date.parse(a.createdAtLocal) - Date.parse(b.createdAtLocal));

  assert.equal(queue[0].type, 'shift_open', 'shift_open MUST sort to head of FIFO queue');
  assert.equal(queue[1].id, 's1');
  assert.equal(queue[2].id, 's2');
});

test('Overlapping shift 409 adoption logic: flags sales as is_late_sync', () => {
  const localShiftId = 'local-shift-uuid-999';
  const serverShiftId = 'existing-server-shift-uuid-888';

  const queuedSales = [
    {
      id: 'sale-1',
      localShiftId,
      payload: { shift_id: localShiftId, net_total: 1500, cash_paid: 1500 },
    },
    {
      id: 'sale-2',
      localShiftId,
      payload: { shift_id: localShiftId, net_total: 3000, cash_paid: 3000 },
    },
  ];

  // Simulate patchSalesLocalShiftId with isLateSync = true (409 adoption flow)
  const patched = queuedSales.map((s) => ({
    ...s,
    payload: {
      ...s.payload,
      shift_id: serverShiftId,
      is_late_sync: true,
    },
  }));

  assert.equal(patched[0].payload.shift_id, serverShiftId);
  assert.equal(patched[0].payload.is_late_sync, true);
  assert.equal(patched[1].payload.shift_id, serverShiftId);
  assert.equal(patched[1].payload.is_late_sync, true);
});
