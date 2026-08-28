'use client';

import React, { useState, useEffect } from 'react';
import { Item, Supplier } from '@/types';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Printer,
  Save,
  XCircle,
  Calendar,
  CheckCircle2,
  Building2,
  Barcode,
  FileText,
  RotateCcw,
  FileCheck,
  User,
  Receipt,
  ArrowRight,
  ArrowLeft,
  X,
  CreditCard,
  Wifi,
  Bell,
} from 'lucide-react';

interface PurchasesViewProps {
  tenantId?: string;
  tenantName?: string;
  staffName?: string;
  items?: Item[];
  onStockUpdated?: () => void;
  pendingOrdersCount?: number;
  onNavigateToOrders?: () => void;
}

interface PurchaseLineItem {
  id: string;
  itemId?: string;
  code: string;
  productName: string;
  shadeCode: string;
  shadeColorHex: string;
  packSize: string;
  qty: number;
  unit: string;
  rate: number;
  stdDiscPercent: number;
  taxPercent: number;
}

interface SavedPurchaseRecord {
  id: string;
  recordNo: string;
  invoiceNo: string;
  date: string;
  supplierName: string;
  company: string;
  poNo: string;
  godown: string;
  itemsCount: number;
  totalAmount: number;
  type: 'purchase' | 'return';
}

const SHADE_COLOR_MAP: Record<string, string> = {
  'Off-White 101': '#FAF9F6',
  'Desert Sand 804': '#E6D7B9',
  'Pure White Undercoat': '#FFFFFF',
  'Ocean Blue 08-204': '#0284C7',
  'Forest Green 12-401': '#15803D',
  'Signal Red 04-102': '#DC2626',
  'Charcoal Black 01-900': '#1E293B',
  'Warm Cream 03-108': '#FEF3C7',
  'Standard Off-White': '#F8FAFC',
};



