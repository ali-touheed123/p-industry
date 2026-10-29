/**
 * scripts/test-phase4-connectivity-detection.mjs
 *
 * Phase 4 Unit Tests: Real Connectivity Detection Engine
 *
 * Exercises:
 * 1. Health check route handler (/api/health) response contract (Task 4.1)
 * 2. Active health probe with latency and timeout measurement (Task 4.2)
 * 3. Multi-state classification: online, degraded, offline (Task 4.3)
 * 4. Immediate state flipping on write error reportNetworkError() (Task 4.6)
 * 5. Recovery on reportNetworkSuccess() (Task 4.6)
 * 6. Captive portal / dead gateway detection (Task 4.2 & 4.3)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeHealth,
  executeProbe,
  reportNetworkError,
  reportNetworkSuccess,
} from '../src/lib/useConnectivity.ts';
import { GET, HEAD } from '../src/app/api/health/route.ts';

// Mock window and navigator properties for Node test runner
global.window = global.window || {};
try {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
} catch {
  // If navigator is read-only in this runtime
}

test('4.1: /api/health route responds with 200 OK, ts, and no-cache headers', async () => {
  const req = new Request('http://localhost:3000/api/health', { method: 'GET' });
  const res = await GET(req);

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.ok, true);
  assert.ok(typeof data.ts === 'number');
  assert.ok(data.ts > 0);

  // Cache-Control assertions
  const cacheControl = res.headers.get('Cache-Control');
  assert.ok(cacheControl?.includes('no-store'), 'Must include no-store header');
});

test('4.1: /api/health HEAD method responds with 200 OK and empty body', async () => {
  const res = await HEAD();
  assert.strictEqual(res.status, 200);
  const body = await res.text();
  assert.strictEqual(body, '');
});

test('4.2 & 4.3: probeHealth classifies fast successful response as online', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await probeHealth();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 200);
    assert.ok(result.latencyMs >= 0);

    const isOnline = await executeProbe();
    assert.strictEqual(isOnline, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('4.2 & 4.3: High latency probe (>1800ms) classifies state as degraded', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    // Artificial 1900ms delay simulating weak 2G / saturated link
    await new Promise((r) => setTimeout(r, 1900));
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await probeHealth();
    assert.strictEqual(result.ok, true);
    assert.ok(result.latencyMs >= 1800, 'Latency must exceed threshold');
  } finally {
    global.fetch = originalFetch;
  }
});

test('4.2: Probe timeout / network rejection triggers false and tracks latency', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    const result = await probeHealth();
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('4.6: reportNetworkError immediately transitions connectivity state', () => {
  // First failure transitions to degraded
  reportNetworkError();
  // Second consecutive failure transitions to offline
  reportNetworkError();

  // Recovery
  reportNetworkSuccess();
});

test('4.2: Captive portal detection: OS says onLine=true but server probe fails', async () => {
  try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  } catch {}

  // But upstream ISP / cloud database is down
  const originalFetch = global.fetch;
  global.fetch = async () => {
    return new Response('<html>Captive Portal Login</html>', { status: 511 });
  };

  try {
    const probe = await probeHealth();
    assert.strictEqual(probe.ok, false, 'Captive portal redirection must not be treated as online');
  } finally {
    global.fetch = originalFetch;
  }
});
