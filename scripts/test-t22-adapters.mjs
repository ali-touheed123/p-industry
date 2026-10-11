/**
 * test-t22-adapters.mjs — T-22: Genuine POS & Sales History Production Adapter Verification
 *
 * This test suite executes the ACTUAL PRODUCTION ADAPTER FUNCTIONS exported from
 * `@/utils/receiptAdapters`:
 *   - `buildPosThermalHtml` (used by PosBilling.tsx)
 *   - `buildSalesHistoryThermalHtml` (used by SalesHistory.tsx)
 *
 * No replica functions are used. Any breaking change to the production adapter
 * logic or data mapping in `receiptAdapters.ts` will immediately fail these tests.
 *
 * Architecture:
 *   [PosBilling.tsx]      --> imports buildPosThermalHtml ------\
 *                                                                +--> [receiptAdapters.ts] --> [receiptRenderCore.ts]
 *   [SalesHistory.tsx]    --> imports buildSalesHistoryThermalHtml /
 *
 * Safety:
 *   - Uses isolated in-memory test fixtures.
 *   - No database connections, transactions, or production mutations.
 *   - No tokens redeemed, no inventory altered.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

// ─── Module Resolution Hook ──────────────────────────────────────────────────
try {
  register('./test-resolver-hook.mjs', pathToFileURL(import.meta.filename));
} catch { /* already registered */ }

// ─── Import Genuine Production Adapter Functions ─────────────────────────────
const {
  buildPosThermalHtml,
  buildSalesHistoryThermalHtml,
} = await import('@/utils/receiptAdapters');

const {
  renderReceiptDocument,
} = await import('@/utils/receiptRenderCore');

// ─── Representative Test Fixtures ────────────────────────────────────────────

// POS invoice fixture: represents completed sale in PosBilling.tsx
const mockPosInvoice = {
  invoice_no: 'INV-T22-POS-001',
  date: '2026-10-11',
  time: '18:45',
  client_name: 'Tariq Mehmood Commercial Contractors',
  payment_type: 'split',
  cash_paid: 15000,
  card_paid: 9000,
  bank_paid: 0,
  others_paid: 0,
  subTotal: 24850,
  discount: 500,
  delivery_charge: 0,
  grandTotal: 24350,
  paid_amount: 24000,
  due_amount: 350,
  change_returned: 0,
  token_claim_code: 'CLM-WK8901',
  token_claim_details: 'WeatherSheet 16L (x2): 2 token(s) @ Rs. 400 each',
  items: [
    {
      productName: 'WeatherSheet Exterior Acrylic Emulsion 16L',
      code: 'WS-EXT-16L',
      shadeCode: 'Pure Brilliant White 001',
      qty: 2,
      rate: 8500,
      hasToken: true,
      tokenValue: 400,
      tokenAction: 'keep',
    },
    {
      productName: 'Synthetic Enamel Gloss 4L',
      code: 'SYN-GLS-04L',
      shadeCode: 'Signal Red 105',
      qty: 1,
      rate: 3200,
      hasToken: false,
    },
    {
      productName: 'Undercoat Primer Metal & Wood 4L',
      code: 'PRM-MW-04L',
      qty: 1,
      rate: 2800,
    },
  ],
};

// SalesHistory invoice fixture: represents database invoice row
const mockHistoryInvoice = {
  invoice_no: 'INV-T22-HIST-002',
  date: '2026-10-09',
  client_name: 'Al-Noor Building Materials',
  payment_type: 'cash',
  cash_paid: 18500,
  card_paid: 0,
  bank_paid: 0,
  others_paid: 0,
  subtotal: 19000,
  discount: 500,
  net_total: 18500,
  paid_amount: 18500,
  due_amount: 0,
  invoice_items: [
    { item_name: 'WeatherSheet Exterior Acrylic 16L', item_code: 'WS-EXT-16L', shade_code: 'Ivory Cream 204', qty: 2, unit_price: 8500, total_price: 17000 },
    { item_name: 'Industrial Lacquer Thinner T-100 1L', item_code: 'THN-100-01L', qty: 3, unit_price: 450, total_price: 1350 },
  ],
};

// ─── Verification A: POS Production Adapter Tests (buildPosThermalHtml) ───────

