'use client';

import React, { useState } from 'react';
import { Shift, PettyExpense } from '@/types';

interface Props {
  shift: Shift | null;
  tenantId?: string;
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

  // Dynamic Sales breakdown from live invoices
  const openingCash = shift?.opening_cash || 15000;
  
  const cashSales = invoices.length > 0
    ? invoices.filter(i => !i.payment_type || i.payment_type === 'cash').reduce((s, i) => s + (i.grandTotal || i.net_total || 0), 0)
    : (totalSales > 0 ? totalSales : 125450);

  const creditSales = invoices.length > 0
    ? invoices.filter(i => i.payment_type === 'credit').reduce((s, i) => s + (i.grandTotal || i.net_total || 0), 0)
    : 45000;

  const bankSales = invoices.length > 0
    ? invoices.filter(i => i.payment_type === 'bank' || i.payment_type === 'cheque').reduce((s, i) => s + (i.grandTotal || i.net_total || 0), 0)
    : 20000;

  const totalSalesAggregate = cashSales + creditSales + bankSales;

  const currentExpenses = expenses.length > 0 
    ? expenses 
    : [
        { id: '1', tenant_id: '', category: 'Staff', title: 'Tea & Snacks', amount: 450, created_at: '10:30 AM' },
        { id: '2', tenant_id: '', category: 'Office', title: 'Stationery (Pens)', amount: 250, created_at: '01:15 PM' },
        { id: '3', tenant_id: '', category: 'Operations', title: 'Labor (Unloading)', amount: 500, created_at: '03:00 PM' },
      ];

  const totalExpenses = currentExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expectedCash = openingCash + cashSales - totalExpenses;

  // Actual Physical Cash & Variance
  const actualPhysicalCash = actualCashInput !== '' ? parseFloat(actualCashInput) || 0 : (expectedCash - 250);
  const variance = actualPhysicalCash - expectedCash;
  const isShort = variance < 0;
  const isBalanced = variance === 0;

