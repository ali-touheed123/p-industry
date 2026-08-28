'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, InvoiceItem } from '@/types';
import {
  Search,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  CreditCard,
  Banknote,
  Clock,
  ChevronDown,
  ChevronRight,
  Eye,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Share2,
  X,
  User,
  ShoppingBag,
} from 'lucide-react';

interface Props {
  tenantId: string;
  tenantName?: string;
  staffName?: string;
  onNavigateToPos?: () => void;
  onEditInvoiceInPos?: (invoice: Invoice) => void;
}

export default function SalesHistory({
  tenantId,
  tenantName = 'PaintERP Branch',
  staffName = 'Counter Staff',
  onNavigateToPos,
  onEditInvoiceInPos,
}: Props) {
  // Date Helpers
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getSevenDaysAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getMonthStartStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Filter States (Prominent Date Range Filter From / To above tables)
  const [startDate, setStartDate] = useState<string>(getMonthStartStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'custom' | 'all'>('month');
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'return'>('all');

  // Invoices & Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Selected Invoice Modal / Print
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [thermalPrintInvoice, setThermalPrintInvoice] = useState<Invoice | null>(null);

  // Fetch Invoices from Backend
  const fetchInvoices = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      let url = `/api/invoices?tenant_id=${tenantId}&limit=500`;
      if (startDate && activeDatePreset !== 'all') {
        url += `&start_date=${startDate}`;
      }
      if (endDate && activeDatePreset !== 'all') {
        url += `&end_date=${endDate}`;
      }
      if (typeFilter !== 'all') {
        url += `&type=${typeFilter}`;
      }
      if (paymentFilter !== 'all') {
        url += `&payment_type=${paymentFilter}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error('Failed to fetch sales invoices', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [tenantId, startDate, endDate, typeFilter, paymentFilter, activeDatePreset]);

  // Handle Preset Clicks
  const handlePresetSelect = (preset: 'today' | 'yesterday' | '7days' | 'month' | 'all') => {
    setActiveDatePreset(preset);
    const today = getTodayStr();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const yest = getYesterdayStr();
      setStartDate(yest);
      setEndDate(yest);
    } else if (preset === '7days') {
      setStartDate(getSevenDaysAgoStr());
      setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(getMonthStartStr());
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Client-side search & filtering
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search matches
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = inv.invoice_no?.toLowerCase().includes(q);
        const matchClient = inv.client_name?.toLowerCase().includes(q);
        const matchRemarks = inv.remarks?.toLowerCase().includes(q);
        const invoiceItems = inv.invoice_items || inv.items;
        const matchItem = invoiceItems?.some((it) =>
          it.item_name?.toLowerCase().includes(q) ||
          it.item_code?.toLowerCase().includes(q) ||
          it.shade_code?.toLowerCase().includes(q)
        );
        if (!matchNo && !matchClient && !matchRemarks && !matchItem) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, searchQuery]);

  // Summary Metrics Calculation
  const summaryMetrics = useMemo(() => {
    let grossSales = 0;
    let returnsTotal = 0;
    let netSales = 0;
    let cashCollected = 0;
    let creditAmount = 0;
    let totalItemsCount = 0;
    let completedCount = 0;
    let returnCount = 0;

    filteredInvoices.forEach((inv) => {
      const isRet = inv.invoice_type === 'return';
      const net = Number(inv.net_total || 0);
      const paid = Number(inv.paid_amount || 0);
      const due = Number(inv.due_amount || 0);

      if (isRet) {
        returnsTotal += net;
        returnCount += 1;
      } else {
        grossSales += net;
        completedCount += 1;
        cashCollected += paid;
        creditAmount += due;
      }

      const invItems = inv.invoice_items || inv.items;
      if (invItems && invItems.length) {
        invItems.forEach((it) => {
          totalItemsCount += Number(it.qty || 0);
        });
      }
    });

    netSales = grossSales - returnsTotal;
    const avgTicket = completedCount > 0 ? Math.round(grossSales / completedCount) : 0;

    return {
      grossSales,
      returnsTotal,
      netSales,
      cashCollected,
      creditAmount,
      totalItemsCount,
      completedCount,
      returnCount,
      totalInvoices: filteredInvoices.length,
      avgTicket,
    };
  }, [filteredInvoices]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredInvoices.length) {
      alert('No sales records to export for the selected period.');
      return;
    }

    const headers = [
      'Invoice No',
      'Date',
      'Time',
      'Type',
      'Customer',
      'Payment Mode',
      'Items Count',
      'Subtotal (PKR)',
      'Discount (PKR)',
      'Delivery (PKR)',
      'Net Total (PKR)',
      'Paid Amount (PKR)',
      'Due Balance (PKR)',
      'Status',
      'Remarks',
    ];

    const rows = filteredInvoices.map((inv) => {
      const createdDate = inv.created_at ? new Date(inv.created_at) : new Date();
      const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
      return [
        `"${inv.invoice_no}"`,
        `"${inv.date}"`,
        `"${timeStr}"`,
        `"${inv.invoice_type === 'return' ? 'RETURN' : 'SALE'}"`,
        `"${inv.client_name || 'Walk-in Customer'}"`,
        `"${inv.payment_type?.toUpperCase() || 'CASH'}"`,
        (inv.invoice_items || inv.items)?.length || 0,
        inv.subtotal || 0,
        inv.discount || 0,
        inv.delivery_charge || 0,
        inv.net_total || 0,
        inv.paid_amount || 0,
        inv.due_amount || 0,
        `"${inv.status}"`,
        `"${inv.remarks || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `PaintERP_SalesReport_${tenantName.replace(/\s+/g, '_')}_${startDate || 'start'}_to_${endDate || 'end'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Share Invoice
  const handleWhatsAppShare = (inv: Invoice) => {
    let msg = `*PaintERP Invoice: ${inv.invoice_no}*\n`;
    msg += `Branch: ${tenantName}\n`;
    msg += `Date: ${inv.date}\n`;
    msg += `Customer: ${inv.client_name || 'Walk-in Customer'}\n\n`;
    msg += `*Items:*\n`;
    ((inv.invoice_items || inv.items) || []).forEach((it, idx) => {
      msg += `${idx + 1}. ${it.item_name} ${it.shade_code ? `(${it.shade_code})` : ''} - ${it.qty} x Rs. ${it.unit_price} = Rs. ${it.total_price}\n`;
    });
    msg += `\n*Net Total:* Rs. ${Number(inv.net_total).toLocaleString()}\n`;
    msg += `*Paid Amount:* Rs. ${Number(inv.paid_amount).toLocaleString()}\n`;
    if (Number(inv.due_amount) > 0) {
      msg += `*Remaining Balance:* Rs. ${Number(inv.due_amount).toLocaleString()}\n`;
    }
    msg += `\nThank you for doing business with us!`;

    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC', overflowY: 'auto' }}>
      {/* ── Top Header Bar ── */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#0F172A',
              color: '#F97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            <TrendingUp style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Sales Register &amp; Invoices
              </h1>
              <span
                style={{
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #FDE68A',
                }}
              >
                {filteredInvoices.length} Invoices
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              {tenantName} · Live sales reporting, invoice history &amp; item breakdowns
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            title="Refresh Invoices"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet style={{ width: 14, height: 14, color: '#38BDF8' }} />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#F97316',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <Printer style={{ width: 14, height: 14 }} />
            Print Report
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* ── Summary Metric Cards ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Net Sales */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Net Sales
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.netSales.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
              {summaryMetrics.completedCount} completed sales
            </div>
          </div>

          {/* Cash Collected */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Cash Inflow
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Banknote style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.cashCollected.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Direct cash received
            </div>
          </div>

          {/* Credit / Receivables */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Credit (Udhar)
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#D97706', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.creditAmount.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, marginTop: '4px' }}>
              Client ledger balance
            </div>
          </div>

          {/* Items Sold */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Volume Sold
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              {summaryMetrics.totalItemsCount.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>units</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Avg ticket: Rs. {summaryMetrics.avgTicket.toLocaleString()}
            </div>
          </div>
        </div>

        {/* ── DATE RANGE FILTER BAR & FILTER CONTROLS (PROMINENTLY ABOVE ITEM TABLES) ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Top Row: Date Range Selector (From Date, To Date & Quick Presets) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            {/* From & To Date Pickers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar style={{ width: 16, height: 16, color: '#F97316' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Date Period:
                </span>
              </div>

              {/* From Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                  FROM:
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>

              <span style={{ color: '#94A3B8', fontWeight: 700 }}>→</span>

              {/* To Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                  TO:
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Quick Date Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: '4px' }}>
                Quick:
              </span>
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((preset) => {
                const isActive = activeDatePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #F97316' : '1px solid #E2E8F0',
                      background: isActive ? '#FFF7ED' : '#FFFFFF',
                      color: isActive ? '#EA580C' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row: Search Bar, Payment Mode Filter, Invoice Type Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <Search
                style={{
                  width: 16,
                  height: 16,
                  color: '#94A3B8',
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice #, customer name, shade, or product..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>

            {/* Type Selector (Sales vs Returns vs All) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setTypeFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'all' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'all' ? '#0F172A' : '#64748B',
                  boxShadow: typeFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter('sales')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'sales' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'sales' ? '#16A34A' : '#64748B',
                  boxShadow: typeFilter === 'sales' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Sales Only
              </button>
              <button
                onClick={() => setTypeFilter('return')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'return' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'return' ? '#DC2626' : '#64748B',
                  boxShadow: typeFilter === 'return' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Returns Only
              </button>
            </div>

            {/* Payment Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Payment:
              </span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#0F172A',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Modes</option>
                <option value="cash">Cash Only</option>
                <option value="credit">Credit (Udhar)</option>
                <option value="card">Card Payment</option>
                <option value="bank">Bank Transfer</option>
                <option value="split">Split Payment</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── SALES INVOICES & ITEMS TABLE ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div
                className="spinner"
                style={{ margin: '0 auto 1rem', borderColor: '#f97316', borderTopColor: 'transparent' }}
              />
              <p style={{ fontSize: '13px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Loading sales records from Supabase...
              </p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Receipt style={{ width: 28, height: 28 }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                No Sales Invoices Found
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
                No completed sales or returns recorded for the selected date range ({startDate || 'All'} to {endDate || 'All'}).
              </p>
              {onNavigateToPos && (
                <button
                  onClick={onNavigateToPos}
                  style={{
                    padding: '8px 16px',
                    background: '#F97316',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Go to POS Billing
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#FFFFFF', borderBottom: '1px solid #1E293B' }}>
                    <th style={{ padding: '12px 14px', width: '40px' }}></th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Invoice #
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Date &amp; Time
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Customer
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Payment
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Items
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Subtotal
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Discount
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Net Total
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Paid
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Balance
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => {
                    const isExpanded = expandedInvoiceId === inv.id;
                    const isReturn = inv.invoice_type === 'return';
                    const createdDate = inv.created_at ? new Date(inv.created_at) : new Date();
                    const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <React.Fragment key={inv.id || idx}>
                        <tr
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            background: isExpanded ? '#F8FAFC' : idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Expand Toggle */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                              title={isExpanded ? 'Collapse items' : 'Expand item details'}
                              style={{
                                background: isExpanded ? '#0F172A' : '#F1F5F9',
                                color: isExpanded ? '#FFFFFF' : '#475569',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                width: '22px',
                                height: '22px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              {isExpanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                            </button>
                          </td>

                          {/* Invoice No */}
                          <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{inv.invoice_no}</span>
                              {isReturn && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    border: '1px solid #FECACA',
                                  }}
                                >
                                  RETURN
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                              {inv.date}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                              {timeStr}
                            </div>
                          </td>

                          {/* Customer */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: inv.client_id ? '#DBEAFE' : '#F1F5F9',
                                  color: inv.client_id ? '#1D4ED8' : '#64748B',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {inv.client_name ? inv.client_name.charAt(0).toUpperCase() : 'W'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 600, color: '#0F172A', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {inv.client_name || 'Walk-in Customer'}
                                </span>
                                {inv.created_by && (
                                  <span style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                    By: {inv.created_by}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Payment Mode */}
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontFamily: 'JetBrains Mono, monospace',
                                background:
                                  inv.payment_type === 'cash'
                                    ? '#DCFCE7'
                                    : inv.payment_type === 'credit'
                                    ? '#FEF3C7'
                                    : inv.payment_type === 'card'
                                    ? '#EFF6FF'
                                    : '#F3E8FF',
                                color:
                                  inv.payment_type === 'cash'
                                    ? '#166534'
                                    : inv.payment_type === 'credit'
                                    ? '#92400E'
                                    : inv.payment_type === 'card'
                                    ? '#1E40AF'
                                    : '#6B21A8',
                              }}
                            >
                              {inv.payment_type === 'credit' ? 'ON ACCOUNT' : (inv.payment_type || 'cash')}
                            </span>
                          </td>

                          {/* Items Count */}
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                            <span style={{ background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                              {(inv.invoice_items || inv.items)?.length || 0}
                            </span>
                          </td>

                          {/* Subtotal */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                            Rs. {Number(inv.subtotal || 0).toLocaleString()}
                          </td>

                          {/* Discount */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: Number(inv.discount) > 0 ? '#DC2626' : '#94A3B8' }}>
                            {Number(inv.discount) > 0 ? `-Rs. ${Number(inv.discount).toLocaleString()}` : '—'}
                          </td>

                          {/* Net Total */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 800,
                              fontSize: '13.5px',
                              color: isReturn ? '#DC2626' : '#0F172A',
                            }}
                          >
                            {isReturn ? '-' : ''}Rs. {Number(inv.net_total || 0).toLocaleString()}
                          </td>

                          {/* Paid */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#16A34A' }}>
                            Rs. {Number(inv.paid_amount || 0).toLocaleString()}
                          </td>

                          {/* Due / Balance */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 700,
                              color: Number(inv.due_amount) > 0 ? '#D97706' : '#94A3B8',
                            }}
                          >
                            {Number(inv.due_amount) > 0 ? `Rs. ${Number(inv.due_amount).toLocaleString()}` : 'Rs. 0'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: isReturn
                                  ? '#FEE2E2'
                                  : Number(inv.due_amount) > 0
                                  ? '#FEF3C7'
                                  : '#DCFCE7',
                                color: isReturn
                                  ? '#991B1B'
                                  : Number(inv.due_amount) > 0
                                  ? '#92400E'
                                  : '#166534',
                              }}
                            >
                              {isReturn ? 'RETURN' : Number(inv.due_amount) > 0 ? 'DUE' : 'PAID'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(inv)}
                                title="View Complete Bill"
                                style={{
                                  padding: '5px',
                                  background: '#EFF6FF',
                                  color: '#2563EB',
                                  border: '1px solid #BFDBFE',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                }}
                              >
                                <Eye style={{ width: 14, height: 14 }} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setThermalPrintInvoice(inv)}
                                title="Print Thermal Receipt"
                                style={{
                                  padding: '5px',
                                  background: '#FFF7ED',
                                  color: '#EA580C',
                                  border: '1px solid #FED7AA',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                }}
                              >
                                <Printer style={{ width: 14, height: 14 }} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleWhatsAppShare(inv)}
                                title="Share via WhatsApp"
                                style={{
                                  padding: '5px',
                                  background: '#DCFCE7',
                                  color: '#16A34A',
                                  border: '1px solid #BBF7D0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                }}
                              >
                                <Share2 style={{ width: 14, height: 14 }} />
                              </button>

                              {onEditInvoiceInPos && !isReturn && (
                                <button
                                  type="button"
                                  onClick={() => onEditInvoiceInPos(inv)}
                                  title="Open in POS & Add More Items"
                                  style={{
                                    padding: '4px 8px',
                                    background: '#FEF3C7',
                                    color: '#B45309',
                                    border: '1px solid #FDE68A',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <ShoppingBag style={{ width: 13, height: 13 }} />
                                  <span>POS Edit</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── EXPANDED ITEM BREAKDOWN ROW ── */}
                        {isExpanded && (
                          <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
                            <td colSpan={13} style={{ padding: '12px 1.5rem' }}>
                              <div
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShoppingBag style={{ width: 14, height: 14, color: '#F97316' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                      Purchased Items in {inv.invoice_no} ({(inv.invoice_items || inv.items)?.length || 0} items)
                                    </span>
                                  </div>
                                  {inv.remarks && (
                                    <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                                      Note: {inv.remarks}
                                    </span>
                                  )}
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: '#F1F5F9', color: '#475569', borderBottom: '1px solid #CBD5E1' }}>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Item Code &amp; Name</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Shade / Color</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Pack / Unit</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Qty</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Unit Price</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Discount</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Total (PKR)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(inv.invoice_items || inv.items) && (inv.invoice_items || inv.items)!.length > 0 ? (
                                      (inv.invoice_items || inv.items)!.map((item: InvoiceItem, itemIdx: number) => (
                                        <tr key={item.id || itemIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                          <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748B', marginRight: '6px', fontSize: '11px' }}>
                                              {item.item_code || `ITM-${itemIdx + 1}`}
                                            </span>
                                            {item.item_name}
                                          </td>
                                          <td style={{ padding: '6px 10px' }}>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>
                                              {item.shade_code || 'Standard'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px 10px', color: '#64748B' }}>
                                            {item.pack_size || item.unit || 'Can'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                                            {item.qty}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                                            Rs. {Number(item.unit_price || 0).toLocaleString()}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: Number(item.discount) > 0 ? '#DC2626' : '#94A3B8' }}>
                                            {Number(item.discount) > 0 ? `Rs. ${Number(item.discount).toLocaleString()}` : '0'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                                            Rs. {Number(item.total_price || (item.qty * item.unit_price)).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={7} style={{ padding: '8px 10px', textAlign: 'center', color: '#94A3B8' }}>
                                          No item records attached.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── FULL INVOICE DETAILS MODAL ── */}
      {selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(249, 115, 22, 0.2)',
                    color: '#F97316',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800 }}>
                    Invoice Details — {selectedInvoice.invoice_no}
                  </h2>
                  <p style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {tenantName} · {selectedInvoice.date}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Meta Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Customer
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedInvoice.client_name || 'Walk-in Customer'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Payment Mode
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginTop: '2px' }}>
                    {selectedInvoice.payment_type === 'credit' ? 'ON ACCOUNT' : selectedInvoice.payment_type}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Invoice Type
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: selectedInvoice.invoice_type === 'return' ? '#DC2626' : '#16A34A', textTransform: 'uppercase', marginTop: '2px' }}>
                    {selectedInvoice.invoice_type === 'return' ? 'Sales Return' : 'Direct Sale'}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Line Items
                </h4>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', color: '#475569' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Shade</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.invoice_items || selectedInvoice.items)?.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0F172A' }}>
                            {it.item_name} <span style={{ color: '#64748B', fontSize: '11px' }}>({it.pack_size || it.unit || 'Can'})</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {it.shade_code || 'Standard'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                            {it.qty}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                            Rs. {Number(it.unit_price).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                            Rs. {Number(it.total_price || (it.qty * it.unit_price)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.subtotal || 0).toLocaleString()}</span>
                </div>
                {Number(selectedInvoice.discount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                    <span>Discount:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>-Rs. {Number(selectedInvoice.discount).toLocaleString()}</span>
                  </div>
                )}
                {Number(selectedInvoice.delivery_charge) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Delivery Charge:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>+Rs. {Number(selectedInvoice.delivery_charge).toLocaleString()}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    fontSize: '16px',
                    color: '#0F172A',
                    borderTop: '1px dashed #CBD5E1',
                    paddingTop: '6px',
                    marginTop: '2px',
                  }}
                >
                  <span>Grand Net Total:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#16A34A' }}>
                    Rs. {Number(selectedInvoice.net_total || 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontWeight: 600 }}>
                  <span>Paid Amount:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.paid_amount || 0).toLocaleString()}</span>
                </div>
                {Number(selectedInvoice.due_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706', fontWeight: 700 }}>
                    <span>Invoice Balance Due:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.due_amount).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                background: '#F1F5F9',
                borderTop: '1px solid #E2E8F0',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={() => handleWhatsAppShare(selectedInvoice)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Share2 style={{ width: 14, height: 14 }} />
                Share WhatsApp
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {onEditInvoiceInPos && selectedInvoice.invoice_type !== 'return' && (
                  <button
                    onClick={() => {
                      const invToEdit = selectedInvoice;
                      setSelectedInvoice(null);
                      onEditInvoiceInPos(invToEdit);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: '#FEF3C7',
                      color: '#B45309',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ShoppingBag style={{ width: 14, height: 14 }} />
                    Edit / Add in POS
                  </button>
                )}

                <button
                  onClick={() => {
                    setThermalPrintInvoice(selectedInvoice);
                    setSelectedInvoice(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#F97316',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer style={{ width: 14, height: 14 }} />
                  Thermal Print
                </button>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  style={{
                    padding: '8px 14px',
                    background: '#E2E8F0',
                    color: '#0F172A',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── THERMAL RECEIPT PRINT MODAL ── */}
      {thermalPrintInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              background: '#FFFFFF',
              color: '#000000',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            {/* Receipt Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>
                {tenantName}
              </h3>
              <p style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                PaintERP Retail &amp; Wholesale POS
              </p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 800, marginTop: '4px' }}>
                {thermalPrintInvoice.invoice_no}
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Date: {thermalPrintInvoice.date} · Customer: {thermalPrintInvoice.client_name || 'Walk-in'}
              </div>
            </div>

            {/* Receipt Items */}
            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              {(thermalPrintInvoice.invoice_items || thermalPrintInvoice.items)?.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>
                    {it.item_name} {it.shade_code ? `(${it.shade_code})` : ''} x{it.qty}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                    Rs. {Number(it.total_price || (it.qty * it.unit_price)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Receipt Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(thermalPrintInvoice.discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discount:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>-Rs. {Number(thermalPrintInvoice.discount).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '14px', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '2px' }}>
                <span>NET TOTAL:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.net_total || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>PAID:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.paid_amount || 0).toLocaleString()}</span>
              </div>
              {Number(thermalPrintInvoice.due_amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>BALANCE DUE:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.due_amount).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Print & Close Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Print Receipt
              </button>
              <button
                onClick={() => setThermalPrintInvoice(null)}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#E2E8F0',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
