'use client';

import React from 'react';
import { Invoice } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { X, Receipt } from 'lucide-react';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  branchName: string;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  onClose,
  branchName,
}) => {
  if (!invoice) return null;

  return (
    <div className="ceo-modal-overlay">
      <div id="invoice-detail-modal" className="ceo-modal-box">
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt style={{ width: '18px', height: '18px', color: '#D97706' }} />
              <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {invoice.invoiceNumber}
              </h3>
              <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
                {invoice.paymentMode}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
              Issued at {invoice.time} on {invoice.date} • {branchName}
            </p>
          </div>
          <button
            id="close-invoice-modal-btn"
            onClick={onClose}
            style={{ color: '#64748B', padding: '6px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', cursor: 'pointer' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Invoice Meta Grid */}
        <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ color: '#64748B', marginBottom: '2px', fontWeight: 600, fontSize: '11px' }}>Customer Details</div>
            <div className="ceo-font-heading" style={{ color: '#0F172A', fontWeight: 700, fontSize: '14px' }}>{invoice.customerName}</div>
            <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>Category: {invoice.customerCategory}</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ color: '#64748B', marginBottom: '2px', fontWeight: 600, fontSize: '11px' }}>Salesperson</div>
            <div className="ceo-font-heading" style={{ color: '#0F172A', fontWeight: 700, fontSize: '14px' }}>{invoice.salesman}</div>
            <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>Terminal Register 01</div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ color: '#64748B', marginBottom: '2px', fontWeight: 600, fontSize: '11px' }}>Settlement Value</div>
            <div className="ceo-font-mono" style={{ color: '#D97706', fontWeight: 700, fontSize: '15px' }}>
              {formatCurrency(invoice.netAmount)}
            </div>
            <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>
              {invoice.discountAmount > 0 ? `Discount: ${formatCurrency(invoice.discountAmount)}` : 'Full Retail Price'}
            </div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#F8FAFC' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '10px' }}>
            Billed Items Breakdown ({invoice.items.length})
          </div>
          <div className="ceo-table-container">
            <table className="ceo-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>#</th>
                  <th>Item Code</th>
                  <th>Product Name & Shade</th>
                  <th>Pack</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'center' }}>Disc</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#64748B' }} className="ceo-font-mono">{idx + 1}</td>
                    <td className="ceo-font-mono" style={{ color: '#64748B' }}>{item.code}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.product}</div>
                      <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px' }}>
                        Shade: {item.shade}
                      </div>
                    </td>
                    <td style={{ color: '#64748B' }}>{item.packUnit}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#0F172A' }} className="ceo-font-mono">
                      {item.qty} {item.unit}
                    </td>
                    <td style={{ textAlign: 'right', color: '#64748B' }} className="ceo-font-mono">
                      {item.rate.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#64748B' }} className="ceo-font-mono">
                      {item.discountPct > 0 ? `${item.discountPct}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }} className="ceo-font-mono">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary */}
        <div style={{ padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            <span>Audit Trail • Record ID: {invoice.id}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748B', marginRight: '6px' }}>Gross:</span>
              <span className="ceo-font-mono" style={{ fontSize: '12px', color: '#0F172A' }}>{formatCurrency(invoice.grossAmount)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div>
                <span style={{ fontSize: '11px', color: '#64748B', marginRight: '6px' }}>Disc:</span>
                <span className="ceo-font-mono" style={{ fontSize: '12px', color: '#F87171' }}>-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div style={{ paddingLeft: '16px', borderLeft: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#64748B', marginRight: '6px', textTransform: 'uppercase' }}>Net:</span>
              <span className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#D97706' }}>
                {formatCurrency(invoice.netAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