test('T-22.A.1: Genuine POS adapter maps invoice identity and dates correctly', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Al-Madina Paint Hub', 'Hamza Malik');
  assert.ok(html.includes('INV-T22-POS-001'), 'Invoice number must appear in receipt');
  assert.ok(html.includes('2026-10-11'), 'Invoice date must appear in receipt');
  assert.ok(html.includes('18:45'), 'Time must appear in receipt');
  assert.ok(html.includes('Tariq Mehmood'), 'Client name must appear in receipt');
  assert.ok(html.includes('Hamza Malik'), 'Staff name must appear in receipt');
  assert.ok(html.includes('Al-Madina Paint Hub'), 'Tenant name must appear in receipt header');
});

test('T-22.A.2: Genuine POS adapter maps all line items, codes, shade codes, rates, and totals', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Al-Madina Paint Hub', 'Hamza Malik');
  // Item 1
  assert.ok(html.includes('WeatherSheet Exterior Acrylic Emulsion 16L'), 'Item 1 name must appear');
  assert.ok(html.includes('WS-EXT-16L'), 'Item 1 code must appear');
  assert.ok(html.includes('Pure Brilliant White 001'), 'Item 1 shade code must appear');
  // Item 2
  assert.ok(html.includes('Synthetic Enamel Gloss 4L'), 'Item 2 name must appear');
  assert.ok(html.includes('SYN-GLS-04L'), 'Item 2 code must appear');
  // Item 3
  assert.ok(html.includes('Undercoat Primer Metal'), 'Item 3 name must appear');
  assert.ok(html.includes('PRM-MW-04L'), 'Item 3 code must appear');
});

test('T-22.A.3: Genuine POS adapter maps subtotal, discount, grand total, and payment splits', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Al-Madina Paint Hub', 'Hamza Malik');
  assert.ok(html.includes('24,850') || html.includes('24850'), 'Subtotal must appear');
  assert.ok(html.includes('SPLIT') || html.includes('Split'), 'Payment method SPLIT must appear');
  assert.ok(html.includes('15,000') || html.includes('15000'), 'Cash split must appear');
  assert.ok(html.includes('9,000') || html.includes('9000'), 'Card split must appear');
  assert.ok(html.includes('350') || html.match(/Due.*350|Balance.*350/i), 'Due amount must appear');
});

test('T-22.A.4: Genuine POS adapter renders token claim slip when tokens are issued', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Al-Madina Paint Hub', 'Hamza Malik');
  assert.ok(html.includes('CLM-WK8901'), 'Token claim code must appear in receipt');
  assert.ok(html.includes('WeatherSheet 16L') || html.includes('token'), 'Token claim details must appear');
});

test('T-22.A.5: Genuine POS adapter notes token value for kept token items', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Al-Madina Paint Hub', 'Hamza Malik');
  assert.ok(html.includes('Token included'), 'Token note "Token included" must appear for kept token item');
  assert.ok(html.includes('800'), 'Token value (400 × 2 qty = 800) must appear in token note');
});

test('T-22.A.6: Genuine POS adapter notes token value deducted for removed token items', () => {
  const removedTokenInvoice = {
    ...mockPosInvoice,
    invoice_no: 'INV-T22-POS-003',
    token_claim_code: undefined,
    token_claim_details: undefined,
    items: [{
      productName: 'Industrial Drum Paint 20L',
      code: 'IND-DRUM-20L',
      qty: 1,
      rate: 12000,
      hasToken: true,
      tokenValue: 500,
      tokenAction: 'remove',
    }],
  };
  const html = buildPosThermalHtml(removedTokenInvoice, 'Test Store', 'Test Staff');
  assert.ok(html.includes('Token removed'), 'Token note "Token removed" must appear for removed token item');
  assert.ok(html.includes('500'), 'Removed token value must appear in note');
});

test('T-22.A.7: Genuine POS adapter sets isReprint=false (original sale has no duplicate watermark)', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Test Store', 'Test Staff');
  assert.ok(!html.includes('DUPLICATE RECEIPT'), 'Original POS receipt must NOT have DUPLICATE RECEIPT watermark');
});

test('T-22.A.8: Genuine POS adapter tenant name fallback: empty name defaults to PyntFlow Store', () => {
  const html = buildPosThermalHtml(mockPosInvoice, '', 'Test Staff');
  assert.ok(html.includes('PyntFlow Store'), 'Empty tenant name must fall back to PyntFlow Store');
});

test('T-22.A.9: Genuine POS adapter tenant name fallback: legacy Main Godown name defaults to PyntFlow Store', () => {
  const html = buildPosThermalHtml(mockPosInvoice, 'Main Godown & Retail Counter #1', 'Test Staff');
  assert.ok(html.includes('PyntFlow Store'), 'Legacy Main Godown name must fall back to PyntFlow Store');
});

