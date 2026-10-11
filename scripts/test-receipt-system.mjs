import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// ─── Module Resolution Hook Setup ───────────────────────────────────────────
// Enables seamless resolution of '@/...' and TypeScript files under Node 25
try {
  register('./test-resolver-hook.mjs', pathToFileURL(import.meta.filename));
} catch {
  // Ignored if loader was already registered via CLI flag
}

const {
  escapeHtml,
  validateImageUrl,
  getFontStack,
  getSeparatorCss,
  buildReceiptPageCss,
  normalizeTemplate,
  renderReceiptBodyHtml,
  renderReceiptDocument,
  renderReceiptHtmlDocument,
  FONT_STACK_MAP,
  VALID_PAPER_SIZES,
  VALID_COLUMN_IDS,
} = await import('@/utils/receiptRenderCore');

const { DEFAULT_TEMPLATE_JSON } = await import('@/types/receipt');

// ─── Standard Mock Data for Integration Suites ──────────────────────────────
const standardInvoiceData = {
  tenantName: 'Al-Madina Color Center & Paint Supply',
  invoiceNo: 'INV-2026-8801',
  date: '2026-10-11',
  time: '15:45',
  clientName: 'Tariq Mehmood Contractors',
  staffName: 'Hamza Malik',
  paymentMethod: 'CASH',
  items: [
    {
      name: 'WeatherSheet Exterior Acrylic 16L',
      code: 'WS-16L',
      shadeCode: 'Ivory Cream 204',
      qty: 3,
      rate: 8500,
      total: 25500,
      tokenNote: 'Token included — Rs. 600 token value',
    },
    {
      name: 'Nippon Synthetic Enamel 4L',
      code: 'NSE-04',
      shadeCode: 'Deep Ocean Blue',
      qty: 2,
      rate: 3200,
      total: 6400,
    },
  ],
  subTotal: 31900,
  discount: 900,
  deliveryCharge: 250,
  grandTotal: 31250,
  paidAmount: 31250,
  dueAmount: 0,
  changeReturned: 0,
  isReprint: false,
};

// =============================================================================
// T-10: Template Normalization & Legacy Compatibility Suite
// =============================================================================

test('T-10.1: normalizeTemplate returns complete valid defaults for null or undefined', () => {
  const normNull = normalizeTemplate(null);
  assert.equal(normNull.paper_size, 'thermal_80');
  assert.equal(normNull.template_json.header.showLogo, true);
  assert.equal(normNull.template_json.header.showShopName, true);
  assert.equal(normNull.template_json.header.align, 'center');
  assert.equal(normNull.template_json.invoiceInfo.showInvoiceNo, true);
  assert.equal(normNull.template_json.invoiceInfo.invoiceLabel, 'Invoice #');
  assert.equal(normNull.template_json.itemsTable.fontSize, 12);
  assert.equal(normNull.template_json.totals.boldTotal, true);
  assert.equal(normNull.template_json.totals.currencySymbol, 'Rs.');
  assert.equal(normNull.template_json.layout.fontFamily, 'mono');
  assert.equal(normNull.template_json.tokenClaimSlip.enabled, true);
  assert.equal(normNull.template_json.tokenClaimSlip.title, 'Token Claim Slip');

  const normUndefined = normalizeTemplate(undefined);
  assert.equal(normUndefined.paper_size, 'thermal_80');
  assert.equal(normUndefined.template_json.tokenClaimSlip.enabled, true);
  assert.equal(normUndefined.template_json.layout.fontFamily, 'mono');
});

test('T-10.2: normalizeTemplate({}) fills in all sections and safe defaults', () => {
  const res = normalizeTemplate({});
  assert.equal(res.paper_size, 'thermal_80');
  assert.ok(res.template_json.header);
  assert.ok(res.template_json.invoiceInfo);
  assert.ok(res.template_json.itemsTable);
  assert.ok(res.template_json.totals);
  assert.ok(res.template_json.footer);
  assert.ok(res.template_json.layout);
  assert.ok(res.template_json.tokenClaimSlip);
  assert.deepEqual(res.template_json.locks, {});

  // Check critical defaults
  assert.equal(res.template_json.header.showShopName, true);
  assert.equal(res.template_json.header.align, 'center');
  assert.equal(res.template_json.itemsTable.fontSize, 12);
  assert.equal(res.template_json.totals.boldTotal, true);
  assert.equal(res.template_json.layout.fontFamily, 'mono');
  assert.equal(res.template_json.tokenClaimSlip.enabled, true);
});

test('T-10.3: Legacy template without tokenClaimSlip receives enabled: true and safe default texts', () => {
  const legacyTemplate = {
    header: {
      showShopName: true,
      customShopName: 'Old Legacy Paints',
    },
    layout: {
      fontFamily: 'sans',
    },
  };

  const res = normalizeTemplate(legacyTemplate);
  assert.ok(res.template_json.tokenClaimSlip);
  assert.equal(res.template_json.tokenClaimSlip.enabled, true);
  assert.equal(res.template_json.tokenClaimSlip.title, 'Token Claim Slip');
  assert.equal(res.template_json.tokenClaimSlip.instructions, 'Present this code on your next visit to redeem your token');
  assert.equal(res.template_json.tokenClaimSlip.footerNotice, 'Keep this receipt — code cannot be reissued');
  assert.equal(res.template_json.tokenClaimSlip.showDetails, true);
});

