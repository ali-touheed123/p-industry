import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  generateOrderRef,
  computePackagingSummary,
  generateThermalOrderSlip,
  generateA4OrderSheet,
} from '@/components/inventory/orderSheetPrintTemplates';

// Helper to strip CSS (<style>...</style>) and HTML tags (<...>) to get visible text
function stripHtmlAndCss(html) {
  // Remove <style> blocks
  const noStyle = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // Remove HTML comments
  const noComments = noStyle.replace(/<!--[\s\S]*?-->/g, ' ');
  // Remove tags
  const noTags = noComments.replace(/<[^>]+>/g, ' ');
  // Replace HTML entities with spaces or characters
  const decoded = noTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Normalize whitespace
  return decoded.replace(/\s+/g, ' ').trim();
}

// ─── Test 1: Zero DB / Network / Storage Calls Audit ─────────────────────────
test('Audit: No network calls, supabase, or storage in new components', () => {
  const filesToCheck = [
    'src/components/inventory/orderSheetPrintTemplates.ts',
    'src/components/inventory/CompanyOrderSheetModal.tsx',
  ];

  const forbiddenPattern = /\b(supabase|fetch|localStorage|sessionStorage|axios|XMLHttpRequest)\b/i;

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const match = content.match(forbiddenPattern);
    assert.equal(
      match,
      null,
      `Forbidden keyword "${match?.[0]}" found in ${relPath}`
    );
  }
});

// ─── Test 2: Packaging Breakdown Dynamic Grouping ───────────────────────────
test('Packaging Breakdown: groups dynamically without hardcoded unit list', () => {
  const sampleItems = [
    { id: '1', code: 'P1', name: 'Paint A', brand: "GOBI'S", unit: 'Gallon', packSize: 'Gallon', qty: 12 },
    { id: '2', code: 'P2', name: 'Paint B', brand: "GOBI'S", unit: 'Quarter', packSize: 'Quarter', qty: 6 },
    { id: '3', code: 'P3', name: 'Paint C', brand: 'BERGER', unit: 'Drum', packSize: 'Drum', qty: 2 },
    { id: '4', code: 'P4', name: 'Roller', brand: 'ACCESSORIES', unit: 'PCS', packSize: 'PCS', qty: 4 },
    { id: '5', code: 'P5', name: 'Putty', brand: 'BRIGHTO', unit: 'KG', packSize: 'KG', qty: 10 },
  ];

  const summary = computePackagingSummary(sampleItems);
  assert.equal(summary.totalItems, 5);
  assert.equal(summary.totalPacks, 34);
  assert.equal(
    summary.breakdownText,
    '12 Gallon, 6 Quarter, 2 Drum, 4 PCS, 10 KG = 34 Total Packs'
  );
  assert.deepEqual(summary.breakdownMap, {
    Gallon: 12,
    Quarter: 6,
    Drum: 2,
    PCS: 4,
    KG: 10,
  });
});

// ─── Test 3: Order Reference Format (Asia/Karachi Timestamp) ────────────────
test('Order Ref: format DEM-YYYYMMDD-HHMM (Timestamp Ref)', () => {
  const ref = generateOrderRef();
  assert.match(ref, /^DEM-\d{8}-\d{4}$/, `Order ref "${ref}" must match DEM-YYYYMMDD-HHMM`);

  // Explicit midnight transition test with UTC ISO string (Asia/Karachi is UTC+5)
  // 2026-10-19T19:05:00Z + 5 hours = 2026-10-20T00:05:00 in Asia/Karachi
  // Confirms hourCycle: 'h23' yields "00" instead of "24"
  const midnightDate = new Date('2026-10-19T19:05:00Z');
  const midnightRef = generateOrderRef(midnightDate);
  assert.equal(midnightRef, 'DEM-20261020-0005', 'Must correctly format midnight as 0005 in Asia/Karachi');
});

