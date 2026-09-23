/**
 * Receipt & Statement Canvas Image Generator
 * Generates high-resolution thermal receipt images and ledger statement images 100% client-side.
 * Uses 0 bytes of database or server storage.
 */

export interface ReceiptItemData {
  item_name?: string;
  productName?: string;
  code?: string;
  item_code?: string;
  shade_code?: string;
  shadeCode?: string;
  pack_size?: string;
  packSize?: string;
  unit?: string;
  qty: number;
  unit_price?: number;
  rate?: number;
  price?: number;
  total_price?: number;
  has_token?: boolean;
  hasToken?: boolean;
  token_value?: number;
  tokenValue?: number;
  token_action?: string;
  tokenAction?: string;
}

export interface ReceiptInvoiceData {
  invoice_no: string;
  date: string;
  time?: string;
  client_name?: string;
  client_phone?: string;
  subtotal?: number;
  subTotal?: number;
  discount?: number;
  delivery_charge?: number;
  net_total?: number;
  grandTotal?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_type?: string;
  cash_paid?: number;
  card_paid?: number;
  bank_paid?: number;
  others_paid?: number;
  change_returned?: number;
  items?: ReceiptItemData[];
  invoice_items?: ReceiptItemData[];
}

/**
 * Generate a pixel-perfect, crisp Thermal Receipt Image Blob (PNG)
 */
