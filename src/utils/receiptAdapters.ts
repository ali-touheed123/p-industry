import { renderReceiptDocument } from '@/utils/receiptRenderCore';
import type { RenderReceiptData, RenderReceiptItem } from '@/utils/receiptRenderCore';
import type { ReceiptTemplate } from '@/types/receipt';

/**
 * UX-01 / DEV-07 / T-04:
 * Build receipt as a self-contained HTML document for iframe printing from active POS billing data.
 * Integrates assigned template branding, layouts, column visibility, and paper size.
 */
export function buildPosThermalHtml(
  data: any,
  tenantName: string = 'PyntFlow Store',
  staffName: string = 'Counter Staff',
  tmpl?: ReceiptTemplate | null
): string {
  const effectiveTenantName = (tenantName && tenantName.trim() && tenantName !== 'Main Godown & Retail Counter #1')
    ? tenantName
    : 'PyntFlow Store';

  const isSplit = data.payment_type === 'split' ||
    (Number(data.cash_paid || 0) > 0 &&
      (Number(data.card_paid || 0) > 0 || Number(data.bank_paid || 0) > 0 || Number(data.others_paid || 0) > 0));

  const items: RenderReceiptItem[] = (data.items || []).map((item: any) => {
    const isRemoved = item.tokenAction === 'remove';
    const hasToken = Boolean(item.hasToken && (item.tokenValue || 0) > 0);
    const tokenNote = hasToken
      ? (isRemoved
          ? `Token removed — Rs. ${Number(item.tokenValue * item.qty).toLocaleString()} deducted`
          : `Token included — Rs. ${Number(item.tokenValue * item.qty).toLocaleString()} token value`)
      : undefined;

    return {
      name: item.productName || item.item_name || '—',
      code: item.code || item.item_code || undefined,
      shadeCode: (item.shadeCode || item.shade_code) &&
        (item.shadeCode || item.shade_code) !== '—' &&
        (item.shadeCode || item.shade_code) !== '&mdash;'
          ? (item.shadeCode || item.shade_code)
          : undefined,
      qty: Number(item.qty || 0),
      rate: Number(item.rate || item.unit_price || 0),
      total: Number(item.qty || 0) * Number(item.rate || item.unit_price || 0),
      tokenNote,
    };
  });

  const receiptData: RenderReceiptData = {
    tenantName: effectiveTenantName,
    invoiceNo: data.invoice_no,
    date: data.date,
    time: data.time,
    clientName: data.client_name,
    staffName: staffName,
    paymentMethod: (data.payment_type || 'CASH').toUpperCase(),
    items,
    subTotal: Number(data.subTotal || 0),
    discount: Number(data.discount || 0),
    deliveryCharge: Number(data.delivery_charge || 0),
    grandTotal: Number(data.grandTotal || 0),
    paidAmount: Number(data.paid_amount || 0),
    dueAmount: Number(data.due_amount || 0),
    changeReturned: Number(data.change_returned || 0),
    paymentSplits: isSplit ? {
      cash: Number(data.cash_paid || 0),
      card: Number(data.card_paid || 0),
      bank: Number(data.bank_paid || 0),
      others: Number(data.others_paid || 0),
    } : undefined,
    tokenClaimCode: data.token_claim_code || undefined,
    tokenClaimDetails: data.token_claim_details || undefined,
    isReprint: false,
  };

  return renderReceiptDocument(receiptData, tmpl?.template_json, tmpl?.paper_size);
}

/**
 * UX-01 / DEV-07 / T-05:
 * Build duplicate receipt as a self-contained HTML document for iframe printing from historical invoices.
 * Integrates assigned template branding, layout, table columns, and paper size.
 */
export function buildSalesHistoryThermalHtml(
  inv: any,
  tenantName: string,
  tmpl?: ReceiptTemplate | null
): string {
  const effectiveTenantName = (tenantName && tenantName.trim()) ? tenantName : 'PyntFlow Store';
  const isSplit = inv.payment_type === 'split' ||
    (Number(inv.cash_paid || 0) > 0 &&
      (Number(inv.card_paid || 0) > 0 || Number(inv.bank_paid || 0) > 0 || Number(inv.others_paid || 0) > 0));

  const rawItems: any[] = inv.invoice_items || inv.items || [];
  const items: RenderReceiptItem[] = rawItems.map((it: any) => {
    const qty = Number(it.qty || 0);
    const unitPrice = Number(it.unit_price || 0);
    const lineTotal = Number(it.total_price || (qty * unitPrice) || 0);

    return {
      name: it.item_name || '—',
      code: it.item_code || undefined,
      shadeCode: it.shade_code || undefined,
      qty,
      rate: unitPrice,
      total: lineTotal,
    };
  });

  const receiptData: RenderReceiptData = {
    tenantName: effectiveTenantName,
    invoiceNo: inv.invoice_no,
    date: inv.date,
    clientName: inv.client_name,
    paymentMethod: (inv.payment_type || 'CASH').toUpperCase(),
    items,
    subTotal: Number(inv.subtotal || 0),
    discount: Number(inv.discount || 0),
    grandTotal: Number(inv.net_total || 0),
    paidAmount: Number(inv.paid_amount || 0),
    dueAmount: Number(inv.due_amount || 0),
    paymentSplits: isSplit ? {
      cash: Number(inv.cash_paid || 0),
      card: Number(inv.card_paid || 0),
      bank: Number(inv.bank_paid || 0),
      others: Number(inv.others_paid || 0),
    } : undefined,
    tokenClaimCode: undefined, // Historical invoices never fabricate replacement claim codes
    tokenClaimDetails: undefined,
    isReprint: true,
  };

  return renderReceiptDocument(receiptData, tmpl?.template_json, tmpl?.paper_size);
}
