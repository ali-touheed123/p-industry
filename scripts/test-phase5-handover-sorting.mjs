// scripts/test-phase5-handover-sorting.mjs
import assert from 'node:assert/strict';

console.log('=== RUNNING PHASE 5 AUDIT SUITE (B9, N6, SHIFT HANDOVER & SORTING) ===\n');

// ---------------------------------------------------------------------------
// TEST 1: B9 Shift Open Handover Math
// ---------------------------------------------------------------------------
console.log('--- TEST 1: B9 Shift Open Handover Math ---');

function computeShiftOpenHandover(currentLastClosed, openingCashInput) {
  const openingAmt = parseFloat(openingCashInput) || 0;
  const hasPreviousClosed = Boolean(
    currentLastClosed &&
    currentLastClosed.actual_cash !== undefined &&
    currentLastClosed.actual_cash !== null
  );
  const prevClosing = hasPreviousClosed ? Number(currentLastClosed.actual_cash) : null;
  const handoverVariance = hasPreviousClosed && prevClosing !== null ? openingAmt - prevClosing : null;
  const handoverNotes = hasPreviousClosed && prevClosing !== null
    ? `Handover: Prev shift closed Rs.${prevClosing.toLocaleString()}, Counted Rs.${openingAmt.toLocaleString()}, Variance ${(handoverVariance ?? 0) >= 0 ? '+' : ''}Rs.${(handoverVariance ?? 0).toLocaleString()}`
    : 'First shift of the day';

  return {
    opening_cash: openingAmt,
    previous_closing_cash: prevClosing,
    handover_variance: handoverVariance,
    handover_notes: handoverNotes,
  };
}

// Case A: First shift of the day (no previous closed shift)
const firstShift = computeShiftOpenHandover(null, '5000');
console.log('First Shift Payload:', firstShift);
assert.equal(firstShift.previous_closing_cash, null, 'First shift previous_closing_cash must be null');
assert.equal(firstShift.handover_variance, null, 'First shift handover_variance must be null');
assert.equal(firstShift.handover_notes, 'First shift of the day');

// Case B: Subsequent shift with previous closed shift
const secondShift = computeShiftOpenHandover({ actual_cash: 5000 }, '4800');
console.log('Second Shift Payload:', secondShift);
assert.equal(secondShift.previous_closing_cash, 5000, 'Subsequent shift previous_closing_cash must match');
assert.equal(secondShift.handover_variance, -200, 'Subsequent shift handover_variance must be -200');
assert.match(secondShift.handover_notes, /Handover: Prev shift closed Rs\.5,000/);

console.log('✓ Test 1 Passed: B9 Shift Open Handover Math verified.\n');

// ---------------------------------------------------------------------------
// TEST 2: B9 DayCloseView Handover Banner Suppression
// ---------------------------------------------------------------------------
console.log('--- TEST 2: B9 DayCloseView Handover Banner Suppression ---');

function resolveShiftHandover(s, openAmt) {
  const hasPrevClosedShift = Boolean(
    s.previous_closing_cash !== null &&
    s.previous_closing_cash !== undefined &&
    s.handover_notes !== 'First shift of the day' &&
    !(Number(s.previous_closing_cash) === 0 && (!s.handover_notes || !s.handover_notes.toLowerCase().startsWith('handover:')))
  );

  const prevClosingCash = hasPrevClosedShift ? Number(s.previous_closing_cash || 0) : null;
  const handoverVarianceAmt = hasPrevClosedShift && s.handover_variance !== null && s.handover_variance !== undefined
    ? Number(s.handover_variance)
    : null;
  const handoverStatus = handoverVarianceAmt !== null
    ? (handoverVarianceAmt === 0 ? 'MATCHED' : (handoverVarianceAmt < 0 ? 'SHORT' : 'EXCESS'))
    : undefined;

  if (hasPrevClosedShift && prevClosingCash !== null && handoverVarianceAmt !== null && handoverStatus) {
    return {
      previousClosingCash: prevClosingCash,
      openingCountedCash: openAmt,
      handoverVariance: handoverVarianceAmt,
      handoverStatus,
      handoverNotes: s.handover_notes || undefined,
    };
  }
  return undefined;
}

