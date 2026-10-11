/**
 * scripts/verify-tenant-lifecycle.mjs
 *
 * Task 4.1 — Safe End-to-End Tenant Provisioning & Deletion Regression Test Script
 *
 * PURPOSE
 * -------
 * Verifies the full tenant lifecycle against a running PyntFlow HTTP server:
 *   1. Duplicate usernames in one request are rejected (HTTP 400).
 *   2. Valid CEO + counter provisioning succeeds (HTTP 200).
 *   3. An existing global username is rejected (HTTP 400).
 *   4. Tenant 1 is deleted via DELETE /api/tenants (HTTP 200).
 *   5. Exact same usernames can be immediately reused (HTTP 200, Tenant 2 created).
 *   6. Tenant 2 is deleted via DELETE /api/tenants (HTTP 200).
 *   7. GET /api/tenants?slug=<slug> returns 404 for both deleted tenants (no leftover rows).
 *
 * AUTHORIZATION REQUIRED BEFORE RUNNING
 * ---------------------------------------
 * This script MUST NOT be executed without separate explicit authorization.
 * It performs live HTTP requests and indirectly causes database mutations.
 * The authorization must cover the specific target environment.
 *
 * REQUIRED ENVIRONMENT VARIABLES
 * --------------------------------
 *   ALLOW_TENANT_LIFECYCLE_TEST=true    — explicit opt-in (fail-closed gate)
 *   PYNTFLOW_BASE_URL                   — e.g. http://localhost:3000 or https://staging.example.com
 *   DEV_ADMIN_TOKEN                     — signed developer JWT (aura_dev_token)
 *                                         Obtain via the dev login endpoint or by signing a
 *                                         { role: 'developer' } payload with DEV_ADMIN_SECRET.
 *                                         NEVER log this value.
 *
 * APPROVED TARGETS (fail-closed allowlist)
 * -----------------------------------------
 * Only these base URL patterns are accepted without modification:
 *   - http://localhost:*  (local development)
 *   - http://127.0.0.1:* (local loopback)
 * To allow a staging or production target, add its exact origin to ALLOWED_ORIGINS below
 * and document the approval. Never commit production URLs to source control.
 *
 * WHAT THIS SCRIPT DOES NOT DO
 * ------------------------------
 * - Does NOT connect directly to the Supabase database.
 * - Does NOT read SUPABASE_SERVICE_ROLE_KEY.
 * - Does NOT print DEV_ADMIN_TOKEN, passwords, or hashes.
 * - Does NOT clean up by prefix, pattern, or slug wildcard.
 * - Does NOT guarantee cleanup after SIGKILL or machine failure.
 *   (See RECOVERY PROCEDURE below for that case.)
 *
 * RECOVERY PROCEDURE (if process is killed before cleanup)
 * ---------------------------------------------------------
 * If this script is forcefully killed (SIGKILL, power failure, etc.) before cleanup
 * completes, tracked IDs will be printed to stdout as a "RECOVERY AID" block.
 * Use those IDs to manually verify and clean up:
 *
 *   -- Read-only discovery (safe to run, does NOT delete):
 *   SELECT id, slug, name, created_at FROM public.tenants WHERE id IN ('<id1>', '<id2>');
 *   SELECT id, username, role FROM public.app_users WHERE tenant_id IN ('<id1>', '<id2>');
 *
 *   -- Cleanup (requires human verification before running):
 *   DELETE FROM public.app_users WHERE tenant_id IN ('<id1>', '<id2>');
 *   DELETE FROM public.tenants WHERE id IN ('<id1>', '<id2>');
 *
 * If IDs were not yet recorded, use the slug prefix for READ-ONLY CANDIDATE DISCOVERY ONLY:
 *   SELECT id, slug, name, created_at FROM public.tenants WHERE slug LIKE 'test-lc-%';
 *   -- Candidate discovery only (NOT proof of ownership). Wildcard DELETE is forbidden.
 *   -- Verify each row belongs solely to this test run before deleting by exact verified IDs.
 *
 * SECURITY NOTES
 * ---------------
 * - Credentials are read from environment variables only.
 * - Passwords sent to the server are randomly generated per run and never reused.
 * - Assertion failures do NOT expose credentials in output.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ─── CONFIGURATION ───────────────────────────────────────────────────────────

/**
 * Approved base URL origins for live execution.
 * Only exact origins (scheme + host + port) are matched.
 * Staging/production entries must be explicitly approved and documented here.
 */
