import type { Invoice as SystemInvoice, InvoiceItem as SystemInvoiceItem } from './index';

export type { SystemInvoice, SystemInvoiceItem };

export interface Branch {
  id: string;
  name: string;
  shortName: string;
  city: string;
  region: string;
  code: string;
  address: string;
  manager: string;
  activeRegisters: number;
  todaySales: number;
  monthlySales: number;
  totalReceivables: number;
  healthStatus: 'Optimal' | 'Attention' | 'Normal';
  inventoryValue: number;
  slug?: string;
  userId?: string;
  counterUsername?: string;
}

export interface InvoiceItem {
  code: string;
  product: string;
  shade: string;
  packUnit: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  customerName: string;
  customerId: string;
  customerCategory: string;
  paymentMode: 'Cash' | 'Credit' | 'Bank/Card' | 'Split';
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  cashPaid?: number;
  cardPaid?: number;
  bankPaid?: number;
  othersPaid?: number;
  itemsCount: number;
  status: 'Completed' | 'Returned' | 'Partial Return';
  salesman: string;
  register?: string;
  shiftId?: string;
  items: InvoiceItem[];
}

export interface ReturnItem {
  code: string;
  product: string;
  shade: string;
  packUnit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  originalInvoiceNo: string;
  date: string;
  time: string;
  customerName: string;
  customerId: string;
  reason: 'Wrong Shade Tinted' | 'Defective Batch' | 'Excess Construction Stock' | 'Can Damage' | 'Customer Changed Plan';
  refundMode: 'Cash Refund' | 'Store Credit / Ledger Offset' | 'Card Reversal';
  totalAmount: number;
  itemsCount: number;
  condition: 'Restocked' | 'Damaged / Write-off' | 'Factory Return';
  processedBy: string;
  items: ReturnItem[];
}

export interface DayCloseRecord {
  id: string;
  date: string;
  startTime?: string;
  status?: 'open' | 'closed';
  isOpen?: boolean;
  shiftTitle: string;
  shiftTime: string;
  cashierName: string;
  registerNo: string;
  financialSummary: {
    openingBalance: number;
    cashSales: number;
    creditSales: number;
    bankCardSales: number;
    othersSales?: number;
    pettyExpenses: number;
    tokenPayouts: number;
    expectedCash: number;
    actualCashCounted: number;
    varianceAmount: number;
    varianceStatus: 'SHORT' | 'EXCESS' | 'MATCHED';
  };
  commissionBreakdown: {
    totalSales: number;
    commissionRate: number;
    commissionPool: number;
    staffShares: {
      id: string;
      name: string;
      role: string;
      sharePct: number;
      amount: number;
    }[];
  };
  pettyCashLogs: {
    id: string;
    title: string;
    time: string;
    department: string;
    amount: number;
  }[];
  handover?: {
    previousClosingCash: number;
    openingCountedCash: number;
    handoverVariance: number;
    handoverStatus: 'MATCHED' | 'SHORT' | 'EXCESS';
    handoverNotes?: string;
  };
  sameDayDelta?: {
    amount: number;
    direction: 'more' | 'less' | 'same';
    previousShiftNetSales: number;
  };
  dailyCashVariance?: {
    totalVariance: number;
    shiftCount: number;
    allShort: boolean;
  };
  cash_breakdown?: any;
}

export interface CustomerTransaction {
  id: string;
  date: string;
  time: string;
  type: 'Invoice' | 'Payment' | 'Return' | 'Opening Balance';
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  paymentMode?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  category: 'Contractor' | 'Wholesale' | 'Retail' | 'Master Painter' | 'Corporate';
  city: string;
  address: string;
  totalDebt: number;
  amountPaidToDate: number;
  lifetimePurchases: number;
  creditLimit: number;
  lastTransactionDate: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
  aging: {
    current: number;
    days30to60: number;
    days60plus: number;
  };
  transactions: CustomerTransaction[];
}

export interface PurchaseItem {
  code: string;
  product: string;
  packUnit: string;
  qty: number;
  unit: string;
  costRate: number;
  amount: number;
}

export interface PurchaseRecord {
  id: string;
  poNumber: string;
  date: string;
  time: string;
  supplierName: string;
  supplierCode: string;
  category: 'Base Emulsions' | 'Colorants & Pigments' | 'Solvent Enamels' | 'Primers & Fillers' | 'Tools & Thinners';
  totalCost: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Due' | 'Credit';
  stockReceivedQty: number;
  invoiceBillRef: string;
  receivedBy: string;
  items: PurchaseItem[];
}

export interface SupplierTransaction {
  id: string;
  date: string;
  time?: string;
  type: 'PO' | 'PMT';
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  paymentMode?: string;
}

export interface CeoSupplier {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  city?: string;
  address?: string;
  category?: string;
  current_balance: number;
  totalPurchases: number;
  totalPaid: number;
  poCount: number;
  transactions: SupplierTransaction[];
}
