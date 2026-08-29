'use client';

import React, { useState, useEffect } from 'react';
import { Item, Tenant, BranchOrder } from '@/types';

interface OrderDestination {
  id: string;
  tenantId: string;
  counterUsername?: string;
  name: string;
  type: 'branch' | 'counter';
  subtitle?: string;
}

interface Props {
  items: Item[];
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  staffName?: string;
  staffUsername?: string;
  onOrderPlaced?: () => void;
}

export default function BranchOrders({
  items,
  tenantId,
  tenantSlug,
  tenantName = 'Branch',
  staffName = 'Staff',
  staffUsername,
  onOrderPlaced,
}: Props) {
  // State: destinations, orders, form
  const [destinations, setDestinations] = useState<OrderDestination[]>([]);
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'place' | 'my_requests' | 'incoming'>('place');
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form state
  const [selectedDestId, setSelectedDestId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Fetch all potential order destinations (other branches + other counters)
  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const destList: OrderDestination[] = [];

        // Fetch other branches & godowns
        const tenantsRes = await fetch('/api/tenants');
        const tenantsData = await tenantsRes.json();
        if (tenantsData.success) {
          (tenantsData.tenants || []).forEach((t: Tenant) => {
            if (t.id !== tenantId) {
              destList.push({
                id: `tenant_${t.id}`,
                tenantId: t.id,
                name: t.name,
                type: 'branch',
                subtitle: `${t.type?.toUpperCase() || 'BRANCH'} • ${t.city || 'Pakistan'}`,
              });
            }
          });
        }

        setDestinations(destList);
        if (destList.length > 0) {
          setSelectedDestId(destList[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch destinations:', err);
      }
    };

    fetchDestinations();
  }, [tenantId]);

  // Set initial selected item
  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  // Fetch orders
  const fetchOrders = async () => {
    if (!tenantId) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/branch-orders?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [tenantId]);

  // Place an order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!tenantId) {
      setFormError('Current branch ID missing');
      return;
    }

    const selectedDest = destinations.find(d => d.id === selectedDestId);
    if (!selectedDest) {
      setFormError('Please select a source branch or counter');
      return;
    }

    const itemObj = items.find(i => i.id === selectedItemId);
    if (!itemObj) {
      setFormError('Please select a valid product');
      return;
    }

    const parsedQty = parseInt(qty) || 1;
    if (parsedQty < 1) {
      setFormError('Quantity must be at least 1');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/branch-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_tenant_id: tenantId,
          to_tenant_id: selectedDest.tenantId,
          from_counter: staffUsername || null,
          target_counter: selectedDest.counterUsername || null,
          items: [
            {
              item_code: itemObj.code,
              item_name: itemObj.name,
              unit: itemObj.unit || 'Can',
              qty: parsedQty,
            },
          ],
          notes: notes || null,
          created_by: staffName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFormSuccess(`Order ${data.order.order_no} placed successfully to ${selectedDest.name}!`);
        setQty('1');
        setNotes('');
        await fetchOrders();
        if (onOrderPlaced) onOrderPlaced();
        setTimeout(() => setFormSuccess(''), 5000);
      } else {
        setFormError(data.error || 'Failed to place order');
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // Update order status (accept / reject / dispatch / receive)
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/branch-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrders();
      } else {
        alert(data.error || 'Failed to update order status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter orders into my requests vs incoming
  const myRequests = orders.filter(o => {
    if (o.from_tenant_id !== tenantId) return false;
    // If internal order within same tenant, check if created by my counter
    if (o.to_tenant_id === tenantId) {
      return !staffUsername || o.from_counter === staffUsername;
    }
    return true;
  });

  const incomingOrders = orders.filter(o => {
    if (o.to_tenant_id !== tenantId) return false;
    // If internal order within same tenant, check if targeted to my counter
    if (o.from_tenant_id === tenantId) {
      return !staffUsername || o.target_counter === staffUsername || !o.target_counter;
    }
    return true;
  });

  const pendingIncomingCount = incomingOrders.filter(o => o.status === 'pending').length;

  // Status badge styling
  const getStatusStyle = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string }> = {
      pending:    { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
      accepted:   { bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' },
      dispatched: { bg: '#E0E7FF', color: '#3730A3', border: '#C7D2FE' },
      received:   { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
      rejected:   { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
    };
    return map[status] || map.pending;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Branch Orders</h1>
          <p className="page-subtitle">
            Order products from other branches or counters when out of stock
          </p>
        </div>
        {pendingIncomingCount > 0 && (
          <div
            style={{
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#92400E',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', animation: 'pulse 2s infinite' }} />
            {pendingIncomingCount} pending incoming order{pendingIncomingCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {([
          { id: 'place' as const, label: '+ Place Order' },
          { id: 'my_requests' as const, label: `My Requests (${myRequests.length})` },
          { id: 'incoming' as const, label: `Incoming Orders (${incomingOrders.length})`, badge: pendingIncomingCount },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
              color: activeTab === tab.id ? '#0F172A' : '#64748B',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
          >
            {tab.label}
            {Boolean(tab.badge && tab.badge > 0) && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Place Order ═══ */}
      {activeTab === 'place' && (
        <div className="card" style={{ padding: '1.5rem', maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '20px' }}>📦</span>
            <h3 className="headline-sm">Place New Branch Order</h3>
          </div>

          {formError && (
            <div style={{ background: '#FEE2E2', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#991B1B', marginBottom: '1rem' }}>
              {formError}
            </div>
          )}

          {formSuccess && (
            <div style={{ background: '#D1FAE5', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#065F46', marginBottom: '1rem' }}>
              ✅ {formSuccess}
            </div>
          )}

          <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Source Branch / Counter */}
            <div>
              <label className="form-label">Order From (Source Branch / Counter) *</label>
              {destinations.length > 0 ? (
                <select
                  className="form-select"
                  value={selectedDestId}
                  onChange={e => setSelectedDestId(e.target.value)}
                  required
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.type === 'counter' ? '🏪 ' : '🏢 '}
                      {d.name} — {d.subtitle}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                    🏢 Koi doosri branch ya counter register nahi hai
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
                    Dusri branch (e.g. Branch 2, Branch 3 ya Central Godown) se samaan mangwane ke liye, Developer Panel me <strong>+ Create Branch</strong> ya <strong>+ Add Counter</strong> karein.
                  </div>
                  <a
                    href="/dev"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#F97316',
                      textDecoration: 'none',
                      marginTop: '4px',
                    }}
                  >
                    + Open Developer Panel to Add Branch / Counter →
                  </a>
                </div>
              )}
            </div>

            {/* Item Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Select Product *</label>
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
                  placeholder="1"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Urgently needed for customer order, please send ASAP"
                rows={2}
                style={{ resize: 'vertical', minHeight: '48px' }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || destinations.length === 0}
              className="btn btn-primary btn-lg"
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              {submitting ? 'Placing Order...' : '📤 Place Order'}
            </button>
          </form>
        </div>
      )}

      {/* ═══ TAB: My Requests ═══ */}
      {activeTab === 'my_requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {myRequests.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#94A3B8' }}>No orders placed yet from this branch/counter.</p>
            </div>
          ) : (
            myRequests.map(order => {
              const statusStyle = getStatusStyle(order.status);
              const targetTitle = order.target_counter
                ? `${order.to_tenant?.name || 'Branch'} — ${order.target_counter.toUpperCase()}`
                : (order.to_tenant?.name || 'Unknown Branch');
              return (
                <div key={order.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    {/* Left: Order details */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {order.order_no}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                          }}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                        Ordered from: <strong style={{ color: '#0F172A' }}>{targetTitle}</strong>
                      </div>
                      {/* Items list with prominent visual badges */}
                      <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {((order.items && order.items.length > 0 ? order.items : (order as any).branch_order_items) || []).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              padding: '8px 12px',
                              background: '#F8FAFC',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              maxWidth: '480px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span style={{ fontSize: '14px' }}>🎨</span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                  {item.item_name}
                                </div>
                                {item.item_code && (
                                  <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                    Code: {item.item_code}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span
                              style={{
                                background: '#FFF7ED',
                                color: '#EA580C',
                                border: '1px solid #FFEDD5',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 800,
                                fontFamily: 'JetBrains Mono, monospace',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Qty: {item.qty} {item.unit || 'Can'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', background: '#F1F5F9', padding: '6px 10px', borderRadius: '6px', display: 'inline-block' }}>
                          📝 <strong>Notes:</strong> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Right: Date + Action */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#CBD5E1' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                      {order.status === 'dispatched' && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, 'received')}
                          className="btn btn-primary"
                          style={{ marginTop: '8px', fontSize: '11px', padding: '5px 12px' }}
                        >
                          ✅ Mark Received
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TAB: Incoming Orders ═══ */}
      {activeTab === 'incoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {incomingOrders.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#94A3B8' }}>No incoming orders from other branches/counters.</p>
            </div>
          ) : (
            incomingOrders.map(order => {
              const statusStyle = getStatusStyle(order.status);
              const isPending = order.status === 'pending';
              const isAccepted = order.status === 'accepted';
              const requesterTitle = order.from_counter
                ? `${order.from_tenant?.name || 'Branch'} — ${order.from_counter.toUpperCase()} (${order.created_by || 'Staff'})`
                : (order.from_tenant?.name || 'Unknown Branch');
              return (
                <div
                  key={order.id}
                  className="card"
                  style={{
                    padding: '1rem 1.25rem',
                    borderLeft: isPending ? '3px solid #F59E0B' : isAccepted ? '3px solid #3B82F6' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    {/* Left: Order details */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {order.order_no}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                          }}
                        >
                          {order.status}
                        </span>
                        {isPending && (
                          <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 600 }}>⚡ Action Required</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                        Requested by: <strong style={{ color: '#0F172A' }}>{requesterTitle}</strong>
                      </div>
                      {/* Items list with prominent visual badges */}
                      <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {((order.items && order.items.length > 0 ? order.items : (order as any).branch_order_items) || []).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              padding: '8px 12px',
                              background: '#F8FAFC',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              maxWidth: '480px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <span style={{ fontSize: '14px' }}>🎨</span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                  {item.item_name}
                                </div>
                                {item.item_code && (
                                  <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                    Code: {item.item_code}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span
                              style={{
                                background: '#FFF7ED',
                                color: '#EA580C',
                                border: '1px solid #FFEDD5',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 800,
                                fontFamily: 'JetBrains Mono, monospace',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Qty: {item.qty} {item.unit || 'Can'}
                            </span>
                          </div>
                        ))}
                      </div>
                      {order.notes && (
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', background: '#F1F5F9', padding: '6px 10px', borderRadius: '6px', display: 'inline-block' }}>
                          📝 <strong>Notes:</strong> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Right: Date + Actions */}
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#CBD5E1' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>

                      {/* Action Buttons */}
                      {isPending && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'accepted')}
                            style={{
                              fontSize: '11px', fontWeight: 700, padding: '5px 12px',
                              borderRadius: '6px', border: '1px solid #BBF7D0',
                              background: '#D1FAE5', color: '#065F46', cursor: 'pointer',
                            }}
                          >
                            ✅ Accept
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'rejected')}
                            style={{
                              fontSize: '11px', fontWeight: 700, padding: '5px 12px',
                              borderRadius: '6px', border: '1px solid #FECACA',
                              background: '#FEE2E2', color: '#991B1B', cursor: 'pointer',
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                      {isAccepted && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, 'dispatched')}
                          style={{
                            fontSize: '11px', fontWeight: 700, padding: '5px 14px',
                            borderRadius: '6px', border: '1px solid #BFDBFE',
                            background: '#DBEAFE', color: '#1E40AF', cursor: 'pointer',
                            marginTop: '4px',
                          }}
                        >
                          🚛 Mark Dispatched
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
