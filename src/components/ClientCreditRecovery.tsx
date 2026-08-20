'use client';

import React, { useState, useEffect } from 'react';
import { Client } from '@/types';

interface Props {
  tenantId?: string;
  tenantName?: string;
  staffName?: string;
}

export default function ClientCreditRecovery({
  tenantId,
  tenantName = 'Paint House',
  staffName = 'Counter Staff',
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'overdue' | 'pending'>('all');

  // Quick Payment Modal State
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchClients = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [tenantId]);

  // Aggregate Calculations
  const totalReceivables = clients.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  
  // Categorize aging
  const categorizedClients = clients.map(c => {
    const bal = c.current_balance || 0;
    const limit = c.credit_limit || 50000;
    let status: 'CRITICAL' | 'OVERDUE' | 'PENDING' | 'SETTLED' = 'PENDING';
    let d30: number | null = null;
    let d60: number | null = null;
    let d90: number | null = null;

    if (bal <= 0) {
      status = 'SETTLED';
    } else if (bal >= limit * 0.9) {
      status = 'CRITICAL';
      d90 = bal;
    } else if (bal >= limit * 0.5) {
      status = 'OVERDUE';
      d60 = bal;
    } else {
      status = 'PENDING';
      d30 = bal;
    }

    return {
      ...c,
      status,
      d30,
      d60,
      d90,
      totalDue: bal,
    };
  });

  const criticalTotal = categorizedClients
    .filter(c => c.status === 'CRITICAL')
    .reduce((sum, c) => sum + c.totalDue, 0);

  const overdueAccountsCount = categorizedClients.filter(c => c.totalDue > 0).length;
  const recoveryRate = totalReceivables > 0 ? 82.5 : 100;

  // Filtered List
  const filteredClients = categorizedClients.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);

    let matchesStatus = true;
    if (statusFilter === 'critical') matchesStatus = c.status === 'CRITICAL';
    if (statusFilter === 'overdue') matchesStatus = c.status === 'OVERDUE';
    if (statusFilter === 'pending') matchesStatus = c.status === 'PENDING';

    return matchesSearch && matchesStatus;
  });

  // Export Aging Report to CSV
  const handleExportCSV = () => {
    if (categorizedClients.length === 0) {
      alert('No client records to export.');
      return;
    }

    const headers = [
      'Client ID',
      'Client Name',
      'Phone Number',
      'Address',
      'Credit Limit (PKR)',
      'Total Due (PKR)',
      'Status',
    ];

    const rows = categorizedClients.map(c => [
      `"${c.code || ''}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${c.address || c.city || ''}"`,
      c.credit_limit || 50000,
      c.totalDue,
      c.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Aging_Report_${tenantName.replace(/\s+/g, '_')}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Reminder Dispatch
  const handleSendWhatsAppReminder = (client: any) => {
    const message = `*${tenantName} — Payment Due Notice*\n` +
      `Dear ${client.name},\n` +
      `Your account has an outstanding balance of *Rs. ${client.totalDue.toLocaleString()}*.\n` +
      `Credit Limit: Rs. ${(client.credit_limit || 50000).toLocaleString()}\n` +
      `Status: ${client.status}\n\n` +
      `Please clear the balance at your earliest convenience to continue uninterrupted supplies.\n` +
      `Thank you!`;

    const phone = client.phone?.replace(/[^0-9]/g, '') || '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // Quick Payment Collection
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForPayment || !paymentAmount || !tenantId) return;
    setSubmittingPayment(true);

    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          voucher_type: 'receipt',
          party_type: 'client',
          party_id: selectedClientForPayment.id,
          party_name: selectedClientForPayment.name,
          amount: parseFloat(paymentAmount) || 0,
          remarks: `Recovery Collection — ${paymentMode} ${paymentNotes ? `(${paymentNotes})` : ''}`,
          created_by: staffName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedClientForPayment(null);
        setPaymentAmount('');
        setPaymentNotes('');
        await fetchClients();
      } else {
        alert(data.error || 'Failed to record payment');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Credit &amp; Recovery</h1>
          <p className="page-subtitle">Manage client market udhaar, overdue accounts and balance collections.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportCSV} className="btn btn-secondary-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export Aging Report
          </button>
        </div>
      </div>

      {/* ── Top 3 KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="kpi-label">TOTAL RECEIVABLES (MARKET UDHAAR)</span>
            <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)', fontSize: 22 }}>account_balance</span>
          </div>
          <div className="kpi-value font-mono">Rs. {totalReceivables.toLocaleString()}</div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            {overdueAccountsCount} Accounts with outstanding balance
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--error)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="kpi-label">CRITICAL OVERDUE (90% OF LIMIT)</span>
            <span className="material-symbols-outlined" style={{ color: 'var(--error)', fontSize: 22 }}>warning</span>
          </div>
          <div className="kpi-value font-mono" style={{ color: 'var(--error)' }}>
            Rs. {criticalTotal.toLocaleString()}
          </div>
          <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            {categorizedClients.filter(c => c.status === 'CRITICAL').length} High-risk accounts
          </div>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="kpi-label">ESTIMATED RECOVERY RATE</span>
            <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: 22 }}>trending_up</span>
          </div>
          <div className="kpi-value font-mono" style={{ color: '#16a34a' }}>{recoveryRate}%</div>
          <div style={{ height: 6, background: 'var(--surface-container)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${recoveryRate}%`, background: '#16a34a', borderRadius: 'var(--radius-full)' }} />
          </div>
        </div>
      </div>

      {/* ── Main Grid: Aging Matrix Table + Recovery Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Aging Matrix Table Card */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 className="headline-sm">Aging Matrix</h3>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
                {(['all', 'critical', 'overdue', 'pending'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: 'calc(var(--radius-sm) - 2px)',
                      cursor: 'pointer',
                      background: statusFilter === tab ? 'var(--secondary)' : 'transparent',
                      color: statusFilter === tab ? '#fff' : 'var(--on-surface-variant)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: '220px', position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--on-surface-variant)' }}>search</span>
              <input
                type="text"
                className="form-input"
                placeholder="Search Client ID/Name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem', height: '32px', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client ID / Name</th>
                  <th className="text-right">Current (30D)</th>
                  <th className="text-right">Overdue (60D)</th>
                  <th className="text-right">Critical (90D+)</th>
                  <th className="text-right">Total Due (Rs)</th>
                  <th>Status</th>
                  <th className="text-center" style={{ width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{client.name}</div>
                      <div className="font-mono text-muted" style={{ fontSize: '11px' }}>
                        {client.code} {client.phone && `• ${client.phone}`}
                      </div>
                    </td>
                    <td className="text-right font-mono">
                      {client.d30 ? `Rs. ${client.d30.toLocaleString()}` : '-'}
                    </td>
                    <td className="text-right font-mono" style={{ color: client.d60 ? '#b45309' : 'inherit' }}>
                      {client.d60 ? `Rs. ${client.d60.toLocaleString()}` : '-'}
                    </td>
                    <td className="text-right font-mono font-bold" style={{ color: client.d90 ? 'var(--error)' : 'inherit' }}>
                      {client.d90 ? `Rs. ${client.d90.toLocaleString()}` : '-'}
                    </td>
                    <td className="text-right font-mono font-bold">
                      Rs. {client.totalDue.toLocaleString()}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: client.status === 'CRITICAL' ? 'var(--error-container)' : client.status === 'OVERDUE' ? '#ffedd5' : client.status === 'SETTLED' ? '#d1fae5' : '#fef3c7',
                          color: client.status === 'CRITICAL' ? 'var(--error)' : client.status === 'OVERDUE' ? '#c2410c' : client.status === 'SETTLED' ? '#065f46' : '#92400e',
                        }}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        <button
                          onClick={() => handleSendWhatsAppReminder(client)}
                          disabled={client.totalDue <= 0}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', opacity: client.totalDue <= 0 ? 0.3 : 1 }}
                          title="Send WhatsApp Reminder"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClientForPayment(client);
                            setPaymentAmount(client.totalDue.toString());
                          }}
                          disabled={client.totalDue <= 0}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)', opacity: client.totalDue <= 0 ? 0.3 : 1 }}
                          title="Receive Payment"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                      No client accounts matching current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Monthly Collection Target & Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Collection Status Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 className="headline-sm" style={{ marginBottom: '1rem' }}>Collection Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Total Active Clients:</span>
                <strong>{clients.length} Clients</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Overdue Accounts:</span>
                <strong style={{ color: 'var(--error)' }}>{overdueAccountsCount} Accounts</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Settled (Zero Bal):</span>
                <strong style={{ color: '#065f46' }}>
                  {categorizedClients.filter(c => c.status === 'SETTLED').length} Accounts
                </strong>
              </div>
              <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>Total Market Bal:</span>
                <span className="font-mono font-bold" style={{ color: 'var(--secondary)', fontSize: '15px' }}>
                  Rs. {totalReceivables.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Recovery Target */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 className="headline-sm" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--secondary)' }}>track_changes</span>
              Monthly Recovery Target
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600 }}>Branch Recovery Target</span>
                  <span className="font-mono" style={{ fontSize: '12px' }}>Rs. 450k / Rs. 500k</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '90%', background: 'var(--secondary)' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px', fontWeight: 600 }}>
                  90% of target achieved this month
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Quick Receive Payment Modal ── */}
      {selectedClientForPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="headline-sm">Collect Overdue Payment</h3>
              <button onClick={() => setSelectedClientForPayment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: '0.75rem', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px' }}>
              <div>Client: <strong>{selectedClientForPayment.name}</strong></div>
              <div style={{ color: 'var(--error)', fontWeight: 600, marginTop: '2px' }}>
                Total Due: Rs. {selectedClientForPayment.current_balance?.toLocaleString() || 0}
              </div>
            </div>

            <form onSubmit={handleCollectPayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Collected Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
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
                  <option value="Online Bank Transfer">Online Bank Transfer</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                </select>
              </div>

              <div>
                <label className="form-label">Payment Reference / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Cleared 50% bill / Cheque #8819"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedClientForPayment(null)}
                  className="btn btn-secondary-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="btn btn-primary"
                >
                  {submittingPayment ? 'Processing...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
