/**
 * Multi-page A4 Account Statement PDF (Summary / Detailed) for Clients, Suppliers and Branches.
 *
 * Pages are drawn on a canvas (A4 @ 150 DPI = 1240 × 1754 px) so the look matches the existing
 * statement image, then embedded as JPEG pages in a minimal PDF (no external PDF library needed).
 *
 * Rules:
 *  - An invoice (main row + its product lines) never splits across pages (unless one invoice alone
 *    is taller than a page — then its product lines continue on the next page).
 *  - Every page repeats shop name, party name and "Page x/y" and starts with a Brought Forward balance.
 *  - Totals and NET CLOSING OUTSTANDING appear only on the last page.
 */

export type LedgerPartyType = 'client' | 'supplier' | 'branch';
export type LedgerPdfMode = 'summary' | 'detailed';

export interface LedgerPdfItem {
  item_name: string;
  code?: string;
  shade_code?: string;
  pack_size?: string;
  qty: number;
  unit_price: number;
  total_price: number;
}

export interface LedgerPdfTx {
  date: string;
  desc: string;
  debit: number;
  credit: number;
  bal: number;
  items?: LedgerPdfItem[];
}

export interface LedgerPdfOptions {
  party: { name: string; code?: string; phone?: string; current_balance?: number };
  partyType: LedgerPartyType;
  transactions: LedgerPdfTx[];
  tenantName?: string;
  dateRangeLabel?: string;
  mode?: LedgerPdfMode;
  /** Closing balance to print on the last page. Defaults to the last transaction's running balance. */
  closingBalance?: number;
}

// ── Layout constants (px @ 150 DPI) ─────────────────────────────────────────
const A4_W = 1240;
const A4_H = 1754;
const MARGIN = 60;
const CONTENT_W = A4_W - MARGIN * 2;
const ROW_H = 36;
const ITEM_H = 28;
const SUBHEAD_H = 26;
const BLOCK_GAP = 6;
const TABLE_HEADER_H = 30;
const PAGE_BOTTOM = A4_H - 70; // keep room for the page footer line
const SUMMARY_NEED = 190; // dashed line + 3 summary lines + dashed line + disclaimer

const FIRST_TABLE_TOP = 222;
const NEXT_TABLE_TOP = 116;

// Column X positions (main rows)
const COL_DATE_X = MARGIN;
const COL_DESC_X = MARGIN + 150;
const COL_DR_RIGHT = MARGIN + 740;
const COL_CR_RIGHT = MARGIN + 900;
const COL_BAL_RIGHT = A4_W - MARGIN;

// Column X positions (product sub-rows)
const IT_NAME_X = MARGIN + 28;
const IT_SHADE_X = MARGIN + 400;
const IT_PACK_X = MARGIN + 545;
const IT_QTY_RIGHT = MARGIN + 720;
const IT_RATE_RIGHT = MARGIN + 830;
const IT_DISC_RIGHT = MARGIN + 950;
const IT_AMT_RIGHT = A4_W - MARGIN;

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", monospace';

interface Block {
  tx: LedgerPdfTx;
  items: LedgerPdfItem[];
  hasMain: boolean;
  isContinuation: boolean;
  height: number;
}

interface PageLayout {
  blocks: Block[];
  startBal: number;
  isLast: boolean;
  summaryHere: boolean;
}

const money = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;

const subtitleFor = (t: LedgerPartyType, mode: LedgerPdfMode) => {
  const base =
    t === 'client' ? 'CUSTOMER ACCOUNT STATEMENT' : t === 'supplier' ? 'SUPPLIER KHATA STATEMENT' : 'BRANCH ACCOUNT STATEMENT';
  return mode === 'detailed' ? `${base} (DETAILED)` : base;
};

