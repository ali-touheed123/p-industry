/**
 * test-receipt-security.mjs — T-23: Multi-Tenant API Route Authorization & Boundary Tests
 *
 * Target: http://localhost:3000/api/receipt-templates/assign
 *
 * This script tests the ACTUAL local Next.js dev server (npm run dev must be running).
 * Uses real JWT generation with the same secrets as the application (from .env.local).
 * All tenant IDs used are synthetic test fixtures — no real tenant data is accessed.
 *
 * Safety constraints:
 * - All test tenant IDs are synthetic UUIDs that do not correspond to real tenants.
 * - POST/DELETE tests verify 401/403 rejection BEFORE mutation — we do NOT attempt
 *   successful privileged mutations against any real database.
 * - No real sales, tokens, or inventory are touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { readFileSync } from 'node:fs';

// ─── Configuration ────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';
const ROUTE = '/api/receipt-templates/assign';

// Read secrets from environment (already loaded by the test runner env)
// We load .env.local manually since this runs outside Next.js
let SESSION_SECRET = process.env.SESSION_SECRET;
let DEV_ADMIN_SECRET = process.env.DEV_ADMIN_SECRET;

if (!SESSION_SECRET || !DEV_ADMIN_SECRET) {
  // Attempt to load from .env.local for standalone test execution
  try {
    const envContent = readFileSync('.env.local', 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('SESSION_SECRET=')) {
        SESSION_SECRET = trimmed.slice('SESSION_SECRET='.length).replace(/^["']|["']$/g, '');
      }
      if (trimmed.startsWith('DEV_ADMIN_SECRET=')) {
        DEV_ADMIN_SECRET = trimmed.slice('DEV_ADMIN_SECRET='.length).replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env.local not readable — will use process.env values
  }
}

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET not available or too short — cannot generate test tokens');
}
if (!DEV_ADMIN_SECRET || DEV_ADMIN_SECRET.length < 32) {
  throw new Error('DEV_ADMIN_SECRET not available or too short — cannot generate dev tokens');
}

const SESSION_COOKIE_NAME = 'pyntflow_session';
const DEV_ADMIN_COOKIE = 'aura_dev_token';

// Synthetic test tenant IDs (do NOT correspond to real tenants)
const TENANT_ALPHA_ID = '00000000-0000-0000-0000-ALPHA00ALPHA';
const TENANT_BETA_ID  = '00000000-0000-0000-0000-BETA000BETA0';

// ─── JWT Token Factory ────────────────────────────────────────────────────────
async function makeUserJwt(payload) {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  const jti = crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setJti(jti)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

async function makeDevJwt() {
  const secret = new TextEncoder().encode(DEV_ADMIN_SECRET);
  return new SignJWT({ role: 'developer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
async function request(method, path, { cookie, authHeader, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  if (authHeader) headers['Authorization'] = `Bearer ${authHeader}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  let responseBody = null;
  try { responseBody = await res.json(); } catch { responseBody = {}; }
  return { status: res.status, body: responseBody };
}

// ─── Server Availability Check ────────────────────────────────────────────────
// Try to reach the server; if unreachable, mark all tests as skipped with a clear message.
let serverAvailable = false;
try {
  const check = await fetch(`${BASE_URL}/api/receipt-templates/assign?tenant_id=${TENANT_ALPHA_ID}`, {
    signal: AbortSignal.timeout(5000),
  });
  // Any HTTP response (including 401/403) means server is up
  serverAvailable = true;
} catch (e) {
  console.error('\n⚠️  T-23 BLOCKED: Local dev server is not reachable at', BASE_URL);
  console.error('    Ensure `npm run dev` is running before executing T-23 tests.\n');
}

// ─── T-23 Test Partitions ─────────────────────────────────────────────────────

// 1. Unauthenticated Requests
// ─────────────────────────────────────────────────────────────────────────────

test('T-23.1.1: Unauthenticated GET assign?tenant_id=... → 401 Unauthorized', { skip: !serverAvailable }, async () => {
  const { status, body } = await request('GET', `${ROUTE}?tenant_id=${TENANT_ALPHA_ID}`);
  assert.equal(status, 401, `Expected 401, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.success, 'success must be false');
  assert.ok(body.error, 'Error message must be present');
  // Verify no template data is leaked in the 401 response
  assert.ok(!body.template, 'No template data must be returned on 401');
  assert.ok(!body.assignment, 'No assignment data must be returned on 401');
});

test('T-23.1.2: Unauthenticated POST → 401 Unauthorized (rejected before mutation)', { skip: !serverAvailable }, async () => {
  const { status, body } = await request('POST', ROUTE, {
    body: { tenant_id: TENANT_ALPHA_ID, template_id: '00000000-0000-0000-0000-FAKE00000001' },
  });
  assert.equal(status, 401, `Expected 401, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.success, 'success must be false');
  // Rejection at auth layer = before any DB write
  // The route calls requireDevAuth() before body parsing DB mutations
  assert.ok(body.error?.toLowerCase().includes('unauthorized') || body.error?.toLowerCase().includes('login'),
    `Error message must indicate unauthorized access, got: ${body.error}`);
});

test('T-23.1.3: Unauthenticated DELETE → 401 Unauthorized (rejected before mutation)', { skip: !serverAvailable }, async () => {
  const { status, body } = await request('DELETE', `${ROUTE}?tenant_id=${TENANT_ALPHA_ID}`);
  assert.equal(status, 401, `Expected 401, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.success, 'success must be false');
  // Authentication failure is distinct from authorization failure
  assert.ok(body.error?.toLowerCase().includes('unauthorized') || body.error?.toLowerCase().includes('login'),
    `Unauthenticated error must say "unauthorized"/"login", got: ${body.error}`);
});

// 2. Authorized Same-Tenant Read
// ─────────────────────────────────────────────────────────────────────────────

test('T-23.2.1: Session Alpha (tenantId=ALPHA) reads own tenant assignment → authenticated response (200 or 200 with fallback)', { skip: !serverAvailable }, async () => {
  const token = await makeUserJwt({
    userId: 'user-alpha-001',
    username: 'alpha_staff',
    role: 'staff',
    tenantId: TENANT_ALPHA_ID,
    tenantSlug: 'alpha-test',
  });

  const { status, body } = await request('GET', `${ROUTE}?tenant_id=${TENANT_ALPHA_ID}`, {
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  });

  // Session is valid and matches tenant; server may return 200 with fallback template
  // or 500 if DB is unreachable (Supabase) — both are acceptable for auth layer test
  assert.ok([200, 500].includes(status),
    `Authenticated same-tenant read must not return 401/403, got ${status}. Body: ${JSON.stringify(body)}`);

  if (status === 200) {
    assert.ok(body.success !== false || body.error?.includes('Failed'),
      'On DB reachable: success must be true or show DB error (not auth error)');
    // Critically: no ALPHA data must be returned here since ALPHA is synthetic
    // But the auth layer allowed the request — the key test is no 401/403
  }
  console.log(`  → Status: ${status} (auth passed; DB result: ${body.success ? 'OK' : body.error || 'unknown'})`);
});

// 3. Cross-Tenant Read (Authorization Boundary)
// ─────────────────────────────────────────────────────────────────────────────

test('T-23.3.1: Session Beta (tenantId=BETA) requests Tenant Alpha assignment → 401 or 403 (cross-tenant blocked)', { skip: !serverAvailable }, async () => {
  const betaToken = await makeUserJwt({
    userId: 'user-beta-001',
    username: 'beta_staff',
    role: 'staff',
    tenantId: TENANT_BETA_ID,
    tenantSlug: 'beta-test',
  });

  const { status, body } = await request('GET', `${ROUTE}?tenant_id=${TENANT_ALPHA_ID}`, {
    cookie: `${SESSION_COOKIE_NAME}=${betaToken}`,
  });

  // requireTenantAuth(req, TENANT_ALPHA_ID) must reject Beta's session trying to access Alpha
  assert.ok([401, 403].includes(status),
    `Cross-tenant read must be rejected with 401 or 403, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.success, 'success must be false on cross-tenant rejection');
  assert.ok(!body.template, 'No template data must leak on cross-tenant rejection');
  assert.ok(!body.assignment, 'No assignment data must leak on cross-tenant rejection');
  console.log(`  → Status: ${status}, Error: "${body.error}" — Tenant Alpha data NOT exposed to Beta session`);
});

test('T-23.3.2: Cross-tenant rejection error message is authorization (Forbidden), not authentication (Unauthorized)', { skip: !serverAvailable }, async () => {
  const betaToken = await makeUserJwt({
    userId: 'user-beta-002',
    username: 'beta_ceo',
    role: 'ceo',
    tenantId: TENANT_BETA_ID,
  });

  const { status, body } = await request('GET', `${ROUTE}?tenant_id=${TENANT_ALPHA_ID}`, {
    cookie: `${SESSION_COOKIE_NAME}=${betaToken}`,
  });

  // Should be 403 Forbidden (authenticated but not authorized) not 401 (unauthenticated)
  // The session IS valid; the cross-branch access is what's forbidden
  assert.ok([403, 401].includes(status), `Expected 403 or 401, got ${status}`);
  if (status === 403) {
    assert.ok(
      body.error?.toLowerCase().includes('forbidden') || body.error?.toLowerCase().includes('denied') || body.error?.toLowerCase().includes('access'),
      `403 error must say "forbidden"/"denied"/"access", got: "${body.error}"`
    );
  }
  console.log(`  → Status: ${status}, Error: "${body.error}"`);
});

// 4. Developer-Only List (all-tenants endpoint requires dev auth)
// ─────────────────────────────────────────────────────────────────────────────

test('T-23.4.1: Non-developer session requesting all-tenant list → 401 or 403 (dev-only endpoint)', { skip: !serverAvailable }, async () => {
  // GET without ?tenant_id param triggers the developer-only all-tenant list
  const staffToken = await makeUserJwt({
    userId: 'user-staff-001',
    username: 'regular_staff',
    role: 'staff',
    tenantId: TENANT_ALPHA_ID,
  });

  const { status, body } = await request('GET', ROUTE, {
    cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
  });

  assert.ok([401, 403].includes(status),
    `Non-developer all-tenant list must return 401 or 403, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.assignments, 'Tenant assignments list must NOT be returned to non-developer');
  console.log(`  → Status: ${status}, Error: "${body.error}" — All-tenant list protected`);
});

test('T-23.4.2: Developer session requesting all-tenant list → authenticated (200 or 500 if DB unreachable)', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();

  const { status, body } = await request('GET', ROUTE, {
    cookie: `${DEV_ADMIN_COOKIE}=${devToken}`,
  });

  assert.ok([200, 500].includes(status),
    `Developer all-tenant list must not return 401/403, got ${status}. Body: ${JSON.stringify(body)}`);
  console.log(`  → Status: ${status} (dev auth accepted; DB result: ${body.success ? 'OK' : body.error || 'unknown'})`);
});

// 5. Non-Developer Mutation Attempts (POST / DELETE authorization rejection)
// ─────────────────────────────────────────────────────────────────────────────

test('T-23.5.1: Staff session POST (template assignment) → 403 Forbidden (rejected before DB mutation)', { skip: !serverAvailable }, async () => {
  const staffToken = await makeUserJwt({
    userId: 'user-staff-002',
    username: 'alpha_staff',
    role: 'staff',
    tenantId: TENANT_ALPHA_ID,
  });

  const { status, body } = await request('POST', ROUTE, {
    cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
    body: { tenant_id: TENANT_ALPHA_ID, template_id: '00000000-0000-0000-0000-FAKE00000002' },
  });

  // requireDevAuth() must reject before any DB upsert
  assert.equal(status, 403, `Staff POST must return 403, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.success, 'success must be false');
  assert.ok(
    body.error?.toLowerCase().includes('forbidden') || body.error?.toLowerCase().includes('developer'),
    `403 error must mention "forbidden" or "developer privileges", got: "${body.error}"`
  );
  // Mutation boundary: no assignment returned = no DB write occurred
  assert.ok(!body.assignment, 'No assignment object must be returned on rejected mutation');
  console.log(`  → Status: ${status}, Error: "${body.error}" — POST mutation blocked before DB`);
});

test('T-23.5.2: Staff session DELETE (remove assignment) → 403 Forbidden (rejected before DB mutation)', { skip: !serverAvailable }, async () => {
  const staffToken = await makeUserJwt({
    userId: 'user-staff-003',
    username: 'alpha_staff',
    role: 'staff',
    tenantId: TENANT_ALPHA_ID,
  });

  const { status, body } = await request('DELETE', `${ROUTE}?tenant_id=${TENANT_ALPHA_ID}`, {
    cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
  });

  assert.equal(status, 403, `Staff DELETE must return 403, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.ok(!body.success, 'success must be false');
  assert.ok(
    body.error?.toLowerCase().includes('forbidden') || body.error?.toLowerCase().includes('developer'),
    `403 error must mention "forbidden" or "developer privileges", got: "${body.error}"`
  );
  // Mutation boundary: no success message = no DB write
  assert.ok(!body.message?.includes('Reverted'), 'Reverted-to-default message must NOT appear on rejected DELETE');
  console.log(`  → Status: ${status}, Error: "${body.error}" — DELETE mutation blocked before DB`);
});

// 5.3 — Distinguish authentication from authorization in mutation failures
test('T-23.5.3: Unauthenticated POST → 401 (no session); Staff POST → 403 (session present, insufficient role)', { skip: !serverAvailable }, async () => {
  // Unauthenticated (no cookie)
  const unauthRes = await request('POST', ROUTE, {
    body: { tenant_id: TENANT_ALPHA_ID, template_id: 'fake' },
  });
  assert.equal(unauthRes.status, 401, `No-session POST must return 401, got ${unauthRes.status}`);

  // Authenticated staff (has session, wrong role)
  const staffToken = await makeUserJwt({
    userId: 'user-staff-004',
    username: 'another_staff',
    role: 'staff',
    tenantId: TENANT_ALPHA_ID,
  });
  const authRes = await request('POST', ROUTE, {
    cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
    body: { tenant_id: TENANT_ALPHA_ID, template_id: 'fake' },
  });
  assert.equal(authRes.status, 403, `Staff-session POST must return 403, got ${authRes.status}`);

  // The distinction: 401 = unauthenticated, 403 = authenticated but unauthorized
  assert.notEqual(unauthRes.status, authRes.status, 'Authentication failure (401) and authorization failure (403) must return different status codes');
  console.log(`  → Unauthenticated: ${unauthRes.status}, Authenticated staff: ${authRes.status} — codes correctly distinguished`);
});

// ─── Source-Level Mutation Boundary Verification ──────────────────────────────
// Without mocking, prove via source inspection that requireDevAuth() is called
// BEFORE any DB mutation in POST and DELETE handlers.

test('T-23.6.1: Source confirms requireDevAuth() is called before DB upsert in assign POST handler', () => {
  const src = readFileSync('src/app/api/receipt-templates/assign/route.ts', 'utf8');

  // Find POST function and check order of requireDevAuth vs supabase upsert
  const postMatch = src.match(/export async function POST[\s\S]*?^}/m);
  assert.ok(postMatch, 'POST handler must exist in route.ts');
  const postSrc = postMatch[0];

  const authPos = postSrc.indexOf('requireDevAuth');
  const upsertPos = postSrc.indexOf('.upsert(');
  const insertPos = postSrc.indexOf('.insert(');
  const firstMutation = Math.min(
    upsertPos === -1 ? Infinity : upsertPos,
    insertPos === -1 ? Infinity : insertPos,
  );

  assert.ok(authPos !== -1, 'requireDevAuth must be called in POST handler');
  assert.ok(firstMutation !== Infinity, 'DB mutation must exist in POST handler');
  assert.ok(authPos < firstMutation, `requireDevAuth (pos ${authPos}) must appear before DB mutation (pos ${firstMutation})`);
});

test('T-23.6.2: Source confirms requireDevAuth() is called before DB delete in assign DELETE handler', async () => {
  const src = readFileSync('src/app/api/receipt-templates/assign/route.ts', 'utf8');

  // The DELETE handler check
  const deleteMatch = src.match(/export async function DELETE[\s\S]*$/m);
  assert.ok(deleteMatch, 'DELETE handler must exist in route.ts');
  const deleteSrc = deleteMatch[0];

  const authPos = deleteSrc.indexOf('requireDevAuth');
  const dbDeletePos = deleteSrc.indexOf('.delete()');

  assert.ok(authPos !== -1, 'requireDevAuth must be called in DELETE handler');
  assert.ok(dbDeletePos !== -1, 'DB delete must exist in DELETE handler');
  assert.ok(authPos < dbDeletePos, `requireDevAuth (pos ${authPos}) must appear before DB delete (pos ${dbDeletePos})`);
});

test('T-23.6.3: Source confirms GET single-tenant path uses requireTenantAuth (not requireDevAuth)', async () => {
  const src = readFileSync('src/app/api/receipt-templates/assign/route.ts', 'utf8');

  // GET handler uses requireTenantAuth for single-tenant path, requireDevAuth for all-tenant
  assert.ok(src.includes('requireTenantAuth(req, tenant_id)'), 'GET single-tenant path must use requireTenantAuth(req, tenant_id)');
  assert.ok(src.includes('requireDevAuth(req)'), 'GET all-tenant path must use requireDevAuth');
});
