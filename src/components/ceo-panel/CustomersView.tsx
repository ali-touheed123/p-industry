'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, Customer } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { Search, ChevronRight } from 'lucide-react';
import { CustomerDetailModal } from './CustomerDetailModal';

interface CustomersViewProps {
  branch: Branch;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ branch }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchCustomers = async () => {
      const tenantId = branch?.id
        ? (/-b\d+$/.test(branch.id) ? branch.id.replace(/-b\d+$/, '') : branch.id)
        : (branch?.slug || '');

      if (!tenantId) return;
      setLoading(true);
      try {
        // Fetch clients, all invoices, and all receipt vouchers in parallel
        const [clientsRes, invoicesRes, vouchersRes] = await Promise.all([
          fetch(`/api/clients?tenant_id=${tenantId}`),
          fetch(`/api/invoices?tenant_id=${tenantId}&limit=5000`),
          fetch(`/api/vouchers?tenant_id=${tenantId}&party_type=client`),
        ]);

        const [clientsData, invoicesData, vouchersData] = await Promise.all([
          clientsRes.json(),
          invoicesRes.json(),
          vouchersRes.json(),
        ]);

        if (!isMounted) return;
        if (!clientsData.success || !clientsData.clients) return;

        const allInvoices: any[] = invoicesData.success ? (invoicesData.invoices || []) : [];
        const allVouchers: any[] = vouchersData.success ? (vouchersData.vouchers || []) : [];

        // Helper: days since a date string
        const daysSince = (dateStr: string) => {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? 9999 : Math.floor((Date.now() - d.getTime()) / 86400000);
        };

        const mapped: Customer[] = clientsData.clients.map((c: any) => {
          const debt = Number(c.current_balance || c.balance || 0);

          // --- invoices for this client ---
          const clientInvoices = allInvoices.filter(
            (inv: any) => inv.client_id === c.id && inv.invoice_type === 'sales'
          );
          const lifetimePurchases = clientInvoices.reduce(
            (sum: number, inv: any) => sum + Number(inv.net_total || 0), 0
          );

          // --- vouchers (receipts) for this client ---
          const clientVouchers = allVouchers.filter((v: any) => v.party_id === c.id && v.voucher_type === 'receipt');
          const amountPaidToDate = clientVouchers.reduce(
            (sum: number, v: any) => sum + Number(v.amount || 0), 0
          );

          // --- real aging: bucket invoices by date of creation ---
          let agingCurrent = 0;    // 0–30 days
          let aging30to60 = 0;     // 31–60 days
          let aging60plus = 0;     // 61+ days

          clientInvoices.forEach((inv: any) => {
            const unpaid = Number(inv.due_amount || 0);
            if (unpaid <= 0) return;
            const age = daysSince(inv.date || inv.created_at || '');
            if (age <= 30) agingCurrent += unpaid;
            else if (age <= 60) aging30to60 += unpaid;
            else aging60plus += unpaid;
          });

          // If no invoice-level aging data, fall back to current_balance in current bucket
          if (agingCurrent === 0 && aging30to60 === 0 && aging60plus === 0 && debt > 0) {
            agingCurrent = debt;
          }

          // --- build transactions ledger (invoices + vouchers combined, sorted by date desc) ---
          const transactions: Customer['transactions'] = [];

          // Running balance for ledger
          let runningBalance = 0;
          const allEntries = [
            ...clientInvoices.map((inv: any) => ({
              id: inv.id,
              date: inv.date || inv.created_at?.split('T')[0] || '',
              time: inv.created_at?.split('T')[1]?.slice(0, 5) || '',
              type: 'Invoice' as const,
              referenceNo: inv.invoice_no,
              description: `Sales Invoice — ${inv.invoice_no}`,
              debit: Number(inv.net_total || 0),
              credit: 0,
              sortTs: new Date(inv.created_at || inv.date || 0).getTime(),
            })),
            ...clientVouchers.map((v: any) => ({
              id: v.id,
              date: v.date || v.created_at?.split('T')[0] || '',
              time: v.created_at?.split('T')[1]?.slice(0, 5) || '',
              type: 'Payment' as const,
              referenceNo: v.voucher_no,
              description: `Receipt — ${v.remarks || v.voucher_no}`,
              debit: 0,
              credit: Number(v.amount || 0),
              sortTs: new Date(v.created_at || v.date || 0).getTime(),
            })),
          ].sort((a, b) => a.sortTs - b.sortTs); // oldest first for running balance

          allEntries.forEach((entry) => {
            runningBalance = runningBalance + entry.debit - entry.credit;
            transactions.push({
              id: entry.id,
              date: entry.date,
              time: entry.time,
              type: entry.type,
              referenceNo: entry.referenceNo,
              description: entry.description,
              debit: entry.debit,
              credit: entry.credit,
              balanceAfter: Math.max(0, runningBalance),
            });
          });

          transactions.reverse(); // show newest first in UI

          // --- risk level using correct type ---
          const riskLevel: Customer['riskLevel'] =
            debt > 100000 ? 'High' : debt > 30000 ? 'Moderate' : 'Low';

          // --- last transaction date ---
          const lastTx = allEntries[allEntries.length - 1];
          const lastTransactionDate = lastTx?.date || (c.created_at ? c.created_at.split('T')[0] : 'N/A');

          return {
            id: c.id,
            name: c.name || 'Client',
            phone: c.phone || '—',
            city: c.city || c.address || branch.city || 'Karachi',
            address: c.address || '',
            category: c.category || 'Contractor',
            creditLimit: Number(c.credit_limit || 100000),
            totalDebt: debt,
            amountPaidToDate,
            lifetimePurchases,
            riskLevel,
            lastTransactionDate,
            aging: {
              current: agingCurrent,
              days30to60: aging30to60,
              days60plus: aging60plus,
            },
            transactions,
          };
        });

        setCustomers(mapped);
      } catch (err) {
        console.error('Failed to load clients', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCustomers();
    return () => {
      isMounted = false;
    };
  }, [branch?.id, branch?.slug, branch?.city]);


  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (categoryFilter !== 'All Categories' && c.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.toLowerCase().includes(q);
        const matchesCity = c.city.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCity) return false;
      }
      return true;
    });
  }, [customers, categoryFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalReceivables = filteredCustomers.reduce((acc, c) => acc + c.totalDebt, 0);
    const totalCollections = filteredCustomers.reduce((acc, c) => acc + c.amountPaidToDate, 0);
    const lifetimeVolume = filteredCustomers.reduce((acc, c) => acc + c.lifetimePurchases, 0);
    const highDebtCount = filteredCustomers.filter((c) => c.totalDebt > 200000).length;

    return {
      totalReceivables,
      totalCollections,
      lifetimeVolume,
      totalCount: filteredCustomers.length,
      highDebtCount,
    };
  }, [filteredCustomers]);

  return (
    <div id="executive-customers-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2F38', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Customer Accounts &amp; Udhaar Receivables
            </h2>
            <span className="ceo-font-mono" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', color: '#8B93A1' }}>
              {stats.totalCount} Accounts
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
            {branch.name} • Master credit ledger, outstanding receivables (Udhaar), aging analysis &amp; payment histories
          </p>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Total Receivables (Udhaar)</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#F87171', marginTop: '6px' }}>
            {formatCurrency(stats.totalReceivables)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            {stats.highDebtCount} accounts exceeding Rs. 200,000
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Paid to Date (Collections)</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#34D399', marginTop: '6px' }}>
            {formatCurrency(stats.totalCollections)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Settled via Cash, Cheques &amp; Bank
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Lifetime Billing Volume</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#C6A15B', marginTop: '6px' }}>
            {formatCurrency(stats.lifetimeVolume)}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Cumulative revenue generated
          </div>
        </div>

        <div className="ceo-card">
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8B93A1' }}>Active Client Base</div>
          <div className="ceo-font-mono" style={{ fontSize: '22px', fontWeight: 700, color: '#E5E7EB', marginTop: '6px' }}>
            {stats.totalCount} Clients
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '4px' }}>
            Contractors, Wholesalers &amp; Painters
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
            placeholder="Search client name, phone, city..."
            style={{ background: 'none', border: 'none', color: '#E5E7EB', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#8B93A1' }}>Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ backgroundColor: '#12151B', border: '1px solid #2A2F38', color: '#E5E7EB', fontSize: '12px', borderRadius: '6px', padding: '6px 10px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="All Categories">All Categories</option>
            <option value="Contractor">Contractors</option>
            <option value="Wholesale">Wholesale Stockists</option>
            <option value="Master Painter">Master Painters</option>
            <option value="Corporate">Corporate Construction</option>
            <option value="Retail">Retail</option>
          </select>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="ceo-table-container">
        <table className="ceo-table">
          <thead>
            <tr>
              <th>Client / Entity Name</th>
              <th>Category</th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}>Credit Limit</th>
              <th style={{ textAlign: 'right' }}>Current Debt</th>
              <th>Aging Risk Profile</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((cust) => (
              <tr key={cust.id} onClick={() => setSelectedCustomer(cust)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ fontWeight: 600, color: '#E5E7EB' }}>{cust.name}</div>
                  <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '1px' }}>{cust.city}</div>
                </td>
                <td>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#12151B', border: '1px solid #2A2F38', color: '#8B93A1', fontWeight: 600 }}>
                    {cust.category}
                  </span>
                </td>
                <td className="ceo-font-mono" style={{ color: '#8B93A1' }}>{cust.phone}</td>
                <td style={{ textAlign: 'right', color: '#8B93A1' }} className="ceo-font-mono">{formatCurrency(cust.creditLimit)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: cust.totalDebt > 0 ? '#F87171' : '#34D399' }} className="ceo-font-mono">
                  {formatCurrency(cust.totalDebt)}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '80px', height: '6px', backgroundColor: '#12151B', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${(cust.aging.current / (cust.totalDebt || 1)) * 100}%`, backgroundColor: '#34D399' }} />
                      <div style={{ width: `${(cust.aging.days30to60 / (cust.totalDebt || 1)) * 100}%`, backgroundColor: '#C6A15B' }} />
                      <div style={{ width: `${(cust.aging.days60plus / (cust.totalDebt || 1)) * 100}%`, backgroundColor: '#F87171' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: cust.riskLevel === 'Low' ? '#34D399' : '#C6A15B' }}>
                      {cust.riskLevel}
                    </span>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#C6A15B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    Ledger <ChevronRight style={{ width: '12px', height: '12px' }} />
                  </span>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#8B93A1' }}>
                  {loading ? 'Loading customer accounts...' : 'No customer accounts found. Add clients in the POS or Financial Ledgers to track debt balances.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        branchName={branch.name}
      />
    </div>
  );
};
