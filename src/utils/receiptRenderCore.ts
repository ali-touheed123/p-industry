/**
 * ─── Receipt Rendering Core Utilities ──────────────────────────────────────
 * Pure, framework-agnostic helper functions for receipt template normalization,
 * HTML entity escaping, safe URL validation, CSS generation, and document wrapping.
 *
 * Designed for PyntFlow POS & Industrial ERP (Phase 1).
 * Strictly zero dependencies; runs in both Node.js (test runner) and browser/Next.js.
 */

import {
  DEFAULT_TEMPLATE_JSON,
  BLANK_SPECIAL_TEMPLATE_JSON,
  PAPER_SIZE_CONFIG,
} from '@/types/receipt';
import type {
  FooterConfig,
  HeaderConfig,
  InvoiceInfoConfig,
  ItemsTableConfig,
  LayoutConfig,
  PaperSize,
  TableColumnId,
  TemplateJson,
  TokenClaimSlipConfig,
  TotalsConfig,
} from '@/types/receipt';

// ─── Types & Contracts ───────────────────────────────────────────────────────

export interface NormalizedTemplateJson extends TemplateJson {
  tokenClaimSlip: TokenClaimSlipConfig;
}

export interface NormalizedReceiptTemplate {
  paper_size: PaperSize;
  template_json: NormalizedTemplateJson;
}

export const VALID_PAPER_SIZES: readonly PaperSize[] = [
  'thermal_80',
  'thermal_58',
  'a4',
  'a5',
] as const;

export const VALID_COLUMN_IDS: readonly TableColumnId[] = [
  'name',
  'code',
  'qty',
  'rate',
  'discount',
  'amount',
] as const;

export const FONT_STACK_MAP: Record<'mono' | 'sans' | 'serif', string> = {
  mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
};

// ─── Pure Security & Escaping Helpers ────────────────────────────────────────

/**
 * Escapes HTML entity characters (&, <, >, ", ') to prevent XSS / HTML injection.
 * Safely handles null, undefined, numbers, and strings.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates image URLs for logos and QR codes.
 *
 * Security Rules:
 * 1. Rejects null, undefined, non-strings, and empty strings.
 * 2. Rejects any string containing whitespace, quotes, angle brackets, or control characters.
 * 3. EXPLICITLY BLOCKS SVG data URIs (data:image/svg+xml) to prevent embedded script injection.
 * 4. Whitelists:
 *    - Valid HTTPS URLs (https://...)
 *    - Local development HTTP URLs (http://localhost or http://127.0.0.1)
 *    - Safe root-relative paths (e.g. /logo.png)
 *    - Strictly raster base64 data URIs: data:image/(png|jpeg|jpg|webp|gif);base64,...
 *
 * Returns the sanitized URL string if valid, or null if invalid.
 */
