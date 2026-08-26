'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, ReturnRecord } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { Search, ChevronRight, RotateCcw } from 'lucide-react';
import { ReturnDetailModal } from './ReturnDetailModal';

interface ReturnsViewProps {
  branch: Branch;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({ branch }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('All Reasons');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchReturns = async () => {
      const tenantId = branch?.id
        ? (branch.id.includes('-b') ? branch.id.split('-b')[0] : branch.id)
        : (branch?.slug || '');

      if (!tenantId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/invoices?tenant_id=${tenantId}&type=return`);
        const data = await res.json();
        if (isMounted && data.success && data.invoices) {
          const mapped: ReturnRecord[] = data.invoices.map((inv: any) => {
            const rawItems = inv.invoice_items || inv.items || [];
            const rawRemarks = inv.remarks || '';
            let reason = 'Customer Return / Shade Adjustment';
            let originalInvoiceNo = 'Direct Counter Return';
            let condition: 'Restocked' | 'Damaged / Write-off' = 'Restocked';

            if (rawRemarks.includes('Reason:')) {
              const parts = rawRemarks.split('Reason:');
              originalInvoiceNo = parts[0].replace('Orig:', '').trim() || originalInvoiceNo;
              reason = parts[1].trim() || reason;
            } else if (rawRemarks.startsWith('INV-')) {
              originalInvoiceNo = rawRemarks;
            } else if (rawRemarks.trim()) {
              reason = rawRemarks.trim();
            }

            const lowerReason = reason.toLowerCase();
            if (lowerReason.includes('damage') || lowerReason.includes('defect') || lowerReason.includes('wrong shade') || lowerReason.includes('faulty')) {
              condition = 'Damaged / Write-off';
            } else {
              condition = 'Restocked';
            }

            return {
              id: inv.id,
              returnNumber: inv.invoice_no || `RET-${inv.id}`,
              originalInvoiceNo,
              date: inv.date || (inv.created_at ? inv.created_at.split('T')[0] : ''),
              time: inv.created_at ? new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
              customerName: inv.client_name || 'Walk-in Customer',
              reason,
              condition,
              refundMode: inv.payment_type === 'credit' ? 'Credit Note' : (inv.payment_type === 'bank' || inv.payment_type === 'card' ? 'Bank/Card Reversal' : 'Cash Refund'),
              totalAmount: Number(inv.net_total || 0),
              processedBy: inv.created_by || 'Counter Staff',
              items: rawItems.map((it: any) => ({
                code: it.item_code || it.code || '',
                product: it.item_name || it.name || 'Returned Product',
                shade: it.shade_code || it.shade || 'Standard',
                packUnit: it.pack_size || it.unit || 'Can',
                qty: Number(it.qty) || 1,
                rate: Number(it.unit_price || it.rate || it.price) || 0,
                amount: Number(it.total_price || (it.qty * (it.unit_price || it.rate || 0))) || 0,
              })),
            };
          });
          setReturns(mapped);
        }
      } catch (err) {
        console.error('Failed to load return records', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReturns();
    return () => {
      isMounted = false;
    };
  }, [branch?.id, branch?.slug]);

  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      if (reasonFilter !== 'All Reasons' && ret.reason !== reasonFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = ret.returnNumber.toLowerCase().includes(q);
        const matchesOrig = ret.originalInvoiceNo.toLowerCase().includes(q);
        const matchesCust = ret.customerName.toLowerCase().includes(q);
        const matchesReason = ret.reason.toLowerCase().includes(q);
        if (!matchesNo && !matchesOrig && !matchesCust && !matchesReason) return false;
      }
      return true;
    });
  }, [returns, reasonFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalRefundValue = filteredReturns.reduce((acc, ret) => acc + ret.totalAmount, 0);
    const totalUnits = filteredReturns.reduce((acc, ret) => acc + ret.items.reduce((s, it) => s + it.qty, 0), 0);
    const restockedCount = filteredReturns.filter((r) => r.condition === 'Restocked').length;
    const damagedCount = filteredReturns.filter((r) => r.condition !== 'Restocked').length;

    return {
      totalRefundValue,
      totalUnits,
      returnIncidents: filteredReturns.length,
      restockedCount,
      damagedCount,
    };
  }, [filteredReturns]);

  return (
    <div id="executive-returns-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2F38', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Returns &amp; Tinting Error Audits
            </h2>
            <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', color: '#8B93A1' }}>
              {stats.returnIncidents} Incidents
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
            {branch.name} • Tinting discrepancies, construction overages &amp; damaged stock return audits
          </p>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Total Return Value</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
            {formatCurrency(stats.totalRefundValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Credit notes &amp; refunds
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Returned Units</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {stats.totalUnits} <span style={{ fontSize: '12px', color: '#8B93A1', fontWeight: 400 }}>containers</span>
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Across {stats.returnIncidents} vouchers
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Restocked into Inventory</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
            {stats.restockedCount} Vouchers
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Reusable warehouse stock
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Damaged / Write-Off</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {stats.damagedCount} Vouchers
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Non-recoverable shade errors
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ padding: '12px 16px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '6px', padding: '6px 12px', minWidth: '280px' }}>
          <Search style={{ width: '14px', height: '14px', color: '#8B93A1' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search return #, original invoice, customer..."
            style={{ background: 'none', border: 'none', color: '#E5E7EB', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#8B93A1' }}>Reason Filter:</span>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            style={{ backgroundColor: '#12151B', border: '1px solid #2A2F38', color: '#E5E7EB', fontSize: '12px', borderRadius: '6px', padding: '6px 10px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="All Reasons">All Return Reasons</option>
            <option value="Customer Return / Shade Adjustment">Customer Return / Shade Adjustment</option>
            <option value="Wrong Shade Tinted">Wrong Shade Tinted</option>
            <option value="Defective Batch">Defective Batch</option>
            <option value="Excess Construction Stock">Excess Construction Stock</option>
            <option value="Can Damage">Can Damage</option>
          </select>
        </div>
      </div>

      {/* Returns Table */}
      <div className="ceo-table-container">
        <table className="ceo-table">
          <thead>
            <tr>
              <th>Return Voucher #</th>
              <th>Orig Invoice / Ref</th>
              <th>Customer</th>
              <th>Return Reason</th>
              <th>Refund Mode</th>
              <th>Condition</th>
              <th style={{ textAlign: 'right' }}>Refund Amount</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.map((ret) => (
              <tr key={ret.id} onClick={() => setSelectedReturn(ret)} style={{ cursor: 'pointer' }}>
                <td className="ceo-font-mono" style={{ fontWeight: 700, color: '#F87171' }}>{ret.returnNumber}</td>
                <td className="ceo-font-mono" style={{ color: '#8B93A1' }}>{ret.originalInvoiceNo}</td>
                <td style={{ fontWeight: 600, color: '#E5E7EB' }}>{ret.customerName}</td>
                <td style={{ color: '#F87171' }}>{ret.reason}</td>
                <td style={{ color: '#8B93A1' }}>{ret.refundMode}</td>
                <td>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    backgroundColor: ret.condition === 'Restocked' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                    color: ret.condition === 'Restocked' ? '#34D399' : '#F87171',
                  }}>
                    {ret.condition}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#F87171' }} className="ceo-font-mono">{formatCurrency(ret.totalAmount)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#C6A15B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Inspect <ChevronRight style={{ width: '12px', height: '12px' }} />
                  </span>
                </td>
              </tr>
            ))}
            {filteredReturns.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#8B93A1' }}>
                  {loading ? 'Loading returns records...' : 'No return vouchers recorded for this branch.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Return Detail Modal */}
      <ReturnDetailModal
        returnRecord={selectedReturn}
        onClose={() => setSelectedReturn(null)}
        branchName={branch.name}
      />
    </div>
  );
};
