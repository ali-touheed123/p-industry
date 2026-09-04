'use client';

import React, { useState, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { Truck, Search, RefreshCw, CheckCircle2, Clock, PackageCheck, AlertCircle } from 'lucide-react';
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

  const tenantId = branch?.id
    ? (/-b\d+$/.test(branch.id) ? branch.id.replace(/-b\d+$/, '') : branch.id)
    : (branch?.slug || '');

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: 'rgba(234,179,8,0.15)', color: '#FACC15', label: 'Pending Approval' };
      case 'accepted':
        return { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA', label: 'Accepted / Packing' };
      case 'dispatched':
        return { bg: 'rgba(168,85,247,0.15)', color: '#C084FC', label: 'In Transit' };
      case 'received':
        return { bg: 'rgba(34,197,94,0.15)', color: '#4ADE80', label: 'Received / Restocked' };
      case 'rejected':
        return { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5', label: 'Rejected' };
      default:
        return { bg: 'rgba(156,163,175,0.15)', color: '#9CA3AF', label: status };
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
            <tr style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 16px' }}>Order #</th>
              <th style={{ padding: '12px 16px' }}>Requested By</th>
              <th style={{ padding: '12px 16px' }}>Target Branch</th>
              <th style={{ padding: '12px 16px' }}>Items Requested</th>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  Loading branch orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
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
                      {o.from_counter ? <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Counter: {o.from_counter}</span> : null}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#9CA3AF' }}>
                      {o.to_tenant?.name || 'Fulfilling Godown'}
                      {o.target_counter ? <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Target: {o.target_counter}</span> : null}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#D1D5DB' }}>
                      <div style={{ fontWeight: 600 }}>{itemsCount} units total</div>
                      <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {itemListStr || 'No items listed'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
