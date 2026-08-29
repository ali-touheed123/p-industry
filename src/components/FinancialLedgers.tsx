'use client';

import React, { useState, useEffect } from 'react';
import { Client, Supplier } from '@/types';

interface Props {
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  staffName?: string;
  staffUsername?: string;
}

interface LedgerTransaction {
  id: string;
  date: string;
  type: string;
  typeClass: string;
  desc: string;
  debit: number;
  credit: number;
  bal: number;
}

export default function FinancialLedgers({
  tenantId,
  tenantSlug,
  tenantName = 'Paint House',
  staffName = 'Counter Staff',
  staffUsername,
}: Props) {
  const [activeTab, setActiveTab] = useState<'clients' | 'suppliers' | 'branches'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [statement, setStatement] = useState<LedgerTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Transactions');

  // Edit Credit Limit State
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [editLimitValue, setEditLimitValue] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  // Record Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [refNotes, setRefNotes] = useState('');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Quick Add Party Modal State
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyLimit, setNewPartyLimit] = useState('50000');
  const [submittingParty, setSubmittingParty] = useState(false);

  // Fetch Clients & Suppliers
  const fetchParties = async () => {
    if (!tenantId) return;
    try {
      if (activeTab === 'clients') {
        const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setClients(data.clients || []);
          if (data.clients?.length > 0) {
            setSelectedParty((prev: any) => {
              if (!prev) return data.clients[0];
              const updated = data.clients.find((c: any) => c.id === prev.id);
              return updated || data.clients[0];
            });
          }
        }
      } else if (activeTab === 'suppliers') {
        const res = await fetch(`/api/suppliers?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setSuppliers(data.suppliers || []);
          if (data.suppliers?.length > 0) {
            setSelectedParty((prev: any) => {
              if (!prev) return data.suppliers[0];
              const updated = data.suppliers.find((s: any) => s.id === prev.id);
              return updated || data.suppliers[0];
            });
          }
        }
      } else {
        // Fetch Sister Branches (Other shops/godowns)
        const combinedBranches: any[] = [];

        try {
          const res = await fetch('/api/tenants');
          const data = await res.json();
          if (data.success && data.tenants) {
            (data.tenants || []).forEach((t: any) => {
              if (t.id !== tenantId) {
                combinedBranches.push({
                  id: t.id,
                  code: t.slug?.toUpperCase() || 'BR',
                  name: t.name || 'Sister Branch',
                  city: t.city || 'Pakistan',
                  phone: t.phone || t.owner_phone || '—',
                  address: t.address || t.city || 'Commercial Market',
                  type: 'branch',
                  current_balance: 0,
                });
              }
            });
          }
        } catch (e) {
          console.error(e);
        }

        setBranches(combinedBranches);
        if (combinedBranches.length > 0) {
          setSelectedParty((prev: any) => {
            if (!prev) return combinedBranches[0];
            const updated = combinedBranches.find((b: any) => b.id === prev.id);
            return updated || combinedBranches[0];
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [tenantId, activeTab]);

  // Fetch Live Ledger Statement for Selected Party
  const fetchLedgerStatement = async (partyId: string) => {
    if (!tenantId || !partyId) return;
    setLoadingLedger(true);
    try {
      const partyTypeParam = activeTab === 'clients' ? 'client' : activeTab === 'suppliers' ? 'supplier' : 'branch';
      const res = await fetch(
        `/api/ledgers?tenant_id=${tenantId}&party_id=${partyId}&party_type=${partyTypeParam}`
      );
      const data = await res.json();
      if (data.success) {
        setStatement(data.statement || []);
      } else {
        setStatement([]);
      }
    } catch (err) {
      console.error(err);
      setStatement([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (selectedParty?.id) {
      fetchLedgerStatement(selectedParty.id);
      setIsEditingLimit(false);
    }
  }, [selectedParty?.id, activeTab]);

  // Record Payment Receipt / Payment with structured payment_mode
  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptAmount || !selectedParty || !tenantId) return;
    setSubmittingReceipt(true);
    setReceiptError('');

    try {
      const partyTypeParam = activeTab === 'clients' ? 'client' : activeTab === 'suppliers' ? 'supplier' : 'branch';
      const voucherTypeParam = activeTab === 'clients' ? 'receipt' : activeTab === 'suppliers' ? 'payment' : 'payment';
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          voucher_type: voucherTypeParam,
          party_type: partyTypeParam,
          party_id: selectedParty.id,
          party_name: selectedParty.name,
          amount: parseFloat(receiptAmount) || 0,
          payment_mode: paymentMode,
          reference_no: paymentMode !== 'Cash' ? refNotes : null,
          remarks: `${paymentMode}${refNotes ? ` (${refNotes})` : ''}`,
          created_by: staffName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowReceiptModal(false);
        setReceiptAmount('');
        setRefNotes('');
        // Refresh parties and statement
        await fetchParties();
        await fetchLedgerStatement(selectedParty.id);
      } else {
        setReceiptError(data.error || 'Failed to record receipt');
      }
    } catch (err: any) {
      setReceiptError(err.message || 'Error recording payment receipt');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // Update Client Credit Limit
  const handleUpdateCreditLimit = async () => {
    if (!selectedParty || !tenantId || activeTab !== 'clients') return;
    setSavingLimit(true);
    try {
      const newLimit = parseFloat(editLimitValue) || 0;
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedParty.id,
          tenant_id: tenantId,
          credit_limit: newLimit,
        }),
      });
      const data = await res.json();
      if (data.success && data.client) {
        setSelectedParty((prev: any) => ({ ...prev, credit_limit: newLimit }));
        setClients((prev) =>
          prev.map((c) => (c.id === selectedParty.id ? { ...c, credit_limit: newLimit } : c))
        );
        setIsEditingLimit(false);
      }
    } catch (err) {
      console.error('Failed to update credit limit', err);
    } finally {
      setSavingLimit(false);
    }
  };

  // Create New Client / Supplier
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName || !tenantId) return;
    setSubmittingParty(true);

    try {
      const endpoint = activeTab === 'clients' ? '/api/clients' : '/api/suppliers';
      const bodyPayload = activeTab === 'clients'
        ? {
            tenant_id: tenantId,
            name: newPartyName,
            phone: newPartyPhone,
            address: newPartyAddress,
            city: newPartyAddress,
            credit_limit: parseFloat(newPartyLimit) || 50000,
          }
        : {
            tenant_id: tenantId,
            name: newPartyName,
            phone: newPartyPhone,
            address: newPartyAddress,
            city: newPartyAddress,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddPartyModal(false);
        setNewPartyName('');
        setNewPartyPhone('');
        setNewPartyAddress('');
        await fetchParties();
        if (data.client) setSelectedParty(data.client);
        if (data.supplier) setSelectedParty(data.supplier);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingParty(false);
    }
  };

  // WhatsApp Statement Reminder (Respecting Clients vs Suppliers)
  const handleSendWhatsAppLedger = () => {
    if (!selectedParty) return;
    const balance = selectedParty.current_balance || 0;
    const message = activeTab === 'clients'
      ? `*${tenantName} — Account Statement Summary*\n` +
        `Party: ${selectedParty.name} (${selectedParty.code || '—'})\n` +
        `Date: ${new Date().toLocaleDateString()}\n` +
        `--------------------------------\n` +
        `*Total Outstanding Balance:* Rs. ${balance.toLocaleString()}\n` +
        (selectedParty.credit_limit ? `Credit Limit: Rs. ${selectedParty.credit_limit.toLocaleString()}\n` : '') +
        `--------------------------------\n` +
        `Please clear the outstanding balance at your earliest convenience.\n` +
        `Thank you!`
      : `*${tenantName} — Supplier Statement Summary*\n` +
        `Party: ${selectedParty.name} (${selectedParty.code || '—'})\n` +
        `Date: ${new Date().toLocaleDateString()}\n` +
        `--------------------------------\n` +
        `*Our Current Payable Balance:* Rs. ${balance.toLocaleString()}\n` +
        `--------------------------------\n` +
        `Please find our current outstanding balance with your business above.\n` +
        `Thank you for your continued partnership!`;

    const phone = selectedParty.phone?.replace(/[^0-9]/g, '') || '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const partiesList = activeTab === 'clients' ? clients : activeTab === 'suppliers' ? suppliers : branches;
  const filteredParties = partiesList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  // Date Filter Logic (All Transactions / Last 30 Days / This Quarter)
  const filteredStatement = statement.filter((t) => {
    if (dateFilter === 'All Transactions') return true;
    if (!t.date) return true;
    const tDate = new Date(t.date);
    if (isNaN(tDate.getTime())) return true;
    const now = new Date();
    if (dateFilter === 'Last 30 Days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return tDate >= thirtyDaysAgo;
    }
    if (dateFilter === 'This Quarter') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);
      return tDate >= startOfQuarter;
    }
    return true;
  });

  const totalDebit = filteredStatement.reduce((s, t) => s + t.debit, 0);
  const totalCredit = filteredStatement.reduce((s, t) => s + t.credit, 0);

  // Balance & Reconciliation
  const currentPartyBalance = selectedParty?.current_balance || 0;
  const fullDebit = statement.reduce((s, t) => s + t.debit, 0);
  const fullCredit = statement.reduce((s, t) => s + t.credit, 0);
  const calculatedStatementNet = fullDebit - fullCredit;
  const hasReconciliationVariance = statement.length > 0 && Math.abs(currentPartyBalance - calculatedStatementNet) > 0.01;

  // Consistent 80% threshold
  const OVERDUE_THRESHOLD = 0.8;
  const creditLimit = selectedParty?.credit_limit || 0;
  const hasCreditLimit = activeTab === 'clients' && creditLimit > 0;
  const utilizationPct = hasCreditLimit ? Math.min(100, Math.round((currentPartyBalance / creditLimit) * 100)) : 0;
  const exceedsThreshold = hasCreditLimit && currentPartyBalance >= creditLimit * OVERDUE_THRESHOLD;

  return (
    <div className="financial-ledgers-container" style={{ display: 'grid', gridTemplateColumns: '300px 1fr 280px', gap: '1.25rem', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .role-tab {
          flex: 1;
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--on-surface-variant);
          font-weight: 600;
          font-size: 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s;
        }
        .role-tab.active {
          background: var(--surface);
          color: var(--on-surface);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>
      
      {/* Print Styles for Isolated Ledger Statement */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-ledger-statement, #printable-ledger-statement * {
            visibility: visible !important;
          }
          #printable-ledger-statement {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 24px !important;
            margin: 0 !important;
            z-index: 999999 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Left Col: Directory Panel ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="headline-sm">Directory</h3>
            {activeTab !== 'branches' && (
              <button
                onClick={() => setShowAddPartyModal(true)}
                style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'var(--secondary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title={`Add New ${activeTab === 'clients' ? 'Client' : 'Supplier'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '0.75rem', gap: '2px' }}>
            <button
              onClick={() => { setActiveTab('clients'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'clients' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              Clients ({clients.length})
            </button>
            <button
              onClick={() => { setActiveTab('suppliers'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              Suppliers ({suppliers.length})
            </button>
            <button
              onClick={() => { setActiveTab('branches'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'branches' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              Branches ({branches.length})
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--on-surface-variant)' }}>search</span>
            <input
              type="text"
              className="form-input"
              placeholder={`Filter ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '34px' }}
            />
          </div>
        </div>

        {/* Directory List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredParties.map(party => {
            const isSelected = selectedParty?.id === party.id;
            const bal = party.current_balance || 0;
            const partyLimit = 'credit_limit' in party ? (party as any).credit_limit : null;
            const isOverdue = activeTab === 'clients' && partyLimit && partyLimit > 0 && bal > partyLimit * OVERDUE_THRESHOLD;
            return (
              <div
                key={party.id}
                onClick={() => setSelectedParty(party)}
                style={{
                  padding: '0.875rem 1rem',
                  borderBottom: '1px solid rgba(198,198,205,0.3)',
                  borderLeft: isSelected ? '4px solid var(--secondary)' : '4px solid transparent',
                  background: isSelected ? 'var(--surface-container)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-background)', lineHeight: 1.3 }}>
                    {party.name}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: isOverdue ? 'var(--error-container)' : bal === 0 ? '#d1fae5' : 'var(--surface-container-high)',
                      color: isOverdue ? 'var(--error)' : bal === 0 ? '#065f46' : 'var(--on-surface)',
                      fontSize: '10px',
                    }}
                  >
                    {activeTab === 'branches' ? 'BRANCH' : isOverdue ? 'OVERDUE' : bal === 0 ? 'SETTLED' : 'ACTIVE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  <span>ID: {party.code || party.city || '—'}</span>
                  <span className="font-mono font-bold" style={{ color: isOverdue ? 'var(--error)' : 'inherit', fontSize: '12px' }}>
                    Rs. {bal.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
          {filteredParties.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
              No {activeTab} found.
            </div>
          )}
        </div>
      </div>

      {/* ── Middle Col: Statement of Account Table ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedParty ? (
          <div id="printable-ledger-statement" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="headline-sm">{selectedParty.name}</h3>
                  <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                    {activeTab === 'clients' ? 'Client' : activeTab === 'suppliers' ? 'Supplier' : 'Sister Branch'}
                  </span>
                </div>
                <p className="text-muted text-xs font-mono" style={{ marginTop: '2px' }}>
                  ID: {selectedParty.code || '—'} • Tel: {selectedParty.phone || 'No phone'}
                </p>
              </div>

              <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="form-input"
                  style={{ height: '34px', fontSize: '12px', paddingRight: '2rem' }}
                >
                  <option>All Transactions</option>
                  <option>Last 30 Days</option>
                  <option>This Quarter</option>
                </select>
                <button
                  onClick={handleSendWhatsAppLedger}
                  className="btn btn-secondary"
                  style={{ height: '34px', padding: '0 10px' }}
                  title="Share Statement via WhatsApp"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>share</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="btn btn-secondary"
                  style={{ height: '34px', padding: '0 10px' }}
                  title="Print Ledger Statement"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>
                </button>
              </div>
            </div>

            {/* Table Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingLedger ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: '#f97316', borderTopColor: 'transparent' }} />
                  <p className="text-muted text-sm font-mono">Loading statement of account...</p>
                </div>
              ) : filteredStatement.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                  No transactions found for this party.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Ref / Description</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatement.map((t, idx) => (
                      <tr key={idx}>
                        <td className="font-mono text-muted" style={{ fontSize: '12px' }}>{t.date}</td>
                        <td><span className={`badge ${t.typeClass}`}>{t.type}</span></td>
                        <td style={{ fontSize: '13px' }}>{t.desc}</td>
                        <td className="text-right font-mono font-bold" style={{ color: t.debit > 0 ? 'var(--error)' : 'inherit' }}>
                          {t.debit > 0 ? t.debit.toLocaleString() : '-'}
                        </td>
                        <td className="text-right font-mono font-bold" style={{ color: t.credit > 0 ? '#065f46' : 'inherit' }}>
                          {t.credit > 0 ? t.credit.toLocaleString() : '-'}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {t.bal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Footer Totals */}
            <div style={{ padding: '0.75rem 1.25rem', background: 'var(--surface-container-high)', borderTop: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div>
                <span className="text-muted">TOTAL DEBIT: </span>
                <strong className="font-mono" style={{ color: 'var(--on-surface)', marginLeft: '4px' }}>Rs. {totalDebit.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-muted">TOTAL CREDIT: </span>
                <strong className="font-mono" style={{ color: '#065f46', marginLeft: '4px' }}>Rs. {totalCredit.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>
            Select an account from the directory.
          </div>
        )}
      </div>

      {/* ── Right Col: Financial Summary & Actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Record Receipt / Payment / Settlement Button */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--secondary-fixed)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: 24 }}>payments</span>
          </div>
          <h4 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
            {activeTab === 'clients' ? 'Receive Payment' : activeTab === 'suppliers' ? 'Pay Supplier' : 'Branch Settlement'}
          </h4>
          <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            {activeTab === 'clients' ? 'Post cash, online or cheque payment to client ledger' : activeTab === 'suppliers' ? 'Record payment disbursed to vendor' : 'Settle inter-branch transfer balance'}
          </p>
          <button
            onClick={() => setShowReceiptModal(true)}
            disabled={!selectedParty}
            className="btn btn-primary btn-full"
            style={{ opacity: !selectedParty ? 0.5 : 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
            {activeTab === 'clients' ? 'Record Receipt' : activeTab === 'suppliers' ? 'Record Payment' : 'Record Settlement'}
          </button>
        </div>

        {/* Financial Summary Card */}
        {selectedParty && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 className="headline-sm" style={{ marginBottom: '1rem' }}>Financial Summary</h4>
            
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="label-caps" style={{ color: 'var(--on-surface-variant)', marginBottom: '4px' }}>Total Outstanding</div>
              <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: currentPartyBalance > 0 ? 'var(--error)' : '#065f46' }}>
                Rs. {currentPartyBalance.toLocaleString()}
              </div>
              {hasReconciliationVariance && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600, marginTop: '6px' }} title={`Calculated statement balance: Rs. ${calculatedStatementNet.toLocaleString()}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                  Statement balance: Rs. {calculatedStatementNet.toLocaleString()}
                </div>
              )}
              {exceedsThreshold && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--error)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                  Exceeds credit threshold (80%)
                </div>
              )}
            </div>

            {/* Credit Utilization (Clients Only) */}
            {activeTab === 'clients' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--on-surface-variant)', marginBottom: '6px' }}>
                  <span>CREDIT UTILIZATION</span>
                  <strong className="font-mono">{hasCreditLimit ? `${utilizationPct}%` : '—'}</strong>
                </div>
                {hasCreditLimit ? (
                  <div style={{ height: '8px', background: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${utilizationPct}%`,
                        background: utilizationPct > 80 ? 'var(--error)' : 'var(--secondary)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
                    No credit limit set
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '6px' }}>
                  {isEditingLimit ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: '26px', fontSize: '11px', padding: '2px 6px', flex: 1 }}
                        value={editLimitValue}
                        onChange={(e) => setEditLimitValue(e.target.value)}
                        placeholder="Enter limit"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleUpdateCreditLimit}
                        disabled={savingLimit}
                        className="btn btn-primary"
                        style={{ padding: '2px 6px', fontSize: '11px', height: '26px' }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingLimit(false)}
                        className="btn btn-secondary-outline"
                        style={{ padding: '2px 6px', fontSize: '11px', height: '26px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>Limit: Rs. {hasCreditLimit ? creditLimit.toLocaleString() : '0'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditLimitValue(String(creditLimit || ''));
                          setIsEditingLimit(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                        title="Edit Credit Limit"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                        Edit Limit
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Contact Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--outline-variant)', paddingTop: '1rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Account Code:</span>
                <strong className="font-mono">{selectedParty.code || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Phone Contact:</span>
                <strong className="font-mono">{selectedParty.phone || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">City / Location:</span>
                <strong>{selectedParty.city || selectedParty.address || '—'}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Record Receipt Modal ── */}
      {showReceiptModal && selectedParty && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="headline-sm">
                {activeTab === 'clients' ? 'Record Payment Receipt' : activeTab === 'suppliers' ? 'Record Supplier Payment' : 'Record Inter-Branch Settlement'}
              </h3>
              <button onClick={() => setShowReceiptModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px' }}>
              <div>Party: <strong>{selectedParty.name}</strong></div>
              <div style={{ color: 'var(--error)', fontWeight: 600, marginTop: '2px' }}>
                Current Balance: Rs. {currentPartyBalance.toLocaleString()}
              </div>
            </div>

            {receiptError && (
              <div style={{ background: 'var(--error-container)', border: '1px solid rgba(186,26,26,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '13px', color: 'var(--on-error-container)', marginBottom: '1rem' }}>
                {receiptError}
              </div>
            )}

            <form onSubmit={handleRecordReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">{activeTab === 'branches' ? 'Settlement Amount (Rs.) *' : 'Payment Amount (Rs.) *'}</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  placeholder="0"
                  value={receiptAmount}
                  onChange={e => setReceiptAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label">Payment Mode</label>
                <select
                  className="form-select"
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Online Bank Transfer">Online Bank Transfer (Meezan / HBL)</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                </select>
              </div>

              {paymentMode !== 'Cash' && (
                <div>
                  <label className="form-label">
                    {paymentMode === 'Cheque' ? 'Cheque Number / Bank Details *' : 'Reference No / Transaction ID *'}
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder={paymentMode === 'Cheque' ? 'e.g. Cheque #881920 (Meezan Bank)' : 'e.g. HBL-992810 / TRX-8921'}
                    value={refNotes}
                    onChange={e => setRefNotes(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="btn btn-secondary-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReceipt}
                  className="btn btn-primary"
                >
                  {submittingReceipt ? 'Posting to Ledger...' : activeTab === 'branches' ? 'Post Settlement' : 'Post Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Add Client / Supplier Modal ── */}
      {showAddPartyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="headline-sm">
                Add New {activeTab === 'clients' ? 'Client / Contractor' : 'Supplier'}
              </h3>
              <button onClick={() => setShowAddPartyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateParty} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Full Name / Business Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. BuildWell Builders / Master Paints"
                  value={newPartyName}
                  onChange={e => setNewPartyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0300-1234567"
                  value={newPartyPhone}
                  onChange={e => setNewPartyPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Address / Location</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DHA Phase 5, Lahore"
                  value={newPartyAddress}
                  onChange={e => setNewPartyAddress(e.target.value)}
                />
              </div>

              {activeTab === 'clients' && (
                <div>
                  <label className="form-label">Credit Limit (PKR)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPartyLimit}
                    onChange={e => setNewPartyLimit(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(false)}
                  className="btn btn-secondary-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingParty}
                  className="btn btn-primary"
                >
                  {submittingParty ? 'Saving...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
