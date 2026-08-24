'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, Invoice } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { Search, ChevronRight } from 'lucide-react';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface SalesViewProps {
  branch: Branch;
}

type QuickFilter = 'Today' | 'Yesterday' | 'Last 7 Days' | 'This Month' | 'All Time';
type PaymentFilter = 'All Modes' | 'Cash' | 'Credit' | 'Bank/Card';

export const SalesView: React.FC<SalesViewProps> = ({ branch }) => {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('This Month');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('All Modes');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const tenantId = branch.id.includes('-b') ? branch.id.split('-b')[0] : branch.id;
        const res = await fetch(`/api/invoices?tenant_id=${tenantId}`);
        const data = await res.json();
        if (isMounted && data.success && data.invoices) {
          const mapped: Invoice[] = data.invoices.map((inv: any) => {
            const rawItems = inv.invoice_items || inv.items || [];
            return {
              id: inv.id,
              invoiceNumber: inv.invoice_no || `INV-${inv.id}`,
              date: inv.date || (inv.created_at ? inv.created_at.split('T')[0] : ''),
              time: inv.created_at ? new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
              customerName: inv.client_name || 'Walk-in Customer',
              customerId: inv.client_id || '',
              customerCategory: inv.client_id ? 'Contractor' : 'Retail',
              paymentMode: inv.payment_type === 'credit' ? 'Credit' : (inv.payment_type === 'bank' || inv.payment_type === 'cheque') ? 'Bank/Card' : 'Cash',
              grossAmount: Number(inv.subtotal || inv.net_total || 0),
              discountAmount: Number(inv.discount || 0),
              netAmount: Number(inv.net_total || 0),
              itemsCount: rawItems.length,
              status: inv.status || 'Completed',
              salesman: inv.created_by || 'Counter Staff',
              items: rawItems.map((it: any) => ({
                code: it.item_code || it.code || '',
                product: it.item_name || it.name || 'Product',
                shade: it.shade_code || it.shade || 'Standard',
                packUnit: it.pack_size || it.unit || 'Can',
                qty: Number(it.qty) || 1,
                unit: it.unit || 'PCS',
                rate: Number(it.unit_price || it.rate || it.price) || 0,
                discountPct: Number(it.discount_percent || it.discountPercent) || 0,
                amount: Number(it.total_price || (it.qty * (it.unit_price || it.rate || 0))) || 0,
              })),
            };
          });
          setInvoices(mapped);
        }
      } catch (err) {
        console.error('Failed to load sales invoices', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInvoices();
    return () => {
      isMounted = false;
    };
  }, [branch.id]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (paymentFilter !== 'All Modes' && inv.paymentMode !== paymentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesCust = inv.customerName.toLowerCase().includes(q);
        const matchesItems = inv.items.some(
          (i) => i.product.toLowerCase().includes(q) || i.shade.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
        );
        if (!matchesNo && !matchesCust && !matchesItems) return false;
      }
      return true;
    });
  }, [invoices, paymentFilter, searchQuery]);

  const stats = useMemo(() => {
    const netSales = filteredInvoices.reduce((acc, inv) => acc + inv.netAmount, 0);
    const cashInflow = filteredInvoices
      .filter((inv) => inv.paymentMode === 'Cash')
      .reduce((acc, inv) => acc + inv.netAmount, 0);
    const creditUdhaar = filteredInvoices
      .filter((inv) => inv.paymentMode === 'Credit')
      .reduce((acc, inv) => acc + inv.netAmount, 0);
    const totalUnits = filteredInvoices.reduce(
      (acc, inv) => acc + inv.items.reduce((s, it) => s + it.qty, 0),
      0
    );

    return {
      netSales,
      cashInflow,
      creditUdhaar,
      totalUnits,
      completedCount: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  return (
    <div id="executive-sales-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2F38', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Sales Register &amp; Invoices
            </h2>
            <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', color: '#8B93A1' }}>
              {stats.completedCount} Invoices
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
            {branch.name} • Executive live sales register, invoice records &amp; itemized shade breakdowns
          </p>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Net Sales</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#C6A15B', marginTop: '6px' }}>
            {formatCurrency(stats.netSales)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            {stats.completedCount} completed sales
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Cash Inflow</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
            {formatCurrency(stats.cashInflow)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Direct register cash collected
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Credit (Udhaar)</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
            {formatCurrency(stats.creditUdhaar)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Client ledger balance additions
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Total Volume Sold</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {stats.totalUnits} <span style={{ fontSize: '12px', color: '#8B93A1', fontWeight: 400 }}>containers</span>
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Units &amp; Containers
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ padding: '12px 16px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '6px', padding: '6px 12px', minWidth: '280px' }}>
          <Search style={{ width: '14px', height: '14px', color: '#8B93A1' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, customer, shade..."
            style={{ background: 'none', border: 'none', color: '#E5E7EB', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </div>

        {/* Payment mode filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(['All Modes', 'Cash', 'Credit', 'Bank/Card'] as PaymentFilter[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setPaymentFilter(mode)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: paymentFilter === mode ? '1px solid rgba(198, 161, 91, 0.6)' : '1px solid #2A2F38',
                backgroundColor: paymentFilter === mode ? '#12151B' : '#1C2128',
                color: paymentFilter === mode ? '#C6A15B' : '#8B93A1',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="ceo-table-container">
        <table className="ceo-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date &amp; Time</th>
              <th>Customer Name</th>
              <th>Category</th>
              <th>Payment Mode</th>
              <th style={{ textAlign: 'center' }}>Items</th>
              <th style={{ textAlign: 'right' }}>Net Amount</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => (
              <tr key={inv.id} onClick={() => setSelectedInvoice(inv)} style={{ cursor: 'pointer' }}>
                <td className="ceo-font-mono" style={{ fontWeight: 700, color: '#C6A15B' }}>{inv.invoiceNumber}</td>
                <td style={{ color: '#8B93A1' }} className="ceo-font-mono">{inv.date} {inv.time}</td>
                <td style={{ fontWeight: 600, color: '#E5E7EB' }}>{inv.customerName}</td>
                <td style={{ color: '#8B93A1' }}>{inv.customerCategory}</td>
                <td>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    backgroundColor: inv.paymentMode === 'Cash' ? 'rgba(52, 211, 153, 0.15)' : inv.paymentMode === 'Credit' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: inv.paymentMode === 'Cash' ? '#34D399' : inv.paymentMode === 'Credit' ? '#F87171' : '#38BDF8',
                  }}>
                    {inv.paymentMode}
                  </span>
                </td>
                <td style={{ textAlign: 'center', color: '#8B93A1' }} className="ceo-font-mono">{inv.items.length} items</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#E5E7EB' }} className="ceo-font-mono">{formatCurrency(inv.netAmount)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#C6A15B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Inspect <ChevronRight style={{ width: '12px', height: '12px' }} />
                  </span>
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#8B93A1' }}>
                  {loading ? 'Loading sales invoices...' : 'No sales invoices recorded yet. New invoices generated at the counter will appear here.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        branchName={branch.name}
      />
    </div>
  );
};