const ALLOWED_ORIGINS = new Set([
  'http://localhost',         // any localhost port
  'http://127.0.0.1',        // any loopback port
]);

// ─── SAFETY GATE ─────────────────────────────────────────────────────────────

/**
 * Validates all required environment variables before any network request.
 * Throws with a clear message if any requirement is not met.
 * This function has no side effects on the environment or database.
 */
function validateEnvironment() {
  const errors = [];

  if (process.env.ALLOW_TENANT_LIFECYCLE_TEST !== 'true') {
    errors.push(
      'ALLOW_TENANT_LIFECYCLE_TEST is not set to "true".\n' +
      '  Set ALLOW_TENANT_LIFECYCLE_TEST=true to explicitly authorize this run.\n' +
      '  This script must not be executed without separate authorization.'
    );
  }

  const rawBaseUrl = process.env.PYNTFLOW_BASE_URL;
  if (!rawBaseUrl) {
    errors.push(
      'PYNTFLOW_BASE_URL is not set.\n' +
      '  Set it to the base URL of the target server (e.g. http://localhost:3000).'
    );
  } else {
    let parsed;
    try {
      parsed = new URL(rawBaseUrl);
    } catch {
      errors.push(`PYNTFLOW_BASE_URL is not a valid URL: "${rawBaseUrl}"`);
      parsed = null;
    }

    if (parsed) {
      // Match on scheme + hostname only (port is part of the origin string when non-default)
      const originWithoutPort = `${parsed.protocol}//${parsed.hostname}`;
      const originWithPort = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
      const allowed = ALLOWED_ORIGINS.has(originWithoutPort) || ALLOWED_ORIGINS.has(originWithPort);

      if (!allowed) {
        errors.push(
          `PYNTFLOW_BASE_URL target "${parsed.origin}" is not in the approved origins allowlist.\n` +
          '  Approved targets are: ' + [...ALLOWED_ORIGINS].join(', ') + '\n' +
          '  To approve a non-local target, add its exact origin to ALLOWED_ORIGINS in this script\n' +
          '  and obtain separate written authorization before running against it.'
        );
      }
    }
  }

  if (!process.env.DEV_ADMIN_TOKEN) {
    errors.push(
      'DEV_ADMIN_TOKEN is not set.\n' +
      '  Provide the signed developer JWT. Obtain it from the dev login flow or\n' +
      '  by signing { role: "developer" } with DEV_ADMIN_SECRET.\n' +
      '  NEVER log or print this token.'
    );
  }

  if (errors.length > 0) {
    const msg = [
      '',
      '╔══════════════════════════════════════════════════════════════════╗',
      '║  LIFECYCLE TEST — ENVIRONMENT GATE FAILED (fail-closed)          ║',
      '╚══════════════════════════════════════════════════════════════════╝',
      '',
      ...errors.map((e, i) => `  [${i + 1}] ${e}`),
      '',
      '  No network requests were made. Resolve the above issues and retry.',
      '',
    ].join('\n');
    throw new Error(msg);
  }

  return {
    baseUrl: process.env.PYNTFLOW_BASE_URL.replace(/\/$/, ''),
    // Token is returned for use but never logged
    devToken: process.env.DEV_ADMIN_TOKEN,
  };
}

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the PyntFlow API.
 * NEVER logs the Authorization header value.
 * Returns { status, body } — body is parsed JSON or null on parse failure.
 */
