/**
 * PyntFlow Standardized Cash Reconciliation Utility
 * Standardizes Expected Closing Cash formula across Shift Drawer and Day Close.
 * Formula: Expected Closing Cash = Opening Cash + Cash Sales - Cash Returns - Petty Expenses - Supplier Cash Payouts - Token Cash Payouts
 * Task 13.1.4 (MF-FIN-001)
 */

export interface CashReconciliationParams {
  openingCash: number;
  cashSales: number;
  cashReturns?: number;
  expenses?: number;
  supplierPayouts?: number;
  tokenPayouts?: number;
}

/**
 * Calculates authoritative expected closing cash.
 */
export function calculateExpectedClosingCash(params: CashReconciliationParams): number {
  const opening = Number(params.openingCash || 0);
  const sales = Number(params.cashSales || 0);
  const returns = Number(params.cashReturns || 0);
  const exp = Number(params.expenses || 0);
  const supplier = Number(params.supplierPayouts || 0);
  const token = Number(params.tokenPayouts || 0);

  return opening + sales - returns - exp - supplier - token;
}