test('T-10.4: Out-of-bounds numeric values are clamped to defined safe limits', () => {
  const unconstrained = {
    header: { logoSize: 9999 }, // limit 16..200
    itemsTable: { fontSize: -5, rowPadding: 100 }, // limit 8..20, 0..20
    totals: { gstRate: -10 }, // limit 0..100
    layout: {
      marginTop: 250, // limit 0..50
      marginBottom: -20, // limit 0..50
      marginLeft: 999, // limit 0..50
      marginRight: -1, // limit 0..50
      fontSize: 99, // limit 8..24
      scale: 15.0, // limit 0.5..1.5
    },
  };

  const res = normalizeTemplate(unconstrained);
  assert.equal(res.template_json.header.logoSize, 200);
  assert.equal(res.template_json.itemsTable.fontSize, 8);
  assert.equal(res.template_json.itemsTable.rowPadding, 20);
  assert.equal(res.template_json.totals.gstRate, 0);
  assert.equal(res.template_json.layout.marginTop, 50);
  assert.equal(res.template_json.layout.marginBottom, 0);
  assert.equal(res.template_json.layout.marginLeft, 50);
  assert.equal(res.template_json.layout.marginRight, 0);
  assert.equal(res.template_json.layout.fontSize, 24);
  assert.equal(res.template_json.layout.scale, 1.5);
});

test('T-10.5: Invalid enum values fall back to default enums safely', () => {
  const badEnums = {
    header: { align: 'justify', separator: 'wavy' },
    layout: { fontFamily: 'comic-sans' },
    itemsTable: { columns: ['invalid_col_1', 'invalid_col_2'] },
  };

  const res = normalizeTemplate(badEnums, 'unknown_paper_profile');
  assert.equal(res.paper_size, 'thermal_80');
  assert.equal(res.template_json.header.align, 'center');
  assert.equal(res.template_json.header.separator, 'dashed');
  assert.equal(res.template_json.layout.fontFamily, 'mono');
  assert.deepEqual(res.template_json.itemsTable.columns, DEFAULT_TEMPLATE_JSON.itemsTable.columns);
});

test('T-10.6: Preserves valid boolean and string overrides', () => {
  const customConfig = {
    header: {
      showLogo: true,
      logoUrl: 'https://cdn.example.com/logo.png',
      customShopName: 'Custom Paint Studio',
      align: 'left',
    },
    totals: {
      currencySymbol: 'PKR',
      showGst: true,
      gstRate: 18,
    },
    tokenClaimSlip: {
      enabled: false,
      title: 'Special Coupon',
    },
  };

  const res = normalizeTemplate(customConfig, 'thermal_58');
  assert.equal(res.paper_size, 'thermal_58');
  assert.equal(res.template_json.header.showLogo, true);
  assert.equal(res.template_json.header.logoUrl, 'https://cdn.example.com/logo.png');
  assert.equal(res.template_json.header.customShopName, 'Custom Paint Studio');
  assert.equal(res.template_json.header.align, 'left');
  assert.equal(res.template_json.totals.currencySymbol, 'PKR');
  assert.equal(res.template_json.totals.showGst, true);
  assert.equal(res.template_json.totals.gstRate, 18);
  assert.equal(res.template_json.tokenClaimSlip.enabled, false);
  assert.equal(res.template_json.tokenClaimSlip.title, 'Special Coupon');
});

// =============================================================================
// T-11: HTML Escaping, URL Validation & CSS Whitelisting Suite
// =============================================================================

test('T-11.1: escapeHtml escapes HTML special characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
});

test('T-11.2: escapeHtml safely handles non-string inputs', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(12345.67), '12345.67');
  assert.equal(escapeHtml(true), 'true');
  assert.equal(escapeHtml(false), 'false');
});

test('T-11.3: validateImageUrl strictly rejects dangerous and unwhitelisted protocols', () => {
  assert.equal(validateImageUrl('javascript:alert(1)'), null);
  assert.equal(validateImageUrl('javascript:void(0)'), null);
  assert.equal(validateImageUrl('vbscript:msgbox(1)'), null);
  assert.equal(validateImageUrl('file:///etc/passwd'), null);
  assert.equal(validateImageUrl('ftp://example.com/img.png'), null);
  assert.equal(validateImageUrl('http://malicious-site.com/logo.png'), null); // plain HTTP non-localhost rejected
  assert.equal(validateImageUrl('https://example.com/img" onerror="alert(1)'), null);
  assert.equal(validateImageUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), null);
  // CRITICAL: SVG data URIs can execute JavaScript in browsers
  assert.equal(validateImageUrl('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+'), null);
  assert.equal(validateImageUrl(''), null);
  assert.equal(validateImageUrl('   '), null);
  assert.equal(validateImageUrl(null), null);
  assert.equal(validateImageUrl(undefined), null);
});

test('T-11.4: validateImageUrl accepts valid HTTPS, localhost HTTP, root-relative, and raster base64', () => {
  assert.equal(
    validateImageUrl('https://cdn.pyntflow.com/logos/main.png'),
    'https://cdn.pyntflow.com/logos/main.png'
  );
  assert.equal(
    validateImageUrl('http://localhost:3000/assets/logo.png'),
    'http://localhost:3000/assets/logo.png'
  );
  assert.equal(
    validateImageUrl('http://127.0.0.1:8080/logo.png'),
    'http://127.0.0.1:8080/logo.png'
  );
  assert.equal(
    validateImageUrl('/assets/branding/logo.png'),
    '/assets/branding/logo.png'
  );
  const validPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(validateImageUrl(validPngDataUri), validPngDataUri);
});

test('T-11.5: CSS font stacks generate strictly whitelisted font families', () => {
  assert.equal(getFontStack('sans'), FONT_STACK_MAP.sans);
  assert.equal(getFontStack('serif'), FONT_STACK_MAP.serif);
  assert.equal(getFontStack('mono'), FONT_STACK_MAP.mono);
  // Any unknown or malicious input falls back to mono
  assert.equal(getFontStack('unknown-font'), FONT_STACK_MAP.mono);
  assert.equal(getFontStack('"; body { display:none; } "'), FONT_STACK_MAP.mono);
  assert.equal(getFontStack(null), FONT_STACK_MAP.mono);
});

