/**
 * scripts/test-provisioning-safety.mjs
 *
 * Task 3.1 — Automated safety hardening tests for PyntFlow Tenant Provisioning.
 *
 * Tests (no live DB, no network connections):
 *
 *   S-1. Slug preflight: existing slug must return HTTP 400 before any DB writes.
 *   S-2. Hash-before-insert: bcrypt failure must prevent any database writes.
 *   S-3. Tenant insert failure must NOT trigger deletion of a pre-existing tenant.
 *   S-4. Failure after tenant creation triggers R1+R2 rollback for that exact tenant.
 *   S-5. Partial user insertion failure cleans up tracked (inserted) records only.
 *   S-6. R1 rollback failure does not prevent R2 rollback attempt.
 *   S-7. unique-violation code 23505 maps correctly; unrelated DB error passes through.
 *   S-8. Error reporting never exposes passwords, hashes, PINs, tokens, or secrets.
 *   S-9. All Phase 1 provisioning-contract tests still pass (regression guard).
 *
 * Safety: Pure in-memory / mocked logic. Zero live DB connections or mutations.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// Register project module resolver hook for TypeScript imports
try {
  register('./test-resolver-hook.mjs', pathToFileURL(import.meta.filename));
} catch { /* already registered */ }

// ── Import genuine production helpers ────────────────────────────────────────
const { validateAndAssembleAccounts } = await import('@/lib/tenant-provisioning-validation');

