'use client';

import React, { useState } from 'react';
import { Customer } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { X, Users, History, AlertCircle } from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  branchName: string;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
  branchName,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'aging' | 'info'>('transactions');

  if (!customer) return null;

  return (
    <div className="ceo-modal-overlay">
      <div id="customer-detail-modal" className="ceo-modal-box">
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #2A2F38', backgroundColor: '#10141B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C6A15B', fontWeight: 700, fontSize: '16px' }} className="ceo-font-heading">
              {customer.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
                  {customer.name}
                </h3>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', color: '#8B93A1', fontWeight: 600 }}>
                  {customer.category}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#8B93A1', marginTop: '2px', display: 'flex', gap: '8px' }}>
                <span className="ceo-font-mono">{customer.phone}</span>
                <span>•</span>
                <span>{customer.city}</span>
              </div>
            </div>
          </div>
          <button
            id="close-customer-modal-btn"
            onClick={onClose}
            style={{ color: '#8B93A1', padding: '6px', borderRadius: '6px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', cursor: 'pointer' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Executive KPI Bar */}
        <div style={{ padding: '16px 24px', backgroundColor: '#12151B', borderBottom: '1px solid #2A2F38', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Current Debt (Udhaar)</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: customer.totalDebt > 0 ? '#F87171' : '#34D399' }}>
              {formatCurrency(customer.totalDebt)}
            </div>
            <div className="ceo-font-mono" style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px' }}>
              Limit: {formatCurrency(customer.creditLimit)}
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Total Paid to Date</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#34D399' }}>
              {formatCurrency(customer.amountPaidToDate)}
            </div>
            <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px' }}>Cleared balances</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Lifetime Purchases</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#C6A15B' }}>
              {formatCurrency(customer.lifetimePurchases)}
            </div>
            <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px' }}>Gross billing volume</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '2px' }}>Credit Risk</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: customer.riskLevel === 'Low' ? '#34D399' : '#C6A15B', marginTop: '2px' }}>
              {customer.riskLevel} Risk
            </div>
            <div className="ceo-font-mono" style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px' }}>Last: {customer.lastTransactionDate}</div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ padding: '10px 24px 0', borderBottom: '1px solid #2A2F38', backgroundColor: '#12151B', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'transactions' ? '#C6A15B' : '#8B93A1',
              borderBottom: activeTab === 'transactions' ? '2px solid #C6A15B' : '2px solid transparent',
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
              color: activeTab === 'aging' ? '#C6A15B' : '#8B93A1',
              borderBottom: activeTab === 'aging' ? '2px solid #C6A15B' : '2px solid transparent',
            }}
          >
            Debt Aging Analysis
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#12151B' }}>
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
                      <td className="ceo-font-mono" style={{ color: '#8B93A1' }}>{tx.date}</td>
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
                      <td className="ceo-font-mono" style={{ color: '#E5E7EB' }}>{tx.referenceNo}</td>
                      <td style={{ color: '#8B93A1' }}>{tx.description}</td>
                      <td style={{ textAlign: 'right', color: '#F87171' }} className="ceo-font-mono">
                        {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#34D399' }} className="ceo-font-mono">
                        {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#C6A15B' }} className="ceo-font-mono">
                        {formatCurrency(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                  {customer.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#8B93A1' }}>
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
                <div style={{ padding: '16px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
                  <div style={{ fontSize: '11px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Current (0 - 30 Days)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
                    {formatCurrency(customer.aging.current)}
                  </div>
                  <p style={{ fontSize: '11px', color: '#8B93A1', margin: '4px 0 0' }}>Fresh credit within acceptable payment cycle.</p>
                </div>

                <div style={{ padding: '16px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
                  <div style={{ fontSize: '11px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Due (31 - 60 Days)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#C6A15B', marginTop: '6px' }}>
                    {formatCurrency(customer.aging.days30to60)}
                  </div>
                  <p style={{ fontSize: '11px', color: '#8B93A1', margin: '4px 0 0' }}>Overdue cycle. Reminder recommended.</p>
                </div>

                <div style={{ padding: '16px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
                  <div style={{ fontSize: '11px', color: '#8B93A1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Critical (60+ Days)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
                    {formatCurrency(customer.aging.days60plus)}
                  </div>
                  <p style={{ fontSize: '11px', color: '#8B93A1', margin: '4px 0 0' }}>High risk debt. Hold credit billing.</p>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#E5E7EB', marginBottom: '8px' }}>Aging Percentage Split</div>
                <div style={{ height: '12px', width: '100%', backgroundColor: '#12151B', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(customer.aging.current / (customer.totalDebt || 1)) * 100}%`, backgroundColor: '#34D399' }} />
                  <div style={{ width: `${(customer.aging.days30to60 / (customer.totalDebt || 1)) * 100}%`, backgroundColor: '#C6A15B' }} />
                  <div style={{ width: `${(customer.aging.days60plus / (customer.totalDebt || 1)) * 100}%`, backgroundColor: '#F87171' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', backgroundColor: '#10141B', borderTop: '1px solid #2A2F38', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="ceo-btn-gold">
            Close Statement
          </button>
        </div>
      </div>
    </div>
  );
};
