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
  itemsCount: number;
  status: 'Completed' | 'Returned' | 'Partial Return';
  salesman: string;
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
  shiftTitle: string;
  shiftTime: string;
  cashierName: string;
  registerNo: string;
  financialSummary: {
    openingBalance: number;
    cashSales: number;
    creditSales: number;
    bankCardSales: number;
    pettyExpenses: number;
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
  paymentStatus: 'Paid' | 'Partial' | 'Due';
  stockReceivedQty: number;
  invoiceBillRef: string;
  receivedBy: string;
  items: PurchaseItem[];
}