function fit(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string {
  let t = text || '—';
  if (ctx.measureText(t).width <= maxPx) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxPx) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

function dashed(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.save();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

// ── Pagination ──────────────────────────────────────────────────────────────
function buildBlocks(transactions: LedgerPdfTx[], detailed: boolean): Block[] {
  const maxItemsPerChunk = Math.max(
    1,
    Math.floor((PAGE_BOTTOM - (NEXT_TABLE_TOP + TABLE_HEADER_H + ROW_H) - ROW_H - SUBHEAD_H - BLOCK_GAP) / ITEM_H)
  );
  const blocks: Block[] = [];

  transactions.forEach((tx) => {
    const items = detailed && Array.isArray(tx.items) ? tx.items : [];
    if (items.length === 0) {
      blocks.push({ tx, items: [], hasMain: true, isContinuation: false, height: ROW_H });
      return;
    }
    for (let i = 0; i < items.length; i += maxItemsPerChunk) {
      const slice = items.slice(i, i + maxItemsPerChunk);
      const hasMain = i === 0;
      blocks.push({
        tx,
        items: slice,
        hasMain,
        isContinuation: !hasMain,
        height: (hasMain ? ROW_H : 0) + SUBHEAD_H + slice.length * ITEM_H + BLOCK_GAP,
      });
    }
  });
  return blocks;
}

function paginate(blocks: Block[], openingBalance: number): PageLayout[] {
  const pages: PageLayout[] = [];
  let current: PageLayout = { blocks: [], startBal: openingBalance, isLast: false, summaryHere: false };
  let y = FIRST_TABLE_TOP + TABLE_HEADER_H + ROW_H;

  blocks.forEach((b) => {
    if (y + b.height > PAGE_BOTTOM && current.blocks.length > 0) {
      pages.push(current);
      const prevBal = current.blocks[current.blocks.length - 1].tx.bal;
      current = { blocks: [], startBal: prevBal, isLast: false, summaryHere: false };
      y = NEXT_TABLE_TOP + TABLE_HEADER_H + ROW_H;
    }
    current.blocks.push(b);
    y += b.height;
  });

  if (y + SUMMARY_NEED > PAGE_BOTTOM && current.blocks.length > 0) {
    // Not enough room for totals on this page → totals go on their own final page
    pages.push(current);
    const prevBal = current.blocks[current.blocks.length - 1].tx.bal;
    current = { blocks: [], startBal: prevBal, isLast: false, summaryHere: false };
  }

  current.isLast = true;
  current.summaryHere = true;
  pages.push(current);
  return pages;
}

// ── Page drawing ────────────────────────────────────────────────────────────
function drawPage(
  canvas: HTMLCanvasElement,
  page: PageLayout,
  pageIdx: number,
  pageCount: number,
  o: Required<Pick<LedgerPdfOptions, 'tenantName' | 'dateRangeLabel'>> &
    LedgerPdfOptions & { mode: LedgerPdfMode; totalDr: number; totalCr: number; closing: number }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  canvas.width = A4_W;
  canvas.height = A4_H;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, A4_W, A4_H);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, A4_W - 16, A4_H - 16);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(8, 8, A4_W - 16, 6);

  const party = o.party;
  const pageLabel = `Page ${pageIdx + 1}/${pageCount}`;
  let tableTop: number;

  if (pageIdx === 0) {
    let y = 50;
    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 38px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(o.tenantName.toUpperCase(), A4_W / 2, y);

    y += 32;
    ctx.fillStyle = '#64748B';
    ctx.font = `bold 16px ${MONO}`;
    ctx.fillText(subtitleFor(o.partyType, o.mode), A4_W / 2, y);

    y += 10;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y + 10);
    ctx.lineTo(A4_W - MARGIN, y + 10);
    ctx.stroke();
    y += 30;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(MARGIN, y, CONTENT_W, 80);
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(MARGIN, y, CONTENT_W, 80);

    ctx.textAlign = 'left';
    ctx.font = `bold 18px ${SANS}`;
    ctx.fillStyle = '#0F172A';
    ctx.fillText(`Party: ${party.name} (${party.code || '—'})`, MARGIN + 20, y + 30);
    ctx.font = `14px ${MONO}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(`Phone: ${party.phone || 'No phone on record'}`, MARGIN + 20, y + 56);

    ctx.textAlign = 'right';
    ctx.fillText(`Statement Date: ${new Date().toLocaleDateString('en-GB')}   |   ${pageLabel}`, A4_W - MARGIN - 20, y + 30);
    ctx.fillText(`Period: ${o.dateRangeLabel}  |  Txns: ${o.transactions.length}`, A4_W - MARGIN - 20, y + 56);
    tableTop = FIRST_TABLE_TOP;
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 26px ${SANS}`;
    ctx.fillText(o.tenantName.toUpperCase(), MARGIN, 56);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = `bold 16px ${MONO}`;
    ctx.fillText(pageLabel, A4_W - MARGIN, 56);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 16px ${SANS}`;
    ctx.fillText(`Party: ${party.name} (${party.code || '—'})`, MARGIN, 86);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = `13px ${MONO}`;
    ctx.fillText(`${subtitleFor(o.partyType, o.mode)} • Period: ${o.dateRangeLabel}`, A4_W - MARGIN, 86);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, 100);
    ctx.lineTo(A4_W - MARGIN, 100);
    ctx.stroke();
    tableTop = NEXT_TABLE_TOP;
  }

  // Table header
  let y = tableTop;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(MARGIN, y, CONTENT_W, TABLE_HEADER_H);
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('DATE', COL_DATE_X + 4, y + 20);
  ctx.fillText('DESCRIPTION / INVOICE', COL_DESC_X, y + 20);
  ctx.textAlign = 'right';
  ctx.fillText('DEBIT (DR)', COL_DR_RIGHT, y + 20);
  ctx.fillText('CREDIT (CR)', COL_CR_RIGHT, y + 20);
  ctx.fillText('BALANCE', COL_BAL_RIGHT, y + 20);
  y += TABLE_HEADER_H;

  // Brought Forward row
  ctx.fillStyle = '#FEF9C3';
  ctx.fillRect(MARGIN, y, CONTENT_W, ROW_H);
  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(MARGIN, y, CONTENT_W, ROW_H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#713F12';
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillText('BROUGHT FORWARD', COL_DESC_X, y + ROW_H / 2 + 5);
  ctx.textAlign = 'right';
  ctx.fillText(money(page.startBal), COL_BAL_RIGHT, y + ROW_H / 2 + 5);
  y += ROW_H;

  // Blocks
  let mainIdx = 0;
  page.blocks.forEach((b) => {
    const detailed = o.mode === 'detailed';
    if (b.hasMain) {
      const midY = y + ROW_H / 2 + 5;
      ctx.fillStyle = detailed ? '#EEF2F7' : mainIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(MARGIN, y, CONTENT_W, ROW_H);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y + ROW_H);
      ctx.lineTo(A4_W - MARGIN, y + ROW_H);
      ctx.stroke();

      ctx.font = `13px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748B';
      ctx.fillText(b.tx.date || '—', COL_DATE_X + 4, midY);

      ctx.fillStyle = '#0F172A';
      ctx.font = `${detailed ? 'bold ' : ''}13px ${MONO}`;
      ctx.fillText(fit(ctx, b.tx.desc, COL_DR_RIGHT - COL_DESC_X - 12), COL_DESC_X, midY);

      ctx.textAlign = 'right';
      if (b.tx.debit > 0) {
        ctx.fillStyle = '#DC2626';
        ctx.font = `bold 13px ${MONO}`;
        ctx.fillText(money(b.tx.debit), COL_DR_RIGHT, midY);
      } else {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `13px ${MONO}`;
        ctx.fillText('—', COL_DR_RIGHT, midY);
      }
      if (b.tx.credit > 0) {
        ctx.fillStyle = '#059669';
        ctx.font = `bold 13px ${MONO}`;
        ctx.fillText(money(b.tx.credit), COL_CR_RIGHT, midY);
      } else {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `13px ${MONO}`;
        ctx.fillText('—', COL_CR_RIGHT, midY);
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = `bold 13px ${MONO}`;
      ctx.fillText(money(b.tx.bal), COL_BAL_RIGHT, midY);
      y += ROW_H;
      mainIdx++;
    }

    if (b.items.length > 0) {
      // Product sub-header
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(MARGIN + 14, y, CONTENT_W - 14, SUBHEAD_H);
      ctx.font = `bold 11px ${MONO}`;
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.fillText(b.isContinuation ? 'PRODUCT (CONTINUED)' : 'PRODUCT', IT_NAME_X, y + 17);
      ctx.fillText('SHADE', IT_SHADE_X, y + 17);
      ctx.fillText('PACK', IT_PACK_X, y + 17);
      ctx.textAlign = 'right';
      ctx.fillText('QTY', IT_QTY_RIGHT, y + 17);
      ctx.fillText('RATE', IT_RATE_RIGHT, y + 17);
      ctx.fillText('DISC', IT_DISC_RIGHT, y + 17);
      ctx.fillText('AMOUNT', IT_AMT_RIGHT, y + 17);
      y += SUBHEAD_H;

      b.items.forEach((it) => {
        const midY = y + ITEM_H / 2 + 4;
        const qty = Number(it.qty || 0);
        const rate = Number(it.unit_price || 0);
        const amt = Number(it.total_price || 0);
        const hasPricing = rate > 0 || amt > 0;
        const disc = hasPricing ? Math.max(0, Math.round((qty * rate - amt) * 100) / 100) : 0;

        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(MARGIN + 14, y + ITEM_H);
        ctx.lineTo(A4_W - MARGIN, y + ITEM_H);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#1E293B';
        ctx.font = `12px ${MONO}`;
        const nameTxt = it.code ? `${it.item_name} [${it.code}]` : it.item_name;
        ctx.fillText(fit(ctx, nameTxt, IT_SHADE_X - IT_NAME_X - 10), IT_NAME_X, midY);
        ctx.fillStyle = '#475569';
        ctx.fillText(fit(ctx, it.shade_code || '—', IT_PACK_X - IT_SHADE_X - 10), IT_SHADE_X, midY);
        ctx.fillText(fit(ctx, it.pack_size || '—', IT_QTY_RIGHT - 80 - IT_PACK_X), IT_PACK_X, midY);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0F172A';
        ctx.fillText(String(qty), IT_QTY_RIGHT, midY);
        ctx.fillText(hasPricing ? rate.toLocaleString() : '—', IT_RATE_RIGHT, midY);
        ctx.fillStyle = disc > 0 ? '#B45309' : '#94A3B8';
        ctx.fillText(disc > 0 ? disc.toLocaleString() : '—', IT_DISC_RIGHT, midY);
        ctx.fillStyle = '#0F172A';
        ctx.font = `bold 12px ${MONO}`;
        ctx.fillText(hasPricing ? amt.toLocaleString() : '—', IT_AMT_RIGHT, midY);
        y += ITEM_H;
      });
      y += BLOCK_GAP;
    }
  });

  if (page.isLast && page.blocks.length === 0 && o.transactions.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.font = `13px ${MONO}`;
    ctx.fillText('No transactions in this period.', A4_W / 2, y + 28);
    y += ROW_H;
  }

  // Totals (last page only)
  if (page.summaryHere) {
    y += 16;
    dashed(ctx, MARGIN, y, A4_W - MARGIN);
    y += 28;
    ctx.textAlign = 'right';
    ctx.font = `15px ${SANS}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(`Total Debits (Billed):  ${money(o.totalDr)}`, A4_W - MARGIN, y);
    y += 24;
    ctx.fillText(`Total Credits (Paid):   ${money(o.totalCr)}`, A4_W - MARGIN, y);
    y += 30;
    ctx.font = `bold 20px ${MONO}`;
    ctx.fillStyle = o.closing > 0 ? '#DC2626' : '#059669';
    ctx.fillText(`NET CLOSING OUTSTANDING:  ${money(o.closing)}`, A4_W - MARGIN, y);
    y += 28;
    dashed(ctx, MARGIN, y, A4_W - MARGIN);
    y += 26;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.font = `12px ${SANS}`;
    ctx.fillText('This is a computer-generated account statement for reconciliation purposes.', A4_W / 2, y);
  }

  // Page footer (every page)
  ctx.textAlign = 'center';
  ctx.font = `11px ${MONO}`;
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText(`Generated by Pyntflow POS  •  Confidential  •  ${pageLabel}`, A4_W / 2, A4_H - 28);
}

// ── Minimal PDF writer (one JPEG image per A4 page) ─────────────────────────
export function buildPdfFromJpegs(pages: Array<{ jpeg: Uint8Array; width: number; height: number }>): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const beginObj = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };

  const PT_W = 595.28;
  const PT_H = 841.89;
  // Object numbering: 1 = catalog, 2 = pages, then per page i: 3+3i = page, 4+3i = contents, 5+3i = image
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  beginObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  beginObj(2);
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pageObj = 3 + i * 3;
    const contObj = pageObj + 1;
    const imgObj = pageObj + 2;
    const content = `q ${PT_W} 0 0 ${PT_H} 0 0 cm /Im0 Do Q`;

    beginObj(pageObj);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PT_W} ${PT_H}] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${contObj} 0 R >>\nendobj\n`
    );
    beginObj(contObj);
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    beginObj(imgObj);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`
    );
    push(p.jpeg);
    push('\nendstream\nendobj\n');
  });

  const objCount = 2 + pages.length * 3;
  const xrefPos = length;
  let xref = `xref\n0 ${objCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objCount; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error('Failed to render statement page'));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      0.93
    );
  });
}

