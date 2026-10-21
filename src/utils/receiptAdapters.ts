import { renderReceiptDocument, normalizeSpecialTemplate } from '@/utils/receiptRenderCore';
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
  tmpl?: ReceiptTemplate | null,
  tenantAddress?: string,
  tenantPhone?: string
): string {
  const effectiveTenantName = (tenantName && tenantName.trim() && tenantName !== 'Main Godown & Retail Counter #1')
    ? tenantName
    : 'PyntFlow Store';

  const isSplit = data.payment_type === 'split' ||
    (Number(data.cash_paid || 0) > 0 &&
      (Number(data.card_paid || 0) > 0 || Number(data.bank_paid || 0) > 0 || Number(data.others_paid || 0) > 0));

  const items: RenderReceiptItem[] = (data.items || []).map((item: any) => {
    // Global Token Print Suppression (Owner Decision 1 & C6)
    const tokenNote = undefined;

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
    tenantAddress: tenantAddress || data.tenantAddress || data.shop_address,
    tenantPhone: tenantPhone || data.tenantPhone || data.shop_phone,
    invoiceType: data.invoice_type || data.invoiceType || 'sales',
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
    tokenClaimCode: undefined,
    tokenClaimDetails: undefined,
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
  tmpl?: ReceiptTemplate | null,
  tenantAddress?: string,
  tenantPhone?: string
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
    tenantAddress: tenantAddress || inv.tenantAddress || inv.shop_address,
    tenantPhone: tenantPhone || inv.tenantPhone || inv.shop_phone,
    invoiceType: inv.invoice_type || inv.invoiceType || 'sales',
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

/**
 * TASK-SR-08 / B7:
 * Renders a Special Receipt from a server-verified JSON snapshot and template snapshot.
 * Option A Content Rule: zero branding defaults, derived printed total, no discount display.
 */
export function buildSpecialReceiptHtml(
  snapshot: any,
  templateSnapshot?: any,
  isReprint = false
): string {
  const normTemplate = normalizeSpecialTemplate(templateSnapshot);
  const items: RenderReceiptItem[] = (snapshot.items || []).map((it: any) => {
    const qty = Number(it.qty || 0);
    const rate = Number(it.pre_discount_rate ?? it.unit_price ?? it.rate ?? 0);
    return {
      name: it.receipt_name || it.item_name || '—',
      code: it.item_code || undefined,
      shadeCode: it.receipt_shade || it.shade_code || undefined,
      qty,
      rate,
      total: qty * rate,
    };
  });

  const receiptData: RenderReceiptData = {
    tenantName: normTemplate.template_json.header.customShopName || '',
    tenantAddress: normTemplate.template_json.header.customAddress || '',
    tenantPhone: normTemplate.template_json.header.customPhone || '',
    invoiceType: 'sales',
    invoiceNo: snapshot.invoice_no || '',
    date: snapshot.date || new Date().toISOString().split('T')[0],
    time: snapshot.time || undefined,
    clientName: snapshot.client_name || undefined,
    paymentMethod: 'CASH',
    items,
    subTotal: Number(snapshot.printed_total || snapshot.master_total || 0),
    discount: 0, // Option A: Zero discount disclosure on paper
    grandTotal: Number(snapshot.printed_total || 0),
    paidAmount: Number(snapshot.printed_total || 0),
    dueAmount: 0,
    deliveryCharge: Number(snapshot.delivery_charge || 0),
    headerNote: snapshot.header_note || undefined,
    footerNote: snapshot.footer_note || undefined,
    isReprint,
  };

  return renderReceiptDocument(receiptData, normTemplate.template_json, normTemplate.paper_size);
}

