import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeHtml,
  validateImageUrl,
  getFontStack,
  getSeparatorCss,
  buildReceiptPageCss,
  normalizeTemplate,
  renderReceiptHtmlDocument,
  FONT_STACK_MAP,
  VALID_PAPER_SIZES,
} from '@/utils/receiptRenderCore';
import { DEFAULT_TEMPLATE_JSON } from '@/types/receipt';

// ─── 1. HTML Escaping Tests ──────────────────────────────────────────────────

test('escapeHtml: handles null, undefined, numbers, and strings safely', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(12345), '12345');
  assert.equal(escapeHtml('Hello World'), 'Hello World');
});

test('escapeHtml: escapes all HTML special characters', () => {
  const dangerous = '<script>alert("XSS & injection")</script>\'';
  const escaped = escapeHtml(dangerous);
  assert.equal(escaped, '&lt;script&gt;alert(&quot;XSS &amp; injection&quot;)&lt;/script&gt;&#39;');
  assert.ok(!escaped.includes('<'));
  assert.ok(!escaped.includes('>'));
  assert.ok(!escaped.includes('"'));
  assert.ok(!escaped.includes("'"));
});

// ─── 2. Image URL Validation Tests ───────────────────────────────────────────

test('validateImageUrl: rejects invalid or dangerous URLs', () => {
  assert.equal(validateImageUrl(null), null);
  assert.equal(validateImageUrl(undefined), null);
  assert.equal(validateImageUrl(''), null);
  assert.equal(validateImageUrl('   '), null);
  assert.equal(validateImageUrl('javascript:alert(1)'), null);
  assert.equal(validateImageUrl('vbscript:msgbox(1)'), null);
  assert.equal(validateImageUrl('http://malicious.com/logo.png'), null); // plain HTTP non-localhost rejected
  assert.equal(validateImageUrl('https://example.com/logo" onerror="alert(1)'), null);
  assert.equal(validateImageUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), null);
  // CRITICAL SECURITY CHECK: Explicitly reject SVG data URIs
  assert.equal(validateImageUrl('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+'), null);
});

test('validateImageUrl: accepts legitimate HTTPS, local dev HTTP, and raster base64', () => {
  assert.equal(
    validateImageUrl('https://pyntflow.com/assets/logo.png'),
    'https://pyntflow.com/assets/logo.png'
  );
  assert.equal(
    validateImageUrl('http://localhost:3000/logo.png'),
    'http://localhost:3000/logo.png'
  );
  assert.equal(
    validateImageUrl('http://127.0.0.1:8080/images/brand.jpg'),
    'http://127.0.0.1:8080/images/brand.jpg'
  );
  assert.equal(
    validateImageUrl('/logo.png'),
    '/logo.png'
  );
  const validPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(validateImageUrl(validPngDataUri), validPngDataUri);
});

// ─── 3. Font Stacks and CSS Separators ───────────────────────────────────────

test('getFontStack: returns correct font stack and defaults safely', () => {
  assert.equal(getFontStack('mono'), FONT_STACK_MAP.mono);
  assert.equal(getFontStack('sans'), FONT_STACK_MAP.sans);
  assert.equal(getFontStack('serif'), FONT_STACK_MAP.serif);
  assert.equal(getFontStack('unknown_family'), FONT_STACK_MAP.mono);
  assert.equal(getFontStack(null), FONT_STACK_MAP.mono);
});

test('getSeparatorCss: returns correct CSS border rules', () => {
  assert.equal(getSeparatorCss('none'), 'border-bottom: none;');
  assert.equal(getSeparatorCss('solid'), 'border-bottom: 1px solid #000;');
  assert.equal(getSeparatorCss('dashed'), 'border-bottom: 1px dashed #000;');
  assert.equal(getSeparatorCss('double'), 'border-bottom: 3px double #000;');
  assert.equal(getSeparatorCss('invalid'), 'border-bottom: 1px dashed #000;');
});

// ─── 4. Paper-Size Print CSS Generation ──────────────────────────────────────

test('buildReceiptPageCss: generates correct CSS for thermal_80', () => {
  const css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'thermal_80');
  assert.ok(css.includes('@page { size: 80mm 297mm; margin: 0; }'));
  assert.ok(css.includes('width: 80mm;'));
  assert.ok(css.includes('max-width: 80mm;'));
  assert.ok(css.includes('padding: 4mm 4mm 6mm 4mm;'));
});

test('buildReceiptPageCss: generates correct CSS for thermal_58', () => {
  const css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'thermal_58');
  assert.ok(css.includes('@page { size: 58mm 297mm; margin: 0; }'));
  assert.ok(css.includes('width: 58mm;'));
  assert.ok(css.includes('max-width: 58mm;'));
});

test('buildReceiptPageCss: generates correct CSS for A4 and A5 cut-sheet', () => {
  const a4Css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'a4');
  assert.ok(a4Css.includes('@page { size: A4 portrait; margin: 0; }'));
  assert.ok(a4Css.includes('width: 210mm;'));

  const a5Css = buildReceiptPageCss(DEFAULT_TEMPLATE_JSON.layout, 'a5');
  assert.ok(a5Css.includes('@page { size: A5 portrait; margin: 0; }'));
  assert.ok(a5Css.includes('width: 148mm;'));
});

