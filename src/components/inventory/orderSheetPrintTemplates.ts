import { escapeHtml } from '@/utils/receiptRenderCore';

export interface OrderSheetLineItem {
  id: string;
  code: string;
  name: string;
  brand: string;
  unit: string;
  packSize?: string;
  shadeCode?: string | null;
  qty: number;
}

export interface OrderSheetData {
  tenantName: string;
  orderRef: string;
  dateStr: string;
  timeStr: string;
  notes?: string;
  items: OrderSheetLineItem[];
}

/**
 * Generate a non-persistent timestamp reference in Asia/Karachi (Local)
 * Format: DEM-YYYYMMDD-HHMM
 */
export function generateOrderRef(date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const yr = getPart('year');
    const mo = getPart('month');
    const da = getPart('day');
    const hr = getPart('hour');
    const mi = getPart('minute');
    if (yr && mo && da && hr && mi) {
      return `DEM-${yr}${mo}${da}-${hr}${mi}`;
    }
  } catch {
    // Fallback if DateTimeFormat timeZone option fails
  }

  // Local fallback
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `DEM-${y}${m}${d}-${h}${min}`;
}

/**
 * Dynamically group order items by packaging unit label
 * e.g. "12 Gallon, 6 Quarter, 2 Drum, 4 PCS, 10 KG = 34 Total Packs"
 */
export function computePackagingSummary(items: OrderSheetLineItem[]): {
  totalItems: number;
  totalPacks: number;
  breakdownText: string;
  breakdownMap: Record<string, number>;
} {
  const activeItems = items.filter((it) => it.qty > 0);
  const totalItems = activeItems.length;
  const breakdownMap: Record<string, number> = {};
  let totalPacks = 0;

  for (const it of activeItems) {
    const unitLabel = (it.packSize || it.unit || 'Pack').trim();
    const count = it.qty;
    breakdownMap[unitLabel] = (breakdownMap[unitLabel] || 0) + count;
    totalPacks += count;
  }

  const parts = Object.entries(breakdownMap).map(
    ([unit, count]) => `${count} ${unit}`
  );

  const breakdownText =
    parts.length > 0
      ? `${parts.join(', ')} = ${totalPacks} Total Packs`
      : '0 Total Packs';

  return {
    totalItems,
    totalPacks,
    breakdownText,
    breakdownMap,
  };
}

/**
 * Generate 80mm or 58mm Thermal Demand Slip HTML
 * HARD RULE: Zero references to price, cost, rate, tax, amount, discount.
 */