test('T-11.6: getSeparatorCss generates only defined safe CSS border styles', () => {
  assert.equal(getSeparatorCss('none'), 'border-bottom: none;');
  assert.equal(getSeparatorCss('solid'), 'border-bottom: 1px solid #000;');
  assert.equal(getSeparatorCss('double'), 'border-bottom: 3px double #000;');
  assert.equal(getSeparatorCss('dashed'), 'border-bottom: 1px dashed #000;');
  assert.equal(getSeparatorCss('unknown'), 'border-bottom: 1px dashed #000;');
});

// =============================================================================
// T-12: Financial Value & Precision Preservation Suite
// =============================================================================

test('T-12.1: Exact formatted financial numbers match input values without floating-point distortion', () => {
  const testData = {
    ...standardInvoiceData,
    subTotal: 14160.00,
    discount: 160.00,
    deliveryCharge: 0.00,
    grandTotal: 14000.00,
    paidAmount: 14000.00,
    dueAmount: 0.00,
    changeReturned: 0.00,
  };

  const html = renderReceiptDocument(testData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(html.includes('14,160')); // Subtotal
  assert.ok(html.includes('Rs. 160')); // Discount
  assert.ok(html.includes('14,000')); // Grand total
  assert.ok(html.includes('Rs. 14,000')); // Paid
});

test('T-12.2: Payment splits and change returned are preserved exactly without recalculation', () => {
  const splitData = {
    ...standardInvoiceData,
    subTotal: 50000,
    discount: 2500,
    deliveryCharge: 500,
    grandTotal: 48000,
    paidAmount: 50000,
    dueAmount: 0,
    changeReturned: 2000,
    paymentSplits: {
      cash: 20000,
      card: 15000,
      bank: 13000,
      others: 2000,
    },
  };

  const html = renderReceiptDocument(splitData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(html.includes('50,000')); // Subtotal
  assert.ok(html.includes('Rs. 2,500')); // Discount
  assert.ok(html.includes('+ Rs. 500')); // Delivery charge
  assert.ok(html.includes('48,000')); // Grand total
  assert.ok(html.includes('Change Returned:'));
  assert.ok(html.includes('Rs. 2,000'));
  // Payment split rows
  assert.ok(html.includes('&bull; Cash:</span><span>Rs. 20,000'));
  assert.ok(html.includes('&bull; Card:</span><span>Rs. 15,000'));
  assert.ok(html.includes('&bull; Bank:</span><span>Rs. 13,000'));
  assert.ok(html.includes('&bull; Other:</span><span>Rs. 2,000'));
});

test('T-12.3: Balance due and zero values render cleanly without NaN or missing indicators', () => {
  const creditData = {
    ...standardInvoiceData,
    subTotal: 10000,
    discount: 0,
    deliveryCharge: 0,
    grandTotal: 10000,
    paidAmount: 4000,
    dueAmount: 6000,
    changeReturned: 0,
  };

  const html = renderReceiptDocument(creditData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(html.includes('10,000'));
  assert.ok(html.includes('Rs. 4,000'));
  assert.ok(html.includes('Balance Due:'));
  assert.ok(html.includes('Rs. 6,000'));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('undefined'));
});

// =============================================================================
// T-13: Paper Size (@page) and Font Family Generation Suite
// =============================================================================

test('T-13.1: thermal_80 generates @page { size: 80mm 297mm; margin: 0; } and body width 80mm', () => {
  const css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'thermal_80');
  assert.ok(css.includes('@page { size: 80mm 297mm; margin: 0; }'));
  assert.ok(css.includes('width: 80mm;'));
  assert.ok(css.includes('max-width: 80mm;'));
});

test('T-13.2: thermal_58 generates @page { size: 58mm 297mm; margin: 0; } and body width 58mm', () => {
  const css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'thermal_58');
  assert.ok(css.includes('@page { size: 58mm 297mm; margin: 0; }'));
  assert.ok(css.includes('width: 58mm;'));
  assert.ok(css.includes('max-width: 58mm;'));
});

test('T-13.3: a4 generates @page { size: A4 portrait; margin: 0; } and body width 210mm', () => {
  const css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'a4');
  assert.ok(css.includes('@page { size: A4 portrait; margin: 0; }'));
  assert.ok(css.includes('width: 210mm;'));
  assert.ok(css.includes('max-width: 210mm;'));
});

test('T-13.4: a5 generates @page { size: A5 portrait; margin: 0; } and body width 148mm', () => {
  const css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'a5');
  assert.ok(css.includes('@page { size: A5 portrait; margin: 0; }'));
  assert.ok(css.includes('width: 148mm;'));
  assert.ok(css.includes('max-width: 148mm;'));
});

test('T-13.5: Layout scale and margin CSS generation', () => {
  const customLayout = {
    ...DEFAULT_TEMPLATE_JSON.layout,
    scale: 0.9,
    marginTop: 10,
    marginRight: 8,
    marginBottom: 12,
    marginLeft: 6,
    fontSize: 14,
    fontFamily: 'sans',
  };

  const css = buildReceiptPageCss(customLayout, 'thermal_80');
  assert.ok(css.includes('transform: scale(0.9);'));
  assert.ok(css.includes('padding: 10mm 8mm 12mm 6mm;'));
  assert.ok(css.includes('font-size: 14px;'));
  assert.ok(css.includes(FONT_STACK_MAP.sans));
});

// =============================================================================
// T-14: POS and Sales History Rendering Parity Suite
// =============================================================================

