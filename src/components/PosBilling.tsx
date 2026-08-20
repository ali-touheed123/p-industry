'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Item, Client } from '@/types';

interface Props {
  items: Item[];
  tenantId: string;
  shiftId?: string;
  onCompleteSale: (invoice: any) => void;
  staffName: string;
  tenantName?: string;
}

interface CartItem {
  item: Item;
  qty: number;
  price: number;
}

interface HeldOrder {
  id: string;
  customerName: string;
  selectedClient: Client | null;
  cart: CartItem[];
  time: string;
  total: number;
}

const CATEGORIES = ['All Products', 'Interior Emulsion', 'Weather Shield', 'Primers & Putty', 'Enamel', 'Accessories'];
const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',   icon: 'payments' },
  { id: 'credit', label: 'Credit', icon: 'credit_card' },
  { id: 'bank',   label: 'Bank',   icon: 'account_balance' },
  { id: 'cheque', label: 'Cheque', icon: 'receipt_long' },
];

export default function PosBilling({
  items,
  tenantId,
  shiftId,
  onCompleteSale,
  staffName,
  tenantName = 'Paint House',
}: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [priceTier, setPriceTier] = useState<'retail' | 'wholesale' | 'trade'>('retail');
  const [discount, setDiscount] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Products');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'bank' | 'cheque'>('cash');
  const [submitting, setSubmitting] = useState(false);

  // Customer State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [walkinName, setWalkinName] = useState('Walk-in Customer');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Held Orders State
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch Clients for this tenant
  useEffect(() => {
    if (!tenantId) return;
    const fetchClients = async () => {
      try {
        const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setClients(data.clients || []);
        }
      } catch (err) {
        console.error('Failed to load clients', err);
      }
    };
    fetchClients();
  }, [tenantId]);

  // Keyboard Shortcuts Listener ([F1], [F2], [F3], [Escape])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setShowCustomerModal(false);
        setShowHeldModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedClient, walkinName, discount, paymentMethod, submitting]);

  const getPrice = (item: Item) => {
    if (priceTier === 'wholesale') return item.wholesale_price;
    if (priceTier === 'trade') return item.trade_price;
    return item.retail_price;
  };

  const addToCart = (item: Item) => {
    if (item.stock_qty <= 0) return;
    const existing = cart.find(c => c.item.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { item, qty: 1, price: getPrice(item) }]);
    }
  };

  const updateQty = (id: string, newQty: number) => {
    if (newQty < 1) return;
    setCart(cart.map(c => c.item.id === id ? { ...c, qty: newQty } : c));
  };

  const removeFromCart = (id: string) => setCart(cart.filter(c => c.item.id !== id));

  // Calculations
  const subTotal = cart.reduce((sum, ci) => sum + (ci.qty * ci.price), 0);
  const discountVal = parseFloat(discount) || 0;
  const taxAmt = Math.round((subTotal - discountVal) * 0.17);
  const grandTotal = Math.max(0, subTotal - discountVal + taxAmt);
  const paidAmount = paymentMethod === 'credit' ? 0 : grandTotal;
  const dueAmount = paymentMethod === 'credit' ? grandTotal : 0;

  // Checkout Handler: Saves to Supabase and deducts stock
  const handleCheckout = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);

    const generatedInvoiceNo = `INV-${Math.floor(10000 + Math.random() * 90000)}`;
    const customerDisplayName = selectedClient ? selectedClient.name : walkinName || 'Walk-in Customer';

    const invoicePayload = {
      tenant_id: tenantId,
      invoice_no: generatedInvoiceNo,
      client_id: selectedClient?.id || null,
      client_name: customerDisplayName,
      shift_id: shiftId || null,
      subtotal: subTotal,
      discount: discountVal,
      tax: taxAmt,
      net_total: grandTotal,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      payment_type: paymentMethod,
      status: 'completed',
      items: cart.map(ci => ({
        item_id: ci.item.id,
        item_code: ci.item.code,
        item_name: ci.item.name,
        unit: ci.item.unit,
        qty: ci.qty,
        unit_price: ci.price,
        discount: 0,
        total_price: ci.qty * ci.price,
      })),
    };

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload),
      });

      const data = await res.json();
      if (data.success) {
        onCompleteSale({
          ...data.invoice,
          grandTotal,
          subTotal,
          discount: discountVal,
          tax: taxAmt,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          items: cart,
        });

        // Reset POS state
        setCart([]);
        setSelectedClient(null);
        setWalkinName('Walk-in Customer');
        setDiscount('0');
      } else {
        alert(`Failed to save invoice: ${data.error}`);
      }
    } catch (err) {
      console.error('Invoice save failed', err);
      alert('Network error while saving invoice to database.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hold Current Order
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const newHeld: HeldOrder = {
      id: Date.now().toString(),
      customerName: selectedClient ? selectedClient.name : walkinName,
      selectedClient,
      cart,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: grandTotal,
    };
    setHeldOrders([newHeld, ...heldOrders]);
    setCart([]);
    setSelectedClient(null);
    setWalkinName('Walk-in Customer');
    setDiscount('0');
  };

  // Recall Held Order
  const handleRecallOrder = (order: HeldOrder) => {
    setCart(order.cart);
    setSelectedClient(order.selectedClient);
    setWalkinName(order.customerName);
    setHeldOrders(heldOrders.filter(h => h.id !== order.id));
    setShowHeldModal(false);
  };

  // WhatsApp Dispatch Generator
  const handleWhatsAppDispatch = () => {
    if (cart.length === 0) return;
    const customerDisplayName = selectedClient ? selectedClient.name : walkinName;
    const itemsText = cart
      .map(ci => `• ${ci.item.name} (${ci.qty} ${ci.item.unit}) = Rs. ${(ci.qty * ci.price).toLocaleString()}`)
      .join('\n');

    const message = `*${tenantName} — Sales Receipt*\n` +
      `Customer: ${customerDisplayName}\n` +
      `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n` +
      `----------------------------\n` +
      `${itemsText}\n` +
      `----------------------------\n` +
      `Subtotal: Rs. ${subTotal.toLocaleString()}\n` +
      (discountVal > 0 ? `Discount: -Rs. ${discountVal.toLocaleString()}\n` : '') +
      `*Grand Total: Rs. ${grandTotal.toLocaleString()}*\n` +
      `Payment Mode: ${paymentMethod.toUpperCase()}\n\n` +
      `Thank you for your business!`;

    const phone = selectedClient?.phone?.replace(/[^0-9]/g, '') || '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // Quick Add Client
  const handleCreateQuickClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !tenantId) return;

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: newClientName,
          phone: newClientPhone,
          credit_limit: 50000,
        }),
      });
      const data = await res.json();
      if (data.success && data.client) {
        setClients([data.client, ...clients]);
        setSelectedClient(data.client);
        setShowCustomerModal(false);
        setNewClientName('');
        setNewClientPhone('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter(it => {
    const matchesSearch =
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      activeCategory === 'All Products' ||
      it.category?.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const filteredClientsList = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone?.includes(clientSearch) ||
    c.code?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - var(--topbar-height) - 2 * var(--gutter))', overflow: 'hidden' }}>

      {/* ── LEFT: Product Catalog & Fast Search ── */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>

        {/* Category Pills + Tier Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', flex: 1 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Price Tier Switcher */}
          <div style={{ display: 'flex', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--outline-variant)', flexShrink: 0 }}>
            {(['retail', 'wholesale', 'trade'] as const).map(tier => (
              <button
                key={tier}
                onClick={() => setPriceTier(tier)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: priceTier === tier ? 'var(--secondary)' : 'transparent',
                  color: priceTier === tier ? '#fff' : 'var(--on-surface-variant)',
                  transition: 'all 0.15s',
                }}
              >
                {tier}
              </button>
            ))}
          </div>

          {/* Held Orders Button Badge */}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              className="btn btn-secondary-outline"
              style={{ height: '34px', fontSize: '12px', padding: '0 10px', background: '#ffedd5', borderColor: '#f97316', color: '#c2410c' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pause_circle</span>
              Held Orders ({heldOrders.length})
            </button>
          )}
        </div>

        {/* Product Grid Card */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.625rem', borderBottom: '1px solid var(--outline-variant)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--on-surface-variant)' }}>search</span>
              <input
                ref={searchInputRef}
                type="text"
                className="form-input"
                placeholder="Scan barcode or search products (F3)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                autoFocus
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: '0.5rem', display: 'block' }}>inventory_2</span>
                <p style={{ fontSize: '14px' }}>No items found in this category.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.625rem' }}>
                {filteredItems.map(item => {
                  const isOut = item.stock_qty <= 0;
                  const isLow = !isOut && item.stock_qty <= (item.min_stock_alert ?? item.min_stock ?? 5);
                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`product-card ${isOut ? 'out-of-stock' : ''}`}
                    >
                      <div className="product-card-image">
                        <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--outline-variant)' }}>format_paint</span>
                        <span className={`product-qty-badge ${isOut ? 'out' : ''}`}>
                          {isOut ? 'Out of Stock' : `Qty: ${item.stock_qty}`}
                        </span>
                      </div>
                      <div className="product-card-body">
                        <div>
                          <div className="product-name">{item.name}</div>
                          <div className="product-sku">{item.unit} | {item.code}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="product-price">Rs {getPrice(item).toLocaleString()}</span>
                          {isLow && <span className="badge badge-low">Low</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Current Bill (POS Terminal) ── */}
      <div style={{ width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>

        {/* Bill Header */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 className="headline-sm">Current Bill</h2>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: selectedClient ? 'var(--secondary)' : 'inherit' }}>
                {selectedClient ? selectedClient.name : walkinName}
              </span>
              {selectedClient && selectedClient.current_balance > 0 && (
                <span style={{ color: 'var(--error)', fontSize: '11px', fontWeight: 600 }}>
                  (Due: Rs. {selectedClient.current_balance.toLocaleString()})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCustomerModal(true)}
            style={{ width: 34, height: 34, border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-container-lowest)', cursor: 'pointer', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Select Customer (F2)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person_search</span>
          </button>
        </div>

        {/* Cart Items Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="data-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-container)', border: 'none' }}>
                <th style={{ padding: '7px 12px' }}>ITEM</th>
                <th style={{ padding: '7px 6px', width: 56, textAlign: 'center' }}>QTY</th>
                <th style={{ padding: '7px 12px', width: 70, textAlign: 'right' }}>PRICE</th>
                <th style={{ padding: '7px 12px', width: 70, textAlign: 'right' }}>TOTAL</th>
                <th style={{ padding: '7px 4px', width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(ci => (
                <tr key={ci.item.id} style={{ borderBottom: '1px solid rgba(198,198,205,0.3)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-background)', lineHeight: 1.3 }}>{ci.item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '1px' }}>{ci.item.code}</div>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min={1}
                      value={ci.qty}
                      onChange={e => updateQty(ci.item.id, parseInt(e.target.value) || 1)}
                      style={{ width: 44, height: 28, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-xs)', outline: 'none', padding: '0 4px' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: 'var(--on-surface-variant)' }}>
                    {ci.price.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {(ci.qty * ci.price).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                    <button
                      onClick={() => removeFromCart(ci.item.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--outline-variant)', padding: 2, borderRadius: 2, display: 'flex', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--outline-variant)')}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                    <span className="material-symbols-outlined" style={{ display: 'block', fontSize: 36, marginBottom: '0.5rem', color: 'var(--outline-variant)' }}>shopping_cart</span>
                    Click products to start sale
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals & Fast Actions */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--outline-variant)', padding: '0.75rem 1rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Summary Math */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--on-surface-variant)' }}>
              <span>Subtotal ({cart.length} items)</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs {subTotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--on-surface-variant)' }}>
              <span>Tax (GST 17%)</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs {taxAmt.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--on-surface-variant)', paddingBottom: '0.5rem', borderBottom: '1px solid var(--outline-variant)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Discount
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--secondary)' }}>edit</span>
              </span>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                style={{ width: '80px', height: '24px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-xs)', outline: 'none', padding: '0 6px', color: 'var(--error)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="headline-sm">Total</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 700, color: 'var(--secondary)' }}>
                Rs {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {PAYMENT_METHODS.map(pm => (
              <button
                key={pm.id}
                onClick={() => setPaymentMethod(pm.id as any)}
                className={`payment-tile ${paymentMethod === pm.id ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined filled" style={{ fontSize: 20 }}>{pm.icon}</span>
                <span className="tile-label">{pm.label}</span>
              </button>
            ))}
          </div>

          {/* Checkout & Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || submitting}
              className="btn btn-primary btn-lg btn-full"
              style={{ opacity: cart.length === 0 || submitting ? 0.5 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>print</span>
              {submitting ? 'Saving & Printing...' : 'Print Receipt [F1]'}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleWhatsAppDispatch}
                disabled={cart.length === 0}
                className="btn btn-secondary-outline btn-full"
                style={{ height: 38, opacity: cart.length === 0 ? 0.5 : 1 }}
                title="Send bill on WhatsApp"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#16a34a' }}>chat</span>
                WhatsApp
              </button>
              <button
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="btn btn-secondary-outline btn-full"
                style={{ height: 38, opacity: cart.length === 0 ? 0.5 : 1 }}
                title="Hold / Park Current Cart"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pause_circle</span>
                Hold Order
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Selection Modal (F2) ── */}
      {showCustomerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
              <h3 className="headline-sm">Select Customer / Client (F2)</h3>
              <button onClick={() => setShowCustomerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--outline-variant)' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by customer name, phone, or code..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '240px' }}>
              <div
                onClick={() => {
                  setSelectedClient(null);
                  setWalkinName('Walk-in Customer');
                  setShowCustomerModal(false);
                }}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid rgba(198,198,205,0.3)',
                  cursor: 'pointer',
                  background: !selectedClient ? 'var(--surface-container)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Walk-in Customer</div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Cash / Direct Sale</div>
              </div>

              {filteredClientsList.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClient(c);
                    setShowCustomerModal(false);
                  }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid rgba(198,198,205,0.3)',
                    cursor: 'pointer',
                    background: selectedClient?.id === c.id ? 'var(--surface-container)' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                      {c.code} {c.phone && `• ${c.phone}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: c.current_balance > 0 ? 'var(--error)' : '#065f46' }}>
                      Bal: Rs. {c.current_balance?.toLocaleString() || 0}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--on-surface-variant)' }}>
                      Limit: Rs. {c.credit_limit?.toLocaleString() || 50000}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Form */}
            <form onSubmit={handleCreateQuickClient} style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--on-surface-variant)' }}>+ Quick Add New Customer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Customer Name"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  style={{ height: '32px', fontSize: '12px' }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mobile (0300-1234567)"
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                  style={{ height: '32px', fontSize: '12px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>
                Save &amp; Select
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Held Orders Modal ── */}
      {showHeldModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="headline-sm">Parked / Held Orders</h3>
              <button onClick={() => setShowHeldModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '300px', overflowY: 'auto' }}>
              {heldOrders.map(order => (
                <div
                  key={order.id}
                  style={{ padding: '0.875rem 1rem', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{order.customerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                      {order.cart.length} items • Held at {order.time}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-mono font-bold" style={{ color: 'var(--secondary)' }}>
                      Rs. {order.total.toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleRecallOrder(order)}
                      className="btn btn-primary btn-sm"
                    >
                      Recall
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}