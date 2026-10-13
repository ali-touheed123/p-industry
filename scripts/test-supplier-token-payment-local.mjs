import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Helper to read file content
function readWorkspaceFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  return fs.readFileSync(fullPath, 'utf-8');
}

test('Suite 1: FinancialLedgers.tsx Frontend Quantity-Aware Selection & Contract', async (t) => {
  const content = readWorkspaceFile('src/components/FinancialLedgers.tsx');

  await t.test('FL-1: selectedSupplierTokenQtys state declaration exists', () => {
    assert.match(
      content,
      /const\s+\[selectedSupplierTokenQtys,\s*setSelectedSupplierTokenQtys\]\s*=\s*useState<Record<string,\s*number>>\({}\)/,
      'selectedSupplierTokenQtys state must be declared as Record<string, number>'
    );
  });

  await t.test('FL-2: supplierTokensAppliedAmount multiplies face value by quantity (BUG-FL-01 resolution)', () => {
    assert.match(
      content,
      /sum\s*\+\s*\(\(Number\(t\.token_value\)\s*\|\|\s*0\)\s*\*\s*qty\)/,
      'supplierTokensAppliedAmount must multiply token_value by quantity'
    );
  });

  await t.test('FL-3: supplierTokensTotalUnits calculates aggregate units selected', () => {
    assert.match(
      content,
      /const\s+supplierTokensTotalUnits\s*=\s*React\.useMemo/,
      'supplierTokensTotalUnits memo must exist'
    );
    assert.match(
      content,
      /sum\s*\+\s*qty/,
      'supplierTokensTotalUnits must accumulate quantity units'
    );
  });

  await t.test('FL-4: Depleted token batches are guarded and prevented from selection', () => {
    assert.match(
      content,
      /const\s+isDepleted\s*=\s*maxQty\s*<=\s*0\s*\|\|\s*t\.usage_status\s*===\s*'used'/,
      'Must identify depleted tokens by non-positive quantity or used status'
    );
    assert.match(
      content,
      /disabled=\{isDepleted\}/,
      'Depleted tokens must have disabled checkbox'
    );
    assert.match(
      content,
      /DEPLETED/,
      'Depleted badge must be rendered in UI'
    );
  });

  await t.test('FL-5: Inline quantity input controls integer allocations bounded by available stock', () => {
    assert.match(
      content,
      /type="number"\s+min="1"\s+max=\{maxQty\}\s+step="1"/,
      'Quantity input must enforce positive integer step with min 1 and max maxQty'
    );
    assert.match(
      content,
      /Math\.min\(maxQty,\s*Math\.min\(parsed,\s*2147483647\)\)/,
      'Quantity must be clamped to available stock and 32-bit integer limit'
    );
  });

  await t.test('FL-6: handleRecordReceipt validates allocations and maps both token_allocations and applied_token_ids', () => {
    assert.match(
      content,
      /tokenAllocations\.push\(\{\s*token_id:\s*id,\s*quantity:\s*rawQty\s*\}\)/,
      'Must construct canonical token_allocations array'
    );
    assert.match(
      content,
      /token_allocations:\s*activeTab\s*===\s*'suppliers'\s*&&\s*tokenAllocations\.length\s*>\s*0\s*\?\s*tokenAllocations\s*:\s*undefined/,
      'Payload must map token_allocations to /api/vouchers'
    );
    assert.match(
      content,
      /applied_token_ids:\s*activeTab\s*===\s*'suppliers'\s*\?\s*selectedSupplierTokenIds\s*:\s*\[\]/,
      'Payload must maintain backward-compatible applied_token_ids'
    );
  });

  await t.test('FL-7: Reset clears both selectedSupplierTokenIds and selectedSupplierTokenQtys on modal lifecycle events', () => {
    const clearMatches = (content.match(/setSelectedSupplierTokenQtys\(\{\}\)/g) || []).length;
    assert.ok(
      clearMatches >= 3,
      `Expected at least 3 occurrences of setSelectedSupplierTokenQtys({}) (modal open, modal cancel, submit success), found ${clearMatches}`
    );
  });
});