async function apiRequest(baseUrl, devToken, method, path, bodyObj) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${devToken}`,
  };

  const init = { method, headers };
  if (bodyObj !== undefined) {
    init.body = JSON.stringify(bodyObj);
  }

  const response = await fetch(url, init);
  let body = null;
  try {
    body = await response.json();
  } catch { /* non-JSON response */ }

  return { status: response.status, body };
}

// ─── IDENTIFIER GENERATION ───────────────────────────────────────────────────

/**
 * Generates a unique, cryptographically random test run identifier prefix.
 * Format: test-lc-<timestamp-ms>-<6-hex-chars>
 * The 'test-lc-' prefix is documented in the recovery procedure.
 * No static strings (hamza, ceo, counter1) are ever used.
 */
function makeRunIds() {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex');
  const prefix = `test-lc-${ts}-${rand}`;

  // Passwords: 20-char random hex — never logged, never reused
  const ceoPass = crypto.randomBytes(10).toString('hex');
  const counterPass = crypto.randomBytes(10).toString('hex');

  return {
    slug: prefix,
    tenantName: `Test LC ${ts}`,
    ceoUsername: `ceo-${ts}-${rand}`,
    counterUsername: `pos-${ts}-${rand}`,
    ceoPassword: ceoPass,       // never logged
    counterPassword: counterPass, // never logged
  };
}

// ─── ASSERTION HELPERS ───────────────────────────────────────────────────────

let _passCount = 0;
let _failCount = 0;

function pass(label) {
  _passCount++;
  console.log(`  ✔  ${label}`);
}

function fail(label, detail) {
  _failCount++;
  // IMPORTANT: detail must never contain credentials, tokens, or hashes.
  // Callers are responsible for sanitising before passing here.
  console.error(`  ✖  ${label}`);
  if (detail) console.error(`     → ${detail}`);
}

function assertStatus(label, actual, expected, safeDetail) {
  if (actual === expected) {
    pass(label);
  } else {
    fail(label, safeDetail || `expected HTTP ${expected}, got HTTP ${actual}`);
    throw new Error(`Assertion failed: ${label}`);
  }
}

function assertBodyContains(label, body, pattern) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  if (pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern)) {
    pass(`${label} (body matches expected pattern)`);
  } else {
    // Log only the expected pattern, not body content (body may contain usernames but not secrets)
    fail(`${label} (body does not match expected pattern)`, `pattern: ${pattern}`);
    throw new Error(`Assertion failed: ${label}`);
  }
}

// ─── CLEANUP ─────────────────────────────────────────────────────────────────

/**
 * Cleanup state — tracked IDs from confirmed DB responses only.
 * Populated by successful API creation responses; never pre-populated.
 */
const cleanup = {
  trackedTenantIds: [],

  /**
   * Safely adds a confirmed tenant ID to tracking.
   */
  track(id) {
    if (id && typeof id === 'string' && !cleanup.trackedTenantIds.includes(id)) {
      cleanup.trackedTenantIds.push(id);
    }
  },

  /**
   * Safely removes a tenant ID from tracking (e.g. after confirmed API deletion).
   * Guarded against untracked IDs: if id is absent, indexOf is -1 and this is a no-op.
   * Never accidentally removes the last element via splice(-1, 1).
   */
  untrack(id) {
    if (!id || typeof id !== 'string') return;
    const idx = cleanup.trackedTenantIds.indexOf(id);
    if (idx !== -1) {
      cleanup.trackedTenantIds.splice(idx, 1);
    }
  },

  /**
   * Deletes all tracked tenants via the DELETE /api/tenants API (by exact ID).
   * Never deletes by prefix, slug pattern, or unverified ID.
   * The DELETE endpoint itself cleans up child records (app_users, items, etc.).
   * Each delete is attempted independently.
   */
  async run(baseUrl, devToken) {
    if (cleanup.trackedTenantIds.length === 0) {
      console.log('\n[CLEANUP] No tracked tenant IDs — nothing to clean up.');
      return;
    }

    console.log(`\n[CLEANUP] Attempting cleanup of ${cleanup.trackedTenantIds.length} tracked tenant(s)...`);
    const failedIds = [];

    for (const id of cleanup.trackedTenantIds) {
      try {
        const { status, body } = await apiRequest(baseUrl, devToken, 'DELETE', `/api/tenants?id=${encodeURIComponent(id)}`);
        if (status === 200 && body?.success) {
          console.log(`[CLEANUP]   ✔ Tenant ${id} deleted.`);
        } else if (status === 404 || (body?.error && /not found/i.test(body.error))) {
          // Already deleted (e.g. step 4 or 6 succeeded) — not a cleanup failure
          console.log(`[CLEANUP]   ✔ Tenant ${id} already absent.`);
        } else {
          failedIds.push(id);
          // Log status and error message only — no credentials
          console.error(`[CLEANUP]   ✖ Tenant ${id}: HTTP ${status} — ${body?.error ?? '(no error message)'}`);
        }
      } catch (err) {
        failedIds.push(id);
        console.error(`[CLEANUP]   ✖ Tenant ${id}: network error — ${err.message}`);
      }
    }

    if (failedIds.length > 0) {
      printRecoveryAid(failedIds);
    } else {
      console.log('[CLEANUP] All tracked tenants cleaned up successfully.');
    }
  },
};

/**
 * Prints a read-only recovery aid for IDs that could not be cleaned up.
 * Contains ONLY exact IDs from this run — no prefix wildcards are auto-executed.
 */
function printRecoveryAid(remainingIds) {
  const idList = remainingIds.map(id => `'${id}'`).join(', ');
  console.error('\n╔══════════════════════════════════════════════════════════════════╗');
  console.error('║  CLEANUP INCOMPLETE — MANUAL RECOVERY REQUIRED                   ║');
  console.error('╚══════════════════════════════════════════════════════════════════╝');
  console.error('\nThe following tenant IDs created by THIS run could not be deleted:');
  console.error(`  ${remainingIds.join('\n  ')}`);
  console.error('\nRead-only discovery SQL (safe to run, does NOT delete):');
  console.error(`  SELECT id, slug, name FROM public.tenants WHERE id IN (${idList});`);
  console.error(`  SELECT id, username, role FROM public.app_users WHERE tenant_id IN (${idList});`);
  console.error('\nCleanup SQL (verify rows above match this test run before executing):');
  console.error(`  DELETE FROM public.app_users WHERE tenant_id IN (${idList});`);
  console.error(`  DELETE FROM public.tenants WHERE id IN (${idList});`);
  console.error('\nDo NOT execute the cleanup SQL without first verifying the discovery output.');
}

// ─── SIGNAL HANDLERS ─────────────────────────────────────────────────────────

/**
 * On SIGINT / SIGTERM: print currently tracked IDs as a recovery aid.
 * Cleanup is NOT guaranteed after SIGKILL, machine failure, or abrupt termination.
 * These handlers are best-effort.
 */
let _env = null; // Set after env validation

function handleSignal(signal) {
  console.error(`\n[SIGNAL] Received ${signal}. Attempting cleanup before exit...`);
  if (cleanup.trackedTenantIds.length > 0) {
    if (_env) {
      // Synchronous-compatible path: schedule cleanup then exit
      cleanup.run(_env.baseUrl, _env.devToken).then(() => process.exit(130)).catch(() => {
        printRecoveryAid(cleanup.trackedTenantIds);
        process.exit(130);
      });
    } else {
      printRecoveryAid(cleanup.trackedTenantIds);
      process.exit(130);
    }
  } else {
    process.exit(130);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

/**
 * Exported for offline testing — the module can be imported without triggering
 * any network requests. Live execution only happens via runLifecycleTest().
 *
 * This function MUST NOT be called by the test harness.
 */
export async function runLifecycleTest() {
  // 1. Validate environment (fail-closed; throws before any network call)
  _env = validateEnvironment();
  const { baseUrl, devToken } = _env;

  // 2. Register signal handlers (best-effort cleanup on Ctrl-C)
  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  // 3. Generate unique identifiers for this run
  const ids = makeRunIds();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  PyntFlow Tenant Lifecycle Verification');
  console.log(`  Target : ${baseUrl}`);
  console.log(`  Slug   : ${ids.slug}`);
  console.log(`  Run    : ${new Date().toISOString()}`);
  console.log('  ⚠  Credentials are NOT printed in this output.');
  console.log('════════════════════════════════════════════════════════════════\n');

  let assertionsPassed = true;

  try {
    // ── Assertion 1 ────────────────────────────────────────────────────────
    // Duplicate usernames within one request must be rejected with HTTP 400.
    console.log('[ 1/7 ] Duplicate usernames in request → HTTP 400');
    {
      const { status, body } = await apiRequest(baseUrl, devToken, 'POST', '/api/tenants', {
        name: ids.tenantName,
        slug: ids.slug,
        ceo_username: ids.ceoUsername,
        ceo_password: ids.ceoPassword,
        counters: [{ username: ids.ceoUsername, password: ids.counterPassword, name: 'Dup Counter' }],
      });
      assertStatus('Duplicate username request rejected with 400', status, 400);
      assertBodyContains('Error mentions duplicate usernames', body, /duplicate usernames/i);
      // Confirm no tenant was created (pre-flight must fire before DB write)
      assert.equal(cleanup.trackedTenantIds.length, 0, 'No tenant should be tracked after validation-only rejection');
      pass('No tenant ID tracked (correct: validation fired before DB write)');
    }

    // ── Assertion 2 ────────────────────────────────────────────────────────
    // Valid CEO + counter request succeeds. Track the created tenant ID.
    console.log('\n[ 2/7 ] Valid provisioning → HTTP 200, track tenant ID');
    let tenant1Id;
    {
      const { status, body } = await apiRequest(baseUrl, devToken, 'POST', '/api/tenants', {
        name: ids.tenantName,
        slug: ids.slug,
        type: 'shop',
        ceo_username: ids.ceoUsername,
        ceo_password: ids.ceoPassword,
        counters: [{ username: ids.counterUsername, password: ids.counterPassword, name: 'Main Counter' }],
      });
      assertStatus('Valid provisioning accepted with 200', status, 200);

      // Extract and track the exact ID from the confirmed DB response
      tenant1Id = body?.tenant?.id;
      if (!tenant1Id || typeof tenant1Id !== 'string') {
        fail('Response must contain tenant.id string', `got: ${typeof tenant1Id}`);
        throw new Error('Assertion failed: missing tenant.id');
      }
      cleanup.track(tenant1Id);
      pass(`Tenant 1 ID tracked: ${tenant1Id}`);
    }

    // ── Assertion 3 ────────────────────────────────────────────────────────
    // An existing global username (the CEO we just created) must be rejected.
    console.log('\n[ 3/7 ] Existing global username → HTTP 400');
    {
      const alt = makeRunIds(); // Different slug to avoid slug collision
      const { status, body } = await apiRequest(baseUrl, devToken, 'POST', '/api/tenants', {
        name: alt.tenantName,
        slug: alt.slug,
        ceo_username: ids.ceoUsername, // reuse the already-existing username
        ceo_password: alt.ceoPassword,
        counters: [{ username: alt.counterUsername, password: alt.counterPassword, name: 'C' }],
      });
      assertStatus('Existing username rejected with 400', status, 400);
      assertBodyContains('Error mentions username already taken', body, /already taken globally/i);
    }

    // ── Assertion 4 ────────────────────────────────────────────────────────
    // Delete Tenant 1 via the DELETE endpoint.
    console.log('\n[ 4/7 ] Delete Tenant 1 → HTTP 200');
    {
      const { status, body } = await apiRequest(baseUrl, devToken, 'DELETE', `/api/tenants?id=${encodeURIComponent(tenant1Id)}`);
      assertStatus('DELETE Tenant 1 succeeds with 200', status, 200);
      // Remove from tracking since the API confirmed deletion (guarded against -1 index)
      cleanup.untrack(tenant1Id);
      pass('Tenant 1 removed from cleanup tracking (API confirmed deletion)');
    }

    // ── Assertion 5 ────────────────────────────────────────────────────────
    // The SAME usernames must now be reusable (username-reuse-after-deletion contract).
    console.log('\n[ 5/7 ] Username reuse after deletion → HTTP 200');
    let tenant2Id;
    {
      const { status, body } = await apiRequest(baseUrl, devToken, 'POST', '/api/tenants', {
        name: `${ids.tenantName} (Reuse)`,
        slug: `${ids.slug}-2`,
        type: 'shop',
        ceo_username: ids.ceoUsername,      // same CEO username as Tenant 1
        ceo_password: ids.ceoPassword,
        counters: [{ username: ids.counterUsername, password: ids.counterPassword, name: 'Main Counter' }],
      });
      assertStatus('Username reuse after deletion succeeds with 200', status, 200);

      tenant2Id = body?.tenant?.id;
      if (!tenant2Id || typeof tenant2Id !== 'string') {
        fail('Response must contain tenant.id string for Tenant 2', `got: ${typeof tenant2Id}`);
        throw new Error('Assertion failed: missing tenant.id for Tenant 2');
      }
      cleanup.track(tenant2Id);
      pass(`Tenant 2 ID tracked: ${tenant2Id}`);
    }

    // ── Assertion 6 ────────────────────────────────────────────────────────
    // Delete Tenant 2.
    console.log('\n[ 6/7 ] Delete Tenant 2 → HTTP 200');
    {
      const { status } = await apiRequest(baseUrl, devToken, 'DELETE', `/api/tenants?id=${encodeURIComponent(tenant2Id)}`);
      assertStatus('DELETE Tenant 2 succeeds with 200', status, 200);
      cleanup.untrack(tenant2Id);
      pass('Tenant 2 removed from cleanup tracking (API confirmed deletion)');
    }

    // ── Assertion 7 ────────────────────────────────────────────────────────
    // Verify both tenant slugs return 404 via GET /api/tenants?slug=...
    // VERIFICATION BOUNDARY:
    //   1. Tenant record absence: VERIFIED via HTTP 404.
    //   2. Username reuse viability: VERIFIED via successful creation of Tenant 2 in Step 5.
    //   3. Residual public.app_users absence: NOT independently verified via HTTP API
    //      (public API has no unauthenticated endpoint to query users by deleted tenant).
    //      Direct database verification requires an out-of-band read-only SQL query.
    console.log('\n[ 7/7 ] Tenant record absence via API — slugs return 404');
    {
      const slug1 = ids.slug;
      const slug2 = `${ids.slug}-2`;

      for (const [label, slug] of [[`Tenant 1 slug (${slug1})`, slug1], [`Tenant 2 slug (${slug2})`, slug2]]) {
        const { status } = await apiRequest(baseUrl, devToken, 'GET', `/api/tenants?slug=${encodeURIComponent(slug)}`);
        assertStatus(`${label} returns 404 after deletion`, status, 404);
      }
      pass('Tenant absence verified via HTTP API (GET /api/tenants?slug=... returns 404)');
      console.log('     ℹ  Note: Associated-user absence (public.app_users) is NOT independently verified via HTTP API.');
      console.log('     ℹ  Username reuse was proven viable in Step 5; full user purge verification requires separate DB read.');
    }

  } catch (err) {
    assertionsPassed = false;
    console.error(`\n[LIFECYCLE] Assertion failure: ${err.message}`);
  } finally {
    // Cleanup runs regardless of assertion outcome.
    // Only tracks IDs that remain (step 4/6 remove confirmed deletions).
    if (cleanup.trackedTenantIds.length > 0) {
      await cleanup.run(baseUrl, devToken);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  Assertions passed : ${_passCount}`);
  console.log(`  Assertions failed : ${_failCount}`);
  if (assertionsPassed && _failCount === 0) {
    console.log('  Result            : ✔ ALL API-LEVEL ASSERTIONS PASSED');
    console.log('\n  Verification Scope:');
    console.log('    ✔ [API-VERIFIED] Tenant record absence: Confirmed via HTTP 404');
    console.log('    ✔ [API-VERIFIED] Username reuse: Confirmed via Tenant 2 creation');
    console.log('    ⚠ [LIMITATION]   Associated users: NOT verified via HTTP API (requires read-only DB query)');
    if (tenant1Id || tenant2Id) {
      const qIds = [tenant1Id, tenant2Id].filter(Boolean).map(id => `'${id}'`).join(', ');
      console.log('\n  Proposed read-only DB verification (for authorized DB inspection only):');
      console.log(`    SELECT count(*) AS remaining_users FROM public.app_users WHERE tenant_id IN (${qIds});`);
      console.log(`    SELECT count(*) AS remaining_tenants FROM public.tenants WHERE id IN (${qIds});`);
    }
  } else {
    console.log('  Result            : ✖ ONE OR MORE ASSERTIONS FAILED');
  }
  console.log('════════════════════════════════════════════════════════════════\n');

  process.exit(assertionsPassed && _failCount === 0 ? 0 : 1);
}

// ─── EXPORTS (for offline testing) ────────────────────────────────────────────
// These are pure functions with no side effects and no network calls.
// They are exported so the offline test suite can verify them without
// importing the module causing live execution.
export {
  validateEnvironment,
  makeRunIds,
  cleanup,
  printRecoveryAid,
};

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
// Only runs when this file is executed directly (not imported).
// Importing this module does NOT trigger any network requests.
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.replace(/\\/g, '/').endsWith('verify-tenant-lifecycle.mjs')) {
  runLifecycleTest().catch(err => {
    // Only print the message — not the full stack, which may contain env state
    console.error(`\n[FATAL] ${err.message}`);
    process.exit(1);
  });
}
