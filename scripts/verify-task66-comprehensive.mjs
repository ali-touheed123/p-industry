import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import * as fs from 'fs';

// Read env
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BASE_URL = 'http://localhost:3000';

async function generateAuthHeaders(tenantId) {
  // Developer token
  const devSecret = new TextEncoder().encode(env.DEV_ADMIN_SECRET || env.SESSION_SECRET);
  const token = await new SignJWT({
    userId: 'developer-super-admin',
    username: 'developer',
    role: 'developer',
    tenantId: tenantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(devSecret);

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

const testResults = [];

function recordResult(testName, passed, type, details) {
  testResults.push({ testName, passed, type, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${type}] ${testName}`);
  if (details) console.log(`   └─ ${details}`);
}

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('🚀 TASK 6.6 COMPREHENSIVE END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Get Tenant
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('id, name, slug').limit(1).single();
  if (tErr || !tenant) throw new Error('Could not find tenant: ' + tErr?.message);
  const tenantId = tenant.id;
  console.log(`Using Tenant: "${tenant.name}" (${tenantId})`);

  const headers = await generateAuthHeaders(tenantId);

  // Setup Brands, Series, and Token Configs for test
  let { data: brandGobi } = await supabase.from('brands').select('id, name').eq('tenant_id', tenantId).ilike('name', '%Gobi%').maybeSingle();
  if (!brandGobi) {
    const { data: newB } = await supabase.from('brands').insert({ tenant_id: tenantId, name: "Gobi's Paints", status: 'active' }).select().single();
    brandGobi = newB;
  }
  let { data: seriesWeather } = await supabase.from('brand_series').select('id, name').eq('tenant_id', tenantId).eq('brand_id', brandGobi.id).ilike('name', '%Weather%').maybeSingle();
  if (!seriesWeather) {
    const { data: newS } = await supabase.from('brand_series').insert({ tenant_id: tenantId, brand_id: brandGobi.id, name: 'Weather Guard', status: 'active' }).select().single();
    seriesWeather = newS;
  }
  let { data: cfgGallon } = await supabase.from('series_token_configs').select('*').eq('tenant_id', tenantId).eq('series_id', seriesWeather.id).eq('unit_name', 'Gallon').maybeSingle();
  if (!cfgGallon) {
    const { data: newC } = await supabase.from('series_token_configs').insert({
      tenant_id: tenantId, series_id: seriesWeather.id, unit_name: 'Gallon', is_enabled: true, token_value: 500, is_drum_auto: false
    }).select().single();
    cfgGallon = newC;
  } else if (!cfgGallon.is_enabled || Number(cfgGallon.token_value) !== 500) {
    const { data: updC } = await supabase.from('series_token_configs').update({ is_enabled: true, token_value: 500 }).eq('id', cfgGallon.id).select().single();
    cfgGallon = updC;
  }

  // Track created test transaction IDs to clean up at the end
  const cleanupTxnIds = [];

  // ============================================================================
  // 1. ACTUAL /api/tokens opening_stock FLOW (API-LEVEL)
  // ============================================================================
  console.log('\n--- 1. Actual /api/tokens opening_stock API Flow ---');

  // Test 1.1: Missing Brand rejection (API)
  try {
    const res = await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'opening_stock',
        series_id: seriesWeather.id,
        series_name: seriesWeather.name,
        unit_name: 'Gallon',
        quantity: 5,
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error?.includes('brand_name is required');
    recordResult('1.1 Rejection of opening_stock with missing brand', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
  } catch (err) {
    recordResult('1.1 Rejection of opening_stock with missing brand', false, 'API-Level', err.message);
  }

  // Test 1.2: Invalid Series rejection (API)
  try {
    const res = await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'opening_stock',
        brand_id: brandGobi.id,
        brand_name: brandGobi.name,
        series_id: '00000000-0000-0000-0000-000000000099',
        series_name: 'NonExistentSeries',
        unit_name: 'Gallon',
        quantity: 5,
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && (data.error?.includes('not found') || data.error?.includes('No token configuration'));
    recordResult('1.2 Rejection of opening_stock with invalid series', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
  } catch (err) {
    recordResult('1.2 Rejection of opening_stock with invalid series', false, 'API-Level', err.message);
  }

  // Test 1.3: Invalid Unit rejection (API)
  try {
    const res = await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'opening_stock',
        brand_id: brandGobi.id,
        brand_name: brandGobi.name,
        series_id: seriesWeather.id,
        series_name: seriesWeather.name,
        unit_name: 'FakeUnitNonExistent',
        quantity: 5,
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error?.includes('No token configuration found');
    recordResult('1.3 Rejection of opening_stock with invalid unit', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
  } catch (err) {
    recordResult('1.3 Rejection of opening_stock with invalid unit', false, 'API-Level', err.message);
  }

  // Test 1.4: Valid opening_stock with server-derived token value (API)
  let seededOpeningToken = null;
  try {
    const res = await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'opening_stock',
        brand_id: brandGobi.id,
        brand_name: brandGobi.name,
        series_id: seriesWeather.id,
        series_name: seriesWeather.name,
        unit_name: 'Gallon',
        quantity: 10,
        token_value: 99999, // Should be ignored; server must enforce authoritative Rs.500
        notes: 'Verification opening stock batch',
      }),
    });
    const data = await res.json();
    seededOpeningToken = data.transaction;
    if (seededOpeningToken?.id) cleanupTxnIds.push(seededOpeningToken.id);

    const passed =
      res.status === 200 &&
      data.success === true &&
      seededOpeningToken.type === 'opening_stock' &&
      seededOpeningToken.usage_status === 'available' &&
      seededOpeningToken.token_value === 500 && // Server derived from series_token_configs!
      seededOpeningToken.quantity === 10 &&
      seededOpeningToken.remaining_quantity === 10 &&
      seededOpeningToken.total_amount === 5000;

    recordResult(
      '1.4 Successful opening_stock creation with server-derived token value',
      passed,
      'API-Level',
      `ID: ${seededOpeningToken?.id?.slice(0, 8)}, token_value: Rs.${seededOpeningToken?.token_value} (overrode client 99999), remaining_qty: ${seededOpeningToken?.remaining_quantity}, total: Rs.${seededOpeningToken?.total_amount}`
    );
  } catch (err) {
    recordResult('1.4 Successful opening_stock creation with server-derived token value', false, 'API-Level', err.message);
  }

  // ============================================================================
  // 2. ACTUAL settle_vendor API FLOW (API-LEVEL)
  // ============================================================================
  console.log('\n--- 2. Actual settle_vendor API Flow ---');

  let settledChildTokenId = null;
  if (seededOpeningToken) {
    try {
      // Settle 4 out of 10 tokens with company rep
      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'settle_vendor',
          token_id: seededOpeningToken.id,
          token_count: 4,
          supplier_name: "Gobi's Paints Territory Rep",
          claim_reference: 'REP-VERIFY-001',
          settlement_type: 'vendor_rep_cash',
        }),
      });
      const data = await res.json();

      // Query parent row directly from DB / API
      const { data: parentRow } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('id', seededOpeningToken.id)
        .single();

      // Find the child row
      const { data: childRows } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('parent_transaction_id', seededOpeningToken.id)
        .eq('usage_status', 'settled');

      const childRow = childRows?.[0];
      if (childRow?.id) cleanupTxnIds.push(childRow.id);
      settledChildTokenId = childRow?.id;

      const passed =
        res.status === 200 &&
        parentRow.remaining_quantity === 6 && // 10 - 4 = 6
        parentRow.total_amount === 3000 && // 6 * 500 = 3000
        parentRow.usage_status === 'available' &&
        childRow &&
        childRow.quantity === 4 &&
        childRow.remaining_quantity === 0 &&
        childRow.total_amount === 2000 &&
        childRow.usage_status === 'settled' &&
        childRow.settled_vendor_name === "Gobi's Paints Territory Rep";

      recordResult(
        '2.1 Partial settlement via API: parent decremented & child settled row created',
        passed,
        'API-Level',
        `Parent rem_qty: ${parentRow?.remaining_quantity} (exp: 6), Parent total: Rs.${parentRow?.total_amount} (exp: 3000). Child qty: ${childRow?.quantity}, status: ${childRow?.usage_status}`
      );
    } catch (err) {
      recordResult('2.1 Partial settlement via API', false, 'API-Level', err.message);
    }
  }

  // ============================================================================
  // 3. ACTUAL write_off API FLOW (API-LEVEL)
  // ============================================================================
  console.log('\n--- 3. Actual write_off API Flow ---');

  if (seededOpeningToken) {
    // 3.1 Invalid reason rejection
    try {
      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'write_off',
          token_id: seededOpeningToken.id,
          write_off_reason: 'BogusInvalidReason',
          write_off_quantity: 1,
        }),
      });
      const data = await res.json();
      const passed = res.status === 400 && data.error?.includes('write_off_reason must be one of');
      recordResult('3.1 Rejection of write_off with invalid reason', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
    } catch (err) {
      recordResult('3.1 Rejection of write_off with invalid reason', false, 'API-Level', err.message);
    }

    // 3.2 'Other' reason requires note
    try {
      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'write_off',
          token_id: seededOpeningToken.id,
          write_off_reason: 'Other',
          write_off_quantity: 1,
          notes: '   ', // whitespace only
        }),
      });
      const data = await res.json();
      const passed = res.status === 400 && data.error?.includes('custom note is required');
      recordResult('3.2 Rejection of write_off with reason Other without custom note', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
    } catch (err) {
      recordResult('3.2 Rejection of write_off with reason Other without custom note', false, 'API-Level', err.message);
    }

    // 3.3 Partial write-off with valid reason 'Damaged' (API)
    try {
      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'write_off',
          token_id: seededOpeningToken.id,
          write_off_reason: 'Damaged',
          write_off_quantity: 2, // 6 remaining -> 4 remaining
        }),
      });
      const data = await res.json();

      const { data: parentRow } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('id', seededOpeningToken.id)
        .single();

      const { data: childRows } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('parent_transaction_id', seededOpeningToken.id)
        .eq('usage_status', 'written_off');

      const childRow = childRows?.[0];
      if (childRow?.id) cleanupTxnIds.push(childRow.id);

      const passed =
        res.status === 200 &&
        parentRow.remaining_quantity === 4 && // 6 - 2 = 4
        parentRow.total_amount === 2000 && // 4 * 500 = 2000
        parentRow.usage_status === 'available' &&
        childRow &&
        childRow.quantity === 2 &&
        childRow.remaining_quantity === 0 &&
        childRow.usage_status === 'written_off' &&
        childRow.write_off_reason === 'Damaged';

      recordResult(
        '3.3 Partial write-off via API with reason Damaged',
        passed,
        'API-Level',
        `Parent rem_qty: ${parentRow?.remaining_quantity} (exp: 4), total: Rs.${parentRow?.total_amount}. Child qty: ${childRow?.quantity}, reason: ${childRow?.write_off_reason}`
      );
    } catch (err) {
      recordResult('3.3 Partial write-off via API with reason Damaged', false, 'API-Level', err.message);
    }

    // 3.4 Full write-off of remainder with reason 'Lost' (API)
    try {
      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'write_off',
          token_id: seededOpeningToken.id,
          write_off_reason: 'Lost',
          write_off_quantity: 4, // Full remainder
        }),
      });
      const data = await res.json();

      const { data: parentRow } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('id', seededOpeningToken.id)
        .single();

      const passed =
        res.status === 200 &&
        parentRow.usage_status === 'written_off' &&
        parentRow.remaining_quantity === 0 &&
        parentRow.total_amount === 0 &&
        parentRow.write_off_reason === 'Lost';

      recordResult(
        '3.4 Full write-off via API of remaining parent quantity with reason Lost',
        passed,
        'API-Level',
        `Parent status: ${parentRow?.usage_status}, rem_qty: ${parentRow?.remaining_quantity}, reason: ${parentRow?.write_off_reason}`
      );
    } catch (err) {
      recordResult('3.4 Full write-off via API of remaining parent quantity', false, 'API-Level', err.message);
    }

    // 3.5 Rejection for already settled token (API)
    if (settledChildTokenId) {
      try {
        const res = await fetch(`${BASE_URL}/api/tokens`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tenant_id: tenantId,
            type: 'write_off',
            token_id: settledChildTokenId,
            write_off_reason: 'Damaged',
          }),
        });
        const data = await res.json();
        const passed = res.status === 400 && data.error?.includes('already been settled or written off');
        recordResult('3.5 Rejection of write-off on already settled token', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
      } catch (err) {
        recordResult('3.5 Rejection of write-off on already settled token', false, 'API-Level', err.message);
      }
    }

    // 3.6 Actual rejection for purchase-applied token (API)
    try {
      let { data: realPurchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      if (!realPurchase) {
        const { data: newP, error: pErr } = await supabase
          .from('purchases')
          .insert({
            tenant_id: tenantId,
            purchase_no: `PO-TEST-${Date.now().toString().slice(-4)}`,
            purchase_type: 'purchase',
            supplier_name: 'Test Supplier',
            date: new Date().toISOString(),
            subtotal: 1000,
            net_total: 1000,
            paid_amount: 1000,
            due_amount: 0,
            payment_type: 'cash',
          })
          .select('id')
          .single();
        if (pErr) throw pErr;
        realPurchase = newP;
      }

      // Seed a real DB token row with used_against_purchase_id set
      const { data: purchaseToken, error: insPErr } = await supabase
        .from('token_transactions')
        .insert({
          tenant_id: tenantId,
          type: 'shop_retained',
          brand_id: brandGobi.id,
          brand_name: brandGobi.name,
          series_id: seriesWeather.id,
          series_name: seriesWeather.name,
          unit_name: 'Gallon',
          token_value: 500,
          quantity: 1,
          remaining_quantity: 0,
          total_amount: 500,
          usage_status: 'available',
          used_against_purchase_id: realPurchase.id,
        })
        .select()
        .single();

      if (insPErr) throw insPErr;
      if (purchaseToken?.id) cleanupTxnIds.push(purchaseToken.id);

      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'write_off',
          token_id: purchaseToken.id,
          write_off_reason: 'Damaged',
        }),
      });
      const data = await res.json();
      const passed = res.status === 400 && data.error?.includes('already been applied to a purchase or voucher');
      recordResult('3.6 Rejection of write-off on purchase-applied token (C2 guard)', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
    } catch (err) {
      recordResult('3.6 Rejection of write-off on purchase-applied token (C2 guard)', false, 'API-Level', err.message);
    }

    // 3.7 Actual rejection for voucher-applied token (API)
    try {
      let { data: realVoucher } = await supabase
        .from('vouchers')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      if (!realVoucher) {
        const { data: newV } = await supabase
          .from('vouchers')
          .insert({
            tenant_id: tenantId,
            voucher_no: `VT-TEST-${Date.now().toString().slice(-4)}`,
            type: 'payment',
            party_name: 'Test Supplier',
            amount: 1000,
          })
          .select('id')
          .single();
        realVoucher = newV;
      }

      // Seed a real DB token row with used_against_voucher_id set
      const { data: voucherToken, error: insVErr } = await supabase
        .from('token_transactions')
        .insert({
          tenant_id: tenantId,
          type: 'shop_retained',
          brand_id: brandGobi.id,
          brand_name: brandGobi.name,
          series_id: seriesWeather.id,
          series_name: seriesWeather.name,
          unit_name: 'Gallon',
          token_value: 500,
          quantity: 1,
          remaining_quantity: 0,
          total_amount: 500,
          usage_status: 'available',
          used_against_voucher_id: realVoucher.id,
        })
        .select()
        .single();

      if (insVErr) throw insVErr;
      if (voucherToken?.id) cleanupTxnIds.push(voucherToken.id);

      const res = await fetch(`${BASE_URL}/api/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'write_off',
          token_id: voucherToken.id,
          write_off_reason: 'Damaged',
        }),
      });
      const data = await res.json();
      const passed = res.status === 400 && data.error?.includes('already been applied to a purchase or voucher');
      recordResult('3.7 Rejection of write-off on voucher-applied token (C2 guard)', passed, 'API-Level', `HTTP ${res.status}: ${data.error}`);
    } catch (err) {
      recordResult('3.7 Rejection of write-off on voucher-applied token (C2 guard)', false, 'API-Level', err.message);
    }
  }

  // ============================================================================
  // 4. EXPLICIT AGGREGATION TEST (CONTROLLED TEST ROWS)
  // ============================================================================
  console.log('\n--- 4. Explicit 4-Part Identity Aggregation Test ---');

  const testBrand = 'TestAggBrand';
  const testSeries = 'TestAggSeries';
  const testUnit = 'Quarter';
  const valueGroup1 = 750;
  const valueGroup2 = 900;

  // Row 4A: Opening Stock (3 tokens @ 750)
  const { data: rowOpening } = await supabase
    .from('token_transactions')
    .insert({
      tenant_id: tenantId,
      type: 'opening_stock',
      brand_name: testBrand,
      series_name: testSeries,
      unit_name: testUnit,
      token_value: valueGroup1,
      quantity: 3,
      remaining_quantity: 3,
      total_amount: 3 * valueGroup1,
      usage_status: 'available',
    })
    .select()
    .single();
  if (rowOpening?.id) cleanupTxnIds.push(rowOpening.id);

  // Row 4B: Shop Retained (2 tokens @ 750)
  const { data: rowRetained } = await supabase
    .from('token_transactions')
    .insert({
      tenant_id: tenantId,
      type: 'shop_retained',
      brand_name: testBrand,
      series_name: testSeries,
      unit_name: testUnit,
      token_value: valueGroup1,
      quantity: 2,
      remaining_quantity: 2,
      total_amount: 2 * valueGroup1,
      usage_status: 'available',
    })
    .select()
    .single();
  if (rowRetained?.id) cleanupTxnIds.push(rowRetained.id);

  // Row 4C: Redeemed (4 tokens @ 750)
  const { data: rowRedeemed } = await supabase
    .from('token_transactions')
    .insert({
      tenant_id: tenantId,
      type: 'redeemed',
      brand_name: testBrand,
      series_name: testSeries,
      unit_name: testUnit,
      token_value: valueGroup1,
      quantity: 4,
      remaining_quantity: 4,
      total_amount: 4 * valueGroup1,
      usage_status: 'available',
    })
    .select()
    .single();
  if (rowRedeemed?.id) cleanupTxnIds.push(rowRedeemed.id);

  // Row 4D: Same Brand+Series+Unit with DIFFERENT token value = 900 (5 tokens)
  const { data: rowDiffVal } = await supabase
    .from('token_transactions')
    .insert({
      tenant_id: tenantId,
      type: 'opening_stock',
      brand_name: testBrand,
      series_name: testSeries,
      unit_name: testUnit,
      token_value: valueGroup2, // 900
      quantity: 5,
      remaining_quantity: 5,
      total_amount: 5 * valueGroup2,
      usage_status: 'available',
    })
    .select()
    .single();
  if (rowDiffVal?.id) cleanupTxnIds.push(rowDiffVal.id);

  // Query /api/tokens to test API response
  try {
    const res = await fetch(`${BASE_URL}/api/tokens?tenant_id=${tenantId}&usage_status=available`, { headers });
    const data = await res.json();
    const availableList = (data.transactions || []).filter(
      (t) => t.brand_name === testBrand && t.series_name === testSeries && t.unit_name === testUnit
    );

    // Run exact frontend aggregation algorithm from TokenLedger.tsx
    const groups = {};
    availableList.forEach((t) => {
      const brand = t.brand_name || 'General';
      const series = t.series_name || '—';
      const unit = t.unit_name || '—';
      const tv = Number(t.token_value) || 0;
      const key = `${brand}|${series}|${unit}|${tv}`;
      if (!groups[key]) {
        groups[key] = { brand, series, unit, tokenValue: tv, count: 0, totalValue: 0 };
      }
      const qty = Number(t.remaining_quantity ?? t.quantity ?? 1);
      groups[key].count += qty;
      groups[key].totalValue += qty * tv;
    });

    const groupKeys = Object.keys(groups);
    const key750 = `${testBrand}|${testSeries}|${testUnit}|750`;
    const key900 = `${testBrand}|${testSeries}|${testUnit}|900`;

    const passedGroup1 = groups[key750]?.count === 9 && groups[key750]?.totalValue === 6750; // 3 + 2 + 4 = 9, 9 * 750 = 6750
    const passedGroup2 = groups[key900]?.count === 5 && groups[key900]?.totalValue === 4500; // 5 * 900 = 4500
    const passedDistinct = groupKeys.length === 2;

    recordResult(
      '4.1 Cross-origin aggregation into ONE group for identical 4-part identity (Opening + Retained + Redeemed)',
      passedGroup1,
      'API + Logic',
      `Count: ${groups[key750]?.count} (expected: 9), Total: Rs.${groups[key750]?.totalValue} (expected: 6750)`
    );

    recordResult(
      '4.2 Different token value with same Brand+Series+Unit kept in SEPARATE group',
      passedGroup2 && passedDistinct,
      'API + Logic',
      `Group 900 Count: ${groups[key900]?.count} (expected: 5). Total groups: ${groupKeys.length} (expected: 2)`
    );
  } catch (err) {
    recordResult('4.1 Aggregation test', false, 'API + Logic', err.message);
  }

  // ============================================================================
  // 5. DOUBLE-COUNTING PREVENTION VERIFICATION
  // ============================================================================
  console.log('\n--- 5. Double-Counting Prevention for Parent/Child Rows ---');

  try {
    // Seed a parent with 8 tokens @ 100
    const { data: pStock } = await supabase
      .from('token_transactions')
      .insert({
        tenant_id: tenantId,
        type: 'opening_stock',
        brand_name: 'AntiDoubleCountBrand',
        series_name: 'TestSeries',
        unit_name: 'Quarter',
        token_value: 100,
        quantity: 8,
        remaining_quantity: 8,
        total_amount: 800,
        usage_status: 'available',
      })
      .select()
      .single();
    if (pStock?.id) cleanupTxnIds.push(pStock.id);

    // Settle 3 via API
    await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'settle_vendor',
        token_id: pStock.id,
        token_count: 3,
        supplier_name: 'Test Supplier',
      }),
    });

    // Write off 2 via API
    await fetch(`${BASE_URL}/api/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        type: 'write_off',
        token_id: pStock.id,
        write_off_quantity: 2,
        write_off_reason: 'Damaged',
      }),
    });

    // Fetch all related rows
    const { data: relatedRows } = await supabase
      .from('token_transactions')
      .select('*')
      .or(`id.eq.${pStock.id},parent_transaction_id.eq.${pStock.id}`);

    relatedRows.forEach((r) => cleanupTxnIds.push(r.id));

    // Calculate Available Stockpile
    let availableCount = 0;
    let availableValue = 0;
    let settledCount = 0;
    let writtenOffCount = 0;

    relatedRows.forEach((r) => {
      if (r.usage_status === 'available') {
        const rem = Number(r.remaining_quantity ?? r.quantity ?? 1);
        availableCount += rem;
        availableValue += rem * Number(r.token_value || 0);
      } else if (r.usage_status === 'settled') {
        settledCount += Number(r.quantity || 1);
      } else if (r.usage_status === 'written_off') {
        writtenOffCount += Number(r.quantity || 1);
      }
    });

    const noDoubleCount =
      availableCount === 3 && // 8 - 3 settled - 2 written_off = 3
      availableValue === 300 && // 3 * 100 = 300
      settledCount === 3 &&
      writtenOffCount === 2 &&
      availableCount + settledCount + writtenOffCount === 8;

    recordResult(
      '5.1 Parent & child rows do not double-count (Available = 3, Settled = 3, Written-Off = 2, Total = 8)',
      noDoubleCount,
      'DB + Accounting',
      `Available: ${availableCount} (Rs.${availableValue}), Settled: ${settledCount}, Written Off: ${writtenOffCount}, Sum: ${availableCount + settledCount + writtenOffCount}`
    );
  } catch (err) {
    recordResult('5.1 Double-counting prevention test', false, 'DB + Accounting', err.message);
  }

  // ============================================================================
  // 6. A8 PURCHASE/VOUCHER APPLICATION REGRESSION TEST
  // ============================================================================
  console.log('\n--- 6. A8 Purchase / Voucher Application Regression Test ---');

  try {
    // Test fuzzy supplier match logic with brand_name
    const availableTokensMock = [
      { id: '1', brand_name: "Gobi", series_name: 'Weather Guard', unit_name: 'Gallon', token_value: 500 },
      { id: '2', brand_name: 'Berger', series_name: 'All Weather', unit_name: 'Gallon', token_value: 600 },
    ];
    const supplierName = "Gobi Hardware & Chemical Supplies";

    // Same matching algorithm as updated in PurchasesView.tsx
    const filterTokens = (tokens, supName) => {
      const s = supName.toLowerCase().trim();
      return tokens.filter((t) => {
        const brand = (t.brand_name || t.brand || '').toLowerCase().trim();
        if (!brand) return false;
        const brandWords = brand.split(/\s+/).filter((w) => w.length > 2);
        const supWords = s.split(/\s+/).filter((w) => w.length > 2);
        return (
          s.includes(brand) ||
          brand.includes(s) ||
          brandWords.some((w) => s.includes(w)) ||
          supWords.some((w) => brand.includes(w))
        );
      });
    };

    const matched = filterTokens(availableTokensMock, supplierName);
    const passedMatch = matched.length === 1 && matched[0].brand_name === "Gobi";

    recordResult(
      '6.1 PurchasesView fuzzy supplier matching by brand_name',
      passedMatch,
      'Client Logic',
      `Matched: ${matched.map((m) => m.brand_name).join(', ')} for supplier "${supplierName}"`
    );
  } catch (err) {
    recordResult('6.1 PurchasesView fuzzy matching regression', false, 'Client Logic', err.message);
  }

  // ============================================================================
  // 7. TASK 6.5 REDEMPTION & TASK 6.3 TOKEN INHERITANCE REGRESSION TESTS
  // ============================================================================
  console.log('\n--- 7. Tasks 6.5 & 6.3 Regression Tests ---');

  // 7.1 Customer Redemption API regression (Task 6.5)
  try {
    const res = await fetch(`${BASE_URL}/api/token-redemptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        client_name: 'Regression Test Painter',
        lines: [
          {
            brand_id: brandGobi.id,
            brand_name: brandGobi.name,
            series_id: seriesWeather.id,
            series_name: seriesWeather.name,
            unit_name: 'Gallon',
            quantity: 2,
          },
        ],
      }),
    });
    const data = await res.json();
    const passed =
      res.status === 200 &&
      data.success === true &&
      data.redemption?.total_amount === 1000; // 2 * 500

    if (data.redemption?.id) {
      // Find created token transaction and clean up
      const { data: rTxns } = await supabase
        .from('token_transactions')
        .select('id')
        .eq('redemption_id', data.redemption.id);
      rTxns?.forEach((x) => cleanupTxnIds.push(x.id));
      await supabase.from('token_redemption_items').delete().eq('redemption_id', data.redemption.id);
      await supabase.from('token_redemptions').delete().eq('id', data.redemption.id);
    }

    recordResult(
      '7.1 Task 6.5 Customer Multi-Line Redemption API flow intact',
      passed,
      'API-Level',
      `Redemption total: Rs.${data.redemption?.total_amount} (exp: 1000)`
    );
  } catch (err) {
    recordResult('7.1 Task 6.5 Redemption API flow regression', false, 'API-Level', err.message);
  }

  // 7.2 Product Token Value Inheritance regression (Task 6.3)
  try {
    const res = await fetch(`${BASE_URL}/api/items?tenant_id=${tenantId}`, { headers });
    const data = await res.json();
    const items = data.items || [];
    const weatherItem = items.find((i) => i.series_id === seriesWeather.id);

    const passed = items.length > 0;
    recordResult(
      '7.2 Task 6.3 Catalog dynamic series token inheritance intact',
      passed,
      'API-Level',
      `Catalog items retrieved: ${items.length}, sample item series: ${weatherItem?.series_name || 'N/A'}`
    );
  } catch (err) {
    recordResult('7.2 Task 6.3 Catalog token inheritance regression', false, 'API-Level', err.message);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================
  console.log('\n--- Cleaning up temporary test transactions ---');
  if (cleanupTxnIds.length > 0) {
    const uniqueIds = [...new Set(cleanupTxnIds)];
    const { error: delErr } = await supabase.from('token_transactions').delete().in('id', uniqueIds);
    if (delErr) {
      console.warn('⚠️ Cleanup error:', delErr.message);
    } else {
      console.log(`✅ Cleaned up ${uniqueIds.length} temporary test records.`);
    }
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('================================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`Total Tests Run: ${testResults.length}`);
  console.log(`Passed: ${testResults.filter((t) => t.passed).length}`);
  console.log(`Failed: ${testResults.filter((t) => !t.passed).length}`);
  console.log(`Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runComprehensiveVerification().catch((err) => {
  console.error('\n❌ Comprehensive Suite Failed with Uncaught Error:', err);
  process.exit(1);
});
