'use client';

import React from 'react';
import { CeoSupplier } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { X, Building2, Phone, MapPin, Receipt, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface SupplierDetailModalProps {
  supplier: CeoSupplier | null;
  onClose: () => void;
  branchName: string;
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  onClose,
  branchName,
}) => {
  if (!supplier) return null;

  const isCredit = supplier.current_balance < 0;
  const isSettled = supplier.current_balance === 0;

  return (
    <div className="ceo-modal-overlay">
      <div id="supplier-detail-modal" className="ceo-modal-box" style={{ maxWidth: '850px' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB', fontWeight: 700, fontSize: '16px' }} className="ceo-font-heading">
              {supplier.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {supplier.name}
                </h3>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                  {supplier.code || 'SUPPLIER'}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  backgroundColor: isCredit ? 'rgba(52, 211, 153, 0.15)' : isSettled ? 'rgba(148, 163, 184, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                  color: isCredit ? '#059669' : isSettled ? '#64748B' : '#DC2626',
                }}>
                  {isCredit ? 'Vendor Credit / Advance' : isSettled ? 'Settled' : 'Payable Due'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {supplier.phone && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Phone style={{ width: '12px', height: '12px' }} />
                    <span className="ceo-font-mono">{supplier.phone}</span>
                  </span>
                )}
                {supplier.city && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin style={{ width: '12px', height: '12px' }} />
                    <span>{supplier.city}</span>
                  </span>
                )}
                <span>•</span>
                <span>{branchName}</span>
              </div>
            </div>
          </div>
          <button
            id="close-supplier-modal-btn"
            onClick={onClose}
            style={{ color: '#64748B', padding: '6px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', cursor: 'pointer' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Invoiced (POs)</div>
            <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              {formatCurrency(supplier.totalPurchases)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              {supplier.poCount} Purchase Orders
            </div>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Paid / Disbursed</div>
            <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              {formatCurrency(supplier.totalPaid)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Disbursed via vouchers &amp; tokens
            </div>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: isCredit ? '#ECFDF5' : '#FFFFFF', borderRadius: '8px', border: isCredit ? '1px solid #A7F3D0' : '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: isCredit ? '#065F46' : '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isCredit ? 'Vendor Credit / Advance' : 'Statement Balance'}
            </div>
            <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: isCredit ? '#059669' : isSettled ? '#64748B' : '#DC2626', marginTop: '4px' }}>
              {isCredit ? formatCurrency(Math.abs(supplier.current_balance)) : formatCurrency(supplier.current_balance)}
            </div>
            <div style={{ fontSize: '11px', color: isCredit ? '#047857' : '#64748B', marginTop: '2px' }}>
              {isCredit ? 'Advance balance with vendor' : isSettled ? 'Account fully settled' : 'Payable due to vendor'}
            </div>
          </div>
        </div>

        {/* Ledger Transactions Statement */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', maxHeight: '420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt style={{ width: '16px', height: '16px', color: '#64748B' }} />
              Supplier Khata Statement &amp; Ledger
            </h4>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
              {supplier.transactions.length} Ledger Entries
            </span>
          </div>

          <div className="ceo-table-container" style={{ margin: 0 }}>
            <table className="ceo-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Ref / Description</th>
                  <th style={{ textAlign: 'right' }}>Debit (Invoiced)</th>
                  <th style={{ textAlign: 'right' }}>Credit (Paid)</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {supplier.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="ceo-font-mono" style={{ color: '#64748B', whiteSpace: 'nowrap' }}>
                      {tx.date}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: tx.type === 'PO' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: tx.type === 'PO' ? '#D97706' : '#059669',
                      }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ color: '#0F172A', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: '#1E293B' }}>{tx.ref}</span>
                      {tx.description && (
                        <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginTop: '1px' }}>
                          {tx.description}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: tx.debit > 0 ? '#0F172A' : '#94A3B8' }} className="ceo-font-mono">
                      {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: tx.credit > 0 ? '#059669' : '#94A3B8' }} className="ceo-font-mono">
                      {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: tx.balanceAfter < 0 ? '#059669' : tx.balanceAfter === 0 ? '#64748B' : '#DC2626' }} className="ceo-font-mono">
                      {formatCurrency(tx.balanceAfter)}
                    </td>
                  </tr>
                ))}
                {supplier.transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                      No statement transactions recorded for this supplier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