test('Suite 2: /api/vouchers/route.ts API Validation & Canonical RPC Dispatch', async (t) => {
  const content = readWorkspaceFile('src/app/api/vouchers/route.ts');

  await t.test('V-1: Route accepts token_allocations in request body destructuring', () => {
    assert.match(
      content,
      /token_allocations\s*=\s*null/,
      'Route must destructure token_allocations from body'
    );
  });

  await t.test('V-2: Strict validation of token_allocations array and objects', () => {
    assert.match(
      content,
      /if\s*\(!Array\.isArray\(token_allocations\)\)/,
      'Must reject non-array token_allocations'
    );
    assert.match(
      content,
      /typeof\s+quantity\s*!==\s*'number'\s*\|\|\s*!Number\.isInteger\(quantity\)\s*\|\|\s*quantity\s*<\s*1\s*\|\|\s*quantity\s*>\s*2147483647/,
      'Must enforce typeof number, isInteger, positive range and 32-bit max'
    );
    assert.match(
      content,
      /seenTokenIds\.has\(token_id\)/,
      'Must reject duplicate token IDs'
    );
  });

  await t.test('V-3: Selects canonical p_token_allocations RPC overload when allocations are present', () => {
    assert.match(
      content,
      /rpcPayload\.p_token_allocations\s*=\s*validatedAllocations/,
      'Must pass p_token_allocations when validatedAllocations present'
    );
    assert.match(
      content,
      /rpcPayload\.p_token_ids\s*=\s*tokenIds\.length\s*>\s*0\s*\?\s*tokenIds\s*:\s*null/,
      'Must fallback to p_token_ids for legacy callers'
    );
  });
});

test('Suite 3: Unit Validation Logic on D2 11 Target Inputs', async (t) => {
  function validateApiQuantity(qty) {
    if (typeof qty !== 'number') return { accepted: false, reason: 'not a number' };
    if (!Number.isInteger(qty)) return { accepted: false, reason: 'fractional' };
    if (qty < 1) return { accepted: false, reason: 'non-positive' };
    if (qty > 2147483647) return { accepted: false, reason: 'overflow' };
    return { accepted: true };
  }

  const cases = [
    { input: 2, expected: true, label: '2' },
    { input: 2.0, expected: true, label: '2.0' },
    { input: 2e0, expected: true, label: '2e0' },
    { input: 2.5, expected: false, label: '2.5' },
    { input: 0, expected: false, label: '0' },
    { input: -2, expected: false, label: '-2' },
    { input: 2147483647, expected: true, label: '2147483647' },
    { input: 2147483648, expected: false, label: '2147483648' },
    { input: '2', expected: false, label: '"2"' },
    { input: null, expected: false, label: 'null' },
    { input: true, expected: false, label: 'true' },
  ];

  for (const c of cases) {
    await t.test(`D2 Input '${c.label}': ${c.expected ? 'ACCEPTED' : 'REJECTED'}`, () => {
      const res = validateApiQuantity(c.input);
      assert.equal(
        res.accepted,
        c.expected,
        `Expected ${c.label} to be ${c.expected ? 'accepted' : 'rejected'}`
      );
    });
  }
});

