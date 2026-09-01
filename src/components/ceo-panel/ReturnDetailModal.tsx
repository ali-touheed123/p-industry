'use client';

import React from 'react';
import { ReturnRecord } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';

interface ReturnDetailModalProps {
  returnRecord: ReturnRecord | null;
  onClose: () => void;
  branchName: string;
}

export const ReturnDetailModal: React.FC<ReturnDetailModalProps> = ({
  returnRecord,
  onClose,
  branchName,
}) => {
  if (!returnRecord) return null;

  return (
    <div className="ceo-modal-overlay">
      <div id="return-detail-modal" className="ceo-modal-box">
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw style={{ width: '18px', height: '18px', color: '#F87171' }} />
              <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {returnRecord.returnNumber}
              </h3>
              <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
                Orig: {returnRecord.originalInvoiceNo}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
              Processed at {returnRecord.time} on {returnRecord.date} • {branchName}
            </p>
          </div>
          <button
            id="close-return-modal-btn"
            onClick={onClose}
            style={{ color: '#64748B', padding: '6px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', cursor: 'pointer' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Return Details Grid */}
        <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>Customer</div>
            <div className="ceo-font-heading" style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{returnRecord.customerName}</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Refund: {returnRecord.refundMode}</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>Return Incident Reason</div>
            <div className="ceo-font-heading" style={{ fontSize: '14px', fontWeight: 700, color: '#F87171' }}>{returnRecord.reason}</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Condition: {returnRecord.condition}</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '2px' }}>Refunded Value</div>
            <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#F87171' }}>
              {formatCurrency(returnRecord.totalAmount)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Audited by: {returnRecord.processedBy}</div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#F8FAFC' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '10px' }}>
            Returned Items Breakdown ({returnRecord.items.length})
          </div>
          <div className="ceo-table-container">
            <table className="ceo-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>#</th>
                  <th>Item Code</th>
                  <th>Product & Tint Shade</th>
                  <th>Pack Unit</th>
                  <th style={{ textAlign: 'center' }}>Returned Qty</th>
                  <th style={{ textAlign: 'right' }}>Credit Rate</th>
                  <th style={{ textAlign: 'right' }}>Total Credit</th>
                </tr>
              </thead>
              <tbody>
                {returnRecord.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="ceo-font-mono" style={{ color: '#64748B' }}>{idx + 1}</td>
                    <td className="ceo-font-mono" style={{ color: '#64748B' }}>{item.code}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.product}</div>
                      <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px' }}>
                        Shade: {item.shade}
                      </div>
                    </td>
                    <td style={{ color: '#64748B' }}>{item.packUnit}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#F87171' }} className="ceo-font-mono">
                      {item.qty}
                    </td>
                    <td style={{ textAlign: 'right', color: '#64748B' }} className="ceo-font-mono">
                      {item.rate.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#F87171' }} className="ceo-font-mono">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="ceo-btn-gold">
            Close Return Audit
          </button>
        </div>
      </div>
    </div>
  );
};
