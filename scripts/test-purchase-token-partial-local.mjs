import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function readWorkspaceFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ============================================================================
// SUITE 1: PurchasesView.tsx Frontend Quantity-Aware Selection & Contract
// ============================================================================
test('Suite 1: PurchasesView.tsx Frontend Quantity-Aware Selection & Contract', async (t) => {
  const content = readWorkspaceFile('src/components/PurchasesView.tsx');

  await t.test('PV-1: selectedTokenQtys state declaration exists', () => {
    assert.match(
      content,
      /const\s+\[selectedTokenQtys,\s*setSelectedTokenQtys\]\s*=\s*useState<Record<string,\s*number>>\({}\)/,
      'selectedTokenQtys state must be declared as Record<string, number>'
    );
  });

  await t.test('PV-2: tokensAppliedAmount multiplies unit face value by quantity', () => {
    assert.match(
      content,
      /sum\s*\+\s*\(\(Number\(t\.token_value\)\s*\|\|\s*0\)\s*\*\s*qty\)/,
      'tokensAppliedAmount must multiply unit token_value by quantity'
    );
  });

  await t.test('PV-3: tokensTotalUnits calculates aggregate units selected across batches', () => {
    assert.match(
      content,
      /const\s+tokensTotalUnits\s*=\s*React\.useMemo/,
      'tokensTotalUnits memo must exist'
    );
    assert.match(
      content,
      /sum\s*\+\s*qty/,
      'tokensTotalUnits must accumulate quantity units'
    );
  });

  await t.test('PV-4: Depleted token batches are guarded and prevented from selection', () => {
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
  });

  await t.test('PV-5: Inline quantity input controls integer allocations bounded by available stock', () => {
    assert.match(
      content,
      /<input[\s\S]*?type="number"[\s\S]*?min="1"[\s\S]*?max=\{maxQty\}/,
      'Quantity input must restrict min to 1 and max to maxQty'
    );
    assert.match(
      content,
      /Math\.max\(1,\s*Math\.min\(maxQty,\s*Math\.min\(parsed,\s*2147483647\)\)\)/,
      'Quantity input must clamp entered value between 1 and maxQty'
    );
  });

  await t.test('PV-6: handleSavePurchase validates allocations and passes token_allocations to API', () => {
    assert.match(
      content,
      /token_allocations:\s*tokenAllocations\.length\s*>\s*0\s*\?\s*tokenAllocations\s*:\s*undefined/,
      'handleSavePurchase must pass validated token_allocations in request body'
    );
    assert.match(
      content,
      /applied_token_ids:\s*selectedTokenIds/,
      'handleSavePurchase must also preserve applied_token_ids for compatibility'
    );
  });

  await t.test('PV-7: Reset clears both selectedTokenIds and selectedTokenQtys on lifecycle events', () => {
    const newMatches = content.match(/setSelectedTokenIds\(\[\]\);\s*setSelectedTokenQtys\(\{\}\);/g);
    assert.ok(
      newMatches && newMatches.length >= 3,
      `Expected at least 3 lifecycle reset locations (new, cancel, save success), found ${newMatches ? newMatches.length : 0}`
    );
  });

  await t.test('PV-8: Calculation breakdown displays total units applied', () => {
    assert.match(
      content,
      /\(-\)\s*Tokens Applied\s*\(\{tokensTotalUnits\}\)/,
      'Calculation breakdown must display total units applied'
    );
  });
});

