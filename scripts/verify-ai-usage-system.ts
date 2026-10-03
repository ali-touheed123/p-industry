import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  executeCentralAiGateway,
  getShopAiQuota,
  updateMemoryGlobalSettings,
  updateMemoryTenantSettings,
  getMemoryLedger,
} from '../src/lib/ai-gateway';

// Read env
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

// Set process env
Object.assign(process.env, env);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function runVerificationSuite() {
  console.log('----------------------------------------------------');
  console.log('🤖 RUNNING CENTRALIZED AI USAGE VERIFICATION SUITE');
  console.log('----------------------------------------------------\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failedCount++;
    }
  }

  // Generate test tenant IDs
  const tenantA = `test-tenant-a-${Date.now()}`;
  const tenantB = `test-tenant-b-${Date.now()}`;

  console.log(`Testing with Tenant A (${tenantA}) & Tenant B (${tenantB})\n`);

  // Ensure Global AI is ENABLED
  updateMemoryGlobalSettings({ ai_enabled: true, short_term_rate_limit: 10 });
  updateMemoryTenantSettings(tenantA, { ai_enabled: true, daily_request_limit: 3, monthly_request_limit: 90 });
  updateMemoryTenantSettings(tenantB, { ai_enabled: true, daily_request_limit: 3, monthly_request_limit: 90 });

  // TEST 1: Initial Quota Check
  console.log('--- TEST 1: Initial Quota Check ---');
  let quotaA = await getShopAiQuota(tenantA);
  assert(quotaA.dailyLimit === 3, 'Tenant A default daily limit is 3.');
  assert(quotaA.monthlyLimit === 90, 'Tenant A default monthly limit is 90.');
  assert(quotaA.remainingDaily === 3, 'Tenant A starts with 3 remaining daily scans.');

  // TEST 2: Per-Shop Quota Enforcement (3 daily requests -> 4th blocked)
  console.log('\n--- TEST 2: Per-Shop Quota Enforcement (3 Daily Limit) ---');
  for (let i = 1; i <= 3; i++) {
    const res = await executeCentralAiGateway({
      tenantId: tenantA,
      feature: 'invoice_scanner',
      prompt: 'Extract invoice line items',
    });
    assert(res.success === true, `Request ${i}/3 authorized & executed via Central AI Gateway.`);
  }

  quotaA = await getShopAiQuota(tenantA);
  assert(quotaA.remainingDaily === 0, 'Tenant A has 0 daily scans remaining.');

  // 4th request must be BLOCKED
  const blockedRes = await executeCentralAiGateway({
    tenantId: tenantA,
    feature: 'invoice_scanner',
    prompt: 'Extract invoice line items',
  });

  assert(blockedRes.success === false, '4th request for Tenant A is BLOCKED.');
  assert(blockedRes.errorCode === 'DAILY_QUOTA_EXCEEDED', 'ErrorCode returned: DAILY_QUOTA_EXCEEDED.');

  // TEST 3: Multi-Tenant Quota Isolation (Tenant A exhausted != Tenant B)
  console.log('\n--- TEST 3: Multi-Tenant Quota Isolation ---');
  const quotaB = await getShopAiQuota(tenantB);
  assert(quotaB.remainingDaily === 3, 'Tenant B retains 3 remaining scans despite Tenant A being exhausted.');

  const resB = await executeCentralAiGateway({
    tenantId: tenantB,
    feature: 'invoice_scanner',
    prompt: 'Extract invoice line items',
  });
  assert(resB.success === true, 'Tenant B request authorized and executed successfully.');

  // TEST 4: Manual Quota Increase (Immediate Capacity)
  console.log('\n--- TEST 4: Manual Quota Increase by Developer ---');
  updateMemoryTenantSettings(tenantA, { daily_request_limit: 10 });
  quotaA = await getShopAiQuota(tenantA);
  assert(quotaA.dailyLimit === 10, 'Developer increased Tenant A limit from 3 to 10.');
  assert(quotaA.remainingDaily > 0, 'Tenant A immediately gains newly available quota slots.');

  const newResA = await executeCentralAiGateway({
    tenantId: tenantA,
    feature: 'invoice_scanner',
    prompt: 'Extract invoice line items',
  });
  assert(newResA.success === true, 'Tenant A can immediately use newly available quota.');

  // TEST 5: Global Emergency Kill Switch
  console.log('\n--- TEST 5: Global Emergency Kill Switch ---');
  updateMemoryGlobalSettings({ ai_enabled: false });
  const killedRes = await executeCentralAiGateway({
    tenantId: tenantB,
    feature: 'invoice_scanner',
    prompt: 'Extract invoice line items',
  });

  assert(killedRes.success === false, 'All requests BLOCKED when Global AI Kill Switch is OFF.');
  assert(killedRes.errorCode === 'GLOBAL_AI_DISABLED', 'ErrorCode returned: GLOBAL_AI_DISABLED.');

  // Re-enable Global AI
  updateMemoryGlobalSettings({ ai_enabled: true });
  const restoredRes = await executeCentralAiGateway({
    tenantId: tenantB,
    feature: 'invoice_scanner',
    prompt: 'Extract invoice line items',
  });
  assert(restoredRes.success === true, 'Requests immediately allowed when Global AI Kill Switch re-enabled.');

  // TEST 6: Pre-Gemini Rejection vs Consumed Usage
  console.log('\n--- TEST 6: Pre-Gemini Rejection & Ledger Verification ---');
  const ledgerBefore = getMemoryLedger().length;
  updateMemoryTenantSettings(tenantB, { ai_enabled: false });
  await executeCentralAiGateway({
    tenantId: tenantB,
    feature: 'invoice_scanner',
    prompt: 'Extract invoice line items',
  });
  const ledgerAfter = getMemoryLedger().length;

  assert(ledgerBefore === ledgerAfter, 'Pre-Gemini rejected request did NOT create or consume Gemini usage.');
  updateMemoryTenantSettings(tenantB, { ai_enabled: true });

  // TEST 7: Future Feature Support
  console.log('\n--- TEST 7: Centralized Gateway Support for Future AI Features ---');
  const futureRes = await executeCentralAiGateway({
    tenantId: tenantB,
    feature: 'ai_search',
    prompt: 'Search catalog for blue emulsion',
  });
  assert(futureRes.success === true, 'Future feature "ai_search" authorized through same Central AI Gateway.');
  assert(futureRes.tokenUsage?.inputTokens !== undefined, 'Token usage and cost recorded for future AI feature.');

  console.log('\n----------------------------------------------------');
  console.log(`🏁 VERIFICATION SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('----------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerificationSuite();
