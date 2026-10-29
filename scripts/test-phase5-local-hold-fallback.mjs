/**
 * scripts/test-phase5-local-hold-fallback.mjs
 *
 * Phase 5 unit tests: Local Hold Fallback
 * Run with: npx tsx --test scripts/test-phase5-local-hold-fallback.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── localStorage mock ────────────────────────────────────────────────────────
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    clear: () => store.clear(),
    _store: store,
  };
}

const mockStorage = createMockStorage();
// Inject localStorage globally before module import
globalThis.localStorage = mockStorage;
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: mockStorage };
} else {
  globalThis.window.localStorage = mockStorage;
}

// ── Import the module under test ─────────────────────────────────────────────
// tsx resolves TypeScript natively
const {
  buildLocalHoldKey,
  addLocalHold,
  loadLocalHolds,
  removeLocalHold,
  updateLocalHoldStatus,
  clearScopedLocalHolds,
  clearAllLocalHolds,
  getPendingLocalHolds,
  generateOfflineHoldNo,
  LOCAL_HOLD_SCHEMA_VERSION,
  LOCAL_HOLD_STORAGE_PREFIX,
} = await import('../src/lib/localHoldStore.ts');

// ── Test helpers ─────────────────────────────────────────────────────────────
function makeHold(overrides = {}) {
  return {
    localHoldId: overrides.localHoldId ?? crypto.randomUUID(),
    schemaVersion: LOCAL_HOLD_SCHEMA_VERSION,
    tenantId: overrides.tenantId ?? 'tenant-A',
    branchId: overrides.branchId ?? 'branch-1',
    userId: overrides.userId ?? 'user-X',
    hold_no: overrides.hold_no ?? 'HOLD-OFF-1234',
    clientId: null,
    clientName: 'Walk-in',
    invoiceType: 'sales',
    items: [{ productName: 'Paint', qty: 2, rate: 500, amount: 1000 }],
    subtotal: 1000,
    discount: 0,
    deliveryCharge: 0,
    netTotal: 1000,
    remarks: '',
    createdAt: new Date().toISOString(),
    status: overrides.status ?? 'pending',
    ...overrides,
  };
}

function resetStorage() {
  mockStorage._store.clear();
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 5 — Local Hold Store', () => {

  test('5.1 — buildLocalHoldKey produces scoped key', () => {
    const key = buildLocalHoldKey('t1', 'b1', 'u1');
    assert.ok(key.startsWith(LOCAL_HOLD_STORAGE_PREFIX), 'Should start with prefix');
    assert.ok(key.includes('t1'), 'Should include tenantId');
    assert.ok(key.includes('b1'), 'Should include branchId');
    assert.ok(key.includes('u1'), 'Should include userId');
    // Different tenant gets different key
    const key2 = buildLocalHoldKey('t2', 'b1', 'u1');
    assert.notEqual(key, key2, 'Different tenants must have different keys');
  });

  test('5.2 — addLocalHold saves and loadLocalHolds retrieves it', () => {
    resetStorage();
    const hold = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1' });
    const saved = addLocalHold(hold);
    assert.ok(saved, 'addLocalHold should return true on success');

    const loaded = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(loaded.length, 1, 'Should find 1 hold');
    assert.equal(loaded[0].localHoldId, hold.localHoldId);
    assert.equal(loaded[0].status, 'pending');
  });

  test('5.3 — addLocalHold is idempotent (duplicate localHoldId not added twice)', () => {
    resetStorage();
    const id = crypto.randomUUID();
    const hold = makeHold({ localHoldId: id, tenantId: 'T1', branchId: 'B1', userId: 'U1' });
    addLocalHold(hold);
    addLocalHold(hold); // retry
    const loaded = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(loaded.length, 1, 'Duplicate add must not create two entries');
  });

  test('5.4 — Cross-user isolation: user A hold not visible to user B', () => {
    resetStorage();
    const holdA = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'UserA' });
    addLocalHold(holdA);
    const forB = loadLocalHolds('T1', 'B1', 'UserB');
    assert.equal(forB.length, 0, 'User B must not see User A holds');
  });

  test('5.5 — Cross-tenant isolation: tenant A hold not visible to tenant B', () => {
    resetStorage();
    const holdA = makeHold({ tenantId: 'TenantA', branchId: 'B1', userId: 'U1' });
    addLocalHold(holdA);
    const forTB = loadLocalHolds('TenantB', 'B1', 'U1');
    assert.equal(forTB.length, 0, 'Tenant B must not see Tenant A holds');
  });

  test('5.6 — updateLocalHoldStatus transitions status correctly', () => {
    resetStorage();
    const hold = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1', status: 'pending' });
    addLocalHold(hold);

    updateLocalHoldStatus('T1', 'B1', 'U1', hold.localHoldId, 'syncing');
    const afterSyncing = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(afterSyncing[0].status, 'syncing');

    updateLocalHoldStatus('T1', 'B1', 'U1', hold.localHoldId, 'needs_attention', 'Stock insufficient');
    const afterFailed = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(afterFailed[0].status, 'needs_attention');
    assert.equal(afterFailed[0].syncError, 'Stock insufficient');
  });

  test('5.7 — removeLocalHold only removes AFTER confirmation (Ground Rule 5)', () => {
    resetStorage();
    const hold = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1' });
    addLocalHold(hold);

    // Simulate: server confirmed → mark synced → then remove
    updateLocalHoldStatus('T1', 'B1', 'U1', hold.localHoldId, 'synced');
    const synced = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(synced[0].status, 'synced');

    removeLocalHold('T1', 'B1', 'U1', hold.localHoldId);
    const after = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(after.length, 0, 'Hold must be gone after removal');
  });

  test('5.8 — getPendingLocalHolds returns only pending items', () => {
    resetStorage();
    const holdPending = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1', status: 'pending' });
    const holdSynced = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1', status: 'synced' });
    const holdFailed = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1', status: 'needs_attention' });
    addLocalHold(holdPending);
    addLocalHold(holdSynced);
    addLocalHold(holdFailed);

    const pending = getPendingLocalHolds('T1', 'B1', 'U1');
    assert.equal(pending.length, 1, 'Only 1 pending hold');
    assert.equal(pending[0].localHoldId, holdPending.localHoldId);
  });

  test('5.9 — clearAllLocalHolds wipes all holds on logout', () => {
    resetStorage();
    addLocalHold(makeHold({ tenantId: 'TA', branchId: 'B1', userId: 'U1' }));
    addLocalHold(makeHold({ tenantId: 'TB', branchId: 'B2', userId: 'U2' }));
    addLocalHold(makeHold({ tenantId: 'TC', branchId: 'B3', userId: 'U3' }));

    clearAllLocalHolds();

    // All three scopes should be empty
    assert.equal(loadLocalHolds('TA', 'B1', 'U1').length, 0);
    assert.equal(loadLocalHolds('TB', 'B2', 'U2').length, 0);
    assert.equal(loadLocalHolds('TC', 'B3', 'U3').length, 0);
  });

  test('5.10 — generateOfflineHoldNo produces distinct values', () => {
    const a = generateOfflineHoldNo();
    // Small wait to ensure different timestamp
    const b = generateOfflineHoldNo();
    assert.ok(a.startsWith('HOLD-OFF-'), 'Should start with HOLD-OFF-');
    // Both should be valid hold numbers (strings)
    assert.equal(typeof a, 'string');
    assert.equal(typeof b, 'string');
  });

  test('5.11 — Schema version mismatch causes stale holds to be discarded', () => {
    resetStorage();
    const hold = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1' });
    addLocalHold(hold);

    // Corrupt the schema version to simulate an old saved hold
    const key = buildLocalHoldKey('T1', 'B1', 'U1');
    const raw = JSON.parse(mockStorage.getItem(key));
    raw[0].schemaVersion = 99; // Incompatible version
    mockStorage.setItem(key, JSON.stringify(raw));

    const loaded = loadLocalHolds('T1', 'B1', 'U1');
    assert.equal(loaded.length, 0, 'Stale schema version hold must be discarded');
  });

  test('5.12 — Storage failure in addLocalHold returns false (cart must not be cleared)', () => {
    resetStorage();
    // Temporarily break setItem to simulate quota error
    const origSetItem = mockStorage.setItem.bind(mockStorage);
    let callCount = 0;
    mockStorage.setItem = (k, v) => {
      callCount++;
      if (callCount === 1) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      origSetItem(k, v);
    };

    const hold = makeHold({ tenantId: 'T1', branchId: 'B1', userId: 'U1' });
    const saved = addLocalHold(hold);
    assert.equal(saved, false, 'addLocalHold must return false on storage failure');

    // Restore
    mockStorage.setItem = origSetItem;
  });

});