export async function generateReceiptImageBlob(
  invoice: ReceiptInvoiceData,
  tenantName: string = 'Pyntflow Paint ERP'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const items = invoice.invoice_items || invoice.items || [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Base width and dynamic height calculation
      const width = 440;
      const baseHeaderHeight = 160;
      const itemRowHeight = 44;
      const itemsHeight = items.length * itemRowHeight;
      const financialHeight = 240;
      const footerHeight = 90;
      const totalHeight = baseHeaderHeight + itemsHeight + financialHeight + footerHeight;

      // Retina 2x scale for crisp rendering
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      // Clean White Paper Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, totalHeight);

      // Outer Paper Border
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, width - 8, totalHeight - 8);

      let y = 30;

      // ── Header: Store Branding ──
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tenantName.toUpperCase(), width / 2, y);

      y += 18;
      ctx.fillStyle = '#64748B';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('PAINT & HARDWARE SPECIALIST POS', width / 2, y);

      y += 18;
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px "JetBrains Mono", monospace, monospace';
      ctx.fillText(`INVOICE: ${invoice.invoice_no}`, width / 2, y);

      y += 16;
      ctx.fillStyle = '#475569';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const timeStr = invoice.time ? ` · ${invoice.time}` : '';
      ctx.fillText(`Date: ${invoice.date}${timeStr}`, width / 2, y);

      y += 16;
      const clientName = invoice.client_name || 'Walk-in Customer';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#1E293B';
      ctx.fillText(`Customer: ${clientName}`, width / 2, y);

      y += 16;
      // Dashed separator
      drawDashedLine(ctx, 16, y, width - 16);
      y += 16;

      // Table Columns Header
      ctx.textAlign = 'left';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748B';
      ctx.fillText('ITEM / SHADE', 18, y);
      ctx.textAlign = 'center';
      ctx.fillText('QTY', 280, y);
      ctx.textAlign = 'right';
      ctx.fillText('AMOUNT', width - 18, y);

      y += 8;
      drawDashedLine(ctx, 16, y, width - 16);
      y += 14;

      // Items List
      for (const it of items) {
        const name = it.productName || it.item_name || 'Item';
        const code = it.code || it.item_code || '';
        const shade = it.shadeCode || it.shade_code || '';
        const qty = Number(it.qty) || 1;
        const rate = Number(it.rate ?? it.unit_price ?? it.price ?? 0);
        const lineTotal = Number(it.total_price ?? (qty * rate));

        // Line 1: Item Name
        ctx.textAlign = 'left';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#0F172A';
        const truncatedName = name.length > 28 ? name.substring(0, 26) + '...' : name;
        ctx.fillText(truncatedName, 18, y);

        // Qty
        ctx.textAlign = 'center';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#334155';
        ctx.fillText(`${qty}`, 280, y);

        // Line Total
        ctx.textAlign = 'right';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#0F172A';
        ctx.fillText(`Rs. ${lineTotal.toLocaleString()}`, width - 18, y);

        y += 14;

        // Line 2: Code, Shade, Unit Rate
        ctx.textAlign = 'left';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748B';
        const codePart = code ? `${code} · ` : '';
        const shadePart = shade && shade !== '—' ? `Shade: ${shade} · ` : '';
        const ratePart = `@ Rs. ${rate.toLocaleString()}`;
        ctx.fillText(`${codePart}${shadePart}${ratePart}`, 18, y);

        y += 16;
      }

      y += 4;
      drawDashedLine(ctx, 16, y, width - 16);
      y += 18;

      // ── Financial Totals ──
      const subtotal = Number(invoice.subtotal ?? invoice.subTotal ?? 0);
      const discount = Number(invoice.discount || 0);
      const delivery = Number(invoice.delivery_charge || 0);
      const netTotal = Number(invoice.net_total ?? invoice.grandTotal ?? 0);
      const paid = Number(invoice.paid_amount || 0);
      const due = Number(invoice.due_amount || Math.max(0, netTotal - paid));

      drawSummaryRow(ctx, 'Subtotal:', `Rs. ${subtotal.toLocaleString()}`, y, width, false);
      y += 18;

      if (discount > 0) {
        drawSummaryRow(ctx, 'Discount:', `- Rs. ${discount.toLocaleString()}`, y, width, false, '#D97706');
        y += 18;
      }

      if (delivery > 0) {
        drawSummaryRow(ctx, 'Delivery Charges:', `+ Rs. ${delivery.toLocaleString()}`, y, width, false);
        y += 18;
      }

      // Net Total Box
      y += 2;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(16, y - 14, width - 32, 26);
      ctx.strokeStyle = '#CBD5E1';
      ctx.strokeRect(16, y - 14, width - 32, 26);
      drawSummaryRow(ctx, 'NET TOTAL:', `Rs. ${netTotal.toLocaleString()}`, y + 3, width, true, '#0F172A', 14);
      y += 26;

      drawSummaryRow(ctx, `Paid (${invoice.payment_type?.toUpperCase() || 'CASH'}):`, `Rs. ${paid.toLocaleString()}`, y, width, true, '#059669');
      y += 18;

      const isSplitOrMulti = invoice.payment_type === 'split' || (Number(invoice.cash_paid || 0) > 0 && (Number(invoice.card_paid || 0) > 0 || Number(invoice.bank_paid || 0) > 0 || Number(invoice.others_paid || 0) > 0));
      if (isSplitOrMulti) {
        if (Number(invoice.cash_paid || 0) > 0) {
          drawSummaryRow(ctx, '  • Cash:', `Rs. ${Number(invoice.cash_paid).toLocaleString()}`, y, width, false, '#475569', 11);
          y += 16;
        }
        if (Number(invoice.card_paid || 0) > 0) {
          drawSummaryRow(ctx, '  • Card:', `Rs. ${Number(invoice.card_paid).toLocaleString()}`, y, width, false, '#475569', 11);
          y += 16;
        }
        if (Number(invoice.bank_paid || 0) > 0) {
          drawSummaryRow(ctx, '  • Bank Transfer:', `Rs. ${Number(invoice.bank_paid).toLocaleString()}`, y, width, false, '#475569', 11);
          y += 16;
        }
        if (Number(invoice.others_paid || 0) > 0) {
          drawSummaryRow(ctx, '  • Tokens/Other:', `Rs. ${Number(invoice.others_paid).toLocaleString()}`, y, width, false, '#475569', 11);
          y += 16;
        }
      }

      if (Number(invoice.change_returned || 0) > 0) {
        drawSummaryRow(ctx, 'Change Returned (Wapsi):', `Rs. ${Number(invoice.change_returned).toLocaleString()}`, y, width, true, '#16A34A', 11);
        y += 16;
      }

      if (due > 0) {
        drawSummaryRow(ctx, 'Remaining Balance Due:', `Rs. ${due.toLocaleString()}`, y, width, true, '#DC2626');
        y += 18;
      }

      y += 10;
      drawDashedLine(ctx, 16, y, width - 16);
      y += 20;

      // ── Footer ──
      ctx.textAlign = 'center';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('THANK YOU FOR YOUR BUSINESS!', width / 2, y);

      y += 15;
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Goods once sold cannot be returned without original receipt.', width / 2, y);

      y += 14;
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Generated with Pyntflow POS System', width / 2, y);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate receipt image blob'));
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a professional A4-size (1240×variable px @ 150 DPI) Account Statement Image Blob (PNG)
 *
 * @param party         Party metadata
 * @param partyType     'client' or 'supplier'
 * @param transactions  Filtered transaction rows (caller applies date range before passing)
 * @param tenantName    Shop / business name
 * @param dateRangeLabel Human-readable label e.g. "Last 30 Days" shown in the header
 */
