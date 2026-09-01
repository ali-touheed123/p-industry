'use client';

import React, { useState } from 'react';
import { Customer } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { X, Users, History, AlertCircle, PlusCircle, CheckCircle2, DollarSign } from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  branchName: string;
  tenantId?: string;
  onPaymentRecorded?: () => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
  branchName,
  tenantId,
  onPaymentRecorded,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'aging' | 'info'>('transactions');
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMode, setPayMode] = useState<string>('Cash');
  const [payRefNo, setPayRefNo] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !payAmount || !tenantId) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          voucher_type: 'receipt',
          party_type: 'client',
          party_id: customer.id,
          party_name: customer.name,
          amount: parseFloat(payAmount) || 0,
          payment_mode: payMode,
          reference_no: payMode !== 'Cash' ? payRefNo : null,
          remarks: `Recovery Collection — ${payMode}${payRefNo ? ` (Ref: ${payRefNo})` : ''}${payNotes ? ` • ${payNotes}` : ''}`,
          created_by: 'CEO Management',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowPayModal(false);
        setPayAmount('');
        setPayRefNo('');
        setPayNotes('');
        if (onPaymentRecorded) {
          onPaymentRecorded();
        }
      } else {
        setErrorMsg(data.error || 'Failed to record payment');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recording payment receipt');
    } finally {
      setSubmitting(false);
    }
  };

  if (!customer) return null;

  return (
    <div className="ceo-modal-overlay">
      <div id="customer-detail-modal" className="ceo-modal-box">
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', fontWeight: 700, fontSize: '16px' }} className="ceo-font-heading">
              {customer.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {customer.name}
                </h3>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
                  {customer.category}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'flex', gap: '8px' }}>
                <span className="ceo-font-mono">{customer.phone}</span>
                <span>•</span>
                <span>{customer.city}</span>
              </div>
            </div>
          </div>
          <button
            id="close-customer-modal-btn"
            onClick={onClose}
            style={{ color: '#64748B', padding: '6px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', cursor: 'pointer' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Executive KPI Bar */}
        <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Current Debt (Udhaar)</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: customer.totalDebt > 0 ? '#F87171' : '#34D399' }}>
              {formatCurrency(customer.totalDebt)}
            </div>
            <div className="ceo-font-mono" style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Limit: {formatCurrency(customer.creditLimit)}
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Total Paid to Date</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#34D399' }}>
              {formatCurrency(customer.amountPaidToDate)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Cleared balances</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Lifetime Purchases</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#D97706' }}>
              {formatCurrency(customer.lifetimePurchases)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Gross billing volume</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Credit Risk</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: customer.riskLevel === 'Low' ? '#34D399' : '#D97706', marginTop: '2px' }}>
              {customer.riskLevel} Risk
            </div>
            <div className="ceo-font-mono" style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Last: {customer.lastTransactionDate}</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ padding: '10px 24px 0', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'transactions' ? '#D97706' : '#64748B',
              borderBottom: activeTab === 'transactions' ? '2px solid #D97706' : '2px solid transparent',
            }}
          >
            Ledger Statements ({customer.transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('aging')}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'aging' ? '#D97706' : '#64748B',
              borderBottom: activeTab === 'aging' ? '2px solid #D97706' : '2px solid transparent',
            }}
          >
            Debt Aging Analysis
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#F8FAFC' }}>
          {activeTab === 'transactions' && (
            <div className="ceo-table-container">
              <table className="ceo-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Ref #</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Debit (Billed)</th>
                    <th style={{ textAlign: 'right' }}>Credit (Paid)</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="ceo-font-mono" style={{ color: '#64748B' }}>{tx.date}</td>
                      <td>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          backgroundColor: tx.type === 'Invoice' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                          color: tx.type === 'Invoice' ? '#F87171' : '#34D399',
                        }}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="ceo-font-mono" style={{ color: '#0F172A' }}>{tx.referenceNo}</td>
                      <td style={{ color: '#64748B' }}>{tx.description}</td>
                      <td style={{ textAlign: 'right', color: '#F87171' }} className="ceo-font-mono">
                        {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#34D399' }} className="ceo-font-mono">
                        {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#D97706' }} className="ceo-font-mono">
                        {formatCurrency(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                  {customer.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                        No ledger transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'aging' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Current (0 - 30 Days)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
                    {formatCurrency(customer.aging.current)}
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0' }}>Fresh credit within acceptable payment cycle.</p>
                </div>

                <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Due (31 - 60 Days)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#D97706', marginTop: '6px' }}>
                    {formatCurrency(customer.aging.days30to60)}
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0' }}>Overdue cycle. Reminder recommended.</p>
                </div>

                <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Critical (60+ Days)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
                    {formatCurrency(customer.aging.days60plus)}
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0' }}>High risk debt. Hold credit billing.</p>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Aging Percentage Split</div>
                <div style={{ height: '12px', width: '100%', backgroundColor: '#F8FAFC', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(customer.aging.current / (customer.totalDebt || 1)) * 100}%`, backgroundColor: '#34D399' }} />
                  <div style={{ width: `${(customer.aging.days30to60 / (customer.totalDebt || 1)) * 100}%`, backgroundColor: '#D97706' }} />
                  <div style={{ width: `${(customer.aging.days60plus / (customer.totalDebt || 1)) * 100}%`, backgroundColor: '#F87171' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {customer.totalDebt > 0 ? (
              <button
                onClick={() => {
                  setPayAmount(customer.totalDebt.toString());
                  setShowPayModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <DollarSign style={{ width: '14px', height: '14px' }} />
                Receive Payment / Record Receipt
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                Account Settled (Zero Outstanding Debt)
              </span>
            )}
          </div>

          <button onClick={onClose} className="ceo-btn-gold">
            Close Statement
          </button>
        </div>
      </div>

      {/* ── Sub-Modal: CEO Record Payment / Recovery ── */}
      {showPayModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#161B22', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign style={{ width: '18px', height: '18px', color: '#D97706' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Record Payment Receipt
                </h3>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', fontSize: '12px' }}>
              <div style={{ color: '#64748B' }}>Client: <strong style={{ color: '#0F172A' }}>{customer.name}</strong></div>
              <div style={{ color: '#F87171', fontWeight: 600, marginTop: '2px' }}>
                Outstanding Debt: {formatCurrency(customer.totalDebt)}
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 16px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: '12px', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRecordPayment} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Received Amount (PKR) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  placeholder="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    color: '#0F172A',
                    fontSize: '13px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Payment Mode
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    color: '#0F172A',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Online Bank Transfer">Online Bank Transfer (Meezan / HBL)</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                </select>
              </div>

              {/* Reference number only when not Cash */}
              {payMode !== 'Cash' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    {payMode === 'Cheque' ? 'Cheque # / Bank Details *' : 'Transaction Ref # / ID *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={payMode === 'Cheque' ? 'e.g. Cheque #881920 (Meezan Bank)' : 'e.g. TRX-991204 / HBL Ref #'}
                    value={payRefNo}
                    onChange={(e) => setPayRefNo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      color: '#0F172A',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared Site A overdue invoices"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    color: '#0F172A',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#1E232B',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    color: '#64748B',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#D97706',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Recording...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
