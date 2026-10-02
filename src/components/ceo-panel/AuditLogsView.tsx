'use client';

import React, { useState, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { ShieldCheck, Search, Filter, RefreshCw } from 'lucide-react';
import { DatePeriodFilter } from './DatePeriodFilter';

interface AuditLogsViewProps {
  branch: Branch;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ branch }) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const firstOfMonthIso = todayIso.substring(0, 8) + '01';

  const [startDate, setStartDate] = useState<string>(firstOfMonthIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const tenantId = branch?.id
    ? (/-b\d+$/.test(branch.id) ? branch.id.replace(/-b\d+$/, '') : branch.id)
    : (branch?.slug || '');

  const fetchLogs = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?tenant_id=${tenantId}&limit=200`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [tenantId]);

  const filteredLogs = logs.filter((log) => {
    const logDate = log.created_at ? log.created_at.split('T')[0] : '';
    if (startDate && logDate && logDate < startDate) return false;
    if (endDate && logDate && logDate > endDate) return false;

    // FIX CEO-12: Map filter dropdown options to human action strings stored in DB
    if (actionFilter !== 'all') {
      const act = (log.action || '').toLowerCase();
      const actType = (log.action_type || '').toLowerCase();
      const entity = (log.entity_type || '').toLowerCase();

      let matches = false;
      if (actionFilter === 'sales' || actionFilter === 'create_invoice') {
        matches = act.includes('sales invoice') || actType === 'sale' || (entity === 'invoice' && !act.includes('return'));
      } else if (actionFilter === 'returns' || actionFilter === 'return_invoice') {
        matches = act.includes('return') || act.includes('credit note') || actType === 'return' || actType === 'purchase_return';
      } else if (actionFilter === 'purchases' || actionFilter === 'create_purchase') {
        matches = act.includes('purchase') || actType === 'purchase' || entity === 'purchase';
      } else if (actionFilter === 'grn' || actionFilter === 'receive_stock') {
        matches = act.includes('goods received') || act.includes('grn') || actType === 'grn_receive' || entity === 'item';
      } else if (actionFilter === 'branch_transfer') {
        matches = act.includes('branch order') || actType.startsWith('branch_') || entity === 'branch_order';
      } else {
        matches = act.includes(actionFilter.toLowerCase()) || actType === actionFilter.toLowerCase();
      }

      if (!matches) return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const user = (log.user_name || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const entityType = (log.entity_type || '').toLowerCase();
      const entityId = (log.entity_id || '').toLowerCase();
      const details = JSON.stringify(log.details || {}).toLowerCase();
      return user.includes(q) || action.includes(q) || entityType.includes(q) || entityId.includes(q) || details.includes(q);
    }
    return true;
  });

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', color: '#0F172A' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck style={{ width: '22px', height: '22px', color: '#D97706' }} />
            <h1 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
              Audit &amp; Activity Log
            </h1>
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
            Immutable chronological record of sales, inward stock receipts, and administrative changes for {branch.name}
          </p>
        </div>

        <button
          onClick={fetchLogs}
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
              placeholder="Search by user, action, ref #..."
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
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              color: '#0F172A',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <option value="all">All Actions</option>
            <option value="sales">Sales Invoices</option>
            <option value="returns">Returns &amp; Credit Notes</option>
            <option value="purchases">Purchase Invoices</option>
            <option value="grn">Goods Received (GRN)</option>
            <option value="branch_transfer">Branch Orders &amp; Transfers</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', fontWeight: 700 }}>
              <th style={{ padding: '12px 16px' }}>Timestamp</th>
              <th style={{ padding: '12px 16px' }}>User / Cashier</th>
              <th style={{ padding: '12px 16px' }}>Action</th>
              <th style={{ padding: '12px 16px' }}>Entity</th>
              <th style={{ padding: '12px 16px' }}>Details / Reference</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  Loading activity logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  No audit logs recorded for this filter.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const date = log.created_at ? new Date(log.created_at).toLocaleString() : '—';
                const actLower = (log.action || '').toLowerCase();
                const isReturn = actLower.includes('return') || actLower.includes('credit note');
                const isGrn = actLower.includes('goods received') || actLower.includes('grn');
                const isPurchase = actLower.includes('purchase');

                let badgeBg = '#FEF3C7';
                let badgeColor = '#92400E';
                let badgeBorder = '#FDE68A';

                if (isReturn) {
                  badgeBg = '#FEE2E2';
                  badgeColor = '#991B1B';
                  badgeBorder = '#FECACA';
                } else if (isGrn) {
                  badgeBg = '#DCFCE7';
                  badgeColor = '#166534';
                  badgeBorder = '#BBF7D0';
                } else if (isPurchase) {
                  badgeBg = '#DBEAFE';
                  badgeColor = '#1E40AF';
                  badgeBorder = '#BFDBFE';
                }

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {date}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>
                      {log.user_name || 'System / Staff'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ''}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A' }}>
                      {log.details ? (
                        <div style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details.invoice_no ? <strong style={{ color: '#0F172A' }}>Invoice #{log.details.invoice_no}</strong> : ''}
                          {log.details.net_total !== undefined ? <span style={{ color: '#D97706', fontWeight: 600 }}> • Net: Rs. {Number(log.details.net_total).toLocaleString()}</span> : ''}
                          {log.details.item_name ? <span>Product: {log.details.item_name}</span> : ''}
                          {log.details.qty ? <span style={{ color: '#475569' }}> • Qty: {log.details.qty}</span> : ''}
                          {log.details.grn_no ? <strong style={{ color: '#166534' }}> • GRN #{log.details.grn_no}</strong> : ''}
                          {log.details.supplier_name ? <span style={{ color: '#475569' }}>Supplier: {log.details.supplier_name}</span> : ''}
                          {!log.details.invoice_no && !log.details.item_name && !log.details.grn_no && !log.details.supplier_name ? JSON.stringify(log.details) : ''}
                        </div>
                      ) : (
                        '—'
                      )}
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