test('T-14.1: POS and Sales History receipt renderings share identical structural components', () => {
  // POS Live Data
  const posData = {
    ...standardInvoiceData,
    isReprint: false,
  };

  // Sales History Duplicate Data
  const salesHistoryData = {
    ...standardInvoiceData,
    isReprint: true,
  };

  const posHtml = renderReceiptDocument(posData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  const salesHistoryHtml = renderReceiptDocument(salesHistoryData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  // Both contain header branding
  assert.ok(posHtml.includes('Al-Madina Color Center &amp; Paint Supply'));
  assert.ok(salesHistoryHtml.includes('Al-Madina Color Center &amp; Paint Supply'));

  // Both contain invoice metadata
  assert.ok(posHtml.includes('INV-2026-8801'));
  assert.ok(salesHistoryHtml.includes('INV-2026-8801'));
  assert.ok(posHtml.includes('Tariq Mehmood Contractors'));
  assert.ok(salesHistoryHtml.includes('Tariq Mehmood Contractors'));

  // Both contain line items
  assert.ok(posHtml.includes('WeatherSheet Exterior Acrylic 16L'));
  assert.ok(salesHistoryHtml.includes('WeatherSheet Exterior Acrylic 16L'));
  assert.ok(posHtml.includes('Nippon Synthetic Enamel 4L'));
  assert.ok(salesHistoryHtml.includes('Nippon Synthetic Enamel 4L'));

  // Both contain identical totals
  assert.ok(posHtml.includes('31,250'));
  assert.ok(salesHistoryHtml.includes('31,250'));
  assert.ok(posHtml.includes('31,900'));
  assert.ok(salesHistoryHtml.includes('31,900'));

  // Both contain template footer
  assert.ok(posHtml.includes(escapeHtml(DEFAULT_TEMPLATE_JSON.footer.line1)));
  assert.ok(salesHistoryHtml.includes(escapeHtml(DEFAULT_TEMPLATE_JSON.footer.line1)));
});

test('T-14.2: Parity distinction: Sales History duplicate is explicitly watermarked with DUPLICATE RECEIPT', () => {
  const posData = { ...standardInvoiceData, isReprint: false };
  const reprintData = { ...standardInvoiceData, isReprint: true };

  const posHtml = renderReceiptDocument(posData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  const reprintHtml = renderReceiptDocument(reprintData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(!posHtml.includes('DUPLICATE RECEIPT'));
  assert.ok(reprintHtml.includes('DUPLICATE RECEIPT'));
});

test('T-14.3: Fallback branding to PyntFlow Store when tenant name is empty or unconfigured', () => {
  const unnamedData = {
    ...standardInvoiceData,
    tenantName: '',
  };

  const html = renderReceiptDocument(unnamedData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(html.includes('PyntFlow Store'));
});

// =============================================================================
// T-15: Token Claim Slip Generation & Suppression Suite
// =============================================================================

test('T-15.1: Renders token claim slip with live claim code when present and enabled', () => {
  const liveTokenData = {
    ...standardInvoiceData,
    tokenClaimCode: 'CLM-778899',
    tokenClaimDetails: 'WeatherSheet 16L (x3) - Rs. 600 total token value',
  };

  const html = renderReceiptDocument(liveTokenData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(html.includes('Token Claim Slip'));
  assert.ok(html.includes('CLM-778899'));
  assert.ok(html.includes('WeatherSheet 16L (x3) - Rs. 600 total token value'));
  assert.ok(html.includes('Present this code on your next visit to redeem your token'));
  assert.ok(html.includes('Keep this receipt — code cannot be reissued'));
});

test('T-15.2: Does NOT render token claim slip when claim code is absent', () => {
  const noTokenData = {
    ...standardInvoiceData,
    tokenClaimCode: undefined,
    tokenClaimDetails: undefined,
  };

  const html = renderReceiptDocument(noTokenData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(!html.includes('Token Claim Slip'));
  assert.ok(!html.includes('CLM-'));
  assert.ok(!html.includes('Present this code on your next visit'));
});

test('T-15.3: Suppresses token claim slip when tokenClaimSlip.enabled is false even if claim code exists', () => {
  const disabledSlipTemplate = {
    ...DEFAULT_TEMPLATE_JSON,
    tokenClaimSlip: {
      ...DEFAULT_TEMPLATE_JSON.tokenClaimSlip,
      enabled: false,
    },
  };

  const tokenData = {
    ...standardInvoiceData,
    tokenClaimCode: 'CLM-SHOULD-NOT-APPEAR',
    tokenClaimDetails: 'Rs. 500 token',
  };

  const html = renderReceiptDocument(tokenData, disabledSlipTemplate, 'thermal_80');
  assert.ok(!html.includes('CLM-SHOULD-NOT-APPEAR'));
  assert.ok(!html.includes('Token Claim Slip'));
});

test('T-15.4: Custom slip title, instructions, and notice from template are reflected in rendered output', () => {
  const customSlipTemplate = {
    ...DEFAULT_TEMPLATE_JSON,
    tokenClaimSlip: {
      enabled: true,
      title: 'Customer Loyalty Reward Slip',
      instructions: 'Scan at the service counter to collect your gift',
      footerNotice: 'Valid for 30 days from date of purchase',
      showDetails: true,
    },
  };

  const tokenData = {
    ...standardInvoiceData,
    tokenClaimCode: 'RWD-994411',
    tokenClaimDetails: 'Special Bonus Gift Item',
  };

  const html = renderReceiptDocument(tokenData, customSlipTemplate, 'thermal_80');
  assert.ok(html.includes('Customer Loyalty Reward Slip'));
  assert.ok(html.includes('Scan at the service counter to collect your gift'));
  assert.ok(html.includes('RWD-994411'));
  assert.ok(html.includes('Special Bonus Gift Item'));
  assert.ok(html.includes('Valid for 30 days from date of purchase'));
});

test('T-15.5: Sales History duplicate reprint never prints claim code or token claim slip', () => {
  // Sales History always passes tokenClaimCode: undefined
  const reprintData = {
    ...standardInvoiceData,
    isReprint: true,
    tokenClaimCode: undefined,
  };

  const html = renderReceiptDocument(reprintData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
  assert.ok(!html.includes('Token Claim Slip'));
  assert.ok(!html.includes('CLM-'));
});

// =============================================================================
// T-16: Multi-Tenant Template Fallback & Isolation Suite
// =============================================================================

// Simulates the exact resolution logic from src/app/api/receipt-templates/assign/route.ts
function resolveTenantTemplate(tenantId, tenantAssignments, dbTemplates) {
  // 1. Look up tenant assignment
  const assignment = tenantAssignments.find(a => a.tenant_id === tenantId);
  if (assignment) {
    const tmpl = dbTemplates.find(t => t.id === assignment.template_id && !t.is_deleted);
    if (tmpl) return { is_custom: true, template: tmpl };
  }

  // 2. Fallback to platform default template
  const platformDefault = dbTemplates.find(t => t.is_default && !t.is_deleted);
  if (platformDefault) {
    return { is_custom: false, template: platformDefault };
  }

  // 3. Fallback to any non-deleted template
  const anyTemplate = dbTemplates.find(t => !t.is_deleted);
  if (anyTemplate) {
    return { is_custom: false, template: anyTemplate };
  }

  // 4. Static fallback to DEFAULT_TEMPLATE_JSON
  return {
    is_custom: false,
    template: {
      id: 'default',
      name: 'Fallback Template',
      paper_size: 'thermal_80',
      template_json: DEFAULT_TEMPLATE_JSON,
      is_default: true,
    },
  };
}

test('T-16.1: Tenant A with assigned custom template resolves and renders Tenant A template', () => {
  const mockDbTemplates = [
    {
      id: 'tmpl-platform-default',
      name: 'Default 80mm Template',
      paper_size: 'thermal_80',
      is_default: true,
      is_deleted: false,
      template_json: {
        ...DEFAULT_TEMPLATE_JSON,
        header: { ...DEFAULT_TEMPLATE_JSON.header, customShopName: 'Platform Standard POS' },
      },
    },
    {
      id: 'tmpl-tenant-a',
      name: 'Tenant A Custom 58mm',
      paper_size: 'thermal_58',
      is_default: false,
      is_deleted: false,
      template_json: {
        ...DEFAULT_TEMPLATE_JSON,
        header: { ...DEFAULT_TEMPLATE_JSON.header, customShopName: 'Tenant A Exclusive Boutique' },
        layout: { ...DEFAULT_TEMPLATE_JSON.layout, fontFamily: 'serif' },
      },
    },
  ];

  const mockAssignments = [
    { tenant_id: 'tenant-alpha-001', template_id: 'tmpl-tenant-a' },
  ];

  const resolved = resolveTenantTemplate('tenant-alpha-001', mockAssignments, mockDbTemplates);
  assert.equal(resolved.is_custom, true);
  assert.equal(resolved.template.id, 'tmpl-tenant-a');
  assert.equal(resolved.template.paper_size, 'thermal_58');

  const html = renderReceiptDocument(standardInvoiceData, resolved.template.template_json, resolved.template.paper_size);
  assert.ok(html.includes('Tenant A Exclusive Boutique'));
  assert.ok(html.includes('width: 58mm;'));
  assert.ok(html.includes(FONT_STACK_MAP.serif));
  assert.ok(!html.includes('Platform Standard POS'));
});

test('T-16.2: Tenant B with no assignment falls back cleanly to platform default template', () => {
  const mockDbTemplates = [
    {
      id: 'tmpl-platform-default',
      name: 'Default 80mm Template',
      paper_size: 'thermal_80',
      is_default: true,
      is_deleted: false,
      template_json: {
        ...DEFAULT_TEMPLATE_JSON,
        header: { ...DEFAULT_TEMPLATE_JSON.header, customShopName: 'Platform Standard POS' },
      },
    },
    {
      id: 'tmpl-tenant-a',
      name: 'Tenant A Custom 58mm',
      paper_size: 'thermal_58',
      is_default: false,
      is_deleted: false,
      template_json: {
        ...DEFAULT_TEMPLATE_JSON,
        header: { ...DEFAULT_TEMPLATE_JSON.header, customShopName: 'Tenant A Exclusive Boutique' },
      },
    },
  ];

  const mockAssignments = [
    { tenant_id: 'tenant-alpha-001', template_id: 'tmpl-tenant-a' },
  ];

  // Tenant B has NO entry in mockAssignments
  const resolved = resolveTenantTemplate('tenant-beta-002', mockAssignments, mockDbTemplates);
  assert.equal(resolved.is_custom, false);
  assert.equal(resolved.template.id, 'tmpl-platform-default');
  assert.equal(resolved.template.paper_size, 'thermal_80');

  const html = renderReceiptDocument(standardInvoiceData, resolved.template.template_json, resolved.template.paper_size);
  assert.ok(html.includes('Platform Standard POS'));
  assert.ok(html.includes('width: 80mm;'));
  // Confirm Tenant A branding is strictly isolated and does not leak
  assert.ok(!html.includes('Tenant A Exclusive Boutique'));
});

test('T-16.3: Tenant C with no assignment and empty DB templates falls back to DEFAULT_TEMPLATE_JSON', () => {
  const emptyDbTemplates = [];
  const emptyAssignments = [];

  const resolved = resolveTenantTemplate('tenant-gamma-003', emptyAssignments, emptyDbTemplates);
  assert.equal(resolved.is_custom, false);
  assert.equal(resolved.template.id, 'default');
  assert.deepEqual(resolved.template.template_json, DEFAULT_TEMPLATE_JSON);

  const html = renderReceiptDocument(standardInvoiceData, resolved.template.template_json, resolved.template.paper_size);
  assert.ok(html.includes('width: 80mm;'));
  assert.ok(html.includes('Al-Madina Color Center &amp; Paint Supply'));
});

// =============================================================================
// Complete HTML Document Integrity & Iframe Readiness (T-09 Verification)
// =============================================================================

test('Document Integrity: renderReceiptDocument produces valid, balanced HTML with style tags', () => {
  const html = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'thermal_80');

  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<html>'));
  assert.ok(html.includes('<head>'));
  assert.ok(html.includes('</head>'));
  assert.ok(html.includes('<body>'));
  assert.ok(html.includes('</body>'));
  assert.ok(html.endsWith('</html>'));

  // Ensure page CSS is strictly wrapped in <style> tags (verifying T-09 fix)
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('</style>'));

  // Ensure @page is inside a <style> block
  const styleBlockRegex = /<style>[\s\S]*?@page\s*\{[\s\S]*?\}[\s\S]*?<\/style>/;
  assert.ok(styleBlockRegex.test(html), '@page rule must be wrapped in <style> tags');
});

// =============================================================================
// T-18.1-FIX: Thermal @page CSS Syntax & Headless Chromium PDF MediaBox Verification
// =============================================================================

test('T-18.1-FIX.1: buildThermalHtmlDocument in iframePrint generates valid @page size 80mm 297mm', async () => {
  const { buildThermalHtmlDocument } = await import('@/utils/iframePrint');
  const wrapped = buildThermalHtmlDocument('<div>test</div>');
  assert.ok(wrapped.includes('@page { size: 80mm 297mm; margin: 0; }'));
});

test('T-18.1-FIX.2: Headless Chromium PDF MediaBox validation for thermal_80 and thermal_58', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const { execSync } = await import('node:child_process');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    // If Chrome binary is not in default path, skip gracefully
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `receipt-fix-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Test thermal_80
    const html80 = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'thermal_80');
    const html80Path = path.join(tmpDir, 'test_80.html');
    const pdf80Path = path.join(tmpDir, 'test_80.pdf');
    fs.writeFileSync(html80Path, html80, 'utf8');

    execSync(`"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdf80Path}" "file://${html80Path.replace(/\\/g, '/')}"`);

    const pdf80Buf = fs.readFileSync(pdf80Path);
    const pdf80Str = pdf80Buf.toString('latin1');
    const mb80Match = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/.exec(pdf80Str);
    assert.ok(mb80Match, 'thermal_80 PDF must contain /MediaBox');
    const width80Pt = parseFloat(mb80Match[3]) - parseFloat(mb80Match[1]);
    const width80Mm = (width80Pt * 25.4) / 72;
    assert.ok(Math.abs(width80Mm - 80.1) <= 0.5, `thermal_80 PDF width (${width80Mm}mm) must measure ~80.1mm, not Letter (215.9mm)`);

    // 2. Test thermal_58
    const html58 = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'thermal_58');
    const html58Path = path.join(tmpDir, 'test_58.html');
    const pdf58Path = path.join(tmpDir, 'test_58.pdf');
    fs.writeFileSync(html58Path, html58, 'utf8');

    execSync(`"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdf58Path}" "file://${html58Path.replace(/\\/g, '/')}"`);

    const pdf58Buf = fs.readFileSync(pdf58Path);
    const pdf58Str = pdf58Buf.toString('latin1');
    const mb58Match = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/.exec(pdf58Str);
    assert.ok(mb58Match, 'thermal_58 PDF must contain /MediaBox');
    const width58Pt = parseFloat(mb58Match[3]) - parseFloat(mb58Match[1]);
    const width58Mm = (width58Pt * 25.4) / 72;
    assert.ok(Math.abs(width58Mm - 58.0) <= 0.8, `thermal_58 PDF width (${width58Mm}mm) must measure ~58.0mm, not Letter (215.9mm)`);

    // 3. Test a4 cut-sheet preservation
    const htmlA4 = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'a4');
    const htmlA4Path = path.join(tmpDir, 'test_a4.html');
    const pdfA4Path = path.join(tmpDir, 'test_a4.pdf');
    fs.writeFileSync(htmlA4Path, htmlA4, 'utf8');

    execSync(`"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfA4Path}" "file://${htmlA4Path.replace(/\\/g, '/')}"`);

    const pdfA4Buf = fs.readFileSync(pdfA4Path);
    const pdfA4Str = pdfA4Buf.toString('latin1');
    const mbA4Match = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/.exec(pdfA4Str);
    assert.ok(mbA4Match, 'a4 PDF must contain /MediaBox');
    const widthA4Pt = parseFloat(mbA4Match[3]) - parseFloat(mbA4Match[1]);
    const widthA4Mm = (widthA4Pt * 25.4) / 72;
    assert.ok(Math.abs(widthA4Mm - 210.0) <= 0.5, `a4 PDF width (${widthA4Mm}mm) must measure ~210.0mm`);
    // 4. Test a5 cut-sheet
    const htmlA5 = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'a5');
    const htmlA5Path = path.join(tmpDir, 'test_a5.html');
    const pdfA5Path = path.join(tmpDir, 'test_a5.pdf');
    fs.writeFileSync(htmlA5Path, htmlA5, 'utf8');

    execSync(`"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfA5Path}" "file://${htmlA5Path.replace(/\\/g, '/')}"`);

    const pdfA5Buf = fs.readFileSync(pdfA5Path);
    const pdfA5Str = pdfA5Buf.toString('latin1');
    const mbA5Match = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/.exec(pdfA5Str);
    assert.ok(mbA5Match, 'a5 PDF must contain /MediaBox');
    const widthA5Pt = parseFloat(mbA5Match[3]) - parseFloat(mbA5Match[1]);
    const widthA5Mm = (widthA5Pt * 25.4) / 72;
    assert.ok(Math.abs(widthA5Mm - 148.2) <= 0.8, `a5 PDF width (${widthA5Mm}mm) must measure ~148mm`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// =============================================================================
// T-18.2: A4 & A5 Cut-Sheet Layout, Pagination & Break-Protection Suite
// =============================================================================

test('T-18.2.1: Totals block and Token Claim Slip enforce break-inside: avoid for cut-sheet pages', () => {
  const invoiceWithToken = { ...standardInvoiceData, tokenClaimCode: 'CLM-TEST-001' };
  const html = renderReceiptDocument(invoiceWithToken, DEFAULT_TEMPLATE_JSON, 'a4');
  assert.ok(html.includes('break-inside:avoid;page-break-inside:avoid'), 'Totals block must contain break-inside:avoid');
  assert.ok(html.includes('border:1px dashed #000;padding:8px;margin-top:10px;text-align:center;break-inside:avoid;page-break-inside:avoid'), 'Token Claim Slip must contain break-inside:avoid');
});

test('T-18.2.2: A4 and A5 receipts render full-width tables without element overflow', () => {
  const htmlA4 = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'a4');
  const htmlA5 = renderReceiptDocument(standardInvoiceData, DEFAULT_TEMPLATE_JSON, 'a5');
  assert.ok(htmlA4.includes('width: 210mm;'));
  assert.ok(htmlA5.includes('width: 148mm;'));
});

// =============================================================================
// T-18.3: Hidden Iframe Printing Lifecycle & Memory Leak Audit Suite
// =============================================================================

test('T-18.3.1: printViaIframe cleans up orphaned iframe elements and arms safety timer', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/utils/iframePrint.ts', 'utf8');

  // Verify preemptive cleanup of existing iframe
  assert.ok(src.includes("document.getElementById('__thermal_print_iframe__')"), 'Must check for existing iframe');
  assert.ok(src.includes('existing.remove()'), 'Must remove existing iframe prior to new creation');

  // Verify afterprint listener
  assert.ok(src.includes("'afterprint'"), 'Must register afterprint event listener');

  // Verify 30-second fallback timer
  assert.ok(src.includes('30000'), 'Must include 30000ms safety timeout fallback');
});

// =============================================================================
// T-19: Strict Compliance Locks for Mandatory Receipt Fields (Option A)
// =============================================================================

test('T-19.1: normalizeTemplate forces showInvoiceNo, showDate, and showGrandTotal to true when false', () => {
  const rawTamperedTemplate = {
    ...DEFAULT_TEMPLATE_JSON,
    invoiceInfo: {
      ...DEFAULT_TEMPLATE_JSON.invoiceInfo,
      showInvoiceNo: false,
      showDate: false,
      showCashier: false,
    },
    totals: {
      ...DEFAULT_TEMPLATE_JSON.totals,
      showGrandTotal: false,
      showPaid: false,
    },
  };

  const normalized = normalizeTemplate(rawTamperedTemplate);
  assert.strictEqual(normalized.template_json.invoiceInfo.showInvoiceNo, true, 'showInvoiceNo must be forced to true');
  assert.strictEqual(normalized.template_json.invoiceInfo.showDate, true, 'showDate must be forced to true');
  assert.strictEqual(normalized.template_json.totals.showGrandTotal, true, 'showGrandTotal must be forced to true');

  // Unrelated fields must retain their customized settings
  assert.strictEqual(normalized.template_json.invoiceInfo.showCashier, false, 'showCashier must remain false');
  assert.strictEqual(normalized.template_json.totals.showPaid, false, 'showPaid must remain false');
});

test('T-19.2: renderReceiptDocument renders Invoice Number, Date, and Grand Total even if raw template has false', () => {
  const rawTamperedTemplate = {
    ...DEFAULT_TEMPLATE_JSON,
    invoiceInfo: {
      ...DEFAULT_TEMPLATE_JSON.invoiceInfo,
      showInvoiceNo: false,
      showDate: false,
    },
    totals: {
      ...DEFAULT_TEMPLATE_JSON.totals,
      showGrandTotal: false,
    },
  };

  for (const paperSize of ['thermal_80', 'thermal_58', 'a4', 'a5']) {
    const html = renderReceiptDocument(standardInvoiceData, rawTamperedTemplate, paperSize);
    assert.ok(html.includes('INV-2026-8801'), `Invoice number must appear on ${paperSize}`);
    assert.ok(html.includes('2026-10-11'), `Date must appear on ${paperSize}`);
    assert.ok(html.includes('NET TOTAL') || html.includes('31,000') || html.includes('31000'), `Grand total must appear on ${paperSize}`);
  }
});

test('T-19.3: DevReceiptTemplatesView and DevReceiptPreview enforce mandatory locked UI controls', async () => {
  const fs = await import('node:fs');
  const viewSrc = fs.readFileSync('src/components/dev-panel/DevReceiptTemplatesView.tsx', 'utf8');
  const previewSrc = fs.readFileSync('src/components/dev-panel/DevReceiptPreview.tsx', 'utf8');

  // DevReceiptTemplatesView locks check
  assert.ok(viewSrc.includes('Mandatory / Locked'), 'DevReceiptTemplatesView must show Mandatory / Locked badges');
  assert.ok(viewSrc.includes('Required for legal and accounting compliance'), 'Must explain invoice compliance requirement');
  assert.ok(viewSrc.includes('Required for audit and transaction verification'), 'Must explain date compliance requirement');
  assert.ok(viewSrc.includes('Required financial settlement field'), 'Must explain grand total compliance requirement');

  // DevReceiptPreview mandatory rendering check
  assert.ok(previewSrc.includes('T-19 Strict Compliance Lock: Invoice Number'), 'Preview must enforce mandatory invoice number');
  assert.ok(previewSrc.includes('T-19 Strict Compliance Lock: Date'), 'Preview must enforce mandatory date');
  assert.ok(previewSrc.includes('T-19 Strict Compliance Lock: Grand Total'), 'Preview must enforce mandatory grand total');
});

// =============================================================================
// T-20: Sales History Reprint Token Claim Slip Complete Suppression (Option A)
// =============================================================================

test('T-20.1: Sales History reprint completely suppresses token claim slip across all 4 formats', async () => {
  const { buildSalesHistoryThermalHtml, buildPosThermalHtml } = await import('@/utils/receiptAdapters');

  const historyInvoiceWithToken = {
    invoice_no: 'INV-HIST-SUPPRESS-001',
    date: '2026-10-10',
    time: '14:20',
    client_name: 'Alpha Construction Ltd',
    payment_type: 'cash',
    cash_paid: 12000,
    subTotal: 12000,
    discount: 0,
    grandTotal: 12000,
    paid_amount: 12000,
    due_amount: 0,
    token_claim_code: 'CLM-SHOULD-NOT-APPEAR',
    token_claim_details: 'Special Token 2x',
    items: [
      { item_name: 'Gloss Enamel 4L', item_code: 'GLS-04', qty: 2, unit_price: 6000, total_price: 12000 }
    ],
  };

  const formats = ['thermal_80', 'thermal_58', 'a4', 'a5'];

  for (const fmt of formats) {
    const customTemplate = {
      ...DEFAULT_TEMPLATE_JSON,
      paperSize: fmt,
      tokenClaimSlip: { enabled: true, title: 'Token Claim Slip' },
    };

    const reprintHtml = buildSalesHistoryThermalHtml(historyInvoiceWithToken, 'Test Tenant', customTemplate);

    // 1. Must be marked duplicate
    assert.ok(
      reprintHtml.includes('DUPLICATE RECEIPT') || reprintHtml.includes('Duplicate'),
      `Reprint on ${fmt} must have DUPLICATE RECEIPT marker`
    );

    // 2. Must completely suppress claim code and slip
    assert.ok(!reprintHtml.includes('CLM-'), `Reprint on ${fmt} must NOT contain CLM- claim code`);
    assert.ok(!reprintHtml.includes('Token Claim Slip'), `Reprint on ${fmt} must NOT contain Token Claim Slip heading`);
    assert.ok(!reprintHtml.includes('Present this code'), `Reprint on ${fmt} must NOT contain claim instructions`);
    assert.ok(!reprintHtml.includes('token_claim_box'), `Reprint on ${fmt} must NOT contain claim box`);
    assert.ok(!reprintHtml.includes('Replacement Notice') && !reprintHtml.includes('claim cannot be issued'),
      `Reprint on ${fmt} must NOT contain fallback or replacement claim notice`);

    // 3. Legitimate transaction details remain intact
    assert.ok(reprintHtml.includes('INV-HIST-SUPPRESS-001'), `Reprint on ${fmt} must contain invoice number`);
    assert.ok(reprintHtml.includes('Gloss Enamel 4L'), `Reprint on ${fmt} must contain line items`);
    assert.ok(reprintHtml.includes('12,000') || reprintHtml.includes('12000'), `Reprint on ${fmt} must contain total`);

    // 4. Parity check: Original POS live checkout issuance still renders claim slip normally
    const posSaleWithToken = {
      invoice_no: 'INV-POS-LIVE-001',
      date: '2026-10-10',
      client_name: 'Walk-in Customer',
      payment_type: 'cash',
      cash_paid: 12000,
      subTotal: 12000,
      discount: 0,
      grandTotal: 12000,
      paid_amount: 12000,
      due_amount: 0,
      token_claim_code: 'CLM-LIVE-999',
      token_claim_details: 'Gloss Enamel 4L (x2) - Rs. 400',
      items: [
        { productName: 'Gloss Enamel 4L', code: 'GLS-04', qty: 2, rate: 6000, hasToken: true }
      ],
    };

    const livePosHtml = buildPosThermalHtml(posSaleWithToken, 'Test Tenant', 'Cashier', customTemplate);
    assert.ok(!livePosHtml.includes('DUPLICATE RECEIPT'), `Live POS sale on ${fmt} must NOT have duplicate marker`);
    assert.ok(livePosHtml.includes('CLM-LIVE-999'), `Live POS sale on ${fmt} must render claim code`);
    assert.ok(livePosHtml.includes('Token Claim Slip'), `Live POS sale on ${fmt} must render claim slip heading`);
  }
});

// =============================================================================
// T-21: Token Claim Slip Complete Suppression When Disabled (Option A)
// =============================================================================

test('T-21.1: Disabled tokenClaimSlip emits ZERO claim markup across all 4 formats', () => {
  const invoiceWithToken = {
    ...standardInvoiceData,
    tokenClaimCode: 'CLM-DISABLED-TEST-777',
    tokenClaimDetails: '2x Token Paint',
  };

  const formats = ['thermal_80', 'thermal_58', 'a4', 'a5'];

  for (const fmt of formats) {
    // 1. Test Disabled State
    const disabledTemplate = {
      ...DEFAULT_TEMPLATE_JSON,
      paperSize: fmt,
      tokenClaimSlip: {
        ...DEFAULT_TEMPLATE_JSON.tokenClaimSlip,
        enabled: false,
      },
    };

    const disabledHtml = renderReceiptDocument(invoiceWithToken, disabledTemplate, fmt);
    assert.ok(!disabledHtml.includes('CLM-DISABLED-TEST-777'), `Disabled ${fmt} must not contain claim code`);
    assert.ok(!disabledHtml.includes('Token Claim Slip'), `Disabled ${fmt} must not contain claim heading`);
    assert.ok(!disabledHtml.includes('Present this code'), `Disabled ${fmt} must not contain claim instructions`);
    assert.ok(!disabledHtml.includes('token_claim_box'), `Disabled ${fmt} must not contain claim container`);
    assert.ok(!disabledHtml.includes('Coupon') && !disabledHtml.includes('Voucher'), `Disabled ${fmt} must not emit fallback coupon`);
    assert.ok(!disabledHtml.includes('Replacement Notice'), `Disabled ${fmt} must not emit replacement notice`);

    // 2. Test Enabled State on same format
    const enabledTemplate = {
      ...DEFAULT_TEMPLATE_JSON,
      paperSize: fmt,
      tokenClaimSlip: {
        ...DEFAULT_TEMPLATE_JSON.tokenClaimSlip,
        enabled: true,
      },
    };

    const enabledHtml = renderReceiptDocument(invoiceWithToken, enabledTemplate, fmt);
    assert.ok(enabledHtml.includes('CLM-DISABLED-TEST-777'), `Enabled ${fmt} must contain claim code`);
    assert.ok(enabledHtml.includes('Token Claim Slip'), `Enabled ${fmt} must contain claim heading`);
  }
});



