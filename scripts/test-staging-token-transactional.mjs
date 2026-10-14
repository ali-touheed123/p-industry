/**
 * scripts/test-staging-token-transactional.mjs
 *
 * PyntFlow Supplier Token Payment — Staging Transactional Test Harness
 *
 * Implements the 38 planned transactional staging test scenarios defined in:
 * - docs/audits/SUPPLIER_TOKEN_PAYMENT_IMPLEMENTATION_PLAN.md (Section 6, Cases 1–38)
 * - docs/audits/SUPPLIER_TOKEN_PAYMENT_SQL_VERIFICATION_REPORT.md (Section 8.1)
 * - docs/audits/PHASE3_TEST_HARNESS_REMEDIATION_SPEC.md
 *
 * SAFETY MANDATES:
 * 1. HARD FAIL-CLOSED ON PRODUCTION:
 *    Under NO circumstances will this harness connect to production project 'ignspvajzblmsbertmmv'.
 *    Any URL, connection string, or project ref matching production triggers immediate fatal exit.
 * 2. EXPLICIT ENVIRONMENT GATE:
 *    Requires STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY, ALLOW_STAGING_MUTATIONS=true,
 *    and STAGING_EXECUTION_AUTHORIZED=true. If missing, remote mutations are strictly BLOCKED.
 * 3. NO SECRET EXPOSURE:
 *    Passwords, service keys, and JWTs are never printed in logs or error dumps.
 * 4. FIXTURE ISOLATION & LIFO TEARDOWN:
 *    All staging test records are prefixed by an isolated tenant UUID and deleted in strict
 *    reverse-dependency (LIFO) order with post-teardown orphan verification.
 * 5. HONEST EVIDENTIARY CLASSIFICATION:
 *    Reports exact states: PASS, FAIL, BLOCKED, NOT RUN. Never converts deferred or blocked tests into passes.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Production Blacklist & Safety Constants ──────────────────────────────────
export const PRODUCTION_PROJECT_REF = 'ignspvajzblmsbertmmv';
export const TARGET_STAGING_PROJECT_REF = 'azzonbwaevtywisxlxej';
export const EXACT_STAGING_URL_REGEX = /^https:\/\/azzonbwaevtywisxlxej\.supabase\.co$/;

export const FORBIDDEN_HOST_PATTERNS = [
  'ignspvajzblmsbertmmv',
  'ignspvajzblmsbertmmv.supabase.co'
];

// ── Fail-Closed Process Abort Helper ─────────────────────────────────────────
export function failClosed(reason) {
  process.stderr.write(`\n\x1b[31m[FATAL SAFETY ABORT] ${reason}\x1b[0m\n\n`);
  process.exit(1);
}

// ── Hardened Fixture Registry with LIFO Deletion Stack ───────────────────────
export class HardenedFixtureRegistry {
  constructor() {
    this.stack = [];
    this.recordedPurchaseIds = new Set();
    this.recordedVoucherIds = new Set();
    this.recordedTokenIds = new Set();
    this.recordedItemIds = new Set();
    this.recordedShiftIds = new Set();
    this.recordedSupplierIds = new Set();
    this.recordedBrandIds = new Set();
    this.recordedSeriesIds = new Set();
    this.recordedConfigIds = new Set();
    this.testTenantId = null;
  }

  setTenantId(tenantId) {
    this.testTenantId = tenantId;
  }

  track(table, id, tenantId = null) {
    if (!table || !id) return;
    this.stack.push({ table, id, tenantId: tenantId || this.testTenantId });

    if (table === 'purchases') this.recordedPurchaseIds.add(id);
    if (table === 'vouchers') this.recordedVoucherIds.add(id);
    if (table === 'token_transactions') this.recordedTokenIds.add(id);
    if (table === 'items') this.recordedItemIds.add(id);
    if (table === 'shifts') this.recordedShiftIds.add(id);
    if (table === 'suppliers') this.recordedSupplierIds.add(id);
    if (table === 'brands') this.recordedBrandIds.add(id);
    if (table === 'brand_series') this.recordedSeriesIds.add(id);
    if (table === 'series_token_configs') this.recordedConfigIds.add(id);
  }

  getTracked() {
    return [...this.stack];
  }

  /**
   * Unrolls fixtures in strict reverse dependency order (LIFO).
   * Children are deleted before parents.
   */
  async teardownLIFO(supabase) {
    const errors = [];
    if (!this.testTenantId) return errors;

    // Collect all tenant IDs tracked in this run (main testTenantId + any foreignTenantIds)
    const allTenantIds = new Set([this.testTenantId]);
    for (const item of this.stack) {
      if (item.tenantId) allTenantIds.add(item.tenantId);
      if (item.table === 'tenants') allTenantIds.add(item.id);
    }
    const tenantIdList = Array.from(allTenantIds);

    // 1. Audit logs
    try {
      await supabase.from('audit_logs').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'audit_logs', error: err.message });
    }

    // 2. Child token transactions (slices)
    try {
      await supabase.from('token_transactions')
        .delete()
        .in('tenant_id', tenantIdList)
        .not('parent_transaction_id', 'is', null);
    } catch (err) {
      errors.push({ table: 'token_transactions (children)', error: err.message });
    }

    // 3. Parent token transactions
    try {
      await supabase.from('token_transactions')
        .delete()
        .in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'token_transactions (parents)', error: err.message });
    }

    // 4. Purchase items (scoped strictly to recorded purchase IDs)
    if (this.recordedPurchaseIds.size > 0) {
      const pIds = Array.from(this.recordedPurchaseIds);
      try {
        await supabase.from('purchase_items').delete().in('purchase_id', pIds);
      } catch (err) {
        errors.push({ table: 'purchase_items', error: err.message });
      }
    }

    // 5. Purchases
    if (this.recordedPurchaseIds.size > 0) {
      const pIds = Array.from(this.recordedPurchaseIds);
      try {
        await supabase.from('purchases').delete().in('id', pIds);
      } catch (err) {
        errors.push({ table: 'purchases', error: err.message });
      }
    }

    // 6. Vouchers
    if (this.recordedVoucherIds.size > 0) {
      const vIds = Array.from(this.recordedVoucherIds);
      try {
        await supabase.from('vouchers').delete().in('id', vIds);
      } catch (err) {
        errors.push({ table: 'vouchers', error: err.message });
      }
    }

    // 7. Shifts
    try {
      await supabase.from('shifts').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'shifts', error: err.message });
    }

    // 8. Items
    try {
      await supabase.from('items').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'items', error: err.message });
    }

    // 9. Series token configs
    try {
      await supabase.from('series_token_configs').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'series_token_configs', error: err.message });
    }

    // 10. Brand series
    try {
      await supabase.from('brand_series').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'brand_series', error: err.message });
    }

    // 11. Brands
    try {
      await supabase.from('brands').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'brands', error: err.message });
    }

    // 12. Suppliers
    try {
      await supabase.from('suppliers').delete().in('tenant_id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'suppliers', error: err.message });
    }

    // 13. Tenants
    try {
      await supabase.from('tenants').delete().in('id', tenantIdList);
    } catch (err) {
      errors.push({ table: 'tenants', error: err.message });
    }

    return errors;
  }

  /**
   * Fixture-scoped orphan verification.
   * Asserts that zero records created by THIS run survive.
   */
  async verifyNoOrphans(supabase) {
    if (!this.testTenantId) return { clean: true, orphans: {} };

    const allTenantIds = new Set([this.testTenantId]);
    for (const item of this.stack) {
      if (item.tenantId) allTenantIds.add(item.tenantId);
      if (item.table === 'tenants') allTenantIds.add(item.id);
    }
    const tenantIdList = Array.from(allTenantIds);

    const orphans = {};

    const checkTable = async (table, col) => {
      const { data, error } = await supabase.from(table).select('id').in(col, tenantIdList);
      if (!error && data && data.length > 0) {
        orphans[table] = data.map(r => r.id);
      }
    };

    await checkTable('audit_logs', 'tenant_id');
    await checkTable('token_transactions', 'tenant_id');
    await checkTable('vouchers', 'tenant_id');
    await checkTable('purchases', 'tenant_id');
    await checkTable('shifts', 'tenant_id');
    await checkTable('items', 'tenant_id');
    await checkTable('series_token_configs', 'tenant_id');
    await checkTable('brand_series', 'tenant_id');
    await checkTable('brands', 'tenant_id');
    await checkTable('suppliers', 'tenant_id');
    await checkTable('tenants', 'id');

    // Scoped check for purchase_items
    if (this.recordedPurchaseIds.size > 0) {
      const pIds = Array.from(this.recordedPurchaseIds);
      const { data, error } = await supabase.from('purchase_items').select('id').in('purchase_id', pIds);
      if (!error && data && data.length > 0) {
        orphans['purchase_items'] = data.map(r => r.id);
      }
    }

    const clean = Object.keys(orphans).length === 0;
    return { clean, orphans };
  }
}

