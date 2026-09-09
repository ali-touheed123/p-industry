'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TokenTransaction } from '@/types';
import {
  Coins,
  Ticket,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  TrendingUp,
  Download,
  Filter,
  Layers,
  ArrowRight,
  FileText,
  AlertCircle,
  X,
  RefreshCw,
  Tag,
  ArrowUpDown,
  FileSpreadsheet,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';

interface Props {
  tenantId: string;
  tenantName?: string;
  staffName?: string;
  onNavigateToPos?: () => void;
  onNavigateToPurchases?: () => void;
}

export default function TokenLedger({
  tenantId,
  tenantName = 'Paint Shop',
  staffName = 'Counter Staff',
  onNavigateToPos,
  onNavigateToPurchases,
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

  // Date Filters
  const [startDate, setStartDate] = useState<string>(getMonthStartStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all' | 'custom'>('month');

  // Search & Tab Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retainedTab, setRetainedTab] = useState<'available' | 'used' | 'written_off'>('available');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'issued' | 'redeemed'>('all');

  // Suppliers list for vendor credit settlement
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Opening Stockpile Modal State
  const [showOpeningModal, setShowOpeningModal] = useState<boolean>(false);
  const [openingBrand, setOpeningBrand] = useState<string>('Master Paints');
  const [openingItemName, setOpeningItemName] = useState<string>('');
  const [openingTokenCount, setOpeningTokenCount] = useState<number>(10);
  const [openingUnitValue, setOpeningUnitValue] = useState<string>('500');
  const [openingNotes, setOpeningNotes] = useState<string>('Safe Drawer Initial Count');
  const [submittingOpening, setSubmittingOpening] = useState<boolean>(false);

  // Settle with Vendor Rep Modal State
  const [showSettleModal, setShowSettleModal] = useState<boolean>(false);
  const [settleToken, setSettleToken] = useState<TokenTransaction | null>(null);
  const [settleCount, setSettleCount] = useState<number>(1);
  const [settleMode, setSettleMode] = useState<'vendor_rep_cash' | 'vendor_rep_credit'>('vendor_rep_cash');
  const [settleRefCode, setSettleRefCode] = useState<string>('');
  const [settleSupplierId, setSettleSupplierId] = useState<string>('');
  const [submittingSettle, setSubmittingSettle] = useState<boolean>(false);

  // Write-Off Modal State
  const [showWriteOffModal, setShowWriteOffModal] = useState<boolean>(false);
  const [writeOffToken, setWriteOffToken] = useState<TokenTransaction | null>(null);
  const [writeOffReason, setWriteOffReason] = useState<string>('Company Rep Rejected');
  const [submittingWriteOff, setSubmittingWriteOff] = useState<boolean>(false);

  // Data & Loading States
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load suppliers on mount
  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/suppliers?tenant_id=${tenantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.suppliers)) {
          setSuppliers(d.suppliers);
          if (d.suppliers.length > 0) {
            setSettleSupplierId(d.suppliers[0].id);
          }
        }
      })
      .catch(() => {});
  }, [tenantId]);

  // Fetch all token transactions for the selected period
  const fetchTokenTransactions = useCallback(async () => {
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
      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Failed to load token transactions', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, startDate, endDate, activeDatePreset]);

  useEffect(() => {
    fetchTokenTransactions();
  }, [fetchTokenTransactions]);

  // Handlers for Opening Stock, Settle Rep, and Write-Off
  const handleSaveOpeningStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSubmittingOpening(true);
    try {
      const count = Math.max(1, Number(openingTokenCount) || 1);
      const unitVal = parseFloat(openingUnitValue) || 0;
      const totalVal = count * unitVal;

      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'opening_stock',
          tenant_id: tenantId,
          brand: openingBrand,
          item_name: openingItemName.trim() || `${openingBrand} Opening Token`,
          token_count: count,
          unit_token_value: unitVal,
          token_value: totalVal,
          notes: openingNotes.trim() || 'Opening safe stockpile balance',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowOpeningModal(false);
        fetchTokenTransactions();
      } else {
        alert(data.error || 'Failed to record opening stock');
      }
    } catch (err: any) {
      alert(err.message || 'Error recording opening stock');
    } finally {
      setSubmittingOpening(false);
    }
  };

  const handleSettleVendorRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !settleToken) return;
    setSubmittingSettle(true);
    try {
      const supplierObj = suppliers.find((s) => s.id === settleSupplierId);
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'settle_vendor',
          tenant_id: tenantId,
          token_allocations: [
            {
              id: settleToken.id,
              count: Math.max(1, Number(settleCount) || 1),
            },
          ],
          settlement_type: settleMode,
          claim_reference: settleRefCode.trim() || `REP-${Date.now().toString().slice(-6)}`,
          supplier_id: settleMode === 'vendor_rep_credit' ? settleSupplierId : undefined,
          supplier_name: settleMode === 'vendor_rep_credit' ? supplierObj?.name : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowSettleModal(false);
        setSettleToken(null);
        fetchTokenTransactions();
      } else {
        alert(data.error || 'Failed to settle with rep');
      }
    } catch (err: any) {
      alert(err.message || 'Error settling with vendor rep');
    } finally {
      setSubmittingSettle(false);
    }
  };

  const handleWriteOffToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !writeOffToken) return;
    setSubmittingWriteOff(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'write_off',
          tenant_id: tenantId,
          token_id: writeOffToken.id,
          write_off_reason: writeOffReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowWriteOffModal(false);
        setWriteOffToken(null);
        fetchTokenTransactions();
      } else {
        alert(data.error || 'Failed to write off token');
      }
    } catch (err: any) {
      alert(err.message || 'Error writing off token');
    } finally {
      setSubmittingWriteOff(false);
    }
  };

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

  // ── Global Filtered Transactions ───────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchClient = t.client_name?.toLowerCase().includes(q);
        const matchItem = t.item_name?.toLowerCase().includes(q);
        const matchBrand = t.brand?.toLowerCase().includes(q);
        const matchNotes = t.notes?.toLowerCase().includes(q);
        const matchPurchaseNo = t.purchases?.purchase_no?.toLowerCase().includes(q);
        const matchSupplierName = t.purchases?.supplier_name?.toLowerCase().includes(q);
        if (!matchClient && !matchItem && !matchBrand && !matchNotes && !matchPurchaseNo && !matchSupplierName) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, searchQuery]);

  // ── Top Summary Metric Cards Calculation ───────────────────────────────────
  const summaryMetrics = useMemo(() => {
    let retainedAvailableValue = 0;
    let retainedAvailableCount = 0;

    let retainedUsedValue = 0;
    let retainedUsedCount = 0;

    let customerRedeemedValue = 0;
    let customerRedeemedCount = 0;

    let customerIssuedValue = 0;
    let customerIssuedCount = 0;

    filteredTransactions.forEach((t) => {
      const val = Number(t.token_value || 0);
      const count = Number(t.token_count) || 1;
      const remCount = Number(t.remaining_count ?? count) || 1;
      const redeemedAmt = Number(t.redeemed_amount || val || 0);
      const isWrittenOff = t.usage_status === 'written_off';
      const isUsed = t.usage_status === 'used' || Boolean(t.used_against_purchase_id) || Boolean(t.used_against_voucher_id);

      if (t.transaction_type === 'shop_retained' || t.transaction_type === 'redeemed' || t.transaction_type === 'opening_stock') {
        if (isWrittenOff) {
          // Excluded from available pool
        } else if (isUsed) {
          retainedUsedValue += val;
          retainedUsedCount += count;
        } else {
          retainedAvailableValue += val;
          retainedAvailableCount += remCount;
        }
      }

      if (t.transaction_type === 'redeemed') {
        customerRedeemedValue += redeemedAmt;
        customerRedeemedCount += count;
      } else if (t.transaction_type === 'issued') {
        customerIssuedValue += val;
        customerIssuedCount += count;
      }
    });

    return {
      retainedAvailableValue,
      retainedAvailableCount,
      retainedUsedValue,
      retainedUsedCount,
      customerRedeemedValue,
      customerRedeemedCount,
      customerIssuedValue,
      customerIssuedCount,
    };
  }, [filteredTransactions]);

  // ── Stockpile Transactions (Shop-Retained + Customer-Redeemed + Opening Stock) ─
  const stockpileTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => {
      if (t.transaction_type !== 'shop_retained' && t.transaction_type !== 'redeemed' && t.transaction_type !== 'opening_stock') return false;
      const isWrittenOff = t.usage_status === 'written_off';
      const isUsed = t.usage_status === 'used' || Boolean(t.used_against_purchase_id) || Boolean(t.used_against_voucher_id);
      if (retainedTab === 'written_off') return isWrittenOff;
      if (retainedTab === 'used') return isUsed && !isWrittenOff;
      return !isUsed && !isWrittenOff;
    });
  }, [filteredTransactions, retainedTab]);

  // Grouped Brand Breakdown for Available Stockpile
  const availableGroupedSummary = useMemo(() => {
    const groups: Record<
      string,
      { brand: string; count: number; totalValue: number }
    > = {};

    filteredTransactions
      .filter(
        (t) =>
          (t.transaction_type === 'shop_retained' || t.transaction_type === 'redeemed' || t.transaction_type === 'opening_stock') &&
          t.usage_status !== 'used' &&
          t.usage_status !== 'written_off' &&
          !t.used_against_purchase_id &&
          !t.used_against_voucher_id
      )
      .forEach((t) => {
        const b = t.brand || 'General';
        if (!groups[b]) {
          groups[b] = {
            brand: b,
            count: 0,
            totalValue: 0,
          };
        }
        groups[b].count += (Number(t.remaining_count) || Number(t.token_count) || 1);
        groups[b].totalValue += Number(t.token_value || 0);
      });

    return Object.values(groups);
  }, [filteredTransactions]);

  // ── Customer Token Activity (Issued & Redeemed) ────────────────────────────
  const customerActivityTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => {
      if (t.transaction_type === 'shop_retained') return false;
      if (customerTypeFilter === 'issued') return t.transaction_type === 'issued';
      if (customerTypeFilter === 'redeemed') return t.transaction_type === 'redeemed';
      return true;
    });
  }, [filteredTransactions, customerTypeFilter]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
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
      'Applied Purchase No',
      'Purchase Supplier',
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
        `"${t.client_name || 'Walk-in Customer'}"`,
        `"${t.item_name || '—'}"`,
        `"${t.brand || '—'}"`,
        `"${t.category || '—'}"`,
        t.token_value || 0,
        t.redeemed_amount || 0,
        `"${t.usage_status || (t.transaction_type === 'shop_retained' ? 'available' : 'N/A')}"`,
        `"${t.purchases?.purchase_no || t.used_against_purchase_id || '—'}"`,
        `"${t.purchases?.supplier_name || '—'}"`,
        `"${t.used_date ? t.used_date.split('T')[0] : '—'}"`,
        `"${t.notes || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `PaintERP_TokenLedger_${tenantName.replace(/\s+/g, '_')}_${startDate || 'start'}_to_${endDate || 'end'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            <Coins style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Paint Token Ledger &amp; Stockpile
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
                {filteredTransactions.length} Total Records
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              {tenantName} · Shop-retained credit stockpile for supplier purchases &amp; customer tokens
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchTokenTransactions}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              background: '#F1F5F9',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              background: '#F1F5F9',
              color: '#334155',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet style={{ width: 14, height: 14, color: '#16A34A' }} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOpeningModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#D97706',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Coins style={{ width: 14, height: 14 }} />
            <span>+ Opening Stockpile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const avail = stockpileTransactions.find(t => t.usage_status !== 'used' && t.usage_status !== 'written_off');
              if (avail) {
                setSettleToken(avail);
                setSettleCount(avail.remaining_count || avail.token_count || 1);
              }
              setShowSettleModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <CheckCircle2 style={{ width: 14, height: 14 }} />
            <span>Settle with Rep</span>
          </button>

          {onNavigateToPurchases && (
            <button
              type="button"
              onClick={onNavigateToPurchases}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: '#EA580C',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ShoppingBag style={{ width: 14, height: 14 }} />
              <span>Purchases Tab</span>
            </button>
          )}

          {onNavigateToPos && (
            <button
              type="button"
              onClick={onNavigateToPos}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>Open POS</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* ── 4 SUMMARY STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* 1. Tokens Available (Stockpiled) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #FDE68A',
              borderLeft: '4px solid #D97706',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Tokens Available (Stockpile)
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coins style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#D97706', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.retainedAvailableValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 600, marginTop: '4px' }}>
              {summaryMetrics.retainedAvailableCount} tokens ready for supplier purchases
            </div>
          </div>

          {/* 2. Tokens Used Against Purchases */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #BBF7D0',
              borderLeft: '4px solid #16A34A',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Used Against Purchases
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#16A34A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.retainedUsedValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 600, marginTop: '4px' }}>
              {summaryMetrics.retainedUsedCount} tokens deducted from purchase bills
            </div>
          </div>

          {/* 3. Customer Redemptions Paid Out */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #BFDBFE',
              borderLeft: '4px solid #2563EB',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Customer Redemptions
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#2563EB', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.customerRedeemedValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 600, marginTop: '4px' }}>
              {summaryMetrics.customerRedeemedCount} cash payouts paid to painters
            </div>
          </div>

          {/* 4. Customer Tokens Issued */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E9D5FF',
              borderLeft: '4px solid #9333EA',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Customer Tokens Issued
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ticket style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#9333EA', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.customerIssuedValue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#7E22CE', fontWeight: 600, marginTop: '4px' }}>
              {summaryMetrics.customerIssuedCount} tokens distributed with paint cans
            </div>
          </div>
        </div>

        {/* ── DATE RANGE & SEARCH FILTER BAR ── */}
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
          {/* Top Row: Date Range Selectors */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar style={{ width: 16, height: 16, color: '#D97706' }} />
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

            {/* Quick Presets */}
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
                      border: isActive ? '1px solid #D97706' : '1px solid #E2E8F0',
                      background: isActive ? '#FEF3C7' : '#FFFFFF',
                      color: isActive ? '#92400E' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row: Search Input */}
          <div style={{ position: 'relative', width: '100%' }}>
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
              placeholder="Search by client name, paint item, brand, purchase invoice #, supplier name, notes..."
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
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1: SHOP RETAINED STOCKPILE (PURCHASE DEDUCTIONS)
            ══════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Section Header with Sub-tabs */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins style={{ width: 18, height: 18, color: '#D97706' }} />
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  Paint Token Stockpile (Purchases &amp; Supplier Payments)
                </h2>
                <p style={{ fontSize: '11px', color: '#64748B' }}>
                  Shop-retained &amp; customer-redeemed tokens accumulate as credit and are applied against supplier purchases and ledger payments
                </p>
              </div>
            </div>

            {/* Sub-view Switcher: Available Stockpile vs Used on Purchases */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#E2E8F0', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setRetainedTab('available')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: retainedTab === 'available' ? '#FFFFFF' : 'transparent',
                  color: retainedTab === 'available' ? '#D97706' : '#64748B',
                  boxShadow: retainedTab === 'available' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock style={{ width: 13, height: 13 }} />
                <span>Available Stockpile</span>
                <span
                  style={{
                    background: retainedTab === 'available' ? '#FEF3C7' : '#CBD5E1',
                    color: retainedTab === 'available' ? '#92400E' : '#475569',
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {summaryMetrics.retainedAvailableCount}
                </span>
              </button>

              <button
                onClick={() => setRetainedTab('used')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: retainedTab === 'used' ? '#FFFFFF' : 'transparent',
                  color: retainedTab === 'used' ? '#16A34A' : '#64748B',
                  boxShadow: retainedTab === 'used' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 style={{ width: 13, height: 13 }} />
                <span>Used on Purchases</span>
                <span
                  style={{
                    background: retainedTab === 'used' ? '#DCFCE7' : '#CBD5E1',
                    color: retainedTab === 'used' ? '#166534' : '#475569',
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {summaryMetrics.retainedUsedCount}
                </span>
              </button>

              <button
                onClick={() => setRetainedTab('written_off')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: retainedTab === 'written_off' ? '#FFFFFF' : 'transparent',
                  color: retainedTab === 'written_off' ? '#DC2626' : '#64748B',
                  boxShadow: retainedTab === 'written_off' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <X style={{ width: 13, height: 13 }} />
                <span>Written Off</span>
              </button>
            </div>
          </div>

          {/* Grouped Available Breakdown Badges */}
          {retainedTab === 'available' && availableGroupedSummary.length > 0 && (
            <div
              style={{
                padding: '10px 1.25rem',
                background: '#FFFDF5',
                borderBottom: '1px solid #FEF3C7',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginRight: '4px' }}>
                Stockpile by Brand:
              </span>
              {availableGroupedSummary.map((grp, gIdx) => (
                <div
                  key={gIdx}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #FDE68A',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{grp.brand}</span>
                  <span style={{ fontWeight: 800, color: '#D97706', fontFamily: 'JetBrains Mono, monospace' }}>
                    {grp.count} tokens · Rs. {grp.totalValue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: '#D97706', borderTopColor: 'transparent' }} />
              <p style={{ fontSize: '12.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Loading token records...
              </p>
            </div>
          ) : stockpileTransactions.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Coins style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                {retainedTab === 'available' ? 'No Available Stockpile Tokens' : 'No Used Purchase/Payment Token History Found'}
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
                {retainedTab === 'available'
                  ? 'All shop-retained and redeemed tokens have been applied against purchases or supplier payments, or no eligible tokens were collected in this period.'
                  : 'No tokens were applied as deductions against supplier purchases or ledger payments in the selected date range.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#FFFFFF', borderBottom: '1px solid #1E293B' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {retainedTab === 'available' ? 'Date Collected' : retainedTab === 'used' ? 'Date Used' : 'Date Written Off'}
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Origin
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Brand &amp; Category
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Paint Item
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Qty &amp; Unit
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Token Credit
                    </th>
                    {retainedTab === 'used' ? (
                      <>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                          Applied To
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                          Supplier
                        </th>
                      </>
                    ) : retainedTab === 'written_off' ? (
                      <>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                          Reason
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                          Notes
                        </th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                          Source / Client
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                          Status
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                          Actions
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stockpileTransactions.map((t, idx) => {
                    const displayDate = retainedTab === 'used' && t.used_date
                      ? new Date(t.used_date)
                      : t.created_at ? new Date(t.created_at) : new Date();
                    const dateStr = displayDate.toISOString().split('T')[0];
                    const timeStr = displayDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
                    const isRetained = t.transaction_type === 'shop_retained';
                    const isOpening = t.transaction_type === 'opening_stock';

                    return (
                      <tr
                        key={t.id || idx}
                        style={{
                          borderBottom: '1px solid #E2E8F0',
                          background: idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Date & Time */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                            {dateStr}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                            {timeStr}
                          </div>
                        </td>

                        {/* Origin Badge */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {isOpening ? (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#6B21A8',
                                background: '#F3E8FF',
                                border: '1px solid #E9D5FF',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              Opening Safe Stock
                            </span>
                          ) : t.is_external ? (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#0369A1',
                                background: '#E0F2FE',
                                border: '1px solid #BAE6FD',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              Loose / External
                            </span>
                          ) : isRetained ? (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#92400E',
                                background: '#FEF3C7',
                                border: '1px solid #FDE68A',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              Shop Retained
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#1E40AF',
                                background: '#DBEAFE',
                                border: '1px solid #BFDBFE',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              Redeemed
                            </span>
                          )}
                        </td>

                        {/* Brand & Category */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{t.brand || 'General'}</span>
                            {t.category && (
                              <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                                {t.category}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Item Name */}
                        <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 600 }}>
                          {t.item_name || 'Standard Paint Can'}
                        </td>

                        {/* Qty & Unit Value */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                            {t.remaining_count !== undefined ? `${t.remaining_count} / ${t.token_count || 1}` : `${t.token_count || 1}`} pcs
                          </span>
                          {t.unit_token_value ? (
                            <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                              @ Rs. {Number(t.unit_token_value).toLocaleString()}
                            </div>
                          ) : null}
                        </td>

                        {/* Token Total Value */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 800,
                              color: retainedTab === 'available' ? '#D97706' : retainedTab === 'used' ? '#16A34A' : '#DC2626',
                              background: retainedTab === 'available' ? '#FEF3C7' : retainedTab === 'used' ? '#DCFCE7' : '#FEE2E2',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                            }}
                          >
                            Rs. {Number(t.token_value || 0).toLocaleString()}
                          </span>
                        </td>

                        {retainedTab === 'used' ? (
                          <>
                            {/* Applied Document */}
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText style={{ width: 13, height: 13, color: '#16A34A' }} />
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                                  {t.purchases?.purchase_no ||
                                    t.vouchers?.voucher_no ||
                                    (t.claim_reference ? `Rep Ref: ${t.claim_reference}` : null) ||
                                    (t.used_against_voucher_id ? `Voucher: ${t.used_against_voucher_id.slice(0, 8)}` : null) ||
                                    (t.used_against_purchase_id ? `Purchase: ${t.used_against_purchase_id.slice(0, 8)}` : 'Applied')}
                                </span>
                              </div>
                            </td>

                            {/* Supplier Name */}
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontWeight: 600, color: '#475569' }}>
                                {t.purchases?.supplier_name || t.vouchers?.party_name || (t.settlement_type === 'vendor_rep_cash' ? 'Cash Received (Spot)' : 'Supplier / Company Rep')}
                              </span>
                            </td>
                          </>
                        ) : retainedTab === 'written_off' ? (
                          <>
                            {/* Reason */}
                            <td style={{ padding: '10px 14px', color: '#DC2626', fontWeight: 700 }}>
                              {t.write_off_reason || 'Discarded / Damaged'}
                            </td>

                            {/* Notes */}
                            <td style={{ padding: '10px 14px', color: '#64748B' }}>
                              {t.notes || '—'}
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Source Client */}
                            <td style={{ padding: '10px 14px', color: '#64748B' }}>
                              {t.client_name || (isOpening ? 'Initial Safe Entry' : isRetained ? 'Point of Sale' : 'Walk-in Customer')}
                            </td>

                            {/* Status */}
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#B45309',
                                  background: '#FEF3C7',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #FDE68A',
                                }}
                              >
                                <Clock style={{ width: 11, height: 11 }} />
                                Available in Stockpile
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettleToken(t);
                                    setSettleCount(t.remaining_count || t.token_count || 1);
                                    setShowSettleModal(true);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#EFF6FF',
                                    color: '#2563EB',
                                    border: '1px solid #BFDBFE',
                                    borderRadius: '5px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Settle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWriteOffToken(t);
                                    setShowWriteOffModal(true);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#FEF2F2',
                                    color: '#DC2626',
                                    border: '1px solid #FECACA',
                                    borderRadius: '5px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Write-Off
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2: CUSTOMER TOKEN ACTIVITY (ISSUED & REDEEMED)
            ══════════════════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Section Header with Activity Type Filter */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users style={{ width: 18, height: 18, color: '#2563EB' }} />
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  Customer Token Activity (Painters &amp; Walk-ins)
                </h2>
                <p style={{ fontSize: '11px', color: '#64748B' }}>
                  Physical tokens issued with paint cans vs. customer redemptions paid out in cash/credit
                </p>
              </div>
            </div>

            {/* Filter Tabs: All, Issued, Redeemed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#E2E8F0', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setCustomerTypeFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: customerTypeFilter === 'all' ? '#FFFFFF' : 'transparent',
                  color: customerTypeFilter === 'all' ? '#0F172A' : '#64748B',
                  boxShadow: customerTypeFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                All Customer Activity
              </button>
              <button
                onClick={() => setCustomerTypeFilter('redeemed')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: customerTypeFilter === 'redeemed' ? '#FFFFFF' : 'transparent',
                  color: customerTypeFilter === 'redeemed' ? '#2563EB' : '#64748B',
                  boxShadow: customerTypeFilter === 'redeemed' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <TrendingUp style={{ width: 12, height: 12 }} />
                <span>Customer Redeemed ({summaryMetrics.customerRedeemedCount})</span>
              </button>
              <button
                onClick={() => setCustomerTypeFilter('issued')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: customerTypeFilter === 'issued' ? '#FFFFFF' : 'transparent',
                  color: customerTypeFilter === 'issued' ? '#9333EA' : '#64748B',
                  boxShadow: customerTypeFilter === 'issued' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Ticket style={{ width: 12, height: 12 }} />
                <span>Tokens Issued ({summaryMetrics.customerIssuedCount})</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: '#2563EB', borderTopColor: 'transparent' }} />
              <p style={{ fontSize: '12.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Loading customer activity...
              </p>
            </div>
          ) : customerActivityTransactions.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Users style={{ width: 24, height: 24 }} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                No Customer Activity Found
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
                No customer redemptions or token issuances found for the selected period and filter.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#FFFFFF', borderBottom: '1px solid #1E293B' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Date &amp; Time
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Type
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Customer / Painter
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Paint Item &amp; Brand
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Token Value
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Redeemed Amount
                    </th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customerActivityTransactions.map((t, idx) => {
                    const isRedeemed = t.transaction_type === 'redeemed';
                    const createdDate = t.created_at ? new Date(t.created_at) : new Date();
                    const dateStr = createdDate.toISOString().split('T')[0];
                    const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr
                        key={t.id || idx}
                        style={{
                          borderBottom: '1px solid #E2E8F0',
                          background: idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Date & Time */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                            {dateStr}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                            {timeStr}
                          </div>
                        </td>

                        {/* Transaction Type */}
                        <td style={{ padding: '10px 14px' }}>
                          {isRedeemed ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#1E40AF',
                                background: '#DBEAFE',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid #BFDBFE',
                              }}
                            >
                              <TrendingUp style={{ width: 11, height: 11 }} />
                              Redeemed (Paid)
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#7E22CE',
                                background: '#F3E8FF',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid #E9D5FF',
                              }}
                            >
                              <Ticket style={{ width: 11, height: 11 }} />
                              Issued
                            </span>
                          )}
                        </td>

                        {/* Customer */}
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0F172A' }}>
                          {t.client_name || 'Walk-in Customer'}
                        </td>

                        {/* Item & Brand */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>
                            {t.item_name || 'Standard Paint'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {t.brand || 'General'} {t.category ? `· ${t.category}` : ''}
                          </div>
                        </td>

                        {/* Token Face Value */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#475569' }}>
                            Rs. {Number(t.token_value || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Redeemed Amount */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isRedeemed ? (
                            <span
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontWeight: 800,
                                color: '#2563EB',
                                background: '#EFF6FF',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                              }}
                            >
                              Rs. {Number(t.redeemed_amount || t.token_value || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </td>

                        {/* Notes */}
                        <td style={{ padding: '10px 14px', color: '#64748B', maxWidth: '200px', fontSize: '11.5px' }}>
                          {t.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL 1: ADD OPENING STOCKPILE ── */}
      {showOpeningModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins style={{ width: 20, height: 20, color: '#D97706' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#92400E', margin: 0 }}>
                  Add Opening Stockpile (Initial Count)
                </h3>
              </div>
              <button onClick={() => setShowOpeningModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveOpeningStock} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Paint Brand *
                </label>
                <select
                  value={openingBrand}
                  onChange={(e) => setOpeningBrand(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}
                >
                  {['Master Paints', 'Berger Paints', 'Dulux / AkzoNobel', 'Nippon Paint', 'Brighto Paints', 'Diamond Paints', 'Happilac Paints', 'Jotun Paints', 'Gobies Paints', 'General / Other'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Token Item / Description
                </label>
                <input
                  type="text"
                  value={openingItemName}
                  onChange={(e) => setOpeningItemName(e.target.value)}
                  placeholder="e.g. Weathercoat 16L Safe Token"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Token Count (Pcs) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={openingTokenCount}
                    onChange={(e) => setOpeningTokenCount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Value Per Token (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={openingUnitValue}
                    onChange={(e) => setOpeningUnitValue(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
              </div>

              <div style={{ padding: '10px', background: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>Total Stockpile Asset Value:</span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#B45309', fontFamily: 'JetBrains Mono, monospace' }}>
                  Rs. {(openingTokenCount * (parseFloat(openingUnitValue) || 0)).toLocaleString()}
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Storage / Safe Notes
                </label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Front Cash Safe / Drawer #2"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowOpeningModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOpening}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#D97706', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: submittingOpening ? 'not-allowed' : 'pointer' }}
                >
                  {submittingOpening ? 'Saving...' : 'Add to Stockpile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SETTLE WITH VENDOR REP ── */}
      {showSettleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ width: 20, height: 20, color: '#2563EB' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1E40AF', margin: 0 }}>
                  Settle Tokens with Company Rep
                </h3>
              </div>
              <button onClick={() => setShowSettleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E40AF' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSettleVendorRep} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {settleToken ? (
                <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
                    {settleToken.item_name || 'Paint Token'} ({settleToken.brand || 'General'})
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Available: <strong style={{ color: '#0F172A' }}>{settleToken.remaining_count ?? settleToken.token_count ?? 1} pcs</strong> @ Rs. {Number(settleToken.unit_token_value || (Number(settleToken.token_value) / (settleToken.remaining_count || 1))).toLocaleString()} each
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Please select a token from the table to settle.
                </div>
              )}

              {settleToken && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Tokens to Surrender (Qty) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={settleToken.remaining_count || settleToken.token_count || 1}
                    value={settleCount}
                    onChange={(e) => setSettleCount(Math.min(settleToken.remaining_count || settleToken.token_count || 1, Math.max(1, parseInt(e.target.value) || 1)))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                  <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '3px' }}>
                    Max available in this batch: {settleToken.remaining_count || settleToken.token_count || 1} tokens
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Settlement Type *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: `1px solid ${settleMode === 'vendor_rep_cash' ? '#2563EB' : '#CBD5E1'}`, background: settleMode === 'vendor_rep_cash' ? '#EFF6FF' : '#FFFFFF', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                    <input
                      type="radio"
                      name="settleMode"
                      value="vendor_rep_cash"
                      checked={settleMode === 'vendor_rep_cash'}
                      onChange={() => setSettleMode('vendor_rep_cash')}
                    />
                    Cash on Spot
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: `1px solid ${settleMode === 'vendor_rep_credit' ? '#2563EB' : '#CBD5E1'}`, background: settleMode === 'vendor_rep_credit' ? '#EFF6FF' : '#FFFFFF', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                    <input
                      type="radio"
                      name="settleMode"
                      value="vendor_rep_credit"
                      checked={settleMode === 'vendor_rep_credit'}
                      onChange={() => setSettleMode('vendor_rep_credit')}
                    />
                    Supplier Credit Slip
                  </label>
                </div>
              </div>

              {settleMode === 'vendor_rep_credit' && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Select Supplier / Paint Company *
                  </label>
                  <select
                    value={settleSupplierId}
                    onChange={(e) => setSettleSupplierId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', color: '#0F172A' }}
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Rep Slip / Claim Ref No. *
                </label>
                <input
                  type="text"
                  value={settleRefCode}
                  onChange={(e) => setSettleRefCode(e.target.value)}
                  placeholder="e.g. SLIP-8921 / REP-ASLAM"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                />
              </div>

              {settleToken && (
                <div style={{ padding: '10px', background: '#DCFCE7', borderRadius: '8px', border: '1px solid #BBF7D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>Settled Value to Claim:</span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#15803D', fontFamily: 'JetBrains Mono, monospace' }}>
                    Rs. {(settleCount * Number(settleToken.unit_token_value || (Number(settleToken.token_value) / (settleToken.remaining_count || 1)))).toLocaleString()}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle || !settleToken}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2563EB', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: submittingSettle || !settleToken ? 'not-allowed' : 'pointer' }}
                >
                  {submittingSettle ? 'Processing...' : 'Confirm Surrender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: WRITE-OFF DAMAGED TOKEN ── */}
      {showWriteOffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#FEF2F2', borderBottom: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ width: 20, height: 20, color: '#DC2626' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#991B1B', margin: 0 }}>
                  Write-Off Damaged / Expired Token
                </h3>
              </div>
              <button onClick={() => setShowWriteOffModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleWriteOffToken} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {writeOffToken && (
                <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
                    {writeOffToken.item_name || 'Paint Token'} ({writeOffToken.brand || 'General'})
                  </div>
                  <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: 700, marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                    Value to Discard: Rs. {Number(writeOffToken.token_value || 0).toLocaleString()}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Write-Off Reason *
                </label>
                <select
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', color: '#0F172A' }}
                >
                  <option value="Company Rep Rejected">Company Rep Rejected</option>
                  <option value="Torn / Scratched Barcode">Torn / Scratched Barcode</option>
                  <option value="Promotion Campaign Expired">Promotion Campaign Expired</option>
                  <option value="Counterfeit / Void Token">Counterfeit / Void Token</option>
                  <option value="Physical Token Lost">Physical Token Lost</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowWriteOffModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWriteOff}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#DC2626', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', cursor: submittingWriteOff ? 'not-allowed' : 'pointer' }}
                >
                  {submittingWriteOff ? 'Writing off...' : 'Confirm Write-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