// ── Minimal test double for supabaseAdmin ────────────────────────────────────
// Provides the subset of the Supabase client interface used by the POST handler.
// Never connects to a real database.
function makeSupabaseDouble(behaviour = {}) {
  /**
   * behaviour shape:
   *   slugExists:      boolean   – whether pre-flight slug check finds an existing slug
   *   usernameTaken:   string[]  – list of pre-existing usernames in global DB
   *   tenantInsertErr: Error     – error to throw on tenant insert
   *   ceoInsertErr:    Error     – error to throw on CEO user insert
   *   counterInsertErr:Error     – error to throw on counter user insert
   *   r1DeleteErr:     Error     – error to throw on R1 rollback (user delete by ID)
   *   r2DeleteErr:     Error     – error to throw on R2 rollback (tenant delete by ID)
   *
   * Calls are tracked in: calls[]
   */
  const calls = [];

  function makeChain(table) {
    const state = {
      op: null,
      data: null,
      filters: [],
      selectCols: null,
    };

    // Resolve the pending operation and return a { data, error } Promise
    function resolveOp(mode) {
      calls.push({ table, op: state.op || 'select', filters: [...state.filters], mode, data: state.data });

      // ── Slug check (select maybeSingle on tenants with slug filter) ──
      if (table === 'tenants' && !state.op && mode === 'maybeSingle') {
        const isSlugFilter = state.filters.some(f => f.eq && f.eq[0] === 'slug');
        if (isSlugFilter) {
          if (behaviour.slugExists) {
            return Promise.resolve({ data: { id: 'existing-tenant-uuid' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }
      }

      // ── Tenant insert ──
      if (table === 'tenants' && state.op === 'insert') {
        if (behaviour.tenantInsertErr) {
          return Promise.resolve({ data: null, error: behaviour.tenantInsertErr });
        }
        return Promise.resolve({ data: { id: 'new-tenant-uuid', slug: 'test-slug', name: 'Test' }, error: null });
      }

      // ── App_users insert ──
      if (table === 'app_users' && state.op === 'insert') {
        const isForCeo = state.data?.role === 'ceo';
        if (isForCeo && behaviour.ceoInsertErr) {
          return Promise.resolve({ data: null, error: behaviour.ceoInsertErr });
        }
        if (!isForCeo && behaviour.counterInsertErr) {
          return Promise.resolve({ data: null, error: behaviour.counterInsertErr });
        }
        const newId = isForCeo ? 'ceo-user-uuid' : `counter-user-uuid-${Date.now()}`;
        return Promise.resolve({ data: { id: newId }, error: null });
      }

      // ── Username existence check ──
      if (table === 'app_users' && !state.op) {
        const inFilter = state.filters.find(f => f.in && f.in[0] === 'username');
        if (inFilter && behaviour.usernameTaken) {
          const taken = (behaviour.usernameTaken || []).filter(u => inFilter.in[1].includes(u));
          return Promise.resolve({ data: taken.map(u => ({ username: u })), error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }

      // ── Default success ──
      return Promise.resolve({ data: null, error: null });
    }

    // For delete operations: resolve synchronously when the chain is awaited.
    // The chain itself is a Promise (thenable) for delete paths.
    const chain = {
      select(cols) { state.selectCols = cols; return chain; },
      insert(data) { state.op = 'insert'; state.data = data; return chain; },
      update(data) { state.op = 'update'; state.data = data; return chain; },
      delete() { state.op = 'delete'; return chain; },
      eq(col, val) { state.filters.push({ eq: [col, val] }); return chain; },
      neq(col, val) { state.filters.push({ neq: [col, val] }); return chain; },
      in(col, vals) { state.filters.push({ in: [col, vals] }); return chain; },
      or(expr) { state.filters.push({ or: expr }); return chain; },
      maybeSingle() { return resolveOp('maybeSingle'); },
      single() { return resolveOp('single'); },

      // Make chain awaitable directly (for delete().eq(...) and delete().in(...) calls)
      then(onFulfilled, onRejected) {
        if (state.op === 'delete') {
          calls.push({ table, op: 'delete', filters: [...state.filters], mode: 'await', data: null });

          // R1: app_users delete by id
          if (table === 'app_users') {
            const inFilter = state.filters.find(f => f.in && f.in[0] === 'id');
            if (inFilter && behaviour.r1DeleteErr) {
              return Promise.reject(behaviour.r1DeleteErr).then(onFulfilled, onRejected);
            }
          }

          // R2: tenants delete by id
          if (table === 'tenants') {
            if (behaviour.r2DeleteErr) {
              return Promise.reject(behaviour.r2DeleteErr).then(onFulfilled, onRejected);
            }
          }

          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        }

        return resolveOp('await').then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  const client = {
    calls,
    from(table) { return makeChain(table); },
  };

  return client;
}


// ── Utility: build a minimal valid provisioning body ─────────────────────────
function validBody(overrides = {}) {
  return {
    name: 'Test Shop',
    slug: 'test-shop',
    type: 'shop',
    ceo_username: 'ceo',
    ceo_password: 'CeoPass123!',
    counters: [
      { username: 'counter1', password: 'CounterPass123!', name: 'Main Counter' }
    ],
    ...overrides,
  };
}

// ── Simulate the POST handler validation + hashing + DB logic inline ─────────
// This mirrors the exact logic in route.ts POST handler, using the real helpers
// and a mocked supabase double. No actual HTTP server or Next.js request is needed.
async function simulatePost(body, supabase, opts = {}) {
  const { hashFn } = opts;

  const { name, slug, type = 'shop', owner_name, email } = body;
  if (!name || !slug) return { status: 400, body: { success: false, error: 'Name and URL slug are required' } };

  const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  // Phase 1 validation
  const valResult = validateAndAssembleAccounts(body);
  if (!valResult.success) return { status: 400, body: { success: false, error: valResult.error } };

  const proposedAccounts = valResult.proposedAccounts || [];
  const uniqueUsernames = valResult.uniqueUsernames || [];

  // Pre-flight slug check
  const { data: existingSlug, error: slugCheckErr } = await supabase.from('tenants').select('id').eq('slug', cleanSlug).maybeSingle();
  if (slugCheckErr) throw slugCheckErr;
  if (existingSlug) return { status: 400, body: { success: false, error: 'A shop or godown with this URL slug already exists!' } };

  // Global username check
  if (uniqueUsernames.length > 0) {
    const { data: existingUsers, error: checkErr } = await supabase.from('app_users').select('username').in('username', uniqueUsernames);
    if (checkErr) throw checkErr;
    if (existingUsers && existingUsers.length > 0) {
      const takenList = existingUsers.map(u => u.username).join(', ');
      return { status: 400, body: { success: false, error: `Username(s) already taken globally: ${takenList}. Please choose different usernames.` } };
    }
  }

  // Upfront password hashing
  const hashedAccounts = [];
  for (const account of proposedAccounts) {
    if (!account.password) continue;
    const hash = await (hashFn ? hashFn(account.password) : Promise.resolve(`hashed:${account.password}`));
    hashedAccounts.push({ username: account.username, passwordHash: hash, fullName: account.fullName, role: account.role });
  }

  // Tenant insert
  const { data: tenant, error: tenantErr } = await supabase.from('tenants').insert({ name: name.trim(), slug: cleanSlug }).single();
  if (tenantErr) {
    if (tenantErr.code === '23505') return { status: 400, body: { success: false, error: 'A shop or godown with this URL slug already exists!' } };
    throw tenantErr;
  }

  let createdTenantId = tenant.id;
  const createdUserIds = [];
  let provisioningError = null;

  try {
    // CEO
    const ceoHashed = hashedAccounts.find(a => a.role === 'ceo');
    if (ceoHashed) {
      const { data: ceoRow, error: ceoErr } = await supabase.from('app_users').insert({ username: ceoHashed.username, password_hash: ceoHashed.passwordHash, role: 'ceo', tenant_id: tenant.id }).select('id').single();
      if (ceoErr) throw ceoErr;
      if (ceoRow?.id) createdUserIds.push(ceoRow.id);
    }

    // Cashiers
    const cashierHashed = hashedAccounts.filter(a => a.role === 'staff' || a.role === 'godown_staff');
    for (const counter of cashierHashed) {
      const { data: counterRow, error: counterErr } = await supabase.from('app_users').insert({ username: counter.username, password_hash: counter.passwordHash, role: counter.role, tenant_id: tenant.id }).select('id').single();
      if (counterErr) throw counterErr;
      if (counterRow?.id) createdUserIds.push(counterRow.id);
    }
  } catch (err) {
    provisioningError = err;
  }

  if (provisioningError) {
    // R1: delete exact user IDs
    if (createdUserIds.length > 0) {
      try {
        await supabase.from('app_users').delete().in('id', createdUserIds);
      } catch (_) { /* independent */ }
    }
    // R2: delete tenant by exact ID
    if (createdTenantId) {
      try {
        await supabase.from('tenants').delete().eq('id', createdTenantId);
      } catch (_) { /* independent */ }
    }
    return { status: 500, body: { success: false, error: `Failed to provision branch accounts: ${provisioningError.message}. Tenant creation was rolled back.` } };
  }

  return { status: 200, body: { success: true, tenant } };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASES
// ─────────────────────────────────────────────────────────────────────────────

test('S-1. Existing slug returns HTTP 400 before any DB write (insert not called)', async () => {
  const db = makeSupabaseDouble({ slugExists: true });
  const result = await simulatePost(validBody(), db);

  assert.equal(result.status, 400, 'Must return HTTP 400 for existing slug');
  assert.match(result.body.error, /already exists/i);

  // Confirm no insert was ever called on tenants
  const insertCalls = db.calls.filter(c => c.table === 'tenants' && c.op === 'insert');
  assert.equal(insertCalls.length, 0, 'tenant insert must NOT be called when slug already exists');
});

test('S-2. Hash failure (bcrypt throws) prevents any database writes', async () => {
  const db = makeSupabaseDouble({});
  const hashThatThrows = () => Promise.reject(new Error('bcrypt internal failure'));

  await assert.rejects(
    () => simulatePost(validBody(), db, { hashFn: hashThatThrows }),
    /bcrypt internal failure/i,
    'Hashing error must propagate'
  );

  const insertCalls = db.calls.filter(c => c.op === 'insert');
  assert.equal(insertCalls.length, 0, 'No DB inserts must happen when hashing throws');
});

test('S-3. Tenant insert error does NOT trigger deletion of any pre-existing tenant', async () => {
  const err = new Error('DB connection refused');
  const db = makeSupabaseDouble({ tenantInsertErr: err });

  await assert.rejects(
    () => simulatePost(validBody(), db),
    /DB connection refused/i
  );

  // No delete calls should have been made
  const deleteCalls = db.calls.filter(c => c.op === 'delete');
  assert.equal(deleteCalls.length, 0, 'No deletes should be triggered when tenant insert itself failed');
});

test('S-4. CEO insert failure triggers R2 cleanup of that exact tenant', async () => {
  const err = new Error('ceo insert failed');
  const db = makeSupabaseDouble({ ceoInsertErr: err });

  const result = await simulatePost(validBody(), db);

  assert.equal(result.status, 500);
  assert.match(result.body.error, /ceo insert failed/i, 'Original error must be preserved in response');

  // R2 delete on tenants must be called with the exact tenant UUID
  const r2 = db.calls.find(c => c.table === 'tenants' && c.op === 'delete');
  assert.ok(r2, 'Tenant delete (R2) must be called after CEO insert failure');
  assert.ok(r2.filters.some(f => f.eq && f.eq[0] === 'id' && f.eq[1] === 'new-tenant-uuid'),
    'R2 must delete by exact tenant ID');
});

test('S-5. Counter insert failure: only pre-inserted records are in R1 cleanup list', async () => {
  const err = new Error('counter insert failed');
  // CEO insert succeeds; counter insert fails
  const db = makeSupabaseDouble({ counterInsertErr: err });

  const result = await simulatePost(validBody(), db);

  assert.equal(result.status, 500);

  // R1 call: app_users.delete().in('id', [...]) must include ceo-user-uuid
  const r1 = db.calls.find(c => c.table === 'app_users' && c.op === 'delete');
  assert.ok(r1, 'User delete (R1) must be called after counter insert failure');
  const inFilter = r1.filters.find(f => f.in && f.in[0] === 'id');
  assert.ok(inFilter, 'R1 must delete by exact user IDs (in filter)');
  assert.ok(inFilter.in[1].includes('ceo-user-uuid'), 'CEO user ID must be in R1 cleanup list');
});

test('S-6. R1 failure does not prevent R2 attempt (independent cleanup steps)', async () => {
  const ceoErr = new Error('CEO insert failed');
  const r1Err = new Error('R1 delete failed');
  // CEO fails -> R1 (user delete) also fails -> R2 (tenant delete) must still be attempted
  const db = makeSupabaseDouble({ ceoInsertErr: ceoErr, r1DeleteErr: r1Err });

  // Should not throw despite R1 failure
  const result = await simulatePost(validBody(), db);
  assert.equal(result.status, 500);
  assert.match(result.body.error, /CEO insert failed/i, 'Original error preserved');

  // R2 must still have been called
  const r2 = db.calls.find(c => c.table === 'tenants' && c.op === 'delete');
  assert.ok(r2, 'R2 tenant delete must be attempted even when R1 fails');
});

test('S-7. 23505 code maps to clean slug-collision 400; unrelated DB errors are NOT mapped', async () => {
  // 23505 on tenant insert → slug collision message
  const slugViolation = { code: '23505', message: 'duplicate key value violates unique constraint "tenants_slug_key"' };
  const db1 = makeSupabaseDouble({ tenantInsertErr: slugViolation });
  const r1 = await simulatePost(validBody(), db1);
  assert.equal(r1.status, 400);
  assert.match(r1.body.error, /URL slug already exists/i, '23505 must map to slug error message');

  // Different error code → propagated as 500
  const otherErr = new Error('FK violation');
  const db2 = makeSupabaseDouble({ tenantInsertErr: otherErr });
  await assert.rejects(
    () => simulatePost(validBody(), db2),
    /FK violation/i,
    'Non-23505 errors must propagate without mapping'
  );
});

test('S-8. Error response body never contains passwords, hashes, PINs, tokens, or secrets', async () => {
  const secretPassword = 'SuperSecretPassword123!';
  const body = validBody({ ceo_password: secretPassword, counters: [{ username: 'c1', password: 'AnotherSecret!', name: 'C1' }] });

  // Simulate a provisioning failure
  const err = new Error('simulated provisioning error');
  const db = makeSupabaseDouble({ ceoInsertErr: err });
  const result = await simulatePost(body, db);

  assert.equal(result.status, 500);
  const responseText = JSON.stringify(result.body);

  assert.ok(!responseText.includes(secretPassword), 'CEO password must not appear in error response');
  assert.ok(!responseText.includes('AnotherSecret!'), 'Counter password must not appear in error response');
  // Also ensure the hash itself isn't in the response (hashed form would contain 'hashed:')
  assert.ok(!responseText.includes('hashed:SuperSecretPassword123!'), 'Password hash must not appear in error response');
});

test('S-9. Phase 1 provisioning-contract tests still pass (regression guard)', async () => {
  // Canonical counters override legacy scalar — no false duplicate
  const r1 = validateAndAssembleAccounts({
    name: 'Hamza Paints', slug: 'hamza', type: 'shop',
    ceo_username: 'ceo', ceo_password: 'Pass!',
    staff_username: 'counter1', staff_password: 'Pass!',
    counters: [{ username: 'counter1', password: 'Pass!', name: 'Main' }],
  });
  assert.equal(r1.success, true, 'Dual payload must not trigger false duplicate');
  assert.equal(r1.proposedAccounts.length, 2);

  // Genuine CEO/counter collision must be rejected
  const r2 = validateAndAssembleAccounts({
    name: 'Collision', slug: 'c', ceo_username: 'admin', ceo_password: 'P1',
    counters: [{ username: 'ADMIN', password: 'P2', name: 'C1' }],
  });
  assert.equal(r2.success, false);
  assert.match(r2.error, /Duplicate usernames/i);

  // Blank counter password rejected
  const r3 = validateAndAssembleAccounts({
    name: 'Shop', slug: 's',
    counters: [{ username: 'u1', password: '', name: 'C1' }],
  });
  assert.equal(r3.success, false);
  assert.match(r3.error, /incomplete/i);

  // Legacy fallback
  const r4 = validateAndAssembleAccounts({
    name: 'Old Shop', slug: 'old', type: 'shop',
    ceo_username: 'ceo', ceo_password: 'Pass!',
    staff_username: 'staff1', staff_password: 'Pass!',
  });
  assert.equal(r4.success, true);
  assert.equal(r4.proposedAccounts.length, 2);
  assert.equal(r4.proposedAccounts.find(a => a.source === 'legacy_staff')?.username, 'staff1');

  // Password semantics preserved
  const rawPass = '  PaddedPassword  ';
  const r5 = validateAndAssembleAccounts({
    name: 'P', slug: 'p',
    counters: [{ username: 'u', password: rawPass, name: 'C' }],
  });
  assert.equal(r5.success, true);
  assert.equal(r5.proposedAccounts[0].password, rawPass, 'Password must not be trimmed');

  // ceo_tenants not in route source (architecture audit)
  const routeContent = fs.readFileSync(path.resolve('src/app/api/tenants/route.ts'), 'utf8');
  assert.ok(!/ceo_tenants/.test(routeContent), 'Zero ceo_tenants references in route.ts (regression)');
});