// Case A: Test day shift 2026-10-26 (first shift with legacy 0 / 'First shift of the day')
const legacyDayShift = {
  opening_cash: 5000,
  previous_closing_cash: 0,
  handover_variance: 5000,
  handover_notes: 'First shift of the day',
};
const handoverResultA = resolveShiftHandover(legacyDayShift, 5000);
console.log('Legacy first shift handover result:', handoverResultA);
assert.equal(handoverResultA, undefined, 'Banner must NOT render on legacy first shift');

// Case B: New first shift with nulls
const newFirstShift = {
  opening_cash: 5000,
  previous_closing_cash: null,
  handover_variance: null,
  handover_notes: 'First shift of the day',
};
const handoverResultB = resolveShiftHandover(newFirstShift, 5000);
console.log('New first shift handover result:', handoverResultB);
assert.equal(handoverResultB, undefined, 'Banner must NOT render on new first shift');

// Case C: Real shift handover with variance
const realHandoverShift = {
  opening_cash: 5000,
  previous_closing_cash: 5200,
  handover_variance: -200,
  handover_notes: 'Handover: Prev shift closed Rs.5,200...',
};
const handoverResultC = resolveShiftHandover(realHandoverShift, 5000);
console.log('Real handover shift result:', handoverResultC);
assert.ok(handoverResultC, 'Handover record must exist when previous shift closed');
assert.equal(handoverResultC.handoverStatus, 'SHORT');
assert.equal(handoverResultC.handoverVariance, -200);

console.log('✓ Test 2 Passed: B9 DayCloseView Handover Banner Suppression verified.\n');

// ---------------------------------------------------------------------------
// TEST 3: N6 Timestamp Sorting of Same-Day Shifts
// ---------------------------------------------------------------------------
console.log('--- TEST 3: N6 Timestamp Sorting of Same-Day Shifts ---');

const rawShiftsOnSameDay = [
  {
    id: 'shift-afternoon',
    start_time: '2026-10-26T14:30:00Z',
    shiftTime: '02:30 PM', // 12-hour format string
  },
  {
    id: 'shift-morning',
    start_time: '2026-10-26T08:00:00Z',
    shiftTime: '08:00 AM', // 12-hour format string
  },
  {
    id: 'shift-noon',
    start_time: '2026-10-26T12:00:00Z',
    shiftTime: '12:00 PM', // 12-hour format string
  },
  {
    id: 'shift-evening',
    start_time: '2026-10-26T18:00:00Z',
    shiftTime: '06:00 PM', // 12-hour format string
  },
];

// Flawed legacy sorting: 12-hour string localeCompare
const flawedOrder = [...rawShiftsOnSameDay].sort((a, b) =>
  (a.shiftTime || '').localeCompare(b.shiftTime || '')
);
console.log('Legacy 12-hour string order:', flawedOrder.map(s => s.shiftTime));
// Notice: '02:30 PM' < '06:00 PM' < '08:00 AM' < '12:00 PM' -> 8 AM was sorted AFTER 2 PM!

// Correct N6 sorting: start_time timestamp ascending
const correctedOrder = [...rawShiftsOnSameDay].sort((a, b) => {
  const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
  const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
  return timeA - timeB;
});
console.log('Corrected timestamp order:', correctedOrder.map(s => s.shiftTime));

assert.deepEqual(
  correctedOrder.map(s => s.id),
  ['shift-morning', 'shift-noon', 'shift-afternoon', 'shift-evening'],
  'Same-day shifts must sort chronologically by start_time'
);
console.log('✓ Test 3 Passed: N6 Timestamp Sorting verified.\n');

// ---------------------------------------------------------------------------
// TEST 4: N6 Consistent Local Date Computation
// ---------------------------------------------------------------------------
console.log('--- TEST 4: N6 Consistent Local Date Computation ---');

const toShopLocalDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dateOnlyStr = '2026-10-26';
const isoTimestamp = '2026-10-26T10:15:30.000Z';
const dateObj = new Date('2026-10-26T10:15:30.000Z');

assert.equal(toShopLocalDate(dateOnlyStr), '2026-10-26');
assert.equal(toShopLocalDate(isoTimestamp), toShopLocalDate(dateObj));
assert.equal(toShopLocalDate(null), '');
assert.equal(toShopLocalDate(undefined), '');

console.log('✓ Test 4 Passed: N6 Consistent Local Date Computation verified.\n');

console.log('====================================================');
console.log('  ALL PHASE 5 TESTS PASSED (B9, N6)                 ');
console.log('====================================================');
