'use client';

import React, { useState, useEffect } from 'react';
import { Item, Tenant } from '@/types';

interface Props {
  items: Item[];
  tenantId?: string;
  staffName?: string;
  onStockDispatched?: () => void;
}

export default function GodownTransfers({
  items,
  tenantId,
  staffName = 'Warehouse Lead',
  onStockDispatched,
}: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [customGodownName, setCustomGodownName] = useState('');
  const [biltyNo, setBiltyNo] = useState('');
  const [transporter, setTransporter] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [qty, setQty] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [history, setHistory] = useState<any[]>([]);

  // Fetch branches/tenants for destination selector
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await fetch('/api/tenants');
        const data = await res.json();
        if (data.success) {
          const branches = (data.tenants || []).filter((t: Tenant) => t.id !== tenantId);
          setTenants(branches);
          if (branches.length > 0) {
            setTargetTenantId(branches[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTenants();
  }, [tenantId]);

  // Fetch Transfer History from Supabase
  const fetchTransfers = async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/transfers?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.transfers || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [tenantId]);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedItemId || !tenantId) return;

    const itemObj = items.find(i => i.id === selectedItemId);
    if (!itemObj) {
      setFormError('Please select a valid item');
      return;
    }

    const selectedDestTenant = tenants.find(t => t.id === targetTenantId);
    const destName = selectedDestTenant ? selectedDestTenant.name : customGodownName || 'External Godown';

    setSubmitting(true);

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_tenant_id: tenantId,
          to_tenant_id: targetTenantId || tenantId,
          bilty_no: biltyNo,
          transporter_name: transporter,
          driver_name: driverName,
          driver_phone: driverContact,
          item_id: itemObj.id,
          item_code: itemObj.code,
          item_name: itemObj.name,
          unit: itemObj.unit,
          qty: parseFloat(qty) || 1,
          notes: `Dispatched to ${destName}`,
          created_by: staffName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBiltyNo('');
        setTransporter('');
        setDriverName('');
        setDriverContact('');
        setQty('10');
        await fetchTransfers();
        if (onStockDispatched) onStockDispatched();
      } else {
        setFormError(data.error || 'Failed to dispatch stock transfer');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error connecting to database');
    } finally {
      setSubmitting(false);
    }
  };

  // Receive Transfer Acknowledgment
  const handleReceiveTransfer = async (transferId: string) => {
    try {
      const res = await fetch('/api/transfers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transferId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTransfers();
        if (onStockDispatched) onStockDispatched();
      } else {
        alert(data.error || 'Failed to receive transfer');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Inter-Godown Transfers &amp; Bilty</h1>
          <p className="page-subtitle">Track stock dispatches, freight carriers and branch transfers</p>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Dispatch Form Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <span className="material-symbols-outlined filled" style={{ color: 'var(--secondary)', fontSize: 22 }}>local_shipping</span>
            <h3 className="headline-sm">Create Stock Dispatch</h3>
          </div>

          {formError && (
            <div style={{ background: 'var(--error-container)', border: '1px solid rgba(186,26,26,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '13px', color: 'var(--on-error-container)', marginBottom: '1rem' }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Destination Branch / Godown *</label>
              {tenants.length > 0 ? (
                <select
                  className="form-select"
                  value={targetTenantId}
                  onChange={e => setTargetTenantId(e.target.value)}
                  required
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type?.toUpperCase()} • {t.city || 'Lahore'})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  className="form-input"
                  value={customGodownName}
                  onChange={e => setCustomGodownName(e.target.value)}
                  placeholder="e.g. Central Warehouse Lahore / Gujranwala Depot"
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Bilty No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={biltyNo}
                  onChange={e => setBiltyNo(e.target.value)}
                  placeholder="BL-9482"
                />
              </div>
              <div>
                <label className="form-label">Goods Carrier / Transporter</label>
                <input
                  type="text"
                  className="form-input"
                  value={transporter}
                  onChange={e => setTransporter(e.target.value)}
                  placeholder="e.g. Faisal Movers"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Driver Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder="Driver Name"
                />
              </div>
              <div>
                <label className="form-label">Driver Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={driverContact}
                  onChange={e => setDriverContact(e.target.value)}
                  placeholder="0300-1234567"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Select Paint Item *</label>
                <select
                  className="form-select"
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  required
                >
                  {items.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.code} — {it.name} ({it.stock_qty} in stock)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg"
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              {submitting ? 'Dispatching Stock...' : 'Dispatch Goods Transfer'}
            </button>
          </form>
        </div>

        {/* Transfer History Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <h3 className="headline-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>history</span>
              Recent Dispatches &amp; Transfers
            </h3>
            <span className="badge badge-active">{history.length} movements</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer No</th>
                  <th>Destination / Carrier</th>
                  <th>Item / Qty</th>
                  <th>Bilty No</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(tr => {
                  const itemsList = tr.stock_transfer_items || [];
                  const itemSummary = itemsList.length > 0
                    ? `${itemsList[0].item_name} (x${itemsList[0].qty} ${itemsList[0].unit})`
                    : 'Paint Stock';

                  const isIncoming = tr.to_tenant_id === tenantId && tr.from_tenant_id !== tenantId;

                  return (
                    <tr key={tr.id}>
                      <td>
                        <div className="font-mono text-blue font-bold" style={{ fontSize: '12px' }}>
                          {tr.transfer_no || 'TR-001'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                          {tr.date || 'Today'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>
                          {tr.notes?.replace('Dispatched to ', '') || 'Central Godown'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                          {tr.transporter_name} {tr.driver_name && `• ${tr.driver_name}`}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>{itemSummary}</div>
                      </td>
                      <td className="font-mono text-muted">{tr.bilty_no || 'N/A'}</td>
                      <td>
                        {tr.status === 'received' ? (
                          <span className="badge badge-paid">Received</span>
                        ) : isIncoming ? (
                          <button
                            onClick={() => handleReceiveTransfer(tr.id)}
                            className="btn btn-primary btn-sm"
                            style={{ height: '24px', fontSize: '10px' }}
                          >
                            Receive
                          </button>
                        ) : (
                          <span className="badge badge-track">In Transit</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--on-surface-variant)' }}>
                      No stock transfers recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}