  // 2% Commission Breakdown
  const commissionPool = Math.round(totalSalesAggregate * 0.02);
  const staffAShare = Math.round(commissionPool * 0.35);
  const staffBShare = Math.round(commissionPool * 0.35);

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
        } else {
          // Fallback local
          onAddExpense({
            id: Date.now().toString(),
            tenant_id: tenantId,
            shift_id: shift?.id || 'shift-1',
            category: expenseCategory,
            title: expenseTitle,
            amount: parseFloat(expenseAmount) || 0,
            created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
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
      `• Total Sales (Cash): Rs. ${cashSales.toLocaleString()}\n` +
      `• Sales (Credit/Udhaar): Rs. ${creditSales.toLocaleString()}\n` +
      `• Sales (Bank/Online): Rs. ${bankSales.toLocaleString()}\n` +
      `• Total Petty Expenses: -Rs. ${totalExpenses.toLocaleString()}\n` +
      `--------------------------------\n` +
      `*Expected Cash:* Rs. ${expectedCash.toLocaleString()}\n` +
      `*Actual Physical Cash:* Rs. ${actualPhysicalCash.toLocaleString()}\n` +
      `*Variance:* ${variance < 0 ? `- Rs. ${Math.abs(variance).toLocaleString()} (SHORT)` : variance > 0 ? `+ Rs. ${variance.toLocaleString()} (OVER)` : 'Rs. 0 (BALANCED)'}\n` +
      `--------------------------------\n` +
      `*Commission Pool (2%):* Rs. ${commissionPool.toLocaleString()}\n` +
      `Status: Shift Closed & Verified`;

    const phone = ownerPhone.replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Shift End Reconciliation</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '4px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
              08:00 AM - 04:30 PM
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
              {staffName}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.print()} className="btn btn-secondary-outline" title="Print Summary Receipt">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            PDF
          </button>
          <button onClick={handleSendWhatsAppSummary} className="btn" style={{ background: '#22c55e', color: '#fff' }} title="Send Day Close to CEO">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
            WhatsApp
          </button>
          <button onClick={handleCloseShift} disabled={isClosing} className="btn btn-primary" title="Reconcile & Close Register">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>done_all</span>
            {isClosing ? 'Closing...' : 'Close & Print'}
          </button>
        </div>
      </div>

      {/* ── 3-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* ── Col 1: Financial Summary & Reconciliation Status ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Financial Summary Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 className="headline-sm" style={{ marginBottom: '1.25rem' }}>Financial Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Opening Balance</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>Rs. {openingCash.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Total Sales (Cash)</span>
                <span className="font-mono font-bold" style={{ color: '#16a34a' }}>Rs. {cashSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '1rem' }}>
                <span style={{ color: 'var(--on-surface-variant)', fontSize: '12px' }}>Sales (Credit)</span>
                <span className="font-mono text-muted" style={{ fontSize: '12px' }}>Rs. {creditSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '1rem' }}>
                <span style={{ color: 'var(--on-surface-variant)', fontSize: '12px' }}>Sales (Bank/Card)</span>
                <span className="font-mono text-muted" style={{ fontSize: '12px' }}>Rs. {bankSales.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--on-surface-variant)' }}>Petty Expenses</span>
                <span className="font-mono font-bold" style={{ color: 'var(--error)' }}>- Rs. {totalExpenses.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--outline-variant)', paddingTop: '0.875rem', marginTop: '0.25rem' }}>
                <span style={{ fontWeight: 700 }}>Expected Cash</span>
                <span className="font-mono" style={{ fontSize: '15px', fontWeight: 800 }}>
                  Rs. {expectedCash.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Light Blue Reconciliation Status Card */}
          <div
            style={{
              background: '#dce9ff',
              border: '1px solid #c2d8ff',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ color: 'var(--on-surface)', fontSize: '16px', fontWeight: 700 }}>Reconciliation Status</h4>
              <button
                onClick={() => {
                  const val = prompt('Enter counted physical cash in drawer:', actualPhysicalCash.toString());
                  if (val !== null) setActualCashInput(val);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Edit Count
              </button>
            </div>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '12px', marginBottom: '1.25rem' }}>
              Difference between Expected and Actual Physical Cash.
            </p>
            
            <div className="label-caps" style={{ color: 'var(--on-surface-variant)', marginBottom: '4px' }}>VARIANCE AMOUNT</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: isBalanced ? '#16a34a' : 'var(--error)' }}>
                  {isBalanced ? 'check_circle' : 'trending_down'}
                </span>
                <span className="font-mono font-bold" style={{ fontSize: '24px', color: isBalanced ? '#16a34a' : 'var(--error)' }}>
                  {variance < 0 ? `- Rs. ${Math.abs(variance).toLocaleString()}` : variance > 0 ? `+ Rs. ${variance.toLocaleString()}` : 'Rs. 0'}
                </span>
              </div>
              <span
                style={{
                  background: isBalanced ? '#16a34a' : isShort ? '#ba1a1a' : '#0051d5',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 800,
                  fontSize: '11px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {isBalanced ? 'BALANCED' : isShort ? 'SHORT' : 'OVER'}
              </span>
            </div>
          </div>

        </div>

        {/* ── Col 2: Staff Commission Breakdown ── */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 className="headline-sm" style={{ marginBottom: '1.25rem' }}>
            Staff Commission<br />Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Total Sales</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>Rs. {totalSalesAggregate.toLocaleString()}</span>
            </div>

            {/* Highlight Box for Commission Pool */}
            <div
              style={{
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--on-background)' }}>Commission Pool</div>
                <div className="label-caps" style={{ color: 'var(--on-surface-variant)', marginTop: '2px', fontSize: '10px' }}>2% OF TOTAL SALES</div>
              </div>
              <div className="font-mono text-blue font-bold" style={{ fontSize: '17px' }}>
                Rs. {commissionPool.toLocaleString()}
              </div>
            </div>

            {/* Staff Share Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{staffName} (Lead)</div>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>35% Share</div>
                </div>
                <div className="font-mono" style={{ fontWeight: 600, fontSize: '13px' }}>
                  Rs. {staffAShare.toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Floor Staff (Junior)</div>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>35% Share</div>
                </div>
                <div className="font-mono" style={{ fontWeight: 600, fontSize: '13px' }}>
                  Rs. {staffBShare.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Col 3: Petty Cash Log ── */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 className="headline-sm">Petty Cash Log</h3>
            <button
              onClick={() => setShowExpenseModal(true)}
              style={{ width: 30, height: 30, borderRadius: 'var(--radius-full)', background: 'var(--secondary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Add Expense"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: '260px', maxHeight: '380px', overflowY: 'auto' }}>
            {currentExpenses.map(exp => (
              <div
                key={exp.id}
                style={{ padding: '0.875rem 1rem', background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline-variant)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{exp.title}</span>
                  <span className="font-mono font-bold" style={{ fontSize: '13px', color: 'var(--error)' }}>
                    Rs. {exp.amount.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  <span>{exp.created_at || '10:30 AM'}</span>
                  <span
                    style={{
                      background: 'var(--surface-container-high)',
                      color: 'var(--on-surface)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    {exp.category}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '0.875rem', marginTop: '0.875rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              Total Expenses: <strong className="font-mono" style={{ color: 'var(--error)', marginLeft: '4px' }}>Rs. {totalExpenses.toLocaleString()}</strong>
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
              <button onClick={() => window.print()} style={{ flex: 1, padding: '9px', background: '#0051d5', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
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