export function validateImageUrl(url?: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Reject strings with dangerous characters or spaces
  if (/[\s"'<>\\]/.test(trimmed)) return null;

  // Whitelist standard HTTPS
  if (/^https:\/\/[a-zA-Z0-9_\-\.:@%?&=#/]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Whitelist local development HTTP (localhost or 127.0.0.1 only)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?(\/[a-zA-Z0-9_\-\.:@%?&=#/]*)?$/i.test(trimmed)) {
    return trimmed;
  }

  // Whitelist safe relative root paths (e.g. /logo.png, /assets/logo.png)
  if (/^\/[a-zA-Z0-9_\-\./%]+\.(png|jpe?g|webp|gif|ico)$/i.test(trimmed)) {
    return trimmed;
  }

  // Whitelist strictly raster base64 data URIs (PNG, JPEG, WEBP, GIF only — NO SVG)
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// ─── Numeric Clamping & Validation Helpers ───────────────────────────────────

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseBoolean(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

function parseString(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed !== '' ? trimmed : fallback;
}

// ─── CSS Generation Helpers ──────────────────────────────────────────────────

export function getFontStack(fontFamily?: unknown): string {
  if (fontFamily === 'sans') return FONT_STACK_MAP.sans;
  if (fontFamily === 'serif') return FONT_STACK_MAP.serif;
  return FONT_STACK_MAP.mono;
}

export function getSeparatorCss(separator?: unknown): string {
  if (separator === 'none') return 'border-bottom: none;';
  if (separator === 'solid') return 'border-bottom: 1px solid #000;';
  if (separator === 'double') return 'border-bottom: 3px double #000;';
  return 'border-bottom: 1px dashed #000;';
}

/**
 * Generates print CSS document styles tailored for thermal roll vs cut-sheet paper.
 */
export function buildReceiptPageCss(layout: LayoutConfig, paperSize: PaperSize): string {
  const validPaperSize: PaperSize = VALID_PAPER_SIZES.includes(paperSize) ? paperSize : 'thermal_80';
  const sizeConfig = PAPER_SIZE_CONFIG[validPaperSize] || PAPER_SIZE_CONFIG.thermal_80;
  const isThermal = validPaperSize.startsWith('thermal');

  const widthMm = sizeConfig.widthMm;
  const fontStack = getFontStack(layout.fontFamily);
  const fontSize = clampNumber(layout.fontSize, 8, 24, 12);
  const scale = clampNumber(layout.scale, 0.5, 1.5, 1);

  const marginTop = clampNumber(layout.marginTop, 0, 50, 4);
  const marginRight = clampNumber(layout.marginRight, 0, 50, 4);
  const marginBottom = clampNumber(layout.marginBottom, 0, 50, 6);
  const marginLeft = clampNumber(layout.marginLeft, 0, 50, 4);

  // Thermal roll: initial @page uses 297mm as a safe CSS fallback; a small inline
  // script in the document body dynamically overrides this to the exact content height,
  // eliminating the blank whitespace at the bottom of the printed receipt.
  // Sheet paper: standard A4 or A5 portrait — no dynamic sizing needed.
  const pageRule = isThermal
    ? `@page { size: ${widthMm}mm 297mm; margin: 0; }`
    : `@page { size: ${validPaperSize.toUpperCase()} portrait; margin: 0; }`;

  const scaleRule = scale !== 1 ? `transform: scale(${scale}); transform-origin: top center;` : '';

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${pageRule}
    html, body {
      background: #fff;
      color: #000;
      font-family: ${fontStack};
      font-size: ${fontSize}px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      width: ${widthMm}mm;
      max-width: ${widthMm}mm;
      margin: 0 auto;
      padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
      ${scaleRule}
    }
    @media print {
      @page {
        margin: 0;
      }
      html, body {
        height: auto !important;
        overflow: visible !important;
        margin: 0 auto !important;
        padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      div, table, tr, p, h2, span {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `.trim();
}

// ─── Deep Template Normalization ─────────────────────────────────────────────

/**
 * Deeply normalizes untrusted runtime JSON into a guaranteed-valid template structure.
 * Applies field-by-field safe fallbacks, whitelisting, numeric clamping, and legacy compatibility.
 */
export function normalizeTemplate(
  rawTemplate: unknown,
  paperSize?: unknown,
  fallbackTemplate?: TemplateJson
): NormalizedReceiptTemplate {
  const d = fallbackTemplate ?? DEFAULT_TEMPLATE_JSON;
  const rawInput = (typeof rawTemplate === 'object' && rawTemplate !== null)
    ? (rawTemplate as Record<string, any>)
    : {};
  const rawObj = (rawInput.template_json && typeof rawInput.template_json === 'object')
    ? rawInput.template_json
    : rawInput;

  // 1. Paper Size
  const chosenPaperSize = paperSize ?? rawInput.paper_size ?? rawObj.paper_size;
  const normalizedPaperSize: PaperSize = (typeof chosenPaperSize === 'string' && (VALID_PAPER_SIZES as readonly string[]).includes(chosenPaperSize))
    ? (chosenPaperSize as PaperSize)
    : 'thermal_80';

  // 2. Header Section
  const rawHeader = (typeof rawObj.header === 'object' && rawObj.header !== null) ? rawObj.header : {};
  const header: HeaderConfig = {
    showLogo: parseBoolean(rawHeader.showLogo, d.header.showLogo),
    logoUrl: validateImageUrl(rawHeader.logoUrl) ?? '',
    logoSize: clampNumber(rawHeader.logoSize, 16, 200, d.header.logoSize),
    align: (['left', 'center', 'right'].includes(rawHeader.align)) ? rawHeader.align : d.header.align,
    showShopName: parseBoolean(rawHeader.showShopName, d.header.showShopName),
    customShopName: typeof rawHeader.customShopName === 'string' ? rawHeader.customShopName.trim() : '',
    shopNameSize: clampNumber(rawHeader.shopNameSize, 8, 36, d.header.shopNameSize ?? 15),
    shopNameUppercase: parseBoolean(rawHeader.shopNameUppercase, d.header.shopNameUppercase ?? true),
    shopNameLetterSpacing: clampNumber(rawHeader.shopNameLetterSpacing, 0, 5, d.header.shopNameLetterSpacing ?? 0.05),
    showAddress: parseBoolean(rawHeader.showAddress, d.header.showAddress),
    customAddress: typeof rawHeader.customAddress === 'string' ? rawHeader.customAddress.trim() : '',
    addressSize: clampNumber(rawHeader.addressSize, 7, 24, d.header.addressSize ?? 10),
    showPhone: parseBoolean(rawHeader.showPhone, d.header.showPhone),
    customPhone: typeof rawHeader.customPhone === 'string' ? rawHeader.customPhone.trim() : '',
    phonePrefix: typeof rawHeader.phonePrefix === 'string' ? rawHeader.phonePrefix : (d.header.phonePrefix ?? 'Tel:'),
    phoneSize: clampNumber(rawHeader.phoneSize, 7, 24, d.header.phoneSize ?? 10),
    separator: (['none', 'solid', 'dashed', 'double'].includes(rawHeader.separator)) ? rawHeader.separator : d.header.separator,
  };

  // 3. Invoice Info Section
  const rawInfo = (typeof rawObj.invoiceInfo === 'object' && rawObj.invoiceInfo !== null) ? rawObj.invoiceInfo : {};
  const invoiceInfo: InvoiceInfoConfig = {
    // T-19 (Option A): Invoice Number is mandatory for legal and audit compliance; cannot be hidden
    showInvoiceNo: true,
    invoiceLabel: parseString(rawInfo.invoiceLabel, d.invoiceInfo.invoiceLabel),
    showDate: parseBoolean(rawInfo.showDate, d.invoiceInfo.showDate),
    dateLabel: typeof rawInfo.dateLabel === 'string' ? rawInfo.dateLabel : d.invoiceInfo.dateLabel,
    showCashier: parseBoolean(rawInfo.showCashier, d.invoiceInfo.showCashier),
    cashierLabel: typeof rawInfo.cashierLabel === 'string' ? rawInfo.cashierLabel : d.invoiceInfo.cashierLabel,
    showCustomer: parseBoolean(rawInfo.showCustomer, d.invoiceInfo.showCustomer),
    customerLabel: typeof rawInfo.customerLabel === 'string' ? rawInfo.customerLabel : d.invoiceInfo.customerLabel,
    showPaymentMethod: parseBoolean(rawInfo.showPaymentMethod, d.invoiceInfo.showPaymentMethod),
    paymentLabel: typeof rawInfo.paymentLabel === 'string' ? rawInfo.paymentLabel : d.invoiceInfo.paymentLabel,
    fontSize: clampNumber(rawInfo.fontSize, 7, 24, d.invoiceInfo.fontSize ?? 10.5),
  };

  // 4. Items Table Section
  const rawTable = (typeof rawObj.itemsTable === 'object' && rawObj.itemsTable !== null) ? rawObj.itemsTable : {};
  let columns: TableColumnId[] = [];
  if (Array.isArray(rawTable.columns)) {
    columns = rawTable.columns.filter((c: any): c is TableColumnId =>
      typeof c === 'string' && (VALID_COLUMN_IDS as readonly string[]).includes(c)
    );
  }
  if (columns.length === 0) {
    columns = [...d.itemsTable.columns];
  }

  const itemsTable: ItemsTableConfig = {
    columns,
    fontSize: clampNumber(rawTable.fontSize, 8, 20, d.itemsTable.fontSize),
    rowPadding: clampNumber(rawTable.rowPadding, 0, 20, d.itemsTable.rowPadding),
    compact: parseBoolean(rawTable.compact, d.itemsTable.compact),
    showBorders: parseBoolean(rawTable.showBorders, d.itemsTable.showBorders),
    colLabelCode: typeof rawTable.colLabelCode === 'string' ? rawTable.colLabelCode : d.itemsTable.colLabelCode,
    colLabelName: typeof rawTable.colLabelName === 'string' ? rawTable.colLabelName : d.itemsTable.colLabelName,
    colLabelQty: typeof rawTable.colLabelQty === 'string' ? rawTable.colLabelQty : d.itemsTable.colLabelQty,
    colLabelRate: typeof rawTable.colLabelRate === 'string' ? rawTable.colLabelRate : d.itemsTable.colLabelRate,
    colLabelDiscount: typeof rawTable.colLabelDiscount === 'string' ? rawTable.colLabelDiscount : d.itemsTable.colLabelDiscount,
    colLabelAmount: typeof rawTable.colLabelAmount === 'string' ? rawTable.colLabelAmount : d.itemsTable.colLabelAmount,
  };

  // 5. Totals Section
  const rawTotals = (typeof rawObj.totals === 'object' && rawObj.totals !== null) ? rawObj.totals : {};
  const totals: TotalsConfig = {
    showSubtotal: parseBoolean(rawTotals.showSubtotal, d.totals.showSubtotal),
    showDiscount: parseBoolean(rawTotals.showDiscount, d.totals.showDiscount),
    showGst: parseBoolean(rawTotals.showGst, d.totals.showGst),
    gstRate: clampNumber(rawTotals.gstRate, 0, 100, 0),
    // T-19 (Option A): Grand Total is mandatory for commercial dispute resolution; cannot be hidden
    showGrandTotal: true,
    showPaid: parseBoolean(rawTotals.showPaid, d.totals.showPaid),
    showBalance: parseBoolean(rawTotals.showBalance, d.totals.showBalance),
    boldTotal: parseBoolean(rawTotals.boldTotal, d.totals.boldTotal),
    highlightBalanceDue: parseBoolean(rawTotals.highlightBalanceDue, d.totals.highlightBalanceDue),
    currencySymbol: parseString(rawTotals.currencySymbol, d.totals.currencySymbol),
    fontSize: clampNumber(rawTotals.fontSize, 7, 24, d.totals.fontSize ?? 11),
    grandTotalFontSize: clampNumber(rawTotals.grandTotalFontSize, 8, 30, d.totals.grandTotalFontSize ?? 13),
    subtotalLabel: typeof rawTotals.subtotalLabel === 'string' ? rawTotals.subtotalLabel : d.totals.subtotalLabel,
    discountLabel: typeof rawTotals.discountLabel === 'string' ? rawTotals.discountLabel : d.totals.discountLabel,
    deliveryLabel: typeof rawTotals.deliveryLabel === 'string' ? rawTotals.deliveryLabel : d.totals.deliveryLabel,
    netTotalLabel: typeof rawTotals.netTotalLabel === 'string' ? rawTotals.netTotalLabel : d.totals.netTotalLabel,
    paidLabel: typeof rawTotals.paidLabel === 'string' ? rawTotals.paidLabel : d.totals.paidLabel,
    changeLabel: typeof rawTotals.changeLabel === 'string' ? rawTotals.changeLabel : d.totals.changeLabel,
    balanceDueLabel: typeof rawTotals.balanceDueLabel === 'string' ? rawTotals.balanceDueLabel : d.totals.balanceDueLabel,
  };

  // 6. Footer Section
  const rawFooter = (typeof rawObj.footer === 'object' && rawObj.footer !== null) ? rawObj.footer : {};
  const footer: FooterConfig = {
    line1: typeof rawFooter.line1 === 'string' ? rawFooter.line1.trim() : d.footer.line1,
    line1Size: clampNumber(rawFooter.line1Size, 6, 24, d.footer.line1Size ?? 9.5),
    line2: typeof rawFooter.line2 === 'string' ? rawFooter.line2.trim() : d.footer.line2,
    line2Size: clampNumber(rawFooter.line2Size, 6, 24, d.footer.line2Size ?? 9),
    align: (['left', 'center', 'right'].includes(rawFooter.align)) ? rawFooter.align : (d.footer.align ?? 'center'),
    showWhatsapp: parseBoolean(rawFooter.showWhatsapp, d.footer.showWhatsapp),
    whatsappNumber: typeof rawFooter.whatsappNumber === 'string' ? rawFooter.whatsappNumber.trim() : '',
    whatsappLabel: typeof rawFooter.whatsappLabel === 'string' ? rawFooter.whatsappLabel : (d.footer.whatsappLabel ?? 'WhatsApp:'),
    whatsappSize: clampNumber(rawFooter.whatsappSize, 6, 24, d.footer.whatsappSize ?? 9),
    showPoweredBy: parseBoolean(rawFooter.showPoweredBy, d.footer.showPoweredBy),
    poweredByText: typeof rawFooter.poweredByText === 'string' ? rawFooter.poweredByText.trim() : d.footer.poweredByText,
    showQrCode: parseBoolean(rawFooter.showQrCode, d.footer.showQrCode),
    qrCodeText: typeof rawFooter.qrCodeText === 'string' ? rawFooter.qrCodeText.trim() : '',
  };

  // 7. Layout Section
  const rawLayout = (typeof rawObj.layout === 'object' && rawObj.layout !== null) ? rawObj.layout : {};
  const layout: LayoutConfig = {
    marginTop: clampNumber(rawLayout.marginTop, 0, 50, d.layout.marginTop),
    marginBottom: clampNumber(rawLayout.marginBottom, 0, 50, d.layout.marginBottom),
    marginLeft: clampNumber(rawLayout.marginLeft, 0, 50, d.layout.marginLeft),
    marginRight: clampNumber(rawLayout.marginRight, 0, 50, d.layout.marginRight),
    fontSize: clampNumber(rawLayout.fontSize, 8, 24, d.layout.fontSize),
    fontFamily: (['mono', 'sans', 'serif'].includes(rawLayout.fontFamily)) ? rawLayout.fontFamily : d.layout.fontFamily,
    scale: clampNumber(rawLayout.scale, 0.5, 1.5, d.layout.scale),
  };

  // 8. Token Claim Slip Section (Legacy Fallback Guarantee)
  const defaultSlip: TokenClaimSlipConfig = d.tokenClaimSlip ?? {
    enabled: true,
    title: 'Token Claim Slip',
    instructions: 'Present this code on your next visit to redeem your token',
    footerNotice: 'Keep this receipt — code cannot be reissued',
    showDetails: true,
  };

  const rawSlip = (typeof rawObj.tokenClaimSlip === 'object' && rawObj.tokenClaimSlip !== null)
    ? rawObj.tokenClaimSlip
    : {};

  const tokenClaimSlip: TokenClaimSlipConfig = {
    enabled: parseBoolean(rawSlip.enabled, defaultSlip.enabled),
    title: parseString(rawSlip.title, defaultSlip.title),
    instructions: parseString(rawSlip.instructions, defaultSlip.instructions),
    footerNotice: parseString(rawSlip.footerNotice, defaultSlip.footerNotice),
    showDetails: parseBoolean(rawSlip.showDetails, defaultSlip.showDetails),
  };

  // 9. Locks
  const locks: Record<string, boolean> = {};
  if (typeof rawObj.locks === 'object' && rawObj.locks !== null) {
    for (const [k, v] of Object.entries(rawObj.locks)) {
      if (typeof v === 'boolean') {
        locks[k] = v;
      }
    }
  }

  return {
    paper_size: normalizedPaperSize,
    template_json: {
      header,
      invoiceInfo,
      itemsTable,
      totals,
      footer,
      layout,
      tokenClaimSlip,
      locks,
    },
  };
}

/**
  * Deeply normalizes a special receipt template ensuring blank-canvas defaults.
  * Guarantees zero identity leaks (no logo, no shop name, no address, no phone, no token slip).
  */
export function normalizeSpecialTemplate(
  rawTemplate: unknown,
  paperSize?: unknown
): NormalizedReceiptTemplate {
  return normalizeTemplate(rawTemplate, paperSize, BLANK_SPECIAL_TEMPLATE_JSON);
}

// ─── Document HTML Wrapper ───────────────────────────────────────────────────

/**
 * Wraps body HTML content into a full, self-contained HTML document with embedded CSS.
 *
 * For thermal paper sizes, an inline script is injected at the end of <body> to measure
 * the actual rendered content height and override the @page size to fit exactly. This
 * eliminates the blank trailing whitespace caused by the 297mm CSS fallback height.
 */
export function renderReceiptHtmlDocument(
  bodyHtml: string,
  title: string,
  layout: LayoutConfig,
  paperSize: PaperSize
): string {
  const safeTitle = escapeHtml(title || 'Receipt');
  const validPaperSize: PaperSize = VALID_PAPER_SIZES.includes(paperSize) ? paperSize : 'thermal_80';
  const isThermal = validPaperSize.startsWith('thermal');
  const widthMm = (PAPER_SIZE_CONFIG[validPaperSize] || PAPER_SIZE_CONFIG.thermal_80).widthMm;
  const css = buildReceiptPageCss(layout, paperSize);

  // For thermal receipts: measure content height after render and inject a precise
  // @page override to eliminate blank trailing space on the printed roll/preview.
  // Uses a buffer of 6mm (safety margin) so content is never clipped.
  const thermalFitScript = isThermal ? `
<script>
(function() {
  try {
    var b = document.body;
    var h = document.documentElement;
    var heightPx = Math.max(
      b ? b.scrollHeight : 0,
      b ? b.offsetHeight : 0,
      h ? h.scrollHeight : 0,
      h ? h.offsetHeight : 0
    );
    if (heightPx > 0) {
      var heightMm = Math.ceil(heightPx * 25.4 / 96) + 6;
      var s = document.createElement('style');
      s.setAttribute('data-thermal-fit', 'true');
      s.textContent = '@page { size: ${widthMm}mm ' + heightMm + 'mm; margin: 0; }';
      document.head.appendChild(s);
    }
  } catch(e) {}
})();
</script>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
${css}
  </style>
</head>
<body>
${bodyHtml}
${thermalFitScript}
</body>
</html>`.trim();
}

// ─── Data Contracts for Invoice Rendering ────────────────────────────────────

export interface RenderReceiptItem {
  name: string;
  code?: string;
  shadeCode?: string;
  qty: number;
  rate: number;
  discount?: number;
  total: number;
  tokenNote?: string;
}

export interface RenderReceiptPaymentSplit {
  cash?: number;
  card?: number;
  bank?: number;
  others?: number;
}

export interface RenderReceiptData {
  tenantName: string;
  tenantAddress?: string;
  tenantPhone?: string;
  invoiceType?: string; // 'sales' | 'return' | 'purchase' | 'purchase_return' — drives return banner
  invoiceNo?: string;
  date?: string;
  time?: string;
  clientName?: string;
  staffName?: string;
  paymentMethod?: string;
  items: RenderReceiptItem[];
  subTotal: number;
  discount?: number;
  deliveryCharge?: number;
  taxAmount?: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount?: number;
  changeReturned?: number;
  paymentSplits?: RenderReceiptPaymentSplit;
  tokenClaimCode?: string;
  tokenClaimDetails?: string;
  headerNote?: string;
  footerNote?: string;
  isReprint?: boolean;
}

/**
 * Renders the interior receipt body HTML snippet from normalized template & invoice data.
 */
export function renderReceiptBodyHtml(
  data: RenderReceiptData,
  template: NormalizedReceiptTemplate
): string {
  const { header, invoiceInfo, itemsTable, totals, footer, tokenClaimSlip, layout } = template.template_json;
  const fmt = (n: number) => Number(n || 0).toLocaleString();
  const cur = totals.currencySymbol || 'Rs.';

  // Base font size — all section fallbacks scale relative to this so the
  // "Base Font Size" slider in BranchReceiptSettings actually affects the output.
  const basePx = clampNumber(layout?.fontSize, 8, 24, 12);

  // 1. Header Block
  const logoHtml = (header.showLogo && header.logoUrl)
    ? `<div style="text-align:${header.align};margin-bottom:6px">
        <img src="${header.logoUrl}" alt="Logo" style="height:${header.logoSize}px;max-width:100%;object-fit:contain;display:inline-block" />
       </div>`
    : '';

  const shopNameTransform = header.shopNameUppercase !== false ? 'text-transform:uppercase;' : '';
  const shopNameSpacing = typeof header.shopNameLetterSpacing === 'number' ? `${header.shopNameLetterSpacing}em` : '0.05em';
  const shopNameSize = header.shopNameSize ?? 15;
  const addressSize = header.addressSize ?? 10;
  const phoneSize = header.phoneSize ?? 10;

  const shopNameHtml = header.showShopName
    ? `<h2 style="font-size:${shopNameSize}px;font-weight:900;${shopNameTransform}letter-spacing:${shopNameSpacing};margin:0 0 2px 0;color:#000">${escapeHtml(header.customShopName || data.tenantName || 'PyntFlow Store')}</h2>`
    : '';

  const effectiveAddress = header.customAddress?.trim() || data.tenantAddress?.trim() || 'Retail & Industrial Paint Hub';
  const addressHtml = header.showAddress
    ? `<p style="font-size:${addressSize}px;color:#000;margin:0">${escapeHtml(effectiveAddress)}</p>`
    : '';

  const effectivePhone = header.customPhone?.trim() || data.tenantPhone?.trim() || '';
  const phoneHtml = (header.showPhone && effectivePhone)
    ? `<p style="font-size:${phoneSize}px;color:#000;margin:2px 0 0 0">${escapeHtml(header.phonePrefix?.trim() || 'Tel:')} ${escapeHtml(effectivePhone)}</p>`
    : '';

  const reprintNoticeHtml = data.isReprint
    ? `<div style="font-size:10px;font-weight:800;color:#000;margin-top:3px;letter-spacing:0.05em">&#9851; DUPLICATE RECEIPT</div>`
    : '';

  const headerSeparatorCss = getSeparatorCss(header.separator);

  // Return invoice banner — shown for any invoice_type containing 'return'
  const invTypeLower = (data.invoiceType || '').toLowerCase();
  const isReturnInvoice = invTypeLower === 'return' || invTypeLower.includes('return');
  const returnBannerLabel = invTypeLower === 'purchase_return' ? 'PURCHASE RETURN' : 'SALES RETURN';
  const returnBannerHtml = isReturnInvoice
    ? `<div style="text-align:center;border:2px solid #000;padding:4px 8px;margin:6px 0;font-size:11px;font-weight:900;letter-spacing:0.08em;color:#000">&#8635; ${returnBannerLabel}</div>`
    : '';

  const headerSection = `
<div style="text-align:${header.align};padding-bottom:8px;margin-bottom:8px;${headerSeparatorCss}">
  ${logoHtml}
  ${shopNameHtml}
  ${addressHtml}
  ${phoneHtml}
  ${reprintNoticeHtml}
</div>
${returnBannerHtml}`.trim();

  // 2. Invoice Info Block
  const infoRows: string[] = [];

  // T-19 (Option A): Invoice Number rendered when enabled by template AND data.invoiceNo is available.
  // invoiceInfo.showInvoiceNo defaults to true for backward-compat with templates that never set it.
  const showInvoice = invoiceInfo.showInvoiceNo !== false;
  if (showInvoice && data.invoiceNo) {
    infoRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(invoiceInfo.invoiceLabel || 'Invoice #')}</span>
      <span style="font-weight:700">${escapeHtml(data.invoiceNo)}</span>
    </div>`);
  }

  // Render Date & Timestamp whenever enabled and available
  if (invoiceInfo.showDate && data.date) {
    const dateTimeStr = `${escapeHtml(data.date)}${data.time ? ` &middot; ${escapeHtml(data.time)}` : ''}`;
    infoRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(invoiceInfo.dateLabel?.trim() || 'Date:')}</span>
      <span>${dateTimeStr}</span>
    </div>`);
  }

  if (invoiceInfo.showCustomer) {
    infoRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(invoiceInfo.customerLabel?.trim() || 'Customer:')}</span>
      <span style="font-weight:700">${escapeHtml(data.clientName || 'Walk-in')}</span>
    </div>`);
  }

  if (invoiceInfo.showCashier && data.staffName) {
    infoRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(invoiceInfo.cashierLabel?.trim() || 'Staff:')}</span>
      <span style="font-weight:700">${escapeHtml(data.staffName)}</span>
    </div>`);
  }

  if (invoiceInfo.showPaymentMethod && data.paymentMethod) {
    infoRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(invoiceInfo.paymentLabel?.trim() || 'Payment:')}</span>
      <span>${escapeHtml(data.paymentMethod)}</span>
    </div>`);
  }

  const invoiceInfoFontSize = invoiceInfo.fontSize ?? Math.max(8, basePx - 1.5);
  const invoiceInfoSection = infoRows.length > 0
    ? `<div style="font-size:${invoiceInfoFontSize}px;padding-bottom:6px;margin-bottom:6px;${headerSeparatorCss}">
        ${infoRows.join('\n')}
       </div>`
    : '';

  // 3. Items Table Block
  const activeCols = itemsTable.columns.length > 0 ? itemsTable.columns : ['name', 'qty', 'rate', 'amount'];
  const hasCol = (id: string) => activeCols.includes(id as any);
  const rowBorder = itemsTable.showBorders ? 'border-bottom:1px dotted #000;' : '';
  const useTabularLayout = !itemsTable.compact || hasCol('code') || hasCol('discount');

  const itemRowsHtml = (data.items || []).map((it, idx) => {
    const isLast = idx === (data.items.length - 1);
    const borderStyle = isLast ? '' : rowBorder;
    const paddingStyle = `padding:${itemsTable.rowPadding}px 0;`;

    const codePart = it.code ? `${escapeHtml(it.code)} &middot; ` : '';
    const shadePart = it.shadeCode ? `Shade: ${escapeHtml(it.shadeCode)} &middot; ` : '';
    const subLine = `${codePart}${shadePart}${it.qty} x ${escapeHtml(cur)} ${fmt(it.rate)}`;

    // Global Token Print Suppression (Owner Decision 1 & C6):
    // Tokens and token notes are never printed on physical receipts.
    const tokenNoteHtml = '';

    // Reconcile item-table column percentages for all four supported combinations (Workstream G):
    // Case 1: Name 56%, Qty 9%, Rate 16%, Amount 19% (sum = 100%)
    // Case 2: Name 42%, Code 15%, Qty 9%, Rate 16%, Amount 18% (sum = 100%)
    // Case 3: Name 45%, Qty 9%, Rate 16%, Discount 12%, Amount 18% (sum = 100%)
    // Case 4: Name 32%, Code 15%, Qty 9%, Rate 16%, Discount 11%, Amount 17% (sum = 100%)
    let nameWidth = 56;
    let codeWidth = 0;
    let qtyWidth = 9;
    let rateWidth = 16;
    let discountWidth = 0;
    let amountWidth = 19;

    const withCode = hasCol('code');
    const withDisc = hasCol('discount');

    if (withCode && withDisc) {
      // Case 4
      nameWidth = 32;
      codeWidth = 15;
      qtyWidth = 9;
      rateWidth = 16;
      discountWidth = 11;
      amountWidth = 17;
    } else if (withCode && !withDisc) {
      // Case 2
      nameWidth = 42;
      codeWidth = 15;
      qtyWidth = 9;
      rateWidth = 16;
      amountWidth = 18;
    } else if (!withCode && withDisc) {
      // Case 3
      nameWidth = 45;
      qtyWidth = 9;
      rateWidth = 16;
      discountWidth = 12;
      amountWidth = 18;
    } else {
      // Case 1
      nameWidth = 56;
      qtyWidth = 9;
      rateWidth = 16;
      amountWidth = 19;
    }

    // If using tabular columns
    if (useTabularLayout) {
      return `
      <tr style="${borderStyle}">
        ${hasCol('code') ? `<td style="${paddingStyle}width:${codeWidth}%;font-size:0.85em;color:#000;vertical-align:top;word-break:break-all">${escapeHtml(it.code || '—')}</td>` : ''}
        ${hasCol('name') ? `<td style="${paddingStyle}width:${nameWidth}%;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:break-word;color:#000">
          <div style="font-weight:700;line-height:1.25">${escapeHtml(it.name)}</div>
          ${it.shadeCode ? `<div style="font-size:0.85em;color:#000">Shade: ${escapeHtml(it.shadeCode)}</div>` : ''}
          ${tokenNoteHtml}
        </td>` : ''}
        ${hasCol('qty') ? `<td style="${paddingStyle}width:${qtyWidth}%;text-align:center;vertical-align:top;font-weight:700;color:#000">${it.qty}</td>` : ''}
        ${hasCol('rate') ? `<td style="${paddingStyle}width:${rateWidth}%;text-align:right;vertical-align:top;color:#000">${fmt(it.rate)}</td>` : ''}
        ${hasCol('discount') ? `<td style="${paddingStyle}width:${discountWidth}%;text-align:right;vertical-align:top;color:#000">${it.discount ? `-${fmt(it.discount)}` : '—'}</td>` : ''}
        ${hasCol('amount') ? `<td style="${paddingStyle}width:${amountWidth}%;text-align:right;vertical-align:top;font-weight:700;color:#000">${fmt(it.total)}</td>` : ''}
      </tr>`;
    }

    // Default compact 2-line layout
    return `
    <div style="${paddingStyle}${borderStyle}">
      <div style="display:flex;justify-content:space-between;color:#000">
        <div style="white-space:normal;word-break:break-word;overflow-wrap:break-word;flex:1;padding-right:4px">
          <div style="font-weight:700;line-height:1.25">${escapeHtml(it.name)}</div>
          <div style="font-size:9.5px;color:#000">${subLine}</div>
        </div>
        <div style="font-weight:700;white-space:nowrap">${escapeHtml(cur)} ${fmt(it.total)}</div>
      </div>
      ${tokenNoteHtml}
    </div>`;
  }).join('');

  // Pre-calculate header column widths matching rows exactly
  let headNameWidth = 56;
  let headCodeWidth = 0;
  let headQtyWidth = 9;
  let headRateWidth = 16;
  let headDiscWidth = 0;
  let headAmountWidth = 19;

  if (hasCol('code') && hasCol('discount')) {
    headNameWidth = 32;
    headCodeWidth = 15;
    headQtyWidth = 9;
    headRateWidth = 16;
    headDiscWidth = 11;
    headAmountWidth = 17;
  } else if (hasCol('code') && !hasCol('discount')) {
    headNameWidth = 42;
    headCodeWidth = 15;
    headQtyWidth = 9;
    headRateWidth = 16;
    headAmountWidth = 18;
  } else if (!hasCol('code') && hasCol('discount')) {
    headNameWidth = 45;
    headQtyWidth = 9;
    headRateWidth = 16;
    headDiscWidth = 12;
    headAmountWidth = 18;
  }

  const itemsTableSection = useTabularLayout
    ? `<div style="padding-bottom:6px;margin-bottom:6px;${headerSeparatorCss}">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${itemsTable.fontSize}px;color:#000">
          <thead>
            <tr style="border-bottom:1px solid #000;text-align:left;color:#000">
              ${hasCol('code') ? `<th style="padding:${itemsTable.rowPadding}px 0;width:${headCodeWidth}%">${escapeHtml(itemsTable.colLabelCode || 'Code')}</th>` : ''}
              ${hasCol('name') ? `<th style="padding:${itemsTable.rowPadding}px 0;width:${headNameWidth}%">${escapeHtml(itemsTable.colLabelName || 'Item')}</th>` : ''}
              ${hasCol('qty') ? `<th style="padding:${itemsTable.rowPadding}px 0;text-align:center;width:${headQtyWidth}%">${escapeHtml(itemsTable.colLabelQty || 'Qty')}</th>` : ''}
              ${hasCol('rate') ? `<th style="padding:${itemsTable.rowPadding}px 0;text-align:right;width:${headRateWidth}%">${escapeHtml(itemsTable.colLabelRate || 'Rate')}</th>` : ''}
              ${hasCol('discount') ? `<th style="padding:${itemsTable.rowPadding}px 0;text-align:right;width:${headDiscWidth}%">${escapeHtml(itemsTable.colLabelDiscount || 'Disc')}</th>` : ''}
              ${hasCol('amount') ? `<th style="padding:${itemsTable.rowPadding}px 0;text-align:right;width:${headAmountWidth}%">${escapeHtml(itemsTable.colLabelAmount || 'Total')}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>
       </div>`
    : `<div style="padding-bottom:6px;margin-bottom:6px;font-size:${itemsTable.fontSize}px;color:#000;${headerSeparatorCss}">
        ${itemRowsHtml}
       </div>`;

  // 4. Totals Block
  const totalRows: string[] = [];

  if (totals.showSubtotal) {
    totalRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(totals.subtotalLabel || 'Subtotal:')}</span>
      <span>${escapeHtml(cur)} ${fmt(data.subTotal)}</span>
    </div>`);
  }

  if (totals.showDiscount && (data.discount || 0) > 0) {
    totalRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(totals.discountLabel || 'Discount:')}</span>
      <span>- ${escapeHtml(cur)} ${fmt(data.discount || 0)}</span>
    </div>`);
  }

  if ((data.deliveryCharge || 0) > 0) {
    totalRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>${escapeHtml(totals.deliveryLabel || 'Delivery:')}</span>
      <span>+ ${escapeHtml(cur)} ${fmt(data.deliveryCharge || 0)}</span>
    </div>`);
  }

  const gstRate = Number(totals.gstRate || 0);
  if (totals.showGst && gstRate > 0) {
    const calculatedGst = Math.round((data.subTotal * gstRate) / 100);
    totalRows.push(`<div style="display:flex;justify-content:space-between;color:#000">
      <span>GST (${gstRate}%):</span>
      <span>+ ${escapeHtml(cur)} ${fmt(calculatedGst)}</span>
    </div>`);
  }

  // T-19 (Option A): Grand Total is mandatory; always rendered
  const grandTotalFontSize = totals.grandTotalFontSize
    ? `${totals.grandTotalFontSize}px`
    : totals.boldTotal ? `${Math.round(basePx + 1)}px` : `${totals.fontSize ?? basePx}px`;
  const grandTotalFontWeight = totals.boldTotal ? '900' : '700';
  totalRows.push(`<div style="display:flex;justify-content:space-between;font-size:${grandTotalFontSize};font-weight:${grandTotalFontWeight};padding-top:3px;border-top:1px solid #000;margin-top:2px;color:#000">
    <span>${escapeHtml(totals.netTotalLabel || 'NET TOTAL:')}</span>
    <span>${escapeHtml(cur)} ${fmt(data.grandTotal)}</span>
  </div>`);

  if (totals.showPaid) {
    totalRows.push(`<div style="display:flex;justify-content:space-between;font-weight:700;padding-top:2px;color:#000">
      <span>${escapeHtml(totals.paidLabel || 'Paid:')} (${escapeHtml(data.paymentMethod || 'CASH')})</span>
      <span>${escapeHtml(cur)} ${fmt(data.paidAmount)}</span>
    </div>`);
  }

  // Payment splits breakdown if present
  if (data.paymentSplits) {
    const s = data.paymentSplits;
    const splitLines: string[] = [];
    if ((s.cash || 0) > 0) splitLines.push(`<div style="display:flex;justify-content:space-between"><span>&bull; Cash:</span><span>${escapeHtml(cur)} ${fmt(s.cash || 0)}</span></div>`);
    if ((s.card || 0) > 0) splitLines.push(`<div style="display:flex;justify-content:space-between"><span>&bull; Card:</span><span>${escapeHtml(cur)} ${fmt(s.card || 0)}</span></div>`);
    if ((s.bank || 0) > 0) splitLines.push(`<div style="display:flex;justify-content:space-between"><span>&bull; Bank:</span><span>${escapeHtml(cur)} ${fmt(s.bank || 0)}</span></div>`);
    if ((s.others || 0) > 0) splitLines.push(`<div style="display:flex;justify-content:space-between"><span>&bull; Other:</span><span>${escapeHtml(cur)} ${fmt(s.others || 0)}</span></div>`);

    if (splitLines.length > 0) {
      totalRows.push(`<div style="padding-left:8px;font-size:9.5px;color:#000">
        ${splitLines.join('\n')}
      </div>`);
    }
  }

  if ((data.changeReturned || 0) > 0) {
    totalRows.push(`<div style="display:flex;justify-content:space-between;font-size:${Math.max(8, basePx - 2)}px;color:#000;font-weight:700">
      <span>${escapeHtml(totals.changeLabel || 'Change Returned:')}</span>
      <span>${escapeHtml(cur)} ${fmt(data.changeReturned || 0)}</span>
    </div>`);
  }

  if (totals.showBalance && (data.dueAmount || 0) > 0) {
    totalRows.push(`<div style="display:flex;justify-content:space-between;font-size:${Math.max(8, basePx - 1.5)}px;font-weight:700;color:#000">
      <span>${escapeHtml(totals.balanceDueLabel || 'Balance Due:')}</span>
      <span>${escapeHtml(cur)} ${fmt(data.dueAmount || 0)}</span>
    </div>`);
  }

  const totalsFontSize = totals.fontSize ?? basePx;
  const totalsSection = `
<div style="display:flex;flex-direction:column;gap:3px;font-size:${totalsFontSize}px;padding-bottom:8px;margin-bottom:8px;break-inside:avoid;page-break-inside:avoid;color:#000;${headerSeparatorCss}">
  ${totalRows.join('\n')}
</div>`.trim();

  // 5. Footer Block
  const footerLines: string[] = [];
  const footerAlign = footer.align || 'center';
  const footerLine1Size = footer.line1Size ?? Math.max(7, basePx - 2.5);
  const footerLine2Size = footer.line2Size ?? Math.max(7, basePx - 3);
  const whatsappSize = footer.whatsappSize ?? Math.max(7, basePx - 3);

  if (footer.line1) {
    footerLines.push(`<div style="text-align:${footerAlign};font-size:${footerLine1Size}px;color:#000">${escapeHtml(footer.line1)}</div>`);
  }

  if (footer.line2) {
    footerLines.push(`<div style="text-align:${footerAlign};font-size:${footerLine2Size}px;color:#000;margin-top:2px">${escapeHtml(footer.line2)}</div>`);
  }

  if (footer.showWhatsapp && footer.whatsappNumber) {
    footerLines.push(`<div style="text-align:${footerAlign};font-size:${whatsappSize}px;color:#000;margin-top:2px">${escapeHtml(footer.whatsappLabel?.trim() || 'WhatsApp:')} ${escapeHtml(footer.whatsappNumber)}</div>`);
  }

  if (footer.showPoweredBy) {
    footerLines.push(`<div style="text-align:${footerAlign};font-size:8px;color:#000;margin-top:2px">${escapeHtml(footer.poweredByText || 'Powered by Pyntflow')}</div>`);
  }

  if (footer.showQrCode) {
    footerLines.push(`
      <div style="text-align:${footerAlign};margin-top:6px">
        <div style="width:60px;height:60px;border:1px dashed #000;display:inline-flex;align-items:center;justify-content:center;font-size:8px;color:#000">
          [QR Code]
        </div>
        ${footer.qrCodeText ? `<div style="font-size:8px;color:#000;margin-top:2px">${escapeHtml(footer.qrCodeText)}</div>` : ''}
      </div>
    `);
  }

  const footerSection = footerLines.join('\n');

  // 6. Token Claim Slip Block (MANDATORY SAFETY RULES ENFORCED)
  // Global Token Print Suppression (Owner Decision 1 & C6):
  // Token claim slips are suppressed globally across ALL receipt types (regular, special, reprint).
  const tokenClaimSlipSection = '';

  return `
${headerSection}
${invoiceInfoSection}
${itemsTableSection}
${totalsSection}
${footerSection}
${tokenClaimSlipSection}
`.trim();
}

/**
 * High-level pure function to render a complete, self-contained HTML receipt document.
 */
export function renderReceiptDocument(
  data: RenderReceiptData,
  templateOrRaw: unknown,
  paperSize?: unknown,
  fallbackTemplate?: TemplateJson
): string {
  const normalized = normalizeTemplate(templateOrRaw, paperSize, fallbackTemplate);
  const bodyHtml = renderReceiptBodyHtml(data, normalized);
  const title = `Receipt ${data.invoiceNo || ''}`.trim();
  return renderReceiptHtmlDocument(
    bodyHtml,
    title,
    normalized.template_json.layout,
    normalized.paper_size
  );
}
