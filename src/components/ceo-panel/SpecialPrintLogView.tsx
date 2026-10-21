'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollText,
  Search,
  Calendar,
  Filter,
  Eye,
  TrendingUp,
  RotateCcw,
  Printer,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Branch } from '@/types/ceo';
import SpecialReceiptLogDetailModal from './SpecialReceiptLogDetailModal';

interface SpecialPrintLogViewProps {
  branch: Branch;
}

export const SpecialPrintLogView: React.FC<SpecialPrintLogViewProps> = ({ branch }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [eventType, setEventType] = useState<string>('all');
  const [invoiceStatus, setInvoiceStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modal inspection
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    if (!branch?.id) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        tenant_id: branch.id,
        limit: '100',
      });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (eventType !== 'all') params.set('event_type', eventType);
      if (invoiceStatus !== 'all') params.set('invoice_status', invoiceStatus);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/special-print-log?${params.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else {
        setError(data.error || 'Failed to load special print logs.');
      }
    } catch (err: any) {
      console.error('Error fetching special print logs:', err);
      setError(err.message || 'Network error fetching logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [branch?.id, eventType, invoiceStatus, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  // Metric calculations strictly excluding reprints and returns (TASK-SR-18 & R4)
  const salesMetrics = useMemo(() => {
    const saleLogs = logs.filter((l) => l.event_type === 'sale' && l.invoice_status !== 'cancelled');
    const totalMaster = saleLogs.reduce((acc, l) => acc + Number(l.master_total || 0), 0);
    const totalCharged = saleLogs.reduce((acc, l) => acc + Number(l.charged_total || 0), 0);
    const totalDelivery = saleLogs.reduce((acc, l) => acc + Number(l.delivery_charge || 0), 0);
    // R4 Formula: sum(charged_total - delivery_charge) - sum(master_total)
    const netVariance = (totalCharged - totalDelivery) - totalMaster;

    return {
      salesCount: saleLogs.length,
      totalMaster,
      totalCharged,
      netVariance,
    };
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '18px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#0F172A',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(15, 23, 42, 0.15)',
            }}
          >
            <ScrollText style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Special Receipt Audit Log
              </h1>
              <span
                style={{
                  background: '#38BDF8',
                  color: '#0F172A',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                }}
              >
                CEO Read-Only
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              Branch: <strong style={{ color: '#0F172A' }}>{branch.name}</strong> • Immutable audit trail of non-branded special receipts with full rate variances.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            color: '#334155',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw style={{ width: 15, height: 15, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Metric Cards (Top Bar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Special Sales Issued
          </span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
            {salesMetrics.salesCount}
          </div>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Excludes reprints &amp; returns</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Master Catalog Value
          </span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
            Rs. {salesMetrics.totalMaster.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Original catalog price sum</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>
            Actual Charged Value
          </span>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            Rs. {salesMetrics.totalCharged.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Real revenue collected</span>
        </div>

        <div
          style={{
            background: salesMetrics.netVariance >= 0 ? '#F0FDF4' : '#FEF2F2',
            padding: '16px',
            borderRadius: '12px',
            border: `1px solid ${salesMetrics.netVariance >= 0 ? '#BBF7D0' : '#FECACA'}`,
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: salesMetrics.netVariance >= 0 ? '#166534' : '#991B1B',
              textTransform: 'uppercase',
            }}
          >
            Net Price Variance (R4)
          </span>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: salesMetrics.netVariance >= 0 ? '#15803D' : '#DC2626',
              marginTop: '4px',
            }}
          >
            {salesMetrics.netVariance >= 0 ? '+' : ''}
            Rs. {salesMetrics.netVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: salesMetrics.netVariance >= 0 ? '#166534' : '#991B1B' }}>
            Formula: (Charged - Delivery) - Master
          </span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '14px 18px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '10px', width: '15px', height: '15px', color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Invoice #, Cashier, or Customer..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
          </div>
        </form>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar style={{ width: 14, height: 14, color: '#64748B' }} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px' }}
            />
            <span style={{ color: '#94A3B8' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px' }}
            />
          </div>

          {/* Event type filter */}
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="all">All Events</option>
            <option value="sale">Sales Only</option>
            <option value="reprint">Reprints Only</option>
            <option value="return">Returns Only</option>
          </select>

          {/* Status filter */}
          <select
            value={invoiceStatus}
            onChange={(e) => setInvoiceStatus(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {error && (
          <div style={{ padding: '14px', background: '#FEF2F2', color: '#DC2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: 16, height: 16 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No special receipt audit logs found for the selected criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
              <tr>
                <th style={{ padding: '10px 14px' }}>Date &amp; Time</th>
                <th style={{ padding: '10px 12px' }}>Invoice #</th>
                <th style={{ padding: '10px 10px', textAlign: 'center' }}>Event</th>
                <th style={{ padding: '10px 10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Cashier</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Master Price</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Printed Rate</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Charged Total</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Variance</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isReprint = log.event_type === 'reprint';
                const isReturn = log.event_type === 'return';
                const isCancelled = log.invoice_status === 'cancelled';
                const variance = Number(log.price_variance || 0);

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9', background: isCancelled ? '#FEF2F2' : '#FFFFFF' }}>
                    <td style={{ padding: '10px 14px', color: '#64748B', fontSize: '11px' }}>
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>
                      {log.invoice_no}
                      {log.original_invoice_id && (
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                          Orig: #{log.original_invoice_no || 'Ref'}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: isReprint ? '#DBEAFE' : isReturn ? '#FFEDD5' : '#DCFCE7',
                          color: isReprint ? '#1D4ED8' : isReturn ? '#C2410C' : '#15803D',
                        }}
                      >
                        {isReprint ? 'REPRINT' : isReturn ? 'RETURN' : 'SALE'}
                      </span>
                    </td>

                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: isCancelled ? '#FEE2E2' : '#F1F5F9',
                          color: isCancelled ? '#DC2626' : '#475569',
                          textTransform: 'uppercase',
                        }}
                      >
                        {log.invoice_status || 'completed'}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                      {log.printed_by}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748B' }}>
                      Rs. {Number(log.master_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284C7', fontWeight: 600 }}>
                      Rs. {Number(log.printed_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16A34A', fontWeight: 700 }}>
                      Rs. {Number(log.charged_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: variance >= 0 ? '#16A34A' : '#DC2626',
                      }}
                    >
                      {variance >= 0 ? '+' : ''}
                      Rs. {variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#0F172A',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye style={{ width: 13, height: 13 }} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Forensic Inspection Modal */}
      {selectedLog && (
        <SpecialReceiptLogDetailModal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          log={selectedLog}
        />
      )}
    </div>
  );
};
export default SpecialPrintLogView;
