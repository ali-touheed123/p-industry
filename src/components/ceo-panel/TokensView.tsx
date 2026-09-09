'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { TokenTransaction } from '@/types';
import { formatCurrency } from '@/data/ceoMockData';
import {
  Coins,
  Search,
  ChevronRight,
  Download,
  Calendar,
  Layers,
  ShoppingBag,
  Users,
  CheckCircle2,
  Clock,
  Tag,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { DatePeriodFilter } from './DatePeriodFilter';

interface TokensViewProps {
  branch: Branch;
}

export const TokensView: React.FC<TokensViewProps> = ({ branch }) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const firstOfMonthIso = todayIso.substring(0, 8) + '01';

  // Date Filters
  const [startDate, setStartDate] = useState<string>(firstOfMonthIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mainTab, setMainTab] = useState<'stockpile' | 'customer'>('stockpile');
  const [stockpileSubTab, setStockpileSubTab] = useState<'available' | 'used' | 'written_off'>('available');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'issued' | 'redeemed'>('all');
  const [showExternalOnly, setShowExternalOnly] = useState<boolean>(false);

  // Selected Token for Modal Detail Inspection
  const [selectedToken, setSelectedToken] = useState<TokenTransaction | null>(null);

  // Data & Loading
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTokens = async () => {
      const tenantId = branch?.id
        ? (/-b\d+$/.test(branch.id) ? branch.id.replace(/-b\d+$/, '') : branch.id)
        : (branch?.slug || '');

      if (!tenantId) return;
      setLoading(true);
      try {
        let url = `/api/tokens?tenant_id=${tenantId}`;
        if (startDate && activeDatePreset !== 'all') {
          url += `&start_date=${startDate}`;
        }
        if (endDate && activeDatePreset !== 'all') {
          url += `&end_date=${endDate}T23:59:59.999Z`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (isMounted && data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        } else if (isMounted) {
          setTransactions([]);
        }
      } catch (err) {
        console.error('Failed to load token records for CEO panel', err);
        if (isMounted) setTransactions([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTokens();
    return () => {
      isMounted = false;
    };
  }, [branch?.id, branch?.slug, startDate, endDate, activeDatePreset]);

  // Preset Selector
  const handlePresetSelect = (preset: 'today' | '7days' | 'month' | 'all') => {
    setActiveDatePreset(preset);
    if (preset === 'today') {
      setStartDate(todayIso);
      setEndDate(todayIso);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayIso);
    } else if (preset === 'month') {
      setStartDate(firstOfMonthIso);
      setEndDate(todayIso);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Search Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchClient = t.client_name?.toLowerCase().includes(q);
        const matchItem = t.item_name?.toLowerCase().includes(q);
        const matchBrand = t.brand?.toLowerCase().includes(q);
        const matchNotes = t.notes?.toLowerCase().includes(q);
        const matchPurchaseNo = t.purchases?.purchase_no?.toLowerCase().includes(q);
        const matchSupplier = t.purchases?.supplier_name?.toLowerCase().includes(q);
        if (!matchClient && !matchItem && !matchBrand && !matchNotes && !matchPurchaseNo && !matchSupplier) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, searchQuery]);

  // Executive KPI Summary Metrics
  const metrics = useMemo(() => {
    let usableStockpileValue = 0;
    let usableStockpileCount = 0;

    let usedStockpileValue = 0;
    let usedStockpileCount = 0;

    let customerRedeemedValue = 0;
    let customerRedeemedCount = 0;

    let customerIssuedValue = 0;
    let customerIssuedCount = 0;

    // Discrete physical asset tracking
    let physicalAssetValue = 0;    // remaining_count × unit_token_value for all unredeemed stockpile rows
    let externalIntakeValue = 0;   // is_external loose tokens accepted
    let externalIntakeCount = 0;
    let writeOffValue = 0;         // tokens written off (damaged/expired)
    let writeOffCount = 0;
    let openingStockValue = 0;
    let openingStockCount = 0;

    filteredTransactions.forEach((t) => {
      const val = Number(t.token_value || 0);
      const isUsed = t.usage_status === 'used' || Boolean(t.used_against_purchase_id) || Boolean(t.used_against_voucher_id);
      const isWrittenOff = t.usage_status === 'written_off';

      // Discrete physical asset: use remaining_count * unit_token_value when available
      if (
        (t.transaction_type === 'shop_retained' || t.transaction_type === 'opening_stock') &&
        !isUsed && !isWrittenOff
      ) {
        const discreteVal = t.remaining_count != null && t.unit_token_value != null
          ? (t.remaining_count as number) * (t.unit_token_value as number)
          : val;
        physicalAssetValue += discreteVal;
      }

      if (t.transaction_type === 'shop_retained' || t.transaction_type === 'redeemed' || t.transaction_type === 'opening_stock') {
        if (isUsed) {
          usedStockpileValue += val;
          usedStockpileCount += 1;
        } else if (!isWrittenOff) {
          usableStockpileValue += val;
          usableStockpileCount += 1;
        }
      }

      if (t.transaction_type === 'opening_stock' && !isUsed && !isWrittenOff) {
        openingStockValue += val;
        openingStockCount += 1;
      }

      if (t.is_external && !isUsed && !isWrittenOff) {
        externalIntakeValue += val;
        externalIntakeCount += 1;
      }

      if (isWrittenOff || t.transaction_type === 'write_off') {
        writeOffValue += val;
        writeOffCount += 1;
      }

      if (t.transaction_type === 'redeemed') {
        customerRedeemedValue += Number(t.redeemed_amount || val || 0);
        customerRedeemedCount += 1;
      } else if (t.transaction_type === 'issued') {
        customerIssuedValue += val;
        customerIssuedCount += 1;
      }
    });

    return {
      usableStockpileValue,
      usableStockpileCount,
      usedStockpileValue,
      usedStockpileCount,
      customerRedeemedValue,
      customerRedeemedCount,
      customerIssuedValue,
      customerIssuedCount,
      physicalAssetValue,
      externalIntakeValue,
      externalIntakeCount,
      writeOffValue,
      writeOffCount,
      openingStockValue,
      openingStockCount,
      totalRecords: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Brand Breakdown for Usable Stockpile
  const brandBreakdown = useMemo(() => {
    const map: Record<string, { brand: string; count: number; totalValue: number }> = {};

    filteredTransactions
      .filter(
        (t) =>
          (t.transaction_type === 'shop_retained' || t.transaction_type === 'redeemed') &&
          t.usage_status !== 'used' &&
          !t.used_against_purchase_id &&
          !t.used_against_voucher_id
      )
      .forEach((t) => {
        const b = t.brand || 'General';
        if (!map[b]) {
          map[b] = { brand: b, count: 0, totalValue: 0 };
        }
        map[b].count += 1;
        map[b].totalValue += Number(t.token_value || 0);
      });

    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredTransactions]);

  // Tab 1: Stockpile Transactions (Available / Used / Written Off)
  const stockpileData = useMemo(() => {
    return filteredTransactions.filter((t) => {
      const isStockpileType = t.transaction_type === 'shop_retained' || t.transaction_type === 'opening_stock';
      if (!isStockpileType) return false;
      if (showExternalOnly && !t.is_external) return false;
      if (stockpileSubTab === 'written_off') return t.usage_status === 'written_off';
      const isUsed = t.usage_status === 'used' || Boolean(t.used_against_purchase_id) || Boolean(t.used_against_voucher_id);
      return stockpileSubTab === 'used' ? isUsed : (!isUsed && t.usage_status !== 'written_off');
    });
  }, [filteredTransactions, stockpileSubTab, showExternalOnly]);

  // Tab 2: Customer Token Activity (Issued / Redeemed)
  const customerData = useMemo(() => {
    return filteredTransactions.filter((t) => {
      if (t.transaction_type === 'shop_retained') return false;
      if (customerFilter === 'issued') return t.transaction_type === 'issued';
      if (customerFilter === 'redeemed') return t.transaction_type === 'redeemed';
      return true;
    });
  }, [filteredTransactions, customerFilter]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredTransactions.length) {
      alert('No token records to export for the selected period.');
      return;
    }

    const headers = [
      'ID',
      'Date',
      'Time',
      'Transaction Type',
      'Customer / Client',
      'Item Name',
      'Brand',
      'Category',
      'Token Value (PKR)',
      'Redeemed (PKR)',
      'Usage Status',
      'Applied PO No',
      'Supplier Name',
      'Used Date',
      'Notes',
    ];

    const rows = filteredTransactions.map((t) => {
      const createdDate = t.created_at ? new Date(t.created_at) : new Date();
      const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
      const dateStr = createdDate.toISOString().split('T')[0];
      return [
        `"${t.id}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${t.transaction_type}"`,
        `"${t.client_name || 'Walk-in'}"`,
        `"${t.item_name || '—'}"`,
        `"${t.brand || '—'}"`,
        `"${t.category || '—'}"`,
        t.token_value || 0,
        t.redeemed_amount || 0,
        `"${t.usage_status || 'available'}"`,
        `"${t.purchases?.purchase_no || t.used_against_purchase_id || '—'}"`,
        `"${t.purchases?.supplier_name || '—'}"`,
        `"${t.used_date ? t.used_date.split('T')[0] : '—'}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CEO_TokenLedger_${branch.name.replace(/\s+/g, '_')}_${startDate || 'start'}_to_${endDate || 'end'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="executive-tokens-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coins style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Paint Token Stockpile &amp; Ledger
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                {branch.name} • Physical token stockpile retained for supplier discounts &amp; customer redemption audit
              </p>
            </div>
            <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', marginLeft: '6px' }}>
              {metrics.totalRecords} Records
            </span>
          </div>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#0F172A',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <FileSpreadsheet style={{ width: '15px', height: '15px', color: '#16A34A' }} />
          Export Token CSV
        </button>
      </div>

      {/* KPI Stat Cards Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ceo-card" style={{ borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Usable Stockpile (Available)
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', marginTop: '6px' }}>
            {formatCurrency(metrics.usableStockpileValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Coins style={{ width: '13px', height: '13px', color: '#D97706' }} />
            <span>{metrics.usableStockpileCount} rows in physical custody</span>
          </div>
        </div>

        <div className="ceo-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Applied to Supplier POs
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#10B981', marginTop: '6px' }}>
            {formatCurrency(metrics.usedStockpileValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 style={{ width: '13px', height: '13px', color: '#10B981' }} />
            <span>{metrics.usedStockpileCount} tokens deducted against purchases</span>
          </div>
        </div>

        <div className="ceo-card" style={{ borderLeft: '4px solid #6366F1' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Customer Cash Redeemed
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#6366F1', marginTop: '6px' }}>
            {formatCurrency(metrics.customerRedeemedValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users style={{ width: '13px', height: '13px', color: '#6366F1' }} />
            <span>{metrics.customerRedeemedCount} returns paid out &amp; stockpiled</span>
          </div>
        </div>

        <div className="ceo-card" style={{ borderLeft: '4px solid #0EA5E9' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Customer Tokens Issued
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#0EA5E9', marginTop: '6px' }}>
            {metrics.customerIssuedCount} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>tokens</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Tag style={{ width: '13px', height: '13px', color: '#0EA5E9' }} />
            <span>Value: {formatCurrency(metrics.customerIssuedValue)}</span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Row 2 — Physical Asset & Audit Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="ceo-card" style={{ borderLeft: '4px solid #059669', background: '#F0FDF4' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#059669' }}>
            🏦 Physical Safe / Drawer Value
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#059669', marginTop: '6px' }}>
            {formatCurrency(metrics.physicalAssetValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Discrete count × unit value of unredeemed stockpile rows
          </div>
        </div>

        <div className="ceo-card" style={{ borderLeft: '4px solid #F59E0B', background: '#FFFBEB' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#B45309' }}>
            🔓 Loose / External Intake
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#B45309', marginTop: '6px' }}>
            {formatCurrency(metrics.externalIntakeValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            {metrics.externalIntakeCount} tokens accepted without POS invoice history
          </div>
        </div>

        <div className="ceo-card" style={{ borderLeft: '4px solid #DC2626', background: '#FEF2F2' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#DC2626' }}>
            ✕ Write-Offs / Losses
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#DC2626', marginTop: '6px' }}>
            {formatCurrency(metrics.writeOffValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            {metrics.writeOffCount} tokens written off — damaged / expired / rejected
          </div>
        </div>
      </div>

      {/* Brand Breakdown Banner */}
      {brandBreakdown.length > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers style={{ width: '15px', height: '15px', color: '#D97706' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Stockpile Breakdown by Manufacturer Brand
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Available to offset supplier purchase payables
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {brandBreakdown.map((item) => (
              <div
                key={item.brand}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{item.brand}</span>
                <span className="ceo-font-mono" style={{ fontSize: '11px', color: '#64748B' }}>
                  ({item.count} pcs)
                </span>
                <span className="ceo-font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#D97706' }}>
                  {formatCurrency(item.totalValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        {/* Date Period Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <DatePeriodFilter
            startDate={startDate}
            endDate={endDate}
            onChangeStartDate={setStartDate}
            onChangeEndDate={setEndDate}
          />
          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(['today', '7days', 'month', 'all'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeDatePreset === preset ? '1px solid rgba(198, 161, 91, 0.6)' : '1px solid #E2E8F0',
                  backgroundColor: activeDatePreset === preset ? '#FEF3C7' : '#FFFFFF',
                  color: activeDatePreset === preset ? '#92400E' : '#64748B',
                }}
              >
                {preset === 'today' ? 'Today' : preset === '7days' ? '7 Days' : preset === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Right Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 12px', minWidth: '260px' }}>
          <Search style={{ width: '14px', height: '14px', color: '#64748B' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search paint, brand, painter, PO #..."
            style={{ background: 'none', border: 'none', color: '#0F172A', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </div>
      </div>

      {/* Main Tab Navigation & Table Card */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Navigation Tabs Header */}
        <div style={{ padding: '0 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
          {/* Main Module Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setMainTab('stockpile')}
              style={{
                padding: '12px 18px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                borderBottom: mainTab === 'stockpile' ? '3px solid #D97706' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: mainTab === 'stockpile' ? '#D97706' : '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Coins style={{ width: '16px', height: '16px' }} />
              Shop Stockpile &amp; PO Deductions
              <span className="ceo-font-mono" style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: mainTab === 'stockpile' ? '#FEF3C7' : '#E2E8F0', color: mainTab === 'stockpile' ? '#92400E' : '#64748B' }}>
                {metrics.usableStockpileCount + metrics.usedStockpileCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('customer')}
              style={{
                padding: '12px 18px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                borderBottom: mainTab === 'customer' ? '3px solid #D97706' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: mainTab === 'customer' ? '#D97706' : '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Users style={{ width: '16px', height: '16px' }} />
              Customer Token History
              <span className="ceo-font-mono" style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: mainTab === 'customer' ? '#FEF3C7' : '#E2E8F0', color: mainTab === 'customer' ? '#92400E' : '#64748B' }}>
                {metrics.customerIssuedCount + metrics.customerRedeemedCount}
              </span>
            </button>
          </div>

          {/* Sub-Filters based on Active Tab */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {mainTab === 'stockpile' ? (
              <>
                <button
                  type="button"
                  onClick={() => setStockpileSubTab('available')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: stockpileSubTab === 'available' ? '1px solid #D97706' : '1px solid #E2E8F0',
                    backgroundColor: stockpileSubTab === 'available' ? '#FEF3C7' : '#FFFFFF',
                    color: stockpileSubTab === 'available' ? '#92400E' : '#64748B',
                  }}
                >
                  Available Stockpile ({metrics.usableStockpileCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStockpileSubTab('used')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: stockpileSubTab === 'used' ? '1px solid #10B981' : '1px solid #E2E8F0',
                    backgroundColor: stockpileSubTab === 'used' ? '#D1FAE5' : '#FFFFFF',
                    color: stockpileSubTab === 'used' ? '#065F46' : '#64748B',
                  }}
                >
                  Used / Applied to POs ({metrics.usedStockpileCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStockpileSubTab('written_off')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: stockpileSubTab === 'written_off' ? '1px solid #DC2626' : '1px solid #E2E8F0',
                    backgroundColor: stockpileSubTab === 'written_off' ? '#FEE2E2' : '#FFFFFF',
                    color: stockpileSubTab === 'written_off' ? '#DC2626' : '#64748B',
                  }}
                >
                  ✕ Written Off ({metrics.writeOffCount})
                </button>
                <button
                  type="button"
                  onClick={() => setShowExternalOnly(prev => !prev)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: showExternalOnly ? '1px solid #F59E0B' : '1px solid #E2E8F0',
                    backgroundColor: showExternalOnly ? '#FFFBEB' : '#FFFFFF',
                    color: showExternalOnly ? '#B45309' : '#64748B',
                  }}
                  title="Show only loose / external brand tokens accepted without POS invoice"
                >
                  🔓 Ext. Only{showExternalOnly ? ' ✓' : ''}
                </button>
              </>
            ) : (
              <>
                {(['all', 'issued', 'redeemed'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCustomerFilter(mode)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: customerFilter === mode ? '1px solid #D97706' : '1px solid #E2E8F0',
                      backgroundColor: customerFilter === mode ? '#FEF3C7' : '#FFFFFF',
                      color: customerFilter === mode ? '#92400E' : '#64748B',
                    }}
                  >
                    {mode === 'all' ? 'All Activity' : mode === 'issued' ? 'Customer Issued' : 'Redeemed & Stockpiled'}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="ceo-table-container">
          {mainTab === 'stockpile' ? (
            <table className="ceo-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Origin / Source</th>
                  <th>Paint Product</th>
                  <th>Brand</th>
                  <th>Pack Size</th>
                  <th style={{ textAlign: 'right' }}>Token Value</th>
                  <th style={{ textAlign: 'center' }}>Stockpile Status</th>
                  <th>Applied Supplier PO</th>
                  <th style={{ textAlign: 'center' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {stockpileData.map((t) => {
                  const createdDate = t.created_at ? new Date(t.created_at) : new Date();
                  const dateStr = createdDate.toISOString().split('T')[0];
                  const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isUsed = t.usage_status === 'used' || Boolean(t.used_against_purchase_id) || Boolean(t.used_against_voucher_id);

                  return (
                    <tr key={t.id} onClick={() => setSelectedToken(t)} style={{ cursor: 'pointer' }}>
                      <td className="ceo-font-mono" style={{ color: '#64748B', fontSize: '11px' }}>
                        {dateStr} <span style={{ color: '#94A3B8' }}>{timeStr}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{t.client_name || 'Counter Sale (Shop Retained)'}</div>
                        <div style={{ fontSize: '10px', color: t.transaction_type === 'redeemed' ? '#6366F1' : '#D97706' }}>
                          {t.transaction_type === 'redeemed' ? 'Customer Redeemed' : 'POS Retained'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{t.item_name || 'Paint Item'}</td>
                      <td>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                          {t.brand || 'General'}
                        </span>
                      </td>
                      <td style={{ color: '#64748B', fontSize: '12px' }}>{t.category || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }} className="ceo-font-mono">
                        {formatCurrency(Number(t.token_value || 0))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: isUsed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                            color: isUsed ? '#059669' : '#D97706',
                          }}
                        >
                          {isUsed ? 'Applied to PO' : 'Available in Shop'}
                        </span>
                      </td>
                      <td>
                        {isUsed ? (
                          <div>
                            <div className="ceo-font-mono" style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>
                              {t.purchases?.purchase_no || t.used_against_purchase_id || 'PO Deducted'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>
                              {t.purchases?.supplier_name || 'Supplier Consignment'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Ready to Apply</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          View <ChevronRight style={{ width: '12px', height: '12px' }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {stockpileData.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      {loading ? 'Loading token stockpile records...' : 'No stockpile tokens found for the selected period.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="ceo-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Action Type</th>
                  <th>Customer / Painter</th>
                  <th>Paint Product</th>
                  <th>Brand</th>
                  <th style={{ textAlign: 'right' }}>Token Value</th>
                  <th style={{ textAlign: 'right' }}>Redeemed Cash</th>
                  <th style={{ textAlign: 'center' }}>Stockpile Join Status</th>
                  <th style={{ textAlign: 'center' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {customerData.map((t) => {
                  const createdDate = t.created_at ? new Date(t.created_at) : new Date();
                  const dateStr = createdDate.toISOString().split('T')[0];
                  const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isRedeemed = t.transaction_type === 'redeemed';

                  return (
                    <tr key={t.id} onClick={() => setSelectedToken(t)} style={{ cursor: 'pointer' }}>
                      <td className="ceo-font-mono" style={{ color: '#64748B', fontSize: '11px' }}>
                        {dateStr} <span style={{ color: '#94A3B8' }}>{timeStr}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: isRedeemed ? '#EDE9FE' : '#E0F2FE',
                            color: isRedeemed ? '#6D28D9' : '#0369A1',
                          }}
                        >
                          {isRedeemed ? 'Redeemed for Cash' : 'Issued to Customer'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{t.client_name || 'Walk-in Customer'}</div>
                        {t.notes && <div style={{ fontSize: '10px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes}</div>}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{t.item_name || 'Paint Item'}</td>
                      <td>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                          {t.brand || 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }} className="ceo-font-mono">
                        {formatCurrency(Number(t.token_value || 0))}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isRedeemed ? '#6D28D9' : '#94A3B8' }} className="ceo-font-mono">
                        {isRedeemed ? formatCurrency(Number(t.redeemed_amount || t.token_value || 0)) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isRedeemed ? (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                            {t.usage_status === 'used' ? 'Stockpile Used' : 'Added to Stockpile'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748B' }}>In Customer Hands</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          View <ChevronRight style={{ width: '12px', height: '12px' }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {customerData.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      {loading ? 'Loading customer token activity...' : 'No customer token records found for the selected period.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Read-Only Token Detail Inspection Modal */}
      {selectedToken && (
        <div className="ceo-modal-overlay">
          <div id="token-detail-modal" className="ceo-modal-box" style={{ maxWidth: '600px' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Coins style={{ width: '20px', height: '20px', color: '#D97706' }} />
                <div>
                  <h3 className="ceo-font-heading" style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Token #{selectedToken.id.slice(0, 8).toUpperCase()}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                    {branch.name} • Physical Paint Token Record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedToken(null)}
                style={{ color: '#64748B', padding: '6px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Transaction Type</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedToken.transaction_type === 'shop_retained' ? 'Shop Retained (POS)' : selectedToken.transaction_type === 'redeemed' ? 'Customer Redeemed' : 'Customer Issued'}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Token Value (PKR)</div>
                  <div className="ceo-font-mono" style={{ fontSize: '16px', fontWeight: 700, color: '#D97706', marginTop: '2px' }}>
                    {formatCurrency(Number(selectedToken.token_value || 0))}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Paint Product</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedToken.item_name || 'Standard Paint'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Brand: {selectedToken.brand || 'General'}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Customer / Painter</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedToken.client_name || 'Walk-in'}
                  </div>
                </div>
              </div>

              {/* Usage & PO Association Section */}
              <div style={{ padding: '14px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Stockpile Status &amp; Deduction Record
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Usage Status:</span>
                    <span style={{ fontWeight: 700, color: selectedToken.usage_status === 'used' ? '#059669' : '#D97706' }}>
                      {selectedToken.usage_status === 'used' ? 'Used against Supplier PO' : 'Available in Stockpile'}
                    </span>
                  </div>
                  {selectedToken.purchases && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Applied PO Number:</span>
                        <span className="ceo-font-mono" style={{ fontWeight: 700, color: '#0F172A' }}>
                          {selectedToken.purchases.purchase_no}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Supplier Name:</span>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>
                          {selectedToken.purchases.supplier_name}
                        </span>
                      </div>
                    </>
                  )}
                  {selectedToken.used_date && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Deduction Date:</span>
                      <span className="ceo-font-mono" style={{ color: '#0F172A' }}>
                        {selectedToken.used_date.split('T')[0]}
                      </span>
                    </div>
                  )}
                  {selectedToken.notes && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ color: '#64748B' }}>Notes: </span>
                      <span style={{ color: '#0F172A' }}>{selectedToken.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedToken(null)} className="ceo-btn-gold">
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
