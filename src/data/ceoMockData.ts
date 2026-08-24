import { Branch, Invoice, ReturnRecord, DayCloseRecord, Customer, PurchaseRecord } from '../types/ceo';

export const formatCurrency = (amount: number): string => {
  return `Rs. ${Math.round(amount || 0).toLocaleString('en-PK')}`;
};

export const BASE_BRANCHES_DATA: Branch[] = [];
export const MOCK_INVOICES: Record<string, Invoice[]> = {};
export const MOCK_RETURNS: Record<string, ReturnRecord[]> = {};
export const MOCK_DAY_CLOSE: Record<string, DayCloseRecord[]> = {};
export const MOCK_CUSTOMERS: Record<string, Customer[]> = {};
export const MOCK_PURCHASES: Record<string, PurchaseRecord[]> = {};