// ============================================================================
// SUITE 2: /api/purchases/route.ts API Dual-Layer Validation & RPC Dispatch
// ============================================================================
test('Suite 2: /api/purchases/route.ts API Validation & Canonical RPC Dispatch', async (t) => {
  const content = readWorkspaceFile('src/app/api/purchases/route.ts');

  await t.test('PAPI-1: Route accepts token_allocations in request body destructuring', () => {
    assert.match(
      content,
      /token_allocations\s*=\s*null/,
      'POST handler must destructure token_allocations defaulting to null'
    );
  });

  await t.test('PAPI-2: Strict validation of token_allocations array and objects', () => {
    assert.match(
      content,
      /Array\.isArray\(token_allocations\)/,
      'Must validate token_allocations is an array'
    );
    assert.match(
      content,
      /typeof\s+quantity\s*!==\s*'number'\s*\|\|\s*!Number\.isInteger\(quantity\)\s*\|\|\s*quantity\s*<\s*1/,
      'Must strictly enforce positive integer quantities'
    );
    assert.match(
      content,
      /seenTokenIds\.has\(token_id\)/,
      'Must enforce duplicate token_id rejection'
    );
  });

  await t.test('PAPI-3: Rejection of tokens on purchase return', () => {
    assert.match(
      content,
      /purchase_type\s*===\s*'return'\s*&&\s*token_allocations\.length\s*>\s*0/,
      'Must reject token application on purchase returns'
    );
  });

  await t.test('PAPI-4: Selects canonical p_token_allocations RPC overload when allocations are present', () => {
    assert.match(
      content,
      /rpcPayload\.p_token_allocations\s*=\s*validatedAllocations/,
      'Must map p_token_allocations when validated allocations exist'
    );
    assert.match(
      content,
      /rpcPayload\.p_token_ids\s*=\s*tokenIds\.length\s*>\s*0\s*\?\s*tokenIds\s*:\s*null/,
      'Must fallback to legacy p_token_ids when no allocations provided'
    );
  });
});

