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
      const tenantId = branch?.id
        ? (branch.id.includes('-b') ? branch.id.split('-b')[0] : branch.id)
        : (branch?.slug || '');

      if (!tenantId) return;
      setLoading(true);
      try {
        const [purchasesRes, suppliersRes] = await Promise.all([
          fetch(`/api/purchases?tenant_id=${tenantId}`),
          fetch(`/api/suppliers?tenant_id=${tenantId}`),
        ]);

        const [purchasesData, suppliersData] = await Promise.all([
          purchasesRes.json(),
          suppliersRes.json(),
        ]);

        if (isMounted && purchasesData.success && purchasesData.purchases) {
          const supplierMap: Record<string, any> = {};
          if (suppliersData.success && suppliersData.suppliers) {
            suppliersData.suppliers.forEach((s: any) => {
              supplierMap[s.id] = s;
            });
          }

          const mapped: PurchaseRecord[] = purchasesData.purchases.map((p: any) => {
            const rawItems = p.purchase_items || p.items || [];
            const netTotal = Number(p.net_total || p.subtotal || 0);
            const paidAmt = Number(p.paid_amount || (p.payment_type === 'cash' ? netTotal : 0));
            const dueAmt = Number(p.due_amount !== undefined ? p.due_amount : Math.max(0, netTotal - paidAmt));
            const totalQty = rawItems.reduce((acc: number, it: any) => acc + Number(it.qty || 0), 0);

            const paymentStatus: PurchaseRecord['paymentStatus'] =
              dueAmt <= 0 ? 'Paid' : paidAmt > 0 ? 'Partial' : 'Due';

            const supplierInfo = supplierMap[p.supplier_id];

            return {
              id: p.id,
              poNumber: p.purchase_no || `PO-${p.id.substring(0, 6).toUpperCase()}`,
              date: p.date || (p.created_at ? p.created_at.split('T')[0] : 'Recent'),
              time: p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
              supplierName: p.supplier_name || supplierInfo?.name || 'Supplier',
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
                qty: Number(it.qty || 0),
                costRate: Number(it.cost_price || it.unit_price || it.rate || 0),
                amount: Number(it.total_price || (it.qty * (it.cost_price || it.unit_price || 0))),
              })),
            };
          });

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
  }, [branch?.id, branch?.slug]);

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