export function generateThermalOrderSlip(
  data: OrderSheetData,
  widthMm: 80 | 58 = 80
): string {
  const activeItems = data.items.filter((it) => it.qty > 0);
  const summary = computePackagingSummary(activeItems);

  // Group by Brand
  const brands = [...new Set(activeItems.map((it) => (it.brand || 'General').trim()))];
  const isMultiBrand = brands.length > 1;

  // Group items by brand
  const groupedByBrand = new Map<string, OrderSheetLineItem[]>();
  for (const it of activeItems) {
    const b = (it.brand || 'General').trim();
    if (!groupedByBrand.has(b)) groupedByBrand.set(b, []);
    groupedByBrand.get(b)!.push(it);
  }

  const printableWidth = widthMm === 58 ? '54mm' : '76mm';
  const fontSize = widthMm === 58 ? '10px' : '11px';
  const smallFontSize = widthMm === 58 ? '9px' : '9.5px';

  let tableRowsHtml = '';

  for (const [brandName, brandItems] of groupedByBrand.entries()) {
    if (isMultiBrand) {
      tableRowsHtml += `
        <tr style="background:#f4f4f4">
          <td colspan="4" style="padding:4px 0;font-weight:900;font-size:${smallFontSize};text-transform:uppercase;border-top:1px solid #000;border-bottom:1px solid #000;">
            &bull; BRAND: ${escapeHtml(brandName)} (${brandItems.length} items)
          </td>
        </tr>`;
    }

    for (const it of brandItems) {
      const codeStr = escapeHtml(it.code || '—');
      const nameStr = escapeHtml(it.name);
      const shadeStr = it.shadeCode ? `<span style="font-size:${smallFontSize};color:#333"> [${escapeHtml(it.shadeCode)}]</span>` : '';
      const packStr = escapeHtml(it.packSize || it.unit || 'Pack');
      const qtyStr = it.qty;

      tableRowsHtml += `
        <tr style="border-bottom:1px dashed #ddd">
          <td style="padding:3px 2px;font-weight:700;font-family:monospace;white-space:nowrap">${codeStr}</td>
          <td style="padding:3px 2px;line-height:1.2">${nameStr}${shadeStr}</td>
          <td style="padding:3px 2px;text-align:center;white-space:nowrap">${packStr}</td>
          <td style="padding:3px 2px;text-align:right;font-weight:900;white-space:nowrap;font-size:1.05em">${qtyStr}</td>
        </tr>`;
    }
  }

  const notesHtml = data.notes?.trim()
    ? `<div style="margin-top:6px;padding:4px;border:1px dashed #000;font-size:${smallFontSize};">
         <strong>Note:</strong> ${escapeHtml(data.notes.trim())}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.orderRef)}</title>
<style>
  @page {
    margin: 0;
    size: ${widthMm}mm auto;
  }
  * {
    box-sizing: border-box;
  }
  body {
    width: ${printableWidth};
    margin: 0 auto;
    padding: 3mm 1mm;
    font-family: 'Courier New', Courier, monospace, sans-serif;
    font-size: ${fontSize};
    color: #000000;
    background: #ffffff;
    line-height: 1.25;
  }
  .slip-header {
    text-align: center;
    border-bottom: 1.5px dashed #000000;
    padding-bottom: 5px;
    margin-bottom: 6px;
  }
  .slip-store-title {
    font-size: 14px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 2px 0;
  }
  .slip-doc-badge {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1px;
    margin: 2px 0;
  }
  .slip-meta {
    font-size: ${smallFontSize};
    color: #222222;
    margin-top: 2px;
  }
  .slip-meta-ref {
    font-size: ${smallFontSize};
    font-weight: 700;
    margin-top: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
  }
  th {
    text-align: left;
    font-size: ${smallFontSize};
    font-weight: 900;
    border-bottom: 1px solid #000000;
    padding: 3px 2px;
  }
  .slip-summary-box {
    border-top: 1.5px dashed #000000;
    border-bottom: 1px dashed #000000;
    margin-top: 8px;
    padding: 5px 2px;
    font-size: ${fontSize};
  }
  .slip-sign-row {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    font-size: ${smallFontSize};
    padding-top: 14px;
  }
  .slip-sign-line {
    border-top: 1px solid #000000;
    width: 45%;
    text-align: center;
    padding-top: 2px;
  }
</style>
</head>
<body>
  <div class="slip-header">
    <div class="slip-store-title">${escapeHtml(data.tenantName || 'PyntFlow Store')}</div>
    <div class="slip-doc-badge">COMPANY DEMAND SLIP</div>
    <div class="slip-meta-ref">Ref: ${escapeHtml(data.orderRef)} <span style="font-weight:normal">(Timestamp Ref)</span></div>
    <div class="slip-meta">Date: ${escapeHtml(data.dateStr)} &bull; ${escapeHtml(data.timeStr)}</div>
    <div class="slip-meta">Company: <strong>${escapeHtml(brands.join(', ') || 'All Brands')}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:24%">CODE</th>
        <th style="width:46%">ITEM / SHADE</th>
        <th style="width:18%;text-align:center">PACK</th>
        <th style="width:12%;text-align:right">QTY</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="slip-summary-box">
    <div style="display:flex;justify-content:space-between;font-weight:900">
      <span>Total Unique Items:</span>
      <span>${summary.totalItems}</span>
    </div>
    <div style="margin-top:3px;font-size:${smallFontSize}">
      <strong>Breakdown:</strong> ${escapeHtml(summary.breakdownText)}
    </div>
  </div>

  ${notesHtml}

  <div class="slip-sign-row">
    <div class="slip-sign-line">Order Given By</div>
    <div class="slip-sign-line">Booker Signature</div>
  </div>
</body>
</html>`;
}

/**
 * Generate A4 Formal Purchase Demand Sheet HTML
 * HARD RULE: Zero references to price, cost, rate, tax, amount, discount.
 * Uses shop name only, with blank write-in lines for phone and address.
 */
