'use client';

import React, { useState, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { Truck, Search, RefreshCw, Eye, X, CheckCircle2, Clock, PackageCheck, AlertCircle, XCircle } from 'lucide-react';
import { DatePeriodFilter } from './DatePeriodFilter';

interface BranchOrdersViewProps {
  branch: Branch;
}

export const BranchOrdersView: React.FC<BranchOrdersViewProps> = ({ branch }) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const firstOfMonthIso = todayIso.substring(0, 8) + '01';

  const [startDate, setStartDate] = useState<string>(firstOfMonthIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const tenantId = branch?.id || branch?.slug || '';

  const fetchOrders = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/branch-orders?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching branch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [tenantId]);

  const filteredOrders = orders.filter((o) => {
    const orderDate = o.created_at ? o.created_at.split('T')[0] : '';
    if (startDate && orderDate && orderDate < startDate) return false;
    if (endDate && orderDate && orderDate > endDate) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const orderNo = (o.order_no || '').toLowerCase();
      const fromName = (o.from_tenant?.name || '').toLowerCase();
      const toName = (o.to_tenant?.name || '').toLowerCase();
      const itemsMatch = (o.items || o.branch_order_items || []).some((it: any) =>
        (it.item_name || '').toLowerCase().includes(q) || (it.item_code || '').toLowerCase().includes(q)
      );
      return orderNo.includes(q) || fromName.includes(q) || toName.includes(q) || itemsMatch;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', color: '#92400E', label: 'Pending Approval' };
      case 'accepted':
        return { bg: '#DBEAFE', color: '#1E40AF', label: 'Accepted / Packing' };
      case 'dispatched':
        return { bg: '#F3E8FF', color: '#6B21A8', label: 'In Transit' };
      case 'received':
        return { bg: '#DCFCE7', color: '#166534', label: 'Received / Restocked' };
      case 'rejected':
        return { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' };
      default:
        return { bg: '#F1F5F9', color: '#475569', label: status };
    }
  };

  const fmtTs = (ts: string | null | undefined) => {
    if (!ts) return null;
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const fmtAmt = (v: number | null | undefined) =>
    v != null ? `Rs. ${Number(v).toLocaleString()}` : '—';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', color: '#0F172A' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck style={{ width: '22px', height: '22px', color: '#D97706' }} />
            <h1 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
              Branch Orders &amp; Stock Transfers
            </h1>
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
            Inter-branch stock requisitions, dispatch manifests, and receipt verification across branches
          </p>
        </div>

        <button
          onClick={fetchOrders}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            color: '#0F172A',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <RefreshCw style={{ width: '13px', height: '13px' }} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px' }}>
        <DatePeriodFilter
          startDate={startDate}
          endDate={endDate}
          onChangeStartDate={setStartDate}
          onChangeEndDate={setEndDate}
        />

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '240px', position: 'relative' }}>
            <Search style={{ width: '15px', height: '15px', color: '#6B7280', position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              placeholder="Search order #, branch, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                color: '#0F172A',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              color: '#0F172A',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="dispatched">In Transit</option>
            <option value="received">Received</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Order #</th>
              <th style={{ padding: '12px 16px' }}>Requesting Branch</th>
              <th style={{ padding: '12px 16px' }}>Supplying Branch</th>
              <th style={{ padding: '12px 16px' }}>Items</th>
              <th style={{ padding: '12px 16px' }}>Net Value</th>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  Loading branch orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  No branch orders found.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => {
                const badge = getStatusBadge(o.status);
                const items = o.items || o.branch_order_items || [];
                const itemsCount = items.reduce((acc: number, it: any) => acc + (Number(it.dispatched_qty ?? it.qty) || 0), 0);
                const itemListStr = items.slice(0, 3).map((it: any) => `${it.item_name} ×${it.dispatched_qty ?? it.qty}`).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '');
                const netValue = o.transfer_value != null ? Number(o.transfer_value) : null;

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D97706', fontFamily: 'JetBrains Mono, monospace' }}>
                      {o.order_no}
                      {o.dispatch_note && <span title={o.dispatch_note} style={{ marginLeft: '4px', color: '#2563EB', fontSize: '10px' }}>📝</span>}
                      {o.reject_reason && <span title={o.reject_reason} style={{ marginLeft: '4px', color: '#DC2626', fontSize: '10px' }}>⚠️</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>
                      {o.from_tenant?.name || 'Originating Branch'}
                      {o.from_counter ? <span style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 400 }}>Counter: {o.from_counter}</span> : null}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>
                      {o.to_tenant?.name || 'Fulfilling Godown'}
                      {o.target_counter ? <span style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 400 }}>Target: {o.target_counter}</span> : null}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A' }}>
                      <div style={{ fontWeight: 700 }}>{itemsCount} units</div>
                      <div style={{ fontSize: '11px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {itemListStr || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                      {netValue != null ? `Rs. ${netValue.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedOrder(o)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          color: '#0F172A',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye style={{ width: '13px', height: '13px', color: '#D97706' }} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="ceo-modal-overlay">
          <div id="branch-order-detail-modal" className="ceo-modal-box" style={{ maxWidth: '840px' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck style={{ width: '20px', height: '20px', color: '#D97706' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="ceo-font-heading" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      {selectedOrder.order_no}
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: getStatusBadge(selectedOrder.status).bg,
                      color: getStatusBadge(selectedOrder.status).color,
                    }}>
                      {getStatusBadge(selectedOrder.status).label}
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0' }}>
                    Created {fmtTs(selectedOrder.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ color: '#64748B', padding: '6px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {/* Reject / Dispatch note banners */}
            {selectedOrder.reject_reason && (
              <div style={{ margin: '14px 24px 0', padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <XCircle style={{ width: '16px', height: '16px', color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', marginBottom: '2px' }}>Rejection Reason</div>
                  <div style={{ fontSize: '13px', color: '#7F1D1D' }}>{selectedOrder.reject_reason}</div>
                </div>
              </div>
            )}
            {selectedOrder.dispatch_note && (
              <div style={{ margin: '14px 24px 0', padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 style={{ width: '16px', height: '16px', color: '#2563EB', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', marginBottom: '2px' }}>Dispatch Note</div>
                  <div style={{ fontSize: '13px', color: '#1E3A5F' }}>{selectedOrder.dispatch_note}</div>
                </div>
              </div>
            )}

            {/* Routing / Branch Meta + Lifecycle Timeline */}
            <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Originating Requisition Branch</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {selectedOrder.from_tenant?.name || 'Originating Branch'}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Counter: {selectedOrder.from_counter || 'Main Terminal'}
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Target Fulfilling Branch / Godown</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {selectedOrder.to_tenant?.name || 'Fulfilling Godown'}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Delivery: {selectedOrder.delivery_method || 'Internal Transport'}
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Lifecycle Timeline</div>
                {[
                  { label: 'Placed', ts: selectedOrder.created_at, icon: '📋' },
                  { label: 'Accepted', ts: selectedOrder.accepted_at, icon: '✅' },
                  { label: 'Dispatched', ts: selectedOrder.dispatched_at, icon: '🚚' },
                  { label: 'Received', ts: selectedOrder.received_at, icon: '📦' },
                  { label: 'Rejected', ts: selectedOrder.rejected_at, icon: '❌' },
                ].filter(e => e.ts).map((e, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#475569', marginBottom: '3px' }}>
                    <span style={{ marginRight: '4px' }}>{e.icon}</span>
                    <strong>{e.label}:</strong> {fmtTs(e.ts)}
                  </div>
                ))}
              </div>
            </div>

            {/* Items Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 0', backgroundColor: '#FFFFFF', maxHeight: '320px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '10px' }}>
                Transfer Manifest ({(selectedOrder.items || selectedOrder.branch_order_items || []).length} Line Items)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px' }}>#</th>
                    <th style={{ padding: '8px 12px' }}>Item Code</th>
                    <th style={{ padding: '8px 12px' }}>Product Description</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Pack Size</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Req'd</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Sent</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || selectedOrder.branch_order_items || []).map((it: any, idx: number) => {
                    const isLegacy = it.dispatched_qty === null || it.dispatched_qty === undefined;
                    const isShort = !isLegacy && Number(it.dispatched_qty) < Number(it.qty);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                          {it.item_code || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F172A' }}>
                          {it.item_name}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>
                          {it.pack_size || it.unit || 'Can'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
                          {it.qty}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                          {isLegacy ? (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          ) : (
                            <span style={{ color: isShort ? '#D97706' : '#166534' }}>
                              {it.dispatched_qty}
                              {isShort && <span style={{ fontSize: '9px', marginLeft: '3px', color: '#D97706' }}>⚠</span>}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                          {isLegacy || it.unit_price == null ? <span style={{ color: '#94A3B8' }}>—</span> : `Rs. ${Number(it.unit_price).toLocaleString()}`}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                          {isLegacy || it.total_price == null ? <span style={{ color: '#94A3B8' }}>—</span> : `Rs. ${Number(it.total_price).toLocaleString()}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary */}
            {(selectedOrder.subtotal != null || selectedOrder.transfer_value != null) && (
              <div style={{ padding: '14px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                  { label: 'Subtotal', value: selectedOrder.subtotal, color: '#0F172A' },
                  { label: 'Discount (−)', value: selectedOrder.discount, color: '#DC2626' },
                  { label: 'Delivery (+)', value: selectedOrder.delivery_charges, color: '#D97706' },
                  { label: 'Net Transfer', value: selectedOrder.transfer_value, color: '#166534' },
                ].map((card, i) => (
                  <div key={i} style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{card.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: card.color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {fmtAmt(card.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Remarks */}
            {selectedOrder.remarks && (
              <div style={{ margin: '12px 24px', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>Order Remarks: </span>
                <span style={{ color: '#0F172A' }}>{selectedOrder.remarks}</span>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  color: '#0F172A',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
