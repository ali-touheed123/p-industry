/**
 * scripts/test-provisioning-contract.mjs
 *
 * Automated verification suite for PyntFlow Tenant Provisioning (Phase 1 Fix):
 * - Canonical cashier-account assembly (prioritizing counters over legacy scalar)
 * - False duplicate prevention on dual payload
 * - Genuine duplicate username rejection (CEO vs counter, counter vs counter, case-insensitive)
 * - Malformed / blank counter entry rejection
 * - Backward compatibility for legacy callers without counters array
 * - Password preservation semantics
 * - Architecture audit: Zero references to obsolete `ceo_tenants` in tenants route
 *
 * Safety: Isolated in-memory tests. No live database mutations or network requests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Register project module resolver hook for TypeScript imports
try {
  register('./test-resolver-hook.mjs', pathToFileURL(import.meta.filename));
} catch { /* already registered */ }

// Import genuine production validation helper
const { validateAndAssembleAccounts } = await import('@/lib/tenant-provisioning-validation');

test('1. Canonical counters array overrides legacy scalar without false duplicates', () => {
  const payload = {
    name: 'Hamza Paints',
    slug: 'hamza-paints',
    ceo_username: 'hamza_ceo',
    ceo_password: 'CeoPassword123!',
    // Dual payload: both staff_username and counters[0] contain 'counter1'
    staff_username: 'counter1',
    staff_password: 'CounterPassword123!',
    counters: [
      { id: '1', name: 'Main Counter', username: 'counter1', password: 'CounterPassword123!' }
    ]
  };

  const result = validateAndAssembleAccounts(payload);

  assert.equal(result.success, true, 'Validation should succeed without false duplicate error');
  assert.ok(result.proposedAccounts, 'Proposed accounts should be returned');
  assert.equal(result.proposedAccounts.length, 2, 'Should only assemble 2 accounts: 1 CEO and 1 Cashier');

  const ceo = result.proposedAccounts.find(a => a.role === 'ceo');
  assert.ok(ceo, 'CEO account must be present');
  assert.equal(ceo.username, 'hamza_ceo');

  const cashier = result.proposedAccounts.find(a => a.role === 'staff');
  assert.ok(cashier, 'Cashier account must be present');
  assert.equal(cashier.username, 'counter1');
  assert.equal(cashier.fullName, 'Main Counter');
  assert.equal(cashier.source, 'counter');
});

test('2. CEO and counter usernames that genuinely collide are rejected', () => {
  const payload = {
    name: 'Collision Shop',
    slug: 'collision-shop',
    ceo_username: 'admin',
    ceo_password: 'Password123!',
    counters: [
      { id: '1', name: 'Counter 1', username: 'ADMIN', password: 'Password456!' }
    ]
  };

  const result = validateAndAssembleAccounts(payload);

  assert.equal(result.success, false, 'Should reject genuine collision between CEO and counter');
  assert.match(
    result.error,
    /Duplicate usernames provided in request/i,
    'Should return standard duplicate username error'
  );
});

test('3. Two counters with the same normalized username are rejected', () => {
  const payload = {
    name: 'Multi Counter Shop',
    slug: 'multi-counter-shop',
    ceo_username: 'owner',
    ceo_password: 'Password123!',
    counters: [
      { id: '1', name: 'Counter A', username: 'pos_cashier', password: 'Pass1!' },
      { id: '2', name: 'Counter B', username: ' POS_CASHIER ', password: 'Pass2!' }
    ]
  };

  const result = validateAndAssembleAccounts(payload);

  assert.equal(result.success, false, 'Should reject duplicate counter usernames');
  assert.match(
    result.error,
    /Duplicate usernames provided in request/i,
    'Should return duplicate username error'
  );
});

test('4. Blank or missing counter usernames/passwords are rejected', () => {
  // 4a. Missing password
  const payloadMissingPass = {
    name: 'Incomplete Shop',
    slug: 'incomplete-shop',
    counters: [
      { id: '1', name: 'Counter 1', username: 'counter1', password: '' }
    ]
  };
  const res1 = validateAndAssembleAccounts(payloadMissingPass);
  assert.equal(res1.success, false, 'Blank password must be rejected');
  assert.match(res1.error, /must have a valid username and password/i);

  // 4b. Whitespace-only username
  const payloadBlankUser = {
    name: 'Incomplete Shop 2',
    slug: 'incomplete-shop-2',
    counters: [
      { id: '1', name: 'Counter 1', username: '   ', password: 'SomePassword' }
    ]
  };
  const res2 = validateAndAssembleAccounts(payloadBlankUser);
  assert.equal(res2.success, false, 'Blank username must be rejected');
  assert.match(res2.error, /must have a valid username and password/i);

  // 4c. Malformed counter entry (null or invalid object)
  const payloadMalformed = {
    name: 'Malformed Shop',
    slug: 'malformed-shop',
    counters: [null]
  };
  const res3 = validateAndAssembleAccounts(payloadMalformed);
  assert.equal(res3.success, false, 'Malformed counter entry must be rejected');
  assert.match(res3.error, /invalid configuration structure/i);
});

test('5. Legacy callers without counters remain supported', () => {
  const legacyPayload = {
    name: 'Old Terminal Shop',
    slug: 'old-terminal',
    type: 'shop',
    ceo_username: 'old_ceo',
    ceo_password: 'CeoPass123!',
    staff_username: 'old_staff',
    staff_password: 'StaffPass123!',
  };

  const result = validateAndAssembleAccounts(legacyPayload);

  assert.equal(result.success, true, 'Legacy caller payload should validate successfully');
  assert.equal(result.proposedAccounts.length, 2);

  const staff = result.proposedAccounts.find(a => a.source === 'legacy_staff');
  assert.ok(staff, 'Legacy staff account must be assembled');
  assert.equal(staff.username, 'old_staff');
  assert.equal(staff.fullName, 'Old Terminal Shop Counter 01');
  assert.equal(staff.role, 'staff');
});

test('6. Godown type maps role to godown_staff', () => {
  const godownPayload = {
    name: 'Central Warehouse',
    slug: 'central-wh',
    type: 'godown',
    counters: [
      { username: 'wh_keeper', password: 'KeeperPassword!' }
    ]
  };

  const result = validateAndAssembleAccounts(godownPayload);

  assert.equal(result.success, true);
  assert.equal(result.proposedAccounts.length, 1);
  assert.equal(result.proposedAccounts[0].role, 'godown_staff');
});

test('7. Password semantics are preserved intact (no trimming or altering)', () => {
  const sensitivePassword = '  LeadingTrailingSpace Password!  ';
  const payload = {
    name: 'Pass Shop',
    slug: 'pass-shop',
    counters: [
      { username: 'cashier', password: sensitivePassword }
    ]
  };

  const result = validateAndAssembleAccounts(payload);

  assert.equal(result.success, true);
  assert.equal(
    result.proposedAccounts[0].password,
    sensitivePassword,
    'Raw password must NOT be trimmed or altered'
  );
});

test('8. Obsolete ceo_tenants is completely excised from src/app/api/tenants/route.ts', () => {
  const routePath = path.resolve('src/app/api/tenants/route.ts');
  const routeContent = fs.readFileSync(routePath, 'utf8');

  // Verify no occurrences of ceo_tenants in route.ts
  const hasCeoTenants = /ceo_tenants/.test(routeContent);
  assert.equal(
    hasCeoTenants,
    false,
    'src/app/api/tenants/route.ts must contain ZERO references to obsolete ceo_tenants table'
  );
});
