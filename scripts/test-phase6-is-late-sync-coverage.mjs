/**
 * test-phase6-is-late-sync-coverage.mjs
 * Phase 6 — Step 4: Verify every query that feeds computeShiftCash selects is_late_sync.
 *
 * Also verifies ShiftDrawer and DayCloseView filter on is_late_sync.
 *
 * Run: node scripts/test-phase6-is-late-sync-coverage.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve('.');
let passed = 0;
let failed = 0;

function check(description, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}${detail ? '\n       ' + detail : ''}`);
    failed++;
  }
}

// ── 1. shifts/route.ts: The one query feeding computeShiftCash ─────────────
console.log('\n[1] shifts/route.ts — invoice query feeding computeShiftCash');
const shiftsRoute = readFileSync(resolve(ROOT, 'src/app/api/shifts/route.ts'), 'utf8');

// Find the computeShiftCash call and the select that precedes it
const computeCallIdx = shiftsRoute.indexOf('const breakdown = computeShiftCash(');
check(
  'computeShiftCash is called',
  computeCallIdx !== -1,
);

// Search back far enough from the computeShiftCash call to find the invoices select.
// The select is ~1800 chars before the call — use 2500 to be safe.
const beforeCompute = shiftsRoute.slice(Math.max(0, computeCallIdx - 2500), computeCallIdx);
check(
  'Invoice select before computeShiftCash includes is_late_sync',
  beforeCompute.includes('is_late_sync'),
  'Expected .select(..., is_late_sync) in the invoices query that feeds computeShiftCash'
);

// Confirm it's on the right table
check(
  "Invoice select is from 'invoices' table",
  beforeCompute.includes(".from('invoices')"),
);

// ── 2. shifts/route.ts: prevNetSales query (same-day delta) ───────────────
console.log('\n[2] shifts/route.ts — prevNetSales query (NOT feeding computeShiftCash)');
// This query calculates a simple net-sales sum for the prev shift badge.
// It does NOT go through computeShiftCash so it does NOT need is_late_sync.
// We just document this intentional omission.
const prevNetSalesIdx = shiftsRoute.indexOf('prevNetSales');
check(
  'prevNetSales query exists (same-day delta, intentionally no is_late_sync)',
  prevNetSalesIdx !== -1,
);
const prevSelect = shiftsRoute.slice(
  shiftsRoute.lastIndexOf('.from(\'invoices\')', prevNetSalesIdx),
  prevNetSalesIdx + 300
);
check(
  'prevNetSales does NOT go through computeShiftCash (intentional)',
  !prevSelect.includes('computeShiftCash'),
);

// ── 3. cashLedger.ts: InvoiceLike interface has is_late_sync ──────────────
console.log('\n[3] cashLedger.ts — InvoiceLike interface');
const cashLedger = readFileSync(resolve(ROOT, 'src/utils/cashLedger.ts'), 'utf8');
check(
  'InvoiceLike interface includes is_late_sync field',
  cashLedger.includes('is_late_sync')
);
check(
  'computeShiftCash filters on inv.is_late_sync === true',
  cashLedger.includes('inv.is_late_sync === true')
);
check(
  'offlineLateSalesCash accumulator exists',
  cashLedger.includes('offlineLateSalesCash')
);
check(
  'offlineLateReturnsCash accumulator exists',
  cashLedger.includes('offlineLateReturnsCash')
);
check(
  'ShiftCashBreakdown exposes offlineLateSalesCount',
  cashLedger.includes('offlineLateSalesCount')
);

// ── 4. ShiftDrawer.tsx: filters invoices on is_late_sync ──────────────────
console.log('\n[4] ShiftDrawer.tsx — late-sync filtering');
const shiftDrawer = readFileSync(resolve(ROOT, 'src/components/ShiftDrawer.tsx'), 'utf8');
check(
  'ShiftDrawer filters currentShiftSales by !i.is_late_sync',
  shiftDrawer.includes('!i.is_late_sync') || shiftDrawer.includes('!inv.is_late_sync')
);
check(
  'ShiftDrawer shows amber late-sync panel',
  shiftDrawer.includes('offlineLateSalesCount') || shiftDrawer.includes('Late-Synced Offline')
);

// ── 5. DayCloseView.tsx: filters invoices on is_late_sync ─────────────────
console.log('\n[5] DayCloseView.tsx — late-sync filtering');
const dayClose = readFileSync(resolve(ROOT, 'src/components/ceo-panel/DayCloseView.tsx'), 'utf8');
check(
  'DayCloseView filters currentShiftSalesInvs by !i.is_late_sync',
  dayClose.includes('is_late_sync')
);
check(
  'DayCloseView shows audit note for late-synced transactions',
  dayClose.includes('offlineLateSalesCash') || dayClose.includes('Late-Synced')
);

// ── 6. invoices/route.ts: OFFLINE_TIME errors handled ────────────────────
console.log('\n[6] invoices/route.ts — OFFLINE_TIME error handlers');
const invoicesRoute = readFileSync(resolve(ROOT, 'src/app/api/invoices/route.ts'), 'utf8');
check(
  'Route catches OFFLINE_TIME_FUTURE and returns 422',
  invoicesRoute.includes("OFFLINE_TIME_FUTURE") && invoicesRoute.includes('status: 422')
);
check(
  'Route catches OFFLINE_TIME_TOO_OLD and returns 422 with needs_attention',
  invoicesRoute.includes("OFFLINE_TIME_TOO_OLD") && invoicesRoute.includes('needs_attention: true')
);
check(
  'Route catches OFFLINE_RECEIPT_DUPLICATE and returns 409',
  invoicesRoute.includes("OFFLINE_RECEIPT_DUPLICATE") && invoicesRoute.includes('status: 409')
);

// ── 7. historicalMatches shadow bug is fixed ──────────────────────────────
console.log('\n[7] invoices/route.ts — historicalMatches no inner re-declaration');
// Count occurrences of "const historicalMatches" — must be exactly 1 (outer scope only)
const outerDeclarations = (invoicesRoute.match(/const historicalMatches: HistoricalPriceMatch\[\] = \[\]/g) || []).length;
check(
  'historicalMatches declared exactly once (outer scope, no shadow)',
  outerDeclarations === 1,
  `Found ${outerDeclarations} declarations (expected 1)`
);

const specialRoute = readFileSync(resolve(ROOT, 'src/app/api/invoices/special/route.ts'), 'utf8');
const specialDeclarations = (specialRoute.match(/const historicalMatches: HistoricalPriceMatch\[\] = \[\]/g) || []).length;
check(
  'special/route.ts: historicalMatches declared exactly once (no shadow)',
  specialDeclarations === 1,
  `Found ${specialDeclarations} declarations (expected 1)`
);

// ── 8. RPC migration file exists and covers all 8 offline columns ─────────
console.log('\n[8] Migration 05 (RPC v2) — offline column coverage');
const rpcMigration = readFileSync(
  resolve(ROOT, 'supabase/migrations/20261030_05_create_invoice_atomic_v2_offline.sql'), 'utf8'
);
const requiredColumns = [
  'is_offline', 'created_at_local', 'device_id', 'local_receipt_no',
  'synced_at', 'offline_schema_version', 'is_late_sync', 'original_shift_id'
];
for (const col of requiredColumns) {
  check(`RPC migration inserts ${col}`, rpcMigration.includes(col));
}
// Verify new fingerprint excludes shift_id:
const newFpStart = rpcMigration.indexOf('v_payload_fingerprint := md5(');
const legacyFpStart = rpcMigration.indexOf('v_legacy_fingerprint := md5(');
const newFpBlock = rpcMigration.slice(newFpStart, legacyFpStart);
check('New fingerprint block does NOT include v_shift_id', !newFpBlock.includes('v_shift_id'), 'shift_id must only be in legacy fingerprint');
check('Legacy fingerprint includes v_shift_id', rpcMigration.slice(legacyFpStart, legacyFpStart + 600).includes('v_shift_id'));
check('RPC migration has OFFLINE_TIME_FUTURE check', rpcMigration.includes('OFFLINE_TIME_FUTURE'));
check('RPC migration has OFFLINE_TIME_TOO_OLD check', rpcMigration.includes('OFFLINE_TIME_TOO_OLD'));
check('RPC migration catches idx_invoices_offline_dedup', rpcMigration.includes('idx_invoices_offline_dedup'));
check('RPC migration sets synced_at = NOW() when offline', rpcMigration.includes('v_synced_at'));
check('v_date derived from created_at_local when offline', rpcMigration.includes('v_created_at_local AT TIME ZONE'));

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Phase 6 is_late_sync coverage: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Some checks failed — fix before applying migrations.');
  process.exit(1);
} else {
  console.log('All checks passed ✅');
}