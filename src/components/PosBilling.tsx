'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Item, Client } from '@/types';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Printer,
  Save,
  PauseCircle,
  XCircle,
  Calendar,
  Layers,
  CheckCircle2,
  User,
  Barcode,
  History,
  Tag,
  Bell,
  Ticket,
  Coins,
} from 'lucide-react';
import TokenRedemption from './TokenRedemption';

interface Props {
  items: Item[];
  tenantId: string;
  shiftId?: string;
  onCompleteSale: (invoice: any) => void;
  staffName: string;
  tenantName?: string;
  restoringHeldOrder?: any;
  onClearRestoringHeldOrder?: () => void;
  editingInvoice?: any;
  onClearEditingInvoice?: () => void;
  pendingOrdersCount?: number;
  onNavigateToOrders?: () => void;
}

export interface ProductLastPurchase {
  lastPrice: number;
  lastDate: string;
  invoiceNo: string;
  qty: number;
  unit: string;
  shadeCode?: string;
}

export interface InvoiceLineItem {
  id: string;
  item?: Item;
  code: string;
  originalCode?: string;
  productName: string;
  originalName?: string;
  brand?: string;
  category?: string;
  shadeCode: string;
  originalShade?: string;
  shadeColorHex: string;
  packSize: string;
  qty: number;
  unit: string;
  rate: number;
  originalRate?: number;
  discountPercent: number;
  hasToken?: boolean;
  tokenValue?: number;
  tokenAction?: 'keep' | 'remove';
  tokenReturnedWithBucket?: boolean;
}

interface HeldOrder {
  id: string;
  dbId?: string;
  hold_no: string;
  customerName: string;
  selectedClient: Client | null;
  items: InvoiceLineItem[];
  invoiceType: 'sales' | 'return';
  time: string;
  total: number;
}


const SHORTCUTS = [
  { key: 'F2', label: 'Save' },
  { key: 'F3', label: 'Search' },
  { key: 'F4', label: 'Add Item' },
  { key: 'F5', label: 'Save & Print' },
  { key: 'F7', label: 'Hold' },
  { key: 'F8', label: 'Hold List' },
  { key: 'F9', label: 'Cancel' },
];

