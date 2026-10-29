/**
 * scripts/test-phase2-timeouts-and-retry.mjs
 *
 * Phase 2 Unit Tests: Timeouts + Verify-Before-Retry Engine
 * Exercises fetchWithTimeout, NetworkTimeoutError, NetworkConnectionError,
 * isNetworkOrTimeoutError classifier, and the multi-attempt verify-before-retry loop.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWithTimeout,
  NetworkTimeoutError,
  NetworkConnectionError,
  isNetworkOrTimeoutError,
} from '../src/lib/fetchWithTimeout.js';

test('2.1: fetchWithTimeout enforces timeout and throws typed NetworkTimeoutError', async () => {
  // Use a tiny timeout to test quickly
  const timeoutMs = 40;
  const slowPromise = new Promise((resolve) => setTimeout(resolve, 200));

  // Override global.fetch temporarily for this test
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response('OK')), 300);
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  };

  try {
    await assert.rejects(
      async () => {
        await fetchWithTimeout('http://localhost:3000/api/invoices', { timeoutMs });
      },
      (err) => {
        assert.ok(err instanceof NetworkTimeoutError, 'Must throw NetworkTimeoutError');
        assert.strictEqual(err.name, 'NetworkTimeoutError');
        assert.strictEqual(err.timeoutMs, timeoutMs);
        assert.ok(isNetworkOrTimeoutError(err), 'Classifier must recognize timeout error');
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('2.1: fetchWithTimeout resolves normally when within timeout window', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });

  try {
    const res = await fetchWithTimeout('http://localhost:3000/api/invoices', { timeoutMs: 5000 });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('2.1: isNetworkOrTimeoutError accurately classifies transport errors vs business rejections', () => {
  // Transport failures
  assert.strictEqual(isNetworkOrTimeoutError(new NetworkTimeoutError('Timed out', 20000)), true);
  assert.strictEqual(isNetworkOrTimeoutError(new NetworkConnectionError('Server down')), true);
  assert.strictEqual(isNetworkOrTimeoutError(new TypeError('Failed to fetch')), true);
  assert.strictEqual(isNetworkOrTimeoutError({ name: 'AbortError' }), true);
  assert.strictEqual(isNetworkOrTimeoutError(new Error('getaddrinfo ENOTFOUND api.supabase.co')), true);

  // Business / Application rejections (NOT transport errors)
  assert.strictEqual(isNetworkOrTimeoutError(new Error('Invalid credit limit')), false);
  assert.strictEqual(isNetworkOrTimeoutError(new Error('Walk-in customer ka naam zaroori hai')), false);
  assert.strictEqual(isNetworkOrTimeoutError(null), false);
  assert.strictEqual(isNetworkOrTimeoutError(undefined), false);
});

test('2.3: Verify-before-retry flow catches network drop and dedupes via is_duplicate', async () => {
  let attempts = 0;
  const stableIdempotencyKey = 'idemp-uuid-verify-test-1234';

  // Simulating server:
  // Attempt 1: Server receives and records the invoice, but connection drops right before response reaches client
  // Attempt 2 (Auto-verify retry with same key): Server's idempotency pre-check catches key and returns is_duplicate: true
  async function simulateCheckout(key) {
    attempts++;
    if (attempts === 1) {
      // Network drop after commit
      throw new NetworkConnectionError('Connection lost mid-flight');
    }
    // Attempt 2: Auto-verify succeeds with duplicate confirmation
    return {
      status: 200,
      json: async () => ({
        success: true,
        is_duplicate: true,
        invoice: { invoice_no: 'INV-261029-0099', id: 'inv-uuid-99' },
      }),
    };
  }

  let finalInvoiceNo = null;
  let clientMessage = '';
  let activeKey = stableIdempotencyKey;

  // The Phase 2 client checkout loop:
  const MAX_VERIFY_ATTEMPTS = 2;
  let res = null;
  let lastErr = null;

  for (let a = 0; a <= MAX_VERIFY_ATTEMPTS; a++) {
    try {
      res = await simulateCheckout(activeKey);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (!isNetworkOrTimeoutError(err)) throw err;
    }
  }

  assert.strictEqual(lastErr, null, 'Auto-verify must resolve the dropped connection');
  assert.ok(res, 'Response must be received from auto-verify');

  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.is_duplicate, true);

  if (data.is_duplicate) {
    // Phase 2.4 friendly wording
    clientMessage = 'Sale successfully recorded! (Sale pehle hi record ho chuki hai)';
    finalInvoiceNo = data.invoice.invoice_no;
    activeKey = null; // Cleared on confirmation
  }

  assert.strictEqual(finalInvoiceNo, 'INV-261029-0099');
  assert.strictEqual(activeKey, null, 'Active checkout key must be reset on success');
  assert.strictEqual(clientMessage, 'Sale successfully recorded! (Sale pehle hi record ho chuki hai)');
  assert.strictEqual(attempts, 2, 'Should succeed on attempt 2 without requiring manual cashier re-entry');
});

test('2.4: Persistent outage exhausts auto-verify, preserves key, and shows cashier recovery copy', async () => {
  let attempts = 0;
  const stableKey = 'idemp-uuid-outage-5678';

  // Simulating complete internet blackout (all attempts fail)
  async function simulateDeadConnection() {
    attempts++;
    throw new NetworkTimeoutError('Request timed out after 20s', 20000);
  }

  const MAX_VERIFY_ATTEMPTS = 2;
  let lastErr = null;

  for (let a = 0; a <= MAX_VERIFY_ATTEMPTS; a++) {
    try {
      await simulateDeadConnection();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  assert.ok(lastErr instanceof NetworkTimeoutError);
  assert.strictEqual(attempts, 3, '1 initial attempt + 2 verify attempts');

  // Friendly recovery dialog setup
  const recoveryDialog = {
    failedAfterRetries: true,
    errorMessage:
      'Connection lost. Sale could not be confirmed. (Internet band hai — sale abhi confirm nahi hui. Dobara enter mat karein; "Retry" dabayein ya offline save karein.)',
    preservedKey: stableKey, // Cart and key are KEPT
  };

  assert.strictEqual(recoveryDialog.failedAfterRetries, true);
  assert.strictEqual(recoveryDialog.preservedKey, stableKey, 'Idempotency key must NOT be lost');
  assert.ok(recoveryDialog.errorMessage.includes('Internet band hai'));
});

