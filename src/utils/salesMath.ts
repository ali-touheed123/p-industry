/**
 * PyntFlow Standardized Sales Math Utility
 * Implements authoritative sales metric formulas across CEO panels, SalesHistory, and Reporting.
 * Task 9.5 (FINDING-REP-005)
 */

export interface InvoiceLike {
  id?: string;
  invoice_type?: string | null;
  status?: string | null;
  subtotal?: number | string | null;
  net_total?: number | string | null;
  discount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  cash_paid?: number | string | null;
  card_paid?: number | string | null;
  bank_paid?: number | string | null;
  others_paid?: number | string | null;
  delivery_charges?: number | string | null;
  tax_amount?: number | string | null;
  payment_type?: string | null;
  invoice_items?: any[] | null;
  items?: any[] | null;
}

/** Check if an invoice is cancelled / voided */
export function isCancelledInvoice(inv: InvoiceLike): boolean {
  const status = (inv.status || '').toLowerCase().trim();
  return status === 'cancelled' || status === 'void';
}

/** Check if an invoice is a return */
export function isReturnInvoice(inv: InvoiceLike): boolean {
  if (isCancelledInvoice(inv)) return false;
  const invType = (inv.invoice_type || '').toLowerCase().trim();
  const status = (inv.status || '').toLowerCase().trim();
  return invType === 'return' || status === 'return' || status === 'returned' || status === 'partial return';
}

/** Check if an invoice is an active forward sale */
export function isForwardSale(inv: InvoiceLike): boolean {
  return !isCancelledInvoice(inv) && !isReturnInvoice(inv);
}

/**
 * Gross Sales: Sum of pre-discount subtotal of forward sales (strictly excluding cancelled and returns).
 * If subtotal is not present or 0, falls back to net_total + discount.
 */
export function calculateGrossSales(invoices: InvoiceLike[]): number {
  return invoices
    .filter(isForwardSale)
    .reduce((sum, inv) => {
      const subtotal = Number(inv.subtotal || 0);
      const net = Number(inv.net_total || 0);
      const disc = Number(inv.discount || 0);
      return sum + (subtotal > 0 ? subtotal : (net + disc));
    }, 0);
}

/**
 * Total Discounts: Sum of discounts given on forward sales (strictly excluding cancelled).
 */
export function calculateDiscounts(invoices: InvoiceLike[]): number {
  return invoices
    .filter(isForwardSale)
    .reduce((sum, inv) => sum + Number(inv.discount || 0), 0);
}

/**
 * Total Sales Returns: Sum of net_total of sales return invoices (strictly excluding cancelled).
 */
export function calculateSalesReturns(invoices: InvoiceLike[]): number {
  return invoices
    .filter(isReturnInvoice)
    .reduce((sum, inv) => sum + Number(inv.net_total || 0), 0);
}

/**
 * Net Sales: Gross Sales - Discounts + Delivery Charges - Sales Returns
 * Calculated as sum(forward net_total) - sum(return net_total).
 */
export function calculateNetSales(invoices: InvoiceLike[]): number {
  const forwardNet = invoices
    .filter(isForwardSale)
    .reduce((sum, inv) => sum + Number(inv.net_total || 0), 0);
  const returns = calculateSalesReturns(invoices);
  return Math.max(0, forwardNet - returns);
}

/**
 * Complete Sales Summary Metrics
 */
export function calculateSalesSummary(invoices: InvoiceLike[]) {
  const activeInvoices = invoices.filter(inv => !isCancelledInvoice(inv));
  const forward = activeInvoices.filter(isForwardSale);
  const returns = activeInvoices.filter(isReturnInvoice);

  const grossSales = calculateGrossSales(forward);
  const totalDiscounts = calculateDiscounts(forward);
  const returnsTotal = calculateSalesReturns(returns);
  const netSales = Math.max(0, forward.reduce((s, i) => s + Number(i.net_total || 0), 0) - returnsTotal);

  let physicalCash = 0;
  let digitalPaid = 0;
  let tokensOtherPaid = 0;
  let creditAmount = 0;
  let totalItemsCount = 0;

  forward.forEach(inv => {
    const paid = Number(inv.paid_amount || 0);
    const due = Number(inv.due_amount || 0);
    let invCash = Number(inv.cash_paid || 0);
    let invCard = Number(inv.card_paid || 0);
    let invBank = Number(inv.bank_paid || 0);
    let invOthers = Number(inv.others_paid || 0);

    if (invCash === 0 && invCard === 0 && invBank === 0 && invOthers === 0 && paid > 0) {
      const pt = (inv.payment_type || '').toLowerCase();
      if (pt === 'card') invCard = paid;
      else if (pt === 'bank') invBank = paid;
      else if (pt === 'cheque' || pt === 'others') invOthers = paid;
      else invCash = paid;
    }

    physicalCash += invCash;
    digitalPaid += (invCard + invBank);
    tokensOtherPaid += invOthers;
    creditAmount += due;

    const rawItems = inv.invoice_items || inv.items;
    if (Array.isArray(rawItems)) {
      rawItems.forEach((it: any) => {
        totalItemsCount += Number(it.qty || 1);
      });
    } else {
      totalItemsCount += 1;
    }
  });

  returns.forEach(inv => {
    const paid = Number(inv.paid_amount || 0);
    let invCash = Number(inv.cash_paid || 0);
    let invCard = Number(inv.card_paid || 0);
    let invBank = Number(inv.bank_paid || 0);

    if (invCash === 0 && invCard === 0 && invBank === 0 && paid > 0) {
      invCash = paid;
    }

    physicalCash -= invCash;
    digitalPaid -= (invCard + invBank);
  });

  const completedCount = forward.length;
  const returnCount = returns.length;
  const avgTicket = completedCount > 0 ? Math.round(netSales / completedCount) : 0;

  return {
    grossSales,
    totalDiscounts,
    returnsTotal,
    netSales,
    physicalCash,
    digitalPaid,
    tokensOtherPaid,
    creditAmount,
    totalItemsCount,
    completedCount,
    returnCount,
    avgTicket,
  };
}
