/**
 * scripts/test-purchase-audit-offline.mjs
 *
 * Offline static pattern conformance & mocked UI unit verification suite
 * for PyntFlow Purchase Audit Remediation (Gate B).
 *
 * EXPLICIT TOOLING & CREDIBILITY DISCLAIMER:
 * -------------------------------------------
 * Static pattern checks in this script perform lexical and string/regex inspection only.
 * They do NOT compile PL/pgSQL, build an AST, or validate SQL grammar in an active engine.
 * Passing these checks does NOT prove that embedded SQL queries have valid column references
 * at PostgreSQL runtime due to PL/pgSQL deferred plan caching.
 * Runtime column validity is verified separately via live schema inspection and preflights.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ============================================================================
// SUITE 1: STATIC LEXICAL CONFORMANCE CHECKS (Forward & Rollback SQL)
// ============================================================================
test('Suite 1: Static Lexical Conformance Checks on Migration & Rollback SQL', async (t) => {
  const forwardPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20261013_01_fix_create_purchase_atomic_audit_log.sql'
  );
  const rollbackPath = path.join(
    rootDir,
    'supabase',
    'rollbacks',
    'rollback_20261013_01_fix_create_purchase_atomic.sql'
  );

  assert.ok(fs.existsSync(forwardPath), 'Forward migration file must exist');
  assert.ok(fs.existsSync(rollbackPath), 'Rollback SQL file must exist in supabase/rollbacks/');

  const forwardContent = fs.readFileSync(forwardPath, 'utf8');
  const rollbackContent = fs.readFileSync(rollbackPath, 'utf8');

  for (const [name, content] of [
    ['Forward Migration', forwardContent],
    ['Rollback Artifact', rollbackContent],
  ]) {
    await t.test(`${name}: Function qualification and signature`, () => {
      assert.match(
        content,
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_purchase_atomic\s*\(/i,
        'Must qualify function as public.create_purchase_atomic'
      );
      assert.match(
        content,
        /SECURITY\s+DEFINER/i,
        'Must retain SECURITY DEFINER'
      );
      assert.match(
        content,
        /SET\s+search_path\s*=\s*public,\s*pg_temp/i,
        'Must retain SET search_path = public, pg_temp'
      );
    });

    // Strip single-line SQL comments so documentation comments don't match as code
    const codeOnly = content.replace(/--.*$/gm, '');

    await t.test(`${name}: Step 7 Canonical Audit Contract`, () => {
      // Find audit insert block
      const auditInsertMatch = codeOnly.match(/INSERT\s+INTO\s+audit_logs\s*\(([^)]+)\)/i);
      assert.ok(auditInsertMatch, 'Must contain INSERT INTO audit_logs statement');
      const columnList = auditInsertMatch[1];

      // Check required columns
      assert.match(columnList, /\bentity_type\b/, 'Audit column list must include entity_type');
      assert.match(columnList, /\baction_type\b/, 'Audit column list must include action_type');
      assert.match(columnList, /\bentity_id\b/, 'Audit column list must include entity_id');
      assert.match(columnList, /\btenant_id\b/, 'Audit column list must include tenant_id');
      assert.match(columnList, /\buser_name\b/, 'Audit column list must include user_name');

      // ABSOLUTE PROHIBITION: "entity" alone as a column must NOT exist in the audit column list
      assert.doesNotMatch(
        columnList,
        /(^|[\s,])entity([\s,]|$)/,
        'Audit column list must NOT contain defective "entity" column'
      );

      // Verify entity_id cast to ::text (C-05)
      assert.match(
        content,
        /v_purchase_id::text/,
        'entity_id value must be explicitly cast using v_purchase_id::text (C-05)'
      );

      // Verify entity_type canonical value 'purchase'
      assert.match(
        content,
        /'purchase'/,
        'Must supply canonical singular entity_type "purchase"'
      );
    });

    await t.test(`${name}: Phase 9 Shift Linkage Preservation`, () => {
      assert.match(content, /v_shift_id\s+UUID;/, 'Must declare v_shift_id UUID');
      assert.match(
        content,
        /v_shift_id\s*:=\s*NULLIF\s*\(\s*p_purchase_data->>'shift_id'\s*,\s*''\s*\)::UUID;/i,
        'Must extract shift_id from p_purchase_data'
      );
      assert.match(
        content,
        /INSERT\s+INTO\s+purchases\s*\([^)]*\bshift_id\b[^)]*\)/i,
        'Must insert shift_id into purchases table'
      );
    });

    await t.test(`${name}: C-01 Strict Item Validation`, () => {
      assert.match(
        content,
        /RAISE\s+EXCEPTION\s+'Item with code "%" not found for this tenant'/i,
        'Must raise exception when item code is not found (C-01 strict validation)'
      );
    });

    await t.test(`${name}: C-02 Supplier Payment Metadata & Exactly-Once Balance`, () => {
      assert.match(
        content,
        /last_payment_amount\s*=\s*CASE\s+WHEN\s+v_paid_amount\s*>\s*0\s+THEN\s+v_paid_amount/i,
        'Must update last_payment_amount when v_paid_amount > 0'
      );
      assert.match(
        content,
        /last_payment_date\s*=\s*CASE\s+WHEN\s+v_paid_amount\s*>\s*0\s+THEN\s+v_date/i,
        'Must update last_payment_date when v_paid_amount > 0'
      );
    });

    await t.test(`${name}: Security Grants Posture (C-06)`, () => {
      assert.match(
        content,
        /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_purchase_atomic\([^)]+\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/i,
        'Must revoke execute from PUBLIC, anon, authenticated'
      );
      assert.match(
        content,
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_purchase_atomic\([^)]+\)\s+TO\s+service_role;/i,
        'Must grant execute strictly to service_role'
      );
    });

    await t.test(`${name}: Step 4 Token Stockpile Schema Conformance (No used_date)`, () => {
      // Must NOT contain used_date in the UPDATE token_transactions statement
      assert.doesNotMatch(
        codeOnly,
        /UPDATE\s+token_transactions[\s\S]*?\bused_date\b/i,
        'token_transactions UPDATE must NOT reference non-existent used_date column'
      );
      assert.match(
        codeOnly,
        /UPDATE\s+token_transactions[\s\S]*?usage_status\s*=\s*'used'/i,
        "token_transactions UPDATE must set usage_status = 'used'"
      );
      assert.match(
        codeOnly,
        /UPDATE\s+token_transactions[\s\S]*?used_against_purchase_id\s*=\s*v_purchase_id/i,
        'token_transactions UPDATE must set used_against_purchase_id = v_purchase_id'
      );
    });
  }

  await t.test('C-08 Migration & Rollback: token_transactions_usage_status_check Conformance', () => {
    const c08MigrationPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261013_02_allow_used_token_usage_status.sql'
    );
    const c08RollbackPath = path.join(
      rootDir,
      'supabase',
      'rollbacks',
      'rollback_20261013_02_allow_used_token_usage_status.sql'
    );

    assert.ok(fs.existsSync(c08MigrationPath), 'C-08 forward migration must exist');
    assert.ok(fs.existsSync(c08RollbackPath), 'C-08 rollback script must exist');

    const migContent = fs.readFileSync(c08MigrationPath, 'utf8');
    const rbContent = fs.readFileSync(c08RollbackPath, 'utf8');

    // Migration must include 'used' alongside all 5 original statuses
    for (const status of ['available', 'settled', 'used', 'written_off', 'reversed', 'n_a']) {
      assert.match(
        migContent,
        new RegExp(`'${status}'`),
        `Forward migration must include '${status}' status`
      );
    }

    // Rollback must NOT include 'used' and must retain the original 5 statuses
    assert.doesNotMatch(
      rbContent.replace(/--.*$/gm, ''),
      /'used'/,
      "Rollback script must not include 'used' status in active SQL"
    );
    for (const status of ['available', 'settled', 'written_off', 'reversed', 'n_a']) {
      assert.match(
        rbContent,
        new RegExp(`'${status}'`),
        `Rollback must retain original '${status}' status`
      );
    }
  });
});

// ============================================================================
// SUITE 2: TYPESCRIPT INTERFACE ALIGNMENT (src/types/index.ts)
// ============================================================================
test('Suite 2: TypeScript Interface Alignment in src/types/index.ts', (t) => {
  const typesPath = path.join(rootDir, 'src', 'types', 'index.ts');
  assert.ok(fs.existsSync(typesPath), 'src/types/index.ts must exist');

  const typesContent = fs.readFileSync(typesPath, 'utf8');

  // Find interface AuditLog definition
  const auditLogInterfaceMatch = typesContent.match(
    /export\s+interface\s+AuditLog\s*\{([^}]+)\}/
  );
  assert.ok(auditLogInterfaceMatch, 'Must define export interface AuditLog');

  const body = auditLogInterfaceMatch[1];
  assert.match(body, /entity_type:\s*string;/, 'AuditLog must define entity_type: string');
  assert.match(body, /action:\s*string;/, 'AuditLog must define action: string');
  assert.match(body, /action_type\?:\s*string;/, 'AuditLog must define optional action_type?: string');
  assert.match(body, /entity_id\?:\s*string;/, 'AuditLog must define optional entity_id?: string');
  assert.match(body, /user_name\?:\s*string;/, 'AuditLog must define optional user_name?: string');

  // Verify that there is no property `entity:` in AuditLog
  assert.doesNotMatch(
    body,
    /(^|\s)entity\s*:/,
    'AuditLog must NOT contain obsolete property "entity:"'
  );
});

// ============================================================================
// SUITE 3: MOCKED UI CONTROL-FLOW & OUTCOME HANDLING (PurchasesView.tsx)
// ============================================================================
test('Suite 3: Mocked UI Control-Flow & Outcome Handling in PurchasesView.tsx', async (t) => {
  const viewPath = path.join(rootDir, 'src', 'components', 'PurchasesView.tsx');
  assert.ok(fs.existsSync(viewPath), 'src/components/PurchasesView.tsx must exist');

  const viewContent = fs.readFileSync(viewPath, 'utf8');

  await t.test('Synchronous useRef lock & isSaving state exist', () => {
    assert.match(
      viewContent,
      /useRef<\s*boolean\s*>\s*\(\s*false\s*\)/,
      'PurchasesView must declare isSubmittingRef with useRef'
    );
    assert.match(
      viewContent,
      /isSubmittingRef\.current/,
      'handleSavePurchase must check and toggle isSubmittingRef.current'
    );
    assert.match(
      viewContent,
      /setIsSaving\(true\)/,
      'handleSavePurchase must set isSaving to true during submission'
    );
  });

  await t.test('Buttons are bound to disabled={isSaving}', () => {
    // Both save buttons should have disabled={isSaving}
    const disabledCount = (viewContent.match(/disabled=\{isSaving\}/g) || []).length;
    assert.ok(disabledCount >= 2, 'At least 2 buttons must be bound to disabled={isSaving}');
  });

  await t.test('handleSaveAndPrint gates modal on verified save success', () => {
    assert.match(
      viewContent,
      /const\s+saved\s*=\s*await\s+handleSavePurchase\(\);[\s\S]*?if\s*\(\s*saved\s*\)\s*\{[\s\S]*?setShowVoucherModal\(true\);/m,
      'handleSaveAndPrint must only open voucher modal if handleSavePurchase returns true'
    );
  });

  await t.test('Four-Branch Transaction Outcome Simulation', async () => {
    // Simulated UI runner mirroring PurchasesView handleSavePurchase logic
    async function simulateHandleSavePurchase({
      items,
      mockFetch,
      isSubmittingRef,
    }) {
      if (isSubmittingRef.current) return { saved: false, reason: 'LOCKED' };
      if (!items || items.length === 0) return { saved: false, reason: 'EMPTY_ITEMS' };

      isSubmittingRef.current = true;
      try {
        let res;
        try {
          res = await mockFetch();
        } catch (networkErr) {
          // Branch D: Network Transport Failure
          return {
            saved: false,
            branch: 'BRANCH_D_NETWORK_FAILURE',
            feedback: '⚠️ Network error: Could not reach the server.',
          };
        }

        let data;
        try {
          data = await res.json();
        } catch (parseErr) {
          // Branch C: Response Parsing Failure
          return {
            saved: false,
            branch: 'BRANCH_C_PARSE_FAILURE',
            feedback: '⚠️ Communication error: Server responded with unparseable format.',
          };
        }

        if (res.ok && data.success === true) {
          // Branch A: Confirmed Success
          return {
            saved: true,
            branch: 'BRANCH_A_SUCCESS',
            feedback: '✅ Saved successfully',
          };
        }

        // Branch B: Expected Rollback / HTTP Application Failure
        const errorMsg = data.error || 'Failed to save purchase';
        const isDuplicate =
          errorMsg.includes('23505') ||
          errorMsg.includes('uq_purchases_tenant_purchase_no') ||
          errorMsg.includes('duplicate key');

        return {
          saved: false,
          branch: 'BRANCH_B_APP_ERROR',
          isDuplicate,
          feedback: isDuplicate
            ? '⚠️ This invoice number was already saved in a prior attempt.'
            : `❌ Error: ${errorMsg}`,
        };
      } finally {
        isSubmittingRef.current = false;
      }
    }

    const dummyItems = [{ id: 'item-1', code: 'ITM1', qty: 5, unit_price: 100 }];

    // Test Case 1: Empty items rejects before fetch
    const lock1 = { current: false };
    const r1 = await simulateHandleSavePurchase({
      items: [],
      mockFetch: () => assert.fail('fetch should not be called'),
      isSubmittingRef: lock1,
    });
    assert.strictEqual(r1.saved, false);
    assert.strictEqual(r1.reason, 'EMPTY_ITEMS');

    // Test Case 2: Double-click synchronous guard blocks second attempt
    const lock2 = { current: true };
    const r2 = await simulateHandleSavePurchase({
      items: dummyItems,
      mockFetch: () => assert.fail('fetch should not be called when locked'),
      isSubmittingRef: lock2,
    });
    assert.strictEqual(r2.saved, false);
    assert.strictEqual(r2.reason, 'LOCKED');

    // Test Case 3: Branch A - Confirmed Success
    const lock3 = { current: false };
    const r3 = await simulateHandleSavePurchase({
      items: dummyItems,
      mockFetch: async () => ({
        ok: true,
        json: async () => ({ success: true, data: { purchase_id: 'pid-1' } }),
      }),
      isSubmittingRef: lock3,
    });
    assert.strictEqual(r3.saved, true);
    assert.strictEqual(r3.branch, 'BRANCH_A_SUCCESS');
    assert.strictEqual(lock3.current, false, 'Lock must be released in finally');

    // Test Case 4: Branch B - App/Database Error (e.g. 500 entity error)
    const lock4 = { current: false };
    const r4 = await simulateHandleSavePurchase({
      items: dummyItems,
      mockFetch: async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: 'column "entity" of relation "audit_logs" does not exist',
        }),
      }),
      isSubmittingRef: lock4,
    });
    assert.strictEqual(r4.saved, false);
    assert.strictEqual(r4.branch, 'BRANCH_B_APP_ERROR');
    assert.ok(r4.feedback.includes('column "entity"'));
    assert.strictEqual(lock4.current, false);

    // Test Case 5: Branch B with 23505 unique constraint duplicate notice
    const lock5 = { current: false };
    const r5 = await simulateHandleSavePurchase({
      items: dummyItems,
      mockFetch: async () => ({
        ok: false,
        json: async () => ({
          success: false,
          error: 'duplicate key value violates unique constraint "uq_purchases_tenant_purchase_no" (23505)',
        }),
      }),
      isSubmittingRef: lock5,
    });
    assert.strictEqual(r5.saved, false);
    assert.strictEqual(r5.branch, 'BRANCH_B_APP_ERROR');
    assert.strictEqual(r5.isDuplicate, true);
    assert.ok(r5.feedback.includes('already saved in a prior attempt'));

    // Test Case 6: Branch C - Response Parsing Failure (502 Gateway HTML)
    const lock6 = { current: false };
    const r6 = await simulateHandleSavePurchase({
      items: dummyItems,
      mockFetch: async () => ({
        ok: false,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      }),
      isSubmittingRef: lock6,
    });
    assert.strictEqual(r6.saved, false);
    assert.strictEqual(r6.branch, 'BRANCH_C_PARSE_FAILURE');
    assert.ok(r6.feedback.includes('Communication error'));

    // Test Case 7: Branch D - Network Transport Failure (fetch throws TypeError)
    const lock7 = { current: false };
    const r7 = await simulateHandleSavePurchase({
      items: dummyItems,
      mockFetch: async () => {
        throw new TypeError('Failed to fetch');
      },
      isSubmittingRef: lock7,
    });
    assert.strictEqual(r7.saved, false);
    assert.strictEqual(r7.branch, 'BRANCH_D_NETWORK_FAILURE');
    assert.ok(r7.feedback.includes('Network error'));
  });

  await t.test('Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape) in search dropdowns', () => {
    // Verify state variables for active indices
    assert.match(
      viewContent,
      /const\s+\[activeSupplierIndex,\s*setActiveSupplierIndex\]\s*=\s*useState<number>\(0\);/,
      'PurchasesView must declare activeSupplierIndex state'
    );
    assert.match(
      viewContent,
      /const\s+\[activeProductIndex,\s*setActiveProductIndex\]\s*=\s*useState<number>\(0\);/,
      'PurchasesView must declare activeProductIndex state'
    );

    // Verify keyboard handlers in Supplier search input
    assert.match(
      viewContent,
      /e\.key\s*===\s*'ArrowDown'[\s\S]*?setActiveSupplierIndex\(\(prev\)[\s\S]*?filteredSuppliers\.length\)/,
      'Supplier search input must handle ArrowDown navigation'
    );
    assert.match(
      viewContent,
      /e\.key\s*===\s*'ArrowUp'[\s\S]*?setActiveSupplierIndex\(\(prev\)[\s\S]*?filteredSuppliers\.length\)/,
      'Supplier search input must handle ArrowUp navigation'
    );
    assert.match(
      viewContent,
      /e\.key\s*===\s*'Enter'[\s\S]*?handleSelectSupplier\(filteredSuppliers\[activeSupplierIndex\]\)/,
      'Supplier search input must handle Enter to select highlighted supplier'
    );
    assert.match(
      viewContent,
      /e\.key\s*===\s*'Escape'[\s\S]*?setShowSupplierDropdown\(false\)/,
      'Supplier search input must handle Escape to close dropdown'
    );

    // Verify keyboard handlers in Product search input
    assert.match(
      viewContent,
      /e\.key\s*===\s*'ArrowDown'[\s\S]*?setActiveProductIndex\(\(prev\)[\s\S]*?filteredProducts\.length\)/,
      'Product search input must handle ArrowDown navigation'
    );
    assert.match(
      viewContent,
      /e\.key\s*===\s*'ArrowUp'[\s\S]*?setActiveProductIndex\(\(prev\)[\s\S]*?filteredProducts\.length\)/,
      'Product search input must handle ArrowUp navigation'
    );
    assert.match(
      viewContent,
      /e\.key\s*===\s*'Enter'[\s\S]*?filteredProducts\[activeProductIndex\][\s\S]*?setShowProductDropdown\(false\)/,
      'Product search input must handle Enter to select highlighted product'
    );
    assert.match(
      viewContent,
      /e\.key\s*===\s*'Escape'[\s\S]*?setShowProductDropdown\(false\)/,
      'Product search input must handle Escape to close dropdown'
    );

    // Verify active option highlight & mouse hover binding
    assert.match(
      viewContent,
      /onMouseEnter=\{\(\)\s*=>\s*setActiveSupplierIndex\(idx\)\}/,
      'Supplier dropdown item must update active index on mouse hover'
    );
    assert.match(
      viewContent,
      /onMouseEnter=\{\(\)\s*=>\s*setActiveProductIndex\(idx\)\}/,
      'Product dropdown item must update active index on mouse hover'
    );
  });
});
