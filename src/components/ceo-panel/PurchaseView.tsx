'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, PurchaseRecord } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { Search, ChevronRight, ShoppingBag } from 'lucide-react';
import { PurchaseDetailModal } from './PurchaseDetailModal';

interface PurchaseViewProps {
  branch: Branch;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({ branch }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses');
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const tenantId = branch.id.includes('-b') ? branch.id.split('-b')[0] : branch.id;
        const res = await fetch(`/api/suppliers?tenant_id=${tenantId}`);
        const data = await res.json();
        if (isMounted && data.success && data.suppliers) {
          const mapped: PurchaseRecord[] = data.suppliers.map((s: any) => ({
            id: s.id,
            poNumber: `PO-${s.id.substring(0, 6).toUpperCase()}`,
            date: s.created_at ? s.created_at.split('T')[0] : 'Recent',
            time: '12:00 PM',
            supplierName: s.name || 'Supplier',
            category: s.category || 'Raw Materials',
            invoiceBillRef: s.phone || 'REF-001',
            totalCost: Number(s.current_balance || 0),
            paidAmount: 0,
            dueAmount: Number(s.current_balance || 0),
            stockReceivedQty: 0,
            paymentStatus: Number(s.current_balance || 0) > 0 ? 'Due' : 'Paid',
            receivedBy: 'Store Incharge',
            items: [],
          }));
          setPurchases(mapped);
        }
      } catch (err) {
        console.error('Failed to load purchases', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPurchases();
    return () => {
      isMounted = false;
    };
  }, [branch.id]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
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
  }, [purchases, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalCost = filteredPurchases.reduce((acc, p) => acc + p.totalCost, 0);
    const paidAmount = filteredPurchases.reduce((acc, p) => acc + p.paidAmount, 0);
    const dueAmount = filteredPurchases.reduce((acc, p) => acc + p.dueAmount, 0);
    const totalStockUnits = filteredPurchases.reduce((acc, p) => acc + p.stockReceivedQty, 0);

    return {
      totalCost,
      paidAmount,
      dueAmount,
      totalStockUnits,
      poCount: filteredPurchases.length,
    };
  }, [filteredPurchases]);

  return (
    <div id="executive-purchase-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2F38', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Procurement &amp; Purchases
            </h2>
            <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', color: '#8B93A1' }}>
              {stats.poCount} POs Received
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
            {branch.name} • Raw materials, base emulsions, colorants &amp; supplier invoice payables
          </p>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Total Purchase Cost</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {formatCurrency(stats.totalCost)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Across {stats.poCount} supplier consignments
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Paid to Suppliers</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
            {formatCurrency(stats.paidAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Disbursed via bank &amp; cheques
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Outstanding Payables</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
            {formatCurrency(stats.dueAmount)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Supplier credit balances pending
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Stock Units Received</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {stats.totalStockUnits} <span style={{ fontSize: '12px', color: '#8B93A1', fontWeight: 400 }}>containers</span>
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Added to warehouse inventory
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ padding: '12px 16px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '6px', padding: '6px 12px', minWidth: '280px' }}>
          <Search style={{ width: '14px', height: '14px', color: '#8B93A1' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO #, supplier name, bill ref..."
            style={{ background: 'none', border: 'none', color: '#E5E7EB', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#8B93A1' }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ backgroundColor: '#12151B', border: '1px solid #2A2F38', color: '#E5E7EB', fontSize: '12px', borderRadius: '6px', padding: '6px 10px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="All Statuses">All Statuses</option>
            <option value="Paid">Paid in Full</option>
            <option value="Partial">Partial Settlement</option>
            <option value="Due">Payment Due</option>
          </select>
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
                <td className="ceo-font-mono" style={{ fontWeight: 700, color: '#C6A15B' }}>{po.poNumber}</td>
                <td style={{ color: '#8B93A1' }} className="ceo-font-mono">{po.date} {po.time}</td>
                <td style={{ fontWeight: 600, color: '#E5E7EB' }}>{po.supplierName}</td>
                <td style={{ color: '#8B93A1' }}>{po.category}</td>
                <td className="ceo-font-mono" style={{ color: '#8B93A1' }}>{po.invoiceBillRef}</td>
                <td style={{ textAlign: 'center', color: '#8B93A1' }} className="ceo-font-mono">{po.stockReceivedQty} units</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#E5E7EB' }} className="ceo-font-mono">{formatCurrency(po.totalCost)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: po.dueAmount > 0 ? '#F87171' : '#34D399' }} className="ceo-font-mono">
                  {formatCurrency(po.dueAmount)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#C6A15B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Inspect <ChevronRight style={{ width: '12px', height: '12px' }} />
                  </span>
                </td>
              </tr>
            ))}
            {filteredPurchases.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#8B93A1' }}>
                  {loading ? 'Loading procurement records...' : 'No procurement purchase orders recorded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Purchase Detail Modal */}
      <PurchaseDetailModal
        purchase={selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        branchName={branch.name}
      />
    </div>
  );
};
