'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Item, Tenant, BranchOrder } from '@/types';
import { Search, Package, Plus, Trash2, X, Check, ShoppingBag, Layers, AlertCircle } from 'lucide-react';

interface OrderDestination {
  id: string;
  tenantId: string;
  counterUsername?: string;
  name: string;
  type: 'branch' | 'counter';
  subtitle?: string;
}

interface OrderCartItem {
  item: Item;
  qty: number;
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
  const [orderCart, setOrderCart] = useState<OrderCartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products by SKU, Name, Category, Shade
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return items.slice(0, 50); // Show first 50 items by default

    return items.filter(it => {
      const codeMatch = (it.code || '').toLowerCase().includes(q);
      const nameMatch = (it.name || '').toLowerCase().includes(q);
      const catMatch = (it.category || '').toLowerCase().includes(q);
      const shadeMatch = (it.shade_code || '').toLowerCase().includes(q);
      const packMatch = (it.pack_size || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || catMatch || shadeMatch || packMatch;
    }).slice(0, 60);
  }, [items, productSearch]);

  // Add Item to Order Cart
  const handleAddItemToCart = (item: Item) => {
    setOrderCart(prev => {
      const existingIdx = prev.findIndex(ci => ci.item.id === item.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].qty += 1;
        return updated;
      }
      return [...prev, { item, qty: 1 }];
    });
    setProductSearch('');
    setIsSearchOpen(false);
  };

  const handleUpdateCartQty = (idx: number, newQty: number) => {
    if (newQty < 1) return;
    setOrderCart(prev => {
      const updated = [...prev];
      updated[idx].qty = newQty;
      return updated;
    });
  };

  const handleRemoveCartItem = (idx: number) => {
    setOrderCart(prev => prev.filter((_, i) => i !== idx));
  };

  // Fetch all potential order destinations (other branches)
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
      setFormError('Please select a source branch to order from');
      return;
    }

    if (orderCart.length === 0) {
      setFormError('Please search and add at least 1 product to the order');
      return;
    }

    setSubmitting(true);
    try {
      const payloadItems = orderCart.map(ci => ({
        item_code: ci.item.code,
        item_name: ci.item.name,
        unit: ci.item.unit || ci.item.pack_size || 'Can',
        qty: ci.qty,
      }));

      const res = await fetch('/api/branch-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_tenant_id: tenantId,
          to_tenant_id: selectedDest.tenantId,
          from_counter: staffUsername || null,
          target_counter: selectedDest.counterUsername || null,
          items: payloadItems,
          notes: notes || null,
          created_by: staffName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const totalUnits = orderCart.reduce((sum, ci) => sum + ci.qty, 0);
        setFormSuccess(`Order ${data.order.order_no} placed successfully! (${orderCart.length} products, ${totalUnits} units requested from ${selectedDest.name})`);
        setOrderCart([]);
        setNotes('');
        await fetchOrders();
        if (onOrderPlaced) onOrderPlaced();
        setTimeout(() => setActiveTab('my_requests'), 1500);
      } else {
        setFormError(data.error || 'Failed to place order');
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error placing order');
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

            {/* Product Search & Multi-Item Requisition Cart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Search &amp; Add Products *
                </label>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                  {items.length} Products in Catalog
                </span>
              </div>

              {/* Search Combobox Input */}
              <div ref={searchRef} style={{ position: 'relative' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    style={{
                      position: 'absolute',
                      left: '12px',
                      width: '16px',
                      height: '16px',
                      color: '#94A3B8',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={productSearch}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Search by SKU code, name, category, or shade (e.g. RG100, Plastic Emulsion)..."
                    style={{ paddingLeft: '38px', paddingRight: productSearch ? '36px' : '12px' }}
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        setIsSearchOpen(false);
                      }}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>

                {/* Instant Search Results Dropdown */}
                {isSearchOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      zIndex: 50,
                    }}
                  >
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                        No products match &ldquo;{productSearch}&rdquo;
                      </div>
                    ) : (
                      <div style={{ padding: '6px' }}>
                        <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Select Product to Add ({filteredProducts.length} results)
                        </div>
                        {filteredProducts.map(it => {
                          const isAlreadyInCart = orderCart.some(ci => ci.item.id === it.id);
                          return (
                            <div
                              key={it.id}
                              onClick={() => handleAddItemToCart(it)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'background-color 0.12s ease',
                                backgroundColor: isAlreadyInCart ? '#F0FDF4' : 'transparent',
                                border: isAlreadyInCart ? '1px solid #BBF7D0' : '1px solid transparent',
                                marginBottom: '4px',
                              }}
                              onMouseEnter={e => {
                                if (!isAlreadyInCart) e.currentTarget.style.backgroundColor = '#F8FAFC';
                              }}
                              onMouseLeave={e => {
                                if (!isAlreadyInCart) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      fontFamily: 'monospace',
                                      backgroundColor: '#F1F5F9',
                                      color: '#0F172A',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    {it.code}
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {it.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{it.category || 'General'}</span>
                                  <span>•</span>
                                  <span>{it.pack_size || it.unit || 'Can'}</span>
                                  {it.shade_code && (
                                    <>
                                      <span>•</span>
                                      <span style={{ color: '#D97706', fontWeight: 600 }}>Shade: {it.shade_code}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    backgroundColor: it.stock_qty > 0 ? '#E0F2FE' : '#F1F5F9',
                                    color: it.stock_qty > 0 ? '#0369A1' : '#64748B',
                                  }}
                                >
                                  {it.stock_qty} in stock
                                </span>
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    backgroundColor: isAlreadyInCart ? '#22C55E' : '#F97316',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {isAlreadyInCart ? <Check style={{ width: '14px', height: '14px', strokeWidth: 3 }} /> : <Plus style={{ width: '14px', height: '14px', strokeWidth: 3 }} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Requisition Items Table */}
              <div style={{ marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '12px' }}>
                    Order Items ({orderCart.length} selected)
                  </label>
                  {orderCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOrderCart([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#EF4444',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {orderCart.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1.5px dashed #CBD5E1',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Package style={{ width: '28px', height: '28px', color: '#94A3B8' }} />
                    <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, margin: 0 }}>
                      No products added to requisition yet
                    </p>
                    <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
                      Type above in the search box to add products to this branch transfer
                    </p>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      {orderCart.map((ci, idx) => (
                        <div
                          key={ci.item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderBottom: idx === orderCart.length - 1 ? 'none' : '1px solid #F1F5F9',
                            gap: '12px',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: '#F97316' }}>
                                {ci.item.code}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ci.item.name}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {ci.item.pack_size || ci.item.unit || 'Can'} • Local Stock: {ci.item.stock_qty}
                            </div>
                          </div>

                          {/* Quantity Stepper */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(idx, Math.max(1, ci.qty - 1))}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#F8FAFC',
                                color: '#0F172A',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={ci.qty}
                              onChange={e => handleUpdateCartQty(idx, parseInt(e.target.value) || 1)}
                              style={{
                                width: '54px',
                                height: '28px',
                                textAlign: 'center',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#0F172A',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(idx, ci.qty + 1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#F8FAFC',
                                color: '#0F172A',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCartItem(idx)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: '4px',
                              }}
                              title="Remove item"
                            >
                              <Trash2 style={{ width: '13px', height: '13px' }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Cart Total Bar */}
                    <div
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#F8FAFC',
                        borderTop: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#475569',
                        fontWeight: 600,
                      }}
                    >
                      <span>Total: {orderCart.length} Unique Item(s)</span>
                      <span style={{ color: '#0F172A', fontWeight: 700 }}>
                        {orderCart.reduce((sum, ci) => sum + ci.qty, 0)} Total Units
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label">Order Notes / Urgency (optional)</label>
              <textarea
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Urgently needed for customer contractor order, please dispatch via Suzuki"
                rows={2}
                style={{ resize: 'vertical', minHeight: '48px' }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || destinations.length === 0 || orderCart.length === 0}
              className="btn btn-primary btn-lg"
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              {submitting
                ? 'Placing Order...'
                : `📤 Place Branch Order (${orderCart.length} Items • ${orderCart.reduce((sum, ci) => sum + ci.qty, 0)} Units)`}
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