// ── Public API ──────────────────────────────────────────────────────────────
export async function generateLedgerStatementPdf(
  opts: LedgerPdfOptions
): Promise<{ blob: Blob; pageCount: number }> {
  const mode: LedgerPdfMode = opts.mode || 'summary';
  const tenantName = opts.tenantName || 'Pyntflow Paint ERP';
  const dateRangeLabel = opts.dateRangeLabel || 'All Transactions';
  const txs = opts.transactions || [];

  const totalDr = txs.reduce((s, t) => s + Number(t.debit || 0), 0);
  const totalCr = txs.reduce((s, t) => s + Number(t.credit || 0), 0);

  const first = txs[0];
  const last = txs[txs.length - 1];
  const openingBalance = first
    ? Number(first.bal || 0) - Number(first.debit || 0) + Number(first.credit || 0)
    : Number(opts.party.current_balance || 0);
  const closing =
    opts.closingBalance !== undefined
      ? Number(opts.closingBalance)
      : last
      ? Number(last.bal || 0)
      : Number(opts.party.current_balance || 0);

  const pages = paginate(buildBlocks(txs, mode === 'detailed'), openingBalance);
  const jpegPages: Array<{ jpeg: Uint8Array; width: number; height: number }> = [];

  for (let i = 0; i < pages.length; i++) {
    const canvas = document.createElement('canvas');
    drawPage(canvas, pages[i], i, pages.length, {
      ...opts,
      transactions: txs,
      tenantName,
      dateRangeLabel,
      mode,
      totalDr,
      totalCr,
      closing,
    });
    jpegPages.push({ jpeg: await canvasToJpegBytes(canvas), width: A4_W, height: A4_H });
    canvas.width = 0;
    canvas.height = 0;
  }

  return { blob: buildPdfFromJpegs(jpegPages), pageCount: pages.length };
}
