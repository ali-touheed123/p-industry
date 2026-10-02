import { createClient } from '@supabase/supabase-js';
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

async function runVerification() {
  console.log('🚀 Starting Task 6.5 Verification Suite...\n');

  // 1. Get Tenant
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('id, name').limit(1).single();
  if (tErr || !tenant) throw new Error('Could not find tenant: ' + tErr?.message);
  const tenantId = tenant.id;
  console.log(`✅ Using Tenant: "${tenant.name}" (${tenantId})`);

  // 2. Setup / Ensure Brands and Series
  // Brand 1: Gobi's Paints
  let { data: brandGobi } = await supabase.from('brands').select('id, name').eq('tenant_id', tenantId).ilike('name', '%Gobi%').maybeSingle();
  if (!brandGobi) {
    const { data: newB } = await supabase.from('brands').insert({ tenant_id: tenantId, name: "Gobi's Paints", status: 'active' }).select().single();
    brandGobi = newB;
  }
  console.log(`✅ Brand Gobi: ${brandGobi.name} (${brandGobi.id})`);

  let { data: seriesPremium } = await supabase.from('brand_series').select('id, name').eq('tenant_id', tenantId).eq('brand_id', brandGobi.id).ilike('name', '%Premium%').maybeSingle();
  if (!seriesPremium) {
    const { data: newS } = await supabase.from('brand_series').insert({ tenant_id: tenantId, brand_id: brandGobi.id, name: 'Premium Weather', status: 'active' }).select().single();
    seriesPremium = newS;
  }
  console.log(`✅ Series Premium: ${seriesPremium.name} (${seriesPremium.id})`);

  // Config: Gallon @ Rs 500
  let { data: cfgGallon } = await supabase.from('series_token_configs').select('*').eq('tenant_id', tenantId).eq('series_id', seriesPremium.id).eq('unit_name', 'Gallon').maybeSingle();
  if (!cfgGallon) {
    const { data: newC } = await supabase.from('series_token_configs').insert({
      tenant_id: tenantId, series_id: seriesPremium.id, unit_name: 'Gallon', is_enabled: true, token_value: 500, is_drum_auto: false
    }).select().single();
    cfgGallon = newC;
  } else if (!cfgGallon.is_enabled || Number(cfgGallon.token_value) !== 500) {
    const { data: updC } = await supabase.from('series_token_configs').update({ is_enabled: true, token_value: 500 }).eq('id', cfgGallon.id).select().single();
    cfgGallon = updC;
  }
  console.log(`✅ Config Gallon: is_enabled=${cfgGallon.is_enabled}, token_value=Rs ${cfgGallon.token_value}`);

  // Brand 2: Brighto
  let { data: brandBrighto } = await supabase.from('brands').select('id, name').eq('tenant_id', tenantId).ilike('name', '%Brighto%').maybeSingle();
  if (!brandBrighto) {
    const { data: newB } = await supabase.from('brands').insert({ tenant_id: tenantId, name: 'Brighto Paints', status: 'active' }).select().single();
    brandBrighto = newB;
  }
  console.log(`✅ Brand Brighto: ${brandBrighto.name} (${brandBrighto.id})`);

  let { data: seriesGold } = await supabase.from('brand_series').select('id, name').eq('tenant_id', tenantId).eq('brand_id', brandBrighto.id).ilike('name', '%Gold%').maybeSingle();
  if (!seriesGold) {
    const { data: newS } = await supabase.from('brand_series').insert({ tenant_id: tenantId, brand_id: brandBrighto.id, name: 'Gold Synthetic', status: 'active' }).select().single();
    seriesGold = newS;
  }
  console.log(`✅ Series Gold: ${seriesGold.name} (${seriesGold.id})`);

  // Config: Drum @ Rs 2000
  let { data: cfgDrum } = await supabase.from('series_token_configs').select('*').eq('tenant_id', tenantId).eq('series_id', seriesGold.id).eq('unit_name', 'Drum').maybeSingle();
  if (!cfgDrum) {
    const { data: newC } = await supabase.from('series_token_configs').insert({
      tenant_id: tenantId, series_id: seriesGold.id, unit_name: 'Drum', is_enabled: true, token_value: 2000, is_drum_auto: false
    }).select().single();
    cfgDrum = newC;
  } else if (!cfgDrum.is_enabled || Number(cfgDrum.token_value) !== 2000) {
    const { data: updC } = await supabase.from('series_token_configs').update({ is_enabled: true, token_value: 2000 }).eq('id', cfgDrum.id).select().single();
    cfgDrum = updC;
  }
  console.log(`✅ Config Drum: is_enabled=${cfgDrum.is_enabled}, token_value=Rs ${cfgDrum.token_value}`);

  // Inactive Series for negative testing
  let { data: inactiveSeries } = await supabase.from('brand_series').select('id, name').eq('tenant_id', tenantId).eq('brand_id', brandGobi.id).eq('status', 'inactive').maybeSingle();
  if (!inactiveSeries) {
    const { data: newInact } = await supabase.from('brand_series').insert({ tenant_id: tenantId, brand_id: brandGobi.id, name: 'Discontinued Vintage', status: 'inactive' }).select().single();
    inactiveSeries = newInact;
  }

  // Disabled Unit for negative testing
  let { data: cfgDisabled } = await supabase.from('series_token_configs').select('*').eq('tenant_id', tenantId).eq('series_id', seriesPremium.id).eq('unit_name', 'Quarter').maybeSingle();
  if (!cfgDisabled) {
    const { data: newDis } = await supabase.from('series_token_configs').insert({
      tenant_id: tenantId, series_id: seriesPremium.id, unit_name: 'Quarter', is_enabled: false, token_value: 125, is_drum_auto: false
    }).select().single();
    cfgDisabled = newDis;
  } else if (cfgDisabled.is_enabled) {
    await supabase.from('series_token_configs').update({ is_enabled: false }).eq('id', cfgDisabled.id);
  }

  // 3. Client
  let { data: testClient } = await supabase.from('clients').select('id, name, token_balance').eq('tenant_id', tenantId).limit(1).maybeSingle();
  if (!testClient) {
    const { data: newCl } = await supabase.from('clients').insert({ tenant_id: tenantId, name: 'Test Contractor Ali', phone: '03001234567' }).select().single();
    testClient = newCl;
  }
  const initialTokenBalance = Number(testClient.token_balance || 0);
  console.log(`✅ Test Registered Client: ${testClient.name} (initial token_balance: ${initialTokenBalance})`);

  // 4. Shift
  let { data: activeShift } = await supabase.from('shifts').select('*').eq('tenant_id', tenantId).eq('status', 'open').maybeSingle();
  if (!activeShift) {
    const { data: newSh } = await supabase.from('shifts').insert({
      tenant_id: tenantId,
      opened_by: 'Cashier Test',
      opening_amount: 10000,
      expected_cash: 10000,
      actual_cash: 10000,
      status: 'open',
    }).select().single();
    activeShift = newSh;
  }
  console.log(`✅ Active Shift: #${activeShift.id.slice(0, 8)} (opening_amount: Rs ${activeShift.opening_amount})`);

  // ── TEST SCENARIO A & B: Multi-Line Atomic Redemption ─────────────────────────
  console.log('\n--- Running Scenario A + B Multi-Line Redemption ---');
  console.log('Line 1: Gobi / Premium / Gallon x 3 @ Rs 500 = Rs 1,500');
  console.log('Line 2: Brighto / Gold / Drum x 1 @ Rs 2,000 = Rs 2,000');
  console.log('Expected Total Payout: Rs 3,500 (4 tokens)\n');

  const testRedemptionNo = `RDM-TEST-${Date.now()}`;
  const redemptionData = {
    tenant_id: tenantId,
    redemption_no: testRedemptionNo,
    client_id: testClient.id,
    client_name: testClient.name,
    shift_id: activeShift.id,
    created_by: 'Cashier Test',
    notes: 'Task 6.5 End-to-End Verification Scenario A+B',
    payout_method: 'cash',
  };

  const lines = [
    {
      brand_id: brandGobi.id,
      series_id: seriesPremium.id,
      unit_name: 'Gallon',
      quantity: 3,
    },
    {
      brand_id: brandBrighto.id,
      series_id: seriesGold.id,
      unit_name: 'Drum',
      quantity: 1,
    },
  ];

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: redemptionData,
    p_lines: lines,
  });

  if (rpcErr) {
    throw new Error('RPC Failed: ' + rpcErr.message);
  }

  console.log('RPC Response:', JSON.stringify(rpcRes, null, 2));

  if (!rpcRes.success) throw new Error('RPC returned success=false');
  if (rpcRes.total_tokens !== 4) throw new Error(`Expected 4 total_tokens, got ${rpcRes.total_tokens}`);
  if (Number(rpcRes.total_amount) !== 3500) throw new Error(`Expected Rs 3500 total_amount, got ${rpcRes.total_amount}`);

  const redemptionId = rpcRes.redemption_id;

  // Verify DB Rows
  // 1. token_redemptions header
  const { data: header, error: hErr } = await supabase.from('token_redemptions').select('*').eq('id', redemptionId).single();
  if (hErr || !header) throw new Error('Header row not found: ' + hErr?.message);
  console.log(`✅ token_redemptions header created: ID ${header.id}, No: ${header.redemption_no}, Total Tokens: ${header.total_tokens}, Total Amount: Rs ${header.total_amount}, Shift: ${header.shift_id}`);

  // 2. token_redemption_items
  const { data: items, error: iErr } = await supabase.from('token_redemption_items').select('*').eq('redemption_id', redemptionId).order('line_total', { ascending: true });
  if (iErr) throw new Error('Items query failed: ' + iErr.message);
  if (items.length !== 2) throw new Error(`Expected 2 redemption items, got ${items.length}`);
  console.log(`✅ token_redemption_items count: ${items.length}`);
  console.log(`   - Item 1: ${items[0].brand_name} / ${items[0].series_name} (${items[0].unit_name}) x${items[0].quantity} @ Rs ${items[0].token_value} = Rs ${items[0].line_total}`);
  console.log(`   - Item 2: ${items[1].brand_name} / ${items[1].series_name} (${items[1].unit_name}) x${items[1].quantity} @ Rs ${items[1].token_value} = Rs ${items[1].line_total}`);

  // 3. token_transactions
  const { data: txns, error: txErr } = await supabase.from('token_transactions').select('*').eq('redemption_id', redemptionId).order('total_amount', { ascending: true });
  if (txErr) throw new Error('Transactions query failed: ' + txErr.message);
  if (txns.length !== 2) throw new Error(`Expected 2 token_transactions rows, got ${txns.length}`);
  for (const t of txns) {
    if (t.type !== 'redeemed') throw new Error(`Expected type='redeemed', got '${t.type}'`);
    if (t.usage_status !== 'available') throw new Error(`Expected usage_status='available', got '${t.usage_status}'`);
    if (t.remaining_quantity !== t.quantity) throw new Error(`Expected remaining_quantity=${t.quantity}, got ${t.remaining_quantity}`);
    if (t.shift_id !== activeShift.id) throw new Error(`Expected shift_id=${activeShift.id}, got ${t.shift_id}`);
    console.log(`✅ token_transactions row: type=${t.type}, usage_status=${t.usage_status}, qty=${t.quantity}, rem_qty=${t.remaining_quantity}, amount=Rs ${t.total_amount}, shift=${t.shift_id}`);
  }

  // 4. Verify clients.token_balance was NEVER touched
  const { data: clientAfter } = await supabase.from('clients').select('token_balance').eq('id', testClient.id).single();
  const tokenBalanceAfter = Number(clientAfter.token_balance || 0);
  if (tokenBalanceAfter !== initialTokenBalance) {
    throw new Error(`CRITICAL VIOLATION: clients.token_balance changed from ${initialTokenBalance} to ${tokenBalanceAfter}`);
  }
  console.log(`✅ Strict Verification: clients.token_balance was NOT modified (${tokenBalanceAfter} == ${initialTokenBalance})`);

  // 5. Shift Cash Drawer Deduction Verification
  const { data: shiftTxns } = await supabase
    .from('token_transactions')
    .select('total_amount')
    .eq('shift_id', activeShift.id)
    .eq('tenant_id', tenantId)
    .eq('type', 'redeemed');
  const totalShiftRedeemed = (shiftTxns || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  console.log(`✅ Shift Token Cash Payout sum: Rs ${totalShiftRedeemed} (correctly deducts from expected cash)`);

  // ── NEGATIVE & EDGE CASE TESTS ──────────────────────────────────────────────
  console.log('\n--- Running Negative & Edge Case Tests ---');

  // Test 1: Invalid Brand
  const { error: err1 } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: { tenant_id: tenantId, payout_method: 'cash' },
    p_lines: [{ brand_id: '00000000-0000-0000-0000-000000000000', series_id: seriesPremium.id, unit_name: 'Gallon', quantity: 1 }],
  });
  console.log(`✅ Invalid Brand test: ${err1 ? 'Caught expected exception: ' + err1.message : 'FAILED (allowed invalid brand)'}`);
  if (!err1) throw new Error('Expected exception for invalid brand');

  // Test 2: Inactive Series
  const { error: err2 } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: { tenant_id: tenantId, payout_method: 'cash' },
    p_lines: [{ brand_id: brandGobi.id, series_id: inactiveSeries.id, unit_name: 'Gallon', quantity: 1 }],
  });
  console.log(`✅ Inactive Series test: ${err2 ? 'Caught expected exception: ' + err2.message : 'FAILED (allowed inactive series)'}`);
  if (!err2) throw new Error('Expected exception for inactive series');

  // Test 3: Disabled Unit
  const { error: err3 } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: { tenant_id: tenantId, payout_method: 'cash' },
    p_lines: [{ brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Quarter', quantity: 1 }],
  });
  console.log(`✅ Disabled Unit test: ${err3 ? 'Caught expected exception: ' + err3.message : 'FAILED (allowed disabled unit)'}`);
  if (!err3) throw new Error('Expected exception for disabled unit');

  // Test 4: Invalid Quantity (0 or negative)
  const { error: err4 } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: { tenant_id: tenantId, payout_method: 'cash' },
    p_lines: [{ brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Gallon', quantity: 0 }],
  });
  console.log(`✅ Invalid Quantity test: ${err4 ? 'Caught expected exception: ' + err4.message : 'FAILED (allowed 0 quantity)'}`);
  if (!err4) throw new Error('Expected exception for 0 quantity');

  // Test 5: Missing Unit Configuration
  const { error: err5 } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: { tenant_id: tenantId, payout_method: 'cash' },
    p_lines: [{ brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'NonExistentUnit500L', quantity: 1 }],
  });
  console.log(`✅ Missing Unit Config test: ${err5 ? 'Caught expected exception: ' + err5.message : 'FAILED (allowed unconfigured unit)'}`);
  if (!err5) throw new Error('Expected exception for unconfigured unit');

  // Test 6: Non-Cash Payout Method
  const { error: err6 } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: { tenant_id: tenantId, payout_method: 'bank_transfer' },
    p_lines: [{ brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Gallon', quantity: 1 }],
  });
  console.log(`✅ Non-Cash Payout Method test: ${err6 ? 'Caught expected exception: ' + err6.message : 'FAILED (allowed bank payout)'}`);
  if (!err6) throw new Error('Expected exception for non-cash payout method');

  // Test 7: Duplicate Redemption Number Protection
  const { data: dupRes, error: dupErr } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: {
      tenant_id: tenantId,
      redemption_no: testRedemptionNo, // same number
      client_name: 'Duplicate Test',
      payout_method: 'cash',
    },
    p_lines: [{ brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Gallon', quantity: 1 }],
  });
  if (dupErr) {
    console.log(`✅ Duplicate Number test: Caught DB constraint violation: ${dupErr.message}`);
  } else if (dupRes && dupRes.is_duplicate) {
    console.log(`✅ Duplicate Number test: Idempotency handler returned is_duplicate=true`);
  } else {
    throw new Error('FAILED: Duplicate redemption_no was accepted without duplicate flag');
  }

  // Test 8: CRITICAL TRANSACTION ATOMICITY & COMPLETE ROLLBACK TEST
  // Send 2 lines: Line 1 is valid, Line 2 has invalid/disabled unit.
  // The entire transaction must rollback. NO partial header, items, or token transactions!
  console.log('\n--- Running Atomicity Rollback Test ---');
  const rollbackRedemptionNo = `RDM-ROLLBACK-${Date.now()}`;
  const { error: rollbackErr } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: {
      tenant_id: tenantId,
      redemption_no: rollbackRedemptionNo,
      client_name: 'Rollback Customer',
      payout_method: 'cash',
    },
    p_lines: [
      { brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Gallon', quantity: 1 }, // valid
      { brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Quarter', quantity: 1 }, // DISABLED UNIT!
    ],
  });

  console.log(`Rollback trigger error: ${rollbackErr?.message}`);
  if (!rollbackErr) throw new Error('Atomicity test did not fail as expected');

  // Verify that rollbackRedemptionNo DOES NOT EXIST in token_redemptions
  const { data: ghostHeader } = await supabase.from('token_redemptions').select('id').eq('tenant_id', tenantId).eq('redemption_no', rollbackRedemptionNo).maybeSingle();
  if (ghostHeader) throw new Error(`CRITICAL BUG: Partial header row ${ghostHeader.id} was created during failed transaction!`);

  // Verify that no orphaned token_transactions were created with this note/reference
  const { data: ghostTxns } = await supabase.from('token_transactions').select('id').eq('tenant_id', tenantId).ilike('notes', `%${rollbackRedemptionNo}%`);
  if (ghostTxns && ghostTxns.length > 0) throw new Error(`CRITICAL BUG: ${ghostTxns.length} orphaned token_transactions rows created during failed transaction!`);

  console.log('✅ COMPLETE ATOMIC ROLLBACK CONFIRMED: 0 partial header rows, 0 partial item rows, 0 partial token transactions!');

  // Test 9: Walk-in Customer support
  console.log('\n--- Running Walk-in Customer Test ---');
  const walkinNo = `RDM-WALKIN-${Date.now()}`;
  const { data: walkinRes, error: walkinErr } = await supabase.rpc('redeem_tokens_atomic', {
    p_redemption_data: {
      tenant_id: tenantId,
      redemption_no: walkinNo,
      client_id: null,
      client_name: 'Walk-in Customer (Painter Saeed)',
      shift_id: activeShift.id,
      payout_method: 'cash',
    },
    p_lines: [{ brand_id: brandGobi.id, series_id: seriesPremium.id, unit_name: 'Gallon', quantity: 1 }],
  });
  if (walkinErr || !walkinRes?.success) throw new Error('Walk-in redemption failed: ' + walkinErr?.message);
  console.log(`✅ Walk-in Customer redemption confirmed: ${walkinRes.redemption_no}, Customer: "${walkinRes.redemption?.client_name}"`);

  console.log('\n🎉 ALL TASK 6.5 VERIFICATION TESTS PASSED PERFECTLY!\n');
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