export function generateA4OrderSheet(data: OrderSheetData): string {
  const activeItems = data.items.filter((it) => it.qty > 0);
  const summary = computePackagingSummary(activeItems);

  // Group by Brand
  const brands = [...new Set(activeItems.map((it) => (it.brand || 'General').trim()))];
  const isMultiBrand = brands.length > 1;

  const groupedByBrand = new Map<string, OrderSheetLineItem[]>();
  for (const it of activeItems) {
    const b = (it.brand || 'General').trim();
    if (!groupedByBrand.has(b)) groupedByBrand.set(b, []);
    groupedByBrand.get(b)!.push(it);
  }

  let tableRowsHtml = '';
  let lineIdx = 1;

  for (const [brandName, brandItems] of groupedByBrand.entries()) {
    if (isMultiBrand) {
      tableRowsHtml += `
        <tr style="background:#e2e8f0;font-weight:bold">
          <td colspan="5" style="padding:6px 10px;text-transform:uppercase;font-size:12px;color:#1e293b;border:1px solid #cbd5e1">
            BRAND: ${escapeHtml(brandName)} (${brandItems.length} Products)
          </td>
        </tr>`;
    }

    for (const it of brandItems) {
      const codeStr = escapeHtml(it.code || '—');
      const nameStr = escapeHtml(it.name);
      const shadeStr = it.shadeCode ? `<span style="color:#64748b;font-size:11px"> &bull; Shade: ${escapeHtml(it.shadeCode)}</span>` : '';
      const packStr = escapeHtml(it.packSize || it.unit || 'Pack');
      const qtyStr = it.qty;

      const bg = lineIdx % 2 === 0 ? '#f8fafc' : '#ffffff';

      tableRowsHtml += `
        <tr style="background:${bg}">
          <td style="padding:6px 8px;text-align:center;border:1px solid #e2e8f0;font-size:11px;color:#64748b">${lineIdx++}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;font-size:12px;color:#0f172a">${codeStr}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;color:#0f172a">${nameStr}${shadeStr}</td>
          <td style="padding:6px 8px;text-align:center;border:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#334155">${packStr}</td>
          <td style="padding:6px 12px;text-align:right;border:1px solid #e2e8f0;font-size:13px;font-weight:900;color:#0f172a">${qtyStr}</td>
        </tr>`;
    }
  }

  const notesSection = data.notes?.trim()
    ? `<div style="margin-top:16px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;font-size:12px">
         <strong>Special Instructions / Notes:</strong> ${escapeHtml(data.notes.trim())}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Company Order Sheet - ${escapeHtml(data.orderRef)}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 12mm 15mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.4;
  }
  .a4-header {
    border-bottom: 2px solid #0f172a;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .a4-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .a4-store-name {
    font-size: 22px;
    font-weight: 900;
    text-transform: uppercase;
    color: #0f172a;
    letter-spacing: 0.5px;
    margin: 0 0 4px 0;
  }
  .a4-doc-badge {
    display: inline-block;
    background: #0f172a;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 3px;
    text-transform: uppercase;
  }
  .a4-write-in-lines {
    margin-top: 6px;
    font-size: 11px;
    color: #475569;
  }
  .a4-write-in-field {
    border-bottom: 1px solid #94a3b8;
    display: inline-block;
    width: 220px;
    height: 14px;
    margin-right: 14px;
  }
  .a4-meta-box {
    text-align: right;
    font-size: 11px;
    color: #334155;
    line-height: 1.5;
  }
  .a4-meta-ref {
    font-size: 12px;
    font-weight: 800;
    color: #0f172a;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th {
    background: #0f172a;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px;
    border: 1px solid #0f172a;
  }
  .a4-summary-panel {
    margin-top: 16px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #f1f5f9;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .a4-signatures {
    margin-top: 45px;
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
  }
  .a4-sign-box {
    width: 220px;
    border-top: 1.5px solid #0f172a;
    text-align: center;
    padding-top: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #334155;
  }
</style>
</head>
<body>
  <div class="a4-header">
    <div class="a4-top-row">
      <div>
        <div class="a4-store-name">${escapeHtml(data.tenantName || 'PyntFlow Store')}</div>
        <div class="a4-doc-badge">Official Company Purchase Demand Sheet</div>
        <div class="a4-write-in-lines">
          Phone: <span class="a4-write-in-field"></span>
          Address / City: <span class="a4-write-in-field"></span>
        </div>
      </div>
      <div class="a4-meta-box">
        <div class="a4-meta-ref">Ref: ${escapeHtml(data.orderRef)}</div>
        <div><small>(Timestamp Ref)</small></div>
        <div>Date: <strong>${escapeHtml(data.dateStr)}</strong> &bull; ${escapeHtml(data.timeStr)}</div>
        <div>Target Company: <strong>${escapeHtml(brands.join(', ') || 'All Brands')}</strong></div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%;text-align:center">#</th>
        <th style="width:18%;text-align:left">Item Code</th>
        <th style="width:47%;text-align:left">Description & Shade</th>
        <th style="width:15%;text-align:center">Packing</th>
        <th style="width:15%;text-align:right">Order Qty</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="a4-summary-panel">
    <div>
      <span style="font-weight:800;font-size:13px">Total Unique Products: ${summary.totalItems}</span>
      <div style="font-size:12px;color:#475569;margin-top:2px">
        <strong>Breakdown:</strong> ${escapeHtml(summary.breakdownText)}
      </div>
    </div>
    <div style="text-align:right;font-size:15px;font-weight:900;color:#0f172a">
      ${summary.totalPacks} Packs Total
    </div>
  </div>

  ${notesSection}

  <div class="a4-signatures">
    <div class="a4-sign-box">
      Authorized Signature (Store)
      <div style="font-weight:normal;color:#64748b;font-size:10px;margin-top:2px">Prepared By</div>
    </div>
    <div class="a4-sign-box">
      Company Representative / Booker
      <div style="font-weight:normal;color:#64748b;font-size:10px;margin-top:2px">Received By & Date</div>
    </div>
  </div>
</body>
</html>`;
}