export default function PurchasesView({
  tenantId,
  tenantName = 'Karachi Branch',
  staffName = 'Purchase Officer',
  items: liveCatalogItems = [],
  onStockUpdated,
  pendingOrdersCount = 0,
  onNavigateToOrders,
}: PurchasesViewProps) {
  // Mode toggle: Purchase Invoice vs Purchase Return
  const [purchaseType, setPurchaseType] = useState<'purchase' | 'return'>('purchase');

  // Record & Meta
  const [recordNo, setRecordNo] = useState<string>('01');
  const [purchaseInvNo, setPurchaseInvNo] = useState<string>(
    () => `P-INV-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>(() => `PO-${Math.floor(1000 + Math.random() * 9000)}`);
  const [selectedGodown, setSelectedGodown] = useState<string>('SHOP - Main Retail Floor');

  // Supplier state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierQuery, setSupplierQuery] = useState<string>('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState<boolean>(false);

  // Line items (starts completely clean/empty)
  const [items, setItems] = useState<PurchaseLineItem[]>([]);

  // Product entry row state
  const [productQuery, setProductQuery] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputUnit, setInputUnit] = useState<string>('Gallon');
  const [inputRate, setInputRate] = useState<number>(0);
  const [inputStdDisc, setInputStdDisc] = useState<number>(0);
  const [inputTax, setInputTax] = useState<number>(0);
  const [selectedProduct, setSelectedProduct] = useState<Item | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);

  // Financial calculations state
  const [additionalDiscount, setAdditionalDiscount] = useState<number>(0);
  const [cartageFreight, setCartageFreight] = useState<number>(0);
  const [salesTaxAmount, setSalesTaxAmount] = useState<number>(0);

  // Payment Breakdown
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'credit' | 'cash' | 'bank'>('credit');

  // Modals & Feedback
  const [notification, setNotification] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [showFindModal, setShowFindModal] = useState<boolean>(false);
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PurchaseLineItem | null>(null);

  const showFeedback = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch real suppliers from DB if available
  useEffect(() => {
    if (!tenantId) return;
    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`/api/suppliers?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success && data.suppliers?.length > 0) {
          setSuppliers(data.suppliers);
          // Do not pre-select supplier by default
          setSelectedSupplier(null);
          setSupplierQuery('');
        } else {
          setSuppliers([]);
          setSelectedSupplier(null);
          setSupplierQuery('');
        }
      } catch (err) {
        console.error('Failed to load suppliers', err);
      }
    };
    fetchSuppliers();
  }, [tenantId]);

  // Mathematical Calculations
  const grossSubtotal = items.reduce((sum, item) => sum + item.rate * item.qty, 0);

  const totalStdDiscount = items.reduce((sum, item) => {
    const gross = item.rate * item.qty;
    return sum + (gross * (item.stdDiscPercent || 0)) / 100;
  }, 0);

  const taxableValue = Math.max(0, grossSubtotal - totalStdDiscount);

  const computedItemTaxes = items.reduce((sum, item) => {
    const gross = item.rate * item.qty;
    const discounted = gross - (gross * (item.stdDiscPercent || 0)) / 100;
    return sum + (discounted * item.taxPercent) / 100;
  }, 0);

  const effectiveSalesTax = salesTaxAmount > 0 ? salesTaxAmount : computedItemTaxes;

  const netBillValue = Math.max(
    0,
    taxableValue + effectiveSalesTax - additionalDiscount + cartageFreight
  );

  const currentSupplierBalance = selectedSupplier ? Number(selectedSupplier.current_balance || selectedSupplier.currentBalance || 0) : 0;
  const lastPayment = selectedSupplier?.last_payment_amount ? Number(selectedSupplier.last_payment_amount) : 0;
  const lastPaymentDateStr = selectedSupplier?.last_payment_date || '—';

  const projectedBalance =
    purchaseType === 'purchase'
      ? currentSupplierBalance + netBillValue - paidAmount
      : Math.max(0, currentSupplierBalance - netBillValue);

  // Handler: Add Item
  const handleAddItem = () => {
    const prod = selectedProduct || liveCatalogItems[0];
    const shade = prod?.shade_code || 'Off-White 101';
    const shadeHex = SHADE_COLOR_MAP[shade] || '#FAF9F6';

    const newItem: PurchaseLineItem = {
      id: `pli-${Date.now()}`,
      itemId: prod?.id,
      code: prod?.code || 'EM-INT-102',
      productName: prod?.name || productQuery || 'Super Matt Plastic Emulsion (Base A)',
      shadeCode: shade,
      shadeColorHex: shadeHex,
      packSize: prod?.pack_size || prod?.unit || '4L Gallon',
      qty: Math.max(1, inputQty),
      unit: inputUnit || prod?.unit || 'Gallon',
      rate: inputRate > 0 ? inputRate : (prod?.cost_price || 2950),
      stdDiscPercent: Math.max(0, Math.min(100, inputStdDisc || 0)),
      taxPercent: inputTax,
    };

    setItems((prev) => [...prev, newItem]);
    setProductQuery('');
    setSelectedProduct(null);
    setInputQty(1);
    setInputStdDisc(0);
    setInputTax(0);
    setShowProductDropdown(false);
    showFeedback(`Added ${newItem.productName} to purchase.`);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleUpdateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(id);
      return;
    }
    setItems(items.map((i) => (i.id === id ? { ...i, qty: newQty } : i)));
  };

  const handleUpdateDisc = (id: string, newDisc: number) => {
    const clampedDisc = Math.max(0, Math.min(100, newDisc));
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, stdDiscPercent: clampedDisc } : i)));
  };

  const handleNewPurchase = () => {
    const nextRecord = (parseInt(recordNo, 10) + 1).toString();
    setRecordNo(nextRecord);
    setPurchaseInvNo(`P-INV-${1080 + parseInt(nextRecord, 10)}`);
    setItems([]);
    setAdditionalDiscount(0);
    setCartageFreight(0);
    setSalesTaxAmount(0);
    setPaidAmount(0);
    showFeedback(`Initiated new Purchase Record #${nextRecord}`);
  };

  const handleSavePurchase = async () => {
    if (items.length === 0) {
      showFeedback('Cannot save empty purchase invoice. Please add items.');
      return;
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          purchase_no: purchaseInvNo,
          purchase_type: purchaseType,
          supplier_id: selectedSupplier?.id || null,
          supplier_name: selectedSupplier?.name || supplierQuery || 'Supplier',
          date: invoiceDate,
          subtotal: grossSubtotal,
          discount: totalStdDiscount + additionalDiscount,
          net_total: netBillValue,
          paid_amount: paidAmount,
          due_amount: Math.max(0, netBillValue - paidAmount),
          payment_type: paymentMode,
          created_by: staffName,
          items: items,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showFeedback(
          `✅ ${purchaseType === 'purchase' ? 'Purchase Invoice' : 'Purchase Return'} #${purchaseInvNo} saved to database & stock updated!`
        );
        if (onStockUpdated) onStockUpdated();
        handleNewPurchase();
      } else {
        showFeedback(`❌ Error: ${data.error || 'Failed to save'}`);
      }
    } catch (err: any) {
      showFeedback(`❌ Network error: ${err.message}`);
    }
  };

  const handleSaveAndPrint = async () => {
    if (items.length === 0) {
      showFeedback('Cannot print empty invoice.');
      return;
    }
    await handleSavePurchase();
    setShowVoucherModal(true);
  };

  const handleCancelPurchase = () => {
    setItems([]);
    setAdditionalDiscount(0);
    setCartageFreight(0);
    setSalesTaxAmount(0);
    setPaidAmount(0);
    showFeedback('Purchase draft cleared.');
  };

  const handleSelectSupplier = (sup: any) => {
    setSelectedSupplier(sup);
    setSupplierQuery(sup.name);
    setShowSupplierDropdown(false);
    showFeedback(`Selected supplier: ${sup.name}`);
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierQuery.toLowerCase()) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(supplierQuery.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(supplierQuery.toLowerCase()))
  );

  const filteredProducts = liveCatalogItems.filter((p) => {
    if (!productQuery) return false;
    const q = productQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.shade_code && p.shade_code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#F1F5F9', color: '#0F172A', userSelect: 'none', position: 'relative', overflow: 'hidden' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 50, background: '#0F172A', color: '#FFFFFF', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: '#F97316' }} />
          {notification}
        </div>
      )}

      {/* ── Top Bar (Clean Title & Branch Identity — No shortcut pills) ── */}
      <header style={{ height: '56px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 }}>
        {/* Left: Purchase Officer Register Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{ width: '32px', height: '32px', background: '#F1F5F9', color: '#334155', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #CBD5E1' }}
            title="Register: P-01"
          >
            P-01
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
              {staffName}
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>
              Register: P-01
            </span>
          </div>
        </div>

        {/* Right: Online Status & Bell */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '3px 9px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
            <Wifi style={{ width: 12, height: 12 }} />
            Online
          </span>
          <button
            type="button"
            onClick={onNavigateToOrders}
            style={{ padding: '7px', color: '#64748B', background: 'transparent', border: 'none', borderRadius: '8px', position: 'relative', cursor: onNavigateToOrders ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={pendingOrdersCount > 0 ? `${pendingOrdersCount} pending incoming order${pendingOrdersCount > 1 ? 's' : ''}` : 'Notifications'}
          >
            <Bell style={{ width: 16, height: 16 }} />
            {pendingOrdersCount > 0 && (
              <span style={{ width: '8px', height: '8px', background: '#F97316', borderRadius: '50%', position: 'absolute', top: '5px', right: '5px' }} />
            )}
          </button>
        </div>
      </header>

      {/* Main Purchases Workspace Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', overflowY: 'auto', gap: '0.875rem' }} className="pos-workspace-scroll">
        
        {/* Top Row: Segmented Mode Toggle (Purchase Invoice vs Purchase Return) + Record Meta Bar (No Hold button) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          {/* Purchase Invoice / Purchase Return Toggle */}
          <div style={{ display: 'inline-flex', padding: '3px', background: '#F1F5F9', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setPurchaseType('purchase')}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: purchaseType === 'purchase' ? '#F97316' : 'transparent',
                color: purchaseType === 'purchase' ? '#FFFFFF' : '#475569',
                boxShadow: purchaseType === 'purchase' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText style={{ width: 14, height: 14 }} />
              Purchase Invoice
            </button>
            <button
              type="button"
              onClick={() => setPurchaseType('return')}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: purchaseType === 'return' ? '#F97316' : 'transparent',
                color: purchaseType === 'return' ? '#FFFFFF' : '#475569',
                boxShadow: purchaseType === 'return' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              Purchase Return
            </button>
          </div>

          {/* Meta Bar: Record No, Inv #, Date (Hold F8 removed) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '5px 10px' }}>
              <span style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginRight: '6px' }}>
                RECORD #:
              </span>
              <input
                type="text"
                value={recordNo}
                onChange={(e) => setRecordNo(e.target.value)}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none', outline: 'none', width: '40px', textAlign: 'center' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '5px 10px' }}>
              <span style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginRight: '6px' }}>
                {purchaseType === 'purchase' ? 'P. INV #:' : 'P. RET #:'}
              </span>
              <input
                type="text"
                value={purchaseInvNo}
                onChange={(e) => setPurchaseInvNo(e.target.value)}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none', outline: 'none', width: '95px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '5px 10px', gap: '6px' }}>
              <Calendar style={{ width: 14, height: 14, color: '#94A3B8' }} />
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#334155', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Section 1 & 2: Supplier Account and Ledger & Credit Terms */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.875rem' }}>
          {/* 1. Supplier Account Search */}
          <div style={{ background: '#FFFFFF', padding: '0.875rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 style={{ width: 14, height: 14, color: '#F97316' }} />
                Supplier Account
              </label>
              {selectedSupplier?.code && (
                <span style={{ fontSize: '9.5px', fontFamily: 'JetBrains Mono, monospace', color: '#0369A1', background: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', border: '1px solid #BAE6FD', fontWeight: 600 }}>
                  {selectedSupplier.code}
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                placeholder="Search supplier name, phone, or city..."
                style={{ width: '100%', fontSize: '12.5px', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px 32px 8px 10px', color: '#0F172A', fontWeight: 600, borderRadius: '8px', outline: 'none' }}
              />
              <Search style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />

              {/* Dropdown Suggestions */}
              {showSupplierDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 30, maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredSuppliers.map((sup) => (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => handleSelectSupplier(sup)}
                      style={{ width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{sup.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>{sup.city || sup.address || '—'} · {sup.phone || 'No phone'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                          Rs. {Number(sup.current_balance || sup.currentBalance || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>Payable Balance</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Supplier Ledger & Terms */}
          <div style={{ background: '#FFFFFF', padding: '0.875rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User style={{ width: 14, height: 14, color: '#F97316' }} />
                Ledger &amp; Contact Info
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                {selectedSupplier?.name ? 'Registered Supplier' : 'No Supplier Selected'}
              </span>
            </div>
            
            {/* 4-Column Balanced Grid: Cur. Balance, Last Payment, Phone Contact, City / Location */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
              {/* Cur. Balance */}
              <div>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>Payable Balance</div>
                <div style={{ fontWeight: 800, color: currentSupplierBalance > 0 ? '#DC2626' : '#0F172A', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                  Rs. {Number(currentSupplierBalance).toLocaleString()}
                </div>
              </div>

              {/* Last Payment */}
              <div>
                <div style={{ fontSize: '9.5px', color: '#16A34A', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>Last Payment</div>
                <div style={{ fontWeight: 800, color: lastPayment > 0 ? '#16A34A' : '#64748B', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                  {lastPayment > 0 ? `Rs. ${Number(lastPayment).toLocaleString()}` : '—'}
                </div>
                {lastPaymentDateStr !== '—' && (
                  <div style={{ fontSize: '9px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                    {lastPaymentDateStr}
                  </div>
                )}
              </div>

              {/* Phone Contact */}
              <div>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>Phone Contact</div>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '12px', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSupplier?.phone || '—'}
                </div>
              </div>

              {/* City / Address */}
              <div>
                <div style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>City / Address</div>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSupplier?.city || selectedSupplier?.address || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Product Entry Row */}
        <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          {/* Product Search Bar */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setShowProductDropdown(true);
              }}
              onFocus={() => setShowProductDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddItem();
              }}
              placeholder="Search product by name, code, barcode or shade... (F3)"
              style={{ width: '100%', fontSize: '12.5px', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px 36px 8px 34px', color: '#0F172A', fontWeight: 500, borderRadius: '8px', outline: 'none' }}
            />
            <Barcode style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />

            {/* Product Dropdown Results */}
            {showProductDropdown && filteredProducts.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 30, maxHeight: '220px', overflowY: 'auto' }}>
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setProductQuery(p.name);
                      setInputRate(p.cost_price || p.retail_price * 0.85);
                      setInputUnit(p.unit);
                      setShowProductDropdown(false);
                    }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                        {p.code} · {p.shade_code || 'Standard'} · {p.pack_size || p.unit}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                        Rs. {(p.cost_price || p.retail_price * 0.85).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                        Stock: {p.stock_qty || 0} {p.unit}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Qty Field */}
          <div style={{ width: '90px', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 8px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
              QTY:
            </span>
            <input
              type="number"
              min={1}
              value={inputQty}
              onChange={(e) => setInputQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', textAlign: 'center', border: 'none', outline: 'none' }}
            />
          </div>

          {/* Disc % Field */}
          <div style={{ width: '90px', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 8px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
              DISC %:
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={inputStdDisc || ''}
              placeholder="0"
              onChange={(e) => setInputStdDisc(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', textAlign: 'center', border: 'none', outline: 'none' }}
            />
          </div>

          {/* Add Item Button */}
          <button
            type="button"
            onClick={handleAddItem}
            style={{ padding: '8px 16px', background: '#F97316', color: '#FFFFFF', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Add Item (F4)
          </button>
        </div>

        {/* Section 4: Line Items Table */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', fontSize: '10px' }}>
                <tr>
                  <th style={{ padding: '10px 8px', fontWeight: 700, width: '28px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>Code</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Product</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>Shade</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>Pack / Unit</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>Qty</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>Unit</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Rate</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', width: '85px' }}>Disc %</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', width: '50px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                      No purchased items in current invoice. Search product above to add.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const lineGross = item.rate * item.qty;
                    const lineDisc = (lineGross * (item.stdDiscPercent || 0)) / 100;
                    const lineNet = lineGross - lineDisc;

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                          {item.code}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: '#0F172A' }}>
                          {item.productName}
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1px solid #CBD5E1', background: item.shadeColorHex, display: 'inline-block' }} />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155' }}>
                              {item.shadeCode}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {item.packSize}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#FFFFFF' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                              style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', fontWeight: 700 }}
                            >
                              -
                            </button>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, padding: '0 6px', color: '#0F172A' }}>
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                              style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', fontWeight: 700 }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {item.unit}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                          {item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '2px 6px', width: '70px' }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={item.stdDiscPercent !== undefined ? item.stdDiscPercent : 0}
                              onChange={(e) => handleUpdateDisc(item.id, parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', textAlign: 'right', border: 'none', outline: 'none' }}
                            />
                            <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '2px', fontFamily: 'JetBrains Mono, monospace' }}>%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {lineNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            style={{ padding: '4px', color: '#DC2626', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px' }}
                            title="Delete Line Item"
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Action & Checkout Bar (Line items count & units count REMOVED) */}
        <div style={{ background: '#FFFFFF', padding: '0.875rem 1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: 'auto' }}>
          {/* Gross Subtotal Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
            <span style={{ color: '#64748B' }}>Gross Subtotal:</span>
            <span style={{ fontWeight: 800, color: '#0F172A' }}>
              Rs. {grossSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Action Buttons: Clear Draft & Checkout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCancelPurchase}
              style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 600, color: '#475569', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}
            >
              Clear Draft
            </button>

            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              style={{
                padding: '9px 20px',
                background: '#F97316',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '12.5px',
                borderRadius: '10px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(249, 115, 22, 0.25)',
              }}
            >
              <Receipt style={{ width: 16, height: 16 }} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>CHECKOUT</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '6px' }}>
                Rs. {netBillValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </span>
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Purchase Settlement & Summary Drawer Modal (Exact 100% Matching Design) ── */}
      {showCheckoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setShowCheckoutModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#FFFFFF',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid #CBD5E1',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header matching screenshot */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #E2E8F0',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#FFEDD5',
                    color: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #FED7AA',
                  }}
                >
                  <Receipt style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Purchase Settlement &amp; Summary
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                    Rec #{recordNo} · {purchaseInvNo}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                flex: 1,
                overflowY: 'auto',
              }}
            >
              {/* Card 1: SUPPLIER ACCOUNT */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>
                    SUPPLIER ACCOUNT
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                    {selectedSupplier?.name || 'IMRAN BHAI / SHAH ZAIN PAINT'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700 }}>
                    CREDIT LIMIT
                  </div>
                  <div style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', marginTop: '3px' }}>
                    Rs. {Number(selectedSupplier?.creditLimit || selectedSupplier?.credit_limit || 2500000).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Card 2: CALCULATION BREAKDOWN */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '9px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, letterSpacing: '0.05em' }}>
                  CALCULATION BREAKDOWN
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                  <span>Sub Total ({items.length} items)</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                    Rs. {grossSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>



                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0F172A',
                    borderTop: '1px solid #F1F5F9',
                    paddingTop: '8px',
                  }}
                >
                  <span>Taxable Value</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                    Rs. {taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* (+) Sales Tax */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                  <span style={{ fontSize: '13px', color: '#475569' }}>(+) Sales Tax</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      width: '130px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', marginRight: '6px' }}>Rs.</span>
                    <input
                      type="number"
                      value={salesTaxAmount || computedItemTaxes}
                      onChange={(e) => setSalesTaxAmount(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        fontSize: '13px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: '#0F172A',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                </div>

                {/* (-) Additional Disc */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#475569' }}>(-) Additional Disc</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      width: '130px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', marginRight: '6px' }}>Rs.</span>
                    <input
                      type="number"
                      value={additionalDiscount}
                      onChange={(e) => setAdditionalDiscount(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        fontSize: '13px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: '#0F172A',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                </div>

                {/* (+) Cartage / Freight */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#475569' }}>(+) Cartage / Freight</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      width: '130px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', marginRight: '6px' }}>Rs.</span>
                    <input
                      type="number"
                      value={cartageFreight}
                      onChange={(e) => setCartageFreight(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        fontSize: '13px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: '#0F172A',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                </div>

                {/* NET BILL VALUE */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderTop: '2px solid #F1F5F9',
                    paddingTop: '10px',
                    marginTop: '4px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.04em' }}>
                    NET BILL VALUE
                  </span>
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 900,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#F97316',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Rs. {netBillValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Card 3: SUPPLIER SETTLEMENT & TERMS */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard style={{ width: 14, height: 14, color: '#F97316' }} />
                  <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, letterSpacing: '0.05em' }}>
                    SUPPLIER SETTLEMENT &amp; TERMS
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      PAYMENT MODE
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#F8FAFC',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#0F172A',
                        outline: 'none',
                      }}
                    >
                      <option value="credit">On Account (Credit)</option>
                      <option value="cash">Cash Paid</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      PAID NOW
                    </label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: '#F8FAFC',
                        fontSize: '13px',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#0F172A',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Balance Rows */}
                <div style={{ paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Previous Balance:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#0F172A' }}>
                      Rs. {Number(currentSupplierBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '4px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>New Projected Balance:</span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 800,
                        color: '#0F172A',
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                      }}
                    >
                      Rs. {projectedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Fixed Footer Action Area (Exact Button Layout from Screenshot) ── */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderTop: '1px solid #E2E8F0',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              {/* Primary Action: SAVE & PRINT (F5) */}
              <button
                type="button"
                onClick={() => {
                  setShowCheckoutModal(false);
                  handleSaveAndPrint();
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  boxShadow: '0 2px 4px rgba(249, 115, 22, 0.25)',
                }}
              >
                <Printer style={{ width: 16, height: 16 }} />
                SAVE &amp; PRINT (F5)
              </button>

              {/* Row 2 (3 Columns): New (F1), Save (F2), Find (F6) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    handleNewPurchase();
                  }}
                  style={{
                    padding: '8px 4px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} />
                  New (F1)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    handleSavePurchase();
                  }}
                  style={{
                    padding: '8px 4px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <Save style={{ width: 13, height: 13 }} />
                  Save (F2)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setShowFindModal(true);
                  }}
                  style={{
                    padding: '8px 4px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <Search style={{ width: 13, height: 13 }} />
                  Find (F6)
                </button>
              </div>

              {/* Row 3 (2 Columns): Voucher (F7), Cancel (F9) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    setShowVoucherModal(true);
                  }}
                  style={{
                    padding: '8px 4px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <FileCheck style={{ width: 14, height: 14 }} />
                  Voucher (F7)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutModal(false);
                    handleCancelPurchase();
                  }}
                  style={{
                    padding: '8px 4px',
                    background: '#FFFFFF',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#DC2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle style={{ width: 14, height: 14 }} />
                  Cancel (F9)
                </button>
              </div>

              {/* Back to Editing Line Items Link */}
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '4px',
                  marginTop: '2px',
                }}
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
                Back to Editing Line Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Voucher Print Preview Modal ── */}
      {showVoucherModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2000 }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', maxWidth: '560px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', background: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck style={{ width: 18, height: 18, color: '#F97316' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 800 }}>Goods Receipt / Purchase Voucher</h3>
              </div>
              <button
                onClick={() => setShowVoucherModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Voucher / Record No:</span>
                  <span style={{ fontWeight: 800, color: '#0F172A' }}>#{recordNo} ({purchaseInvNo})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Supplier:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedSupplier?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Date:</span>
                  <span>{invoiceDate}</span>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{i.productName}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>{i.qty} {i.unit}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>Rs. {i.rate.toLocaleString()}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Rs. {(i.rate * i.qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '14px', fontFamily: 'JetBrains Mono, monospace' }}>
                <span>Net Voucher Value:</span>
                <span style={{ color: '#F97316' }}>Rs. {netBillValue.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowVoucherModal(false)}
                style={{ padding: '7px 14px', background: '#E2E8F0', color: '#0F172A', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                  setShowVoucherModal(false);
                }}
                style={{ padding: '7px 16px', background: '#F97316', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer style={{ width: 14, height: 14 }} />
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
