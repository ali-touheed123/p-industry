'use client';

import React, { useState } from 'react';
import { Shift, PettyExpense, Tenant } from '@/types';

interface Props {
  shift: Shift | null;
  tenantId?: string;
  tenant?: Tenant | null;
  staffName?: string;
  tenantName?: string;
  ownerPhone?: string;
  expenses: PettyExpense[];
  invoices?: any[];
  totalSales: number;
  onAddExpense: (expense: PettyExpense) => void;
  onShiftClosed?: (closedShift: Shift) => void;
}

export default function ShiftDrawer({
  shift,
  tenantId,
  tenant,
  staffName = 'Counter Staff',
  tenantName = 'Paint House',
  ownerPhone = '',
  expenses,
  invoices = [],
  totalSales,
  onAddExpense,
  onShiftClosed,
}: Props) {
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Staff');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Closing Shift State
  const [actualCashInput, setActualCashInput] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [showPrintSummary, setShowPrintSummary] = useState(false);
  const [closedShiftData, setClosedShiftData] = useState<any | null>(null);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [dbExpenses, setDbExpenses] = useState<PettyExpense[]>([]);

  // Fetch today's purchases, invoices and expenses for current shift/tenant
  React.useEffect(() => {
    if (!tenantId) return;
    const fetchShiftData = async () => {
      try {
        const todayIso = new Date().toISOString().split('T')[0];
        const [purchasesRes, invoicesRes, expensesRes] = await Promise.all([
          fetch(`/api/purchases?tenant_id=${tenantId}`),
          fetch(`/api/invoices?tenant_id=${tenantId}${shift?.id ? `&shift_id=${shift.id}` : `&start_date=${todayIso}`}`),
          fetch(`/api/expenses?tenant_id=${tenantId}${shift?.id ? `&shift_id=${shift.id}` : ''}`),
        ]);

        const [purchasesData, invoicesData, expensesData] = await Promise.all([
          purchasesRes.json(),
          invoicesRes.json(),
          expensesRes.json(),
        ]);

        if (purchasesData.success) {
          setPurchases(purchasesData.purchases || []);
        }
        if (invoicesData.success && invoicesData.invoices && invoicesData.invoices.length > 0) {
          setDbInvoices(invoicesData.invoices);
        }
        if (expensesData.success && expensesData.expenses && expensesData.expenses.length > 0) {
          setDbExpenses(expensesData.expenses);
        }
      } catch (err) {
        console.error('Error fetching shift drawer data', err);
      }
    };
    fetchShiftData();
  }, [tenantId, shift?.id]);

  // Combine passed props with DB records (deduplicating by id)
  const activeInvoices = React.useMemo(() => {
    const map = new Map<string, any>();
    dbInvoices.forEach(inv => map.set(inv.id, inv));
    (invoices || []).forEach(inv => map.set(inv.id, inv));
    return Array.from(map.values());
  }, [dbInvoices, invoices]);

  const activeExpenses = React.useMemo(() => {
    const map = new Map<string, PettyExpense>();
    dbExpenses.forEach(exp => map.set(exp.id, exp));
    (expenses || []).forEach(exp => map.set(exp.id, exp));
    return Array.from(map.values());
  }, [dbExpenses, expenses]);

  // Dynamic Sales & Returns breakdown from live invoices
  const openingCash = shift?.opening_cash || 0;
  
  const salesInvoices = activeInvoices.filter(i => (i.invoice_type || 'sales') !== 'return');
  const returnInvoices = activeInvoices.filter(i => (i.invoice_type || 'sales') === 'return');

  const grossSales = salesInvoices.length > 0
    ? salesInvoices.reduce((s, i) => s + Number(i.grandTotal || i.net_total || 0), 0)
    : (totalSales > 0 ? totalSales : 0);

  const totalSalesReturns = returnInvoices.reduce((s, i) => s + Number(i.grandTotal || i.net_total || 0), 0);
  const netSales = Math.max(0, grossSales - totalSalesReturns);

  const cashSales = salesInvoices.length > 0
    ? salesInvoices.filter(i => !i.payment_type || i.payment_type === 'cash').reduce((s, i) => s + Number(i.cash_paid || i.paid_amount || i.grandTotal || i.net_total || 0), 0)
    : (totalSales > 0 ? totalSales : 0);

  const cashReturns = returnInvoices
    .filter(i => !i.payment_type || i.payment_type === 'cash')
    .reduce((s, i) => s + Number(i.paid_amount || i.grandTotal || i.net_total || 0), 0);

  const creditSales = salesInvoices
    .filter(i => i.payment_type === 'credit')
    .reduce((s, i) => s + Number(i.due_amount || i.grandTotal || i.net_total || 0), 0);

  const bankSales = salesInvoices
    .filter(i => i.payment_type === 'bank' || i.payment_type === 'card' || i.payment_type === 'cheque')
    .reduce((s, i) => s + Number(i.bank_paid || i.card_paid || i.grandTotal || i.net_total || 0), 0);

  // Dynamic Purchases breakdown
  const regularPurchases = purchases.filter(p => (p.purchase_type || 'purchase') !== 'return');
  const purchaseReturns = purchases.filter(p => (p.purchase_type || 'purchase') === 'return');

  const totalPurchases = regularPurchases.reduce((s, p) => s + Number(p.net_total || 0), 0);
  const totalPurchaseReturns = purchaseReturns.reduce((s, p) => s + Number(p.net_total || 0), 0);
  const supplierCashPaid = regularPurchases
    .reduce((s, p) => s + Number(p.paid_amount || (p.payment_type === 'cash' ? p.net_total : 0) || 0), 0);

  const totalSalesAggregate = grossSales;
  const currentExpenses = activeExpenses;
  const totalExpenses = currentExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Exact Daraz Reconciliation Formula:
  // Expected Cash = Opening Cash + Cash Inflow (Sales) - Cash Outflow (Sales Returns + Supplier Cash + Expenses)
  const expectedCash = Math.max(0, openingCash + cashSales - cashReturns - supplierCashPaid - totalExpenses);

  // Actual Physical Cash & Variance
  const actualPhysicalCash = actualCashInput !== '' ? (parseFloat(actualCashInput) || 0) : expectedCash;
  const variance = actualPhysicalCash - expectedCash;
  const isShort = variance < 0;
  const isBalanced = variance === 0;

  // Commission Settings (Configured by CEO / Tenant)
  const isCommissionEnabled = Boolean(tenant?.commission_enabled);
  const commissionRate = Number(tenant?.commission_rate || 2.0);
  const splitLead = Number(tenant?.commission_split_lead || 35.0);
  const splitStaff = Number(tenant?.commission_split_staff || 35.0);

  // Commission Breakdown (Only calculated if enabled)
  const commissionPool = isCommissionEnabled ? Math.round(netSales * (commissionRate / 100)) : 0;
  const staffAShare = isCommissionEnabled ? Math.round(commissionPool * (splitLead / 100)) : 0;
  const staffBShare = isCommissionEnabled ? Math.round(commissionPool * (splitStaff / 100)) : 0;

  // Add Petty Expense to DB
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount) return;
    setSubmittingExpense(true);

    try {
      if (tenantId) {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            shift_id: shift?.id || null,
            category: expenseCategory,
            title: expenseTitle,
            amount: parseFloat(expenseAmount) || 0,
            paid_by: staffName,
          }),
        });
        const data = await res.json();
        if (data.success && data.expense) {
          onAddExpense(data.expense);
          setDbExpenses(prev => [data.expense, ...prev]);
        } else {
          // Fallback local
          const fallbackExp = {
            id: Date.now().toString(),
            tenant_id: tenantId,
            shift_id: shift?.id || 'shift-1',
            category: expenseCategory,
            title: expenseTitle,
            amount: parseFloat(expenseAmount) || 0,
            created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          onAddExpense(fallbackExp);
          setDbExpenses(prev => [fallbackExp, ...prev]);
        }
      } else {
        onAddExpense({
          id: Date.now().toString(),
          tenant_id: '',
          shift_id: 'shift-1',
          category: expenseCategory,
          title: expenseTitle,
          amount: parseFloat(expenseAmount) || 0,
          created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }

      setExpenseTitle('');
      setExpenseAmount('');
      setShowExpenseModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Close & Reconcile Shift
  const handleCloseShift = async () => {
    if (!confirm('Are you sure you want to close today\'s register shift?')) return;
    setIsClosing(true);

    const shiftDataToSave = {
      id: shift?.id || Date.now().toString(),
      closed_by: staffName,
      expected_cash: expectedCash,
      actual_cash: actualPhysicalCash,
      difference: variance,
      status: 'closed',
      notes: `Closed by ${staffName}. Variance: ${variance}`,
    };

    try {
      if (shift?.id && tenantId) {
        await fetch('/api/shifts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shiftDataToSave),
        });
      }
      setClosedShiftData(shiftDataToSave);
      setShowPrintSummary(true);
      if (onShiftClosed) onShiftClosed(shiftDataToSave as any);
    } catch (err) {
      console.error(err);
      setShowPrintSummary(true);
    } finally {
      setIsClosing(false);
    }
  };

  // WhatsApp Day Close Summary
  const handleSendWhatsAppSummary = () => {
    const message = `*${tenantName} — Daily Shift Closing Summary*\n` +
      `Staff: ${staffName}\n` +
      `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n` +
      `--------------------------------\n` +
      `• Opening Daraz Cash: Rs. ${openingCash.toLocaleString()}\n` +
      `• Gross Sales: Rs. ${grossSales.toLocaleString()} (${salesInvoices.length} invoices)\n` +
      (totalSalesReturns > 0 ? `• Customer Returns: -Rs. ${totalSalesReturns.toLocaleString()} (${returnInvoices.length} returns)\n` : '') +
      `• Net Sales: Rs. ${netSales.toLocaleString()}\n` +
      `• Cash Inflow (Sales): +Rs. ${cashSales.toLocaleString()}\n` +
      (cashReturns > 0 ? `• Cash Returns Refunded: -Rs. ${cashReturns.toLocaleString()}\n` : '') +
      (supplierCashPaid > 0 ? `• Supplier Cash Paid: -Rs. ${supplierCashPaid.toLocaleString()}\n` : '') +
      `• Total Petty Expenses: -Rs. ${totalExpenses.toLocaleString()}\n` +
      (totalPurchases > 0 ? `• Total Purchases Today: Rs. ${totalPurchases.toLocaleString()}\n` : '') +
      `--------------------------------\n` +
      `*Expected Cash:* Rs. ${expectedCash.toLocaleString()}\n` +
      `*Actual Physical Cash:* Rs. ${actualPhysicalCash.toLocaleString()}\n` +
      `*Variance:* ${variance < 0 ? `- Rs. ${Math.abs(variance).toLocaleString()} (SHORT)` : variance > 0 ? `+ Rs. ${variance.toLocaleString()} (OVER)` : 'Rs. 0 (BALANCED)'}\n` +
      (isCommissionEnabled && commissionPool > 0 ? `--------------------------------\n*Commission Pool (${commissionRate}%):* Rs. ${commissionPool.toLocaleString()}\n` : '') +
      `Status: Shift Closed & Verified`;

    const phone = ownerPhone.replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', paddingBottom: '1rem' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Shift End Reconciliation
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '12px', color: '#64748B' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              📅 {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span>•</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>⏰ Active Register</span>
            <span>•</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>👤 {staffName}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleSendWhatsAppSummary}
            className="btn"
            style={{ background: '#22c55e', color: '#fff', fontSize: '12px', padding: '6px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Send WhatsApp Day Close to CEO"
          >
            <span style={{ fontSize: '14px' }}>💬</span>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleCloseShift}
            disabled={isClosing}
            className="btn btn-primary"
            style={{ fontSize: '12px', padding: '6px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Reconcile & Close Register"
          >
            <span>🔒</span>
            {isClosing ? 'Closing Shift...' : 'Close & Reconcile'}
          </button>
        </div>
      </div>

      {/* ── Top 4 KPI Summary Cards (Horizontal Balanced Bar) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
        {/* KPI 1: Expected Drawer Cash */}
        <div className="card" style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
              Expected Cash
            </span>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '4px',
                background: isBalanced ? '#DCFCE7' : isShort ? '#FEE2E2' : '#FFEDD5',
                color: isBalanced ? '#166534' : isShort ? '#991B1B' : '#9A3412',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {isBalanced ? 'BALANCED' : isShort ? 'SHORT' : 'OVER'}
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
            Rs. {expectedCash.toLocaleString()}
          </div>
          <div style={{ fontSize: '10.5px', color: '#64748B' }}>
            Counted: <strong style={{ color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>Rs. {actualPhysicalCash.toLocaleString()}</strong>
          </div>
        </div>

        {/* KPI 2: Net Sales Today */}
        <div className="card" style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
              Net Sales
            </span>
            <span style={{ fontSize: '9.5px', color: '#16A34A', fontWeight: 700, background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
              {salesInvoices.length} Bills
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', fontFamily: 'JetBrains Mono, monospace' }}>
            Rs. {netSales.toLocaleString()}
          </div>
          <div style={{ fontSize: '10.5px', color: '#64748B' }}>
            Gross: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {grossSales.toLocaleString()}</span>
            {totalSalesReturns > 0 && <span style={{ color: '#DC2626', marginLeft: '4px' }}>(-{totalSalesReturns.toLocaleString()})</span>}
          </div>
        </div>

        {/* KPI 3: Purchases Today */}
        <div className="card" style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
              Purchases
            </span>
            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
              {regularPurchases.length} Orders
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
            Rs. {totalPurchases.toLocaleString()}
          </div>
          <div style={{ fontSize: '10.5px', color: '#64748B' }}>
            Paid Cash: <strong style={{ color: '#EA580C', fontFamily: 'JetBrains Mono, monospace' }}>Rs. {supplierCashPaid.toLocaleString()}</strong>
          </div>
        </div>

        {/* KPI 4: Petty Expenses */}
        <div className="card" style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
              Petty Expenses
            </span>
            <span style={{ fontSize: '9.5px', color: '#DC2626', fontWeight: 600, background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
              {currentExpenses.length} Entries
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', fontFamily: 'JetBrains Mono, monospace' }}>
            - Rs. {totalExpenses.toLocaleString()}
          </div>
          <div style={{ fontSize: '10.5px', color: '#64748B' }}>
            Staff &amp; Tea Expenses
          </div>
        </div>
      </div>

      {/* ── 3-Column Equal Balanced Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem', alignItems: 'stretch' }}>
        
        {/* ── Col 1: Cash Drawer & Physical Count ── */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                💵 Cash Reconciliation
              </span>
              <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>DARAZ HISAB</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Opening Cash</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>Rs. {openingCash.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>(+) Cash Sales Inflow</span>
                <span className="font-mono font-bold" style={{ color: '#16A34A' }}>+ Rs. {cashSales.toLocaleString()}</span>
              </div>
              {cashReturns > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#DC2626', fontWeight: 600 }}>(-) Customer Returns</span>
                  <span className="font-mono font-bold" style={{ color: '#DC2626' }}>- Rs. {cashReturns.toLocaleString()}</span>
                </div>
              )}
              {supplierCashPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#EA580C', fontWeight: 600 }}>(-) Supplier Cash Paid</span>
                  <span className="font-mono font-bold" style={{ color: '#EA580C' }}>- Rs. {supplierCashPaid.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#DC2626', fontWeight: 600 }}>(-) Petty Expenses</span>
                <span className="font-mono font-bold" style={{ color: '#DC2626' }}>- Rs. {totalExpenses.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontWeight: 800, color: '#0F172A' }}>Expected Cash</span>
                <span className="font-mono font-bold" style={{ fontSize: '14px', color: '#0F172A' }}>
                  Rs. {expectedCash.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Physical Cash Input Box */}
          <div style={{ marginTop: '0.75rem', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Counted Physical Cash
              </span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: isBalanced ? '#16A34A' : '#DC2626', fontFamily: 'JetBrains Mono, monospace' }}>
                {variance === 0 ? 'Exact Match' : variance < 0 ? `Short: Rs. ${Math.abs(variance).toLocaleString()}` : `Over: +Rs. ${variance.toLocaleString()}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>Rs.</span>
              <input
                type="number"
                value={actualCashInput !== '' ? actualCashInput : expectedCash}
                onChange={e => setActualCashInput(e.target.value)}
                style={{
                  width: '100%',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#0F172A',
                  outline: 'none',
                }}
                placeholder="Enter physical cash"
              />
            </div>
          </div>
        </div>

        {/* ── Col 2: Trading & Commission Breakdown ── */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📊 Sales &amp; Commission
              </span>
              <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>BREAKDOWN</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Cash Sales</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>Rs. {cashSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Credit / Udhaar</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>Rs. {creditSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Bank / Online</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>Rs. {bankSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '4px' }}>
                <span style={{ color: '#64748B' }}>Gross Total Sales</span>
                <span className="font-mono font-bold" style={{ color: '#0F172A' }}>Rs. {grossSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Commission Pool Box (Only visible if CEO turned it ON) */}
          {isCommissionEnabled && (
            <div style={{ marginTop: '0.75rem', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F172A' }}>Staff Commission ({commissionRate}%)</span>
                <span className="font-mono font-bold" style={{ fontSize: '12.5px', color: '#2563EB' }}>
                  Rs. {commissionPool.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                <span>{staffName} ({splitLead}%): <strong style={{ color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>Rs. {staffAShare.toLocaleString()}</strong></span>
                <span>Floor Staff ({splitStaff}%): <strong style={{ color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>Rs. {staffBShare.toLocaleString()}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* ── Col 3: Petty Cash Expenses Log ── */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                💸 Petty Cash Log
              </span>
              <button
                type="button"
                onClick={() => setShowExpenseModal(true)}
                style={{
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                + Add Expense
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {currentExpenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94A3B8', fontSize: '11.5px' }}>
                  No petty expenses recorded today.
                </div>
              ) : (
                currentExpenses.map(exp => (
                  <div
                    key={exp.id}
                    style={{
                      padding: '6px 8px',
                      background: '#F8FAFC',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A' }}>{exp.title}</div>
                      <div style={{ fontSize: '9.5px', color: '#64748B' }}>{exp.category} · {exp.created_at || 'Today'}</div>
                    </div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 800, color: '#DC2626' }}>
                      Rs. {Number(exp.amount).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Expenses:</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '13px', color: '#DC2626' }}>
              - Rs. {totalExpenses.toLocaleString()}
            </span>
          </div>
        </div>

      </div>

      {/* ── Add Expense Modal ── */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="headline-sm">Record Petty Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Expense Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Tea & Snacks / Freight / Carriage"
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value)}
                >
                  <option value="Staff">Staff (Khana, Chai)</option>
                  <option value="Office">Office &amp; Stationery</option>
                  <option value="Operations">Operations / Carriage</option>
                  <option value="Maintenance">Shop Maintenance</option>
                </select>
              </div>
              <div>
                <label className="form-label">Amount (Rs.)</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="form-input"
                  placeholder="0"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowExpenseModal(false)} className="btn btn-secondary-outline btn-full">
                  Cancel
                </button>
                <button type="submit" disabled={submittingExpense} className="btn btn-primary btn-full">
                  {submittingExpense ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Shift Closed Print Summary Receipt ── */}
      {showPrintSummary && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 3000 }}>
          <div style={{ width: '100%', maxWidth: '360px', padding: '1.5rem', background: '#fff', color: '#000', borderRadius: 'var(--radius-md)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '900' }}>{tenantName}</h3>
              <div style={{ fontSize: '13px', fontWeight: '700', marginTop: '2px' }}>SHIFT CLOSING RECEIPT</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}
              </div>
              <div style={{ fontSize: '11px', color: '#444' }}>Cashier: {staffName}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Opening Cash:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {openingCash.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cash Sales:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>+ Rs. {cashSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Petty Expenses:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>- Rs. {totalExpenses.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', borderTop: '1px solid #ddd', paddingTop: '4px', marginTop: '2px' }}>
                <span>Expected Cash:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {expectedCash.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                <span>Actual Cash Counted:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {actualPhysicalCash.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', color: isBalanced ? '#065f46' : '#ba1a1a', marginTop: '4px' }}>
                <span>Variance:</span>
                <span>{variance < 0 ? `- Rs. ${Math.abs(variance).toLocaleString()} (SHORT)` : variance > 0 ? `+ Rs. ${variance.toLocaleString()} (OVER)` : 'Rs. 0 (BALANCED)'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '9px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                Print Receipt
              </button>
              <button onClick={() => setShowPrintSummary(false)} style={{ flex: 1, padding: '9px', background: '#e2e8f0', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}