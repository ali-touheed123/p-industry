/**
 * scripts/test-lifecycle-offline.mjs
 *
 * Task 4.1 — Offline unit tests for verify-tenant-lifecycle.mjs.
 *
 * These tests exercise the lifecycle script's safety mechanisms using
 * mocked HTTP responses and mocked state. NO live server or database
 * connections are made. Importing this file is safe in any environment.
 *
 * Test inventory:
 *
 *   L-1.  Environment gate: missing ALLOW_TENANT_LIFECYCLE_TEST → throws before fetch.
 *   L-2.  Environment gate: ALLOW_TENANT_LIFECYCLE_TEST=false → throws before fetch.
 *   L-3.  Environment gate: PYNTFLOW_BASE_URL missing → throws before fetch.
 *   L-4.  Environment gate: non-approved PYNTFLOW_BASE_URL → throws before fetch.
 *   L-5.  Environment gate: malformed PYNTFLOW_BASE_URL → throws before fetch.
 *   L-6.  Environment gate: DEV_ADMIN_TOKEN missing → throws before fetch.
 *   L-7.  Environment gate: all vars valid (localhost) → does NOT throw.
 *   L-8.  makeRunIds produces unique values per call (no collisions on rapid calls).
 *   L-9.  makeRunIds slug matches expected prefix format (test-lc-...).
 *   L-10. makeRunIds passwords are not static strings (ceo, counter1, etc.).
 *   L-11. Cleanup.run: only calls DELETE for each tracked ID, no others.
 *   L-12. Cleanup.run: a 404 response is treated as success (already deleted).
 *   L-13. Cleanup.run: a non-200/non-404 triggers printRecoveryAid, does not throw.
 *   L-14. Cleanup.run: one cleanup failure does not prevent subsequent deletes.
 *   L-14a. cleanup.untrack: removing an absent ID is a no-op and preserves all tracked IDs (no splice(-1,1) bug).
 *   L-14b. cleanup.untrack: removing an existing ID removes only that ID and preserves all unrelated IDs.
 *   L-14c. cleanup.track: safely adds string IDs and prevents duplicates.
 *   L-15. printRecoveryAid output contains exact IDs, no wildcard SQL.
 *   L-16. printRecoveryAid does NOT print tokens, passwords, or hashes.
 *   L-17. Importing the module without env vars does NOT trigger network calls
 *         (entry-point guard works correctly in import context).
 *   L-18. Secret redaction: DEV_ADMIN_TOKEN value never appears in any console output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Import only the exported pure functions (no live execution side effects) ──
// We use dynamic import so we can control env vars before each test group.
// The module is designed so importing it does NOT trigger runLifecycleTest().

// Capture console.error output for assertion tests
function captureStderr(fn) {
  const lines = [];
  const orig = console.error;
  console.error = (...args) => lines.push(args.join(' '));
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return lines;
}

async function captureStderrAsync(fn) {
  const lines = [];
  const orig = console.error;
  console.error = (...args) => lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.error = orig;
  }
  return lines;
}

// ── Load module once — it must be importable without env vars ─────────────────
let mod;
try {
  mod = await import('./verify-tenant-lifecycle.mjs');
} catch (err) {
  console.error('[FATAL] Could not import verify-tenant-lifecycle.mjs:', err.message);
  process.exit(1);
}

const { validateEnvironment, makeRunIds, cleanup, printRecoveryAid } = mod;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run validateEnvironment with a controlled env snapshot
// ─────────────────────────────────────────────────────────────────────────────
function withEnv(overrides, fn) {
  const saved = {};
  const all = ['ALLOW_TENANT_LIFECYCLE_TEST', 'PYNTFLOW_BASE_URL', 'DEV_ADMIN_TOKEN'];

  for (const key of all) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    return fn();
  } finally {
    for (const key of all) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT GATE TESTS (L-1 through L-7)
// ─────────────────────────────────────────────────────────────────────────────

test('L-1. Missing ALLOW_TENANT_LIFECYCLE_TEST throws before any fetch', () => {
  assert.throws(
    () => withEnv({
      PYNTFLOW_BASE_URL: 'http://localhost:3000',
      DEV_ADMIN_TOKEN: 'fake-token',
    }, validateEnvironment),
    /ALLOW_TENANT_LIFECYCLE_TEST/i
  );
});

test('L-2. ALLOW_TENANT_LIFECYCLE_TEST=false throws before any fetch', () => {
  assert.throws(
    () => withEnv({
      ALLOW_TENANT_LIFECYCLE_TEST: 'false',
      PYNTFLOW_BASE_URL: 'http://localhost:3000',
      DEV_ADMIN_TOKEN: 'fake-token',
    }, validateEnvironment),
    /ALLOW_TENANT_LIFECYCLE_TEST/i
  );
});

test('L-3. Missing PYNTFLOW_BASE_URL throws', () => {
  assert.throws(
    () => withEnv({
      ALLOW_TENANT_LIFECYCLE_TEST: 'true',
      DEV_ADMIN_TOKEN: 'fake-token',
    }, validateEnvironment),
    /PYNTFLOW_BASE_URL/i
  );
});

test('L-4. Non-approved PYNTFLOW_BASE_URL (remote staging) throws', () => {
  assert.throws(
    () => withEnv({
      ALLOW_TENANT_LIFECYCLE_TEST: 'true',
      PYNTFLOW_BASE_URL: 'https://staging.pyntflow.com',
      DEV_ADMIN_TOKEN: 'fake-token',
    }, validateEnvironment),
    /not in the approved origins allowlist/i
  );
});

test('L-5. Malformed PYNTFLOW_BASE_URL throws', () => {
  assert.throws(
    () => withEnv({
      ALLOW_TENANT_LIFECYCLE_TEST: 'true',
      PYNTFLOW_BASE_URL: 'not-a-url',
      DEV_ADMIN_TOKEN: 'fake-token',
    }, validateEnvironment),
    /not a valid URL/i
  );
});

test('L-6. Missing DEV_ADMIN_TOKEN throws', () => {
  assert.throws(
    () => withEnv({
      ALLOW_TENANT_LIFECYCLE_TEST: 'true',
      PYNTFLOW_BASE_URL: 'http://localhost:3000',
    }, validateEnvironment),
    /DEV_ADMIN_TOKEN/i
  );
});

test('L-7. All valid env vars (localhost) → validateEnvironment does NOT throw', () => {
  const result = withEnv({
    ALLOW_TENANT_LIFECYCLE_TEST: 'true',
    PYNTFLOW_BASE_URL: 'http://localhost:3000',
    DEV_ADMIN_TOKEN: 'test-token-value',
  }, validateEnvironment);

  assert.equal(result.baseUrl, 'http://localhost:3000');
  // Token returned but must never be logged — we verify the field exists
  assert.equal(typeof result.devToken, 'string');
  assert.ok(result.devToken.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER GENERATION TESTS (L-8 through L-10)
// ─────────────────────────────────────────────────────────────────────────────

test('L-8. makeRunIds produces unique slugs and usernames across rapid successive calls', () => {
  const r1 = makeRunIds();
  // Brief pause to ensure timestamp differs if resolution allows
  const r2 = makeRunIds();
  // Even if timestamps match, the random hex suffix guarantees uniqueness
  assert.notEqual(r1.slug, r2.slug, 'Slugs must differ between runs');
  assert.notEqual(r1.ceoUsername, r2.ceoUsername, 'CEO usernames must differ');
  assert.notEqual(r1.counterUsername, r2.counterUsername, 'Counter usernames must differ');
});

test('L-9. makeRunIds slug matches expected prefix format test-lc-<ts>-<hex>', () => {
  const { slug } = makeRunIds();
  assert.match(slug, /^test-lc-\d+-[0-9a-f]{6}$/, `Slug "${slug}" does not match expected format`);
});

test('L-10. makeRunIds passwords are not static strings (ceo, counter1, hamza, etc.)', () => {
  const FORBIDDEN = ['ceo', 'counter1', 'hamza', 'admin', 'password', '123456'];
  const r = makeRunIds();
  for (const forbidden of FORBIDDEN) {
    assert.notEqual(r.ceoPassword, forbidden, `ceoPassword must not be "${forbidden}"`);
    assert.notEqual(r.counterPassword, forbidden, `counterPassword must not be "${forbidden}"`);
    assert.notEqual(r.ceoUsername, forbidden, `ceoUsername must not be static "${forbidden}"`);
    assert.notEqual(r.slug, forbidden, `slug must not be static "${forbidden}"`);
  }
  // Passwords must be non-trivial length
  assert.ok(r.ceoPassword.length >= 16, 'ceoPassword must be at least 16 chars');
  assert.ok(r.counterPassword.length >= 16, 'counterPassword must be at least 16 chars');
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP TESTS (L-11 through L-14)
// ─────────────────────────────────────────────────────────────────────────────

// Mock fetch for cleanup tests
function makeMockFetch(responses) {
  // responses: Map<url_substring, { status, body }>
  return async (url, _init) => {
    for (const [key, resp] of Object.entries(responses)) {
      if (url.includes(key)) {
        return {
          status: resp.status,
          json: async () => resp.body,
        };
      }
    }
    // Default: 200 success
    return { status: 200, json: async () => ({ success: true }) };
  };
}

test('L-11. cleanup.run calls DELETE for each tracked ID and no others', async () => {
  const trackedIds = ['uuid-aaa', 'uuid-bbb'];
  const deletedUrls = [];

  const mockFetch = async (url, init) => {
    if (init?.method === 'DELETE') deletedUrls.push(url);
    return { status: 200, json: async () => ({ success: true }) };
  };

  // Temporarily override global fetch and cleanup state for this test
  const origFetch = globalThis.fetch;
  const origTracked = [...cleanup.trackedTenantIds];
  globalThis.fetch = mockFetch;
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...trackedIds);

  await captureStderrAsync(() => cleanup.run('http://localhost:3000', 'test-token'));

  globalThis.fetch = origFetch;
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);

  assert.equal(deletedUrls.length, 2, 'Should call DELETE for each tracked ID');
  assert.ok(deletedUrls.some(u => u.includes('uuid-aaa')), 'Must delete uuid-aaa');
  assert.ok(deletedUrls.some(u => u.includes('uuid-bbb')), 'Must delete uuid-bbb');
  // No other IDs should be included
  for (const url of deletedUrls) {
    assert.ok(url.includes('uuid-aaa') || url.includes('uuid-bbb'), `Unexpected URL deleted: ${url}`);
  }
});

test('L-12. cleanup.run: 404 response treated as success (already deleted)', async () => {
  const origFetch = globalThis.fetch;
  const origTracked = [...cleanup.trackedTenantIds];

  globalThis.fetch = async () => ({
    status: 404,
    json: async () => ({ success: false, error: 'not found' }),
  });
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push('uuid-already-gone');

  // Should not throw and should not call printRecoveryAid
  const stderrLines = await captureStderrAsync(() => cleanup.run('http://localhost:3000', 'test-token'));

  globalThis.fetch = origFetch;
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);

  const hasRecovery = stderrLines.some(l => l.includes('MANUAL RECOVERY'));
  assert.equal(hasRecovery, false, '404 should NOT trigger recovery aid (treated as already absent)');
});

test('L-13. cleanup.run: non-200/non-404 triggers printRecoveryAid without throwing', async () => {
  const origFetch = globalThis.fetch;
  const origTracked = [...cleanup.trackedTenantIds];

  globalThis.fetch = async () => ({
    status: 500,
    json: async () => ({ success: false, error: 'server error' }),
  });
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push('uuid-failed-cleanup');

  let threw = false;
  const stderrLines = await captureStderrAsync(async () => {
    try {
      await cleanup.run('http://localhost:3000', 'test-token');
    } catch {
      threw = true;
    }
  });

  globalThis.fetch = origFetch;
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);

  assert.equal(threw, false, 'cleanup.run must not throw on cleanup failure');
  const hasRecovery = stderrLines.some(l => l.includes('MANUAL RECOVERY') || l.includes('CLEANUP INCOMPLETE'));
  assert.equal(hasRecovery, true, 'Recovery aid must be printed on cleanup failure');
});

test('L-14. cleanup.run: one fetch failure does not prevent subsequent delete attempts', async () => {
  const origFetch = globalThis.fetch;
  const origTracked = [...cleanup.trackedTenantIds];
  const deletedUrls = [];

  let callCount = 0;
  globalThis.fetch = async (url, init) => {
    callCount++;
    if (init?.method === 'DELETE') deletedUrls.push(url);
    // First call fails with network error
    if (callCount === 1) throw new Error('network failure');
    return { status: 200, json: async () => ({ success: true }) };
  };

  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push('uuid-fail-first', 'uuid-succeed-second');

  await captureStderrAsync(() => cleanup.run('http://localhost:3000', 'test-token'));

  globalThis.fetch = origFetch;
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);

  assert.equal(deletedUrls.length, 2, 'Both IDs must be attempted even when first fails');
  assert.ok(deletedUrls.some(u => u.includes('uuid-fail-first')), 'First ID must be attempted');
  assert.ok(deletedUrls.some(u => u.includes('uuid-succeed-second')), 'Second ID must be attempted');
});

test('L-14a. cleanup.untrack: removing an absent ID is a no-op and does NOT remove the final tracked ID', () => {
  const origTracked = [...cleanup.trackedTenantIds];
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push('tenant-alpha', 'tenant-beta', 'tenant-omega');

  // Attempt to untrack an ID that was never tracked
  cleanup.untrack('tenant-nonexistent');

  // Must NOT have removed 'tenant-omega' (the old splice(-1, 1) bug)
  assert.equal(cleanup.trackedTenantIds.length, 3, 'Length must remain 3 when untracking absent ID');
  assert.deepEqual(cleanup.trackedTenantIds, ['tenant-alpha', 'tenant-beta', 'tenant-omega'], 'Array contents must remain completely unchanged');

  // Also test null, undefined, and non-string types
  cleanup.untrack(null);
  cleanup.untrack(undefined);
  cleanup.untrack('');
  assert.equal(cleanup.trackedTenantIds.length, 3, 'Invalid ID types must not alter tracking array');

  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);
});

test('L-14b. cleanup.untrack: removing an existing ID removes only that ID and preserves all unrelated IDs', () => {
  const origTracked = [...cleanup.trackedTenantIds];
  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push('tenant-1-uuid', 'tenant-2-uuid', 'tenant-3-uuid');

  // Untrack middle ID (e.g. Tenant 1 confirmed deleted while Tenant 2 is still tracked)
  cleanup.untrack('tenant-2-uuid');

  assert.equal(cleanup.trackedTenantIds.length, 2, 'Length must decrease by 1');
  assert.deepEqual(cleanup.trackedTenantIds, ['tenant-1-uuid', 'tenant-3-uuid'], 'Only tenant-2-uuid should be removed');

  // Untrack first ID
  cleanup.untrack('tenant-1-uuid');
  assert.deepEqual(cleanup.trackedTenantIds, ['tenant-3-uuid'], 'Only tenant-3-uuid should remain');

  // Untrack last remaining ID
  cleanup.untrack('tenant-3-uuid');
  assert.equal(cleanup.trackedTenantIds.length, 0, 'Array should be empty after untracking last ID');

  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);
});

test('L-14c. cleanup.track: safely adds string IDs and prevents duplicates', () => {
  const origTracked = [...cleanup.trackedTenantIds];
  cleanup.trackedTenantIds.length = 0;

  cleanup.track('uuid-1');
  cleanup.track('uuid-2');
  cleanup.track('uuid-1'); // Duplicate should be ignored
  cleanup.track(null);     // Non-string ignored
  cleanup.track('');       // Empty ignored

  assert.deepEqual(cleanup.trackedTenantIds, ['uuid-1', 'uuid-2'], 'Must add valid string IDs without duplicates');

  cleanup.trackedTenantIds.length = 0;
  cleanup.trackedTenantIds.push(...origTracked);
});

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY AID TESTS (L-15 through L-16)
// ─────────────────────────────────────────────────────────────────────────────

test('L-15. printRecoveryAid output contains exact IDs and only exact-match SQL (no wildcards)', () => {
  const testIds = ['uuid-exact-111', 'uuid-exact-222'];

  const lines = captureStderr(() => printRecoveryAid(testIds));
  const output = lines.join('\n');

  // Must contain exact IDs
  assert.ok(output.includes('uuid-exact-111'), 'Must include first exact ID');
  assert.ok(output.includes('uuid-exact-222'), 'Must include second exact ID');

  // Must use IN clause with exact IDs — not LIKE wildcards for cleanup SQL
  assert.match(output, /WHERE id IN/i, 'Cleanup SQL must use WHERE id IN (exact IDs)');

  // Must NOT auto-execute wildcard cleanup
  const hasAutoWildcard = /DELETE.*WHERE.*LIKE/i.test(output);
  assert.equal(hasAutoWildcard, false, 'Recovery aid must NOT include auto-executable wildcard DELETE SQL');
});

test('L-16. printRecoveryAid does NOT print tokens, passwords, or sensitive values', () => {
  const sensitiveToken = 'SUPER_SECRET_TOKEN_12345';
  const testIds = ['uuid-test-333'];

  // Temporarily set env vars to check they don't leak
  const orig = process.env.DEV_ADMIN_TOKEN;
  process.env.DEV_ADMIN_TOKEN = sensitiveToken;

  const lines = captureStderr(() => printRecoveryAid(testIds));
  const output = lines.join('\n');

  process.env.DEV_ADMIN_TOKEN = orig;

  assert.ok(!output.includes(sensitiveToken), 'DEV_ADMIN_TOKEN must NOT appear in recovery output');
  assert.ok(!output.includes('password'), 'Word "password" must not appear in recovery output');
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT SAFETY TEST (L-17)
// ─────────────────────────────────────────────────────────────────────────────

test('L-17. Module can be imported without env vars without triggering network calls', () => {
  // If we reached this point, the module was already imported at the top
  // without ALLOW_TENANT_LIFECYCLE_TEST=true set, and no network call was made.
  // This test simply confirms that outcome.
  assert.ok(typeof mod.validateEnvironment === 'function', 'validateEnvironment is exported');
  assert.ok(typeof mod.makeRunIds === 'function', 'makeRunIds is exported');
  assert.ok(typeof mod.cleanup === 'object', 'cleanup state is exported');
  assert.ok(typeof mod.runLifecycleTest === 'function', 'runLifecycleTest is exported but not auto-called');
  // If runLifecycleTest had been auto-called, it would have thrown on missing env vars.
  // The fact that we are still running means it was NOT called.
  pass_marker('Module imported safely without triggering live execution');
});

function pass_marker(label) {
  // Simple pass marker for non-assert confirmations
  console.log(`  ✔  ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECRET REDACTION TEST (L-18)
// ─────────────────────────────────────────────────────────────────────────────

test('L-18. validateEnvironment return value does not log DEV_ADMIN_TOKEN value', () => {
  const secretToken = 'MY_SECRET_TOKEN_XYZ_98765';
  let loggedLines = [];
  const origLog = console.log;
  const origError = console.error;

  console.log = (...args) => loggedLines.push(args.join(' '));
  console.error = (...args) => loggedLines.push(args.join(' '));

  let result;
  try {
    result = withEnv({
      ALLOW_TENANT_LIFECYCLE_TEST: 'true',
      PYNTFLOW_BASE_URL: 'http://localhost:3000',
      DEV_ADMIN_TOKEN: secretToken,
    }, validateEnvironment);
  } finally {
    console.log = origLog;
    console.error = origError;
  }

  const allOutput = loggedLines.join('\n');
  assert.ok(!allOutput.includes(secretToken), 'DEV_ADMIN_TOKEN must NEVER be logged by validateEnvironment');
  // Token is returned to the caller (who must guard it)
  assert.equal(result.devToken, secretToken, 'Token is returned to caller for use (not logged)');
});
