/**
 * PyntFlow Authoritative Cash Ledger Utility (Phase 1)
 *
 * Single Source of Truth for Shift Expected Cash Calculation.
 * Shared across ShiftDrawer (POS register), api/shifts PATCH (server validation),
 * and DayCloseView (CEO Panel).
 *
 * Formula:
 *   openingCash
 *   + cashSales
 *   - cashRefundsOnSalesReturns
 *   - supplierCashPaid
 *   + supplierReturnCashReceived
 *   + voucherCashReceipts
 *   - voucherCashPayments
 *   - pettyExpenses
 *   - tokenCashPayouts
 *   = expectedCash
 *
 * Rules:
 *   - One shared isCancelledInvoice: status 'cancelled' OR 'void' (case-insensitive).
 *   - Cash sale = cash_paid if > 0, else (payment_type cash/empty ? paid_amount : 0).
 *     Never falls back to net_total when paid_amount is 0.
 *   - Return cash refund = cash_paid if > 0, else paid_amount if payment_type is cash/refund/empty, else 0.
 *     Store-credit returns (payment_type 'credit', cash_paid 0) are NOT cash.
 *   - Supplier cash paid: purchase_type != 'return' AND payment_type = 'cash' only.
 *   - Supplier return cash: purchase_type = 'return' AND payment_type = 'cash' (or cash_paid > 0).
 *   - Vouchers: require shift_id (vouchers without shift_id are excluded). payment_mode = 'cash'.
 *   - NO Math.max(0, ...) clamp on expected cash anywhere. Negative expected cash is preserved.
 */

export interface InvoiceLike {
  id?: string;
  invoice_no?: string;
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
  payment_type?: string | null;
  shift_id?: string | null;
  date?: string | null;
  created_at?: string | null;
  grandTotal?: number | string | null;
}

export interface PurchaseLike {
  id?: string;
  purchase_no?: string;
  purchase_type?: string | null;
  payment_type?: string | null;
  net_total?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  cash_paid?: number | string | null;
  shift_id?: string | null;
  created_at?: string | null;
}

export interface VoucherLike {
  id?: string;
  voucher_no?: string;
  voucher_type?: string | null; // 'receipt' | 'payment'
  party_type?: string | null;
  party_id?: string | null;
  amount?: number | string | null;
  payment_mode?: string | null; // 'Cash' | 'Bank' | 'Cheque'
  shift_id?: string | null;
  created_at?: string | null;
}

export interface ExpenseLike {
  id?: string;
  amount?: number | string | null;
  category?: string | null;
  shift_id?: string | null;
  created_at?: string | null;
}

export interface TokenTransactionLike {
  id?: string;
  type?: string | null;
  transaction_type?: string | null;
  usage_status?: string | null;
  total_amount?: number | string | null;
  redeemed_amount?: number | string | null;
  token_value?: number | string | null;
  shift_id?: string | null;
  created_at?: string | null;
}

export interface ShiftCashBreakdown {
  openingCash: number;
  cashSales: number;
  cashRefundsOnSalesReturns: number;
  supplierCashPaid: number;
  supplierReturnCashReceived: number;
  voucherCashReceipts: number;
  voucherCashPayments: number;
  pettyExpenses: number;
  tokenCashPayouts: number;
  expectedCash: number;
  // Detail metadata for audits and UI breakdown displays
  details?: {
    forwardSalesCount: number;
    salesReturnCount: number;
    supplierPurchaseCount: number;
    supplierReturnCount: number;
    voucherReceiptCount: number;
    voucherPaymentCount: number;
    expenseCount: number;
    tokenPayoutCount: number;
  };
}

export interface ComputeShiftCashInput {
  openingCash?: number | string | null;
  invoices?: InvoiceLike[] | null;
  purchases?: PurchaseLike[] | null;
  vouchers?: VoucherLike[] | null;
  expenses?: ExpenseLike[] | number | null;
  tokens?: TokenTransactionLike[] | number | null;
  shiftId?: string | null;
}

