'use client';

import React, { useState, useEffect } from 'react';
import { Client, Supplier } from '@/types';

interface Props {
  tenantId?: string;
  tenantName?: string;
  staffName?: string;
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
  tenantName = 'Paint House',
  staffName = 'Counter Staff',
}: Props) {
  const [activeTab, setActiveTab] = useState<'clients' | 'suppliers'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [statement, setStatement] = useState<LedgerTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('All Transactions');

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
          if (data.clients?.length > 0 && !selectedParty) {
            setSelectedParty(data.clients[0]);
          }
        }
      } else {
        const res = await fetch(`/api/suppliers?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setSuppliers(data.suppliers || []);
          if (data.suppliers?.length > 0) {
            setSelectedParty(data.suppliers[0]);
          }
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
      const res = await fetch(
        `/api/ledgers?tenant_id=${tenantId}&party_id=${partyId}&party_type=${activeTab === 'clients' ? 'client' : 'supplier'}`
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
    }
  }, [selectedParty, activeTab]);

  // Record Payment Receipt
  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptAmount || !selectedParty || !tenantId) return;
    setSubmittingReceipt(true);
    setReceiptError('');

    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          voucher_type: activeTab === 'clients' ? 'receipt' : 'payment',
          party_type: activeTab === 'clients' ? 'client' : 'supplier',
          party_id: selectedParty.id,
          party_name: selectedParty.name,
          amount: parseFloat(receiptAmount) || 0,
          remarks: `${paymentMode} ${refNotes ? `— ${refNotes}` : ''}`,
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
            credit_limit: parseFloat(newPartyLimit) || 50000,
          }
        : {
            tenant_id: tenantId,
            name: newPartyName,
            phone: newPartyPhone,
            address: newPartyAddress,
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

  // WhatsApp Statement Reminder
  const handleSendWhatsAppLedger = () => {
    if (!selectedParty) return;
    const balance = selectedParty.current_balance || 0;
    const message = `*${tenantName} — Account Statement Summary*\n` +
      `Party: ${selectedParty.name} (${selectedParty.code || ''})\n` +
      `Date: ${new Date().toLocaleDateString()}\n` +
      `--------------------------------\n` +
      `*Total Outstanding Balance:* Rs. ${balance.toLocaleString()}\n` +
      (activeTab === 'clients' ? `Credit Limit: Rs. ${(selectedParty.credit_limit || 50000).toLocaleString()}\n` : '') +
      `--------------------------------\n` +
      `Please clear the outstanding balance at your earliest convenience.\n` +
      `Thank you!`;

    const phone = selectedParty.phone?.replace(/[^0-9]/g, '') || '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const partiesList = activeTab === 'clients' ? clients : suppliers;
  const filteredParties = partiesList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  const totalDebit = statement.reduce((s, t) => s + t.debit, 0);
  const totalCredit = statement.reduce((s, t) => s + t.credit, 0);
  const currentPartyBalance = selectedParty?.current_balance || 0;
  const creditLimit = selectedParty?.credit_limit || 50000;
  const utilizationPct = Math.min(100, Math.round((currentPartyBalance / creditLimit) * 100));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: '1.25rem', height: 'calc(100vh - var(--topbar-height) - 2 * var(--gutter))', overflow: 'hidden' }}>
      
      {/* ── Left Col: Directory Panel ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="headline-sm">Directory</h3>
            <button
              onClick={() => setShowAddPartyModal(true)}
              style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'var(--secondary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title={`Add New ${activeTab === 'clients' ? 'Client' : 'Supplier'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            </button>
          </div>

          <div style={{ display: 'flex', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '0.75rem' }}>
            <button
              onClick={() => { setActiveTab('clients'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'clients' ? 'active' : ''}`}
            >
              Clients ({clients.length})
            </button>
            <button
              onClick={() => { setActiveTab('suppliers'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
            >
              Suppliers ({suppliers.length})
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
            const partyLimit = 'credit_limit' in party ? ((party as any).credit_limit || 50000) : 50000;
            const isOverdue = activeTab === 'clients' && bal > partyLimit * 0.8;
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
                    {isOverdue ? 'OVERDUE' : bal === 0 ? 'SETTLED' : 'ACTIVE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  <span>ID: {party.code || 'ID-001'}</span>
                  <span className="font-mono font-bold" style={{ color: isOverdue ? 'var(--error)' : 'inherit', fontSize: '12px' }}>
                    Rs. {bal.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
          {filteredParties.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
              No {activeTab} found. Click + to add.
            </div>
          )}
        </div>
      </div>

      {/* ── Middle Col: Statement of Account Table ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedParty ? (
          <>
            {/* Party Details Header */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h2 className="headline-md" style={{ marginBottom: '4px' }}>{selectedParty.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--on-surface-variant)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
                      {selectedParty.address || selectedParty.city || 'Commercial Market'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span>
                      {selectedParty.phone || '0300-1234567'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fingerprint</span>
                      Code: {selectedParty.code}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-premium">{activeTab === 'clients' ? 'CLIENT ACCOUNT' : 'SUPPLIER'}</span>
                  <button onClick={() => window.print()} className="btn btn-secondary-outline btn-icon" title="Print Ledger Statement">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>picture_as_pdf</span>
                  </button>
                  <button onClick={handleSendWhatsAppLedger} className="btn btn-secondary-outline btn-icon" title="Send WhatsApp Payment Reminder">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>chat</span>
                  </button>
                </div>
              </div>

              {/* Statement Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--outline-variant)' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Statement of Account</span>
                <select
                  className="form-select"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  style={{ height: '32px', fontSize: '12px', width: '150px' }}
                >
                  <option value="All Transactions">All Transactions</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="This Quarter">This Quarter</option>
                </select>
              </div>
            </div>

            {/* Statement Rows */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingLedger ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                  Loading transactions...
                </div>
              ) : statement.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, marginBottom: '0.5rem', display: 'block', color: 'var(--outline-variant)' }}>receipt_long</span>
                  No transaction history recorded yet for this account.
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
                    {statement.map((t, idx) => (
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
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>
            Select a client or supplier from the directory.
          </div>
        )}
      </div>

      {/* ── Right Col: Financial Summary & Actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Record Receipt Action Button */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--secondary-fixed)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: 24 }}>payments</span>
          </div>
          <h4 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
            {activeTab === 'clients' ? 'Receive Payment' : 'Pay Supplier'}
          </h4>
          <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            {activeTab === 'clients' ? 'Post cash, online or cheque payment to client ledger' : 'Record payment disbursed to vendor'}
          </p>
          <button
            onClick={() => setShowReceiptModal(true)}
            disabled={!selectedParty}
            className="btn btn-primary btn-full"
            style={{ opacity: !selectedParty ? 0.5 : 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_circle</span>
            {activeTab === 'clients' ? 'Record Receipt' : 'Record Payment'}
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
              {activeTab === 'clients' && currentPartyBalance >= creditLimit * 0.9 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--error)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                  Exceeds credit threshold
                </div>
              )}
            </div>

            {/* Credit Utilization (Clients Only) */}
            {activeTab === 'clients' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--on-surface-variant)', marginBottom: '6px' }}>
                  <span>CREDIT UTILIZATION</span>
                  <strong className="font-mono">{utilizationPct}%</strong>
                </div>
                <div style={{ height: '8px', background: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${utilizationPct}%`,
                      background: utilizationPct > 85 ? 'var(--error)' : 'var(--secondary)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '4px', textAlign: 'right' }}>
                  Limit: Rs. {creditLimit.toLocaleString()}
                </div>
              </div>
            )}

            {/* Contact Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--outline-variant)', paddingTop: '1rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Account Code:</span>
                <strong className="font-mono">{selectedParty.code || 'CL-001'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Phone Contact:</span>
                <strong className="font-mono">{selectedParty.phone || '0300-1234567'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">City / Location:</span>
                <strong>{selectedParty.city || 'Lahore'}</strong>
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
                {activeTab === 'clients' ? 'Record Payment Receipt' : 'Record Supplier Payment'}
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
                <label className="form-label">Payment Amount (Rs.) *</label>
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

              <div>
                <label className="form-label">Reference No / Cheque Details</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HBL-992810 / TRX-8921"
                  value={refNotes}
                  onChange={e => setRefNotes(e.target.value)}
                />
              </div>

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
                  {submittingReceipt ? 'Posting to Ledger...' : 'Post Payment'}
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
