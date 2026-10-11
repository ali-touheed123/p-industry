import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderReceiptDocument,
  renderReceiptBodyHtml,
  normalizeTemplate,
} from '@/utils/receiptRenderCore';
import { DEFAULT_TEMPLATE_JSON } from '@/types/receipt';

// Sample baseline invoice data
const baseInvoiceData = {
  tenantName: 'Al-Madina Color Center',
  invoiceNo: 'INV-2026-9001',
  date: '2026-10-11',
  time: '14:30',
  clientName: 'Rashid & Sons Painters',
  staffName: 'Bilal Ahmed',
  paymentMethod: 'CASH',
  items: [
    {
      name: 'Super Gloss Enamel 4L',
      code: 'SGE-04',
      shadeCode: 'Snow White 101',
      qty: 2,
      rate: 3450,
      total: 6900,
    },
    {
      name: 'Paint Thinner T-100',
      code: 'THN-01',
      qty: 1,
      rate: 450,
      total: 450,
    },
  ],
  subTotal: 7350,
  discount: 150,
  deliveryCharge: 0,
  grandTotal: 7200,
  paidAmount: 7200,
  dueAmount: 0,
  changeReturned: 0,
  isReprint: false,
};

// ─── Scenario 1: Ordinary Invoice Without Claim Code ─────────────────────────