export async function generateLedgerStatementBlob(
  party: { name: string; code?: string; phone?: string; current_balance?: number; credit_limit?: number },
  partyType: 'client' | 'supplier' = 'client',
  transactions: Array<{ date: string; desc: string; debit: number; credit: number; bal: number }>,
  tenantName: string = 'Pyntflow Paint ERP',
  dateRangeLabel: string = 'All Transactions'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');

      // ── A4 @ 150 DPI ──────────────────────────────────────────────────────────
      // A4 = 210mm × 297mm  →  @150dpi = 1240 × 1754 px (portrait)
      // We use logical units of A4_W/A4_H and scale ×1 (no extra retina — 1240 px IS the output)
      const A4_W = 1240;
      const MARGIN = 60;
      const CONTENT_W = A4_W - MARGIN * 2;

      // Column X positions (all right-edge for right-aligned cols)
      const COL_DATE_X   = MARGIN;            // left-aligned, max width ~140px
      const COL_DESC_X   = MARGIN + 150;      // left-aligned, max width ~470px
      const COL_DR_RIGHT = MARGIN + 740;      // right-aligned
      const COL_CR_RIGHT = MARGIN + 900;      // right-aligned
      const COL_BAL_RIGHT = A4_W - MARGIN;    // right-aligned

      const ROW_H = 36;
      const HEADER_H = 260; // company + party info block
      const TABLE_HEADER_H = 30;
      const ROWS_H = Math.max(1, transactions.length) * ROW_H;
      const SUMMARY_H = 160;
      const FOOTER_H = 80;
      const TOTAL_H = HEADER_H + TABLE_HEADER_H + ROWS_H + SUMMARY_H + FOOTER_H;

      canvas.width = A4_W;
      canvas.height = TOTAL_H;

      // ── Background ─────────────────────────────────────────────────────────────
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, A4_W, TOTAL_H);

      // Subtle outer border
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8, 8, A4_W - 16, TOTAL_H - 16);

      // Top accent bar
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(8, 8, A4_W - 16, 6);

      let y = 50;

      // ── Company Name ───────────────────────────────────────────────────────────
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tenantName.toUpperCase(), A4_W / 2, y);

      y += 32;
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(
        partyType === 'client' ? 'CUSTOMER ACCOUNT STATEMENT' : 'SUPPLIER KHATA STATEMENT',
        A4_W / 2,
        y
      );

      y += 10;
      // Thin rule under subtitle
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y + 10);
      ctx.lineTo(A4_W - MARGIN, y + 10);
      ctx.stroke();
      y += 30;

      // ── Party Info Box ─────────────────────────────────────────────────────────
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(MARGIN, y, CONTENT_W, 80);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(MARGIN, y, CONTENT_W, 80);

      // Left side
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`Party: ${party.name} (${party.code || '—'})`, MARGIN + 20, y + 30);

      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Phone: ${party.phone || 'No phone on record'}`, MARGIN + 20, y + 56);

      // Right side
      ctx.textAlign = 'right';
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Statement Date: ${new Date().toLocaleDateString('en-GB')}`, A4_W - MARGIN - 20, y + 30);
      ctx.fillText(
        `Period: ${dateRangeLabel}  |  Txns: ${transactions.length}`,
        A4_W - MARGIN - 20,
        y + 56
      );

      y += 100;

      // ── Table Header ───────────────────────────────────────────────────────────
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(MARGIN, y, CONTENT_W, TABLE_HEADER_H);
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFFFFF';

      ctx.textAlign = 'left';
      ctx.fillText('DATE', COL_DATE_X + 4, y + 20);
      ctx.fillText('DESCRIPTION / INVOICE', COL_DESC_X, y + 20);
      ctx.textAlign = 'right';
      ctx.fillText('DEBIT (DR)', COL_DR_RIGHT, y + 20);
      ctx.fillText('CREDIT (CR)', COL_CR_RIGHT, y + 20);
      ctx.fillText('BALANCE', COL_BAL_RIGHT, y + 20);

      y += TABLE_HEADER_H;

      // ── Transaction Rows ───────────────────────────────────────────────────────
      let totalDr = 0;
      let totalCr = 0;

      transactions.forEach((tx, idx) => {
        totalDr += Number(tx.debit || 0);
        totalCr += Number(tx.credit || 0);

        // Alternating row background
        ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        ctx.fillRect(MARGIN, y, CONTENT_W, ROW_H);

        // Light row separator
        ctx.strokeStyle = '#F1F5F9';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(MARGIN, y + ROW_H);
        ctx.lineTo(A4_W - MARGIN, y + ROW_H);
        ctx.stroke();

        const midY = y + ROW_H / 2 + 5;

        // Date
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748B';
        ctx.fillText(tx.date || '—', COL_DATE_X + 4, midY);

        // Description — pixel-accurate truncation using measureText so text never bleeds into Debit col
        ctx.fillStyle = '#0F172A';
        ctx.font = '13px "JetBrains Mono", monospace';
        const maxDescPx = COL_DR_RIGHT - COL_DESC_X - 12; // 12px right padding before Debit col
        let descText = tx.desc || '—';
        if (ctx.measureText(descText).width > maxDescPx) {
          while (descText.length > 1 && ctx.measureText(descText + '…').width > maxDescPx) {
            descText = descText.slice(0, -1);
          }
          descText = descText.trimEnd() + '…';
        }
        ctx.fillText(descText, COL_DESC_X, midY);

        // Debit
        ctx.textAlign = 'right';
        if (tx.debit > 0) {
          ctx.fillStyle = '#DC2626';
          ctx.font = 'bold 13px "JetBrains Mono", monospace';
          ctx.fillText(`Rs. ${tx.debit.toLocaleString()}`, COL_DR_RIGHT, midY);
        } else {
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '13px "JetBrains Mono", monospace';
          ctx.fillText('—', COL_DR_RIGHT, midY);
        }

        // Credit
        if (tx.credit > 0) {
          ctx.fillStyle = '#059669';
          ctx.font = 'bold 13px "JetBrains Mono", monospace';
          ctx.fillText(`Rs. ${tx.credit.toLocaleString()}`, COL_CR_RIGHT, midY);
        } else {
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '13px "JetBrains Mono", monospace';
          ctx.fillText('—', COL_CR_RIGHT, midY);
        }

        // Balance
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.fillText(`Rs. ${(tx.bal || 0).toLocaleString()}`, COL_BAL_RIGHT, midY);

        y += ROW_H;
      });

      // ── Summary Section ────────────────────────────────────────────────────────
      y += 16;
      drawDashedLine(ctx, MARGIN, y, A4_W - MARGIN);
      y += 28;

      ctx.textAlign = 'right';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Total Debits (Billed):  Rs. ${totalDr.toLocaleString()}`, A4_W - MARGIN, y);
      y += 24;
      ctx.fillText(`Total Credits (Paid):   Rs. ${totalCr.toLocaleString()}`, A4_W - MARGIN, y);
      y += 30;

      // Net outstanding highlight
      const closingBal = Number(party.current_balance ?? (totalDr - totalCr));
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillStyle = closingBal > 0 ? '#DC2626' : '#059669';
      ctx.fillText(
        `NET CLOSING OUTSTANDING:  Rs. ${closingBal.toLocaleString()}`,
        A4_W - MARGIN,
        y
      );

      y += 28;
      drawDashedLine(ctx, MARGIN, y, A4_W - MARGIN);
      y += 26;

      // ── Footer ─────────────────────────────────────────────────────────────────
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('This is a computer-generated account statement for reconciliation purposes.', A4_W / 2, y);
      y += 20;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Generated by Pyntflow POS  •  Confidential', A4_W / 2, y);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate A4 ledger statement blob'));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
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

function drawSummaryRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  val: string,
  y: number,
  width: number,
  isBold: boolean = false,
  color: string = '#0F172A',
  fontSize: number = 12
) {
  ctx.textAlign = 'left';
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(label, 20, y);

  ctx.textAlign = 'right';
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = color;
  ctx.fillText(val, width - 20, y);
}