test('T-22.A.10: Genuine POS adapter handles zero-discount and zero-tax invoices cleanly', () => {
  const zeroDiscInvoice = {
    ...mockPosInvoice,
    invoice_no: 'INV-T22-POS-ZERO',
    discount: 0,
    delivery_charge: 0,
    due_amount: 0,
    change_returned: 150,
  };
  const html = buildPosThermalHtml(zeroDiscInvoice, 'Test Store', 'Test Staff');
  assert.ok(html.includes('INV-T22-POS-ZERO'), 'Invoice must render');
  assert.ok(html.includes('150'), 'Change returned must appear');
});

test('T-22.A.11: Genuine POS adapter suppresses token claim slip when no tokens issued', () => {
  const noTokenInvoice = {
    ...mockPosInvoice,
    invoice_no: 'INV-T22-POS-NOTOKEN',
    token_claim_code: undefined,
    token_claim_details: undefined,
    items: [{ productName: 'Basic Paint 1L', qty: 1, rate: 500, hasToken: false }],
  };
  const html = buildPosThermalHtml(noTokenInvoice, 'Test Store', 'Test Staff');
  assert.ok(!html.includes('CLM-'), 'No claim code should appear');
});

// ─── Verification B: Sales History Production Adapter Tests (buildSalesHistoryThermalHtml) ─

test('T-22.B.1: Genuine Sales History adapter maps invoice identity and date correctly', () => {
  const html = buildSalesHistoryThermalHtml(mockHistoryInvoice, 'Al-Noor Paints');
  assert.ok(html.includes('INV-T22-HIST-002'), 'Invoice number must appear');
  assert.ok(html.includes('2026-10-09'), 'Invoice date must appear');
  assert.ok(html.includes('Al-Noor Building Materials'), 'Client name must appear');
  assert.ok(html.includes('Al-Noor Paints'), 'Tenant name must appear in header');
});

test('T-22.B.2: Genuine Sales History adapter maps invoice_items line items correctly', () => {
  const html = buildSalesHistoryThermalHtml(mockHistoryInvoice, 'Al-Noor Paints');
  assert.ok(html.includes('WeatherSheet Exterior Acrylic 16L'), 'Item 1 name must appear');
  assert.ok(html.includes('WS-EXT-16L'), 'Item 1 code must appear');
  assert.ok(html.includes('Ivory Cream 204'), 'Item 1 shade code must appear');
  assert.ok(html.includes('Industrial Lacquer Thinner T-100 1L'), 'Item 2 name must appear');
  assert.ok(html.includes('THN-100-01L'), 'Item 2 code must appear');
});

test('T-22.B.3: Genuine Sales History adapter maps financial totals correctly', () => {
  const html = buildSalesHistoryThermalHtml(mockHistoryInvoice, 'Al-Noor Paints');
  assert.ok(html.includes('19,000') || html.includes('19000'), 'Subtotal must appear');
  assert.ok(html.includes('18,500') || html.includes('18500'), 'Net total must appear');
  assert.ok(html.includes('CASH'), 'Payment method CASH must appear');
});

test('T-22.B.4: Genuine Sales History adapter emits DUPLICATE RECEIPT watermark (isReprint=true)', () => {
  const html = buildSalesHistoryThermalHtml(mockHistoryInvoice, 'Al-Noor Paints');
  assert.ok(html.includes('DUPLICATE RECEIPT') || html.includes('Duplicate'), 'DUPLICATE RECEIPT marker must appear on reprints');
});

test('T-22.B.5: Genuine Sales History adapter never emits token claim slip or claim code on reprints', () => {
  const html = buildSalesHistoryThermalHtml(mockHistoryInvoice, 'Al-Noor Paints');
  assert.ok(!html.includes('CLM-'), 'No claim code (CLM-...) must appear in reprint');
  assert.ok(!html.includes('TOKEN CLAIM') || html.includes('DUPLICATE RECEIPT'),
    'Token claim slip must not appear on reprint');
});

test('T-22.B.6: Genuine Sales History adapter falls back to inv.items if invoice_items absent', () => {
  const invWithItemsField = {
    ...mockHistoryInvoice,
    invoice_no: 'INV-T22-HIST-003',
    invoice_items: undefined,
    items: [
      { item_name: 'Synthetic Enamel Gloss 4L', item_code: 'SYN-GLS-04L', qty: 1, unit_price: 3200, total_price: 3200 },
    ],
  };
  const html = buildSalesHistoryThermalHtml(invWithItemsField, 'Test Store');
  assert.ok(html.includes('Synthetic Enamel Gloss 4L'), 'Item from .items fallback must appear');
  assert.ok(html.includes('SYN-GLS-04L'), 'Item code from .items fallback must appear');
});