test('Scenario 1: Ordinary invoice without claim code does not render token claim slip', () => {
  const html = renderReceiptDocument(baseInvoiceData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(html.includes('Al-Madina Color Center'));
  assert.ok(html.includes('INV-2026-9001'));
  assert.ok(html.includes('Super Gloss Enamel 4L'));
  assert.ok(html.includes('7,200')); // grand total
  // Must NOT contain token claim slip
  assert.ok(!html.includes('Token Claim Slip'));
  assert.ok(!html.includes('Present this code'));
  assert.ok(!html.includes('Keep this receipt — code cannot be reissued'));
});

// ─── Scenario 2: POS Receipt With Claim Code & Slip Enabled ──────────────────

test('Scenario 2: POS receipt with genuine claim code and slip enabled renders slip', () => {
  const dataWithToken = {
    ...baseInvoiceData,
    tokenClaimCode: 'CLM-WK8901',
    tokenClaimDetails: 'Super Gloss Enamel 4L (x2) - Rs. 400 token value',
  };

  const html = renderReceiptDocument(dataWithToken, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(html.includes('Token Claim Slip'));
  assert.ok(html.includes('Present this code on your next visit to redeem your token'));
  assert.ok(html.includes('CLM-WK8901'));
  assert.ok(html.includes('Super Gloss Enamel 4L (x2) - Rs. 400 token value'));
  assert.ok(html.includes('Keep this receipt — code cannot be reissued'));
});

// ─── Scenario 3: Receipt With Claim Code But Slip Disabled ───────────────────

test('Scenario 3: Receipt with claim code but tokenClaimSlip.enabled=false suppresses slip', () => {
  const disabledTemplate = {
    ...DEFAULT_TEMPLATE_JSON,
    tokenClaimSlip: {
      ...DEFAULT_TEMPLATE_JSON.tokenClaimSlip,
      enabled: false,
    },
  };

  const dataWithToken = {
    ...baseInvoiceData,
    tokenClaimCode: 'CLM-SUPPRESS',
    tokenClaimDetails: 'Token items present',
  };

  const html = renderReceiptDocument(dataWithToken, disabledTemplate, 'thermal_80');

  assert.ok(!html.includes('CLM-SUPPRESS'));
  assert.ok(!html.includes('Token Claim Slip'));
  assert.ok(!html.includes('Present this code'));
});

// ─── Scenario 4: Legacy Template Lacking tokenClaimSlip ──────────────────────

test('Scenario 4: Legacy template without tokenClaimSlip section renders safely and preserves claim code logic', () => {
  const legacyTemplate = {
    header: { showShopName: true, customShopName: 'Old Paint Store' },
    layout: { fontFamily: 'sans' },
  };

  // 4a. With claim code: prints using safe defaults
  const dataWithCode = {
    ...baseInvoiceData,
    tokenClaimCode: 'CLM-LEGACY',
  };
  const htmlWithCode = renderReceiptDocument(dataWithCode, legacyTemplate, 'thermal_80');
  assert.ok(htmlWithCode.includes('Old Paint Store'));
  assert.ok(htmlWithCode.includes('CLM-LEGACY'));
  assert.ok(htmlWithCode.includes('Token Claim Slip'));

  // 4b. Without claim code: does NOT print claim slip
  const htmlWithoutCode = renderReceiptDocument(baseInvoiceData, legacyTemplate, 'thermal_80');
  assert.ok(htmlWithoutCode.includes('Old Paint Store'));
  assert.ok(!htmlWithoutCode.includes('Token Claim Slip'));
  assert.ok(!htmlWithoutCode.includes('CLM-LEGACY'));
});

// ─── Scenario 5: Sales History Duplicate Reprint ─────────────────────────────

test('Scenario 5: Sales History reprint never fabricates a claim code and marks duplicate', () => {
  const reprintData = {
    ...baseInvoiceData,
    isReprint: true,
    tokenClaimCode: undefined, // Historical invoices never possess ephemeral claim codes
    tokenClaimDetails: undefined,
  };

  const html = renderReceiptDocument(reprintData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(html.includes('DUPLICATE RECEIPT'));
  assert.ok(html.includes('INV-2026-9001'));
  assert.ok(html.includes('7,200'));
  // Never fabricates claim code
  assert.ok(!html.includes('CLM-'));
  assert.ok(!html.includes('Token Claim Slip'));
});

// ─── Scenario 6: Thermal vs Cut-Sheet Output ─────────────────────────────────

test('Scenario 6: Correct CSS and layout applied for thermal (80/58mm) and cut-sheet (A4/A5)', () => {
  const thermal80Html = renderReceiptDocument(baseInvoiceData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(thermal80Html.includes('@page { size: 80mm 297mm; margin: 0; }'));
  assert.ok(thermal80Html.includes('width: 80mm;'));

  const thermal58Html = renderReceiptDocument(baseInvoiceData, DEFAULT_TEMPLATE_JSON, 'thermal_58');
  assert.ok(thermal58Html.includes('@page { size: 58mm 297mm; margin: 0; }'));
  assert.ok(thermal58Html.includes('width: 58mm;'));

  const a4Html = renderReceiptDocument(baseInvoiceData, DEFAULT_TEMPLATE_JSON, 'a4');
  assert.ok(a4Html.includes('@page { size: A4 portrait; margin: 0; }'));
  assert.ok(a4Html.includes('width: 210mm;'));

  const a5Html = renderReceiptDocument(baseInvoiceData, DEFAULT_TEMPLATE_JSON, 'a5');
  assert.ok(a5Html.includes('@page { size: A5 portrait; margin: 0; }'));
  assert.ok(a5Html.includes('width: 148mm;'));
});

// ─── Scenario 7: Escaping Untrusted Receipt Text ──────────────────────────────

test('Scenario 7: Untrusted receipt text with XSS characters is strictly escaped', () => {
  const dangerousData = {
    ...baseInvoiceData,
    clientName: '<script>alert("hacked")</script>',
    staffName: 'Ali "The Cashier" & Partner',
    items: [
      {
        name: 'Paint <Special> & Finish "Gloss"',
        code: 'PNT<01>',
        shadeCode: "Red's Shade",
        qty: 1,
        rate: 1000,
        total: 1000,
        tokenNote: '<div onload="evil()">Token Note</div>',
      },
    ],
  };

  const html = renderReceiptDocument(dangerousData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('Ali &quot;The Cashier&quot; &amp; Partner'));
  assert.ok(html.includes('Paint &lt;Special&gt; &amp; Finish &quot;Gloss&quot;'));
  assert.ok(html.includes('PNT&lt;01&gt;'));
  assert.ok(html.includes('Red&#39;s Shade'));
  assert.ok(!html.includes('<div onload="evil()">'));
});

// ─── Scenario 8: Financial Values & Payment Splits Preservation ──────────────

test('Scenario 8: Exact financial values and payment splits match without recalculation', () => {
  const financialData = {
    ...baseInvoiceData,
    subTotal: 12500,
    discount: 500,
    deliveryCharge: 200,
    grandTotal: 12200,
    paidAmount: 12200,
    dueAmount: 0,
    changeReturned: 300,
    paymentSplits: {
      cash: 5200,
      card: 5000,
      bank: 2000,
      others: 0,
    },
  };

  const html = renderReceiptDocument(financialData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(html.includes('12,500')); // Subtotal
  assert.ok(html.includes('- Rs. 500')); // Discount
  assert.ok(html.includes('+ Rs. 200')); // Delivery
  assert.ok(html.includes('12,200')); // Grand total
  assert.ok(html.includes('&bull; Cash:</span><span>Rs. 5,200'));
  assert.ok(html.includes('&bull; Card:</span><span>Rs. 5,000'));
  assert.ok(html.includes('&bull; Bank:</span><span>Rs. 2,000'));
  assert.ok(html.includes('Change Returned:'));
  assert.ok(html.includes('Rs. 300'));
});