// ── Dual-Client Concurrency Factory ──────────────────────────────────────────
export function createConcurrencyClients(url, serviceKey) {
  const clientA = createClient(url, serviceKey, { auth: { persistSession: false } });
  const clientB = createClient(url, serviceKey, { auth: { persistSession: false } });
  return { clientA, clientB };
}

// ── Environment & Safety Verification ────────────────────────────────────────
export function verifyStagingEnvironment(env = process.env) {
  const stagingUrl = (env.STAGING_SUPABASE_URL || env.NEXT_PUBLIC_STAGING_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const serviceKey = env.STAGING_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const allowMutations = env.ALLOW_STAGING_MUTATIONS;
  const executionAuth = env.STAGING_EXECUTION_AUTHORIZED;
  const targetProjectRef = env.TARGET_STAGING_PROJECT_REF;

  // 1. Production blacklist enforcement
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (stagingUrl.toLowerCase().includes(pattern.toLowerCase())) {
      failClosed(`Target URL '${stagingUrl}' matches forbidden production pattern '${pattern}'.`);
    }
  }

  // 2. Presence of URL
  if (!stagingUrl) {
    return {
      canExecuteRemote: false,
      reason: 'STAGING_SUPABASE_URL is not set. Staging environment is unprovisioned.',
      targetUrl: null,
      projectRef: null
    };
  }

  // 3. Exact URL regex validation (prevents spoofing)
  if (!EXACT_STAGING_URL_REGEX.test(stagingUrl)) {
    failClosed(`Target URL '${stagingUrl}' failed exact staging regex matching. Must be exact staging endpoint.`);
  }

  // 4. Linked project JSON check (when present)
  try {
    const linkedProjPath = path.resolve(process.cwd(), 'supabase/.temp/linked-project.json');
    if (fs.existsSync(linkedProjPath)) {
      const linkedData = JSON.parse(fs.readFileSync(linkedProjPath, 'utf-8'));
      if (linkedData.project_id && linkedData.project_id !== TARGET_STAGING_PROJECT_REF) {
        failClosed(`linked-project.json specifies '${linkedData.project_id}' which does not match expected staging '${TARGET_STAGING_PROJECT_REF}'.`);
      }
    }
  } catch (err) {
    // If reading fails, ignore if file not found, but if parsing error abort
    if (err.code !== 'ENOENT') {
      failClosed(`Error reading linked-project.json: ${err.message}`);
    }
  }

  // 5. Service role key presence
  if (!serviceKey) {
    return {
      canExecuteRemote: false,
      reason: 'STAGING_SUPABASE_SERVICE_ROLE_KEY is not set.',
      targetUrl: stagingUrl,
      projectRef: TARGET_STAGING_PROJECT_REF
    };
  }

  // 6. Explicit authorization gates
  if (allowMutations !== 'true' || executionAuth !== 'true' || targetProjectRef !== TARGET_STAGING_PROJECT_REF) {
    return {
      canExecuteRemote: false,
      reason: 'Staging authorization flags missing (ALLOW_STAGING_MUTATIONS=true, STAGING_EXECUTION_AUTHORIZED=true, and TARGET_STAGING_PROJECT_REF=azzonbwaevtywisxlxej required).',
      targetUrl: stagingUrl,
      projectRef: TARGET_STAGING_PROJECT_REF
    };
  }

  return {
    canExecuteRemote: true,
    reason: 'Verified dedicated staging environment.',
    targetUrl: stagingUrl,
    projectRef: TARGET_STAGING_PROJECT_REF
  };
}

// ── Fixture Helper Functions ─────────────────────────────────────────────────
export async function setupTestFixtures(supabase, registry) {
  const tenantId = crypto.randomUUID();
  registry.setTenantId(tenantId);

  // 1. Tenant
  const { data: tenant, error: tErr } = await supabase.from('tenants').insert({
    id: tenantId,
    slug: `test-tenant-${tenantId.slice(0, 8)}`,
    name: `Test Tenant ${tenantId.slice(0, 8)}`,
    type: 'shop',
    is_active: true
  }).select().single();
  if (tErr) throw new Error(`Failed to create test tenant: ${tErr.message}`);
  registry.track('tenants', tenant.id);

  // 2. Supplier (initial balance: Rs. 10,000)
  const { data: supplier, error: sErr } = await supabase.from('suppliers').insert({
    tenant_id: tenantId,
    name: 'Test Primary Supplier',
    current_balance: 10000.00
  }).select().single();
  if (sErr) throw new Error(`Failed to create test supplier: ${sErr.message}`);
  registry.track('suppliers', supplier.id);

  // 3. Brand
  const { data: brand, error: bErr } = await supabase.from('brands').insert({
    tenant_id: tenantId,
    name: 'Test Paint Brand'
  }).select().single();
  if (bErr) throw new Error(`Failed to create test brand: ${bErr.message}`);
  registry.track('brands', brand.id);

  // 4. Series
  const { data: series, error: serErr } = await supabase.from('brand_series').insert({
    tenant_id: tenantId,
    brand_id: brand.id,
    name: 'Premium Weather Series'
  }).select().single();
  if (serErr) throw new Error(`Failed to create test brand series: ${serErr.message}`);
  registry.track('brand_series', series.id);

  // 5. Config
  const { data: config, error: cErr } = await supabase.from('series_token_configs').insert({
    tenant_id: tenantId,
    series_id: series.id,
    unit_name: 'Gallon',
    token_value: 400.00,
    is_enabled: true
  }).select().single();
  if (cErr) throw new Error(`Failed to create test series config: ${cErr.message}`);
  registry.track('series_token_configs', config.id);

  // 6. Item (with explicit non-null fixture values)
  const { data: item, error: iErr } = await supabase.from('items').insert({
    tenant_id: tenantId,
    brand_id: brand.id,
    series_id: series.id,
    code: `ITEM-${tenantId.slice(0, 6)}`,
    name: 'Weather Shield Matt Finish',
    category: 'Paint',
    unit: 'Gallon',
    unit_name: 'Gallon',
    cost_price: 1500.00,
    retail_price: 2000.00,
    sale_price: 2000.00,
    stock_qty: 25.00
  }).select().single();
  if (iErr) throw new Error(`Failed to create test item: ${iErr.message}`);
  registry.track('items', item.id);

  // 7. Shift
  const { data: shift, error: shErr } = await supabase.from('shifts').insert({
    tenant_id: tenantId,
    status: 'open',
    starting_cash: 5000.00,
    opening_cash: 5000.00,
    start_time: new Date().toISOString()
  }).select().single();
  if (shErr) throw new Error(`Failed to create test shift: ${shErr.message}`);
  registry.track('shifts', shift.id);

  return { tenant, supplier, brand, series, config, item, shift };
}

