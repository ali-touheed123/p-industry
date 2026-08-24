'use client';

import React from 'react';
import { PurchaseRecord } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { X, ShoppingBag } from 'lucide-react';

interface PurchaseDetailModalProps {
  purchase: PurchaseRecord | null;
  onClose: () => void;
  branchName: string;
}

export const PurchaseDetailModal: React.FC<PurchaseDetailModalProps> = ({
  purchase,
  onClose,
  branchName,
}) => {
  if (!purchase) return null;

  return (
    <div className="ceo-modal-overlay">
      <div id="purchase-detail-modal" className="ceo-modal-box">
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #2A2F38', backgroundColor: '#10141B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag style={{ width: '18px', height: '18px', color: '#C6A15B' }} />
              <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
                {purchase.poNumber}
              </h3>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
                backgroundColor: purchase.paymentStatus === 'Paid' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                color: purchase.paymentStatus === 'Paid' ? '#34D399' : '#F87171',
              }}>
                {purchase.paymentStatus}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
              Received at {purchase.time} on {purchase.date} • {branchName}
            </p>
          </div>
          <button
            id="close-purchase-modal-btn"
            onClick={onClose}
            style={{ color: '#8B93A1', padding: '6px', borderRadius: '6px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', cursor: 'pointer' }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* PO Meta */}
        <div style={{ padding: '16px 24px', backgroundColor: '#12151B', borderBottom: '1px solid #2A2F38', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
            <div style={{ fontSize: '11px', color: '#8B93A1', fontWeight: 600, marginBottom: '2px' }}>Supplier Entity</div>
            <div className="ceo-font-heading" style={{ fontSize: '14px', fontWeight: 700, color: '#E5E7EB' }}>{purchase.supplierName}</div>
            <div className="ceo-font-mono" style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px' }}>Bill Ref: {purchase.invoiceBillRef}</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
            <div style={{ fontSize: '11px', color: '#8B93A1', fontWeight: 600, marginBottom: '2px' }}>Procurement Category</div>
            <div className="ceo-font-heading" style={{ fontSize: '14px', fontWeight: 700, color: '#C6A15B' }}>{purchase.category}</div>
            <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px' }}>Received By: {purchase.receivedBy}</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: '#1C2128', borderRadius: '8px', border: '1px solid #2A2F38' }}>
            <div style={{ fontSize: '11px', color: '#8B93A1', fontWeight: 600, marginBottom: '2px' }}>Total Consignment Cost</div>
            <div className="ceo-font-mono" style={{ fontSize: '15px', fontWeight: 700, color: '#E5E7EB' }}>
              {formatCurrency(purchase.totalCost)}
            </div>
            <div className="ceo-font-mono" style={{ fontSize: '11px', color: purchase.dueAmount > 0 ? '#F87171' : '#34D399', marginTop: '2px' }}>
              {purchase.dueAmount > 0 ? `Payable Due: ${formatCurrency(purchase.dueAmount)}` : 'Fully Settled'}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#12151B' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1', marginBottom: '10px' }}>
            Received Consignment Items ({purchase.items.length})
          </div>
          <div className="ceo-table-container">
            <table className="ceo-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}>#</th>
                  <th>Item Code</th>
                  <th>Raw Material / Product</th>
                  <th>Pack Unit</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Cost Rate</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="ceo-font-mono" style={{ color: '#8B93A1' }}>{idx + 1}</td>
                    <td className="ceo-font-mono" style={{ color: '#8B93A1' }}>{item.code}</td>
                    <td style={{ fontWeight: 600, color: '#E5E7EB' }}>{item.product}</td>
                    <td style={{ color: '#8B93A1' }}>{item.packUnit}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#E5E7EB' }} className="ceo-font-mono">
                      {item.qty} {item.unit}
                    </td>
                    <td style={{ textAlign: 'right', color: '#8B93A1' }} className="ceo-font-mono">
                      {item.costRate.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#E5E7EB' }} className="ceo-font-mono">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', backgroundColor: '#10141B', borderTop: '1px solid #2A2F38', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: '#8B93A1' }}>
            Stock automatically reconciled into warehouse inventory.
          </div>
          <button onClick={onClose} className="ceo-btn-gold">
            Close PO View
          </button>
        </div>
      </div>
    </div>
  );
};