/** Check if an invoice is cancelled or void (case-insensitive, trimmed) */
export function isCancelledInvoice(inv: { status?: string | null } | null | undefined): boolean {
  if (!inv) return false;
  const status = (inv.status || '').toLowerCase().trim();
  return status === 'cancelled' || status === 'void';
}

/** Check if an invoice is a sales return */
export function isReturnInvoice(inv: { invoice_type?: string | null; status?: string | null } | null | undefined): boolean {
  if (!inv || isCancelledInvoice(inv)) return false;
  const invType = (inv.invoice_type || '').toLowerCase().trim();
  const status = (inv.status || '').toLowerCase().trim();
  return invType === 'return' || status === 'return' || status === 'returned' || status === 'partial return';
}

/** Check if an invoice is an active forward sale */
export function isForwardSale(inv: { invoice_type?: string | null; status?: string | null } | null | undefined): boolean {
  if (!inv) return false;
  return !isCancelledInvoice(inv) && !isReturnInvoice(inv);
}

/**
 * Compute the cash collected from a forward sale.
 * Rule: cash_paid if > 0, else (payment_type cash/empty ? paid_amount : 0).
 * Never fall back to net_total when paid_amount is 0.
 */
export function computeInvoiceCashAmount(inv: InvoiceLike): number {
  if (!inv || isCancelledInvoice(inv) || isReturnInvoice(inv)) return 0;
  const cp = Number(inv.cash_paid || 0);
  if (cp > 0) return cp;
  const pt = (inv.payment_type || '').toLowerCase().trim();
  if (!pt || pt === 'cash') {
    return Number(inv.paid_amount || 0);
  }
  return 0;
}

/**
 * Compute the cash refunded to customer on a sales return.
 * Rule: cash_paid if > 0, else paid_amount if payment_type is cash/refund/empty, else 0.
 * Store-credit returns (payment_type 'credit', cash_paid 0) are NOT cash.
 */
export function computeReturnCashRefund(inv: InvoiceLike): number {
  if (!inv || isCancelledInvoice(inv) || !isReturnInvoice(inv)) return 0;
  const cp = Number(inv.cash_paid || 0);
  if (cp > 0) return cp;
  const pt = (inv.payment_type || '').toLowerCase().trim();
  if (!pt || pt === 'cash' || pt === 'refund') {
    return Number(inv.paid_amount || 0);
  }
  return 0;
}

/**
 * Authoritative pure function to compute shift expected cash and its complete line breakdown.
 */
