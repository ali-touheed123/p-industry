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
      const financialHeight = 180;
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

      drawSummaryRow(ctx, `Paid (${invoice.payment_type || 'Cash'}):`, `Rs. ${paid.toLocaleString()}`, y, width, true, '#059669');
      y += 18;

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
 * Generate a pixel-perfect Customer / Supplier Account Statement Image Blob (PNG)
 */
export async function generateLedgerStatementBlob(
  party: { name: string; code?: string; phone?: string; current_balance?: number; credit_limit?: number },
  partyType: 'client' | 'supplier' = 'client',
  transactions: Array<{ date: string; desc: string; debit: number; credit: number; bal: number }>,
  tenantName: string = 'Pyntflow Paint ERP'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');

      const width = 640;
      const headerHeight = 180;
      const rowHeight = 30;
      const rowsHeight = Math.max(1, transactions.length) * rowHeight;
      const summaryHeight = 130;
      const footerHeight = 60;
      const totalHeight = headerHeight + rowsHeight + summaryHeight + footerHeight;

      const scale = 2;
      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      // Clean White Paper Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, totalHeight);

      // Outer Border
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, width - 8, totalHeight - 8);

      let y = 32;

      // Header
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tenantName.toUpperCase(), width / 2, y);

      y += 20;
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(
        partyType === 'client' ? 'CUSTOMER ACCOUNT STATEMENT' : 'SUPPLIER KHATA STATEMENT',
        width / 2,
        y
      );

      y += 24;
      // Party Info Box
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(20, y, width - 40, 56);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(20, y, width - 40, 56);

      ctx.textAlign = 'left';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`Party: ${party.name} (${party.code || '—'})`, 32, y + 22);

      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Phone: ${party.phone || 'No phone'}`, 32, y + 42);

      ctx.textAlign = 'right';
      ctx.fillText(`Statement Date: ${new Date().toLocaleDateString('en-GB')}`, width - 32, y + 22);
      ctx.fillText(`Total Txns: ${transactions.length}`, width - 32, y + 42);

      y += 74;

      // Table Header
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(20, y, width - 40, 24);
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFFFFF';

      ctx.textAlign = 'left';
      ctx.fillText('DATE', 30, y + 16);
      ctx.fillText('DESCRIPTION / ITEMS', 120, y + 16);
      ctx.textAlign = 'right';
      ctx.fillText('DEBIT (DR)', 400, y + 16);
      ctx.fillText('CREDIT (CR)', 510, y + 16);
      ctx.fillText('BALANCE', width - 30, y + 16);

      y += 24;

      let totalDr = 0;
      let totalCr = 0;

      // Rows
      transactions.forEach((tx, idx) => {
        totalDr += Number(tx.debit || 0);
        totalCr += Number(tx.credit || 0);

        ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        ctx.fillRect(20, y, width - 40, rowHeight);

        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#475569';
        ctx.fillText(tx.date || '—', 30, y + 19);

        ctx.fillStyle = '#0F172A';
        const descText = tx.desc && tx.desc.length > 36 ? tx.desc.substring(0, 34) + '...' : tx.desc || '—';
        ctx.fillText(descText, 120, y + 19);

        ctx.textAlign = 'right';
        ctx.fillStyle = tx.debit > 0 ? '#DC2626' : '#94A3B8';
        ctx.fillText(tx.debit > 0 ? `Rs. ${tx.debit.toLocaleString()}` : '—', 400, y + 19);

        ctx.fillStyle = tx.credit > 0 ? '#059669' : '#94A3B8';
        ctx.fillText(tx.credit > 0 ? `Rs. ${tx.credit.toLocaleString()}` : '—', 510, y + 19);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
        ctx.fillText(`Rs. ${(tx.bal || 0).toLocaleString()}`, width - 30, y + 19);

        y += rowHeight;
      });

      y += 12;
      drawDashedLine(ctx, 20, y, width - 20);
      y += 20;

      // Summary Box
      ctx.textAlign = 'right';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Total Debits (Billed): Rs. ${totalDr.toLocaleString()}`, width - 30, y);
      y += 18;
      ctx.fillText(`Total Credits (Paid): Rs. ${totalCr.toLocaleString()}`, width - 30, y);
      y += 22;

      const closingBal = Number(party.current_balance ?? (totalDr - totalCr));
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillStyle = closingBal > 0 ? '#DC2626' : '#059669';
      ctx.fillText(
        `NET CLOSING OUTSTANDING: Rs. ${closingBal.toLocaleString()}`,
        width - 30,
        y
      );

      y += 26;
      drawDashedLine(ctx, 20, y, width - 20);
      y += 20;

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748B';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('This is a computer generated account statement for reconciliation.', width / 2, y);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate ledger statement blob'));
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