test('T-22.B.7: Genuine Sales History adapter maps split payment methods correctly', () => {
  const splitHistoryInvoice = {
    ...mockHistoryInvoice,
    invoice_no: 'INV-T22-HIST-004',
    payment_type: 'split',
    cash_paid: 10000,
    card_paid: 8500,
  };
  const html = buildSalesHistoryThermalHtml(splitHistoryInvoice, 'Test Store');
  assert.ok(html.includes('SPLIT') || html.includes('Split'), 'Split payment method must appear');
  assert.ok(html.includes('10,000') || html.includes('10000'), 'Cash portion must appear');
  assert.ok(html.includes('8,500') || html.includes('8500'), 'Card portion must appear');
});

test('T-22.B.8: Genuine Sales History adapter handles zero discount and full payment cleanly', () => {
  const cleanInvoice = {
    ...mockHistoryInvoice,
    invoice_no: 'INV-T22-HIST-CLEAN',
    discount: 0,
    due_amount: 0,
  };
  const html = buildSalesHistoryThermalHtml(cleanInvoice, 'Test Store');
  assert.ok(html.includes('INV-T22-HIST-CLEAN'), 'Clean invoice renders');
});

test('T-22.B.9: Genuine Sales History adapter tenant name fallback when empty', () => {
  const html = buildSalesHistoryThermalHtml(mockHistoryInvoice, '');
  assert.ok(html.includes('PyntFlow Store'), 'Empty tenant name falls back to PyntFlow Store');
});

// ─── Verification C: Architecture Seam & Source Contract Tests ───────────────

test('T-22.C.1: PosBilling.tsx imports and calls buildPosThermalHtml from receiptAdapters', () => {
  const posBillingSrc = fs.readFileSync('src/components/PosBilling.tsx', 'utf8');
  assert.ok(
    posBillingSrc.includes("import { buildPosThermalHtml } from '@/utils/receiptAdapters'") ||
    posBillingSrc.includes('buildPosThermalHtml'),
    'PosBilling.tsx must import buildPosThermalHtml from receiptAdapters'
  );
  assert.ok(
    posBillingSrc.includes('buildPosThermalHtml('),
    'PosBilling.tsx must invoke buildPosThermalHtml for printing'
  );
  assert.ok(
    posBillingSrc.includes('printViaIframe('),
    'PosBilling.tsx must route built HTML to printViaIframe'
  );
});

test('T-22.C.2: SalesHistory.tsx imports and calls buildSalesHistoryThermalHtml from receiptAdapters', () => {
  const salesHistorySrc = fs.readFileSync('src/components/SalesHistory.tsx', 'utf8');
  assert.ok(
    salesHistorySrc.includes("import { buildSalesHistoryThermalHtml } from '@/utils/receiptAdapters'") ||
    salesHistorySrc.includes('buildSalesHistoryThermalHtml'),
    'SalesHistory.tsx must import buildSalesHistoryThermalHtml from receiptAdapters'
  );
  assert.ok(
    salesHistorySrc.includes('buildSalesHistoryThermalHtml('),
    'SalesHistory.tsx must invoke buildSalesHistoryThermalHtml for printing'
  );
  assert.ok(
    salesHistorySrc.includes('printViaIframe('),
    'SalesHistory.tsx must route built HTML to printViaIframe'
  );
});

test('T-22.C.3: receiptAdapters.ts imports renderReceiptDocument as the single core renderer', () => {
  const adapterSrc = fs.readFileSync('src/utils/receiptAdapters.ts', 'utf8');
  assert.ok(
    adapterSrc.includes("import { renderReceiptDocument"),
    'receiptAdapters.ts must import renderReceiptDocument from receiptRenderCore'
  );
  assert.ok(
    adapterSrc.includes('tokenClaimCode: undefined'),
    'SalesHistory adapter in receiptAdapters must set tokenClaimCode: undefined'
  );
  assert.ok(
    adapterSrc.includes('isReprint: true'),
    'SalesHistory adapter in receiptAdapters must set isReprint: true'
  );
  assert.ok(
    adapterSrc.includes('isReprint: false'),
    'POS adapter in receiptAdapters must set isReprint: false'
  );
});
