'use client';

import React, { useState, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { Truck, Search, RefreshCw, CheckCircle2, Clock, PackageCheck, AlertCircle, Eye, X } from 'lucide-react';
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
      const itemsMatch = (o.items || []).some((it: any) =>
        (it.item_name || '').toLowerCase().includes(q) || (it.item_code || '').toLowerCase().includes(q)
      );
      return orderNo.includes(q) || fromName.includes(q) || toName.includes(q) || itemsMatch;
    }
    return true;
  });

  // FIX CEO-MOD-5: High-contrast status badges for light background
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
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Order #</th>
              <th style={{ padding: '12px 16px' }}>Requested By</th>
              <th style={{ padding: '12px 16px' }}>Target Branch</th>
              <th style={{ padding: '12px 16px' }}>Items Requested</th>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  Loading branch orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  No branch orders found.
                </td>
              </tr>
            ) : (
              filteredOrders.map((o) => {
                const badge = getStatusBadge(o.status);
                const itemsCount = (o.items || o.branch_order_items || []).reduce((acc: number, it: any) => acc + (Number(it.qty) || 1), 0);
                const itemListStr = (o.items || o.branch_order_items || [])
                  .map((it: any) => `${it.item_name} (${it.qty} ${it.unit || 'Can'})`)
                  .join(', ');

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#D97706', fontFamily: 'JetBrains Mono, monospace' }}>
                      {o.order_no}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>
                      {o.from_tenant?.name || 'Originating Branch'}
                      {o.from_counter ? <span style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 400 }}>Counter: {o.from_counter}</span> : null}
                    </td>
                    {/* FIX CEO-MOD-5: Replaced low-contrast gray (#9CA3AF) with #0F172A */}
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>
                      {o.to_tenant?.name || 'Fulfilling Godown'}
                      {o.target_counter ? <span style={{ fontSize: '11px', color: '#475569', display: 'block', fontWeight: 400 }}>Target: {o.target_counter}</span> : null}
                    </td>
                    {/* FIX CEO-MOD-5: Replaced unreadable silver gray (#D1D5DB) with high contrast colors */}
                    <td style={{ padding: '12px 16px', color: '#0F172A' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{itemsCount} units total</div>
                      <div style={{ fontSize: '11px', color: '#475569', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {itemListStr || 'No items listed'}
                      </div>
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

      {/* FIX CEO-MOD-5: Detail Inspection Modal for Branch Orders */}
      {selectedOrder && (
        <div className="ceo-modal-overlay">
          <div id="branch-order-detail-modal" className="ceo-modal-box" style={{ maxWidth: '780px' }}>
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
                    Created {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '—'}
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

            {/* Routing / Branch Meta */}
            <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Originating Requisition Branch</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {selectedOrder.from_tenant?.name || 'Originating Branch'}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Counter: {selectedOrder.from_counter || 'Main Terminal'}
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ color: '#64748B', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Target Fulfilling Branch / Godown</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                  {selectedOrder.to_tenant?.name || 'Fulfilling Godown'}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Target Station: {selectedOrder.target_counter || 'Central Dispatch'}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#FFFFFF', maxHeight: '400px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '10px' }}>
                Requisitioned Transfer Manifest ({(selectedOrder.items || selectedOrder.branch_order_items || []).length} Line Items)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                    <th style={{ padding: '8px 12px' }}>#</th>
                    <th style={{ padding: '8px 12px' }}>Item Code</th>
                    <th style={{ padding: '8px 12px' }}>Product Description</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Pack Size</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Requested Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || selectedOrder.branch_order_items || []).map((it: any, idx: number) => (
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
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
                        {it.qty} {it.unit || 'PCS'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedOrder.remarks && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#475569' }}>Order Remarks: </span>
                  <span style={{ color: '#0F172A' }}>{selectedOrder.remarks}</span>
                </div>
              )}
            </div>

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