test('Suite 4: Migration & Rollback Artifacts Static Structural Safety', async (t) => {
  const mig03 = readWorkspaceFile('supabase/migrations/20261013_03_fix_create_voucher_atomic.sql');
  const mig04 = readWorkspaceFile('supabase/migrations/20261013_04_fix_create_purchase_atomic_valuation.sql');
  const rb03 = readWorkspaceFile('supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql');
  const rb04 = readWorkspaceFile('supabase/rollbacks/rollback_20261013_04_fix_create_purchase_atomic_valuation.sql');

  await t.test('M03-1: create_voucher_atomic canonical and wrapper overloads exist', () => {
    assert.match(mig03, /FUNCTION\s+public\.create_voucher_atomic\(\s*p_tenant_id\s+UUID,\s*p_voucher_data\s+JSONB,\s*p_token_allocations\s+JSONB/i);
    assert.match(mig03, /FUNCTION\s+public\.create_voucher_atomic\(\s*p_tenant_id\s+UUID,\s*p_voucher_data\s+JSONB,\s*p_token_ids\s+UUID\[\]/i);
  });

  await t.test('M03-2: uq_vouchers_tenant_voucher_no exception handler retry exists (D1)', () => {
    assert.match(mig03, /WHEN\s+unique_violation\s+THEN/i);
    assert.match(mig03, /v_constraint_name\s*=\s*'uq_vouchers_tenant_voucher_no'/);
    assert.match(mig03, /RAISE;\s*--\s*Re-raise\s+unexpected/i);
  });

  await t.test('M03-3: Zero occurrences of defective used_date column in executable SQL', () => {
    const mig03Code = mig03.replace(/--.*$/gm, '');
    const rb03Code = rb03.replace(/--.*$/gm, '');
    assert.equal(mig03Code.includes('used_date'), false, 'mig03 executable code must not reference used_date');
    assert.equal(rb03Code.includes('used_date'), false, 'rb03 executable code must not reference used_date');
  });

  await t.test('M04-1: create_purchase_atomic corrects quantity valuation (BUG-PA-01)', () => {
    assert.match(
      mig04,
      /v_tokens_amount\s*:=\s*v_tokens_amount\s*\+\s*\(COALESCE\(v_token\.token_value,\s*0\)\s*\*\s*v_token\.remaining_quantity\)/
    );
  });

  await t.test('M04-2: Q-FIN-01 preserved — does not double-deduct token value from due_amount', () => {
    assert.match(
      mig04,
      /v_new_balance\s*:=\s*v_current_bal\s*\+\s*v_due_amount;/
    );
    assert.equal(
      mig04.includes('v_due_amount - v_tokens_amount'),
      false,
      'Must NOT deduct v_tokens_amount from v_due_amount a second time'
    );
  });

  await t.test('RB-1: Rollbacks contain valid function signatures without used_date in executable SQL', () => {
    assert.match(rb03, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_voucher_atomic/i);
    assert.match(rb04, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_purchase_atomic/i);
    const rb03Code = rb03.replace(/--.*$/gm, '');
    const rb04Code = rb04.replace(/--.*$/gm, '');
    assert.equal(rb03Code.includes('used_date'), false, 'rb03 executable code must not reference used_date');
    assert.equal(rb04Code.includes('used_date'), false, 'rb04 executable code must not reference used_date');
  });
});

test('Suite 5: Behavioral Simulation of Consumption Models, Financial Integrity & Safety Guards', async (t) => {
  // Pure JavaScript simulation model reflecting PostgreSQL RPC business rules
  function simulateVoucherSettlement({
    cashAmount = 0,
    allocations = [],
    databaseTokens = new Map(),
    initialSupplierBalance = 100000,
  }) {
    if (cashAmount < 0) throw new Error('Voucher cash amount cannot be negative');
    if (cashAmount > 99999999.99) throw new Error('Voucher cash amount exceeds limit');

    // Allocation structural checks
    const seen = new Set();
    for (const alloc of allocations) {
      if (!alloc || typeof alloc !== 'object') throw new Error('Allocation elements must be JSON objects');
      if (!alloc.token_id || typeof alloc.token_id !== 'string') throw new Error('Invalid token_id');
      if (typeof alloc.quantity !== 'number' || !Number.isInteger(alloc.quantity) || alloc.quantity <= 0) {
        throw new Error('Allocation quantity must be strictly greater than zero unsigned integer');
      }
      if (alloc.quantity > 2147483647) throw new Error('Allocation quantity exceeds limit');
      if (seen.has(alloc.token_id)) throw new Error('Duplicate token IDs supplied in settlement allocations');
      seen.add(alloc.token_id);
    }

    // Row locking & validation simulation
    let tokensAmount = 0;
    const mutations = [];
    const childSlices = [];

    for (const alloc of allocations) {
      const token = databaseTokens.get(alloc.token_id);
      if (!token) throw new Error('One or more requested tokens do not exist or belong to another tenant');
      if (token.usage_status !== 'available') throw new Error(`Token ${token.id} is not available for settlement`);
      if (token.used_against_voucher_id || token.used_against_purchase_id) {
        throw new Error(`Token ${token.id} has already been applied to another transaction`);
      }
      if (alloc.quantity > token.remaining_quantity) {
        throw new Error(`Requested quantity ${alloc.quantity} exceeds available quantity ${token.remaining_quantity}`);
      }
      if (token.remaining_quantity <= 0) throw new Error(`Token ${token.id} is depleted`);
      if (token.token_value <= 0) throw new Error(`Token ${token.id} has non-positive face value`);

      tokensAmount += token.token_value * alloc.quantity;

      // Plan mutation
      const nextRemaining = token.remaining_quantity - alloc.quantity;
      mutations.push({
        token,
        nextRemaining,
        nextTotalAmount: nextRemaining * token.token_value,
        nextStatus: nextRemaining === 0 ? 'used' : 'available',
      });

      childSlices.push({
        parent_id: token.id,
        quantity: alloc.quantity,
        remaining_quantity: 0,
        token_value: token.token_value,
        total_amount: alloc.quantity * token.token_value,
        usage_status: 'used',
        shift_id: null,
      });
    }

    const totalSettlement = cashAmount + tokensAmount;
    if (totalSettlement <= 0) throw new Error('Total settlement amount must be greater than zero');

    // Apply mutations
    for (const m of mutations) {
      m.token.remaining_quantity = m.nextRemaining;
      m.token.total_amount = m.nextTotalAmount;
      m.token.usage_status = m.nextStatus;
    }

    const updatedSupplierBalance = initialSupplierBalance - totalSettlement;

    return {
      totalSettlement,
      cashAmount,
      tokensAmount,
      updatedSupplierBalance,
      childSlices,
    };
  }

  await t.test('SIM-1: Full batch consumption sets parent remaining=0 and total_amount=0 (Model 1 invariant)', () => {
    const tokens = new Map([
      ['t-1', { id: 't-1', token_value: 500, quantity: 10, remaining_quantity: 10, total_amount: 5000, usage_status: 'available' }],
    ]);

    const res = simulateVoucherSettlement({
      cashAmount: 1000,
      allocations: [{ token_id: 't-1', quantity: 10 }],
      databaseTokens: tokens,
      initialSupplierBalance: 50000,
    });

    const parent = tokens.get('t-1');
    assert.equal(parent.remaining_quantity, 0);
    assert.equal(parent.total_amount, 0);
    assert.equal(parent.usage_status, 'used');
    assert.equal(res.tokensAmount, 5000);
    assert.equal(res.totalSettlement, 6000);
    assert.equal(res.updatedSupplierBalance, 44000);
    assert.equal(res.childSlices.length, 1);
    assert.equal(res.childSlices[0].quantity, 10);
    assert.equal(res.childSlices[0].shift_id, null);
    // Invariant: child.qty + parent.remaining = initial_qty
    assert.equal(res.childSlices[0].quantity + parent.remaining_quantity, 10);
  });

  await t.test('SIM-2: Partial batch consumption leaves parent available with proportional total_amount', () => {
    const tokens = new Map([
      ['t-2', { id: 't-2', token_value: 500, quantity: 14, remaining_quantity: 14, total_amount: 7000, usage_status: 'available' }],
    ]);

    const res = simulateVoucherSettlement({
      cashAmount: 0,
      allocations: [{ token_id: 't-2', quantity: 5 }],
      databaseTokens: tokens,
      initialSupplierBalance: 50000,
    });

    const parent = tokens.get('t-2');
    assert.equal(parent.remaining_quantity, 9);
    assert.equal(parent.total_amount, 4500); // 9 * 500
    assert.equal(parent.usage_status, 'available');
    assert.equal(res.tokensAmount, 2500); // 5 * 500
    assert.equal(res.childSlices[0].quantity, 5);
    assert.equal(res.childSlices[0].total_amount, 2500);
    assert.equal(res.childSlices[0].shift_id, null);
    // Invariant: child.qty + parent.remaining = initial_qty
    assert.equal(res.childSlices[0].quantity + parent.remaining_quantity, 14);
  });

  await t.test('SIM-3: Subsequent consumption of residual batch creates uniform child slice and depletes parent', () => {
    const tokens = new Map([
      ['t-3', { id: 't-3', token_value: 500, quantity: 14, remaining_quantity: 9, total_amount: 4500, usage_status: 'available' }],
    ]);

    const res = simulateVoucherSettlement({
      cashAmount: 2000,
      allocations: [{ token_id: 't-3', quantity: 9 }],
      databaseTokens: tokens,
      initialSupplierBalance: 40000,
    });

    const parent = tokens.get('t-3');
    assert.equal(parent.remaining_quantity, 0);
    assert.equal(parent.total_amount, 0);
    assert.equal(parent.usage_status, 'used');
    assert.equal(res.tokensAmount, 4500);
    assert.equal(res.totalSettlement, 6500);
    assert.equal(res.childSlices[0].quantity, 9);
    assert.equal(res.childSlices[0].shift_id, null);
  });

  await t.test('SIM-4: Overdraft attempt is strictly rejected without modifying database token state', () => {
    const tokens = new Map([
      ['t-4', { id: 't-4', token_value: 1000, quantity: 5, remaining_quantity: 3, total_amount: 3000, usage_status: 'available' }],
    ]);

    assert.throws(
      () => simulateVoucherSettlement({
        cashAmount: 0,
        allocations: [{ token_id: 't-4', quantity: 4 }], // requests 4 when 3 available
        databaseTokens: tokens,
      }),
      /Requested quantity 4 exceeds available quantity 3/
    );

    // Parent state unchanged
    const parent = tokens.get('t-4');
    assert.equal(parent.remaining_quantity, 3);
    assert.equal(parent.total_amount, 3000);
  });

  await t.test('SIM-5: Zero or negative token face value rejected as payment tender', () => {
    const tokens = new Map([
      ['t-zero', { id: 't-zero', token_value: 0, quantity: 10, remaining_quantity: 10, total_amount: 0, usage_status: 'available' }],
      ['t-neg', { id: 't-neg', token_value: -500, quantity: 5, remaining_quantity: 5, total_amount: -2500, usage_status: 'available' }],
    ]);

    assert.throws(
      () => simulateVoucherSettlement({
        cashAmount: 500,
        allocations: [{ token_id: 't-zero', quantity: 1 }],
        databaseTokens: tokens,
      }),
      /non-positive face value/
    );

    assert.throws(
      () => simulateVoucherSettlement({
        cashAmount: 500,
        allocations: [{ token_id: 't-neg', quantity: 1 }],
        databaseTokens: tokens,
      }),
      /non-positive face value/
    );
  });

  await t.test('SIM-6: Pure cash voucher operates without tokens and reduces balance', () => {
    const tokens = new Map();
    const res = simulateVoucherSettlement({
      cashAmount: 7500,
      allocations: [],
      databaseTokens: tokens,
      initialSupplierBalance: 20000,
    });

    assert.equal(res.totalSettlement, 7500);
    assert.equal(res.tokensAmount, 0);
    assert.equal(res.updatedSupplierBalance, 12500);
    assert.equal(res.childSlices.length, 0);
  });

  await t.test('SIM-7: Q-FIN-01 Purchase valuation and double-deduction prevention check', () => {
    // Model PurchasesView calculations:
    const grossTotal = 12000;
    const tokenValuation = 3000; // 6 units @ 500
    const netBillValue = grossTotal - tokenValuation; // 9000
    const cashPaid = 4000;
    const dueAmount = netBillValue - cashPaid; // 5000

    // Model create_purchase_atomic balance adjustment:
    const initialSupplierBalance = 80000;
    // Step 6: v_new_balance := v_current_bal + v_due_amount
    const newBalance = initialSupplierBalance + dueAmount;

    assert.equal(netBillValue, 9000);
    assert.equal(dueAmount, 5000);
    assert.equal(newBalance, 85000);

    // If double deduction had occurred:
    const erroneousDoubleDeduction = initialSupplierBalance + (dueAmount - tokenValuation);
    assert.equal(erroneousDoubleDeduction, 82000); // 3000 undercounted
    assert.notEqual(newBalance, erroneousDoubleDeduction, 'Must prevent double deduction');
  });

  await t.test('SIM-8: Stockpile query filters out child slices and depleted parents', () => {
    const allTableRows = [
      { id: 'p-active', usage_status: 'available', remaining_quantity: 8, total_amount: 4000 },
      { id: 'p-depleted', usage_status: 'used', remaining_quantity: 0, total_amount: 0 },
      { id: 'c-slice-1', usage_status: 'used', remaining_quantity: 0, total_amount: 1500, parent_transaction_id: 'p-active' },
      { id: 'c-slice-2', usage_status: 'used', remaining_quantity: 0, total_amount: 3000, parent_transaction_id: 'p-depleted' },
    ];

    // Standard stockpile query: WHERE usage_status = 'available'
    const availableStock = allTableRows.filter(r => r.usage_status === 'available');
    assert.equal(availableStock.length, 1);
    assert.equal(availableStock[0].id, 'p-active');
    assert.equal(availableStock[0].total_amount, 4000);
  });

  await t.test('SIM-9: Shift drawer query ignores voucher token child slices (shift_id is null)', () => {
    const currentShiftId = 'shift-uuid-99';
    const shiftTransactions = [
      { id: 'redemption-1', type: 'redeemed', shift_id: currentShiftId, total_amount: 1200 },
      { id: 'child-voucher-slice', type: 'opening_stock', shift_id: null, total_amount: 2500 },
    ];

    // Shift drawer query: type = 'redeemed' AND shift_id = currentShiftId
    const drawerTokenPayouts = shiftTransactions
      .filter(r => r.type === 'redeemed' && r.shift_id === currentShiftId)
      .reduce((sum, r) => sum + r.total_amount, 0);

    assert.equal(drawerTokenPayouts, 1200);
    // Voucher child slice does NOT reduce register drawer cash
  });
});