// ─── Test 4: Zero-Price Automated Check (Decision 10) ────────────────────────
test('Zero-Price Automated Check: visible text contains zero financial terms', () => {
  const sampleData = {
    tenantName: 'Al-Madina Paint & Hardware Store <HQ>',
    orderRef: 'DEM-20261020-0730',
    dateStr: '2026-10-20',
    timeStr: '07:30 AM',
    notes: 'Urgent company delivery required by noon for site project & contractor.',
    items: [
      { id: '1', code: 'GOB-001', name: 'Silksheen Emulsion & Finish', brand: "GOBI'S", unit: 'Gallon', packSize: 'Gallon', shadeCode: 'Super White <101>', qty: 12 },
      { id: '2', code: 'GOB-002', name: 'Silksheen Primer "Glossy"', brand: "GOBI'S", unit: 'Quarter', packSize: 'Quarter', shadeCode: 'Off-White', qty: 6 },
      { id: '3', code: 'BER-101', name: 'WeatherCoat All-Weather Protection', brand: 'BERGER', unit: 'Drum', packSize: 'Drum', qty: 2 },
      { id: '4', code: 'ACC-005', name: 'Special 4" Synthetic Roller Brush', brand: 'HARDWARE', unit: 'PCS', packSize: 'PCS', qty: 4 },
      { id: '5', code: 'BRI-909', name: 'Wall Putty Powder Bag', brand: 'BRIGHTO', unit: 'KG', packSize: 'KG', qty: 10 },
    ],
  };

  const forbiddenPriceRegex = /\b(price|cost|rate|tax|amount|discount)\b/i;

  // 1. Thermal 80mm
  const thermal80Html = generateThermalOrderSlip(sampleData, 80);
  const textThermal80 = stripHtmlAndCss(thermal80Html);
  const matchT80 = textThermal80.match(forbiddenPriceRegex);
  assert.equal(
    matchT80,
    null,
    `Forbidden price term "${matchT80?.[0]}" found in Thermal 80mm visible text: "${textThermal80}"`
  );

  // 2. Thermal 58mm
  const thermal58Html = generateThermalOrderSlip(sampleData, 58);
  const textThermal58 = stripHtmlAndCss(thermal58Html);
  const matchT58 = textThermal58.match(forbiddenPriceRegex);
  assert.equal(
    matchT58,
    null,
    `Forbidden price term "${matchT58?.[0]}" found in Thermal 58mm visible text`
  );

  // 3. A4 Sheet
  const a4Html = generateA4OrderSheet(sampleData);
  const textA4 = stripHtmlAndCss(a4Html);
  const matchA4 = textA4.match(forbiddenPriceRegex);
  assert.equal(
    matchA4,
    null,
    `Forbidden price term "${matchA4?.[0]}" found in A4 Sheet visible text: "${textA4}"`
  );
});

// ─── Test 5: Escaping of Dangerous Strings & Special Characters ───────────────
test('HTML Escaping: ensures <, >, &, and " are escaped in rendered outputs', () => {
  const maliciousData = {
    tenantName: 'Dangerous <script>alert(1)</script> & Sons "Paints"',
    orderRef: 'DEM-20261020-0000',
    dateStr: '2026-10-20',
    timeStr: '12:00 PM',
    notes: 'Test <img src=x onerror=alert(1)> & special "notes"',
    items: [
      {
        id: 'xss-1',
        code: '<CODE-1>',
        name: 'Paint & Thinner <Special Edition> "Ultra"',
        brand: 'BRAND & CO <PRO>',
        unit: '<Gallon>',
        packSize: '<Gallon>',
        shadeCode: '<SH-001 & 002>',
        qty: 5,
      },
    ],
  };

  const thermalHtml = generateThermalOrderSlip(maliciousData, 80);
  assert.ok(!thermalHtml.includes('<script>'), 'Thermal output must not contain raw unescaped <script>');
  assert.ok(!thermalHtml.includes('<img src=x'), 'Thermal output must not contain unescaped <img>');
  assert.ok(thermalHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(thermalHtml.includes('Dangerous &lt;script&gt;alert(1)&lt;/script&gt; &amp; Sons &quot;Paints&quot;'));
  assert.ok(thermalHtml.includes('&lt;CODE-1&gt;'));
  assert.ok(thermalHtml.includes('&lt;SH-001 &amp; 002&gt;'));

  const a4Html = generateA4OrderSheet(maliciousData);
  assert.ok(!a4Html.includes('<script>'), 'A4 output must not contain raw unescaped <script>');
  assert.ok(a4Html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(a4Html.includes('&lt;CODE-1&gt;'));
});

// ─── Test 6: A4 Header Specification (Decision 5) ─────────────────────────────
test('A4 Header: shows tenantName only, blank write-in lines for Phone and Address', () => {
  const data = {
    tenantName: 'TPH Paint Store',
    orderRef: 'DEM-20261020-0745',
    dateStr: '2026-10-20',
    timeStr: '07:45 AM',
    items: [
      { id: '1', code: 'P1', name: 'Gloss Enamel', brand: 'GOBI', unit: 'Gallon', qty: 3 },
    ],
  };

  const a4Html = generateA4OrderSheet(data);
  assert.ok(a4Html.includes('TPH Paint Store'), 'Must include tenantName');
  assert.ok(a4Html.includes('Phone: <span class="a4-write-in-field"></span>'), 'Must have write-in blank field for Phone');
  assert.ok(a4Html.includes('Address / City: <span class="a4-write-in-field"></span>'), 'Must have write-in blank field for Address');
});
