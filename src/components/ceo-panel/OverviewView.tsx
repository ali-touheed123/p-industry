'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, Invoice } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { TrendingUp, BarChart3, Calendar, FileText } from 'lucide-react';
import { DatePeriodFilter } from './DatePeriodFilter';

interface OverviewViewProps {
  branch: Branch;
}

type QuickFilter = 
  | 'Today (1D)' 
  | 'Yesterday' 
  | 'Last 2 Days' 
  | 'Last 3 Days' 
  | 'Last 7 Days' 
  | 'This Month' 
  | 'All Time';

interface DailyFinancialPoint {
  date: string;
  displayDate: string;
  dayName: string;
  grossSales: number;
  discounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  pettyCash: number;
  commission: number;
  netProfit: number;
  marginPct: number;
  invoiceCount: number;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ branch }) => {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('This Month');
  const todayIso = new Date().toISOString().split('T')[0];
  const firstOfMonthIso = todayIso.substring(0, 8) + '01';

  const [fromDate, setFromDate] = useState<string>(firstOfMonthIso);
  const [toDate, setToDate] = useState<string>(todayIso);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [itemsCostMap, setItemsCostMap] = useState<Record<string, number>>({});
  const [commissionConfig, setCommissionConfig] = useState<{ enabled: boolean; rate: number }>({ enabled: false, rate: 2.0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchOverviewData = async () => {
      const tenantId = branch?.id
        ? (/-b\d+$/.test(branch.id) ? branch.id.replace(/-b\d+$/, '') : branch.id)
        : (branch?.slug || '');

      if (!tenantId) return;
      setLoading(true);

      try {
        // 1. Fetch Invoices
        try {
          const invRes = await fetch(`/api/invoices?tenant_id=${tenantId}`);
          const invData = await invRes.json();
          if (isMounted && invData.success && invData.invoices) {
            setInvoices(invData.invoices);
          }
        } catch (err) {
          console.error('Failed to load invoices for overview', err);
        }

        // 2. Fetch Expenses
        try {
          const expRes = await fetch(`/api/expenses?tenant_id=${tenantId}`);
          const expData = await expRes.json();
          if (isMounted && expData.success && expData.expenses) {
            setExpensesList(expData.expenses);
          }
        } catch (err) {
          console.error('Failed to load expenses for overview', err);
        }

        // 3. Fetch Items
        try {
          const itemsRes = await fetch(`/api/items?tenant_id=${tenantId}`);
          const itemsData = await itemsRes.json();
          if (isMounted && itemsData.success && itemsData.items) {
            const map: Record<string, number> = {};
            itemsData.items.forEach((it: any) => {
              if (it.id) map[it.id] = Number(it.cost_price || 0);
              if (it.code) map[it.code] = Number(it.cost_price || 0);
            });
            setItemsCostMap(map);
          }
        } catch (err) {
          console.error('Failed to load items for overview', err);
        }

        // 4. Fetch Tenant commission config
        try {
          const tenantsRes = await fetch(`/api/tenants?slug=${branch?.slug || ''}`);
          const tenantsData = await tenantsRes.json();
          if (isMounted && tenantsData.success && tenantsData.tenant) {
            setCommissionConfig({
              enabled: Boolean(tenantsData.tenant.commission_enabled),
              rate: Number(tenantsData.tenant.commission_rate || 2.0),
            });
          }
        } catch {}
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOverviewData();
    return () => {
      isMounted = false;
    };
  }, [branch?.id, branch?.slug, refreshTick]);

  const allDailyRecords = useMemo(() => {
    if (!invoices || invoices.length === 0) return [];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const groups: Record<string, any[]> = {};
    const expensesByDate: Record<string, number> = {};

    // Group expenses by date
    expensesList.forEach((exp) => {
      const d = exp.created_at ? exp.created_at.split('T')[0] : (exp.date || todayIso);
      expensesByDate[d] = (expensesByDate[d] || 0) + Number(exp.amount || 0);
    });

    // Group invoices by date
    invoices.forEach((inv) => {
      const d = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : todayIso);
      if (!groups[d]) groups[d] = [];
      groups[d].push(inv);
    });

    // Ensure dates with only expenses also get represented if needed
    Object.keys(expensesByDate).forEach((d) => {
      if (!groups[d]) groups[d] = [];
    });

    const records: DailyFinancialPoint[] = Object.keys(groups)
      .sort()
      .reverse()
      .map((dateStr) => {
        const dayInvs = groups[dateStr];
        const dateObj = new Date(dateStr);
        const dayName = isNaN(dateObj.getTime()) ? '' : dayNames[dateObj.getDay()];

        const salesInvs = dayInvs.filter((i) => (i.invoice_type || 'sales') !== 'return');
        const returnInvs = dayInvs.filter((i) => (i.invoice_type || 'sales') === 'return');

        const grossSales = salesInvs.reduce((sum, i) => sum + Number(i.subtotal || i.net_total || 0), 0);
        const returnTotal = returnInvs.reduce((sum, i) => sum + Number(i.net_total || 0), 0);
        const discounts = salesInvs.reduce((sum, i) => sum + Number(i.discount || 0), 0);
        const netSales = Math.max(0, grossSales - returnTotal);

        // Real COGS calculation based on items sold
        let calculatedCogs = 0;
        salesInvs.forEach((inv) => {
          const rawItems = inv.invoice_items || inv.items || [];
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            rawItems.forEach((it: any) => {
              const qty = Number(it.qty || 1);
              const cost = itemsCostMap[it.item_id] || itemsCostMap[it.item_code] || (Number(it.unit_price || it.rate || 0) * 0.70);
              calculatedCogs += cost * qty;
            });
          } else {
            calculatedCogs += Number(inv.net_total || 0) * 0.70;
          }
        });

        // Deduct returned items cost from COGS
        returnInvs.forEach((inv) => {
          const rawItems = inv.invoice_items || inv.items || [];
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            rawItems.forEach((it: any) => {
              const qty = Number(it.qty || 1);
              const cost = itemsCostMap[it.item_id] || itemsCostMap[it.item_code] || (Number(it.unit_price || it.rate || 0) * 0.70);
              calculatedCogs = Math.max(0, calculatedCogs - (cost * qty));
            });
          }
        });

        const cogs = Math.round(calculatedCogs);
        const grossProfit = Math.max(0, netSales - cogs);
        const commission = commissionConfig.enabled ? Math.round(netSales * (commissionConfig.rate / 100)) : 0;
        const pettyCash = Math.round(expensesByDate[dateStr] || 0);
        const expenses = pettyCash + commission;
        const netProfit = grossProfit - expenses;
        const marginPct = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(1)) : 0;

        return {
          date: dateStr,
          displayDate: dateStr,
          dayName,
          grossSales,
          discounts,
          netSales,
          cogs,
          grossProfit,
          expenses,
          pettyCash,
          commission,
          netProfit,
          marginPct,
          invoiceCount: salesInvs.length,
        };
      });

    return records;
  }, [invoices, expensesList, itemsCostMap, commissionConfig, todayIso]);

  const filteredRecords = useMemo(() => {
    return allDailyRecords.filter((r) => r.date >= fromDate && r.date <= toDate);
  }, [allDailyRecords, fromDate, toDate]);

  const totals = useMemo(() => {
    const grossSales = filteredRecords.reduce((s, r) => s + r.grossSales, 0);
    const discounts = filteredRecords.reduce((s, r) => s + r.discounts, 0);
    const netSales = filteredRecords.reduce((s, r) => s + r.netSales, 0);
    const cogs = filteredRecords.reduce((s, r) => s + r.cogs, 0);
    const grossProfit = filteredRecords.reduce((s, r) => s + r.grossProfit, 0);
    const expenses = filteredRecords.reduce((s, r) => s + r.expenses, 0);
    const pettyCash = filteredRecords.reduce((s, r) => s + r.pettyCash, 0);
    const commission = filteredRecords.reduce((s, r) => s + r.commission, 0);
    const netProfit = filteredRecords.reduce((s, r) => s + r.netProfit, 0);
    const invoiceCount = filteredRecords.reduce((s, r) => s + r.invoiceCount, 0);
    const netMarginPct = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(1)) : 0;
    const grossMarginPct = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;

    return {
      grossSales,
      discounts,
      netSales,
      cogs,
      grossProfit,
      expenses,
      pettyCash,
      commission,
      netProfit,
      netMarginPct,
      grossMarginPct,
      invoiceCount,
      daysCount: filteredRecords.length,
    };
  }, [filteredRecords]);

  const handleQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(filter);
    const now = new Date();
    const to = now.toISOString().split('T')[0];

    if (filter === 'Today (1D)') {
      setFromDate(to);
      setToDate(to);
    } else if (filter === 'Yesterday') {
      const y = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
      setFromDate(y);
      setToDate(y);
    } else if (filter === 'Last 2 Days') {
      const y = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
      setFromDate(y);
      setToDate(to);
    } else if (filter === 'Last 3 Days') {
      const d = new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0];
      setFromDate(d);
      setToDate(to);
    } else if (filter === 'Last 7 Days') {
      const d = new Date(now.getTime() - 6 * 86400000).toISOString().split('T')[0];
      setFromDate(d);
      setToDate(to);
    } else if (filter === 'This Month') {
      setFromDate(to.substring(0, 8) + '01');
      setToDate(to);
    } else {
      setFromDate('2020-01-01');
      setToDate(to);
    }
  };

  return (
    <div id="executive-overview-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title & Quick Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid #2A2F38', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
                Executive Profit &amp; Loss (P&amp;L) Analytics
              </h2>
              <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', color: '#C6A15B' }}>
                {totals.daysCount} Operating Days
              </span>
              <button
                onClick={() => setRefreshTick(t => t + 1)}
                disabled={loading}
                title="Refresh data"
                style={{ background: 'none', border: '1px solid #2A2F38', borderRadius: '6px', color: loading ? '#4B5563' : '#C6A15B', cursor: loading ? 'not-allowed' : 'pointer', padding: '3px 8px', fontSize: '11px' }}
              >
                {loading ? '⟳ Loading...' : '⟳ Refresh'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
              {branch.name} • Live gross margin, COGS, operating expense, net profits and daily accounting
            </p>
          </div>

          {/* Date Period Picker + Quick Date Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <DatePeriodFilter
              startDate={fromDate}
              endDate={toDate}
              onChangeStartDate={(d) => setFromDate(d)}
              onChangeEndDate={(d) => setToDate(d)}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {(['Today (1D)', 'Yesterday', 'Last 3 Days', 'Last 7 Days', 'This Month', 'All Time'] as QuickFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleQuickFilter(filter)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: quickFilter === filter ? '1px solid rgba(198, 161, 91, 0.6)' : '1px solid #2A2F38',
                    backgroundColor: quickFilter === filter ? '#12151B' : '#1C2128',
                    color: quickFilter === filter ? '#C6A15B' : '#8B93A1',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Net Sales */}
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Net Revenue</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#C6A15B', marginTop: '6px' }}>
            {formatCurrency(totals.netSales)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Across <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{totals.invoiceCount}</span> invoices
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Cost of Goods Sold (COGS)</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {formatCurrency(totals.cogs)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Inventory product baseline cost
          </div>
        </div>

        {/* Total Expenses */}
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Operating &amp; Staff Pool</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
            {formatCurrency(totals.expenses)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Petty: {formatCurrency(totals.pettyCash)} • Comm: {formatCurrency(totals.commission)}
          </div>
        </div>

        {/* Net Profit */}
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Net Profit &amp; Margin</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
            {formatCurrency(totals.netProfit)}
          </div>
          <div style={{ fontSize: '11px', color: '#34D399', fontWeight: 600, marginTop: '4px' }}>
            {totals.netMarginPct}% Net Profit Margin
          </div>
        </div>
      </div>

      {/* Financial Ledger Table */}
      <div className="ceo-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3 className="ceo-font-heading" style={{ fontSize: '15px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Day-by-Day Historical P&amp;L Statements
            </h3>
            <p style={{ fontSize: '11px', color: '#8B93A1', margin: '2px 0 0' }}>Itemized accounting ledger for each operational shift</p>
          </div>
        </div>

        <div className="ceo-table-container">
          <table className="ceo-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th style={{ textAlign: 'right' }}>Gross Sales</th>
                <th style={{ textAlign: 'right' }}>Discounts</th>
                <th style={{ textAlign: 'right' }}>Net Sales</th>
                <th style={{ textAlign: 'right' }}>COGS (~70%)</th>
                <th style={{ textAlign: 'right' }}>Gross Profit</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Net Profit</th>
                <th style={{ textAlign: 'center' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec) => (
                <tr key={rec.date}>
                  <td className="ceo-font-mono" style={{ fontWeight: 600, color: '#E5E7EB' }}>{rec.displayDate}</td>
                  <td style={{ color: '#8B93A1' }}>{rec.dayName}</td>
                  <td style={{ textAlign: 'right', color: '#E5E7EB' }} className="ceo-font-mono">{formatCurrency(rec.grossSales)}</td>
                  <td style={{ textAlign: 'right', color: '#F87171' }} className="ceo-font-mono">-{formatCurrency(rec.discounts)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#C6A15B' }} className="ceo-font-mono">{formatCurrency(rec.netSales)}</td>
                  <td style={{ textAlign: 'right', color: '#8B93A1' }} className="ceo-font-mono">{formatCurrency(rec.cogs)}</td>
                  <td style={{ textAlign: 'right', color: '#E5E7EB' }} className="ceo-font-mono">{formatCurrency(rec.grossProfit)}</td>
                  <td style={{ textAlign: 'right', color: '#F87171' }} className="ceo-font-mono">-{formatCurrency(rec.expenses)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#34D399' }} className="ceo-font-mono">{formatCurrency(rec.netProfit)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '9999px' }} className="ceo-font-mono">
                      {rec.marginPct}%
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#8B93A1' }}>
                    {loading ? 'Loading accounting records...' : 'No sales or P&L records found for the selected date range.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