export function computeShiftCash(input: ComputeShiftCashInput): ShiftCashBreakdown {
  const openingCash = Number(input.openingCash || 0);
  const shiftId = input.shiftId || null;

  // 1. Invoices (Cash Sales and Sales Returns)
  let cashSales = 0;
  let cashRefundsOnSalesReturns = 0;
  let forwardSalesCount = 0;
  let salesReturnCount = 0;

  if (Array.isArray(input.invoices)) {
    for (const inv of input.invoices) {
      if (isCancelledInvoice(inv)) continue;

      if (isReturnInvoice(inv)) {
        const refund = computeReturnCashRefund(inv);
        cashRefundsOnSalesReturns += refund;
        salesReturnCount++;
      } else {
        const saleCash = computeInvoiceCashAmount(inv);
        cashSales += saleCash;
        forwardSalesCount++;
      }
    }
  }

  // 2. Purchases (Supplier Cash Paid & Supplier Return Cash Received)
  let supplierCashPaid = 0;
  let supplierReturnCashReceived = 0;
  let supplierPurchaseCount = 0;
  let supplierReturnCount = 0;

  if (Array.isArray(input.purchases)) {
    for (const p of input.purchases) {
      const pType = (p.purchase_type || 'purchase').toLowerCase().trim();
      const pt = (p.payment_type || '').toLowerCase().trim();
      const cp = Number(p.cash_paid || 0);
      const paid = Number(p.paid_amount !== undefined && p.paid_amount !== null ? p.paid_amount : (p.net_total || 0));

      if (pType === 'return') {
        // Cash received from supplier on return
        if (pt === 'cash' || cp > 0) {
          const cashAmt = cp > 0 ? cp : paid;
          supplierReturnCashReceived += cashAmt;
          supplierReturnCount++;
        }
      } else {
        // Cash paid to supplier for purchase: payment_type = 'cash' ONLY (bank/cheque/card is NEVER cash)
        if (pt === 'cash') {
          const cashAmt = cp > 0 ? cp : paid;
          supplierCashPaid += cashAmt;
          supplierPurchaseCount++;
        }
      }
    }
  }

  // 3. Vouchers (Cash Receipts and Cash Payments)
  // Rule: Only include vouchers with shift_id (vouchers without shift_id are kept out of cash ledger).
  let voucherCashReceipts = 0;
  let voucherCashPayments = 0;
  let voucherReceiptCount = 0;
  let voucherPaymentCount = 0;

  if (Array.isArray(input.vouchers)) {
    for (const v of input.vouchers) {
      // Must have shift_id, and if input.shiftId is provided, must match it
      if (!v.shift_id) continue;
      if (shiftId && v.shift_id !== shiftId) continue;

      const pMode = (v.payment_mode || 'Cash').toLowerCase().trim();
      if (pMode !== 'cash') continue;

      const vType = (v.voucher_type || '').toLowerCase().trim();
      const amt = Number(v.amount || 0);

      if (vType === 'receipt') {
        voucherCashReceipts += amt;
        voucherReceiptCount++;
      } else if (vType === 'payment') {
        voucherCashPayments += amt;
        voucherPaymentCount++;
      }
    }
  }

  // 4. Petty Expenses
  let pettyExpenses = 0;
  let expenseCount = 0;
  if (typeof input.expenses === 'number') {
    pettyExpenses = Number(input.expenses || 0);
  } else if (Array.isArray(input.expenses)) {
    for (const exp of input.expenses) {
      pettyExpenses += Number(exp.amount || 0);
      expenseCount++;
    }
  }

  // 5. Token Cash Payouts (redeemed tokens paid out in cash from drawer)
  let tokenCashPayouts = 0;
  let tokenPayoutCount = 0;
  if (typeof input.tokens === 'number') {
    tokenCashPayouts = Number(input.tokens || 0);
  } else if (Array.isArray(input.tokens)) {
    for (const t of input.tokens) {
      const tType = (t.type || t.transaction_type || '').toLowerCase().trim();
      const uStatus = (t.usage_status || '').toLowerCase().trim();
      if (tType === 'redeemed' && uStatus !== 'reversed') {
        tokenCashPayouts += Number(t.total_amount || t.redeemed_amount || t.token_value || 0);
        tokenPayoutCount++;
      }
    }
  }

  // 6. Expected Cash = opening + sales - returns - supplierPaid + supplierReturnReceived + voucherReceipts - voucherPayments - petty - tokens
  // CRITICAL: NO Math.max(0, ...) clamp. Negative expected cash must be preserved and shown.
  const expectedCash =
    openingCash +
    cashSales -
    cashRefundsOnSalesReturns -
    supplierCashPaid +
    supplierReturnCashReceived +
    voucherCashReceipts -
    voucherCashPayments -
    pettyExpenses -
    tokenCashPayouts;

  return {
    openingCash,
    cashSales,
    cashRefundsOnSalesReturns,
    supplierCashPaid,
    supplierReturnCashReceived,
    voucherCashReceipts,
    voucherCashPayments,
    pettyExpenses,
    tokenCashPayouts,
    expectedCash,
    details: {
      forwardSalesCount,
      salesReturnCount,
      supplierPurchaseCount,
      supplierReturnCount,
      voucherReceiptCount,
      voucherPaymentCount,
      expenseCount,
      tokenPayoutCount,
    },
  };
}
