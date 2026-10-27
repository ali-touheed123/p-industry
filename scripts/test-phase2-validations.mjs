import assert from 'node:assert/strict';

console.log('--- RUNNING PHASE 2 VALIDATION & RETURNS TEST SUITE ---');

// Helper to simulate validation logic
function validateInvoiceData({
  subtotal,
  discount = 0,
  delivery_charge = 0,
  net_total,
  paid_amount,
  due_amount,
  cash_paid = 0,
  card_paid = 0,
  bank_paid = 0,
  others_paid = 0,
  items = [],
}) {
  const parsedSubtotal = Number(subtotal) || 0;
  const parsedDiscount = Number(discount) || 0;
  const parsedDelivery = Number(delivery_charge) || 0;
  const parsedNetTotal = Number(net_total) || 0;
  const parsedPaid = Number(paid_amount) || 0;
  const parsedDue = Number(due_amount) || 0;

  if (parsedSubtotal < 0 || parsedDiscount < 0 || parsedNetTotal < 0 || parsedPaid < 0 || parsedDue < 0) {
    return { valid: false, error: 'Amounts cannot be negative' };
  }

  const expectedNet = parsedSubtotal - parsedDiscount + parsedDelivery;
  if (Math.abs(parsedNetTotal - expectedNet) > 1.00) {
    return { valid: false, error: 'Net total does not match formula' };
  }

  if (Math.abs((parsedPaid + parsedDue) - parsedNetTotal) > 1.00) {
    return { valid: false, error: 'Paid + due does not equal net total' };
  }

  const tenderSum = Number(cash_paid || 0) + Number(card_paid || 0) + Number(bank_paid || 0) + Number(others_paid || 0);
  if (Math.abs(tenderSum - parsedPaid) > 1.00) {
    return { valid: false, error: 'Tender split sum does not match paid amount' };
  }

  let calculatedLineItemsTotal = 0;
  for (const it of items) {
    const lineQty = Number(it.qty) || 0;
    const linePrice = Number(it.unit_price ?? it.rate ?? 0);
    const lineDiscVal = Number(it.discount ?? 0);
    calculatedLineItemsTotal += (it.total_price ?? (lineQty * linePrice - lineDiscVal));
  }

  if (Math.abs(parsedSubtotal - calculatedLineItemsTotal) > 1.00) {
    return { valid: false, error: 'Subtotal does not match sum of items' };
  }

  return { valid: true };
}

// Test 1: Valid Invoice passes N4 check
{
  const res = validateInvoiceData({
    subtotal: 1000,
    discount: 100,
    delivery_charge: 50,
    net_total: 950,
    paid_amount: 500,
    due_amount: 450,
    cash_paid: 300,
    card_paid: 200,
    items: [
      { qty: 2, unit_price: 500, discount: 0, total_price: 1000 }
    ]
  });
  assert.equal(res.valid, true);
  console.log('✓ Test 1: Valid invoice passes N4 mathematical validation');
}

// Test 2: Net Total mismatch caught
{
  const res = validateInvoiceData({
    subtotal: 1000,
    discount: 100,
    delivery_charge: 50,
    net_total: 900, // Should be 950!
    paid_amount: 900,
    due_amount: 0,
    cash_paid: 900,
    items: [{ qty: 1, unit_price: 1000, total_price: 1000 }]
  });
  assert.equal(res.valid, false);
  assert.match(res.error, /Net total does not match formula/);
  console.log('✓ Test 2: Net total formula mismatch correctly rejected');
}

// Test 3: Paid + Due != Net Total caught
{
  const res = validateInvoiceData({
    subtotal: 1000,
    discount: 0,
    net_total: 1000,
    paid_amount: 600,
    due_amount: 200, // Sum is 800, missing 200!
    cash_paid: 600,
    items: [{ qty: 1, unit_price: 1000, total_price: 1000 }]
  });
  assert.equal(res.valid, false);
  assert.match(res.error, /Paid \+ due does not equal net total/);
  console.log('✓ Test 3: Paid + Due inequality correctly rejected');
}

// Test 4: Split Tender mismatch caught
{
  const res = validateInvoiceData({
    subtotal: 1000,
    discount: 0,
    net_total: 1000,
    paid_amount: 1000,
    due_amount: 0,
    cash_paid: 500,
    card_paid: 300, // Sum is 800, but paid_amount is 1000!
    items: [{ qty: 1, unit_price: 1000, total_price: 1000 }]
  });
  assert.equal(res.valid, false);
  assert.match(res.error, /Tender split sum does not match paid amount/);
  console.log('✓ Test 4: Split tender discrepancy correctly rejected');
}

// Test 5: Line items total mismatch caught
{
  const res = validateInvoiceData({
    subtotal: 1000,
    discount: 0,
    net_total: 1000,
    paid_amount: 1000,
    due_amount: 0,
    cash_paid: 1000,
    items: [
      { qty: 1, unit_price: 800, total_price: 800 } // Sum is 800 != 1000
    ]
  });
  assert.equal(res.valid, false);
  assert.match(res.error, /Subtotal does not match sum of items/);
  console.log('✓ Test 5: Line items sum mismatch correctly rejected');
}

// Test 6: N3 Return quantity limits check
function validateReturnQty({ originalLineQty, priorReturnedQty, requestReturnQty }) {
  const maxAllowed = originalLineQty - priorReturnedQty;
  if (requestReturnQty > maxAllowed + 0.0001) {
    return { valid: false, error: `Return quantity (${requestReturnQty}) exceeds remaining (${maxAllowed})` };
  }
  return { valid: true };
}

{
  const check1 = validateReturnQty({ originalLineQty: 5, priorReturnedQty: 2, requestReturnQty: 3 });
  assert.equal(check1.valid, true);

  const check2 = validateReturnQty({ originalLineQty: 5, priorReturnedQty: 2, requestReturnQty: 4 });
  assert.equal(check2.valid, false);
  console.log('✓ Test 6: Return quantity limits enforce max returnable threshold');
}

// Test 7: N5 Closed shift cash refund safety check
function validateClosedShiftCancellation({ isCashPaid, shiftStatus, hasOpenShift }) {
  if (isCashPaid && shiftStatus === 'closed' && !hasOpenShift) {
    return { valid: false, error: 'Cannot cancel closed-shift cash invoice without an open shift' };
  }
  return { valid: true };
}

{
  const check1 = validateClosedShiftCancellation({ isCashPaid: true, shiftStatus: 'closed', hasOpenShift: false });
  assert.equal(check1.valid, false);

  const check2 = validateClosedShiftCancellation({ isCashPaid: true, shiftStatus: 'closed', hasOpenShift: true });
  assert.equal(check2.valid, true);

  const check3 = validateClosedShiftCancellation({ isCashPaid: false, shiftStatus: 'closed', hasOpenShift: false });
  assert.equal(check3.valid, true); // Non-cash (credit/udhaar) does not disburse drawer cash
  console.log('✓ Test 7: N5 closed-shift cash cancellation requires active open shift');
}

console.log('\n========================================');
console.log('ALL PHASE 2 VALIDATION TESTS PASSED (7/7)');
console.log('========================================');