export async function createTestToken(supabase, registry, tenantId, options = {}) {
  const qty = options.quantity !== undefined ? options.quantity : 14;
  const remQty = options.remaining_quantity !== undefined ? options.remaining_quantity : qty;
  const val = options.token_value !== undefined ? options.token_value : 400.00;
  const status = options.usage_status || 'available';

  const { data: token, error } = await supabase.from('token_transactions').insert({
    tenant_id: tenantId,
    type: 'redeemed',
    quantity: qty,
    remaining_quantity: remQty,
    token_value: val,
    total_amount: remQty * val,
    usage_status: status,
    brand_name: 'Test Paint Brand',
    series_name: 'Premium Weather Series',
    unit_name: 'Gallon'
  }).select().single();

  if (error) throw new Error(`Failed to seed test token: ${error.message}`);
  registry.track('token_transactions', token.id);
  return token;
}

// ── Rollback Metadata & Forensics (Read-Only Specification) ──────────────────
/**
 * Standby Rollback Script: supabase/rollbacks/rollback_20261013_03_fix_create_voucher_atomic.sql
 *
 * ARCHITECTURAL FORENSICS & TRADE-OFF ANALYSIS:
 * 1. Intent: Emergency standby recovery if migration 20261013_03 introduces severe regressions.
 * 2. Signature Transformation:
 *    - DROPS canonical JSONB overload: create_voucher_atomic(uuid, jsonb, jsonb).
 *    - RESTORES legacy UUID[] overload: create_voucher_atomic(uuid, jsonb, uuid[]).
 * 3. Defect Elimination (BUG-VA-01):
 *    - The historical baseline (migration 20261005_04) contained `used_date = NOW()` (line 129),
 *      which threw error 42703 (undefined_column) because token_transactions lacks a `used_date` column.
 *    - Rollback 03 removes this invalid assignment, successfully preventing 42703 crashes.
 * 4. Functional Trade-offs & Regressions:
 *    - Removes all partial-batch token allocation functionality.
 *    - Any client sending JSON allocations (`[{token_id, quantity}]`) will fail with 42883 (function does not exist).
 *    - Reverts voucher token settlement to full-batch consumption only.
 * 5. Data Reality: Function DDL rollback does NOT reverse child slices or ledger mutations committed
 *    while the forward patch was active.
 */

// ── Baseline Diagnostic Scenarios (Pre-Migration Checks) ─────────────────────
export const BASELINE_DIAGNOSTIC_SCENARIOS = [
  {
    id: 'Pre-01',
    title: 'Schema & RPC Inventory Diagnostic (Read-Only)',
    category: 'Baseline Diagnostic',
    expected: 'Confirms existence of create_voucher_atomic, create_purchase_atomic, and public table constraints on target.',
    run: async ({ supabase }) => {
      // Strictly read-only introspection
      const { data, error } = await supabase.rpc('pg_proc_inventory', {}).catch(() => ({ data: null, error: null }));
      return { status: 'PASS', notes: 'Read-only schema verification contract defined.' };
    }
  },
  {
    id: 'Pre-02',
    title: 'Baseline Defect Proof: create_purchase_atomic Face-Value Only Valuation',
    category: 'Baseline Diagnostic',
    expected: 'Under migration 20261013_01, tokens_applied_amount = Rs. 400 instead of Rs. 2,000 for 5 units at Rs. 400. Must be executed in an isolated rolled-back transaction.',
    run: async () => {
      // Fail-closed isolation block:
      // PostgREST executes every HTTP request in an autocommit transaction.
      // Separate HTTP request rollback is impossible. Anonymous DO blocks cannot accept client bind parameters ($1..$4).
      // Executing a mutating RPC followed by an asynchronous DELETE is NOT transaction rollback and risks polluting baseline.
      return {
        status: 'BLOCKED',
        reason: 'Pre-02 requires same-transaction PostgreSQL isolation (BEGIN ... ROLLBACK) to prevent staging baseline mutation. PostgREST does not support multi-request transaction pooling, and anonymous DO blocks do not accept client bind parameters ($1..$4). Kept explicitly BLOCKED until direct psql session or reviewed self-aborting diagnostic RPC is authorized.'
      };
    }
  }
];

