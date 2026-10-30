/**
 * scripts/test-phase8-invoice-edit.mjs
 *
 * Unit tests for Phase 8:
 * - Optimistic Concurrency Control (expected_version vs current version)
 * - Edit Idempotency Key Deduplication (repeated PATCH does not double-mutate)
 * - Version Conflict Detection (INVOICE_VERSION_CONFLICT error mapping to HTTP 409)
 * - Offline Edit Blocking (MED-05 Global Conflict Policy: edits are online-only)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── 1. OPTIMISTIC LOCKING VERSION CONCURRENCY LOGIC ─────────────────────────
test('Phase 8.1 / 8.2: Optimistic Locking version check', () => {
  function verifyVersionConcurrency(currentVersion, expectedVersion) {
    if (expectedVersion !== null && expectedVersion !== undefined && currentVersion !== expectedVersion) {
      const err = new Error(`INVOICE_VERSION_CONFLICT: Expected version ${expectedVersion}, but current invoice version is ${currentVersion}`);
      err.code = 'INVOICE_VERSION_CONFLICT';
      throw err;
    }
    return currentVersion + 1;
  }

  // Matching version succeeds and increments
  assert.equal(verifyVersionConcurrency(1, 1), 2, 'Version 1 with expected_version 1 increments to 2');
  assert.equal(verifyVersionConcurrency(2, 2), 3, 'Version 2 with expected_version 2 increments to 3');

  // Mismatching version throws INVOICE_VERSION_CONFLICT
  assert.throws(
    () => verifyVersionConcurrency(2, 1),
    /INVOICE_VERSION_CONFLICT/,
    'Stale expected_version 1 against current version 2 must throw conflict'
  );

  assert.throws(
    () => verifyVersionConcurrency(5, 4),
    /INVOICE_VERSION_CONFLICT/,
    'Expected version 4 on invoice already at version 5 must throw conflict'
  );
});

// ── 2. EDIT IDEMPOTENCY DEDUPLICATION UNDER ROW LOCK ─────────────────────────
test('Phase 8.2: Repeated edit with same edit_idempotency_key is deduped', () => {
  let inventoryMutations = 0;
  let clientBalanceMutations = 0;

  function simulateUpdateInvoiceAtomic(invoice, editPayload) {
    const editKey = editPayload.edit_idempotency_key;
    const expectedVersion = editPayload.expected_version;

    // Idempotency check under row lock
    if (editKey && invoice.edit_idempotency_key === editKey) {
      return {
        success: true,
        is_duplicate: true,
        invoice,
      };
    }

    // Version check
    if (expectedVersion !== null && invoice.version !== expectedVersion) {
      throw new Error(`INVOICE_VERSION_CONFLICT: Expected ${expectedVersion}, current ${invoice.version}`);
    }

    // Simulate inventory + client balance updates
    inventoryMutations++;
    clientBalanceMutations++;

    // Advance version and record edit key
    invoice.version = (invoice.version || 1) + 1;
    invoice.edit_idempotency_key = editKey;
    invoice.net_total = editPayload.net_total;

    return {
      success: true,
      is_duplicate: false,
      invoice,
    };
  }

  const invoice = {
    id: 'inv-uuid-1',
    version: 1,
    edit_idempotency_key: null,
    net_total: 1000,
  };

  const editKey = '00000000-0000-0000-0000-000000000001';
  const edit1 = {
    expected_version: 1,
    edit_idempotency_key: editKey,
    net_total: 1500,
  };

  // First submit
  const res1 = simulateUpdateInvoiceAtomic(invoice, edit1);
  assert.equal(res1.success, true);
  assert.equal(res1.is_duplicate, false);
  assert.equal(res1.invoice.version, 2);
  assert.equal(res1.invoice.net_total, 1500);
  assert.equal(inventoryMutations, 1);
  assert.equal(clientBalanceMutations, 1);

  // Second submit (network retry with identical edit_idempotency_key)
  const res2 = simulateUpdateInvoiceAtomic(invoice, edit1);
  assert.equal(res2.success, true);
  assert.equal(res2.is_duplicate, true, 'Retry must be flagged as is_duplicate');
  assert.equal(res2.invoice.version, 2, 'Version must not increment on duplicate retry');
  assert.equal(inventoryMutations, 1, 'Inventory must NOT mutate a second time');
  assert.equal(clientBalanceMutations, 1, 'Client balance must NOT mutate a second time');

  // Third submit from another device still holding version 1 -> CONFLICT
  const editFromDeviceB = {
    expected_version: 1,
    edit_idempotency_key: '00000000-0000-0000-0000-000000000002',
    net_total: 1800,
  };
  assert.throws(
    () => simulateUpdateInvoiceAtomic(invoice, editFromDeviceB),
    /INVOICE_VERSION_CONFLICT/,
    'Device B with stale expected_version 1 must be rejected with version conflict'
  );
});

// ── 3. HTTP 409 CONFLICT MAPPING IN API LAYER ────────────────────────────────
test('Phase 8.2: API layer maps INVOICE_VERSION_CONFLICT to HTTP 409', () => {
  function mapRpcErrorToHttp(error) {
    if (error.message && error.message.includes('INVOICE_VERSION_CONFLICT')) {
      return {
        status: 409,
        body: {
          success: false,
          error: 'This invoice has been modified by another terminal or user. Please reload the invoice to view the latest state before editing.',
          code: 'INVOICE_VERSION_CONFLICT',
        },
      };
    }
    return { status: 500, body: { success: false, error: error.message } };
  }

  const conflictErr = new Error('INVOICE_VERSION_CONFLICT: Expected version 1, but current invoice version is 2');
  const response = mapRpcErrorToHttp(conflictErr);

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'INVOICE_VERSION_CONFLICT');
  assert.equal(response.body.success, false);
});

// ── 4. OFFLINE EDIT GUARDS (MED-05 / TASK 8.3) ──────────────────────────────
test('Phase 8.3: Editing offline or unsynced invoice is blocked', () => {
  function canEditInvoice({ isOnline, invoice }) {
    if (!isOnline) {
      return { allowed: false, reason: 'offline' };
    }
    if (invoice.is_offline && !invoice.synced_at) {
      return { allowed: false, reason: 'unsynced_offline' };
    }
    return { allowed: true };
  }

  // Online + synced -> allowed
  assert.deepEqual(canEditInvoice({ isOnline: true, invoice: { id: 'inv-1', is_offline: false } }), { allowed: true });
  assert.deepEqual(canEditInvoice({ isOnline: true, invoice: { id: 'inv-2', is_offline: true, synced_at: '2026-10-30T00:00:00Z' } }), { allowed: true });

  // Offline -> blocked
  assert.deepEqual(canEditInvoice({ isOnline: false, invoice: { id: 'inv-1' } }), { allowed: false, reason: 'offline' });

  // Online but unsynced offline invoice -> blocked until synced
  assert.deepEqual(canEditInvoice({ isOnline: true, invoice: { id: 'inv-3', is_offline: true, synced_at: null } }), { allowed: false, reason: 'unsynced_offline' });
});

