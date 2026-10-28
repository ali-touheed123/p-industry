'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, PurchaseRecord, CeoSupplier, SupplierTransaction } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { Search, ChevronRight, ShoppingBag, Building2, Phone, MapPin, ExternalLink, ArrowRight } from 'lucide-react';
import { PurchaseDetailModal } from './PurchaseDetailModal';
import { SupplierDetailModal } from './SupplierDetailModal';
import { DatePeriodFilter } from './DatePeriodFilter';

interface PurchaseViewProps {
  branch: Branch;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({ branch }) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const firstOfMonthIso = todayIso.substring(0, 8) + '01';

  const [activeTab, setActiveTab] = useState<'pos' | 'suppliers'>('pos');
  const [startDate, setStartDate] = useState<string>(firstOfMonthIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<string>('All Statuses');
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<CeoSupplier | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<CeoSupplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const tenantId = branch?.id || branch?.slug || '';

      if (!tenantId) return;
      setLoading(true);
      try {
        const [purchasesRes, suppliersRes, vouchersRes] = await Promise.all([
          fetch(`/api/purchases?tenant_id=${tenantId}`),
          fetch(`/api/suppliers?tenant_id=${tenantId}`),
          fetch(`/api/vouchers?tenant_id=${tenantId}&party_type=supplier`),
        ]);

        const [purchasesData, suppliersData, vouchersData] = await Promise.all([
          purchasesRes.json(),
          suppliersRes.json(),
          vouchersRes.json(),
        ]);

        if (!isMounted) return;

        const rawPurchases = purchasesData.success && Array.isArray(purchasesData.purchases) ? purchasesData.purchases : [];
        const rawSuppliers = suppliersData.success && Array.isArray(suppliersData.suppliers) ? suppliersData.suppliers : [];
        const rawVouchers = vouchersData.success && Array.isArray(vouchersData.vouchers) ? vouchersData.vouchers : [];

        // Build supplier map
        const supplierMap: Record<string, any> = {};
        rawSuppliers.forEach((s: any) => {
          supplierMap[s.id] = s;
        });

        // 1. Process Purchases
        const mappedPurchases: PurchaseRecord[] = rawPurchases.map((p: any) => {
          const rawItems = p.purchase_items || p.items || [];
          const netTotal = Number(p.net_total || p.subtotal || 0);
          const paidAmt = Number(p.paid_amount || (p.payment_type === 'cash' ? netTotal : 0));
          const dueAmt = Number(p.due_amount !== undefined ? p.due_amount : netTotal - paidAmt);
          const totalQty = rawItems.reduce((acc: number, it: any) => acc + Number(it.qty || 0), 0);

          const paymentStatus: PurchaseRecord['paymentStatus'] =
            dueAmt < 0 ? 'Credit' : dueAmt === 0 ? 'Paid' : paidAmt > 0 ? 'Partial' : 'Due';

          const supplierInfo = supplierMap[p.supplier_id];

          return {
            id: p.id,
            poNumber: p.purchase_no || `PO-${p.id.substring(0, 6).toUpperCase()}`,
            date: p.date || (p.created_at ? p.created_at.split('T')[0] : 'Recent'),
            time: p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
            supplierName: p.supplier_name || supplierInfo?.name || 'Supplier',
            supplierCode: supplierInfo?.code || 'SUPPLIER',
            category: supplierInfo?.category || 'Raw Materials & Base Emulsions',
            invoiceBillRef: p.purchase_no || supplierInfo?.phone || 'REF-001',
            totalCost: netTotal,
            paidAmount: paidAmt,
            dueAmount: dueAmt,
            stockReceivedQty: totalQty,
            paymentStatus,
            receivedBy: p.created_by || 'Store Incharge',
            items: rawItems.map((it: any) => ({
              code: it.item_code || it.code || '',
              product: it.item_name || it.name || 'Raw Material',
              packUnit: it.pack_size || it.unit || 'Can',
              unit: it.pack_size || it.unit || 'Can',
              qty: Number(it.qty || 0),
              costRate: Number(it.cost_price || it.unit_price || it.rate || 0),
              amount: Number(it.total_price || (it.qty * (it.cost_price || it.unit_price || 0))),
            })),
          };
        });

        // 2. Process Suppliers & their full ledger statement
        const mappedSuppliers: CeoSupplier[] = rawSuppliers.map((s: any) => {
          const supplierPOs = mappedPurchases.filter((p) => p.supplierName === s.name || (p as any).supplier_id === s.id);
          const supplierVouchers = rawVouchers.filter((v: any) => v.party_id === s.id);

          // FIX CEO-06b: exclude non-cash 'Stockpile Token' vouchers from cash disbursement stats.
          // Token vouchers represent goods/stockpile deposits, not cash outflows to the vendor.
          const cashVouchers = supplierVouchers.filter((v: any) => {
            const vType = (v.voucher_type || '').toLowerCase();
            const vRemarks = (v.remarks || '').toLowerCase();
            return vType !== 'token' && !vRemarks.includes('stockpile') && !vRemarks.includes('token surrender');
          });
          const tokenVouchers = supplierVouchers.filter((v: any) => {
            const vType = (v.voucher_type || '').toLowerCase();
            const vRemarks = (v.remarks || '').toLowerCase();
            return vType === 'token' || vRemarks.includes('stockpile') || vRemarks.includes('token surrender');
          });

          const totalPurchases = supplierPOs.reduce((sum: number, po: PurchaseRecord) => sum + po.totalCost, 0);
          const poPaidAmount = supplierPOs.reduce((sum: number, po: PurchaseRecord) => sum + po.paidAmount, 0);
          const voucherPaidAmount = cashVouchers.reduce((sum: number, v: any) => sum + Number(v.amount || 0), 0);
          const tokenDepositAmount = tokenVouchers.reduce((sum: number, v: any) => sum + Number(v.amount || 0), 0);
          // FIX CEO-06a: totalPaid = PO direct cash payments + separate cash vouchers.
          // Do NOT use Math.max() which picks the larger and silently drops the other.
          const totalPaid = poPaidAmount + voucherPaidAmount;

          // Statement balance: Debits (purchases) - Credits (payments)
          const calculatedBalance = totalPurchases - totalPaid;
          const dbBalance = Number(s.current_balance || 0);

          // Use negative balance if either DB or calculated statement indicates advance credit
          const finalBalance = dbBalance !== 0 ? dbBalance : calculatedBalance;

          // Build chronological ledger transactions
          const timelineEntries: Array<{
            id: string;
            date: string;
            time?: string;
            type: 'PO' | 'PMT';
            ref: string;
            description: string;
            debit: number;
            credit: number;
            rawDate: number;
          }> = [];

          supplierPOs.forEach((po) => {
            timelineEntries.push({
              id: po.id,
              date: po.date,
              time: po.time,
              type: 'PO',
              ref: po.poNumber,
              description: `Purchase Order (${po.stockReceivedQty} units)`,
              debit: po.totalCost,
              credit: 0,
              rawDate: new Date(po.date).getTime() || 0,
            });
            if (po.paidAmount > 0) {
              timelineEntries.push({
                id: `${po.id}-pay`,
                date: po.date,
                time: po.time,
                type: 'PMT',
                ref: `PMT-${po.poNumber}`,
                description: `PO Direct Payment`,
                debit: 0,
                credit: po.paidAmount,
                rawDate: new Date(po.date).getTime() || 0,
              });
            }
          });

          // Add cash voucher payments to timeline (token vouchers shown separately with label)
          [...cashVouchers, ...tokenVouchers].forEach((v: any) => {
            const vDate = v.date || (v.created_at ? v.created_at.split('T')[0] : '');
            const isToken = tokenVouchers.includes(v);
            timelineEntries.push({
              id: v.id,
              date: vDate,
              time: v.created_at ? new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
              type: 'PMT',
              ref: v.voucher_no || 'PMT-VOUCHER',
              // FIX CEO-06c: clearly label token deposits vs cash payments
              description: isToken
                ? `Stockpile Token Deposit — ${v.remarks || v.voucher_no}`
                : (v.remarks || `Vendor Payment Disbursed`),
              debit: 0,
              credit: Number(v.amount || 0),
              rawDate: new Date(vDate).getTime() || 0,
            });
          });

          // Sort ascending to compute running balance
          timelineEntries.sort((a, b) => a.rawDate - b.rawDate);

          let running = 0;
          const transactions: SupplierTransaction[] = timelineEntries.map((e) => {
            running += (e.debit - e.credit);
            return {
              id: e.id,
              date: e.date,
              time: e.time,
              type: e.type,
              ref: e.ref,
              description: e.description,
              debit: e.debit,
              credit: e.credit,
              balanceAfter: running,
            };
          }).reverse(); // Display newest first in UI

          return {
            id: s.id,
            name: s.name,
            code: s.code || `SUP-${s.id.substring(0, 4).toUpperCase()}`,
            phone: s.phone || '',
            city: s.city || 'Karachi',
            address: s.address || '',
            category: s.category || 'Raw Materials & Base Emulsions',
            current_balance: finalBalance,
            totalPurchases,
            // FIX CEO-06c: totalPaid reflects only real cash disbursements; token deposits tracked separately
            totalPaid,
            poCount: supplierPOs.length,
            transactions,
            // Surface token deposit total for display in the ledger modal if needed
            ...(tokenDepositAmount > 0 ? { tokenDepositAmount } : {}),
          };
        });

        setPurchases(mappedPurchases);
        setSuppliers(mappedSuppliers);
      } catch (err) {
        console.error('Failed to load procurement data', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [branch?.id, branch?.slug]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (startDate && p.date && p.date < startDate) return false;
      if (endDate && p.date && p.date > endDate) return false;
      if (statusFilter !== 'All Statuses' && p.paymentStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPO = p.poNumber.toLowerCase().includes(q);
        const matchesSup = p.supplierName.toLowerCase().includes(q);
        const matchesBill = p.invoiceBillRef.toLowerCase().includes(q);
        if (!matchesPO && !matchesSup && !matchesBill) return false;
      }
      return true;
    });
  }, [purchases, statusFilter, searchQuery, startDate, endDate]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (supplierStatusFilter === 'Advance Credit' && s.current_balance >= 0) return false;
      if (supplierStatusFilter === 'Payable Due' && s.current_balance <= 0) return false;
      if (supplierStatusFilter === 'Settled' && s.current_balance !== 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesPhone = (s.phone || '').toLowerCase().includes(q);
        const matchesCity = (s.city || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCity) return false;
      }
      return true;
    });
  }, [suppliers, supplierStatusFilter, searchQuery]);

  // Comprehensive Procurement KPIs
  const stats = useMemo(() => {
    const totalCost = filteredPurchases.reduce((acc, p) => acc + p.totalCost, 0);
    
    // FIX CEO-06a: replaced Math.max(poPaidAmount, supplierTotalPaid) which silently
    // dropped one of the two values. True paid = sum of all real cash disbursements.
    const paidAmount = suppliers.reduce((acc, s) => acc + s.totalPaid, 0);

    const totalStockUnits = filteredPurchases.reduce((acc, p) => acc + p.stockReceivedQty, 0);

    // Outstanding Payables / Advances across all suppliers
    const supplierCreditList = suppliers.filter((s) => s.current_balance < 0);
    const supplierCreditTotal = supplierCreditList.reduce(
      (acc, s) => acc + Math.abs(s.current_balance),
      0
    );

    const supplierPayableTotal = suppliers
      .filter((s) => s.current_balance > 0)
      .reduce((acc, s) => acc + s.current_balance, 0);

    // Net payable across the board (positive = due to vendors, negative = advance asset)
    const netDueAmount = supplierPayableTotal - supplierCreditTotal;

    return {
      totalCost,
      paidAmount,
      dueAmount: netDueAmount,
      supplierCreditTotal,
      supplierCreditList,
      supplierPayableTotal,
      totalStockUnits,
      poCount: filteredPurchases.length,
      supplierCount: suppliers.length,
    };
  }, [filteredPurchases, suppliers]);

  return (
    <div id="executive-purchase-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Procurement &amp; Purchases
            </h2>
            <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}>
              {stats.poCount} POs • {stats.supplierCount} Suppliers
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
            {branch.name} • Raw materials, base emulsions, colorants &amp; supplier invoice payables
          </p>
        </div>

        {/* View Switcher: POs vs Suppliers */}
        <div style={{ display: 'flex', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '3px', gap: '4px' }}>
          <button
            id="tab-view-pos"
            onClick={() => setActiveTab('pos')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'pos' ? '#EFF6FF' : 'transparent',
              color: activeTab === 'pos' ? '#1D4ED8' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            <ShoppingBag style={{ width: '14px', height: '14px' }} />
            Purchase Orders ({purchases.length})
          </button>
          <button
            id="tab-view-suppliers"
            onClick={() => setActiveTab('suppliers')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'suppliers' ? '#EFF6FF' : 'transparent',
              color: activeTab === 'suppliers' ? '#1D4ED8' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            <Building2 style={{ width: '14px', height: '14px' }} />
            Suppliers &amp; Payables ({suppliers.length})
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Total Purchase Cost</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginTop: '6px' }}>
            {formatCurrency(stats.totalCost)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Across {stats.poCount} supplier consignments
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Paid to Suppliers</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#059669', marginTop: '6px' }}>
            {formatCurrency(stats.paidAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Disbursed via bank, cheques &amp; vouchers
          </div>
        </div>

        <div className="ceo-card" style={{ backgroundColor: stats.supplierCreditTotal > 0 ? '#F0FDF4' : '#FFFFFF', border: stats.supplierCreditTotal > 0 ? '1px solid #BBF7D0' : '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: stats.supplierCreditTotal > 0 ? '#166534' : '#64748B' }}>
            {stats.dueAmount < 0 ? 'Net Supplier Advance' : 'Outstanding Payables'}
          </div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: stats.dueAmount <= 0 ? '#059669' : '#DC2626', marginTop: '6px' }}>
            {stats.dueAmount < 0 ? `(${formatCurrency(Math.abs(stats.dueAmount))})` : formatCurrency(stats.dueAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            {stats.supplierCreditTotal > 0 ? (
              <span style={{ color: '#059669', fontWeight: 600 }}>
                Includes {formatCurrency(stats.supplierCreditTotal)} Vendor Credit / Advance
                {stats.supplierCreditList.length > 0 && (
                  <span style={{ display: 'block', fontSize: '10px', color: '#047857', fontWeight: 500, marginTop: '2px' }}>
                    {stats.supplierCreditList.map((s) => `${s.name}: Rs. ${Math.abs(s.current_balance).toLocaleString()} Advance`).join(' • ')}
                  </span>
                )}
              </span>
            ) : stats.dueAmount > 0 ? (
              <span style={{ color: '#DC2626', fontWeight: 500 }}>Supplier payables pending settlement</span>
            ) : (
              'All supplier balances settled'
            )}
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Stock Units Received</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginTop: '6px' }}>
            {stats.totalStockUnits} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 400 }}>containers</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            Added to warehouse inventory
          </div>
        </div>
      </div>

      {/* ── TAB 1: PURCHASE ORDERS VIEW ── */}
      {activeTab === 'pos' && (
        <>
          {/* Filter toolbar */}
          <div style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <DatePeriodFilter
              startDate={startDate}
              endDate={endDate}
              onChangeStartDate={setStartDate}
              onChangeEndDate={setEndDate}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 12px', minWidth: '240px' }}>
                <Search style={{ width: '14px', height: '14px', color: '#64748B' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PO #, supplier, consignment..."
                  style={{ background: 'none', border: 'none', color: '#0F172A', fontSize: '12px', outline: 'none', width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {['All Statuses', 'Paid', 'Partial', 'Due', 'Credit'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: statusFilter === st ? '1px solid rgba(198, 161, 91, 0.6)' : '1px solid #E2E8F0',
                      backgroundColor: statusFilter === st ? '#F8FAFC' : '#FFFFFF',
                      color: statusFilter === st ? '#D97706' : '#64748B',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="ceo-table-container">
            <table className="ceo-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Date &amp; Time</th>
                  <th>Supplier Name</th>
                  <th>Category</th>
                  <th>Bill Ref</th>
                  <th style={{ textAlign: 'center' }}>Units</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                  <th style={{ textAlign: 'right' }}>Payable Due</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((po) => (
                  <tr key={po.id} onClick={() => setSelectedPurchase(po)} style={{ cursor: 'pointer' }}>
                    <td className="ceo-font-mono" style={{ fontWeight: 700, color: '#D97706' }}>{po.poNumber}</td>
                    <td style={{ color: '#64748B' }} className="ceo-font-mono">{po.date} {po.time}</td>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{po.supplierName}</td>
                    <td style={{ color: '#64748B' }}>{po.category}</td>
                    <td className="ceo-font-mono" style={{ color: '#64748B' }}>{po.invoiceBillRef}</td>
                    <td style={{ textAlign: 'center', color: '#64748B' }} className="ceo-font-mono">{po.stockReceivedQty} units</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }} className="ceo-font-mono">{formatCurrency(po.totalCost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: po.dueAmount < 0 ? '#059669' : po.dueAmount === 0 ? '#059669' : '#DC2626' }} className="ceo-font-mono">
                      {po.dueAmount < 0 ? `(${formatCurrency(Math.abs(po.dueAmount))} Credit)` : formatCurrency(po.dueAmount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        Inspect <ChevronRight style={{ width: '12px', height: '12px' }} />
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 24px', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                          <ShoppingBag style={{ width: '22px', height: '22px' }} />
                        </div>
                        <p style={{ margin: 0, fontWeight: 600, color: '#334155', fontSize: '14px' }}>
                          {loading ? 'Loading procurement records...' : 'No procurement purchase orders recorded yet.'}
                        </p>
                        {suppliers.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748B' }}>
                              You have <strong>{suppliers.length} registered suppliers</strong> in this branch with active payments and ledger balances.
                            </p>
                            <button
                              onClick={() => setActiveTab('suppliers')}
                              style={{
                                padding: '6px 14px',
                                backgroundColor: '#2563EB',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Building2 style={{ width: '14px', height: '14px' }} />
                              View Suppliers &amp; Payables ({suppliers.length})
                              <ArrowRight style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB 2: SUPPLIERS & PAYABLES DIRECTORY ── */}
      {activeTab === 'suppliers' && (
        <>
          {/* Supplier Filter Toolbar */}
          <div style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 12px', minWidth: '280px' }}>
              <Search style={{ width: '14px', height: '14px', color: '#64748B' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search supplier by name, phone, city..."
                style={{ background: 'none', border: 'none', color: '#0F172A', fontSize: '12px', outline: 'none', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {['All Statuses', 'Advance Credit', 'Payable Due', 'Settled'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSupplierStatusFilter(st)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: supplierStatusFilter === st ? '1px solid #2563EB' : '1px solid #E2E8F0',
                    backgroundColor: supplierStatusFilter === st ? '#EFF6FF' : '#FFFFFF',
                    color: supplierStatusFilter === st ? '#1D4ED8' : '#64748B',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="ceo-table-container">
            <table className="ceo-table">
              <thead>
                <tr>
                  <th>Supplier Entity</th>
                  <th>Contact &amp; Location</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>POs</th>
                  <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                  <th style={{ textAlign: 'right' }}>Total Paid / Disbursed</th>
                  <th style={{ textAlign: 'right' }}>Net Statement Balance</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((sup) => {
                  const isCredit = sup.current_balance < 0;
                  const isSettled = sup.current_balance === 0;

                  return (
                    <tr key={sup.id} onClick={() => setSelectedSupplier(sup)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                            {sup.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: '#0F172A', display: 'block' }}>{sup.name}</span>
                            <span className="ceo-font-mono" style={{ fontSize: '11px', color: '#64748B' }}>{sup.code}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#0F172A' }}>
                          {sup.phone ? <span className="ceo-font-mono">{sup.phone}</span> : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{sup.city}</div>
                      </td>
                      <td style={{ color: '#475569', fontSize: '12px' }}>{sup.category}</td>
                      <td style={{ textAlign: 'center', color: '#64748B' }} className="ceo-font-mono">
                        {sup.poCount} POs
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A' }} className="ceo-font-mono">
                        {formatCurrency(sup.totalPurchases)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }} className="ceo-font-mono">
                        {formatCurrency(sup.totalPaid)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: isCredit ? '#DCFCE7' : isSettled ? '#F1F5F9' : '#FEE2E2',
                          color: isCredit ? '#15803D' : isSettled ? '#64748B' : '#B91C1C',
                        }} className="ceo-font-mono">
                          {isCredit
                            ? `(${formatCurrency(Math.abs(sup.current_balance))} Advance)`
                            : isSettled
                            ? 'Rs. 0 Settled'
                            : formatCurrency(sup.current_balance)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupplier(sup);
                          }}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            color: '#1D4ED8',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          View Ledger <ChevronRight style={{ width: '12px', height: '12px' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                      {loading ? 'Loading suppliers directory...' : 'No suppliers found matching your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PO Detail Modal */}
      <PurchaseDetailModal
        purchase={selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        branchName={branch.name}
      />

      {/* Supplier Statement & Ledger Modal */}
      <SupplierDetailModal
        supplier={selectedSupplier}
        onClose={() => setSelectedSupplier(null)}
        branchName={branch.name}
      />
    </div>
  );
};

export default PurchaseView;