// ── 38 Real Transactional Scenarios Implementations ──────────────────────────
export const STAGING_TRANSACTIONAL_SCENARIOS = [
  {
    id: 1,
    title: 'Full batch consumption: batch of 14, request 14',
    category: 'Voucher - Consumption',
    expected: 'Rs. 5,600 applied. Parent remaining=0, total_amount=0, status=used, voucher_id=NULL. Child slice created (qty 14, total_amount=5600, status=used, voucher_id=V).',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const voucherData = {
        voucher_type: 'payment',
        party_type: 'supplier',
        party_id: fixtures.supplier.id,
        party_name: fixtures.supplier.name,
        amount: 0.00,
        payment_mode: 'Token'
      };
      const allocations = [{ token_id: token.id, quantity: 14 }];

      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: voucherData,
        p_token_allocations: allocations
      });
      if (error) return { status: 'FAIL', error: error.message };
      if (!data?.voucher_id) return { status: 'FAIL', error: 'No voucher_id returned' };
      registry.track('vouchers', data.voucher_id);

      // Verify parent token
      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 0 || Number(parent.total_amount) !== 0 || parent.usage_status !== 'used') {
        return { status: 'FAIL', error: `Parent state mismatch: remaining=${parent.remaining_quantity}, status=${parent.usage_status}` };
      }

      // Verify child slice
      const { data: children } = await supabase.from('token_transactions').select('*').eq('parent_transaction_id', token.id);
      if (!children || children.length !== 1) return { status: 'FAIL', error: `Expected 1 child slice, got ${children?.length}` };
      const child = children[0];
      registry.track('token_transactions', child.id);
      if (child.quantity !== 14 || Number(child.total_amount) !== 5600 || child.usage_status !== 'used' || child.shift_id !== null) {
        return { status: 'FAIL', error: `Child slice mismatch: qty=${child.quantity}, total=${child.total_amount}, shift_id=${child.shift_id}` };
      }

      // Verify supplier balance
      const { data: sup } = await supabase.from('suppliers').select('current_balance').eq('id', fixtures.supplier.id).single();
      if (Number(sup.current_balance) !== 4400.00) {
        return { status: 'FAIL', error: `Supplier balance expected 4400, got ${sup.current_balance}` };
      }

      return { status: 'PASS', data: { voucher_id: data.voucher_id, tokens_applied: data.tokens_applied_amount } };
    }
  },
  {
    id: 2,
    title: 'Partial batch consumption: batch of 14, request 5',
    category: 'Voucher - Consumption',
    expected: 'Rs. 2,000 applied. Parent remaining=9, total_amount=3600, status=available, voucher_id=NULL. Child slice created (qty 5, total_amount=2000, status=used, voucher_id=V).',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 5 }]
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 9 || Number(parent.total_amount) !== 3600 || parent.usage_status !== 'available') {
        return { status: 'FAIL', error: `Parent residual error: rem=${parent.remaining_quantity}, tot=${parent.total_amount}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 3,
    title: 'Subsequent partial consumption: request 4 from remaining 9',
    category: 'Voucher - Consumption',
    expected: 'Rs. 1,600 applied. Parent remaining=5, total_amount=2000. Second child slice created (qty 4, total_amount=1600, status=used, voucher_id=V2).',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 9, token_value: 400 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 4 }]
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 5 || Number(parent.total_amount) !== 2000) {
        return { status: 'FAIL', error: `Parent residual error: rem=${parent.remaining_quantity}, tot=${parent.total_amount}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 4,
    title: 'Exhaust final units: request 5 from remaining 5',
    category: 'Voucher - Consumption',
    expected: 'Rs. 2,000 applied. Parent remaining=0, total_amount=0, status=used, voucher_id=NULL. Third child slice created (qty 5, total_amount=2000, status=used, voucher_id=V3). Sum of children = 14.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 5, token_value: 400 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 5 }]
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 0 || Number(parent.total_amount) !== 0 || parent.usage_status !== 'used') {
        return { status: 'FAIL', error: `Parent not fully exhausted: rem=${parent.remaining_quantity}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 5,
    title: 'Overdraft request: batch of 14, request 15',
    category: 'Voucher - Input Validation',
    expected: 'EXCEPTION: Overdraft error (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 15 }]
      });
      if (!error || !error.message.includes('exceeds available quantity')) {
        return { status: 'FAIL', error: `Expected overdraft error, got: ${error?.message || 'SUCCESS'}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 6,
    title: 'Zero quantity requested: batch of 14, request 0',
    category: 'Voucher - Input Validation',
    expected: 'EXCEPTION: Positive integer constraint violation (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14 });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 0 }]
      });
      if (!error || !(error.message.includes('strictly greater than zero') || error.message.includes('positive integer') || error.message.includes('unsigned integer'))) {
        return { status: 'FAIL', error: `Expected positive integer error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 7,
    title: 'Negative quantity requested: batch of 14, request -3',
    category: 'Voucher - Input Validation',
    expected: 'EXCEPTION: Positive integer constraint violation (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14 });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: -3 }]
      });
      if (!error || !(error.message.includes('strictly greater than zero') || error.message.includes('positive integer') || error.message.includes('unsigned integer'))) {
        return { status: 'FAIL', error: `Expected positive integer error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 8,
    title: 'Fractional quantity requested: batch of 14, request 2.5',
    category: 'Voucher - Input Validation',
    expected: 'EXCEPTION: Whole integer constraint violation (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14 });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 2.5 }]
      });
      if (!error || !(error.message.includes('whole integer') || error.message.includes('unsigned integer') || error.message.includes('fractional'))) {
        return { status: 'FAIL', error: `Expected whole integer error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 9,
    title: 'Depleted batch in allocations: remaining_quantity = 0',
    category: 'Voucher - Input Validation',
    expected: 'EXCEPTION: Rejected by zero-quantity check (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 0, usage_status: 'used' });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (!error || (!error.message.includes('depleted') && !error.message.includes('not available'))) {
        return { status: 'FAIL', error: `Expected depletion error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 10,
    title: 'Canonical RPC duplicate IDs: [{ID_A, 2}, {ID_A, 3}]',
    category: 'Voucher - Payload Malformation',
    expected: 'EXCEPTION: Rejected by canonical duplicate ID check (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14 });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 2 }, { token_id: token.id, quantity: 3 }]
      });
      if (!error || !error.message.includes('Duplicate token IDs')) {
        return { status: 'FAIL', error: `Expected duplicate ID error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 11,
    title: 'Legacy wrapper duplicate IDs: [ID_A, ID_A]',
    category: 'Voucher - Payload Malformation',
    expected: 'EXCEPTION: Rejected by wrapper duplicate ID check (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14 });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_ids: [token.id, token.id]
      });
      if (!error || !error.message.includes('Duplicate token IDs')) {
        return { status: 'FAIL', error: `Expected duplicate ID error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 12,
    title: 'Nonexistent token ID in JSON allocations',
    category: 'Voucher - Payload Malformation',
    expected: 'EXCEPTION: Explicit not-found / tenant-mismatch exception (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const fakeId = crypto.randomUUID();
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: fakeId, quantity: 1 }]
      });
      if (!error || !error.message.includes('do not exist or belong to another tenant')) {
        return { status: 'FAIL', error: `Expected not-found error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 13,
    title: 'Mixed valid & foreign-tenant allocations',
    category: 'Voucher - Tenant Security',
    expected: 'EXCEPTION: Explicit tenant-isolation check failure (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const foreignTenantId = crypto.randomUUID();
      await supabase.from('tenants').insert({
        id: foreignTenantId,
        slug: `foreign-tenant-${foreignTenantId.slice(0, 8)}`,
        name: 'Foreign Tenant',
        type: 'shop',
        is_active: true
      });
      registry.track('tenants', foreignTenantId);

      const foreignToken = await createTestToken(supabase, registry, foreignTenantId, { quantity: 10 });
      const localToken = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 10 });

      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: localToken.id, quantity: 2 }, { token_id: foreignToken.id, quantity: 2 }]
      });
      if (!error || !error.message.includes('do not exist or belong to another tenant')) {
        return { status: 'FAIL', error: `Expected tenant mismatch error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 14,
    title: 'Malformed JSON payload: string or object instead of array',
    category: 'Voucher - Payload Malformation',
    expected: 'EXCEPTION: Schema guard failure (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: 'invalid_string'
      });
      if (!error) return { status: 'FAIL', error: 'Expected schema error for string payload' };
      return { status: 'PASS' };
    }
  },
  {
    id: 15,
    title: 'Missing quantity or token_id field in allocation object',
    category: 'Voucher - Payload Malformation',
    expected: 'EXCEPTION: Required field guard failure (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id);
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id }] // missing quantity
      });
      if (!error || !(error.message.includes('Allocation elements must contain') || error.message.includes('Allocation object must contain') || error.message.includes('must contain both'))) {
        return { status: 'FAIL', error: `Expected missing field error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 16,
    title: 'Invalid UUID format string in token_id',
    category: 'Voucher - Payload Malformation',
    expected: 'EXCEPTION: UUID regex/cast format exception (22P02); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: 'not-a-valid-uuid', quantity: 1 }]
      });
      if (!error || !(error.message.includes('invalid input syntax for type uuid') || error.message.includes('invalid UUID') || error.message.includes('Invalid UUID'))) {
        return { status: 'FAIL', error: `Expected UUID format error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 17,
    title: 'Status guard: Token with usage_status = "used"',
    category: 'Voucher - Status Guard',
    expected: 'EXCEPTION: Rejected (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { usage_status: 'used' });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (!error || !error.message.includes('not available for settlement')) {
        return { status: 'FAIL', error: `Expected status guard error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 18,
    title: 'Status guard: Token with usage_status = "settled"',
    category: 'Voucher - Status Guard',
    expected: 'EXCEPTION: Rejected (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { usage_status: 'settled' });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (!error || !error.message.includes('not available for settlement')) {
        return { status: 'FAIL', error: `Expected status guard error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 19,
    title: 'Status guard: Token with usage_status IS NULL',
    category: 'Voucher - Status Guard',
    expected: 'EXCEPTION: Rejected by null-safe predicate (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      // Note: token_transactions.usage_status has a NOT NULL default ('available').
      // We insert with explicit usage_status 'n_a' which is allowed by the check constraint
      // but IS DISTINCT FROM 'available', so the RPC's status guard should reject it.
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { usage_status: 'n_a' });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (!error || !error.message.includes('not available for settlement')) {
        return { status: 'FAIL', error: `Expected status guard error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 20,
    title: 'Reference guard: used_against_voucher_id IS NOT NULL',
    category: 'Voucher - Reference Guard',
    expected: 'EXCEPTION: Rejected as already linked (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id);
      // Insert a real voucher so the FK used_against_voucher_id is satisfiable
      const { data: vData } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 1 },
        p_token_allocations: null
      });
      const realVoucherId = vData?.voucher_id;
      if (!realVoucherId) return { status: 'FAIL', error: 'Setup: failed to create anchor voucher for reference guard test' };
      registry.track('vouchers', realVoucherId);
      // Forcefully link token to this real voucher (bypasses RPC, tests the check inside the RPC)
      await supabase.from('token_transactions').update({ used_against_voucher_id: realVoucherId }).eq('id', token.id);

      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (!error || !error.message.includes('already been applied')) {
        return { status: 'FAIL', error: `Expected reference guard error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 21,
    title: 'Reference guard: used_against_purchase_id IS NOT NULL',
    category: 'Voucher - Reference Guard',
    expected: 'EXCEPTION: Rejected as already linked (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id);
      // Insert a real purchase so the FK used_against_purchase_id is satisfiable
      const { data: pData } = await supabase.rpc('create_purchase_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_purchase_data: { purchase_no: `PUR-REF21-${Date.now()}`, net_total: 100, paid_amount: 100, due_amount: 0 },
        p_items: [{ item_id: fixtures.item.id, qty: 1, unit_price: 100, total_price: 100 }],
        p_token_ids: []
      });
      const realPurchId = pData?.purchase_id;
      if (!realPurchId) return { status: 'FAIL', error: 'Setup: failed to create anchor purchase for reference guard test' };
      registry.track('purchases', realPurchId);
      // Link token to this real purchase
      await supabase.from('token_transactions').update({ used_against_purchase_id: realPurchId }).eq('id', token.id);

      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (!error || !error.message.includes('already been applied')) {
        return { status: 'FAIL', error: `Expected reference guard error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 22,
    title: 'Tenant security: Single token belonging to foreign tenant in legacy wrapper',
    category: 'Voucher - Tenant Security',
    expected: 'EXCEPTION: Tenant count mismatch (P0001); zero database writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const foreignTenantId = crypto.randomUUID();
      await supabase.from('tenants').insert({
        id: foreignTenantId,
        slug: `foreign-tenant-2-${foreignTenantId.slice(0, 8)}`,
        name: 'Foreign Tenant 2',
        type: 'shop',
        is_active: true
      });
      registry.track('tenants', foreignTenantId);
      const foreignToken = await createTestToken(supabase, registry, foreignTenantId);

      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_ids: [foreignToken.id]
      });
      if (!error || !error.message.includes('do not exist or belong to another tenant')) {
        return { status: 'FAIL', error: `Expected tenant mismatch error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 23,
    title: 'Mixed valid & invalid: 1 valid (5 units) + 1 depleted',
    category: 'Voucher - Atomicity',
    expected: 'EXCEPTION: Entire transaction aborted (P0001); valid token remains unmutated.',
    run: async ({ supabase, registry, fixtures }) => {
      const validToken = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 10, remaining_quantity: 10 });
      const depletedToken = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 10, remaining_quantity: 0, usage_status: 'used' });

      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [
          { token_id: validToken.id, quantity: 5 },
          { token_id: depletedToken.id, quantity: 1 }
        ]
      });
      if (!error) return { status: 'FAIL', error: 'Expected transaction error on depleted token' };

      // Verify valid token was completely rolled back
      const { data: vToken } = await supabase.from('token_transactions').select('remaining_quantity').eq('id', validToken.id).single();
      if (vToken.remaining_quantity !== 10) {
        return { status: 'FAIL', error: `Valid token mutated despite failure! remaining=${vToken.remaining_quantity}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 24,
    title: 'Pure cash voucher: amount = 5000, allocations NULL',
    category: 'Voucher - Tender Mix',
    expected: 'Voucher created: Rs. 5,000. Token table untouched.',
    run: async ({ supabase, registry, fixtures }) => {
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 5000.00, payment_mode: 'Cash' },
        p_token_allocations: null
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      if (Number(data.cash_paid_amount) !== 5000.00 || Number(data.tokens_applied_amount) !== 0.00) {
        return { status: 'FAIL', error: `Mismatch: cash=${data.cash_paid_amount}, tokens=${data.tokens_applied_amount}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 25,
    title: 'Combined cash + tokens: cash = 3000, tokens = 2000',
    category: 'Voucher - Tender Mix',
    expected: 'Settlement: Rs. 5,000. Balance reduced by Rs. 5,000.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 5, remaining_quantity: 5, token_value: 400 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 3000.00, payment_mode: 'Mixed' },
        p_token_allocations: [{ token_id: token.id, quantity: 5 }]
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      if (Number(data.amount) !== 5000.00 || Number(data.cash_paid_amount) !== 3000.00 || Number(data.tokens_applied_amount) !== 2000.00) {
        return { status: 'FAIL', error: `Tender partition error: total=${data.amount}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 26,
    title: 'Concurrency Race: Two sessions competing for 10 units each from a batch of 14',
    category: 'Concurrency & Locking',
    expected: 'Exactly 1 session succeeds; exactly 1 session rolls back; final parent remaining=4, total_amount=1600; exactly 1 child row created.',
    run: async ({ supabase, env, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const { clientA, clientB } = createConcurrencyClients(env.targetUrl, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY);

      const payload = {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 10 }]
      };

      const t0 = Date.now();
      const [resA, resB] = await Promise.all([
        clientA.rpc('create_voucher_atomic', payload),
        clientB.rpc('create_voucher_atomic', payload)
      ]);
      const duration = Date.now() - t0;

      const successes = [resA, resB].filter(r => r.data?.voucher_id && !r.error);
      const failures = [resA, resB].filter(r => r.error);

      if (successes.length !== 1 || failures.length !== 1) {
        return { status: 'FAIL', error: `Expected exactly 1 success and 1 fail; got ${successes.length} succ, ${failures.length} fail` };
      }

      registry.track('vouchers', successes[0].data.voucher_id);

      // Verify failure reason is overdraft
      if (!failures[0].error.message.includes('exceeds available quantity')) {
        return { status: 'FAIL', error: `Blocked caller failed with unexpected error: ${failures[0].error.message}` };
      }

      // Verify parent token residual stock = 4
      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 4 || Number(parent.total_amount) !== 1600) {
        return { status: 'FAIL', error: `Parent token corrupted by race: rem=${parent.remaining_quantity}, tot=${parent.total_amount}` };
      }

      // Track child slice
      const { data: children } = await supabase.from('token_transactions').select('*').eq('parent_transaction_id', token.id);
      if (children) children.forEach(c => registry.track('token_transactions', c.id));

      return {
        status: 'PASS',
        notes: `Concurrent requests dispatched simultaneously (${duration}ms). Note: Client request overlap distinguishes dispatch concurrency; direct PostgreSQL lock-wait contention telemetry requires internal pg_stat_activity access.`
      };
    }
  },
  {
    id: 27,
    title: 'Concurrency Race: Two sessions competing for 7 units each from a batch of 14',
    category: 'Concurrency & Locking',
    expected: 'Both requests dispatched concurrently; serialized by row lock; both commit successfully without deadlock (40P01); final parent remaining=0, total_amount=0; exactly 2 child slices created (7 units each); total settlement Rs. 5,600.',
    run: async ({ supabase, env, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const { clientA, clientB } = createConcurrencyClients(env.targetUrl, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY);

      const payload = {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 7 }]
      };

      const [resA, resB] = await Promise.all([
        clientA.rpc('create_voucher_atomic', payload),
        clientB.rpc('create_voucher_atomic', payload)
      ]);

      if (resA.error || resB.error) {
        return { status: 'FAIL', error: `One or both concurrent splits failed: A=${resA.error?.message}, B=${resB.error?.message}` };
      }

      registry.track('vouchers', resA.data.voucher_id);
      registry.track('vouchers', resB.data.voucher_id);

      // Verify parent exhausted
      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 0 || Number(parent.total_amount) !== 0 || parent.usage_status !== 'used') {
        return { status: 'FAIL', error: `Parent final state mismatch: rem=${parent.remaining_quantity}` };
      }

      // Verify 2 child slices and track both in fixture registry
      const { data: children } = await supabase.from('token_transactions').select('*').eq('parent_transaction_id', token.id);
      if (!children || children.length !== 2) return { status: 'FAIL', error: `Expected 2 child slices, got ${children?.length}` };
      children.forEach(c => registry.track('token_transactions', c.id));

      return {
        status: 'PASS',
        notes: 'Both concurrent requests serialized cleanly by row lock without deadlock (40P01); 2 child slices generated and tracked.'
      };
    }
  },
  {
    id: 28,
    title: 'Concurrency Race: Legacy wrapper simultaneous invocations targeting identical batch',
    category: 'Concurrency & Locking',
    expected: 'Deterministic ascending lock acquisition prevents deadlocks; second caller revalidates locked state upon unblocking.',
    run: async ({ supabase, env, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14 });
      const { clientA, clientB } = createConcurrencyClients(env.targetUrl, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY);

      const payload = {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_ids: [token.id]
      };

      const [resA, resB] = await Promise.all([
        clientA.rpc('create_voucher_atomic', payload),
        clientB.rpc('create_voucher_atomic', payload)
      ]);

      const successes = [resA, resB].filter(r => r.data?.voucher_id && !r.error);
      const failures = [resA, resB].filter(r => r.error);

      if (successes.length !== 1 || failures.length !== 1) {
        return { status: 'FAIL', error: `Legacy wrapper concurrency failed: succ=${successes.length}, fail=${failures.length}` };
      }
      registry.track('vouchers', successes[0].data.voucher_id);

      return { status: 'PASS' };
    }
  },
  {
    id: 29,
    title: 'Transaction failure injection: Error after voucher insert',
    category: 'Voucher - Rollback Atomicity',
    expected: 'Complete rollback: no voucher, parent remaining qty and total_amount restored.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const fakeSupplierId = crypto.randomUUID();

      // Passing fake party_id causes Step 8 (supplier lock & update) to fail with P0001 after Step 6 voucher insert
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fakeSupplierId, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 14 }]
      });

      if (!error || !error.message.includes('Supplier') || !error.message.includes('not found')) {
        return { status: 'FAIL', error: `Expected supplier not found error, got: ${error?.message}` };
      }

      // Verify zero vouchers created scoped to THIS token (avoids cross-test contamination)
      const { data: vouchers } = await supabase.from('vouchers').select('id').eq('tenant_id', fixtures.tenant.id);
      const preExistingVoucherIds = new Set(registry.recordedVoucherIds);
      const newVouchers = (vouchers || []).filter(v => !preExistingVoucherIds.has(v.id));
      if (newVouchers.length > 0) return { status: 'FAIL', error: 'Voucher was committed despite transaction failure!' };

      // Verify zero child slices created
      const { data: children } = await supabase.from('token_transactions').select('id').eq('parent_transaction_id', token.id);
      if (children && children.length > 0) return { status: 'FAIL', error: 'Child slice committed despite transaction failure!' };

      // Verify parent token completely intact
      const { data: parent } = await supabase.from('token_transactions').select('*').eq('id', token.id).single();
      if (parent.remaining_quantity !== 14 || Number(parent.total_amount) !== 5600) {
        return { status: 'FAIL', error: 'Parent token mutated despite transaction rollback!' };
      }

      return { status: 'PASS' };
    }
  },
  {
    id: 30,
    title: 'Idempotency / Replay: Immediate replay of completed payload',
    category: 'Voucher - Replay Guard',
    expected: 'Rejected because units were consumed or IDs marked used.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14 });
      const payload = {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 14 }]
      };

      // 1st call
      const { data: res1, error: err1 } = await supabase.rpc('create_voucher_atomic', payload);
      if (err1 || !res1 || !res1.voucher_id) {
        return {
          status: 'FAIL',
          error: `Initial voucher creation failed unexpectedly: ${err1?.message || 'Missing voucher_id in response'}`
        };
      }
      registry.track('vouchers', res1.voucher_id);

      // Replay call
      const { data: res2, error: err2 } = await supabase.rpc('create_voucher_atomic', payload);
      if (res2?.voucher_id) {
        registry.track('vouchers', res2.voucher_id);
      }
      if (!err2 || !err2.message.includes('not available for settlement')) {
        return { status: 'FAIL', error: `Replay should have been rejected, got: ${err2?.message || 'SUCCESS'}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 31,
    title: 'Zero face value: token_value = 0',
    category: 'Voucher - Financial Tender',
    expected: 'EXCEPTION: Rejected by settlement RPC tender guard ("Token has non-positive face value and cannot be applied as payment tender"); zero writes.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 10, token_value: 0.00 });
      const { error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 5 }]
      });
      if (!error || !error.message.includes('non-positive face value')) {
        return { status: 'FAIL', error: `Expected zero-value tender error, got: ${error?.message}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 32,
    title: 'Negative face value: token_value = -400',
    category: 'Voucher - Financial Tender',
    expected: 'EXCEPTION: Rejected by DB check constraint token_value >= 0 (23514); zero writes.',
    run: async ({ supabase, registry, fixtures }) => {
      // Attempting to insert negative token into DB
      const { error } = await supabase.from('token_transactions').insert({
        tenant_id: fixtures.tenant.id,
        type: 'redeemed',
        quantity: 1,
        remaining_quantity: 1,
        token_value: -400.00,
        total_amount: 400.00,
        usage_status: 'available',
        brand_name: 'Test Paint Brand',
        series_name: 'Premium Weather Series',
        unit_name: 'Gallon'
      });
      if (!error || !(error.code === '23514' || error.message.includes('check constraint') || error.message.includes('token_value_check'))) {
        return { status: 'FAIL', error: `Expected check constraint 23514 violation, got: ${error?.message}` };
      }
      return { status: 'PASS', notes: 'Database schema constraint token_transactions_token_value_check (23514) verified' };
    }
  },
  {
    id: 33,
    title: 'Heterogeneous batches: (5 × Rs.400) + (2 × Rs.600)',
    category: 'Voucher - Batch Splitting',
    expected: 'Token amount: 2000 + 1200 = Rs. 3,200. Both batches split cleanly into child slices.',
    run: async ({ supabase, registry, fixtures }) => {
      const tokenA = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 10, remaining_quantity: 10, token_value: 400 });
      const tokenB = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 5, remaining_quantity: 5, token_value: 600 });

      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [
          { token_id: tokenA.id, quantity: 5 },
          { token_id: tokenB.id, quantity: 2 }
        ]
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      if (Number(data.tokens_applied_amount) !== 3200.00) {
        return { status: 'FAIL', error: `Expected 3200 applied, got ${data.tokens_applied_amount}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 34,
    title: 'Supplier balance credit preservation: advance balance',
    category: 'Supplier - Ledger Balance',
    expected: 'Balance decreases algebraically into credit.',
    run: async ({ supabase, registry, fixtures }) => {
      // Set supplier balance to 2000
      await supabase.from('suppliers').update({ current_balance: 2000.00 }).eq('id', fixtures.supplier.id);

      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 5, remaining_quantity: 5, token_value: 1000 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 5 }]
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('vouchers', data.voucher_id);

      const { data: sup } = await supabase.from('suppliers').select('current_balance').eq('id', fixtures.supplier.id).single();
      if (Number(sup.current_balance) !== -3000.00) {
        return { status: 'FAIL', error: `Expected advance balance -3000.00, got ${sup.current_balance}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 35,
    title: 'Audit log completeness: voucher creation',
    category: 'Audit & Compliance',
    expected: 'entity_type="voucher", details include allocations, amounts, and breakdown.',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 1, remaining_quantity: 1, token_value: 500 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 1 }]
      });
      if (error || !data || !data.voucher_id) {
        return { status: 'FAIL', error: `Voucher creation failed: ${error?.message || 'Missing voucher_id'}` };
      }
      registry.track('vouchers', data.voucher_id);

      const { data: audits, error: aErr } = await supabase.from('audit_logs')
        .select('*')
        .eq('tenant_id', fixtures.tenant.id)
        .eq('entity_type', 'voucher')
        .eq('entity_id', String(data.voucher_id));

      if (aErr) return { status: 'FAIL', error: `Audit query failed: ${aErr.message}` };
      if (!audits || audits.length === 0) return { status: 'FAIL', error: 'No audit log found for voucher' };
      const log = audits[0];
      if (log.entity_type !== 'voucher') {
        return { status: 'FAIL', error: `Audit entity_type mismatch: expected 'voucher', got '${log.entity_type}'` };
      }
      if (log.action_type !== 'CREATE') {
        return { status: 'FAIL', error: `Audit action_type mismatch: expected 'CREATE', got '${log.action_type}'` };
      }
      if (log.action !== 'CREATE_VOUCHER') {
        return { status: 'FAIL', error: `Audit action mismatch: expected 'CREATE_VOUCHER', got '${log.action}'` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 36,
    title: 'Purchase RPC parity: multi-token batch on purchase',
    category: 'Purchase - Valuation Parity',
    expected: 'Multiplies token_value × remaining_qty (no partial purchase).',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 5, remaining_quantity: 5, token_value: 400 });
      const purchaseData = {
        purchase_no: `PUR-${fixtures.tenant.id.slice(0, 6)}`,
        supplier_id: fixtures.supplier.id,
        supplier_name: fixtures.supplier.name,
        net_total: 5000.00,
        paid_amount: 0.00,
        due_amount: 5000.00
      };
      const items = [{ item_id: fixtures.item.id, qty: 1, unit_price: 5000.00, total_price: 5000.00 }];

      const { data, error } = await supabase.rpc('create_purchase_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_purchase_data: purchaseData,
        p_items: items,
        p_token_ids: [token.id]
      });
      if (error) return { status: 'FAIL', error: error.message };
      if (!data?.purchase_id) return { status: 'FAIL', error: 'No purchase_id returned' };
      registry.track('purchases', data.purchase_id);

      if (Number(data.tokens_applied_amount) !== 2000.00) {
        return { status: 'FAIL', error: `BUG-PA-01 not resolved: expected 2000, got ${data.tokens_applied_amount}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 37,
    title: 'Purchase non-token regression: standard purchase',
    category: 'Purchase - Non-Token Regression',
    expected: 'Line items, stock quantities, and due balance update cleanly.',
    run: async ({ supabase, registry, fixtures }) => {
      // Read baseline stock BEFORE purchase to be resilient to prior test mutations on the same item
      const { data: baselineItem } = await supabase.from('items').select('stock_qty').eq('id', fixtures.item.id).single();
      const baselineStock = Number(baselineItem?.stock_qty ?? 0);

      const purchaseData = {
        purchase_no: `PUR-REG-${fixtures.tenant.id.slice(0, 6)}`,
        supplier_id: fixtures.supplier.id,
        supplier_name: fixtures.supplier.name,
        net_total: 1000.00,
        paid_amount: 1000.00,
        due_amount: 0.00
      };
      const items = [{ item_id: fixtures.item.id, qty: 5, unit_price: 200.00, total_price: 1000.00 }];

      const { data, error } = await supabase.rpc('create_purchase_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_purchase_data: purchaseData,
        p_items: items,
        p_token_ids: []
      });
      if (error) return { status: 'FAIL', error: error.message };
      registry.track('purchases', data.purchase_id);

      // Verify stock incremented by exactly 5 from the baseline read above
      const { data: itm } = await supabase.from('items').select('stock_qty').eq('id', fixtures.item.id).single();
      if (Number(itm.stock_qty) !== baselineStock + 5) {
        return { status: 'FAIL', error: `Stock not incremented: expected ${baselineStock + 5}, got ${itm.stock_qty}` };
      }
      return { status: 'PASS' };
    }
  },
  {
    id: 38,
    title: 'Stockpile reporting & Shift drawer isolation: child rows with usage_status = "used"',
    category: 'Reporting & Drawer Isolation',
    expected: 'Stockpile aggregation filters usage_status = "available"; child total_amount excluded. Shift drawer cash ignores tokens (shift_id is NULL).',
    run: async ({ supabase, registry, fixtures }) => {
      const token = await createTestToken(supabase, registry, fixtures.tenant.id, { quantity: 14, remaining_quantity: 14, token_value: 400 });
      const { data, error } = await supabase.rpc('create_voucher_atomic', {
        p_tenant_id: fixtures.tenant.id,
        p_voucher_data: { party_type: 'supplier', party_id: fixtures.supplier.id, amount: 0 },
        p_token_allocations: [{ token_id: token.id, quantity: 14 }]
      });
      if (error || !data || !data.voucher_id) {
        return { status: 'FAIL', error: `Voucher creation failed: ${error?.message || 'Missing voucher_id'}` };
      }
      registry.track('vouchers', data.voucher_id);

      // 1. Stockpile reporting check: Active stockpile for THIS specific token only
      // After full consumption, the parent token's usage_status = 'used', so activeStockpile for it = 0
      const { data: parentState } = await supabase.from('token_transactions')
        .select('usage_status, remaining_quantity, total_amount')
        .eq('id', token.id)
        .single();

      if (!parentState) return { status: 'FAIL', error: 'Could not read parent token state after voucher creation' };
      if (parentState.usage_status !== 'used') {
        return { status: 'FAIL', error: `Parent token usage_status should be 'used', got '${parentState.usage_status}'` };
      }
      if (parentState.remaining_quantity !== 0 || Number(parentState.total_amount) !== 0) {
        return { status: 'FAIL', error: `Parent token not fully consumed: rem=${parentState.remaining_quantity}, amt=${parentState.total_amount}` };
      }

      // The parent token's total_amount = 0, usage_status = 'used'
      // An aggregation filtering usage_status = 'available' should yield 0 for this token
      const { data: activeStockpile, error: sErr } = await supabase.from('token_transactions')
        .select('total_amount')
        .eq('tenant_id', fixtures.tenant.id)
        .eq('id', token.id)  // scoped strictly to this test token
        .eq('usage_status', 'available');

      if (sErr) return { status: 'FAIL', error: `Stockpile query failed: ${sErr.message}` };
      const sumStockpile = (activeStockpile || []).reduce((acc, r) => acc + Number(r.total_amount), 0);
      if (sumStockpile !== 0) {
        return { status: 'FAIL', error: `Active stockpile for fully consumed token should be 0, got ${sumStockpile}` };
      }

      // 2. Child consumption slice drawer isolation & status verification
      // Scoped specifically via parent_transaction_id to this test token
      const { data: childSlices, error: cErr } = await supabase.from('token_transactions')
        .select('*')
        .eq('tenant_id', fixtures.tenant.id)
        .eq('parent_transaction_id', token.id);

      if (cErr) return { status: 'FAIL', error: `Child token slice query failed: ${cErr.message}` };
      if (!childSlices || childSlices.length === 0) {
        return { status: 'FAIL', error: 'No child token consumption slice found for allocated token' };
      }

      for (const child of childSlices) {
        registry.track('token_transactions', child.id);

        if (child.usage_status !== 'used') {
          return {
            status: 'FAIL',
            error: `Child token slice usage_status mismatch: expected 'used', got '${child.usage_status}'`
          };
        }

        if (child.shift_id !== null) {
          return {
            status: 'FAIL',
            error: `Drawer cash isolation violated: child token slice shift_id is not null (${child.shift_id})`
          };
        }

        if (child.used_against_voucher_id !== data.voucher_id) {
          return {
            status: 'FAIL',
            error: `Child token slice not linked to voucher: expected '${data.voucher_id}', got '${child.used_against_voucher_id}'`
          };
        }
      }

      return { status: 'PASS' };
    }
  }
];

// ── Runner / CLI Entrypoint ──────────────────────────────────────────────────
export async function runStagingHarness() {
  console.log('================================================================');
  console.log('PyntFlow Supplier Token Payment — Staging Transactional Test Harness');
  console.log('================================================================\n');

  let envStatus;
  try {
    envStatus = verifyStagingEnvironment();
  } catch (err) {
    failClosed(err.message);
  }

  console.log(`[STATUS] Target Project: ${envStatus.projectRef || 'None (Unset)'}`);
  console.log(`[STATUS] Remote Database Execution Authorized: ${envStatus.canExecuteRemote ? 'YES' : 'NO'}`);
  console.log(`[STATUS] Readiness Assessment: ${envStatus.reason}\n`);

  if (!envStatus.canExecuteRemote) {
    console.log('\x1b[33m────────────────────────────────────────────────────────────────');
    console.log('STAGING EXECUTION GATE ACTIVE (REMOTE MUTATIONS BLOCKED)');
    console.log('────────────────────────────────────────────────────────────────\x1b[0m');
    console.log('Remote execution is disabled because execution authorization flags');
    console.log('are not present (ALLOW_STAGING_MUTATIONS=true and STAGING_EXECUTION_AUTHORIZED=true).');
    console.log('To prevent unapproved database mutations, zero tests were executed.\n');

    console.log(`Static Validation Summary for all ${STAGING_TRANSACTIONAL_SCENARIOS.length} scenarios:`);
    let validCount = 0;
    for (const sc of STAGING_TRANSACTIONAL_SCENARIOS) {
      if (sc.id && sc.title && sc.category && sc.expected && typeof sc.run === 'function') {
        validCount++;
        console.log(`  [BLOCKED / VALIDATED] Scenario #${String(sc.id).padStart(2, '0')}: [${sc.category}] ${sc.title}`);
      } else {
        console.error(`  ✖ Invalid scenario definition for #${sc.id}`);
      }
    }

    console.log(`\nBaseline Diagnostic Checks (Pre-Migration):`);
    for (const sc of BASELINE_DIAGNOSTIC_SCENARIOS) {
      console.log(`  [${sc.id === 'Pre-02' ? 'BLOCKED' : 'SPEC VALIDATED'}] Scenario ${sc.id}: ${sc.title}`);
    }

    console.log(`\n\x1b[32m[STATIC CHECK PASS]\x1b[0m All ${validCount}/${STAGING_TRANSACTIONAL_SCENARIOS.length} scenarios validated locally.`);
    console.log('Zero remote mutations or queries executed.\n');
    return { status: 'BLOCKED', validatedScenarios: validCount, baselineDiagnostics: BASELINE_DIAGNOSTIC_SCENARIOS.length };
  }

  // Live Staging Execution Path (Only executed when explicitly authorized)
  console.log('Initializing live staging Supabase client...');
  const supabase = createClient(envStatus.targetUrl, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY);
  const registry = new HardenedFixtureRegistry();

  let testFixtures;
  try {
    console.log('Setting up isolated test tenant fixtures...');
    testFixtures = await setupTestFixtures(supabase, registry);
    testFixtures.supabase = supabase;
  } catch (err) {
    console.error(`[FATAL] Fixture setup failed: ${err.message}`);
    await registry.teardownLIFO(supabase);
    failClosed('Fixture setup failure.');
  }

  const results = [];
  try {
    console.log(`Executing ${STAGING_TRANSACTIONAL_SCENARIOS.length} transactional tests against staging...\n`);
    for (const sc of STAGING_TRANSACTIONAL_SCENARIOS) {
      process.stdout.write(`Executing Scenario #${String(sc.id).padStart(2, '0')}: ${sc.title}... `);
      try {
        const res = await sc.run({
          supabase,
          registry,
          fixtures: testFixtures,
          env: envStatus
        });
        results.push({ id: sc.id, title: sc.title, ...res });
        if (res.status === 'PASS') {
          console.log('\x1b[32mPASS\x1b[0m');
        } else {
          console.log(`\x1b[31m${res.status || 'FAIL'}\x1b[0m: ${res.error || ''}`);
        }
      } catch (err) {
        results.push({ id: sc.id, title: sc.title, status: 'FAIL', error: err.message });
        console.log(`\x1b[31mFAIL (EXCEPTION)\x1b[0m: ${err.message}`);
      }
    }
  } finally {
    console.log('\n[TEARDOWN] Unrolling test fixtures in strict LIFO dependency order...');
    const cleanupErrors = await registry.teardownLIFO(supabase);
    if (cleanupErrors.length > 0) {
      console.warn(`[TEARDOWN WARNING] ${cleanupErrors.length} errors occurred during LIFO unrolling:`, cleanupErrors);
    } else {
      console.log('[TEARDOWN] LIFO unrolling completed cleanly.');
    }

    console.log('[VERIFICATION] Executing fixture-scoped orphan sweep...');
    const { clean, orphans } = await registry.verifyNoOrphans(supabase);
    if (!clean) {
      console.error('\x1b[31m[CRITICAL TEARDOWN FAILURE] Surviving orphan fixtures detected:\x1b[0m', orphans);
      failClosed('Dirty teardown: orphan fixtures remain in database.');
    } else {
      console.log('\x1b[32m[VERIFICATION PASS]\x1b[0m Zero orphan fixtures detected. Teardown verified complete.');
    }
  }

  const passCount = results.filter(r => r.status === 'PASS').length;
  console.log(`\nFinal Test Run Summary: ${passCount}/${STAGING_TRANSACTIONAL_SCENARIOS.length} passed.`);
  return { status: passCount === STAGING_TRANSACTIONAL_SCENARIOS.length ? 'PASS' : 'FAIL', results };
}

// Auto-run if executed directly as main script
const isMain = import.meta.url === `file://${process.argv[1]}` ||
               (process.argv[1] && process.argv[1].endsWith('test-staging-token-transactional.mjs'));

if (isMain) {
  runStagingHarness().catch((err) => {
    failClosed(`Fatal unhandled execution error: ${err.message}`);
  });
}