export default function PosBilling({
  items: liveItems,
  tenantId,
  shiftId,
  onCompleteSale,
  staffName,
  tenantName = 'Main Godown & Retail Counter #1',
  restoringHeldOrder,
  onClearRestoringHeldOrder,
  editingInvoice,
  onClearEditingInvoice,
  pendingOrdersCount = 0,
  onNavigateToOrders,
}: Props) {
  // Mode toggle: Sales Invoice vs Return
  const [invoiceType, setInvoiceType] = useState<'sales' | 'return'>('sales');
  const [invoiceNo, setInvoiceNo] = useState<string>(
    () => `INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  // Customer & details
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('Walk-in Customer');
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Customer History Real Data State
  const [clientHistory, setClientHistory] = useState<{ lastPurchase: string; totalSales: string }>({
    lastPurchase: '—',
    totalSales: '—',
  });

  // Client Product Last Purchase Lookup Map (key = itemId / code / name)
  const [clientProductHistory, setClientProductHistory] = useState<Record<string, ProductLastPurchase>>({});
  // Pending confirmation modal when customer previously purchased the item
  const [pendingRateConfirm, setPendingRateConfirm] = useState<{
    product: Item;
    lastPurchase: ProductLastPurchase;
  } | null>(null);

  // Keyboard navigation active indexes
  const [activeProductIndex, setActiveProductIndex] = useState<number>(0);
  const [activeClientIndex, setActiveClientIndex] = useState<number>(0);

  // Cart / Line items
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // Product search & Add row state
  const [productQuery, setProductQuery] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [selectedProduct, setSelectedProduct] = useState<Item | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);

  // Financial adjustments
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);

  // Payment Breakdown & Cash edit tracking
  const [cashPayment, setCashPayment] = useState<number>(0);
  const [isCashManuallyEdited, setIsCashManuallyEdited] = useState<boolean>(false);
  const [cardPayment, setCardPayment] = useState<number>(0);
  const [bankPayment, setBankPayment] = useState<number>(0);
  const [othersPayment, setOthersPayment] = useState<number>(0);
  const [appliedTokenAmount, setAppliedTokenAmount] = useState<number>(0);

  // Persistent Held Orders State
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldModal, setShowHeldModal] = useState<boolean>(false);

  // Submission & Feedback State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [printReceiptData, setPrintReceiptData] = useState<any | null>(null);
  const [showTokenRedemptionModal, setShowTokenRedemptionModal] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevLineItemsCountRef = useRef<number>(0);

  // Toggle Keep vs Remove Token for a line item
  const handleToggleTokenAction = (lineItemId: string, action: 'keep' | 'remove') => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== lineItemId) return li;
        const baseRate = li.originalRate ?? li.rate;
        const tokenVal = li.tokenValue || 0;
        const adjustedRate = action === 'remove' ? Math.max(0, baseRate - tokenVal) : baseRate;
        return {
          ...li,
          tokenAction: action,
          rate: adjustedRate,
        };
      })
    );
    setIsCashManuallyEdited(false);
  };

  const showFeedback = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // 1. Fetch Clients for this tenant
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

  // Fetch real client invoice history when a client is selected
  useEffect(() => {
    if (!selectedClient || !tenantId) {
      setClientHistory({ lastPurchase: '—', totalSales: '—' });
      setClientProductHistory({});
      return;
    }

    const fetchClientHistory = async () => {
      try {
        const res = await fetch(`/api/invoices?tenant_id=${tenantId}&client_id=${selectedClient.id}&limit=100`);
        const data = await res.json();
        if (data.success && Array.isArray(data.invoices) && data.invoices.length > 0) {
          const invoices = data.invoices;
          const mostRecent = invoices[0];
          let formattedDate = '—';
          if (mostRecent?.date) {
            const parsed = new Date(mostRecent.date);
            formattedDate = isNaN(parsed.getTime())
              ? mostRecent.date
              : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          }

          const completedSales = invoices.filter((inv: any) => inv.status !== 'cancelled');
          const sumSales = completedSales.reduce((acc: number, inv: any) => {
            const net = Number(inv.net_total) || 0;
            return inv.invoice_type === 'return' ? acc - net : acc + net;
          }, 0);

          setClientHistory({
            lastPurchase: formattedDate,
            totalSales: `Rs. ${Math.max(0, sumSales).toLocaleString()}`,
          });

          // Build Product Last Purchase Map for this Client
          const historyMap: Record<string, ProductLastPurchase> = {};
          for (const inv of invoices) {
            if (inv.status === 'cancelled') continue;
            const items = inv.invoice_items || inv.items || [];
            for (const it of items) {
              const record: ProductLastPurchase = {
                lastPrice: Number(it.unit_price ?? it.rate ?? it.price ?? 0),
                lastDate: inv.date || '',
                invoiceNo: inv.invoice_no || '',
                qty: Number(it.qty) || 1,
                unit: it.unit || 'PCS',
                shadeCode: it.shade_code || it.shadeCode || '',
              };
              if (it.item_id && !historyMap[it.item_id]) {
                historyMap[it.item_id] = record;
              }
              if (it.item_code) {
                const codeKey = String(it.item_code).trim().toLowerCase();
                if (!historyMap[codeKey]) historyMap[codeKey] = record;
              }
              if (it.item_name) {
                const nameKey = String(it.item_name).trim().toLowerCase();
                if (!historyMap[nameKey]) historyMap[nameKey] = record;
              }
            }
          }
          setClientProductHistory(historyMap);
        } else {
          setClientHistory({
            lastPurchase: 'No purchases yet',
            totalSales: 'Rs. 0',
          });
          setClientProductHistory({});
        }
      } catch (err) {
        console.error('Failed to fetch client history', err);
        setClientHistory({ lastPurchase: '—', totalSales: '—' });
        setClientProductHistory({});
      }
    };

    fetchClientHistory();
  }, [selectedClient, tenantId]);

  // 2. Fetch Persistent Parked Invoices from Supabase
  useEffect(() => {
    if (!tenantId) return;
    const fetchHeld = async () => {
      try {
        const res = await fetch(`/api/held-invoices?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.held_invoices)) {
          const mapped: HeldOrder[] = data.held_invoices.map((h: any) => ({
            id: h.id,
            dbId: h.id,
            hold_no: h.hold_no,
            customerName: h.client_name || 'Walk-in Customer',
            selectedClient: clients.find((c) => c.id === h.client_id) || null,
            items: h.items_json || [],
            invoiceType: h.invoice_type || 'sales',
            time: new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            total: Number(h.net_total) || 0,
          }));
          setHeldOrders(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch held invoices', err);
      }
    };
    fetchHeld();
  }, [tenantId, clients]);

  // Listen for native print completion or dismissal to cleanly clear print data
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintReceiptData(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Restore Parked Invoice into Cart when dispatched from Hold Invoices screen
  useEffect(() => {
    if (restoringHeldOrder) {
      if (Array.isArray(restoringHeldOrder.items_json)) {
        setLineItems(restoringHeldOrder.items_json);
      } else if (Array.isArray(restoringHeldOrder.items)) {
        setLineItems(restoringHeldOrder.items);
      }
      if (restoringHeldOrder.client_name) {
        setCustomerSearch(restoringHeldOrder.client_name);
      }
      if (restoringHeldOrder.client_id && clients.length > 0) {
        const found = clients.find((c) => c.id === restoringHeldOrder.client_id);
        if (found) setSelectedClient(found);
      }
      if (restoringHeldOrder.invoice_type) {
        setInvoiceType(restoringHeldOrder.invoice_type);
      }
      if (restoringHeldOrder.discount) {
        setInvoiceDiscount(Number(restoringHeldOrder.discount) || 0);
      }
      if (restoringHeldOrder.delivery_charge) {
        setDeliveryCharge(Number(restoringHeldOrder.delivery_charge) || 0);
      }
      if (restoringHeldOrder.remarks) {
        setRemarks(restoringHeldOrder.remarks);
      }
      setIsCashManuallyEdited(false);
      showFeedback(`Restored parked order ${restoringHeldOrder.hold_no || ''}.`);
      onClearRestoringHeldOrder?.();
    }
  }, [restoringHeldOrder, clients]);

  // Load existing invoice into Cart for editing / adding more items
  useEffect(() => {
    if (editingInvoice) {
      const invItems = editingInvoice.invoice_items || editingInvoice.items || [];
      const mappedItems: InvoiceLineItem[] = invItems.map((it: any, idx: number) => ({
        id: it.id || `edit-it-${idx}-${Date.now()}`,
        item: liveItems.find((li) => li.id === it.item_id || li.code === (it.item_code || it.code)),
        code: it.item_code || it.code || '',
        productName: it.item_name || it.productName || it.name || 'Product',
        shadeCode: it.shade_code || it.shadeCode || '—',
        shadeColorHex: '#94A3B8',
        packSize: it.pack_size || it.packSize || 'Can',
        qty: Number(it.qty) || 1,
        unit: it.unit || 'PCS',
        rate: Number(it.unit_price || it.rate || it.price) || 0,
        discountPercent: Number(it.discount_percent || it.discountPercent) || 0,
      }));

      setLineItems(mappedItems);
      setInvoiceNo(editingInvoice.invoice_no);
      if (editingInvoice.date) {
        setInvoiceDate(editingInvoice.date.split('T')[0]);
      }
      if (editingInvoice.client_name) {
        setCustomerSearch(editingInvoice.client_name);
      }
      if (editingInvoice.client_id && clients.length > 0) {
        const found = clients.find((c) => c.id === editingInvoice.client_id);
        if (found) setSelectedClient(found);
      }
      if (editingInvoice.invoice_type) {
        setInvoiceType(editingInvoice.invoice_type);
      }
      setInvoiceDiscount(Number(editingInvoice.discount) || 0);
      setDeliveryCharge(Number(editingInvoice.delivery_charge) || 0);
      setRemarks(editingInvoice.remarks || '');
      setIsCashManuallyEdited(false);
      showFeedback(`Loaded invoice ${editingInvoice.invoice_no} for editing & adding items.`);
    }
  }, [editingInvoice, clients, liveItems]);

  // Calculations
  const itemSubtotal = lineItems.reduce((sum, item) => {
    let effectiveRate = item.rate;
    if (invoiceType === 'return' && item.hasToken && item.tokenReturnedWithBucket === false) {
      effectiveRate = Math.max(0, effectiveRate - (item.tokenValue || 0));
    }
    const lineGross = effectiveRate * item.qty;
    const lineDiscount = (lineGross * item.discountPercent) / 100;
    return sum + (lineGross - lineDiscount);
  }, 0);

  const totalItemDiscount = lineItems.reduce((sum, item) => {
    let effectiveRate = item.rate;
    if (invoiceType === 'return' && item.hasToken && item.tokenReturnedWithBucket === false) {
      effectiveRate = Math.max(0, effectiveRate - (item.tokenValue || 0));
    }
    const lineGross = effectiveRate * item.qty;
    return sum + (lineGross * item.discountPercent) / 100;
  }, 0);

  const netTotal = Math.max(0, itemSubtotal - invoiceDiscount + deliveryCharge);
  const totalPaid = cashPayment + cardPayment + bankPayment + othersPayment + appliedTokenAmount;
  const balanceDue = netTotal - totalPaid;

  // Auto-sync cash payment continuously whenever netTotal changes if not manually edited & no other tenders
  useEffect(() => {
    if (cardPayment === 0 && bankPayment === 0 && othersPayment === 0 && !isCashManuallyEdited) {
      const remainingCash = Math.max(0, netTotal - appliedTokenAmount);
      if (lineItems.length > 0) {
        setCashPayment(remainingCash);
      } else {
        setCashPayment(0);
      }
    }
  }, [netTotal, lineItems.length, isCashManuallyEdited, cardPayment, bankPayment, othersPayment, appliedTokenAmount]);

  // Keep appliedTokenAmount clamped to netTotal if items are removed/discounted
  useEffect(() => {
    if (appliedTokenAmount > netTotal) {
      setAppliedTokenAmount(Math.max(0, netTotal));
      setIsCashManuallyEdited(false);
    }
  }, [netTotal, appliedTokenAmount]);

  // Helper for shade info — always use the product's own shade_code from DB.
  const getShadeInfo = (item: Item) => {
    if (item.shade_code) {
      return { shadeCode: item.shade_code, shadeColorHex: '#94A3B8' };
    }
    return { shadeCode: '—', shadeColorHex: '#94A3B8' };
  };

  // Add Item to table with stock validation and immutable state updates
  const handleAddItem = (specificItem?: Item, overrideRate?: number, skipCheck: boolean = false) => {
    const prod = specificItem || selectedProduct;
    if (!prod) {
      if (filteredCatalog.length === 1) {
        handleAddItem(filteredCatalog[0], overrideRate, skipCheck);
      }
      return;
    }

    // Check if registered customer previously bought this product before adding
    if (selectedClient && !skipCheck && overrideRate === undefined) {
      const prodCodeKey = (prod.code || '').trim().toLowerCase();
      const prodNameKey = (prod.name || '').trim().toLowerCase();
      const lastPurch =
        clientProductHistory[prod.id] ||
        clientProductHistory[prodCodeKey] ||
        clientProductHistory[prodNameKey];

      if (lastPurch && lastPurch.lastPrice > 0) {
        setPendingRateConfirm({ product: prod, lastPurchase: lastPurch });
        setShowProductDropdown(false);
        return;
      }
    }

    const requestedQty = Math.max(1, inputQty);
    const existingIndex = lineItems.findIndex((li) => li.item?.id === prod.id || li.code === prod.code);
    const currentQtyInCart = existingIndex >= 0 ? lineItems[existingIndex].qty : 0;
    const totalQtyRequested = currentQtyInCart + requestedQty;

    // Stock validation for normal sales
    if (invoiceType === 'sales') {
      const availableStock = prod.stock_qty ?? 0;
      if (totalQtyRequested > availableStock) {
        showFeedback(`Insufficient stock! Available: ${availableStock} ${prod.unit || 'PCS'}`);
        return;
      }
    }

    const { shadeCode, shadeColorHex } = getShadeInfo(prod);
    const hasToken = Boolean(prod.has_token && (Number(prod.token_value) || 0) > 0);
    const tokenVal = hasToken ? Number(prod.token_value) || 0 : 0;
    const itemRate = overrideRate !== undefined ? overrideRate : (prod.retail_price || 0);

    if (existingIndex >= 0) {
      setLineItems((prev) =>
        prev.map((li, idx) =>
          idx === existingIndex
            ? { ...li, qty: li.qty + requestedQty, rate: overrideRate !== undefined ? overrideRate : li.rate }
            : li
        )
      );
    } else {
      const newLineItem: InvoiceLineItem = {
        id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        item: prod,
        code: prod.code,
        originalCode: prod.code,
        productName: prod.name,
        originalName: prod.name,
        brand: prod.brand,
        category: prod.category,
        shadeCode,
        originalShade: shadeCode,
        shadeColorHex,
        packSize: prod.pack_size || prod.unit || 'Can',
        qty: requestedQty,
        unit: prod.unit || 'PCS',
        rate: itemRate,
        originalRate: itemRate,
        discountPercent: 0,
        hasToken,
        tokenValue: tokenVal,
        tokenAction: 'keep',
      };
      setLineItems((prev) => [...prev, newLineItem]);
    }

    setProductQuery('');
    setSelectedProduct(null);
    setInputQty(1);
    setShowProductDropdown(false);
  };

  const handleRemoveItem = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(id);
      return;
    }

    const targetItem = lineItems.find((i) => i.id === id);
    if (!targetItem) return;

    if (invoiceType === 'sales' && newQty > targetItem.qty) {
      const productRecord = liveItems.find(
        (p) => p.id === targetItem.item?.id || p.code === targetItem.code
      ) || targetItem.item;
      const availableStock = productRecord?.stock_qty ?? 0;
      if (newQty > availableStock) {
        showFeedback(`Cannot exceed available stock (${availableStock} ${targetItem.unit})`);
        return;
      }
    }

    setLineItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: newQty } : i)));
  };

  // Persistent Hold / Park Cart Mechanism
  const handleHoldInvoice = async () => {
    if (lineItems.length === 0) {
      showFeedback('Cart is empty. Add products before placing on hold.');
      return;
    }

    const holdNo = `HOLD-${Date.now().toString().slice(-4)}`;
    const customerDisplayName = selectedClient?.name || customerSearch || 'Walk-in Customer';

    try {
      const res = await fetch('/api/held-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          hold_no: holdNo,
          client_id: selectedClient?.id || null,
          client_name: customerDisplayName,
          invoice_type: invoiceType,
          items: lineItems,
          subtotal: itemSubtotal,
          discount: invoiceDiscount,
          delivery_charge: deliveryCharge,
          net_total: netTotal,
          remarks,
        }),
      });

      const data = await res.json();
      const newHeld: HeldOrder = {
        id: data.held_order?.id || holdNo,
        dbId: data.held_order?.id,
        hold_no: holdNo,
        customerName: customerDisplayName,
        selectedClient,
        items: lineItems,
        invoiceType,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        total: netTotal,
      };

      setHeldOrders((prev) => [newHeld, ...prev]);
      setLineItems([]);
      setCashPayment(0);
      setIsCashManuallyEdited(false);
      setCardPayment(0);
      setBankPayment(0);
      setOthersPayment(0);
      setInvoiceDiscount(0);
      setDeliveryCharge(0);
      setRemarks('');
      showFeedback(`Invoice ${invoiceNo} placed on hold in database.`);
    } catch (err) {
      console.error('Failed to park order in DB', err);
    }
  };

  const handleRestoreHeld = async (order: HeldOrder) => {
    setLineItems(order.items);
    setSelectedClient(order.selectedClient);
    setCustomerSearch(order.customerName);
    setInvoiceType(order.invoiceType);
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
    setIsCashManuallyEdited(false);
    setShowHeldModal(false);

    if (order.dbId) {
      try {
        await fetch(`/api/held-invoices?id=${order.dbId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete held order', err);
      }
    }
    showFeedback(`Restored order for ${order.customerName}.`);
  };

  const handleDeleteHeld = async (order: HeldOrder) => {
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
    if (order.dbId) {
      try {
        await fetch(`/api/held-invoices?id=${order.dbId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete held order', err);
      }
    }
  };

  // Cancel / Clear Cart
  const handleCancelInvoice = () => {
    setLineItems([]);
    setCashPayment(0);
    setIsCashManuallyEdited(false);
    setCardPayment(0);
    setBankPayment(0);
    setOthersPayment(0);
    setInvoiceDiscount(0);
    setDeliveryCharge(0);
    setRemarks('');
    if (editingInvoice) {
      onClearEditingInvoice?.();
      setInvoiceNo(`INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`);
      showFeedback('Exited invoice editing.');
    } else {
      showFeedback('Invoice cleared.');
    }
  };

  // Checkout and Database Persistence
  const handleCheckout = async (openPrint = true) => {
    if (lineItems.length === 0 || submitting) {
      showFeedback('Please add at least one item before checkout.');
      return;
    }
    setSubmitting(true);

    const roundedNetTotal = Math.round(netTotal * 100) / 100;
    const computedTotalPaid = Math.round((cashPayment + cardPayment + bankPayment + othersPayment + appliedTokenAmount) * 100) / 100;
    const rawDue = roundedNetTotal - computedTotalPaid;
    const finalDue = rawDue > 0.01 ? Math.round(rawDue * 100) / 100 : 0;
    const finalPaid = finalDue === 0 ? roundedNetTotal : computedTotalPaid;
    const isCreditSale = finalDue > 0;

    // Hard Stop: Block credit/debt sales for walk-in (no account) customers
    if (!selectedClient && isCreditSale) {
      showFeedback('Cannot sell on credit to a walk-in customer. Please select a registered customer account, or collect full payment before completing this sale.');
      setSubmitting(false);
      return;
    }

    // Hard Stop: Enforce Credit Limit for Client Sales on Credit
    if (selectedClient && invoiceType === 'sales' && isCreditSale) {
      const currentBal = Number(selectedClient.current_balance) || 0;
      const limit = Number(selectedClient.credit_limit) || 0;
      const projectedBalance = currentBal + finalDue;

      if (limit > 0 && projectedBalance > limit) {
        const availableLimit = Math.max(0, limit - currentBal);
        showFeedback(`Insufficient credit limit. Available limit: Rs. ${availableLimit.toLocaleString()}`);
        setSubmitting(false);
        return;
      }
    }

    const customerDisplayName = selectedClient ? selectedClient.name : customerSearch || 'Walk-in Customer';

    // Determine clean payment_type
    let determinedPaymentType = 'cash';
    if (isCreditSale) {
      determinedPaymentType = finalPaid === 0 ? 'credit' : 'credit';
    } else {
      if (appliedTokenAmount > 0 && appliedTokenAmount >= finalPaid) determinedPaymentType = 'tokens';
      else if (cardPayment > 0 && cardPayment >= finalPaid) determinedPaymentType = 'card';
      else if (bankPayment > 0 && bankPayment >= finalPaid) determinedPaymentType = 'bank';
      else if (othersPayment > 0 && othersPayment >= finalPaid) determinedPaymentType = 'others';
      else if (cardPayment > 0 || bankPayment > 0 || othersPayment > 0 || appliedTokenAmount > 0) determinedPaymentType = 'split';
      else determinedPaymentType = 'cash';
    }

    const invoicePayload = {
      tenant_id: tenantId,
      invoice_no: invoiceNo,
      client_id: selectedClient?.id || null,
      client_name: customerDisplayName,
      shift_id: shiftId || null,
      subtotal: itemSubtotal,
      discount: invoiceDiscount,
      delivery_charge: deliveryCharge,
      remarks: remarks || null,
      invoice_type: invoiceType,
      net_total: roundedNetTotal,
      paid_amount: finalPaid,
      due_amount: finalDue,
      payment_type: determinedPaymentType,
      cash_paid: cashPayment,
      card_paid: cardPayment,
      bank_paid: bankPayment,
      others_paid: othersPayment + appliedTokenAmount,
      status: 'completed',
      created_by: staffName || 'Counter Staff',
      items: lineItems.map((ci) => ({
        item_id: ci.item?.id || null,
        item_code: ci.code,
        item_name: ci.productName,
        shade_code: ci.shadeCode,
        pack_size: ci.packSize,
        unit: ci.unit,
        qty: ci.qty,
        unit_price: ci.rate,
        discount: (ci.rate * ci.qty * ci.discountPercent) / 100,
        discount_percent: ci.discountPercent,
        total_price: ci.rate * ci.qty * (1 - ci.discountPercent / 100),
      })),
    };

    try {
      const isEditingExisting = Boolean(editingInvoice?.id);
      const apiEndpoint = '/api/invoices';
      const apiMethod = isEditingExisting ? 'PATCH' : 'POST';
      const payloadToSend = isEditingExisting
        ? { id: editingInvoice.id, ...invoicePayload }
        : invoicePayload;

      const res = await fetch(apiEndpoint, {
        method: apiMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
      });

      const data = await res.json();
      if (data.success) {
        const finalServerInvoiceNo = data.invoice?.invoice_no || invoiceNo;
        const savedInvoiceId = data.invoice?.id;

        // 1. Process Token Transactions for items with tokens
        for (const item of lineItems) {
          if (item.hasToken && (item.tokenValue || 0) > 0) {
            const isRemoved = item.tokenAction === 'remove';
            const tokenType = isRemoved ? 'shop_retained' : 'issued';
            try {
              await fetch('/api/tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: tokenType,
                  tenant_id: tenantId,
                  invoice_id: savedInvoiceId || null,
                  client_id: isRemoved ? null : selectedClient?.id || null,
                  client_name: isRemoved ? null : (selectedClient ? selectedClient.name : customerDisplayName),
                  item_id: item.item?.id || null,
                  item_name: item.productName,
                  brand: item.brand || item.item?.brand || null,
                  category: item.category || item.item?.category || null,
                  token_value: (item.tokenValue || 0) * item.qty,
                  token_count: item.qty,
                  unit_token_value: item.tokenValue || 0,
                  remaining_count: item.qty,
                  shift_id: shiftId || null,
                  notes: isRemoved
                    ? `Token removed at sale (${item.qty}x Rs. ${item.tokenValue})`
                    : `Token issued with purchase (${item.qty}x Rs. ${item.tokenValue})`,
                }),
              });
            } catch (tokErr) {
              console.error('Error logging token transaction:', tokErr);
            }
          }
        }

        // 2. Process Direct Token Payment Tender against Invoice
        if (appliedTokenAmount > 0 && selectedClient) {
          try {
            await fetch('/api/tokens', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'redeemed',
                tenant_id: tenantId,
                invoice_id: savedInvoiceId || null,
                client_id: selectedClient.id,
                client_name: selectedClient.name,
                redeemed_amount: appliedTokenAmount,
                shift_id: shiftId || null,
                notes: `Token balance applied at POS checkout against Invoice #${finalServerInvoiceNo}`,
              }),
            });
            // Update client token balance optimistically
            setSelectedClient((prev: any) =>
              prev ? { ...prev, token_balance: Math.max(0, Number(prev.token_balance || 0) - appliedTokenAmount) } : null
            );
            setAppliedTokenAmount(0);
          } catch (tokPayErr) {
            console.error('Error logging token payment tender:', tokPayErr);
          }
        }

        const completedInvoice = {
          ...data.invoice,
          invoice_no: finalServerInvoiceNo,
          grandTotal: netTotal,
          subTotal: itemSubtotal,
          discount: invoiceDiscount,
          delivery_charge: deliveryCharge,
          paid_amount: finalPaid,
          due_amount: finalDue,
          date: invoiceDate,
          time: new Date().toLocaleTimeString(),
          items: lineItems,
          client_name: customerDisplayName,
          tenantName,
          staffName,
        };

        onCompleteSale(completedInvoice);
        if (openPrint) {
          setPrintReceiptData(completedInvoice);
          showFeedback(isEditingExisting ? `Invoice #${finalServerInvoiceNo} updated & printing...` : `Invoice ${finalServerInvoiceNo} finalized & printing...`);
          // Automatically invoke direct/thermal printing
          setTimeout(() => {
            window.print();
          }, 80);
        } else {
          setPrintReceiptData(null);
          showFeedback(isEditingExisting ? `Invoice #${finalServerInvoiceNo} updated successfully.` : `Invoice ${finalServerInvoiceNo} saved to database.`);
        }

        if (isEditingExisting) {
          onClearEditingInvoice?.();
        }

        // Reset state for next customer
        setLineItems([]);
        setSelectedClient(null);
        setCustomerSearch('Walk-in Customer');
        setCashPayment(0);
        setIsCashManuallyEdited(false);
        setCardPayment(0);
        setBankPayment(0);
        setOthersPayment(0);
        setInvoiceDiscount(0);
        setDeliveryCharge(0);
        setRemarks('');
        setInvoiceNo(`INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`);
      } else {
        alert(`Failed to save invoice: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Network error saving invoice: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products for barcode / search autocomplete
  const filteredCatalog = liveItems.filter((p) => {
    if (!productQuery) return false;
    const q = productQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.shade_code && p.shade_code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  // Keyboard Shortcuts Listener ([F2], [F3], [F4], [F5], [F7], [F8], [F9], [Escape])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleCheckout(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleCheckout(false);
      } else if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (selectedProduct) {
          handleAddItem(selectedProduct);
        } else if (filteredCatalog.length === 1) {
          handleAddItem(filteredCatalog[0]);
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleHoldInvoice();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowHeldModal(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleCancelInvoice();
      } else if (e.key === 'Escape') {
        setShowCustomerModal(false);
        setShowHeldModal(false);
        setShowProductDropdown(false);
        setPrintReceiptData(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lineItems, selectedClient, customerSearch, invoiceDiscount, deliveryCharge, cashPayment, cardPayment, bankPayment, othersPayment, submitting, selectedProduct, filteredCatalog]);

  return (
    <section className="pos-screen">
      {/* Toast Notification */}
      {notification && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 60, background: '#0F172A', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: '#F97316' }} />
          {notification}
        </div>
      )}

      {/* Left Column: TopBar + Main POS Workspace */}
      <div className="pos-main-col">
        {/* TopBar for POS (Matching painterp TopBar.tsx) */}
        <header className="pos-topbar">
          {/* Left: Counter Staff / Active Register Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div
              style={{ width: '28px', height: '28px', background: '#F1F5F9', color: '#334155', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #CBD5E1', flexShrink: 0 }}
              title="Active Register: 01 (Counter Staff)"
            >
              01
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                Counter Staff
              </span>
              <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>
                Active Register: 01
              </span>
            </div>
          </div>

          {/* Center: All Keyboard Shortcuts cleanly displayed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px 0' }} className="no-scrollbar">
            {SHORTCUTS.map((sc) => (
              <div key={sc.key} className="pos-shortcut-chip">
                <strong>{sc.key}</strong>
                <span>{sc.label}</span>
              </div>
            ))}
          </div>

          {/* Right: Notifications & Held Orders */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {heldOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHeldModal(true)}
                style={{ padding: '5px 9px', background: '#F1F5F9', color: '#334155', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                title="View Parked Orders (F8)"
              >
                <PauseCircle style={{ width: 13, height: 13, color: '#F97316' }} />
                <span>Held ({heldOrders.length})</span>
              </button>
            )}

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

        {/* Left Scrollable Work Area */}
        <div className="pos-workspace-body pos-workspace-scroll">
          {/* Editing Invoice Banner */}
          {editingInvoice && (
            <div style={{
              background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
              border: '1px solid #F59E0B',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(245, 158, 11, 0.15)',
              marginBottom: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📝</span>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#92400E' }}>
                    Editing Invoice #{editingInvoice.invoice_no} (Original Total: Rs. {Number(editingInvoice.net_total || 0).toLocaleString()})
                  </div>
                  <div style={{ fontSize: '11px', color: '#B45309' }}>
                    Naye items add karein ya quantities badlein. Checkout par yehi invoice update hogi.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClearEditingInvoice?.();
                  handleCancelInvoice();
                }}
                style={{
                  padding: '5px 10px',
                  background: '#FFFFFF',
                  color: '#92400E',
                  border: '1px solid #F59E0B',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕ Cancel Edit &amp; New Sale
              </button>
            </div>
          )}
          {/* Top Row: Segmented Toggle (Sales Invoice / Return) + Invoice # / Date / Hold Button */}
          <div className="pos-card-box pos-row-between">
            {/* Sales Invoice / Return Toggle */}
            <div className="pos-segment-toggle">
              <button
                type="button"
                onClick={() => setInvoiceType('sales')}
                className={`pos-segment-btn ${invoiceType === 'sales' ? 'active-sales' : ''}`}
              >
                Sales Invoice
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('return')}
                className={`pos-segment-btn ${invoiceType === 'return' ? 'active-return' : ''}`}
              >
                Return
              </button>
            </div>

            {/* Invoice #, Date, Hold Row Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="pos-tag-pill">
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                  Invoice #
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                  {invoiceNo}
                </span>
              </div>

              <div className="pos-tag-pill">
                <Calendar style={{ width: 14, height: 14, color: '#94A3B8' }} />
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                  Date
                </span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, background: 'transparent', border: 'none', color: '#1E293B', outline: 'none', cursor: 'pointer' }}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowTokenRedemptionModal(true)}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, background: '#FFFBEB', color: '#B45309', borderRadius: '8px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                title="Redeem returned paint tokens for cash payout"
              >
                <Ticket style={{ width: 14, height: 14, color: '#D97706' }} />
                Redeem Token
              </button>

              <button
                type="button"
                onClick={handleHoldInvoice}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, background: '#F1F5F9', color: '#334155', borderRadius: '8px', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <PauseCircle style={{ width: 14, height: 14, color: '#64748B' }} />
                Hold (F7)
              </button>
            </div>
          </div>

          {/* Three-Column Row: Customer Info, Customer History, Remarks (Matching painterp) */}
          <div className="pos-grid-3col">
            {/* 1. Customer Search Field */}
            <div className="pos-card-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <User style={{ width: 14, height: 14, color: '#F97316' }} />
                Customer Account
              </label>
              <div className="pos-input-wrapper">
                <input
                  type="text"
                  value={selectedClient ? `${selectedClient.name} (${selectedClient.phone || 'Account'})` : customerSearch}
                  onChange={(e) => {
                    setSelectedClient(null);
                    setCustomerSearch(e.target.value);
                  }}
                  onFocus={() => setShowCustomerModal(true)}
                  placeholder="Search customer name or phone..."
                  className="pos-text-input"
                  style={{ paddingRight: '32px', fontWeight: 500 }}
                />
                <Search
                  onClick={() => setShowCustomerModal(true)}
                  style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', right: '10px', cursor: 'pointer' }}
                />
              </div>
              {selectedClient && (selectedClient.token_balance || 0) > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#065F46' }}>
                    🏷️ Available Token Balance: Rs. {(selectedClient.token_balance || 0).toLocaleString()}
                  </span>
                  {appliedTokenAmount > 0 ? (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#047857' }}>
                      ✓ Rs. {appliedTokenAmount.toLocaleString()} Applied
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const maxApplicable = Math.min(netTotal, selectedClient.token_balance || 0);
                        setAppliedTokenAmount(maxApplicable);
                        setIsCashManuallyEdited(false);
                      }}
                      style={{ fontSize: '10px', fontWeight: 700, background: '#059669', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}
                    >
                      Apply to Bill
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 2. Customer History Box */}
            <div className="pos-card-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <History style={{ width: 14, height: 14, color: '#F97316' }} />
                  Customer History
                </span>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                  {selectedClient ? (selectedClient.code || '') : 'Walk-in'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', paddingTop: '6px', borderTop: '1px solid #F1F5F9', fontSize: '12px' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>Last Purchase</div>
                  <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedClient ? clientHistory.lastPurchase : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>Total Sales</div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedClient ? clientHistory.totalSales : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>Prior Outstanding</div>
                  <div style={{ fontWeight: 600, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedClient && selectedClient.current_balance > 0 ? '#DC2626' : '#16A34A' }}>
                    {selectedClient && selectedClient.current_balance > 0 ? `Rs. ${selectedClient.current_balance.toLocaleString()}` : 'Clear / No Overdue'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Remarks Field */}
            <div className="pos-card-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Tag style={{ width: 14, height: 14, color: '#94A3B8' }} />
                Remarks &amp; Notes
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional invoice notes or gate pass ref..."
                className="pos-text-input"
              />
            </div>
          </div>

          {/* Product Entry Row: Search Field, Qty Input, Add Item Button */}
          <div className="pos-card-box" style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div className="pos-input-wrapper">
                <Search style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', left: '10px' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={productQuery}
                  onFocus={() => {
                    setShowProductDropdown(true);
                    setActiveProductIndex(0);
                  }}
                  onChange={(e) => {
                    setProductQuery(e.target.value);
                    setShowProductDropdown(true);
                    setActiveProductIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setShowProductDropdown(true);
                      setActiveProductIndex((prev) => (filteredCatalog.length ? (prev + 1) % filteredCatalog.length : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setShowProductDropdown(true);
                      setActiveProductIndex((prev) => (filteredCatalog.length ? (prev - 1 + filteredCatalog.length) % filteredCatalog.length : 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (showProductDropdown && filteredCatalog.length > 0 && activeProductIndex >= 0 && activeProductIndex < filteredCatalog.length) {
                        handleAddItem(filteredCatalog[activeProductIndex]);
                      } else if (selectedProduct) {
                        handleAddItem(selectedProduct);
                      } else if (filteredCatalog.length === 1) {
                        handleAddItem(filteredCatalog[0]);
                      }
                    } else if (e.key === 'Escape') {
                      setShowProductDropdown(false);
                    }
                  }}
                  placeholder="Search product by name, code, barcode or shade... (F3)"
                  className="pos-text-input"
                  style={{ paddingLeft: '34px', paddingRight: '34px', fontWeight: 500 }}
                />
                <Barcode style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', right: '10px' }} />
              </div>

              {/* Product Autocomplete Dropdown */}
              {showProductDropdown && productQuery && (
                <div className="pos-dropdown-panel">
                  {liveItems.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Loading catalog...
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      No matching products found
                    </div>
                  ) : (
                    filteredCatalog.map((prod, idx) => {
                      const { shadeCode } = getShadeInfo(prod);
                      const prodCodeKey = (prod.code || '').trim().toLowerCase();
                      const prodNameKey = (prod.name || '').trim().toLowerCase();
                      const lastPurch = selectedClient
                        ? (clientProductHistory[prod.id] ||
                           clientProductHistory[prodCodeKey] ||
                           clientProductHistory[prodNameKey])
                        : undefined;
                      const isHighlighted = idx === activeProductIndex;

                      return (
                        <div
                          key={prod.id}
                          onMouseEnter={() => setActiveProductIndex(idx)}
                          onClick={() => {
                            setSelectedProduct(prod);
                            setProductQuery(`${prod.name} (${shadeCode})`);
                            setShowProductDropdown(false);
                            handleAddItem(prod);
                          }}
                          className="pos-dropdown-item"
                          style={{
                            background: isHighlighted ? '#FFF7ED' : undefined,
                            borderLeft: isHighlighted ? '3px solid #F97316' : '3px solid transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: isHighlighted ? '#C2410C' : '#0F172A' }}>{prod.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                {prod.code} · {prod.pack_size || prod.unit || 'Can'} · {shadeCode}
                              </div>
                              {lastPurch && (
                                <div style={{ marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '1px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 700 }}>
                                  🏷️ Last bought: Rs. {lastPurch.lastPrice.toLocaleString()} ({lastPurch.lastDate})
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#0F172A' }}>
                              Rs. {prod.retail_price.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}>
                              Stock: {prod.stock_qty} {prod.unit || 'PCS'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Qty Field */}
            <div style={{ width: '96px', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
                Qty:
              </span>
              <input
                type="number"
                min={1}
                value={inputQty}
                onChange={(e) => setInputQty(Number(e.target.value) || 1)}
                style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
              />
            </div>

            {/* Add Item Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedProduct) {
                  handleAddItem(selectedProduct);
                } else if (filteredCatalog.length === 1) {
                  handleAddItem(filteredCatalog[0]);
                }
              }}
              style={{ padding: '8px 18px', background: '#F97316', color: '#ffffff', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 2px 6px rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              Add Item (F4)
            </button>
          </div>

          {/* Full-Width Line-Item Table (Matching painterp Table) */}
          <div className="pos-table-container">
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table className="pos-data-table">
                <thead>
                  <tr>
                    <th style={{ width: '28px', textAlign: 'center' }}>#</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Code</th>
                    <th>Product</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Shade</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Pack / Unit</th>
                    <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Qty</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Unit</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Rate</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Disc %</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '64px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                        No items in current invoice. Search product above to add.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, index) => {
                      const lineGross = item.rate * item.qty;
                      const lineDiscount = (lineGross * item.discountPercent) / 100;
                      const lineNet = lineGross - lineDiscount;

                      return (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8', fontSize: '11px' }}>
                            {index + 1}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <input
                              type="text"
                              value={item.code}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLineItems((prev) => prev.map((li) => (li.id === item.id ? { ...li, code: val } : li)));
                              }}
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontWeight: 700,
                                color: '#334155',
                                fontSize: '11px',
                                background: 'transparent',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                width: '85px',
                                outline: 'none',
                              }}
                              onFocus={(e) => (e.target.style.borderColor = '#F97316')}
                              onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                              title="Click to edit code"
                            />
                          </td>
                          <td style={{ fontWeight: 600, color: '#0F172A' }}>
                            <input
                              type="text"
                              value={item.productName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLineItems((prev) => prev.map((li) => (li.id === item.id ? { ...li, productName: val } : li)));
                              }}
                              style={{
                                fontWeight: 600,
                                color: '#0F172A',
                                fontSize: '12px',
                                background: 'transparent',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                width: '100%',
                                outline: 'none',
                              }}
                              onFocus={(e) => (e.target.style.borderColor = '#F97316')}
                              onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                              title="Click to edit product name for bill"
                            />
                            {item.hasToken && (item.tokenValue || 0) > 0 && (
                              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontWeight: 700,
                                    background: '#FEF3C7',
                                    color: '#D97706',
                                    border: '1px solid #FDE68A',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <Ticket style={{ width: 10, height: 10 }} />
                                  Token Rs. {(item.tokenValue || 0).toLocaleString()}
                                </span>

                                {invoiceType === 'return' ? (
                                  <label
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      background: item.tokenReturnedWithBucket !== false ? '#ECFDF5' : '#FEF2F2',
                                      border: `1px solid ${item.tokenReturnedWithBucket !== false ? '#A7F3D0' : '#FECACA'}`,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                    }}
                                    title="Check if customer returned bucket with original token intact inside"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={item.tokenReturnedWithBucket !== false}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setLineItems(prev => prev.map(li => li.id === item.id ? { ...li, tokenReturnedWithBucket: checked } : li));
                                      }}
                                      style={{ accentColor: '#059669', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontWeight: 700, color: item.tokenReturnedWithBucket !== false ? '#065F46' : '#DC2626' }}>
                                      {item.tokenReturnedWithBucket !== false
                                        ? 'Token Intact (Full Refund)'
                                        : `Token Missing (-Rs. ${((item.tokenValue || 0) * item.qty).toLocaleString()})`}
                                    </span>
                                  </label>
                                ) : (
                                  <div style={{ display: 'inline-flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTokenAction(item.id, 'keep')}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: item.tokenAction !== 'remove' ? '#059669' : '#F1F5F9',
                                        color: item.tokenAction !== 'remove' ? '#FFFFFF' : '#64748B',
                                      }}
                                      title="Keep Token inside paint — Customer gets full price"
                                    >
                                      Keep (Rs. {(item.originalRate || item.rate).toLocaleString()})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTokenAction(item.id, 'remove')}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        border: 'none',
                                        borderLeft: '1px solid #CBD5E1',
                                        background: item.tokenAction === 'remove' ? '#D97706' : '#F1F5F9',
                                        color: item.tokenAction === 'remove' ? '#FFFFFF' : '#64748B',
                                      }}
                                      title="Remove Token at shop — Deduct token value from sale price"
                                    >
                                      Remove (-Rs. {(item.tokenValue || 0).toLocaleString()})
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <input
                              type="text"
                              value={item.shadeCode}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLineItems((prev) => prev.map((li) => (li.id === item.id ? { ...li, shadeCode: val } : li)));
                              }}
                              style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '11px',
                                color: '#334155',
                                background: 'transparent',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                width: '85px',
                                outline: 'none',
                              }}
                              onFocus={(e) => (e.target.style.borderColor = '#F97316')}
                              onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                              title="Click to edit shade code"
                            />
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {item.packSize}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div className="pos-qty-stepper">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                                className="pos-qty-btn"
                              >
                                -
                              </button>
                              <span className="pos-qty-val">
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                                className="pos-qty-btn"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748B', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            {item.unit}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap' }}>
                            {item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#475569', whiteSpace: 'nowrap' }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={item.discountPercent === 0 ? '' : item.discountPercent}
                              placeholder="0"
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                setLineItems((prev) =>
                                  prev.map((i) => (i.id === item.id ? { ...i, discountPercent: val } : i))
                                );
                              }}
                              style={{
                                width: '52px',
                                textAlign: 'right',
                                fontFamily: 'JetBrains Mono, monospace',
                                color: '#1E293B',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '4px',
                                padding: '2px 4px',
                                outline: 'none',
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                            {lineNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                style={{ padding: '4px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                                title="Delete Line Item"
                              >
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Full-Height Docked Billing Summary Panel (Matching painterp PosBillingView.tsx) */}
      <aside className="pos-docked-sidebar">
        {/* Header of Right Panel */}
        <div className="pos-docked-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers style={{ width: 16, height: 16, color: '#F97316' }} />
            <h3 style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0F172A' }}>
              Billing Summary
            </h3>
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, padding: '2px 8px', background: '#E2E8F0', borderRadius: '6px', color: '#334155' }}>
            {lineItems.reduce((sum, i) => sum + i.qty, 0)} Units
          </span>
        </div>

        <div className="pos-docked-body no-scrollbar">
          {/* 1. Invoice Summary Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#0F172A' }}>
                {itemSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Discount (Item)</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#475569' }}>
                {totalItemDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Invoice Discount Input */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ color: '#475569' }}>Invoice Discount</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '2px 8px', width: '110px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8', marginRight: '4px' }}>Rs.</span>
                <input
                  type="number"
                  min={0}
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Number(e.target.value) || 0)}
                  style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#1E293B', background: 'transparent', border: 'none', textAlign: 'right', outline: 'none' }}
                />
              </div>
            </div>

            {/* Delivery Charge Input */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ color: '#475569' }}>Delivery Charge</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '2px 8px', width: '110px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8', marginRight: '4px' }}>Rs.</span>
                <input
                  type="number"
                  min={0}
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)}
                  style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#1E293B', background: 'transparent', border: 'none', textAlign: 'right', outline: 'none' }}
                />
              </div>
            </div>

            {/* Net Total Highlight */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0F172A' }}>
                Net Total
              </span>
              <span style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0F172A' }}>
                Rs. {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 2. Payment Panel */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <h4 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>
              Payment
            </h4>

            <div className="pos-payment-tile-grid">
              <div className="pos-payment-input-box">
                <label>Cash</label>
                <input
                  type="number"
                  value={cashPayment}
                  onChange={(e) => {
                    setIsCashManuallyEdited(true);
                    setCashPayment(Number(e.target.value) || 0);
                  }}
                />
              </div>

              <div className="pos-payment-input-box">
                <label>Card</label>
                <input
                  type="number"
                  value={cardPayment}
                  onChange={(e) => setCardPayment(Number(e.target.value) || 0)}
                />
              </div>

              <div className="pos-payment-input-box">
                <label>Bank Transfer</label>
                <input
                  type="number"
                  value={bankPayment}
                  onChange={(e) => setBankPayment(Number(e.target.value) || 0)}
                />
              </div>

              <div className="pos-payment-input-box">
                <label>Others</label>
                <input
                  type="number"
                  value={othersPayment}
                  onChange={(e) => setOthersPayment(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Token Balance Applied Row */}
            {appliedTokenAmount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#065F46', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🏷️ Token Balance Applied
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#059669', fontSize: '12px' }}>
                    − Rs. {appliedTokenAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setAppliedTokenAmount(0); setIsCashManuallyEdited(false); }}
                    style={{ fontSize: '10px', color: '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '0 2px' }}
                    title="Remove token balance from this bill"
                  >✕</button>
                </div>
              </div>
            )}

            <div style={{ paddingTop: '6px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569' }}>Paid Amount</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                Rs. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#475569', fontWeight: 600 }}>Balance</span>
              {balanceDue <= 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 style={{ width: 12, height: 12 }} />
                  Payment Success
                </span>
              ) : (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '11px' }}>
                  Rs. {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Due)
                </span>
              )}
            </div>
          </div>

          {/* 3. Bottom Stacked Action Buttons (Save & Print / Save / Hold / Cancel) */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Primary Save & Print */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleCheckout(true)}
              className="pos-btn-checkout"
            >
              <Printer style={{ width: 16, height: 16 }} />
              {submitting ? 'Saving Sale...' : 'Save & Print (F5)'}
            </button>

            {/* Secondary Save and Hold side-by-side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCheckout(false)}
                style={{ padding: '8px', background: '#F1F5F9', color: '#1E293B', fontWeight: 700, fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
              >
                <Save style={{ width: 14, height: 14, color: '#475569' }} />
                Save (F2)
              </button>

              <button
                type="button"
                onClick={handleHoldInvoice}
                style={{ padding: '8px', background: '#F1F5F9', color: '#1E293B', fontWeight: 700, fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
              >
                <PauseCircle style={{ width: 14, height: 14, color: '#475569' }} />
                Hold (F7)
              </button>
            </div>

            {/* Cancel Invoice Outline Button */}
            <button
              type="button"
              onClick={handleCancelInvoice}
              style={{ width: '100%', padding: '6px', background: '#ffffff', color: '#DC2626', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <XCircle style={{ width: 14, height: 14 }} />
              Cancel Invoice (F9)
            </button>
          </div>
        </div>
      </aside>

      {/* ── Pending Last Rate Confirmation Modal ── */}
      {pendingRateConfirm && (
        <div className="pos-modal-overlay">
          <div className="pos-modal-card" style={{ maxWidth: '420px', border: '1px solid #FED7AA' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #FED7AA', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🏷️</span>
                <h3 style={{ fontWeight: 800, fontSize: '14px', color: '#9A3412' }}>
                  Previous Price Record Detected
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingRateConfirm(null)}
                style={{ background: 'none', border: 'none', color: '#9A3412', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#334155' }}>
                <strong>{selectedClient?.name}</strong> previously bought <strong>{pendingRateConfirm.product.name}</strong>:
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Last Purchase Price:</span>
                  <span style={{ fontWeight: 800, color: '#047857', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                    Rs. {pendingRateConfirm.lastPurchase.lastPrice.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                  <span>Invoice &amp; Date:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {pendingRateConfirm.lastPurchase.invoiceNo || '—'} · {pendingRateConfirm.lastPurchase.lastDate || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px dashed #CBD5E1', paddingTop: '6px' }}>
                  <span style={{ color: '#64748B' }}>Current Retail Price:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace' }}>
                    Rs. {(pendingRateConfirm.product.retail_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>
                Would you like to give the customer their previous rate or charge the current retail price?
              </p>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const prod = pendingRateConfirm.product;
                    const rate = pendingRateConfirm.lastPurchase.lastPrice;
                    setPendingRateConfirm(null);
                    handleAddItem(prod, rate, true);
                  }}
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(5,150,105,0.2)',
                  }}
                >
                  Use Last Price (Rs. {pendingRateConfirm.lastPurchase.lastPrice.toLocaleString()})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const prod = pendingRateConfirm.product;
                    const rate = prod.retail_price;
                    setPendingRateConfirm(null);
                    handleAddItem(prod, rate, true);
                  }}
                  style={{
                    flex: 1,
                    padding: '9px',
                    background: '#F1F5F9',
                    color: '#0F172A',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Use Retail (Rs. {(pendingRateConfirm.product.retail_price || 0).toLocaleString()})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Directory Modal ── */}
      {showCustomerModal && (
        <div className="pos-modal-overlay">
          <div className="pos-modal-card">
            <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User style={{ width: 16, height: 16, color: '#F97316' }} />
                <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>Customer Directory &amp; Khatas</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Search Bar & Clients List */}
              {(() => {
                const filteredClients: { isWalkIn: boolean; client?: Client; name?: string }[] = [
                  { isWalkIn: true, name: 'Walk-in Customer (General Counter)' },
                  ...clients
                    .filter((c) =>
                      c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                      (c.phone && c.phone.includes(clientSearchQuery)) ||
                      (c.code && c.code.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                    )
                    .map((c) => ({ isWalkIn: false, client: c, name: c.name })),
                ];

                return (
                  <>
                    <div className="pos-input-wrapper">
                      <Search style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', left: '10px' }} />
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setActiveClientIndex(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveClientIndex((prev) => (filteredClients.length ? (prev + 1) % filteredClients.length : 0));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveClientIndex((prev) => (filteredClients.length ? (prev - 1 + filteredClients.length) % filteredClients.length : 0));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const target = filteredClients[activeClientIndex];
                            if (target) {
                              if (target.isWalkIn) {
                                setSelectedClient(null);
                                setCustomerSearch('Walk-in Customer');
                              } else if (target.client) {
                                setSelectedClient(target.client);
                                setCustomerSearch(target.client.name);
                              }
                              setShowCustomerModal(false);
                              setTimeout(() => searchInputRef.current?.focus(), 60);
                            }
                          } else if (e.key === 'Escape') {
                            setShowCustomerModal(false);
                          }
                        }}
                        placeholder="Search customer by name or phone number..."
                        className="pos-text-input"
                        style={{ paddingLeft: '34px' }}
                        autoFocus
                      />
                    </div>

                    {/* Clients List */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                      {filteredClients.map((item, idx) => {
                        const isHighlighted = idx === activeClientIndex;
                        if (item.isWalkIn) {
                          return (
                            <div
                              key="walkin-opt"
                              onMouseEnter={() => setActiveClientIndex(idx)}
                              onClick={() => {
                                setSelectedClient(null);
                                setCustomerSearch('Walk-in Customer');
                                setShowCustomerModal(false);
                                setTimeout(() => searchInputRef.current?.focus(), 60);
                              }}
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid #F1F5F9',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '12px',
                                background: isHighlighted ? '#FFF7ED' : '#FFFFFF',
                                borderLeft: isHighlighted ? '3px solid #F97316' : '3px solid transparent',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, color: isHighlighted ? '#C2410C' : '#0F172A' }}>Walk-in Customer (General Counter)</div>
                                <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>No credit account · Immediate cash checkout</div>
                              </div>
                              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, padding: '2px 6px', background: isHighlighted ? '#FED7AA' : '#F1F5F9', borderRadius: '4px', color: '#475569' }}>
                                Walk-in
                              </span>
                            </div>
                          );
                        }

                        const client = item.client;
                        if (!client) return null;
                        return (
                          <div
                            key={client.id}
                            onMouseEnter={() => setActiveClientIndex(idx)}
                            onClick={() => {
                              setSelectedClient(client);
                              setCustomerSearch(client.name);
                              setShowCustomerModal(false);
                              setTimeout(() => searchInputRef.current?.focus(), 60);
                            }}
                            style={{
                              padding: '10px 12px',
                              borderBottom: '1px solid #F1F5F9',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              background: isHighlighted ? '#FFF7ED' : '#FFFFFF',
                              borderLeft: isHighlighted ? '3px solid #F97316' : '3px solid transparent',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: isHighlighted ? '#C2410C' : '#0F172A' }}>{client.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                {client.code ? `${client.code} · ` : ''}{client.phone || 'No phone'} · {client.city || 'Pakistan'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                                Limit: Rs. {(client.credit_limit || 0).toLocaleString()}
                              </div>
                              <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: client.current_balance > 0 ? '#DC2626' : '#16A34A' }}>
                                Balance: Rs. {(client.current_balance || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {/* Quick Add Client */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="New customer name..."
                  className="pos-text-input"
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Phone number..."
                  className="pos-text-input"
                  style={{ width: '130px' }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newClientName) return;
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
                        setClients((prev) => [data.client, ...prev]);
                        setSelectedClient(data.client);
                        setCustomerSearch(data.client.name);
                        setNewClientName('');
                        setNewClientPhone('');
                        setShowCustomerModal(false);
                        showFeedback(`Customer ${data.client.name} created!`);
                      }
                    } catch (err) {
                      console.error('Failed to create customer', err);
                    }
                  }}
                  style={{ padding: '8px 14px', background: '#F97316', color: '#ffffff', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Parked / Held Orders Modal ── */}
      {showHeldModal && (
        <div className="pos-modal-overlay">
          <div className="pos-modal-card">
            <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PauseCircle style={{ width: 16, height: 16, color: '#F97316' }} />
                <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>Parked / Held Customer Invoices</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHeldModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1rem', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {heldOrders.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                  No orders currently placed on hold.
                </div>
              ) : (
                heldOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{order.customerName}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                        {order.items.length} items · Parked at {order.time}
                      </div>
                      <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#0F172A', marginTop: '4px' }}>
                        Rs. {order.total.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleRestoreHeld(order)}
                        style={{ padding: '6px 12px', background: '#F97316', color: '#ffffff', fontWeight: 700, fontSize: '11px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHeld(order)}
                        style={{ padding: '6px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Print-Only Direct Thermal Receipt (No In-App Modal / No Screen Overlay) ── */}
      {printReceiptData && (
        <div id="pos-thermal-print-wrapper" aria-hidden="true">
          <style>{`
            @media screen {
              #pos-thermal-print-wrapper,
              #printable-pos-thermal-slip {
                display: none !important;
                visibility: hidden !important;
              }
            }
            @media print {
              body * {
                visibility: hidden !important;
              }
              #pos-thermal-print-wrapper,
              #pos-thermal-print-wrapper *,
              #printable-pos-thermal-slip,
              #printable-pos-thermal-slip * {
                visibility: visible !important;
              }
              #pos-thermal-print-wrapper {
                display: block !important;
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              #printable-pos-thermal-slip {
                display: block !important;
                position: relative !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 !important;
                padding: 4mm !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
            }
          `}</style>
          <div id="printable-pos-thermal-slip" style={{ width: '80mm', maxWidth: '80mm', padding: '4mm', color: '#000000', fontFamily: 'JetBrains Mono, monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000000', paddingBottom: '8px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>{tenantName}</h2>
              <p style={{ fontSize: '10px', color: '#333333', margin: 0 }}>Retail &amp; Industrial Paint Hub</p>
              <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px', color: '#000000' }}>{printReceiptData.invoice_no || invoiceNo}</div>
              <div style={{ fontSize: '9px', color: '#555555' }}>{printReceiptData.date} · {printReceiptData.time}</div>
            </div>

            <div style={{ fontSize: '11px', borderBottom: '1px dashed #000000', paddingBottom: '6px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ color: '#555555' }}>Customer:</span>
                <span style={{ fontWeight: 700, color: '#000000' }}>{printReceiptData.client_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555555' }}>Staff:</span>
                <span style={{ fontWeight: 700, color: '#000000' }}>{staffName}</span>
              </div>
            </div>

            {/* Line items on thermal print */}
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '6px', marginBottom: '6px', fontSize: '10.5px' }}>
              {printReceiptData.items?.map((item: any, idx: number) => {
                const isTokenItem = Boolean(item.hasToken && (item.tokenValue || 0) > 0);
                const isRemoved = item.tokenAction === 'remove';

                return (
                  <div key={idx} style={{ padding: '3px 0', borderBottom: idx < printReceiptData.items.length - 1 ? '1px dotted #CCCCCC' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#000000' }}>{item.productName || item.item_name}</div>
                        <div style={{ color: '#444444', fontSize: '9.5px' }}>
                          {(item.code || item.item_code) ? `${item.code || item.item_code} · ` : ''}
                          {(item.shadeCode || item.shade_code) && (item.shadeCode || item.shade_code) !== '—' ? `Shade: ${item.shadeCode || item.shade_code} · ` : ''}
                          {item.qty} x Rs. {(item.rate || item.unit_price || 0).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#000000' }}>
                        Rs. {(item.qty * (item.rate || item.unit_price || 0)).toLocaleString()}
                      </div>
                    </div>
                    {isTokenItem && (
                      <div style={{ fontSize: '9px', color: '#333333', marginTop: '1px', fontStyle: 'italic' }}>
                        {isRemoved
                          ? `🎫 Token removed — Rs. ${(item.tokenValue * item.qty).toLocaleString()} deducted`
                          : `🎫 Token included — Rs. ${(item.tokenValue * item.qty).toLocaleString()} token value`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', borderBottom: '1px dashed #000000', paddingBottom: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555555' }}>Subtotal:</span>
                <span style={{ color: '#000000' }}>Rs. {(printReceiptData.subTotal || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555555' }}>Discount:</span>
                <span style={{ color: '#000000' }}>- Rs. {(printReceiptData.discount || 0).toLocaleString()}</span>
              </div>
              {Number(printReceiptData.delivery_charge || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#555555' }}>Delivery:</span>
                  <span style={{ color: '#000000' }}>+ Rs. {Number(printReceiptData.delivery_charge).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900, paddingTop: '3px' }}>
                <span>NET TOTAL:</span>
                <span style={{ color: '#000000' }}>Rs. {(printReceiptData.grandTotal || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', paddingTop: '2px', color: '#333333' }}>
                <span>Paid ({printReceiptData.payment_type || 'Cash'}):</span>
                <span>Rs. {(printReceiptData.paid_amount || 0).toLocaleString()}</span>
              </div>
              {printReceiptData.due_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#000000' }}>
                  <span>Balance Due:</span>
                  <span>Rs. {printReceiptData.due_amount.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#555555' }}>
              Thank you for shopping at {tenantName}!
            </div>
          </div>
        </div>
      )}

      {/* ── Token Redemption Quick Panel ── */}
      <TokenRedemption
        isOpen={showTokenRedemptionModal}
        onClose={() => setShowTokenRedemptionModal(false)}
        tenantId={tenantId}
        tenantName={tenantName}
        shiftId={shiftId}
        staffName={staffName}
        clients={clients}
        items={liveItems}
        onRedeemed={async () => {
          if (!tenantId) return;
          try {
            const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
            const data = await res.json();
            if (data.success) {
              setClients(data.clients || []);
            }
          } catch (err) {
            console.error('Failed to reload clients after redemption', err);
          }
        }}
      />
    </section>
  );
}