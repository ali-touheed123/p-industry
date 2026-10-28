'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Item, Tenant, BranchOrder } from '@/types';
import {
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  Building2,
  Store,
  ArrowRightLeft,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Send,
  Inbox,
  Palette,
  PackageSearch,
  AlertCircle,
  Info,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';

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
  defaultTab?: 'place' | 'my_requests' | 'incoming';
}

export default function BranchOrders({
  items,
  tenantId,
  tenantSlug,
  tenantName = 'Branch',
  staffName = 'Staff',
  staffUsername,
  onOrderPlaced,
  defaultTab,
}: Props) {
  // State: destinations, orders, form
  const [destinations, setDestinations] = useState<OrderDestination[]>([]);
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'place' | 'my_requests' | 'incoming'>(defaultTab || 'place');

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);
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

  // Dispatch Review Modal State
  const [dispatchModalOrder, setDispatchModalOrder] = useState<BranchOrder | null>(null);
  const [dispatchLines, setDispatchLines] = useState<
    Array<{
      id: string;
      item_code: string;
      item_name: string;
      unit: string;
      requested_qty: number;
      available_stock: number;
      dispatched_qty: number;
      unit_price: number;
    }>
  >([]);
  const [dispatchDiscountType, setDispatchDiscountType] = useState<'flat' | 'percent'>('flat');
  const [dispatchDiscountVal, setDispatchDiscountVal] = useState<number>(0);
  const [dispatchDeliveryCharges, setDispatchDeliveryCharges] = useState<number>(0);
  const [dispatchDeliveryMethod, setDispatchDeliveryMethod] = useState<string>('Van / Transport');
  const [dispatchNote, setDispatchNote] = useState<string>('');
  const [dispatchSubmitting, setDispatchSubmitting] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Reject Modal State
  const [rejectModalOrder, setRejectModalOrder] = useState<BranchOrder | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectSubmitting, setRejectSubmitting] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Double-click protection tracker
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

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

    return items
      .filter(it => {
        const codeMatch = (it.code || '').toLowerCase().includes(q);
        const nameMatch = (it.name || '').toLowerCase().includes(q);
        const catMatch = (it.category || '').toLowerCase().includes(q);
        const shadeMatch = (it.shade_code || '').toLowerCase().includes(q);
        const packMatch = (it.pack_size || '').toLowerCase().includes(q);
        return codeMatch || nameMatch || catMatch || shadeMatch || packMatch;
      })
      .slice(0, 60);
  }, [items, productSearch]);

  // Add Item to Order Cart (unconstrained by local stock — allows requisitioning when local stock is 0)
  const handleAddItemToCart = (item: Item) => {
    setFormError('');
    setOrderCart(prev => {
      const existingIdx = prev.findIndex(ci => ci.item.id === item.id);
      if (existingIdx >= 0) {
        return prev.map((ci, idx) =>
          idx === existingIdx ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { item, qty: 1 }];
    });
    setProductSearch('');
    setIsSearchOpen(false);
  };

  const handleUpdateCartQty = (idx: number, newQty: number) => {
    setFormError('');
    if (newQty < 1) return;
    setOrderCart(prev => {
      const cartItem = prev[idx];
      if (!cartItem) return prev;
      return prev.map((ci, i) => (i === idx ? { ...ci, qty: newQty } : ci));
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
        setFormSuccess(
          `Order ${data.order.order_no} placed successfully! (${orderCart.length} products, ${totalUnits} units requested from ${selectedDest.name})`
        );
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

  // Open Dispatch Review Modal
  const openDispatchModal = (order: BranchOrder) => {
    const lines = (order.items || []).map((it) => {
      const stock = it.supplier_stock !== undefined ? it.supplier_stock : 0;
      // Default dispatched qty: min(requested_qty, available_stock) -> 0 if out of stock
      const defaultQty = Math.max(0, Math.min(it.qty, stock));
      // Default rate: pre-filled from supplying branch (cost_price fallback retail * 0.85)
      const defaultRate = it.default_rate !== undefined ? it.default_rate : 0;
      return {
        id: it.id || '',
        item_code: it.item_code || '',
        item_name: it.item_name,
        unit: it.unit || 'Can',
        requested_qty: it.qty,
        available_stock: stock,
        dispatched_qty: defaultQty,
        unit_price: defaultRate,
      };
    });

    setDispatchLines(lines);
    setDispatchDiscountType('flat');
    setDispatchDiscountVal(0);
    setDispatchDeliveryCharges(0);
    setDispatchDeliveryMethod('Van / Transport');
    setDispatchNote('');
    setDispatchError(null);
    setDispatchModalOrder(order);
  };

  // Confirm Dispatch
  const handleConfirmDispatch = async () => {
    if (!dispatchModalOrder) return;
    setDispatchError(null);

    const hasShort = dispatchLines.some((l) => l.dispatched_qty < l.requested_qty);
    if (hasShort && !dispatchNote.trim()) {
      setDispatchError('A note to the requesting branch is required when any item is dispatched short.');
      return;
    }

    const totalQty = dispatchLines.reduce((s, l) => s + l.dispatched_qty, 0);
    if (totalQty === 0) {
      setDispatchError('Cannot dispatch an order with 0 total quantity. Please reject the order instead.');
      return;
    }

    for (const line of dispatchLines) {
      if (line.unit_price < 0) {
        setDispatchError(`Unit price cannot be negative for ${line.item_name}.`);
        return;
      }
      if (line.dispatched_qty > line.requested_qty) {
        setDispatchError(`Dispatched quantity cannot exceed requested quantity for ${line.item_name}.`);
        return;
      }
    }

    const subtotal = dispatchLines.reduce((sum, l) => sum + l.dispatched_qty * l.unit_price, 0);
    const resolvedDiscount =
      dispatchDiscountType === 'percent'
        ? Math.round(((subtotal * dispatchDiscountVal) / 100) * 100) / 100
        : dispatchDiscountVal;

    if (resolvedDiscount > subtotal) {
      setDispatchError('Discount cannot exceed subtotal.');
      return;
    }

    setDispatchSubmitting(true);
    try {
      const res = await fetch('/api/branch-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dispatchModalOrder.id,
          status: 'dispatched',
          items: dispatchLines.map((l) => ({
            id: l.id,
            item_code: l.item_code,
            dispatched_qty: l.dispatched_qty,
            unit_price: l.unit_price,
          })),
          discount: resolvedDiscount,
          delivery_charges: dispatchDeliveryCharges,
          delivery_method: dispatchDeliveryMethod,
          dispatch_note: dispatchNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setDispatchError(data.error || 'Failed to dispatch order');
      } else {
        setDispatchModalOrder(null);
        await fetchOrders();
      }
    } catch (err: any) {
      setDispatchError(err.message || 'Network error dispatching order');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (order: BranchOrder) => {
    setRejectReason('');
    setRejectError(null);
    setRejectModalOrder(order);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectModalOrder) return;
    const clean = rejectReason.trim();
    if (!clean) {
      setRejectError('A rejection reason is required.');
      return;
    }
    if (clean.length > 500) {
      setRejectError('Rejection reason cannot exceed 500 characters.');
      return;
    }

    setRejectSubmitting(true);
    try {
      const res = await fetch('/api/branch-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rejectModalOrder.id,
          status: 'rejected',
          reject_reason: clean,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setRejectError(data.error || 'Failed to reject order');
      } else {
        setRejectModalOrder(null);
        await fetchOrders();
      }
    } catch (err: any) {
      setRejectError(err.message || 'Network error rejecting order');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // Update order status (accept / receive) with double-click guard
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    if (actionInProgressId) return;
    setActionInProgressId(orderId);
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
    } finally {
      setActionInProgressId(null);
    }
  };

  // Filter orders into my requests vs incoming
  const myRequests = orders.filter(o => {
    if (o.from_tenant_id !== tenantId) return false;
    if (o.to_tenant_id === tenantId) {
      return !staffUsername || o.from_counter === staffUsername;
    }
    return true;
  });

  const incomingOrders = orders.filter(o => {
    if (o.to_tenant_id !== tenantId) return false;
    if (o.from_tenant_id === tenantId) {
      return !staffUsername || o.target_counter === staffUsername || !o.target_counter;
    }
    return true;
  });

  const pendingIncomingCount = incomingOrders.filter(o => o.status === 'pending').length;
  const totalCartUnits = orderCart.reduce((sum, ci) => sum + ci.qty, 0);
  const selectedDest = destinations.find(d => d.id === selectedDestId);

  // Status badge styling
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'accepted':
        return {
          bg: '#EFF6FF',
          color: '#1D4ED8',
          border: '#BFDBFE',
          icon: CheckCircle2,
          label: 'Accepted',
        };
      case 'dispatched':
        return {
          bg: '#EEF2FF',
          color: '#4338CA',
          border: '#C7D2FE',
          icon: Truck,
          label: 'Dispatched',
        };
      case 'received':
        return {
          bg: '#ECFDF5',
          color: '#047857',
          border: '#A7F3D0',
          icon: Check,
          label: 'Received',
        };
      case 'rejected':
        return {
          bg: '#FEF2F2',
          color: '#B91C1C',
          border: '#FECACA',
          icon: XCircle,
          label: 'Rejected',
        };
      default:
        return {
          bg: '#FFFBEB',
          color: '#B45309',
          border: '#FDE68A',
          icon: Clock,
          label: 'Pending Approval',
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* ── Page Header & Controls ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '0.25rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#FFF7ED',
                color: '#EA580C',
                border: '1px solid #FFEDD5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowRightLeft size={18} />
            </div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
              Branch Orders &amp; Inter-Transfer
            </h1>
          </div>
          <p className="page-subtitle" style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
            Requisition stock from central godowns, warehouses, or sister branches when local counter stock is depleted.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Active Branch Context Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#334155',
              fontWeight: 600,
            }}
          >
            <Building2 size={14} style={{ color: '#F97316' }} />
            <span>Requesting Branch:</span>
            <strong style={{ color: '#0F172A' }}>{tenantName}</strong>
          </div>

          {/* Pending Alerts Pill */}
          {pendingIncomingCount > 0 && (
            <button
              onClick={() => setActiveTab('incoming')}
              style={{
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#F59E0B',
                  animation: 'pulse 2s infinite',
                }}
              />
              {pendingIncomingCount} Action Required on Incoming
            </button>
          )}
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: '#F1F5F9',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('place')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeTab === 'place' ? 700 : 500,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'place' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'place' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'place' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={14} style={{ color: activeTab === 'place' ? '#F97316' : 'inherit' }} />
            <span>Place Order</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_requests')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeTab === 'my_requests' ? 700 : 500,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'my_requests' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'my_requests' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'my_requests' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Send size={14} style={{ color: activeTab === 'my_requests' ? '#2563EB' : 'inherit' }} />
            <span>My Requests</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: activeTab === 'my_requests' ? '#E2E8F0' : '#E2E8F0',
                color: '#334155',
                padding: '1px 6px',
                borderRadius: '9999px',
                marginLeft: '2px',
              }}
            >
              {myRequests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: activeTab === 'incoming' ? 700 : 500,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'incoming' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'incoming' ? '#0F172A' : '#64748B',
              boxShadow: activeTab === 'incoming' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
          >
            <Inbox size={14} style={{ color: activeTab === 'incoming' ? '#059669' : 'inherit' }} />
            <span>Incoming Orders</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: pendingIncomingCount > 0 ? '#F97316' : '#E2E8F0',
                color: pendingIncomingCount > 0 ? '#FFFFFF' : '#334155',
                padding: '1px 6px',
                borderRadius: '9999px',
                marginLeft: '2px',
              }}
            >
              {incomingOrders.length}
            </span>
          </button>
        </div>

        <div style={{ fontSize: '12px', color: '#64748B' }}>
          Catalog: <strong style={{ color: '#0F172A' }}>{items.length}</strong> Products Indexed
        </div>
      </div>

      {/* ═══ TAB 1: Place New Order (2-Column Responsive Workspace) ═══ */}
      {activeTab === 'place' && (
        <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {formError && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '13px',
                color: '#991B1B',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{formError}</div>
            </div>
          )}

          {formSuccess && (
            <div
              style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '13px',
                color: '#065F46',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{formSuccess}</div>
            </div>
          )}

          {/* Grid Layout: Left Column (Builder) + Right Column (Manifest) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            {/* ── LEFT COLUMN: Route Selection & Catalog Search ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Card 1: Source Branch & Route */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={18} style={{ color: '#EA580C' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                      Transfer Route &amp; Source
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Step 1 of 2</span>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px' }}>
                    Order From (Source Branch / Counter / Godown) *
                  </label>
                  {destinations.length > 0 ? (
                    <select
                      className="form-select"
                      value={selectedDestId}
                      onChange={e => setSelectedDestId(e.target.value)}
                      required
                      style={{ height: '42px', fontSize: '13px' }}
                    >
                      {destinations.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} — {d.subtitle}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      style={{
                        padding: '14px',
                        background: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px dashed #CBD5E1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={16} />
                        Koi doosri branch ya godown registered nahi hai
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
                        Dusri branch se maal mangwane ke liye apne CEO ya Administrator se rabta karein.
                      </div>
                    </div>
                  )}
                </div>

                {/* Transfer Visual Badge */}
                {selectedDest && (
                  <div
                    style={{
                      marginTop: '0.875rem',
                      padding: '10px 12px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                      <Store size={14} style={{ color: '#0284C7' }} />
                      <span>Origin:</span>
                      <strong style={{ color: '#0F172A' }}>{selectedDest.name}</strong>
                    </div>
                    <ArrowRight size={14} style={{ color: '#94A3B8' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                      <Building2 size={14} style={{ color: '#EA580C' }} />
                      <span>Destination:</span>
                      <strong style={{ color: '#0F172A' }}>{tenantName}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Product Search & Requisition Catalog */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PackageSearch size={18} style={{ color: '#EA580C' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                      Product Catalog &amp; Requisition Picker
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Step 2 of 2</span>
                </div>

                {/* Combobox Search Input */}
                <div ref={searchRef} style={{ position: 'relative', marginBottom: '1rem' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '12px',
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
                      placeholder="Search by SKU, shade, name, or category (e.g. RG100, Emulsion)..."
                      style={{ paddingLeft: '38px', paddingRight: productSearch ? '36px' : '12px', height: '42px', fontSize: '13px' }}
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
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown Overlay */}
                  {isSearchOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '6px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        zIndex: 60,
                      }}
                    >
                      {filteredProducts.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          No products found matching &ldquo;{productSearch}&rdquo;
                        </div>
                      ) : (
                        <div style={{ padding: '6px' }}>
                          <div
                            style={{
                              padding: '6px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#64748B',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            Catalog Matches ({filteredProducts.length} items)
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
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                  backgroundColor: isAlreadyInCart ? '#F0FDF4' : 'transparent',
                                  border: isAlreadyInCart ? '1px solid #BBF7D0' : '1px solid transparent',
                                  marginBottom: '3px',
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
                                        fontFamily: 'JetBrains Mono, monospace',
                                        backgroundColor: '#F1F5F9',
                                        color: '#0F172A',
                                        padding: '1px 6px',
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
                                      backgroundColor: it.stock_qty > 0 ? '#E0F2FE' : '#FEE2E2',
                                      color: it.stock_qty > 0 ? '#0369A1' : '#B91C1C',
                                    }}
                                  >
                                    Local: {it.stock_qty}
                                  </span>
                                  <div
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '6px',
                                      backgroundColor: isAlreadyInCart ? '#16A34A' : '#EA580C',
                                      color: '#FFFFFF',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {isAlreadyInCart ? <Check size={14} /> : <Plus size={14} />}
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

                {/* Quick Catalog Picker Grid / Table */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                      Frequently Requisitioned Products
                    </span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Click item to add or increment</span>
                  </div>

                  <div
                    style={{
                      maxHeight: '320px',
                      overflowY: 'auto',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  >
                    {items.slice(0, 15).map(it => {
                      const inCart = orderCart.find(ci => ci.item.id === it.id);
                      return (
                        <div
                          key={it.id}
                          onClick={() => handleAddItemToCart(it)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            backgroundColor: inCart ? '#F0FDF4' : 'transparent',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={e => {
                            if (!inCart) e.currentTarget.style.backgroundColor = '#F8FAFC';
                          }}
                          onMouseLeave={e => {
                            if (!inCart) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#F97316' }}>
                                {it.code}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {it.name}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              {it.pack_size || it.unit || 'Can'} • Local: {it.stock_qty}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {inCart && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  backgroundColor: '#DCFCE7',
                                  color: '#166534',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                In Cart: {inCart.qty}
                              </span>
                            )}
                            <button
                              type="button"
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                border: '1px solid #E2E8F0',
                                backgroundColor: '#FFFFFF',
                                color: '#EA580C',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Order Manifest, Quantity Controls, Notes & Primary CTA ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} style={{ color: '#EA580C' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                      Requisition Manifest
                    </h3>
                  </div>
                  {orderCart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOrderCart([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#DC2626',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Items List or Professional Empty State */}
                {orderCart.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 20px',
                      borderRadius: '10px',
                      backgroundColor: '#F8FAFC',
                      border: '1.5px dashed #CBD5E1',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '1rem',
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: '#E2E8F0',
                        color: '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Package size={22} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                      No products added to requisition yet
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '300px', lineHeight: 1.4 }}>
                      Select items from the catalog or use the product search bar on the left to build this branch transfer.
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {orderCart.map((ci, idx) => (
                        <div
                          key={ci.item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderBottom: idx === orderCart.length - 1 ? 'none' : '1px solid #F1F5F9',
                            gap: '10px',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#EA580C' }}>
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

                          {/* Stepper Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(idx, Math.max(1, ci.qty - 1))}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#F8FAFC',
                                color: '#0F172A',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={ci.qty}
                              onChange={e => handleUpdateCartQty(idx, parseInt(e.target.value) || 1)}
                              style={{
                                width: '48px',
                                height: '28px',
                                textAlign: 'center',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#0F172A',
                                fontFamily: 'JetBrains Mono, monospace',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(idx, ci.qty + 1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#F8FAFC',
                                color: '#0F172A',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Plus size={13} />
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
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Cart Subtotals */}
                    <div
                      style={{
                        padding: '10px 14px',
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
                      <span>Unique Products: {orderCart.length}</span>
                      <span style={{ color: '#0F172A', fontWeight: 800, fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>
                        {totalCartUnits} Total Units
                      </span>
                    </div>
                  </div>
                )}

                {/* Notes Input */}
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: '#64748B' }} />
                    Order Notes / Urgency (Optional)
                  </label>
                  <textarea
                    className="form-input"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Urgently needed for customer contractor order, please dispatch via Suzuki"
                    rows={2}
                    style={{ resize: 'vertical', minHeight: '52px', fontSize: '13px' }}
                  />
                </div>

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={submitting || destinations.length === 0 || orderCart.length === 0}
                  className="btn btn-primary btn-lg"
                  style={{
                    width: '100%',
                    height: '46px',
                    fontSize: '14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Send size={16} />
                  {submitting
                    ? 'Transmitting Requisition...'
                    : `Place Branch Order (${orderCart.length} Items • ${totalCartUnits} Units)`}
                </button>

                {/* Help Footnote */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginTop: '1rem',
                    padding: '8px 10px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#64748B',
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#0284C7' }} />
                  <div>
                    Requisitions are instantly routed to the source branch counter &amp; godown. They will confirm availability and dispatch stock.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ═══ TAB 2: My Requests ═══ */}
      {activeTab === 'my_requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {myRequests.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={24} />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#334155' }}>
                No outgoing branch requisitions found
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, maxWidth: '400px' }}>
                You haven&apos;t placed any orders to other branches yet. Use the &ldquo;+ Place Order&rdquo; tab to request stock.
              </p>
            </div>
          ) : (
            myRequests.map(order => {
              const statusCfg = getStatusConfig(order.status);
              const StatusIcon = statusCfg.icon;
              const targetTitle = order.target_counter
                ? `${order.to_tenant?.name || 'Branch'} — ${order.target_counter.toUpperCase()}`
                : order.to_tenant?.name || 'Unknown Branch';
              const itemsList =
                (order.items && order.items.length > 0 ? order.items : (order as any).branch_order_items) || [];
              const totalUnits = itemsList.reduce((sum: number, it: any) => sum + (it.qty || 0), 0);

              return (
                <div key={order.id} className="card" style={{ padding: '1.25rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    {/* Left: Order Info & Manifest */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '14px',
                            fontWeight: 800,
                            color: '#0F172A',
                          }}
                        >
                          {order.order_no}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            border: `1px solid ${statusCfg.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <StatusIcon size={13} />
                          {statusCfg.label}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                        Ordered From: <strong style={{ color: '#0F172A' }}>{targetTitle}</strong>
                      </div>

                      {/* Items Badges */}
                      <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {itemsList.map((item: any, idx: number) => (
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
                              maxWidth: '520px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <Palette size={16} style={{ color: '#F97316' }} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                  {item.item_name}
                                </div>
                                {item.item_code && (
                                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
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
                              {item.dispatched_qty !== undefined && item.dispatched_qty !== null && item.dispatched_qty !== item.qty ? (
                                <span style={{ color: '#D97706' }}>
                                  Qty: {item.dispatched_qty} of {item.qty} {item.unit || 'Can'}
                                </span>
                              ) : (
                                <span>Qty: {item.qty} {item.unit || 'Can'}</span>
                              )}
                              {item.unit_price ? ` @ Rs. ${item.unit_price.toLocaleString()}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#475569',
                            marginTop: '6px',
                            background: '#F1F5F9',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <FileText size={14} style={{ color: '#64748B' }} />
                          <span>
                            <strong>Notes:</strong> {order.notes}
                          </span>
                        </div>
                      )}

                      {order.dispatch_note && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#1E40AF',
                            marginTop: '6px',
                            background: '#EFF6FF',
                            border: '1px solid #DBEAFE',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Truck size={14} style={{ color: '#2563EB', flexShrink: 0 }} />
                          <span>
                            <strong>Dispatch Note:</strong> {order.dispatch_note}
                          </span>
                        </div>
                      )}

                      {order.reject_reason && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#991B1B',
                            marginTop: '6px',
                            background: '#FEF2F2',
                            border: '1px solid #FEE2E2',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <XCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                          <span>
                            <strong>Rejection Reason:</strong> {order.reject_reason}
                          </span>
                        </div>
                      )}

                      {order.transfer_value !== undefined && order.transfer_value !== null && (order.status === 'dispatched' || order.status === 'received') && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#334155',
                            background: '#F8FAFC',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            marginTop: '6px',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>Subtotal: <strong>Rs. {Number(order.subtotal || 0).toLocaleString()}</strong></span>
                          {Number(order.discount || 0) > 0 && (
                            <span style={{ color: '#16A34A' }}>Discount: <strong>-Rs. {Number(order.discount).toLocaleString()}</strong></span>
                          )}
                          {Number(order.delivery_charges || 0) > 0 && (
                            <span style={{ color: '#2563EB' }}>Delivery ({order.delivery_method || 'Transport'}): <strong>+Rs. {Number(order.delivery_charges).toLocaleString()}</strong></span>
                          )}
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>Net Value: <strong>Rs. {Number(order.transfer_value || 0).toLocaleString()}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Right: Date & Actions */}
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-PK', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {itemsList.length} items • {totalUnits} units
                      </div>

                      {order.status === 'dispatched' && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, 'received')}
                          disabled={actionInProgressId === order.id}
                          className="btn btn-primary"
                          style={{
                            marginTop: '8px',
                            fontSize: '12px',
                            padding: '6px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: actionInProgressId === order.id ? 0.7 : 1,
                          }}
                        >
                          <CheckCircle2 size={14} />
                          {actionInProgressId === order.id ? 'Confirming...' : 'Mark Received'}
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

      {/* ═══ TAB 3: Incoming Orders ═══ */}
      {activeTab === 'incoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {incomingOrders.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Inbox size={24} />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#334155' }}>
                No incoming branch requests
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, maxWidth: '400px' }}>
                When other branches or counters need products from your stock, their requisitions will appear here.
              </p>
            </div>
          ) : (
            incomingOrders.map(order => {
              const statusCfg = getStatusConfig(order.status);
              const StatusIcon = statusCfg.icon;
              const isPending = order.status === 'pending';
              const isAccepted = order.status === 'accepted';
              const requesterTitle = order.from_counter
                ? `${order.from_tenant?.name || 'Branch'} — ${order.from_counter.toUpperCase()} (${order.created_by || 'Staff'})`
                : order.from_tenant?.name || 'Unknown Branch';
              const itemsList =
                (order.items && order.items.length > 0 ? order.items : (order as any).branch_order_items) || [];
              const totalUnits = itemsList.reduce((sum: number, it: any) => sum + (it.qty || 0), 0);

              return (
                <div
                  key={order.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    borderLeft: isPending ? '4px solid #F59E0B' : isAccepted ? '4px solid #3B82F6' : undefined,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    {/* Left: Requisition Details */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '14px',
                            fontWeight: 800,
                            color: '#0F172A',
                          }}
                        >
                          {order.order_no}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '6px',
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            border: `1px solid ${statusCfg.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <StatusIcon size={13} />
                          {statusCfg.label}
                        </span>
                        {isPending && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#B45309',
                              backgroundColor: '#FEF3C7',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            Action Required
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '8px' }}>
                        Requested By: <strong style={{ color: '#0F172A' }}>{requesterTitle}</strong>
                      </div>

                      {/* Items List */}
                      <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {itemsList.map((item: any, idx: number) => (
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
                              maxWidth: '520px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <Palette size={16} style={{ color: '#F97316' }} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                                  {item.item_name}
                                </div>
                                {item.item_code && (
                                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
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
                              {item.dispatched_qty !== undefined && item.dispatched_qty !== null && item.dispatched_qty !== item.qty ? (
                                <span style={{ color: '#D97706' }}>
                                  Qty: {item.dispatched_qty} of {item.qty} {item.unit || 'Can'}
                                </span>
                              ) : (
                                <span>Qty: {item.qty} {item.unit || 'Can'}</span>
                              )}
                              {item.unit_price ? ` @ Rs. ${item.unit_price.toLocaleString()}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#475569',
                            marginTop: '6px',
                            background: '#F1F5F9',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <FileText size={14} style={{ color: '#64748B' }} />
                          <span>
                            <strong>Notes:</strong> {order.notes}
                          </span>
                        </div>
                      )}

                      {order.dispatch_note && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#1E40AF',
                            marginTop: '6px',
                            background: '#EFF6FF',
                            border: '1px solid #DBEAFE',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Truck size={14} style={{ color: '#2563EB', flexShrink: 0 }} />
                          <span>
                            <strong>Dispatch Note:</strong> {order.dispatch_note}
                          </span>
                        </div>
                      )}

                      {order.reject_reason && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#991B1B',
                            marginTop: '6px',
                            background: '#FEF2F2',
                            border: '1px solid #FEE2E2',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <XCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                          <span>
                            <strong>Rejection Reason:</strong> {order.reject_reason}
                          </span>
                        </div>
                      )}

                      {order.transfer_value !== undefined && order.transfer_value !== null && (order.status === 'dispatched' || order.status === 'received') && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#334155',
                            background: '#F8FAFC',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            marginTop: '6px',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>Subtotal: <strong>Rs. {Number(order.subtotal || 0).toLocaleString()}</strong></span>
                          {Number(order.discount || 0) > 0 && (
                            <span style={{ color: '#16A34A' }}>Discount: <strong>-Rs. {Number(order.discount).toLocaleString()}</strong></span>
                          )}
                          {Number(order.delivery_charges || 0) > 0 && (
                            <span style={{ color: '#2563EB' }}>Delivery ({order.delivery_method || 'Transport'}): <strong>+Rs. {Number(order.delivery_charges).toLocaleString()}</strong></span>
                          )}
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>Net Value: <strong>Rs. {Number(order.transfer_value || 0).toLocaleString()}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Right: Date & Status Action Buttons */}
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-PK', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        {itemsList.length} items • {totalUnits} units
                      </div>

                      {/* Action Buttons */}
                      {isPending && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            onClick={() => handleStatusUpdate(order.id, 'accepted')}
                            disabled={actionInProgressId === order.id}
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #BBF7D0',
                              background: '#ECFDF5',
                              color: '#065F46',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: actionInProgressId === order.id ? 0.7 : 1,
                            }}
                          >
                            <Check size={14} />
                            {actionInProgressId === order.id ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => openRejectModal(order)}
                            disabled={actionInProgressId === order.id}
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #FECACA',
                              background: '#FEF2F2',
                              color: '#991B1B',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      )}

                      {isAccepted && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            onClick={() => openDispatchModal(order)}
                            disabled={actionInProgressId === order.id}
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #BFDBFE',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Truck size={14} />
                            Dispatch Order
                          </button>
                          <button
                            onClick={() => openRejectModal(order)}
                            disabled={actionInProgressId === order.id}
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #FECACA',
                              background: '#FEF2F2',
                              color: '#991B1B',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DISPATCH REVIEW MODAL                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {dispatchModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '780px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={20} style={{ color: '#2563EB' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Dispatch Order #{dispatchModalOrder.order_no}
                  </h3>
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  Destination: <strong>{dispatchModalOrder.from_tenant?.name || 'Requesting Branch'}</strong>
                  {dispatchModalOrder.from_counter ? ` (${dispatchModalOrder.from_counter})` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Banner */}
            {dispatchError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{dispatchError}</span>
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Verify &amp; Adjust Quantities &amp; Rates:
              </div>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '8px 12px' }}>Product</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Req / Stock</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '110px' }}>Dispatch Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '120px' }}>Unit Rate (Rs.)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchLines.map((line, idx) => {
                      const isShort = line.dispatched_qty < line.requested_qty;
                      return (
                        <tr key={line.id} style={{ borderBottom: idx === dispatchLines.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{line.item_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{line.item_code}</div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div><strong>{line.requested_qty}</strong> {line.unit}</div>
                            <div style={{ fontSize: '11px', color: line.available_stock >= line.requested_qty ? '#16A34A' : line.available_stock > 0 ? '#D97706' : '#DC2626', fontWeight: 600 }}>
                              {line.available_stock <= 0 ? 'Out of Stock (0)' : `Avail: ${line.available_stock}`}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              max={line.requested_qty}
                              value={line.dispatched_qty}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(line.requested_qty, parseInt(e.target.value) || 0));
                                setDispatchLines((prev) =>
                                  prev.map((l, i) => (i === idx ? { ...l, dispatched_qty: val } : l))
                                );
                              }}
                              style={{
                                width: '80px',
                                padding: '4px 8px',
                                textAlign: 'center',
                                borderRadius: '6px',
                                border: isShort ? '1px solid #F59E0B' : '1px solid #CBD5E1',
                                background: isShort ? '#FFFBEB' : '#FFFFFF',
                                fontWeight: 700,
                                fontSize: '13px',
                              }}
                            />
                            {isShort && (
                              <div style={{ fontSize: '10px', color: '#D97706', fontWeight: 700, marginTop: '2px' }}>
                                Short (-{line.requested_qty - line.dispatched_qty})
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={line.unit_price}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setDispatchLines((prev) =>
                                  prev.map((l, i) => (i === idx ? { ...l, unit_price: val } : l))
                                );
                              }}
                              style={{
                                width: '100px',
                                padding: '4px 8px',
                                textAlign: 'right',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontWeight: 600,
                                fontSize: '13px',
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                            Rs. {(line.dispatched_qty * line.unit_price).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note & Freight Adjustments Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Delivery / Carriage Charges (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  value={dispatchDeliveryCharges}
                  onChange={(e) => setDispatchDeliveryCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Delivery Method / Transporter
                </label>
                <input
                  type="text"
                  value={dispatchDeliveryMethod}
                  onChange={(e) => setDispatchDeliveryMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                  placeholder="e.g. Suzuki, Courier, By Hand"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Discount</label>
                  <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                    <button
                      type="button"
                      onClick={() => setDispatchDiscountType('flat')}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        background: dispatchDiscountType === 'flat' ? '#2563EB' : '#F8FAFC',
                        color: dispatchDiscountType === 'flat' ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Rs. Flat
                    </button>
                    <button
                      type="button"
                      onClick={() => setDispatchDiscountType('percent')}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        background: dispatchDiscountType === 'percent' ? '#2563EB' : '#F8FAFC',
                        color: dispatchDiscountType === 'percent' ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={dispatchDiscountVal}
                  onChange={(e) => setDispatchDiscountVal(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Note to Requesting Branch {dispatchLines.some((l) => l.dispatched_qty < l.requested_qty) ? <span style={{ color: '#DC2626' }}>* (Required)</span> : '(Optional)'}
                  </label>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{dispatchNote.length}/500</span>
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={dispatchNote}
                  onChange={(e) => setDispatchNote(e.target.value)}
                  placeholder={dispatchLines.some((l) => l.dispatched_qty < l.requested_qty) ? 'Required: Explain why items are dispatched short...' : 'Add any dispatch comments...'}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: dispatchLines.some((l) => l.dispatched_qty < l.requested_qty) && !dispatchNote.trim() ? '1px solid #FCA5A5' : '1px solid #CBD5E1',
                    fontSize: '12px',
                    resize: 'none',
                  }}
                />
              </div>
            </div>

            {/* Calculation Summary Box */}
            {(() => {
              const subtotal = dispatchLines.reduce((sum, l) => sum + l.dispatched_qty * l.unit_price, 0);
              const resolvedDiscount =
                dispatchDiscountType === 'percent'
                  ? Math.round(((subtotal * dispatchDiscountVal) / 100) * 100) / 100
                  : dispatchDiscountVal;
              const netTotal = Math.max(0, subtotal - resolvedDiscount + dispatchDeliveryCharges);

              return (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    <span>Subtotal:</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  {resolvedDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16A34A', marginBottom: '4px' }}>
                      <span>Discount:</span>
                      <span>-Rs. {resolvedDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {dispatchDeliveryCharges > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#2563EB', marginBottom: '4px' }}>
                      <span>Delivery ({dispatchDeliveryMethod || 'Transport'}):</span>
                      <span>+Rs. {dispatchDeliveryCharges.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#0F172A', borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '4px' }}>
                    <span>Net Transfer Value:</span>
                    <span>Rs. {netTotal.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                disabled={dispatchSubmitting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={dispatchSubmitting}
                style={{
                  padding: '8px 22px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: dispatchSubmitting ? 0.7 : 1,
                }}
              >
                <Truck size={15} />
                {dispatchSubmitting ? 'Dispatching...' : 'Confirm & Dispatch Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* REJECT REASON MODAL                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {rejectModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#991B1B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle size={18} />
                  Reject Order #{rejectModalOrder.order_no}
                </h3>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  From: <strong>{rejectModalOrder.from_tenant?.name || 'Requesting Branch'}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {rejectError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                {rejectError}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Reason for Rejection *
                </label>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{rejectReason.length}/500</span>
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Out of stock in all godowns, price revision pending, etc."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setRejectModalOrder(null)}
                disabled={rejectSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectSubmitting || !rejectReason.trim()}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  opacity: rejectSubmitting || !rejectReason.trim() ? 0.6 : 1,
                }}
              >
                {rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
