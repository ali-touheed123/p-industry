/**
 * test-receipt-catalog-security.mjs — Master Receipt Catalog Route Security & Boundary Tests
 *
 * Target: http://localhost:3000/api/receipt-templates
 *
 * Verifies the Option A security model:
 * 1. Unauthenticated requests are rejected with HTTP 401 and exact error payload.
 * 2. Authenticated non-developer tenant users (staff, ceo) are rejected with HTTP 403.
 * 3. Authenticated developers (cookie and Bearer token) succeed with HTTP 200.
 * 4. Single-template lookup by valid UUID succeeds with HTTP 200.
 * 5. Single-template lookup with non-existent UUID returns HTTP 404.
 * 6. GET requests are strictly idempotent and cause zero database INSERTs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { readFileSync } from 'node:fs';

const BASE_URL = 'http://localhost:3000';
const ROUTE = '/api/receipt-templates';

// Load JWT secrets
let SESSION_SECRET = process.env.SESSION_SECRET;
let DEV_ADMIN_SECRET = process.env.DEV_ADMIN_SECRET;

if (!SESSION_SECRET || !DEV_ADMIN_SECRET) {
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
    // fallback to process.env
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

// JWT Factory helpers
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

// Server health check
let serverAvailable = false;
try {
  await fetch(`${BASE_URL}/api/receipt-templates`, {
    signal: AbortSignal.timeout(5000),
  });
  serverAvailable = true;
} catch (e) {
  console.error('\n⚠️  DEV SERVER UNREACHABLE AT', BASE_URL);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('T-CAT-01: Unauthenticated GET /api/receipt-templates returns HTTP 401 with exact error', { skip: !serverAvailable }, async () => {
  const { status, body } = await request('GET', ROUTE);
  assert.equal(status, 401, `Expected 401, got ${status}`);
  assert.equal(body.success, false, 'Expected success: false');
  assert.equal(body.error, 'Unauthorized: Authentication credentials required');
});

test('T-CAT-02: Tenant Staff session GET /api/receipt-templates returns HTTP 403 Forbidden', { skip: !serverAvailable }, async () => {
  const staffToken = await makeUserJwt({
    userId: 'test-staff-001',
    username: 'staff_user',
    role: 'staff',
    tenantId: '00000000-0000-0000-0000-ALPHA00ALPHA',
  });

  const { status, body } = await request('GET', ROUTE, {
    cookie: `${SESSION_COOKIE_NAME}=${staffToken}`,
  });
  assert.equal(status, 403, `Expected 403, got ${status}`);
  assert.equal(body.success, false, 'Expected success: false');
  assert.equal(body.error, 'Forbidden: Developer privileges required');
});

test('T-CAT-03: Tenant CEO session GET /api/receipt-templates returns HTTP 403 Forbidden', { skip: !serverAvailable }, async () => {
  const ceoToken = await makeUserJwt({
    userId: 'test-ceo-001',
    username: 'ceo_user',
    role: 'ceo',
    tenantId: '00000000-0000-0000-0000-ALPHA00ALPHA',
  });

  const { status, body } = await request('GET', ROUTE, {
    cookie: `${SESSION_COOKIE_NAME}=${ceoToken}`,
  });
  assert.equal(status, 403, `Expected 403, got ${status}`);
  assert.equal(body.success, false, 'Expected success: false');
  assert.equal(body.error, 'Forbidden: Developer privileges required');
});

test('T-CAT-04: Developer session (via cookie) GET /api/receipt-templates returns HTTP 200 with catalog array', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();

  const { status, body } = await request('GET', ROUTE, {
    cookie: `${DEV_ADMIN_COOKIE}=${devToken}`,
  });
  assert.equal(status, 200, `Expected 200, got ${status}. Body: ${JSON.stringify(body)}`);
  assert.equal(body.success, true, 'Expected success: true');
  assert.ok(Array.isArray(body.templates), 'Expected templates to be an array');
});

test('T-CAT-05: Developer session (via Authorization Bearer) GET /api/receipt-templates returns HTTP 200', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();

  const { status, body } = await request('GET', ROUTE, {
    authHeader: devToken,
  });
  assert.equal(status, 200, `Expected 200, got ${status}`);
  assert.equal(body.success, true, 'Expected success: true');
  assert.ok(Array.isArray(body.templates), 'Expected templates to be an array');
});

test('T-CAT-06: Developer GET /api/receipt-templates?id=<valid_id> returns HTTP 200 with template object', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();

  // First get a template ID from the list
  const listRes = await request('GET', ROUTE, { authHeader: devToken });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.templates.length > 0, 'Catalog should have at least 1 template');

  const validId = listRes.body.templates[0].id;
  const singleRes = await request('GET', `${ROUTE}?id=${validId}`, { authHeader: devToken });
  assert.equal(singleRes.status, 200, `Expected 200, got ${singleRes.status}`);
  assert.equal(singleRes.body.success, true);
  assert.equal(singleRes.body.template.id, validId);
  assert.ok(singleRes.body.template.name, 'Template must have a name');
});

test('T-CAT-07: Developer GET /api/receipt-templates?id=<non_existent_id> returns HTTP 404', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  const { status, body } = await request('GET', `${ROUTE}?id=${nonExistentId}`, { authHeader: devToken });
  assert.equal(status, 404, `Expected 404, got ${status}`);
  assert.equal(body.success, false);
  assert.equal(body.error, 'Template not found');
});

test('T-CAT-08: Developer GET /api/receipt-templates limit parameter works', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();

  const { status, body } = await request('GET', `${ROUTE}?limit=1`, { authHeader: devToken });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.templates.length <= 1, 'Limit=1 should return at most 1 template');
});

test('T-CAT-09: Idempotency & Side-Effect Check: GET requests cause zero database modifications', { skip: !serverAvailable }, async () => {
  const devToken = await makeDevJwt();

  // 1. Initial count
  const res1 = await request('GET', ROUTE, { authHeader: devToken });
  assert.equal(res1.status, 200);
  const countBefore = res1.body.templates.length;

  // 2. Multiple GET calls
  await request('GET', ROUTE, { authHeader: devToken });
  await request('GET', `${ROUTE}?limit=50`, { authHeader: devToken });

  // 3. Post count
  const res2 = await request('GET', ROUTE, { authHeader: devToken });
  assert.equal(res2.status, 200);
  const countAfter = res2.body.templates.length;

  assert.equal(countBefore, countAfter, 'Template count must remain strictly identical (zero side-effects)');
});