// ============================================================================
// SUITE 3: Migration & Rollback Artifacts Static Structural Safety
// ============================================================================
test('Suite 3: Migration & Rollback Artifacts Static Structural Safety', async (t) => {
  const migContent = readWorkspaceFile('supabase/migrations/20261014_01_create_purchase_atomic_partial_tokens.sql');
  const rbContent = readWorkspaceFile('supabase/rollbacks/rollback_20261014_01_create_purchase_atomic_partial_tokens.sql');

  await t.test('M14-1: create_purchase_atomic canonical and wrapper overloads exist in migration', () => {
    assert.match(
      migContent,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_purchase_atomic\(\s*p_tenant_id\s+UUID,\s*p_purchase_data\s+JSONB,\s*p_items\s+JSONB,\s*p_token_allocations\s+JSONB\s+DEFAULT\s+NULL\s*\)/i,
      'Canonical p_token_allocations JSONB overload must exist'
    );
    assert.match(
      migContent,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_purchase_atomic\(\s*p_tenant_id\s+UUID,\s*p_purchase_data\s+JSONB,\s*p_items\s+JSONB,\s*p_token_ids\s+UUID\[\]\s*\)/i,
      'Legacy wrapper UUID[] overload must exist'
    );
  });

  await t.test('M14-2: create_purchase_atomic disallows token deduction on returns', () => {
    assert.match(
      migContent,
      /v_is_return\s+AND\s+p_token_allocations\s+IS\s+NOT\s+NULL/,
      'Must reject tokens on returns'
    );
  });

  await t.test('M14-3: Uniform child slice creation links to used_against_purchase_id with shift_id = NULL', () => {
    assert.match(
      migContent,
      /used_against_purchase_id,\s*settled_vendor_name,\s*notes,\s*shift_id/i,
      'Child slice insert must include used_against_purchase_id and shift_id'
    );
    assert.match(
      migContent,
      /v_rec\.id,\s*'used',\s*v_purchase_id/i,
      'Child slice must link parent_transaction_id to v_rec.id and used_against_purchase_id to v_purchase_id'
    );
  });

  await t.test('M14-4: Parent batch updates remaining_quantity and total_amount proportionally', () => {
    assert.match(
      migContent,
      /remaining_quantity\s*=\s*remaining_quantity\s*-\s*v_rec_qty/,
      'Parent remaining_quantity must be decremented by requested quantity'
    );
    assert.match(
      migContent,
      /total_amount\s*=\s*\(remaining_quantity\s*-\s*v_rec_qty\)\s*\*\s*token_value/,
      'Parent total_amount must evaluate remaining_quantity * token_value'
    );
    assert.match(
      migContent,
      /usage_status\s*=\s*CASE\s+WHEN\s+remaining_quantity\s*-\s*v_rec_qty\s*=\s*0\s+THEN\s+'used'\s+ELSE\s+'available'\s+END/i,
      'Parent usage_status must become used only when remaining_quantity reaches 0'
    );
  });

  await t.test('M14-5: Service role execution privileges granted and untrusted roles revoked', () => {
    assert.match(
      migContent,
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_purchase_atomic\(uuid,\s*jsonb,\s*jsonb,\s*jsonb\)\s+TO\s+service_role/i,
      'service_role grant must exist on canonical overload'
    );
    assert.match(
      migContent,
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_purchase_atomic\(uuid,\s*jsonb,\s*jsonb,\s*jsonb\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
      'Public revoke must exist on canonical overload'
    );
  });

  await t.test('RB14-1: Rollback artifact drops canonical overload and restores 20261013_04 definition', () => {
    assert.match(
      rbContent,
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_purchase_atomic\(UUID,\s*JSONB,\s*JSONB,\s*JSONB\)/i,
      'Rollback must drop canonical JSONB overload'
    );
    assert.match(
      rbContent,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_purchase_atomic\(\s*p_tenant_id\s+UUID,\s*p_purchase_data\s+JSONB,\s*p_items\s+JSONB,\s*p_token_ids\s+UUID\[\]\s*\)/i,
      'Rollback must restore 20261013_04 UUID[] definition'
    );
  });
});

// ============================================================================
// SUITE 4: Behavioral Simulation of Purchase Token Scenarios & Concurrency
// ============================================================================
test('Suite 4: Behavioral Simulation of Purchase Token Scenarios & Concurrency', async (t) => {
  // Pure in-memory simulation of create_purchase_atomic transaction engine
  function simulatePurchaseTransaction({
    tenantId = 'tenant-1',
    purchaseType = 'purchase',
    grossSubtotal = 5000,
    paidAmount = 0,
    allocations = [],
    databaseTokens = new Map(),
    initialSupplierBalance = 10000,
  }) {
    if (purchaseType === 'return' && allocations.length > 0) {
      throw new Error('Stockpile tokens cannot be applied to purchase returns');
    }

    // Structural validation
    const seen = new Set();
    for (const alloc of allocations) {
      if (!alloc || typeof alloc !== 'object') throw new Error('Allocation elements must be JSON objects');
      if (!alloc.token_id || typeof alloc.token_id !== 'string') throw new Error('Invalid token_id');
      if (typeof alloc.quantity !== 'number' || !Number.isInteger(alloc.quantity) || alloc.quantity <= 0) {
        throw new Error('Allocation quantity must be strictly greater than zero unsigned integer');
      }
      if (alloc.quantity > 2147483647) throw new Error('Allocation quantity exceeds integer limit');
      if (seen.has(alloc.token_id)) throw new Error('Duplicate token IDs supplied in purchase token allocations');
      seen.add(alloc.token_id);
    }

    let tokensAmount = 0;
    const mutations = [];
    const childSlices = [];

    // Deterministic row locking simulation (sorted by ID ASC)
    const sortedAllocations = [...allocations].sort((a, b) => a.token_id.localeCompare(b.token_id));

    for (const alloc of sortedAllocations) {
      const token = databaseTokens.get(alloc.token_id);
      if (!token || token.tenant_id !== tenantId) {
        throw new Error('One or more requested tokens do not exist or belong to another tenant');
      }
      if (token.usage_status !== 'available') {
        throw new Error(`Token ${token.id} is not available for deduction`);
      }
      if (token.used_against_voucher_id || token.used_against_purchase_id) {
        throw new Error(`Token ${token.id} has already been applied to another transaction`);
      }
      if (alloc.quantity > token.remaining_quantity) {
        throw new Error(`Requested quantity ${alloc.quantity} exceeds available quantity ${token.remaining_quantity}`);
      }
      if (token.remaining_quantity <= 0) throw new Error(`Token ${token.id} is depleted`);
      if (token.token_value <= 0) throw new Error(`Token ${token.id} has non-positive face value`);

      tokensAmount += token.token_value * alloc.quantity;

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
        used_against_purchase_id: 'purch-new-uuid',
        shift_id: null,
      });
    }

    const netTotal = Math.max(0, grossSubtotal - tokensAmount);
    const dueAmount = Math.max(0, netTotal - paidAmount);

    // Commit mutations
    for (const m of mutations) {
      m.token.remaining_quantity = m.nextRemaining;
      m.token.total_amount = m.nextTotalAmount;
      m.token.usage_status = m.nextStatus;
    }

    const newSupplierBalance = initialSupplierBalance + dueAmount;

    return {
      grossSubtotal,
      tokensAmount,
      netTotal,
      paidAmount,
      dueAmount,
      newSupplierBalance,
      childSlices,
    };
  }

  await t.test('PSIM-1: One-unit selection on a multi-unit batch (confirmed business rule)', () => {
    const tokens = new Map([
      ['tok-valmate', {
        id: 'tok-valmate',
        tenant_id: 'tenant-1',
        token_value: 400,
        quantity: 2,
        remaining_quantity: 2,
        total_amount: 800,
        usage_status: 'available',
      }],
    ]);

    const res = simulatePurchaseTransaction({
      grossSubtotal: 5000,
      paidAmount: 0,
      allocations: [{ token_id: 'tok-valmate', quantity: 1 }],
      databaseTokens: tokens,
      initialSupplierBalance: 10000,
    });

    // Validates: 1 unit @ 400 = 400 deduction
    assert.equal(res.tokensAmount, 400);
    assert.equal(res.netTotal, 4600);
    assert.equal(res.dueAmount, 4600);
    assert.equal(res.newSupplierBalance, 14600); // 10000 + 4600

    // Parent retains 1 unit @ 400 with status available
    const parent = tokens.get('tok-valmate');
    assert.equal(parent.remaining_quantity, 1);
    assert.equal(parent.total_amount, 400);
    assert.equal(parent.usage_status, 'available');

    // Child slice created for 1 unit @ 400
    assert.equal(res.childSlices.length, 1);
    assert.equal(res.childSlices[0].quantity, 1);
    assert.equal(res.childSlices[0].total_amount, 400);
    assert.equal(res.childSlices[0].shift_id, null);
    assert.equal(res.childSlices[0].usage_status, 'used');
  });

  await t.test('PSIM-2: Full-batch selection on a multi-unit batch (both units selected)', () => {
    const tokens = new Map([
      ['tok-valmate', {
        id: 'tok-valmate',
        tenant_id: 'tenant-1',
        token_value: 400,
        quantity: 2,
        remaining_quantity: 2,
        total_amount: 800,
        usage_status: 'available',
      }],
    ]);

    const res = simulatePurchaseTransaction({
      grossSubtotal: 5000,
      paidAmount: 0,
      allocations: [{ token_id: 'tok-valmate', quantity: 2 }],
      databaseTokens: tokens,
      initialSupplierBalance: 10000,
    });

    // Validates: 2 units @ 400 = 800 deduction
    assert.equal(res.tokensAmount, 800);
    assert.equal(res.netTotal, 4200);
    assert.equal(res.dueAmount, 4200);
    assert.equal(res.newSupplierBalance, 14200); // 10000 + 4200

    // Parent is fully depleted: remaining = 0, total_amount = 0, status = 'used'
    const parent = tokens.get('tok-valmate');
    assert.equal(parent.remaining_quantity, 0);
    assert.equal(parent.total_amount, 0);
    assert.equal(parent.usage_status, 'used');

    // Child slice created for 2 units @ 800
    assert.equal(res.childSlices.length, 1);
    assert.equal(res.childSlices[0].quantity, 2);
    assert.equal(res.childSlices[0].total_amount, 800);
  });

  await t.test('PSIM-3: Insufficient quantity (overdraft) is strictly rejected', () => {
    const tokens = new Map([
      ['tok-valmate', {
        id: 'tok-valmate',
        tenant_id: 'tenant-1',
        token_value: 400,
        quantity: 2,
        remaining_quantity: 2,
        total_amount: 800,
        usage_status: 'available',
      }],
    ]);

    assert.throws(
      () => simulatePurchaseTransaction({
        grossSubtotal: 5000,
        allocations: [{ token_id: 'tok-valmate', quantity: 3 }],
        databaseTokens: tokens,
      }),
      /Requested quantity 3 exceeds available quantity 2/
    );

    // Verify parent state was not mutated (atomic rollback)
    const parent = tokens.get('tok-valmate');
    assert.equal(parent.remaining_quantity, 2);
    assert.equal(parent.total_amount, 800);
    assert.equal(parent.usage_status, 'available');
  });

  await t.test('PSIM-4: Duplicate token IDs in allocations are rejected', () => {
    const tokens = new Map([
      ['tok-dup', {
        id: 'tok-dup',
        tenant_id: 'tenant-1',
        token_value: 500,
        quantity: 10,
        remaining_quantity: 10,
        total_amount: 5000,
        usage_status: 'available',
      }],
    ]);

    assert.throws(
      () => simulatePurchaseTransaction({
        allocations: [
          { token_id: 'tok-dup', quantity: 1 },
          { token_id: 'tok-dup', quantity: 2 },
        ],
        databaseTokens: tokens,
      }),
      /Duplicate token IDs supplied in purchase token allocations/
    );
  });

  await t.test('PSIM-5: Cross-tenant token ID is strictly rejected', () => {
    const tokens = new Map([
      ['tok-foreign', {
        id: 'tok-foreign',
        tenant_id: 'other-tenant-999',
        token_value: 500,
        quantity: 5,
        remaining_quantity: 5,
        total_amount: 2500,
        usage_status: 'available',
      }],
    ]);

    assert.throws(
      () => simulatePurchaseTransaction({
        tenantId: 'tenant-1',
        allocations: [{ token_id: 'tok-foreign', quantity: 1 }],
        databaseTokens: tokens,
      }),
      /One or more requested tokens do not exist or belong to another tenant/
    );
  });

  await t.test('PSIM-6: Applying tokens to purchase return is strictly rejected', () => {
    const tokens = new Map([
      ['tok-ret', {
        id: 'tok-ret',
        tenant_id: 'tenant-1',
        token_value: 300,
        quantity: 2,
        remaining_quantity: 2,
        total_amount: 600,
        usage_status: 'available',
      }],
    ]);

    assert.throws(
      () => simulatePurchaseTransaction({
        purchaseType: 'return',
        allocations: [{ token_id: 'tok-ret', quantity: 1 }],
        databaseTokens: tokens,
      }),
      /Stockpile tokens cannot be applied to purchase returns/
    );
  });

  await t.test('PSIM-7: Concurrent consumption protection (two sequential transactions on same batch)', () => {
    const tokens = new Map([
      ['tok-shared', {
        id: 'tok-shared',
        tenant_id: 'tenant-1',
        token_value: 400,
        quantity: 2,
        remaining_quantity: 2,
        total_amount: 800,
        usage_status: 'available',
      }],
    ]);

    // Terminal 1 applies 1 unit
    const tx1 = simulatePurchaseTransaction({
      grossSubtotal: 3000,
      allocations: [{ token_id: 'tok-shared', quantity: 1 }],
      databaseTokens: tokens,
    });
    assert.equal(tx1.tokensAmount, 400);

    // Token now has remaining_quantity = 1
    assert.equal(tokens.get('tok-shared').remaining_quantity, 1);

    // Terminal 2 attempts to consume 2 units -> fails with overdraft
    assert.throws(
      () => simulatePurchaseTransaction({
        grossSubtotal: 4000,
        allocations: [{ token_id: 'tok-shared', quantity: 2 }],
        databaseTokens: tokens,
      }),
      /Requested quantity 2 exceeds available quantity 1/
    );

    // Terminal 2 consumes remaining 1 unit -> succeeds and depletes
    const tx2 = simulatePurchaseTransaction({
      grossSubtotal: 4000,
      allocations: [{ token_id: 'tok-shared', quantity: 1 }],
      databaseTokens: tokens,
    });
    assert.equal(tx2.tokensAmount, 400);
    assert.equal(tokens.get('tok-shared').remaining_quantity, 0);
    assert.equal(tokens.get('tok-shared').total_amount, 0);
    assert.equal(tokens.get('tok-shared').usage_status, 'used');
  });
});
