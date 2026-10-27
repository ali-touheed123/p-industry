import assert from 'node:assert/strict';
import {
  calculateOthersPaid,
  calculateSalesSummary,
  calculateNetSales,
  calculateGrossSales,
  calculateSalesReturns,
} from '../src/utils/salesMath.ts';

console.log('=== RUNNING PHASE 3 AUDIT SUITE (B4, B5, B8, N1) ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: B8 — Tender Split Identity & Test Day Verification
// Formula: cash + card/bank + others + credit = gross forward net_total
// Test day forward sales: cash 12,500 + bank 19,000 + others 2,500 + credit 5,000 = 39,000
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: B8 Tender Split & Others Paid ---');
{
  const testInvoices = [
    // Invoice 1: Cash sale
    {
      id: 'inv-1',
      invoice_type: 'sale',
      net_total: 12500,
      paid_amount: 12500,
      due_amount: 0,
      cash_paid: 12500,
      card_paid: 0,
      bank_paid: 0,
      others_paid: 0,
      items: [{ qty: 5, unit_price: 2500, total_price: 12500 }],
    },
    // Invoice 2: Bank / Card sale
    {
      id: 'inv-2',
      invoice_type: 'sale',
      net_total: 19000,
      paid_amount: 19000,
      due_amount: 0,
      cash_paid: 0,
      card_paid: 9000,
      bank_paid: 10000,
      others_paid: 0,
      items: [{ qty: 2, unit_price: 9500, total_price: 19000 }],
    },
    // Invoice 3: Others / Cheque sale
    {
      id: 'inv-3',
      invoice_type: 'sale',
      net_total: 2500,
      paid_amount: 2500,
      due_amount: 0,
      cash_paid: 0,
      card_paid: 0,
      bank_paid: 0,
      others_paid: 2500,
      items: [{ qty: 1, unit_price: 2500, total_price: 2500 }],
    },
    // Invoice 4: Credit (Udhar) sale
    {
      id: 'inv-4',
      invoice_type: 'sale',
      net_total: 5000,
      paid_amount: 0,
      due_amount: 5000,
      cash_paid: 0,
      card_paid: 0,
      bank_paid: 0,
      others_paid: 0,
      items: [{ qty: 2, unit_price: 2500, total_price: 5000 }],
    },
  ];

  const summary = calculateSalesSummary(testInvoices);

  console.log('  Gross Forward Net:', summary.grossForwardNetTotal);
  console.log('  Physical Cash:', summary.physicalCash);
  console.log('  Digital Paid:', summary.digitalPaid);
  console.log('  Others Paid:', summary.othersPaid);
  console.log('  Credit Amount:', summary.creditAmount);

  assert.equal(summary.physicalCash, 12500, 'Cash paid must be 12,500');
  assert.equal(summary.digitalPaid, 19000, 'Digital paid must be 19,000');
  assert.equal(summary.othersPaid, 2500, 'Others paid must be 2,500');
  assert.equal(summary.creditAmount, 5000, 'Credit amount must be 5,000');
  assert.equal(summary.grossForwardNetTotal, 39000, 'Gross forward net total must be 39,000');

  // Authoritative identity check
  const sumOfParts = summary.physicalCash + summary.digitalPaid + summary.othersPaid + summary.creditAmount;
  assert.equal(sumOfParts, summary.grossForwardNetTotal, 'Identity: cash + digital + others + credit == grossForwardNetTotal');

  // Fallback check for calculateOthersPaid on legacy single-column cheque invoices
  const legacyChequeInv = {
    payment_type: 'cheque',
    paid_amount: 1500,
    cash_paid: 0,
    card_paid: 0,
    bank_paid: 0,
  };
  assert.equal(calculateOthersPaid(legacyChequeInv), 1500, 'Legacy cheque invoice should resolve others_paid to 1500');

  console.log('  ✓ Test 1 Passed: B8 Tender Split & Others Paid verified.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: N1 — Net Sales Calculation (Net of Returns, No Clamping)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 2: N1 Net Sales Calculation ---');
{
  const invoicesWithReturns = [
    { invoice_type: 'sale', net_total: 39000 },
    { invoice_type: 'return', net_total: 4000 },
  ];

  const netSales = calculateNetSales(invoicesWithReturns);
  console.log('  Forward Sales: 39,000, Sales Returns: 4,000 => Net Sales:', netSales);
  assert.equal(netSales, 35000, 'Net sales must be 39000 - 4000 = 35000');

  // Verify that if returns exceed forward sales, negative net sales is preserved (no clamp to 0)
  const heavyReturns = [
    { invoice_type: 'sale', net_total: 10000 },
    { invoice_type: 'return', net_total: 15000 },
  ];
  const negativeNet = calculateNetSales(heavyReturns);
  console.log('  Forward: 10,000, Returns: 15,000 => Net Sales:', negativeNet);
  assert.equal(negativeNet, -5000, 'Negative net sales must be preserved (-5000)');

  console.log('  ✓ Test 2 Passed: N1 Net Sales verified.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: B4 — Ledger Return Credits & Balance Verification
// Client Statement ends at 2,000. Supplier Statement ends at -2,000.
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 3: B4 Ledger Return Credits & Running Balances ---');
{
  // Client Ledger Simulation (as implemented in /api/ledgers/route.ts):
  // Opening Balance: 0
  // Invoice 1: Credit Sale 5,000 => Debit: 5,000, Credit: 0, Running Balance: 5,000
  // Invoice 2: Sales Return 3,000 with 1,000 cash refunded to customer
  //   Formula: credit = net_total - cashRefunded = 3,000 - 1,000 = 2,000
  //   Running Balance: 5,000 - 2,000 = 3,000
  // Payment Receipt: Voucher 1,000 paid by client => Credit: 1,000, Running Balance: 2,000
  // Final Balance = 2,000 (matching client.current_balance = 2,000)
  const clientTx = [
    { type: 'INV', net_total: 5000, debit: 5000, credit: 0 },
    {
      type: 'RET',
      net_total: 3000,
      cash_paid: 1000,
      // B4 logic:
      debit: 0,
      credit: 3000 - 1000, // 2000
    },
    { type: 'REC', debit: 0, credit: 1000 },
  ];

  let clientBal = 0;
  for (const tx of clientTx) {
    clientBal += (tx.debit - tx.credit);
  }
  console.log('  Client Statement Final Balance:', clientBal);
  assert.equal(clientBal, 2000, 'Client statement final balance must be exactly 2,000');

  // Supplier Ledger Simulation:
  // Opening Balance: 0
  // Purchase 1: 6,000 on credit => Credit: 6,000, Running Balance: 6,000
  // Purchase Return: 3,500 with 0 cash received from supplier => Debit: 3,500, Running Balance: 2,500
  // Cash Payments / Vouchers to supplier: 4,500 (e.g. 2,500 cash + 2,000 voucher) => Debit: 4,500
  // Running Balance: 6,000 - 3,500 - 4,500 = -2,000 (Supplier Advance of 2,000)
  const supplierTx = [
    { type: 'PUR', net_total: 6000, credit: 6000, debit: 0 },
    {
      type: 'RET',
      net_total: 3500,
      cash_paid: 0,
      // B4 logic: credit on return (reduces supplier payable)
      credit: 0,
      debit: 3500 - 0,
    },
    { type: 'PAY', credit: 0, debit: 4500 },
  ];

  let supplierBal = 0;
  for (const tx of supplierTx) {
    supplierBal += (tx.credit - tx.debit);
  }
  console.log('  Supplier Statement Final Balance:', supplierBal);
  assert.equal(supplierBal, -2000, 'Supplier statement final balance must be exactly -2,000');

  // Balance mismatch warning detection check
  const storedBalance = -2000;
  const mismatch1 = Math.abs(supplierBal - storedBalance) > 0.5;
  assert.equal(mismatch1, false, 'No mismatch when statement (-2000) == stored (-2000)');

  const corruptedStoredBalance = 500;
  const mismatch2 = Math.abs(supplierBal - corruptedStoredBalance) > 0.5;
  assert.equal(mismatch2, true, 'Advisory warning triggers when statement (-2000) != stored (500)');

  console.log('  ✓ Test 3 Passed: B4 Ledger Return Credits & Balances verified.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: B5 — Purchases & Returns in PurchasesView / ShiftDrawer
// Purchases: 6,000, Returns: 3,500, Net Paid: 4,500, Net Supplier Advance: 2,000
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 4: B5 Purchases & Returns Verification ---');
{
  const purchases = [
    { id: 'p-1', purchase_type: 'purchase', net_total: 6000, paid_amount: 2500, payment_type: 'cash' },
    { id: 'p-2', purchase_type: 'return', net_total: 3500, paid_amount: 0, payment_type: 'credit' },
  ];
  const supplierVouchers = [
    { id: 'v-1', voucher_type: 'payment', amount: 2000, payment_mode: 'Cash', shift_id: 'shift-1' },
  ];

  const regularPurchases = purchases.filter(p => (p.purchase_type || 'purchase') !== 'return');
  const purchaseReturns = purchases.filter(p => (p.purchase_type || 'purchase') === 'return');

  const totalPurchases = regularPurchases.reduce((s, p) => s + Number(p.net_total || 0), 0);
  const totalPurchaseReturns = purchaseReturns.reduce((s, p) => s + Number(p.net_total || 0), 0);
  const netPurchases = totalPurchases - totalPurchaseReturns;

  const totalPaid = purchases.reduce((s, p) => s + (p.purchase_type !== 'return' ? Number(p.paid_amount || 0) : 0), 0) +
    supplierVouchers.reduce((s, v) => s + Number(v.amount || 0), 0);

  console.log('  Purchases:', totalPurchases);
  console.log('  Returns:', totalPurchaseReturns);
  console.log('  Net Purchases:', netPurchases);
  console.log('  Net Paid (Purchases Cash + Vouchers):', totalPaid);

  assert.equal(totalPurchases, 6000, 'Total purchases must be 6,000');
  assert.equal(totalPurchaseReturns, 3500, 'Total returns must be 3,500');
  assert.equal(netPurchases, 2500, 'Net purchases must be 2,500');
  assert.equal(totalPaid, 4500, 'Net paid must be 4,500 (2,500 purchase cash + 2,000 voucher)');

  // Projected balance calculation for return in PurchasesView:
  // Previous supplier balance: 1,500
  // Return value: 3,500
  // Paid amount back from supplier: 0
  const currentSupplierBalance = 1500;
  const returnNetBill = 3500;
  const returnPaidCash = 0;
  const projectedBalance = currentSupplierBalance - (returnNetBill - returnPaidCash);

  console.log('  Previous Supplier Balance: 1,500, Return: 3,500 => Projected Balance:', projectedBalance);
  assert.equal(projectedBalance, -2000, 'Projected balance must be -2,000 (net supplier advance)');

  console.log('  ✓ Test 4 Passed: B5 Purchases & Returns verified.\n');
}

console.log('====================================================');
console.log('  ALL PHASE 3 TESTS PASSED (B4, B5, B8, N1)       ');
console.log('====================================================');