test('buildReceiptPageCss: clamps out-of-range margins and sizes', () => {
  const crazyLayout = {
    ...DEFAULT_TEMPLATE_JSON.layout,
    marginTop: -50,
    marginBottom: 500,
    fontSize: 999,
    scale: 0.1,
  };
  const css = buildReceiptPageCss(crazyLayout, 'thermal_80');
  assert.ok(css.includes('padding: 0mm 4mm 50mm 4mm;')); // -50 clamped to 0, 500 clamped to 50
  assert.ok(css.includes('font-size: 24px;')); // 999 clamped to 24
  assert.ok(css.includes('transform: scale(0.5);')); // 0.1 clamped to 0.5
});

// ─── 5. Deep Template Normalization Tests ────────────────────────────────────

test('normalizeTemplate: returns complete defaults for null or empty object', () => {
  const fromNull = normalizeTemplate(null);
  assert.equal(fromNull.paper_size, 'thermal_80');
  assert.equal(fromNull.template_json.header.showLogo, true);
  assert.equal(fromNull.template_json.invoiceInfo.invoiceLabel, 'Invoice #');
  assert.equal(fromNull.template_json.tokenClaimSlip.enabled, true);
  assert.equal(fromNull.template_json.tokenClaimSlip.title, 'Token Claim Slip');

  const fromEmpty = normalizeTemplate({});
  assert.deepEqual(fromEmpty.template_json.itemsTable.columns, ['name', 'qty', 'rate', 'amount']);
});

test('normalizeTemplate: legacy templates without tokenClaimSlip receive safe defaults', () => {
  const legacyTemplate = {
    header: { showShopName: true, customShopName: 'Old Store' },
    layout: { fontFamily: 'sans' },
  };
  const normalized = normalizeTemplate(legacyTemplate);
  assert.equal(normalized.template_json.header.customShopName, 'Old Store');
  assert.equal(normalized.template_json.layout.fontFamily, 'sans');
  // Legacy guarantee: tokenClaimSlip is automatically present with default values
  assert.ok(normalized.template_json.tokenClaimSlip);
  assert.equal(normalized.template_json.tokenClaimSlip.enabled, true);
  assert.equal(normalized.template_json.tokenClaimSlip.title, 'Token Claim Slip');
  assert.equal(normalized.template_json.tokenClaimSlip.footerNotice, 'Keep this receipt — code cannot be reissued');
});

test('normalizeTemplate: clamps invalid and out-of-range values', () => {
  const dirty = {
    header: { logoSize: 5000, align: 'justify', separator: 'zigzag' },
    itemsTable: { columns: ['invalid_col', 'name', 123, 'rate'], fontSize: -20 },
    totals: { gstRate: 999 },
    layout: { scale: 10, fontFamily: 'wingdings' },
    tokenClaimSlip: { enabled: 'not-a-bool' },
  };
  const normalized = normalizeTemplate(dirty, 'invalid_paper');

  assert.equal(normalized.paper_size, 'thermal_80');
  assert.equal(normalized.template_json.header.logoSize, 200); // clamped to max 200
  assert.equal(normalized.template_json.header.align, 'center'); // invalid enum falls back
  assert.equal(normalized.template_json.header.separator, 'dashed'); // invalid enum falls back
  assert.deepEqual(normalized.template_json.itemsTable.columns, ['name', 'rate']); // filtered
  assert.equal(normalized.template_json.itemsTable.fontSize, 8); // clamped to min 8
  assert.equal(normalized.template_json.totals.gstRate, 100); // clamped to max 100
  assert.equal(normalized.template_json.layout.scale, 1.5); // clamped to max 1.5
  assert.equal(normalized.template_json.layout.fontFamily, 'mono'); // invalid enum falls back
  assert.equal(normalized.template_json.tokenClaimSlip.enabled, true); // non-bool falls back to default true
});

test('normalizeTemplate: filters itemsTable columns and falls back if all invalid', () => {
  const emptyCols = normalizeTemplate({ itemsTable: { columns: [] } });
  assert.deepEqual(emptyCols.template_json.itemsTable.columns, ['name', 'qty', 'rate', 'amount']);

  const allInvalid = normalizeTemplate({ itemsTable: { columns: ['bad1', 'bad2'] } });
  assert.deepEqual(allInvalid.template_json.itemsTable.columns, ['name', 'qty', 'rate', 'amount']);
});

// ─── 6. Document HTML Wrapper Tests ──────────────────────────────────────────

test('renderReceiptHtmlDocument: creates full self-contained HTML with safe title', () => {
  const doc = renderReceiptHtmlDocument(
    '<div id="content">Receipt Content</div>',
    'Receipt <#101>',
    DEFAULT_TEMPLATE_JSON.layout,
    'thermal_80'
  );

  assert.ok(doc.startsWith('<!DOCTYPE html>'));
  assert.ok(doc.includes('<title>Receipt &lt;#101&gt;</title>'));
  assert.ok(doc.includes('@page { size: 80mm 297mm; margin: 0; }'));
  assert.ok(doc.includes('<div id="content">Receipt Content</div>'));
  assert.ok(doc.endsWith('</html>'));
});
