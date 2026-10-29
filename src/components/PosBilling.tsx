'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { printViaIframe } from '@/utils/iframePrint';
import { buildPosThermalHtml, buildSpecialReceiptHtml } from '@/utils/receiptAdapters';
import { ReceiptTemplate } from '@/types/receipt';
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
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';
import TokenRedemption from './TokenRedemption';
import { formatWalkInName, stripWalkInSuffix, isPlaceholderWalkInName } from '@/utils/customerName';
import { fetchWithTimeout, isNetworkOrTimeoutError } from '@/lib/fetchWithTimeout';
import { reportNetworkError, reportNetworkSuccess, useConnectivity } from '@/lib/useConnectivity';
import {
  saveCartDraft,
  loadCartDraft,
  clearCartDraft,
  validateCartDraftRates,
  CartDraftPayload,
  RateRevalidationResult,
} from '@/lib/cartDraftStore';
import {
  addLocalHold,
  loadLocalHolds,
  removeLocalHold,
  updateLocalHoldStatus,
  clearAllLocalHolds,
  generateOfflineHoldNo,
  getPendingLocalHolds,
  LocalHoldItem,
  LOCAL_HOLD_SCHEMA_VERSION,
} from '@/lib/localHoldStore';

interface Props {
  items: Item[];
  tenantId: string;
  branchId?: string;
  userId?: string;
  shiftId?: string;
  onCompleteSale: (invoice: any) => void;
  staffName: string;
  tenantName?: string;
  canUseSpecialReceipt?: boolean;
  restoringHeldOrder?: any;
  onClearRestoringHeldOrder?: () => void;
  editingInvoice?: any;
  onClearEditingInvoice?: () => void;
  pendingOrdersCount?: number;
  onNavigateToOrders?: () => void;
  allowNegativeStock?: boolean;
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
  brand_id?: string;
  series_id?: string;
  series_name?: string;
  category?: string;
  shadeCode: string;
  originalShade?: string;
  shadeColorHex: string;
  packSize: string;
  qty: number;
  unit: string;
  rate: number;
  originalRate?: number;
  specialRate?: number; // Special sale: final per-unit rate charged (receipt prints `rate`)
  discountPercent: number;
  hasToken?: boolean;
  tokenValue?: number;
  tokenAction?: 'keep' | 'remove';
  tokenReturnedWithBucket?: boolean;
}

interface HeldOrder {
  id: string;
  dbId?: string;
  /** Set when the hold was saved locally (offline). Used as idempotency key on sync. */
  localHoldId?: string;
  /** True if hold exists only on this device (not yet synced to server). */
  isLocalOnly?: boolean;
  hold_no: string;
  customerName: string;
  selectedClient: Client | null;
  items: InvoiceLineItem[];
  invoiceType: 'sales' | 'return';
  time: string;
  total: number;
  subtotal?: number;
  discount?: number;
  delivery_charge?: number;
  remarks?: string;
}


const SHORTCUTS = [
  { key: 'F2', label: 'Save' },
  { key: 'F3', label: 'Search' },
  { key: 'F4', label: 'Add Item' },
  { key: 'F5', label: 'Save & Print' },
  { key: 'F6', label: 'Special' },
  { key: 'F7', label: 'Hold' },
  { key: 'F8', label: 'Hold List' },
  { key: 'F9', label: 'Cancel' },
];


export default function PosBilling({
  items: liveItems,
  tenantId,
  branchId,
  userId,
  shiftId,
  onCompleteSale,
  staffName,
  tenantName = 'PyntFlow Store',
  canUseSpecialReceipt = false,
  restoringHeldOrder,
  onClearRestoringHeldOrder,
  editingInvoice,
  onClearEditingInvoice,
  pendingOrdersCount = 0,
  onNavigateToOrders,
  allowNegativeStock = true,
}: Props) {
  const effectiveUserId = userId || staffName || 'staff';
  const effectiveBranchId = branchId || tenantId;

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
  const customerInputRef = useRef<HTMLInputElement>(null);
  const skipCustomerModalOnFocus = useRef(false);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  // Walk-in rule: until a registered customer is picked, a real walk-in name must be typed
  const needsCustomerName = !selectedClient && (isPlaceholderWalkInName(customerSearch) || customerSearch.trim().length < 2);
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientReference, setNewClientReference] = useState<string>('');
  const [newClientPreviousBalance, setNewClientPreviousBalance] = useState<string>('');
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
  const [inputRate, setInputRate] = useState<number>(0);
  const [inputDiscount, setInputDiscount] = useState<number>(0);
  const [inputSpecialRate, setInputSpecialRate] = useState<number>(0);
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

  // Persistent Held Orders State
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldModal, setShowHeldModal] = useState<boolean>(false);
  const [activeHeldOrderId, setActiveHeldOrderId] = useState<string | null>(null);

  // Submission & Feedback State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const activeCheckoutKeyRef = useRef<string | null>(null);
  const activeSpecialCheckoutKeyRef = useRef<string | null>(null);

  // Phase 2: Verify-Before-Retry state for resilient network handling
  const [verifyState, setVerifyState] = useState<{
    isVerifying: boolean;
    statusMessage?: string;
    failedAfterRetries?: boolean;
    errorMessage?: string;
    retryAction?: () => void;
  } | null>(null);

  // Phase 3: Cart Auto-Save & Recovery state (Tasks 3.1–3.4, 3.8)
  const [pendingDraft, setPendingDraft] = useState<CartDraftPayload | null>(null);
  const [rateWarnings, setRateWarnings] = useState<RateRevalidationResult['warnings'] | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedDraftCheckRef = useRef<boolean>(false);

  // Phase 5: Local Hold Sync — watch connectivity; on transition to online,
  // push any pending local holds to the server.
  const { isOnline } = useConnectivity();
  const isSyncingLocalHoldsRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOnline) return; // Only attempt sync when online
    if (isSyncingLocalHoldsRef.current) return; // Already syncing

    const pendingHolds = getPendingLocalHolds(tenantId, effectiveBranchId, effectiveUserId);
    if (pendingHolds.length === 0) return;

    isSyncingLocalHoldsRef.current = true;
    (async () => {
      for (const hold of pendingHolds) {
        try {
          // Mark as syncing (status update, non-blocking)
          updateLocalHoldStatus(tenantId, effectiveBranchId, effectiveUserId, hold.localHoldId, 'syncing');

          const res = await fetchWithTimeout('/api/held-invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: hold.tenantId,
              hold_no: hold.hold_no,
              client_id: hold.clientId,
              client_name: hold.clientName,
              invoice_type: hold.invoiceType,
              items: hold.items,
              subtotal: hold.subtotal,
              discount: hold.discount,
              delivery_charge: hold.deliveryCharge,
              net_total: hold.netTotal,
              remarks: hold.remarks,
              // Phase 5.3: idempotency — server dedupes on local_hold_id (UNIQUE column)
              local_hold_id: hold.localHoldId,
            }),
            timeoutMs: 15000,
          });

          const data = await res.json();
          if (res.ok && (data.success || data.is_duplicate)) {
            // Task 5.5: Remove local copy ONLY after server confirmation
            removeLocalHold(tenantId, effectiveBranchId, effectiveUserId, hold.localHoldId);
            // Update in-memory held list: replace local badge entry with server entry
            if (data.held_order?.id) {
              setHeldOrders((prev) =>
                prev.map((o) =>
                  o.localHoldId === hold.localHoldId
                    ? {
                        ...o,
                        id: data.held_order.id,
                        dbId: data.held_order.id,
                        isLocalOnly: false,
                        localHoldId: undefined,
                      }
                    : o,
                ),
              );
            } else {
              // Duplicate — server already has it; remove from local list
              setHeldOrders((prev) => prev.filter((o) => o.localHoldId !== hold.localHoldId));
            }
          } else {
            // Business rule rejection (not a network error) — mark needs_attention
            const errMsg = data.error || `Server rejected hold ${hold.hold_no}`;
            updateLocalHoldStatus(
              tenantId, effectiveBranchId, effectiveUserId,
              hold.localHoldId, 'needs_attention', errMsg,
            );
            console.warn('[LocalHold Sync] Hold rejected by server:', errMsg);
          }
        } catch (syncErr: any) {
          // Network error — reset to pending so next reconnect retries
          updateLocalHoldStatus(tenantId, effectiveBranchId, effectiveUserId, hold.localHoldId, 'pending');
          console.warn('[LocalHold Sync] Network error during hold sync, will retry:', syncErr?.message);
          break; // Stop trying more holds until next connectivity event
        }
      }
      isSyncingLocalHoldsRef.current = false;
    })();
  }, [isOnline, tenantId, effectiveBranchId, effectiveUserId]);

  // Phase 3.4: On mount, detect unsaved cart draft (if not currently restoring or editing)
  useEffect(() => {
    if (hasInitializedDraftCheckRef.current) return;
    hasInitializedDraftCheckRef.current = true;

    if (restoringHeldOrder || editingInvoice) return;

    const draft = loadCartDraft(tenantId, effectiveBranchId, effectiveUserId);
    if (draft && (draft.cart?.lineItems?.length || draft.cart?.selectedClient || draft.cart?.customerSearch?.trim())) {
      setPendingDraft(draft);
    }
  }, [tenantId, effectiveBranchId, effectiveUserId, restoringHeldOrder, editingInvoice]);

  // Phase 3.3: Debounced auto-save (~500ms) on any cart change
  useEffect(() => {
    // If waiting on user to restore or discard draft, don't overwrite with empty initial cart!
    if (pendingDraft) return;
    // Don't auto-save if working on a server held order or editing an existing server invoice
    if (restoringHeldOrder || editingInvoice) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveCartDraft(tenantId, effectiveBranchId, effectiveUserId, {
        lineItems,
        invoiceType,
        selectedClient,
        customerSearch,
        remarks,
        invoiceDiscount,
        deliveryCharge,
        cashPayment,
        cardPayment,
        bankPayment,
        othersPayment,
        activeCheckoutKey: activeCheckoutKeyRef.current,
        activeSpecialCheckoutKey: activeSpecialCheckoutKeyRef.current,
        activeHeldOrderId,
      });
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    tenantId,
    effectiveBranchId,
    effectiveUserId,
    lineItems,
    invoiceType,
    selectedClient,
    customerSearch,
    remarks,
    invoiceDiscount,
    deliveryCharge,
    cashPayment,
    cardPayment,
    bankPayment,
    othersPayment,
    activeHeldOrderId,
    pendingDraft,
    restoringHeldOrder,
    editingInvoice,
  ]);

  // Task B6 & Phase 1.1: Cart signature tracking & stable idempotency keys
  const cartSignature = useMemo(() => {
    return JSON.stringify({
      items: lineItems.map((ci) => ({
        id: ci.id,
        qty: ci.qty,
        rate: ci.rate,
        specialRate: ci.specialRate,
        discountPercent: ci.discountPercent,
        tokenAction: ci.tokenAction,
      })),
      discount: invoiceDiscount,
      delivery: deliveryCharge,
      clientId: selectedClient?.id || null,
      customerSearch,
      cash: cashPayment,
      card: cardPayment,
      bank: bankPayment,
      others: othersPayment,
    });
  }, [lineItems, invoiceDiscount, deliveryCharge, selectedClient, customerSearch, cashPayment, cardPayment, bankPayment, othersPayment]);

  // Reset idempotency keys whenever any cart property mutates
  useEffect(() => {
    activeCheckoutKeyRef.current = null;
    activeSpecialCheckoutKeyRef.current = null;
  }, [cartSignature]);
  const [notification, setNotification] = useState<string | null>(null);
  const [printReceiptData, setPrintReceiptData] = useState<any | null>(null);
  const [showTokenRedemptionModal, setShowTokenRedemptionModal] = useState<boolean>(false);
  const [specialBrandIds, setSpecialBrandIds] = useState<Set<string>>(new Set());

  // Load Special Receipt Brands lookup (TASK-SR-11)
  useEffect(() => {
    if (!tenantId || !canUseSpecialReceipt) return;
    let isMounted = true;
    const loadSpecialBrands = async () => {
      try {
        const res = await fetch(`/api/special-receipt-brands?tenant_id=${tenantId}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.brand_ids)) {
          setSpecialBrandIds(new Set(data.brand_ids.map((id: string) => String(id).trim().toLowerCase())));
        }
      } catch (err) {
        console.error('Failed to load special brands:', err);
      }
    };
    loadSpecialBrands();

    const handleFocus = () => {
      loadSpecialBrands();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [tenantId, canUseSpecialReceipt]);

  // Assigned receipt template for this branch (DEV-07)
  const [assignedTemplate, setAssignedTemplate] = useState<ReceiptTemplate | null>(null);
  const assignedTemplateRef = useRef<ReceiptTemplate | null>(assignedTemplate);
  assignedTemplateRef.current = assignedTemplate;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const discInputRef = useRef<HTMLInputElement>(null);
  const specialRateInputRef = useRef<HTMLInputElement>(null);
  const addItemBtnRef = useRef<HTMLButtonElement>(null);
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

  // Phase 3.4 & 3.8: Handlers for restoring / discarding detected cart draft
  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    const { cart } = pendingDraft;

    // Phase 3.8: Re-validate rates against live catalog
    const validation = validateCartDraftRates(cart.lineItems || [], liveItems || []);
    if (validation.hasChanges) {
      setRateWarnings(validation.warnings);
    } else {
      setRateWarnings(null);
    }

    setLineItems(cart.lineItems || []);
    setInvoiceType(cart.invoiceType || 'sales');
    setSelectedClient(cart.selectedClient || null);
    setCustomerSearch(cart.customerSearch || '');
    setRemarks(cart.remarks || '');
    setInvoiceDiscount(Number(cart.invoiceDiscount) || 0);
    setDeliveryCharge(Number(cart.deliveryCharge) || 0);
    setCashPayment(Number(cart.cashPayment) || 0);
    setCardPayment(Number(cart.cardPayment) || 0);
    setBankPayment(Number(cart.bankPayment) || 0);
    setOthersPayment(Number(cart.othersPayment) || 0);
    if (cart.activeCheckoutKey) activeCheckoutKeyRef.current = cart.activeCheckoutKey;
    if (cart.activeSpecialCheckoutKey) activeSpecialCheckoutKeyRef.current = cart.activeSpecialCheckoutKey;
    if (cart.activeHeldOrderId) setActiveHeldOrderId(cart.activeHeldOrderId);

    setPendingDraft(null);
    showFeedback('Cart restored from previous session.');
  };

  const handleDiscardDraft = () => {
    clearCartDraft(tenantId, effectiveBranchId, effectiveUserId);
    setPendingDraft(null);
    setRateWarnings(null);
    showFeedback('Unsaved draft discarded.');
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

  // Silent background refresh of assigned receipt template (focus, visibility, 45s interval)
  useEffect(() => {
    if (!tenantId) return;

    let isMounted = true;
    let inFlight = false;
    let currentController: AbortController | null = null;

    const performTemplateRefresh = async () => {
      // Prevent overlapping refresh calls within the active effect lifecycle
      if (inFlight) return;
      // Do not poll when document is hidden
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      inFlight = true;
      const controller = new AbortController();
      currentController = controller;

      try {
        const res = await fetch(`/api/receipt-templates/assign?tenant_id=${tenantId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          // Preserve last valid template and active billing state
          return;
        }

        const data = await res.json();
        if (isMounted && data.success && data.template) {
          const current = assignedTemplateRef.current;
          const incoming = data.template as ReceiptTemplate;

          // Compare print-affecting fields before replacing template in memory
          const isSame =
            current &&
            current.id === incoming.id &&
            current.paper_size === incoming.paper_size &&
            JSON.stringify(current.template_json) === JSON.stringify(incoming.template_json);

          if (!isSame) {
            assignedTemplateRef.current = incoming;
            setAssignedTemplate(incoming);
          }
        }
      } catch (err: any) {
        // Silent failure: preserve last valid template, active cart, and all billing state
        if (err.name !== 'AbortError') {
          console.debug('[PosBilling] Background template refresh skipped:', err.message);
        }
      } finally {
        inFlight = false;
      }
    };

    // Initial fetch on mount
    performTemplateRefresh();

    // Window focus and visibility listeners
    const handleFocus = () => {
      performTemplateRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performTemplateRefresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 45-second polling interval while mounted
    const intervalId = setInterval(performTemplateRefresh, 45000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (currentController) {
        currentController.abort();
      }
    };
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
        const res = await fetch(`/api/invoices?tenant_id=${tenantId}&client_id=${selectedClient.id}&limit=100&include_items=true`);
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
            if (inv.status === 'cancelled' || inv.invoice_type === 'return') continue;
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

  // 2. Fetch Persistent Parked Invoices from Supabase + merge local holds
  useEffect(() => {
    if (!tenantId) return;
    const fetchHeld = async () => {
      // Always load local holds first (works offline)
      const localHolds = loadLocalHolds(tenantId, effectiveBranchId, effectiveUserId);
      const localMapped: HeldOrder[] = localHolds.map((h) => ({
        id: h.localHoldId,
        localHoldId: h.localHoldId,
        isLocalOnly: true,
        hold_no: h.hold_no,
        customerName: h.clientName,
        selectedClient: clients.find((c) => c.id === h.clientId) || null,
        items: h.items || [],
        invoiceType: h.invoiceType,
        time: new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        total: Number(h.netTotal) || 0,
        subtotal: Number(h.subtotal) || 0,
        discount: Number(h.discount) || 0,
        delivery_charge: Number(h.deliveryCharge) || 0,
        remarks: h.remarks || '',
      }));

      // Try to fetch server holds (may fail offline — that's OK)
      let serverMapped: HeldOrder[] = [];
      try {
        const res = await fetch(`/api/held-invoices?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.held_invoices)) {
          serverMapped = data.held_invoices.map((h: any) => ({
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
        }
      } catch (err) {
        console.error('Failed to fetch server held invoices (may be offline)', err);
      }

      // Merge: server holds first, then local-only holds appended (no duplicates)
      // A local hold that has been synced (same local_hold_id returned by server) would have been
      // removed from localHolds already by the sync engine — so simple concatenation is safe.
      setHeldOrders([...serverMapped, ...localMapped]);
    };
    fetchHeld();
  }, [tenantId, clients, effectiveBranchId, effectiveUserId]);

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
      if (restoringHeldOrder.id) {
        setActiveHeldOrderId(restoringHeldOrder.id);
      }
      const rawItems = Array.isArray(restoringHeldOrder.items_json)
        ? restoringHeldOrder.items_json
        : Array.isArray(restoringHeldOrder.items)
        ? restoringHeldOrder.items
        : [];

      const restoredItems: InvoiceLineItem[] = rawItems.map((it: any, idx: number) => {
        const live = liveItems.find(
          (li) => li.id === (it.item?.id || it.item_id) || li.code === (it.code || it.item_code)
        );
        return {
          id: it.id || `restored-it-${idx}-${Date.now()}`,
          item: live || it.item,
          code: it.code || it.item_code || '',
          originalCode: it.originalCode || it.code || it.item_code,
          productName: it.productName || it.item_name || it.name || 'Product',
          originalName: it.originalName || it.productName || it.item_name,
          brand: it.brand || live?.brand || '',
          category: it.category || live?.category || '',
          shadeCode: it.shadeCode || it.shade_code || '—',
          originalShade: it.originalShade || it.shadeCode || it.shade_code,
          shadeColorHex: it.shadeColorHex || '#94A3B8',
          packSize: it.packSize || it.pack_size || 'Can',
          qty: Number(it.qty) || 1,
          unit: it.unit || 'PCS',
          rate: (() => {
            const heldIsReturn = (restoringHeldOrder.invoice_type || restoringHeldOrder.invoiceType) === 'return';
            const stored = Number(it.rate || it.unit_price) || 0;
            if (heldIsReturn || !live) return stored;
            // Rate lock: held bills re-price to the current catalog rate (token removal keeps its deduction)
            const base = Number(live.retail_price) || 0;
            const tokenVal = it.hasToken ?? live.has_token ? (Number(it.tokenValue ?? live.token_value) || 0) : 0;
            return (it.tokenAction === 'remove') ? Math.max(0, base - tokenVal) : base;
          })(),
          originalRate: (() => {
            const heldIsReturn = (restoringHeldOrder.invoice_type || restoringHeldOrder.invoiceType) === 'return';
            if (heldIsReturn || !live) return Number(it.originalRate || it.rate || it.unit_price) || 0;
            return Number(live.retail_price) || 0;
          })(),
          discountPercent: Number(it.discountPercent || it.discount_percent) || 0,
          specialRate: Number(it.specialRate) > 0 ? Number(it.specialRate) : undefined,
          hasToken: it.hasToken ?? live?.has_token ?? false,
          tokenValue: it.tokenValue ?? (live?.has_token ? Number(live?.token_value) || 0 : 0),
          tokenAction: it.tokenAction || 'keep',
          tokenReturnedWithBucket: it.tokenReturnedWithBucket,
        };
      });

      setLineItems(restoredItems);

      // Task 12.9 — FINDING-E2E-011 FIX: Stock re-check warning after held invoice restore.
      // Compare each item's held quantity against current live stock.
      // Items with insufficient stock are listed in a warning so the operator can adjust before selling.
      const understocked: string[] = [];
      for (const ri of restoredItems) {
        const liveStock = typeof ri.item?.stock_qty === 'number' ? ri.item.stock_qty : -1;
        if (liveStock < 0) continue; // Unknown stock — skip
        if (liveStock < ri.qty) {
          const label = ri.productName + (ri.shadeCode && ri.shadeCode !== '—' ? ` (${ri.shadeCode})` : '');
          understocked.push(`${label}: need ${ri.qty}, have ${liveStock}`);
        }
      }

      if (understocked.length > 0) {
        setNotification(
          `⚠️ Stock Warning: The following held items may be unavailable — ${understocked.join(' | ')}. Please adjust quantities before completing the sale.`
        );
      }

      if (restoringHeldOrder.client_name) {
        setCustomerSearch(stripWalkInSuffix(restoringHeldOrder.client_name));
      }
      if (restoringHeldOrder.client_id && clients.length > 0) {
        const found = clients.find((c) => c.id === restoringHeldOrder.client_id);
        if (found) setSelectedClient(found);
      } else if (restoringHeldOrder.selectedClient) {
        setSelectedClient(restoringHeldOrder.selectedClient);
      }
      if (restoringHeldOrder.invoice_type) {
        setInvoiceType(restoringHeldOrder.invoice_type);
      }
      setInvoiceDiscount(Number(restoringHeldOrder.discount) || 0);
      setDeliveryCharge(Number(restoringHeldOrder.delivery_charge) || 0);
      setRemarks(restoringHeldOrder.remarks || '');
      setIsCashManuallyEdited(false);
      showFeedback(`Restored parked order ${restoringHeldOrder.hold_no || ''}.`);
      onClearRestoringHeldOrder?.();
    }
  }, [restoringHeldOrder, clients, liveItems]);

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
        setCustomerSearch(stripWalkInSuffix(editingInvoice.client_name));
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
    let effectiveRate = item.specialRate && item.specialRate > 0 ? item.specialRate : item.rate;
    if (invoiceType === 'return' && item.hasToken && item.tokenReturnedWithBucket === false) {
      effectiveRate = Math.max(0, effectiveRate - (item.tokenValue || 0));
    }
    const lineGross = effectiveRate * item.qty;
    const lineDiscount = (lineGross * item.discountPercent) / 100;
    return sum + (lineGross - lineDiscount);
  }, 0);

  const totalItemDiscount = lineItems.reduce((sum, item) => {
    let effectiveRate = item.specialRate && item.specialRate > 0 ? item.specialRate : item.rate;
    if (invoiceType === 'return' && item.hasToken && item.tokenReturnedWithBucket === false) {
      effectiveRate = Math.max(0, effectiveRate - (item.tokenValue || 0));
    }
    const lineGross = effectiveRate * item.qty;
    return sum + (lineGross * item.discountPercent) / 100;
  }, 0);

  const netTotal = Math.max(0, itemSubtotal - invoiceDiscount + deliveryCharge);
  const totalPaid = cashPayment + cardPayment + bankPayment + othersPayment;
  const balanceDue = netTotal - totalPaid;

  // TASK-SR-13: Dynamic Blink / Pulse Animation on Brand Match (only pulses when cart contains items from configured brands)
  const shouldBlinkSpecial = useMemo(() => {
    if (!canUseSpecialReceipt || lineItems.length === 0 || specialBrandIds.size === 0) {
      return false;
    }

    return lineItems.some((li) => {
      const bId = li.brand_id || li.item?.brand_id;
      if (!bId) return false;
      return specialBrandIds.has(String(bId).trim().toLowerCase());
    });
  }, [canUseSpecialReceipt, lineItems, specialBrandIds]);

  // Auto-sync cash payment continuously whenever netTotal or other tenders change (if cash not manually locked)
  useEffect(() => {
    if (!isCashManuallyEdited) {
      const otherTenders = cardPayment + bankPayment + othersPayment;
      const remainingCash = Math.max(0, Math.round((netTotal - otherTenders) * 100) / 100);
      if (lineItems.length > 0) {
        setCashPayment(remainingCash);
      } else {
        setCashPayment(0);
      }
    }
  }, [netTotal, lineItems.length, isCashManuallyEdited, cardPayment, bankPayment, othersPayment]);

  // Helper for shade info — always use the product's own shade_code from DB.
  const getShadeInfo = (item: Item) => {
    if (item.shade_code) {
      return { shadeCode: item.shade_code, shadeColorHex: '#94A3B8' };
    }
    return { shadeCode: '—', shadeColorHex: '#94A3B8' };
  };

  // Add Item to table with stock validation and immutable state updates
  // Walk-in rule: nothing proceeds until a customer is picked or a walk-in name is typed
  const blockForCustomerName = (): boolean => {
    if (!needsCustomerName) return false;
    showFeedback('Pehle customer select karein ya walk-in customer ka naam likhein.');
    customerInputRef.current?.focus();
    return true;
  };

  // Special-brand rule: for users with special receipt access, every special-brand item on a sale needs a Special Rate
  const isSpecialBrandItem = (it: { brand_id?: string | null } | null | undefined): boolean =>
    canUseSpecialReceipt && invoiceType === 'sales' && Boolean(it?.brand_id) && specialBrandIds.has(String(it?.brand_id));

  const handleAddItem = (specificItem?: Item, overrideRate?: number, skipCheck: boolean = false, overrideDiscount?: number) => {
    if (blockForCustomerName()) return;
    const prod = specificItem || selectedProduct;
    if (!prod) {
      if (filteredCatalog.length === 1) {
        handleAddItem(filteredCatalog[0], overrideRate, skipCheck, overrideDiscount);
      }
      return;
    }

    // Check if registered customer previously bought this product before adding
    // Rate lock: previous/current rate choice only exists for return bills; sales always use the catalog rate
    if (invoiceType === 'return' && selectedClient && !skipCheck && overrideRate === undefined) {
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
        if (!allowNegativeStock) {
          showFeedback(`Insufficient stock! Available: ${availableStock} ${prod.unit || 'PCS'}`);
          return;
        }
        // Negative stock allowed — warn but proceed
        showFeedback(`⚠️ Stock will go negative (${availableStock - totalQtyRequested} ${prod.unit || 'PCS'}). Sale proceeding...`);
      }
    }

    const { shadeCode, shadeColorHex } = getShadeInfo(prod);
    const hasToken = Boolean(prod.has_token && (Number(prod.token_value) || 0) > 0);
    const tokenVal = hasToken ? Number(prod.token_value) || 0 : 0;
    // Use overrideRate if provided; fall back to inputRate (if set by keyboard chain) then retail_price
    const ratesLocked = invoiceType !== 'return';
    const itemRate = ratesLocked
      ? (prod.retail_price || 0)
      : (overrideRate !== undefined ? overrideRate : (inputRate > 0 ? inputRate : (prod.retail_price || 0)));
    const itemDiscount = overrideDiscount !== undefined ? overrideDiscount : (inputDiscount > 0 ? inputDiscount : 0);
    const itemSpecialRate = canUseSpecialReceipt && inputSpecialRate > 0 ? inputSpecialRate : undefined;
    if (isSpecialBrandItem(prod) && itemSpecialRate === undefined) {
      showFeedback('Special brand ka item hai — Special Rate likhna zaroori hai.');
      setSelectedProduct(prod);
      setInputRate(prod.retail_price || 0);
      setProductQuery(`${prod.name}${prod.shade_code ? ` (${prod.shade_code})` : ''}`);
      setShowProductDropdown(false);
      setTimeout(() => specialRateInputRef.current?.focus(), 60);
      return;
    }
    if (itemSpecialRate !== undefined && itemSpecialRate > itemRate) {
      showFeedback('Special Rate, Rate se zyada nahi ho sakta.');
      return;
    }

    if (existingIndex >= 0) {
      setLineItems((prev) =>
        prev.map((li, idx) =>
          idx === existingIndex
            ? { ...li, qty: li.qty + requestedQty, rate: ratesLocked ? li.rate : (overrideRate !== undefined ? overrideRate : (inputRate > 0 ? inputRate : li.rate)), discountPercent: itemDiscount, specialRate: itemSpecialRate }
            : li
        )
      );
    } else {
      const newLineItem: InvoiceLineItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `li-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        item: prod,
        code: prod.code,
        originalCode: prod.code,
        productName: prod.name,
        originalName: prod.name,
        brand: prod.brand,
        brand_id: prod.brand_id,
        series_id: prod.series_id,
        series_name: prod.series_name,
        category: prod.category,
        shadeCode,
        originalShade: shadeCode,
        shadeColorHex,
        packSize: prod.pack_size || prod.unit || 'Can',
        qty: requestedQty,
        unit: prod.unit || 'PCS',
        rate: itemRate,
        originalRate: itemRate,
        discountPercent: itemDiscount,
        specialRate: itemSpecialRate,
        hasToken,
        tokenValue: tokenVal,
        tokenAction: 'keep',
      };
      setLineItems((prev) => [...prev, newLineItem]);
    }

    // Reset all entry-row inputs and return focus to search
    setProductQuery('');
    setSelectedProduct(null);
    setInputQty(1);
    setInputRate(0);
    setInputDiscount(0);
    setInputSpecialRate(0);
    setShowProductDropdown(false);
    setTimeout(() => searchInputRef.current?.focus(), 30);
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
        if (!allowNegativeStock) {
          showFeedback(`Cannot exceed available stock (${availableStock} ${targetItem.unit})`);
          return;
        }
        // Negative stock allowed — warn but proceed
        showFeedback(`⚠️ Stock will go negative (${availableStock - newQty} ${targetItem.unit}). Proceeding...`);
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
    if (blockForCustomerName()) return;

    const holdNo = `HOLD-${Date.now().toString().slice(-4)}`;
    const customerDisplayName = selectedClient?.name || formatWalkInName(customerSearch);

    try {
      const res = await fetchWithTimeout('/api/held-invoices', {
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
        timeoutMs: 15000,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order on hold.');
      }
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
        subtotal: itemSubtotal,
        discount: invoiceDiscount,
        delivery_charge: deliveryCharge,
        remarks,
      };

      if (activeHeldOrderId) {
        try {
          await fetchWithTimeout(`/api/held-invoices?id=${activeHeldOrderId}`, { method: 'DELETE', timeoutMs: 10000 });
        } catch (err) {
          console.error('Failed to clean up old held order on re-hold:', err);
        }
        setActiveHeldOrderId(null);
      }

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
      clearCartDraft(tenantId, effectiveBranchId, effectiveUserId);
      setRateWarnings(null);
      reportNetworkSuccess();
      reportNetworkSuccess();
      showFeedback(`Invoice ${invoiceNo} placed on hold in database.`);
    } catch (err: any) {
      console.error('Failed to park order in DB', err);
      if (isNetworkOrTimeoutError(err)) {
        reportNetworkError();
        // ── Phase 5.1: Network failure → save hold locally ──────────────────
        // Generate a UUID as the stable idempotency key for this hold.
        const crypto = globalThis.crypto || (await import('crypto')).webcrypto;
        const localHoldId = crypto.randomUUID();
        const offlineHoldNo = generateOfflineHoldNo();
        const localHold: LocalHoldItem = {
          localHoldId,
          schemaVersion: LOCAL_HOLD_SCHEMA_VERSION,
          tenantId,
          branchId: effectiveBranchId,
          userId: effectiveUserId,
          hold_no: offlineHoldNo,
          clientId: selectedClient?.id || null,
          clientName: customerDisplayName,
          invoiceType,
          items: lineItems,
          subtotal: itemSubtotal,
          discount: invoiceDiscount,
          deliveryCharge,
          netTotal,
          remarks,
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        // Atomic: save MUST succeed before clearing cart (Task 5.1 — never lose data)
        const saved = addLocalHold(localHold);
        if (!saved) {
          showFeedback(
            'Internet issue + could not save locally. Please check storage. Cart not cleared.',
          );
          return;
        }
        // Add to in-memory held list with local badge
        const localHeldOrder: HeldOrder = {
          id: localHoldId,
          localHoldId,
          isLocalOnly: true,
          hold_no: offlineHoldNo,
          customerName: customerDisplayName,
          selectedClient,
          items: lineItems,
          invoiceType,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          total: netTotal,
          subtotal: itemSubtotal,
          discount: invoiceDiscount,
          delivery_charge: deliveryCharge,
          remarks,
        };
        setHeldOrders((prev) => [localHeldOrder, ...prev]);
        setLineItems([]);
        setCashPayment(0);
        setIsCashManuallyEdited(false);
        setCardPayment(0);
        setBankPayment(0);
        setOthersPayment(0);
        setInvoiceDiscount(0);
        setDeliveryCharge(0);
        setRemarks('');
        clearCartDraft(tenantId, effectiveBranchId, effectiveUserId);
        setRateWarnings(null);
        showFeedback(
          `Offline: order saved on this device (${offlineHoldNo}). Will sync when connection returns.`,
        );
      } else {
        showFeedback(err?.message || 'Failed to hold order.');
      }
    }
  };

  const handleRestoreHeld = (order: HeldOrder) => {
    const restoredItems: InvoiceLineItem[] = (order.items || []).map((it) => {
      const live = liveItems.find((li) => li.id === (it.item?.id || (it as any).item_id) || li.code === it.code);
      return {
        ...it,
        item: live || it.item,
        brand: it.brand || live?.brand || '',
        category: it.category || live?.category || '',
      };
    });

    setLineItems(restoredItems);
    setSelectedClient(order.selectedClient);
    setCustomerSearch(stripWalkInSuffix(order.customerName));
    setInvoiceType(order.invoiceType);
    setInvoiceDiscount(Number(order.discount) || 0);
    setDeliveryCharge(Number(order.delivery_charge) || 0);
    setRemarks(order.remarks || '');
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));

    if (order.isLocalOnly && order.localHoldId) {
      // Task 5.4: local hold restored offline — keep it in localHoldStore as 'pending'
      // so it still syncs to the server on reconnect. Do NOT set activeHeldOrderId
      // (there's no server DB row to delete yet). The sync engine will push it, and
      // after server success the local copy is removed automatically.
      // We do NOT call removeLocalHold here because the hold hasn't synced yet.
    } else if (order.dbId) {
      // Server hold: track the DB id so we delete it on checkout
      setActiveHeldOrderId(order.dbId);
    }

    setIsCashManuallyEdited(false);
    setShowHeldModal(false);
    showFeedback(`Restored order for ${order.customerName}.`);
  };

  const handleDeleteHeld = async (order: HeldOrder) => {
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
    if (order.isLocalOnly && order.localHoldId) {
      // Remove from local store (user explicitly discarded an offline hold)
      removeLocalHold(tenantId, effectiveBranchId, effectiveUserId, order.localHoldId);
    } else if (order.dbId) {
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
    setActiveHeldOrderId(null);
    clearCartDraft(tenantId, effectiveBranchId, effectiveUserId);
    setRateWarnings(null);
    if (editingInvoice) {
      onClearEditingInvoice?.();
      setInvoiceNo(`INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`);
      showFeedback('Exited invoice editing.');
    } else {
      showFeedback('Invoice cleared.');
    }
  };

  // Checkout and Database Persistence
  // Cart lines of special brands that still miss a Special Rate (remove and re-add them with a Special Rate)
  const specialBrandLineMissingRate = () =>
    editingInvoice ? undefined : lineItems.find((li) => isSpecialBrandItem(li.item || undefined) && !(li.specialRate && li.specialRate > 0));

  const handleCheckout = async (openPrint = true) => {
    if (lineItems.length === 0 || submitting || isSubmittingRef.current) {
      if (lineItems.length === 0) {
        showFeedback('Please add at least one item before checkout.');
      }
      return;
    }
    if (blockForCustomerName()) {
      return;
    }
    {
      const missingSpecial = specialBrandLineMissingRate();
      if (missingSpecial) {
        showFeedback(`"${missingSpecial.productName}" par Special Rate zaroori hai. Item hata kar Special Rate ke saath dobara add karein.`);
        return;
      }
    }
    if (lineItems.some((li) => li.specialRate && li.specialRate > 0)) {
      showFeedback('Cart mein Special Rate lagi hui hai. Is sale ke liye "Special Save & Print (F6)" use karein, ya Special Rate hata dein.');
      return;
    }
    setSubmitting(true);
    isSubmittingRef.current = true;

    const roundedNetTotal = Math.round(netTotal * 100) / 100;
    const nonCashPaid = Math.round((cardPayment + bankPayment + othersPayment) * 100) / 100;

    // Hard Stop: Block checkout if non-cash tenders exceed Net Total
    if (nonCashPaid > roundedNetTotal) {
      showFeedback(`Non-cash payment (Rs. ${nonCashPaid.toLocaleString()}) exceeds Net Total (Rs. ${roundedNetTotal.toLocaleString()}). Please correct tender amounts.`);
      isSubmittingRef.current = false;
      setSubmitting(false);
      return;
    }

    const maxCashRetained = Math.max(0, Math.round((roundedNetTotal - nonCashPaid) * 100) / 100);
    const actualCashRetained = Math.min(cashPayment, maxCashRetained);
    const cashChangeReturned = Math.max(0, Math.round((cashPayment - actualCashRetained) * 100) / 100);

    const computedTotalPaid = Math.round((actualCashRetained + nonCashPaid) * 100) / 100;
    const rawDue = roundedNetTotal - computedTotalPaid;
    const finalDue = rawDue > 0.01 ? Math.round(rawDue * 100) / 100 : 0;
    const finalPaid = computedTotalPaid;
    const isCreditSale = finalDue > 0;

    // Hard Stop: Block credit/debt sales for walk-in (no account) customers
    if (!selectedClient && isCreditSale) {
      showFeedback('Cannot sell on credit to a walk-in customer. Please select a registered customer account, or collect full payment before completing this sale.');
      isSubmittingRef.current = false;
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
        isSubmittingRef.current = false;
        setSubmitting(false);
        return;
      }
    }

    const customerDisplayName = selectedClient ? selectedClient.name : formatWalkInName(customerSearch);

    // Determine clean payment_type
    let determinedPaymentType = 'cash';
    if (isCreditSale) {
      determinedPaymentType = 'credit';
    } else {
      const hasCard = cardPayment > 0;
      const hasBank = bankPayment > 0;
      const hasOthers = othersPayment > 0;
      const hasCash = actualCashRetained > 0;

      const nonCashCount = (hasCard ? 1 : 0) + (hasBank ? 1 : 0) + (hasOthers ? 1 : 0);
      const totalModes = nonCashCount + (hasCash ? 1 : 0);

      if (totalModes > 1) {
        determinedPaymentType = 'split';
      } else if (hasCard) {
        determinedPaymentType = 'card';
      } else if (hasBank) {
        determinedPaymentType = 'bank';
      } else if (hasOthers) {
        determinedPaymentType = 'others';
      } else {
        determinedPaymentType = 'cash';
      }
    }

    const invoicePayload = {
      tenant_id: tenantId,
      invoice_no: invoiceNo,
      client_id: selectedClient?.id || null,
      client_name: customerDisplayName,
      shift_id: shiftId || null,
      date: invoiceDate,
      subtotal: itemSubtotal,
      discount: invoiceDiscount,
      delivery_charge: deliveryCharge,
      remarks: remarks || null,
      invoice_type: invoiceType,
      net_total: roundedNetTotal,
      paid_amount: finalPaid,
      due_amount: finalDue,
      payment_type: determinedPaymentType,
      cash_paid: actualCashRetained,
      card_paid: cardPayment,
      bank_paid: bankPayment,
      others_paid: othersPayment,
      status: 'completed',
      created_by: staffName || 'Counter Staff',
      items: lineItems.map((ci) => {
        let effectiveRate = ci.rate;
        if (invoiceType === 'return' && ci.hasToken && ci.tokenReturnedWithBucket === false) {
          effectiveRate = Math.max(0, effectiveRate - (ci.tokenValue || 0));
        }
        return {
          item_id: ci.item?.id || null,
          item_code: ci.code,
          item_name: ci.productName,
          shade_code: ci.shadeCode,
          pack_size: ci.packSize,
          unit: ci.unit,
          qty: ci.qty,
          unit_price: effectiveRate,
          discount: (effectiveRate * ci.qty * ci.discountPercent) / 100,
          discount_percent: ci.discountPercent,
          total_price: effectiveRate * ci.qty * (1 - ci.discountPercent / 100),
          // Token attributes for atomic server-side processing
          has_token: ci.hasToken,
          token_value: ci.tokenValue,
          token_action: ci.tokenAction || 'keep',
          brand_id: ci.brand_id || ci.item?.brand_id || null,
          brand_name: ci.brand || ci.item?.brand || null,
          series_id: ci.series_id || ci.item?.series_id || null,
          series_name: ci.series_name || ci.item?.series_name || null,
        };
      }),
    };

    try {
      const isEditingExisting = Boolean(editingInvoice?.id);
      const apiEndpoint = '/api/invoices';
      const apiMethod = isEditingExisting ? 'PATCH' : 'POST';

      const keyToUse = activeCheckoutKeyRef.current || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      if (!activeCheckoutKeyRef.current) {
        activeCheckoutKeyRef.current = keyToUse;
      }

      const payloadToSend = isEditingExisting
        ? { id: editingInvoice.id, edit_reason: editingInvoice.edit_reason || '', ...invoicePayload }
        : { ...invoicePayload, invoice_no: undefined, idempotency_key: keyToUse };

      // Phase 2: Verify-Before-Retry loop with timeout
      let res: Response | null = null;
      let lastNetworkErr: any = null;
      const MAX_VERIFY_ATTEMPTS = 2;

      for (let attempt = 0; attempt <= MAX_VERIFY_ATTEMPTS; attempt++) {
        try {
          if (attempt > 0) {
            setVerifyState({
              isVerifying: true,
              statusMessage: 'Verifying sale with server… Please wait / Sale check ho rahi hai, baraye mehrbani intezar karein…',
            });
            await new Promise((r) => setTimeout(r, 1500));
          }

          res = await fetchWithTimeout(apiEndpoint, {
            method: apiMethod,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadToSend),
            timeoutMs: 20000,
          });

          lastNetworkErr = null;
          break;
        } catch (fetchErr: any) {
          lastNetworkErr = fetchErr;
          if (!isNetworkOrTimeoutError(fetchErr)) {
            throw fetchErr;
          }
          reportNetworkError();
          console.warn(`[Checkout] Network issue on attempt ${attempt + 1}:`, fetchErr.message);
        }
      }

      setVerifyState(null);

      if (lastNetworkErr || !res) {
        setVerifyState({
          isVerifying: false,
          failedAfterRetries: true,
          errorMessage: 'Connection lost. Sale could not be confirmed. (Internet band hai — sale abhi confirm nahi hui. Dobara enter mat karein; "Retry" dabayein ya offline save karein.)',
          retryAction: () => handleCheckout(openPrint),
        });
        return;
      }

      const data = await res.json();

      if (res.status === 409) {
        showFeedback(`⚠️ Cart Conflict: ${data.error || 'Cart contents changed during checkout attempt.'}`);
        activeCheckoutKeyRef.current = null;
        return;
      }

      if (data.success) {
        const finalServerInvoiceNo = data.invoice?.invoice_no || invoiceNo;

        if (data.is_duplicate) {
          showFeedback('Sale successfully recorded! (Sale pehle hi record ho chuki hai)');
        }

        const receiptItems = lineItems.map((ci) => {
          let effectiveRate = ci.rate;
          if (invoiceType === 'return' && ci.hasToken && ci.tokenReturnedWithBucket === false) {
            effectiveRate = Math.max(0, effectiveRate - (ci.tokenValue || 0));
          }
          return {
            ...ci,
            rate: effectiveRate,
            unit_price: effectiveRate,
          };
        });

        const completedInvoice: any = {
          ...data.invoice,
          invoice_no: finalServerInvoiceNo,
          grandTotal: netTotal,
          subTotal: itemSubtotal,
          discount: invoiceDiscount,
          delivery_charge: deliveryCharge,
          paid_amount: finalPaid,
          due_amount: finalDue,
          payment_type: determinedPaymentType,
          cash_paid: actualCashRetained,
          card_paid: cardPayment,
          bank_paid: bankPayment,
          others_paid: othersPayment,
          change_returned: cashChangeReturned,
          date: invoiceDate,
          time: new Date().toLocaleTimeString(),
          items: receiptItems,
          client_name: customerDisplayName,
          tenantName,
          staffName,
        };

        // Task 12.8 — FINDING-E2E-003: Embed walk-in token claim code in receipt data.
        // Applicable when: anonymous customer (no account), kept token (tokenAction='keep').
        // Code is purely for the printed receipt slip so customer can reference it later.
        const walkInTokenItems = receiptItems.filter(
          (ci: any) => ci.hasToken && (ci.tokenValue || 0) > 0 && (ci.tokenAction || 'keep') === 'keep' && !selectedClient
        );
        if (walkInTokenItems.length > 0) {
          const code = `CLM-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
          const details = walkInTokenItems.map((ci: any) =>
            `${ci.productName}: ${ci.qty} token(s) @ Rs. ${ci.tokenValue} each`
          ).join(' | ');
          completedInvoice.token_claim_code = code;
          completedInvoice.token_claim_details = details;
        }

        onCompleteSale(completedInvoice);
        if (openPrint) {
          setPrintReceiptData(completedInvoice);
          showFeedback(isEditingExisting ? `Invoice #${finalServerInvoiceNo} updated & printing...` : `Invoice ${finalServerInvoiceNo} finalized & printing...`);
          // UX-01: Print via hidden iframe — avoids popup blocker on post-async calls (DEV-07: applies assigned template)
          const iframeHtml = buildPosThermalHtml(completedInvoice, tenantName, staffName, assignedTemplate);
          const printOk = printViaIframe(iframeHtml);
          if (!printOk) {
            showFeedback(`Invoice ${finalServerInvoiceNo} saved, but printing failed. Reprint from Sales History.`);
          }
        } else {
          setPrintReceiptData(null);
          showFeedback(isEditingExisting ? `Invoice #${finalServerInvoiceNo} updated successfully.` : `Invoice ${finalServerInvoiceNo} saved to database.`);
        }

        if (isEditingExisting) {
          onClearEditingInvoice?.();
        }

        // BUG-03 FIX: Delete held invoice from database only after checkout is successfully completed
        if (activeHeldOrderId) {
          try {
            await fetchWithTimeout(`/api/held-invoices?id=${activeHeldOrderId}`, { method: 'DELETE', timeoutMs: 10000 });
          } catch (delHeldErr) {
            console.error('Failed to remove held invoice after checkout:', delHeldErr);
          }
          setActiveHeldOrderId(null);
        }

        // Reset state for next customer
        setLineItems([]);
        setSelectedClient(null);
        setCustomerSearch('');
        setCashPayment(0);
        setIsCashManuallyEdited(false);
        setCardPayment(0);
        setBankPayment(0);
        setOthersPayment(0);
        setInvoiceDiscount(0);
        setDeliveryCharge(0);
        setRemarks('');
        setInvoiceNo(`INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`);
        activeCheckoutKeyRef.current = null;
        clearCartDraft(tenantId, effectiveBranchId, effectiveUserId);
        setRateWarnings(null);
        reportNetworkSuccess();
      } else {
        showFeedback(`Failed to save invoice: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      if (isNetworkOrTimeoutError(err)) {
        setVerifyState({
          isVerifying: false,
          failedAfterRetries: true,
          errorMessage: 'Connection lost. Sale could not be confirmed. (Internet band hai — sale abhi confirm nahi hui. Dobara enter mat karein; "Retry" dabayein ya offline save karein.)',
          retryAction: () => handleCheckout(openPrint),
        });
      } else {
        showFeedback(`Error: ${err.message || 'Failed to complete sale'}`);
      }
    } finally {
      isSubmittingRef.current = false;
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

  // Special Save & Print: saves via /api/invoices/special and opens the browser print preview directly (no modal).
  // Receipt prints the cart `rate` (original); customer is charged the Special Rate (per unit) minus Disc %.
  const handleSpecialDirect = async () => {
    if (!canUseSpecialReceipt || submitting || isSubmittingRef.current) return;
    if (blockForCustomerName()) return;
    {
      const missingSpecial = specialBrandLineMissingRate();
      if (missingSpecial) {
        showFeedback(`"${missingSpecial.productName}" par Special Rate zaroori hai. Item hata kar Special Rate ke saath dobara add karein.`);
        return;
      }
    }
    if (lineItems.length === 0) {
      showFeedback('Please add at least one item before checkout.');
      return;
    }
    if (invoiceType !== 'sales') {
      showFeedback('Special Save & Print sirf sales invoice ke liye hai.');
      return;
    }
    if (editingInvoice?.id) {
      showFeedback('Existing invoice edit karte waqt Special Save & Print available nahi.');
      return;
    }
    if (invoiceDiscount > 0) {
      showFeedback('Special sale mein invoice discount allowed nahi. Line Disc % ya Special Rate use karein.');
      return;
    }
    isSubmittingRef.current = true;
    setSubmitting(true);

    const specialLines = lineItems.map((ci) => {
      const qty = Number(ci.qty) || 1;
      const printedRate = Number(ci.rate) || 0;
      const chargedRate = ci.specialRate && ci.specialRate > 0 ? Math.min(ci.specialRate, printedRate) : printedRate;
      const gross = qty * printedRate;
      const lineTotal = Math.round(qty * chargedRate * (1 - (ci.discountPercent || 0) / 100) * 100) / 100;
      const lineDiscount = Math.round((gross - lineTotal) * 100) / 100;
      const discPct = gross > 0 ? Math.round((lineDiscount / gross) * 100 * 100) / 100 : 0;
      return { ci, qty, printedRate, lineTotal, lineDiscount, discPct };
    });

    const linesTotal = Math.round(specialLines.reduce((a, l) => a + l.lineTotal, 0) * 100) / 100;
    const roundedNetTotal = Math.round((linesTotal + Number(deliveryCharge || 0)) * 100) / 100;
    const nonCashPaid = Math.round((cardPayment + bankPayment + othersPayment) * 100) / 100;

    if (nonCashPaid > roundedNetTotal) {
      showFeedback(`Non-cash payment (Rs. ${nonCashPaid.toLocaleString()}) exceeds Net Total (Rs. ${roundedNetTotal.toLocaleString()}). Please correct tender amounts.`);
      isSubmittingRef.current = false;
      setSubmitting(false);
      return;
    }

    const maxCashRetained = Math.max(0, Math.round((roundedNetTotal - nonCashPaid) * 100) / 100);
    const actualCashRetained = Math.min(cashPayment, maxCashRetained);
    const finalPaid = Math.round((actualCashRetained + nonCashPaid) * 100) / 100;
    const rawDue = roundedNetTotal - finalPaid;
    const finalDue = rawDue > 0.01 ? Math.round(rawDue * 100) / 100 : 0;

    if (!selectedClient && finalDue > 0) {
      showFeedback('Cannot sell on credit to a walk-in customer. Please select a registered customer account, or collect full payment before completing this sale.');
      isSubmittingRef.current = false;
      setSubmitting(false);
      return;
    }
    if (selectedClient && finalDue > 0) {
      const currentBal = Number(selectedClient.current_balance) || 0;
      const limit = Number(selectedClient.credit_limit) || 0;
      if (limit > 0 && currentBal + finalDue > limit) {
        showFeedback(`Insufficient credit limit. Available limit: Rs. ${Math.max(0, limit - currentBal).toLocaleString()}`);
        isSubmittingRef.current = false;
        setSubmitting(false);
        return;
      }
    }

    const customerDisplayName = selectedClient ? selectedClient.name : formatWalkInName(customerSearch);
    const modesUsed =
      (actualCashRetained > 0 ? 1 : 0) + (cardPayment > 0 ? 1 : 0) + (bankPayment > 0 ? 1 : 0) + (othersPayment > 0 ? 1 : 0);
    let resolvedPaymentType = 'cash';
    if (finalDue > 0) resolvedPaymentType = 'credit';
    else if (modesUsed > 1 || othersPayment > 0) resolvedPaymentType = 'split';
    else if (cardPayment > 0) resolvedPaymentType = 'card';
    else if (bankPayment > 0) resolvedPaymentType = 'bank';

    // Phase 1.1 & 1.2: Stable idempotency key across retries
    const keyToUse =
      activeSpecialCheckoutKeyRef.current ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-spl-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    if (!activeSpecialCheckoutKeyRef.current) {
      activeSpecialCheckoutKeyRef.current = keyToUse;
    }

    const payload = {
      tenant_id: tenantId,
      invoice_no: invoiceNo,
      idempotency_key: keyToUse,
      client_id: selectedClient?.id || null,
      client_name: customerDisplayName,
      shift_id: shiftId || null,
      date: new Date().toISOString().split('T')[0],
      subtotal: linesTotal,
      discount: 0,
      delivery_charge: Number(deliveryCharge || 0),
      remarks: remarks || null,
      net_total: roundedNetTotal,
      paid_amount: finalPaid,
      due_amount: finalDue,
      payment_type: resolvedPaymentType,
      cash_paid: actualCashRetained,
      card_paid: cardPayment,
      bank_paid: bankPayment,
      others_paid: othersPayment,
      items: specialLines.map(({ ci, qty, printedRate, lineTotal, lineDiscount, discPct }) => ({
        item_id: ci.item?.id || null,
        item_code: ci.code,
        item_name: ci.productName,
        shade_code: ci.shadeCode,
        pack_size: ci.packSize,
        unit: ci.unit,
        qty,
        unit_price: printedRate,
        pre_discount_rate: printedRate,
        discount: lineDiscount,
        discount_percent: discPct,
        total_price: lineTotal,
        receipt_name: (ci.productName || '').trim() || ci.productName,
        receipt_shade: (ci.shadeCode || '').trim() || undefined,
        receipt_pack_size: (ci.packSize || '').trim() || ci.unit,
        receipt_notes: undefined,
        has_token: ci.hasToken,
        token_value: ci.tokenValue,
        token_action: ci.tokenAction || 'keep',
      })),
      receipt_snapshot: {
        header_note: undefined,
        footer_note: undefined,
        delivery_charge: Number(deliveryCharge || 0),
        payment_type: resolvedPaymentType,
        paid_amount: finalPaid,
        due_amount: finalDue,
      },
    };

    // Phase 2: Verify-Before-Retry loop with timeout for special sale
    let res: Response | null = null;
    let lastNetworkErr: any = null;
    const MAX_VERIFY_ATTEMPTS = 2;

    for (let attempt = 0; attempt <= MAX_VERIFY_ATTEMPTS; attempt++) {
      try {
        if (attempt > 0) {
          setVerifyState({
            isVerifying: true,
            statusMessage: 'Verifying sale with server… Please wait / Sale check ho rahi hai, baraye mehrbani intezar karein…',
          });
          await new Promise((r) => setTimeout(r, 1500));
        }

        res = await fetchWithTimeout('/api/invoices/special', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          timeoutMs: 20000,
        });

        lastNetworkErr = null;
        break;
      } catch (fetchErr: any) {
        lastNetworkErr = fetchErr;
        if (!isNetworkOrTimeoutError(fetchErr)) {
          throw fetchErr;
        }
        reportNetworkError();
        console.warn(`[Special Direct] Network issue on attempt ${attempt + 1}:`, fetchErr.message);
      }
    }

    setVerifyState(null);

    if (lastNetworkErr || !res) {
      setVerifyState({
        isVerifying: false,
        failedAfterRetries: true,
        errorMessage: 'Connection lost. Sale could not be confirmed. (Internet band hai — sale abhi confirm nahi hui. Dobara enter mat karein; "Retry" dabayein ya offline save karein.)',
        retryAction: () => handleSpecialDirect(),
      });
      return;
    }

    try {
      const resData = await res.json();

      if (res.status === 409) {
        showFeedback(`⚠️ Cart Conflict: ${resData.error || 'Cart contents changed during special checkout attempt.'}`);
        activeSpecialCheckoutKeyRef.current = null;
        return;
      }

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to record special sale.');
      }

      if (resData.snapshot) {
        const enrichedSnapshot = {
          ...resData.snapshot,
          payment_type: resData.snapshot.payment_type || resolvedPaymentType,
          paid_amount: resData.snapshot.paid_amount ?? finalPaid,
          due_amount: resData.snapshot.due_amount ?? finalDue,
          client_name: resData.snapshot.client_name || customerDisplayName,
          invoice_no: resData.snapshot.invoice_no || invoiceNo,
          show_sales_return: true,
        };
        printViaIframe(buildSpecialReceiptHtml(enrichedSnapshot, resData.template));
      }

      const savedInvoice = resData.invoice || { invoice_no: invoiceNo };
      onCompleteSale(savedInvoice);

      if (activeHeldOrderId) {
        try {
          await fetchWithTimeout(`/api/held-invoices?id=${activeHeldOrderId}`, { method: 'DELETE', timeoutMs: 10000 });
        } catch (delHeldErr) {
          console.error('Failed to remove held invoice after special checkout:', delHeldErr);
        }
        setActiveHeldOrderId(null);
      }

      setLineItems([]);
      setRemarks('');
      setInvoiceDiscount(0);
      setDeliveryCharge(0);
      setCashPayment(0);
      setCardPayment(0);
      setBankPayment(0);
      setOthersPayment(0);
      setIsCashManuallyEdited(false);
      setInvoiceNo(`INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`);
      activeSpecialCheckoutKeyRef.current = null; // Clear key on success (Phase 1.1)
      clearCartDraft(tenantId, effectiveBranchId, effectiveUserId);
      setRateWarnings(null);
      reportNetworkSuccess();

      if (resData.is_duplicate) {
        showFeedback('Sale successfully recorded! (Sale pehle hi record ho chuki hai)');
      } else {
        showFeedback(`Special Invoice #${savedInvoice.invoice_no || ''} completed and printed.`);
      }
    } catch (err: any) {
      console.error('Special sale execution error:', err);
      if (isNetworkOrTimeoutError(err)) {
        setVerifyState({
          isVerifying: false,
          failedAfterRetries: true,
          errorMessage: 'Connection lost. Sale could not be confirmed. (Internet band hai — sale abhi confirm nahi hui. Dobara enter mat karein; "Retry" dabayein ya offline save karein.)',
          retryAction: () => handleSpecialDirect(),
        });
      } else {
        showFeedback(err.message || 'Special sale failed. Please try again.');
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Keyboard Shortcuts Listener ([F2], [F3], [F4], [F5], [F6], [F7], [F8], [F9], [Escape])
  // FIX FINDING-POS-002: Store latest state and handlers in mutable ref to attach listener once on mount
  const hotkeysStateRef = useRef({
    handleCheckout,
    handleAddItem,
    handleHoldInvoice,
    handleCancelInvoice,
    selectedProduct,
    filteredCatalog,
    canUseSpecialReceipt,
    lineItems,
    handleSpecialDirect,
  });

  useEffect(() => {
    hotkeysStateRef.current = {
      handleCheckout,
      handleAddItem,
      handleHoldInvoice,
      handleCancelInvoice,
      selectedProduct,
      filteredCatalog,
      canUseSpecialReceipt,
      lineItems,
      handleSpecialDirect,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = hotkeysStateRef.current;
      if (e.key === 'F5') {
        e.preventDefault();
        state.handleCheckout(true);
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (state.canUseSpecialReceipt && state.lineItems.length > 0) {
          state.handleSpecialDirect();
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        state.handleCheckout(false);
      } else if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (state.selectedProduct) {
          state.handleAddItem(state.selectedProduct);
        } else if (state.filteredCatalog.length === 1) {
          state.handleAddItem(state.filteredCatalog[0]);
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        state.handleHoldInvoice();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowHeldModal(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        state.handleCancelInvoice();
      } else if (e.key === 'Escape') {
        setShowCustomerModal(false);
        setShowHeldModal(false);
        setShowProductDropdown(false);
        setPrintReceiptData(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeEntryProduct = selectedProduct || (filteredCatalog.length === 1 ? filteredCatalog[0] : null);
  const activeEntryBrandId = activeEntryProduct?.brand_id ? String(activeEntryProduct.brand_id).trim().toLowerCase() : '';
  const specialFieldEnabled = canUseSpecialReceipt && Boolean(activeEntryBrandId) && specialBrandIds.has(activeEntryBrandId);

  return (
    <section className="pos-screen">
      {/* Toast Notification */}
      {notification && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 60, background: '#0F172A', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: '#F97316' }} />
          {notification}
        </div>
      )}

      {/* Phase 2: Cashier-Friendly Verifying Modal (Task 2.4) */}
      {verifyState?.isVerifying && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '24px 32px',
            maxWidth: '460px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            border: '2px solid #F97316',
          }}>
            <div style={{
              width: 40,
              height: 40,
              border: '4px solid #E2E8F0',
              borderTop: '4px solid #F97316',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 14px',
            }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              Verifying sale with server… Please wait
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              (Sale check ho rahi hai, baraye mehrbani intezar karein…)
            </p>
          </div>
        </div>
      )}

      {/* Phase 2: Cashier-Friendly Connection Lost Modal (Task 2.4) */}
      {verifyState?.failedAfterRetries && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 28px',
            maxWidth: '500px',
            width: '92%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
            border: '2px solid #DC2626',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle style={{ width: 22, height: 22, color: '#DC2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#991B1B', margin: 0 }}>
                  Connection Lost / Internet Band Hai
                </h3>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0' }}>
                  Sale could not be confirmed with server
                </p>
              </div>
            </div>

            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#9F1239', lineHeight: 1.5, margin: 0 }}>
                {verifyState.errorMessage}
              </p>
            </div>

            <p style={{ fontSize: '12px', color: '#475569', marginBottom: '18px', lineHeight: 1.4 }}>
              <strong>Aapka cart mehfooz hai.</strong> Dobara bill banane ki zaroorat nahi. Connection check karein aur &quot;Try Again&quot; dabayein.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVerifyState(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#F1F5F9',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Keep Cart & Check Net / Cart Mehfooz Rakhein
              </button>
              <button
                type="button"
                onClick={() => {
                  const retry = verifyState.retryAction;
                  setVerifyState(null);
                  if (retry) retry();
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#EA580C',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Try Again / Dobara Koshish Karein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3.4: Restore Unsaved Cart Modal */}
      {pendingDraft && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px 28px',
            maxWidth: '480px',
            width: '92%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            border: '2px solid #2563EB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ShoppingCart style={{ width: 22, height: 22, color: '#2563EB' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Unsaved Cart Found
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                  (Pichli gher-mehfooz sale dastyab hai)
                </p>
              </div>
            </div>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Items in cart:</span>
                <span style={{ fontWeight: 600 }}>{pendingDraft.cart.lineItems?.length || 0} product(s)</span>
              </div>
              {pendingDraft.cart.customerSearch && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Customer:</span>
                  <span style={{ fontWeight: 600 }}>{pendingDraft.cart.customerSearch}</span>
                </div>
              )}
              {pendingDraft.cart.selectedClient && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Client:</span>
                  <span style={{ fontWeight: 600 }}>{pendingDraft.cart.selectedClient.name}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Autosaved:</span>
                <span style={{ fontWeight: 500, fontSize: '11px', color: '#64748B' }}>
                  {new Date(pendingDraft.updatedAt).toLocaleTimeString()} ({new Date(pendingDraft.updatedAt).toLocaleDateString()})
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '18px', lineHeight: 1.4 }}>
              A cart from an unexpected browser refresh or previous session was recovered. Would you like to restore it or start fresh?
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleDiscardDraft}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#F1F5F9',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Discard / Mita Dein
              </button>
              <button
                type="button"
                onClick={handleRestoreDraft}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563EB',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Restore Cart / Cart Wapis Laein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3.8: Rate Revalidation Warnings Banner */}
      {rateWarnings && rateWarnings.length > 0 && (
        <div style={{
          background: '#FFFBEB',
          borderBottom: '1px solid #FDE68A',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#92400E',
          zIndex: 50,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: 16, height: 16, color: '#D97706', flexShrink: 0 }} />
            <span>
              <strong>Price update in catalog:</strong> {rateWarnings.length} product(s) in this restored cart have different prices in the catalog today (e.g. {rateWarnings[0].productName}: cart Rs.{rateWarnings[0].cartRate} vs catalog Rs.{rateWarnings[0].catalogRate}). Your quoted draft rates have been retained.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRateWarnings(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#92400E',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              marginLeft: '12px',
            }}
          >
            Acknowledge (OK)
          </button>
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
                  ref={customerInputRef}
                  type="text"
                  value={selectedClient ? `${selectedClient.name} (${selectedClient.phone || 'Account'})` : customerSearch}
                  onChange={(e) => {
                    setSelectedClient(null);
                    setCustomerSearch(e.target.value);
                  }}
                  onFocus={() => {
                    if (skipCustomerModalOnFocus.current) {
                      skipCustomerModalOnFocus.current = false;
                      return;
                    }
                    setShowCustomerModal(true);
                  }}
                  placeholder="Walk-in customer ka naam likhein, ya account search karein..."
                  className="pos-text-input"
                  style={{ paddingRight: '32px', fontWeight: 500, ...(needsCustomerName ? { borderColor: '#F87171', background: '#FEF2F2' } : {}) }}
                />
                <Search
                  onClick={() => setShowCustomerModal(true)}
                  style={{ width: 16, height: 16, color: '#94A3B8', position: 'absolute', right: '10px', cursor: 'pointer' }}
                />
              </div>
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
                  readOnly={needsCustomerName}
                  onFocus={() => {
                    if (needsCustomerName) {
                      blockForCustomerName();
                      return;
                    }
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
                    } else if (e.key === 'Enter' && e.shiftKey) {
                      // Shift+Enter = add directly to cart (bypass keyboard chain)
                      e.preventDefault();
                      const prod = (showProductDropdown && filteredCatalog.length > 0)
                        ? filteredCatalog[activeProductIndex]
                        : (selectedProduct || (filteredCatalog.length === 1 ? filteredCatalog[0] : null));
                      if (prod) handleAddItem(prod, undefined, false);
                    } else if (e.key === 'Enter') {
                      // Plain Enter = SELECT product, move focus to Qty
                      e.preventDefault();
                      const prod = (showProductDropdown && filteredCatalog.length > 0)
                        ? filteredCatalog[activeProductIndex]
                        : (filteredCatalog.length === 1 ? filteredCatalog[0] : null);
                      if (prod) {
                        setSelectedProduct(prod);
                        setInputRate(prod.retail_price || 0);
                        setProductQuery(`${prod.name}${prod.shade_code ? ` (${prod.shade_code})` : ''}`);
                        setShowProductDropdown(false);
                        qtyInputRef.current?.focus();
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
                ref={qtyInputRef}
                type="number"
                min={1}
                value={inputQty}
                onChange={(e) => setInputQty(Number(e.target.value) || 1)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') { e.preventDefault(); setInputQty((prev) => prev + 1); }
                  else if (e.key === 'ArrowDown') { e.preventDefault(); setInputQty((prev) => Math.max(1, prev - 1)); }
                  else if (e.key === 'Enter') { e.preventDefault(); rateInputRef.current?.focus(); }
                  else if (e.key === 'Escape') { setSelectedProduct(null); setProductQuery(''); searchInputRef.current?.focus(); }
                }}
                style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
              />
            </div>

            {/* Rate Field */}
            <div style={{ width: '110px', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
                Rate:
              </span>
              <input
                ref={rateInputRef}
                type="number"
                min={0}
                step="any"
                value={inputRate || ''}
                placeholder="0"
                readOnly={invoiceType !== 'return'}
                title={invoiceType !== 'return' ? 'Rate locked — sirf CEO Edit Product / Bulk Edit Prices se badal sakta hai' : undefined}
                onChange={(e) => { if (invoiceType === 'return') setInputRate(Number(e.target.value) || 0); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); (specialFieldEnabled ? specialRateInputRef : discInputRef).current?.focus(); }
                  else if (e.key === 'Escape') { searchInputRef.current?.focus(); }
                }}
                style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
              />
            </div>

            {/* Special Rate Field (final per-unit rate; only for special-brand items) */}
            {specialFieldEnabled && (
              <div style={{ width: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '8px', padding: '4px 8px' }}>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#C2410C', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
                  Spl:
                </span>
                <input
                  ref={specialRateInputRef}
                  type="number"
                  min={0}
                  step="any"
                  value={inputSpecialRate || ''}
                  placeholder="0"
                  title="Special Rate (final rate per unit customer se liya jayega)"
                  onChange={(e) => setInputSpecialRate(Math.max(0, Number(e.target.value) || 0))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!(inputSpecialRate > 0)) {
                        showFeedback('Special Rate likhna zaroori hai — iske baghair aage nahi barh sakte.');
                        return;
                      }
                      if (inputSpecialRate > (inputRate || 0)) {
                        showFeedback('Special Rate, Rate se zyada nahi ho sakta.');
                        return;
                      }
                      discInputRef.current?.focus();
                    }
                    else if (e.key === 'Escape') { searchInputRef.current?.focus(); }
                  }}
                  style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#9A3412', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
                />
              </div>
            )}

            {/* Disc% Field */}
            <div style={{ width: '90px', flexShrink: 0, display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
                Dis%:
              </span>
              <input
                ref={discInputRef}
                type="number"
                min={0}
                max={100}
                step="any"
                value={inputDiscount || ''}
                placeholder="0"
                onChange={(e) => setInputDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addItemBtnRef.current?.click(); }
                  else if (e.key === 'Escape') { searchInputRef.current?.focus(); }
                }}
                style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none' }}
              />
            </div>

            {/* Add Item Button */}
            <button
              ref={addItemBtnRef}
              type="button"
              onClick={() => {
                const prod = selectedProduct || (filteredCatalog.length === 1 ? filteredCatalog[0] : null);
                if (prod) {
                  handleAddItem(
                    prod,
                    inputRate > 0 ? inputRate : undefined,
                    false,
                    inputDiscount > 0 ? inputDiscount : undefined
                  );
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
                      const rowChargedRate = item.specialRate && item.specialRate > 0 ? item.specialRate : item.rate;
                      const lineGross = rowChargedRate * item.qty;
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
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={item.rate === 0 ? '' : item.rate}
                              placeholder="0.00"
                              readOnly={invoiceType !== 'return'}
                              title={invoiceType !== 'return' ? 'Rate locked' : undefined}
                              onChange={(e) => {
                                if (invoiceType !== 'return') return;
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setLineItems((prev) =>
                                  prev.map((li) => li.id === item.id ? { ...li, rate: val, specialRate: li.specialRate && li.specialRate > val ? undefined : li.specialRate } : li)
                                  // originalRate stays unchanged (Token-safe: D5)
                                );
                              }}
                              style={{
                                width: '72px',
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
                            {item.specialRate && item.specialRate > 0 ? (
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#C2410C', fontFamily: 'JetBrains Mono, monospace' }}>
                                Spl: {item.specialRate.toLocaleString()}
                              </div>
                            ) : null}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Cash</label>
                  {isCashManuallyEdited && (
                    <button
                      type="button"
                      onClick={() => setIsCashManuallyEdited(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#F97316',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '0 2px',
                        textDecoration: 'underline',
                      }}
                      title="Reset manual cash override and auto-sync with net total"
                    >
                      Auto-sync
                    </button>
                  )}
                </div>
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

            {(() => {
              const otherTenders = cardPayment + bankPayment + othersPayment;
              const isNonCashOverpaid = otherTenders > netTotal;
              const changeToReturn = !isNonCashOverpaid && totalPaid > netTotal ? Math.round((totalPaid - netTotal) * 100) / 100 : 0;

              return (
                <>
                  <div style={{ paddingTop: '6px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>Paid Amount</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                      Rs. {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {changeToReturn > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span style={{ color: '#16A34A', fontWeight: 700 }}>Change Return (Wapsi)</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                        Rs. {changeToReturn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Balance</span>
                    {isNonCashOverpaid ? (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '10.5px' }}>
                        ⚠️ Over by Rs. {(otherTenders - netTotal).toLocaleString()} (Non-cash)
                      </span>
                    ) : balanceDue <= 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                        <CheckCircle2 style={{ width: 12, height: 12 }} />
                        {changeToReturn > 0 ? 'Full Paid + Change Due' : 'Payment Success'}
                      </span>
                    ) : (
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '11px' }}>
                        Rs. {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Due)
                      </span>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* 3. Bottom Stacked Action Buttons (Save & Print / Save / Hold / Cancel) */}
          <div style={{ paddingTop: '8px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* TASK-SR-12: Special Save & Print Button (Directly ABOVE regular Save & Print) */}
            {canUseSpecialReceipt && (
              <button
                type="button"
                disabled={submitting || lineItems.length === 0}
                onClick={handleSpecialDirect}
                className={`pos-btn-special ${shouldBlinkSpecial ? 'pos-btn-special-blink' : ''}`}
                title="Special Non-Branded Receipt (Option A Content Rule)"
              >
                <Printer style={{ width: 16, height: 16 }} />
                Special Save &amp; Print (F6)
              </button>
            )}

            {/* Primary Save & Print */}
            <button
              type="button"
              disabled={submitting || (cardPayment + bankPayment + othersPayment) > netTotal}
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
                disabled={submitting || (cardPayment + bankPayment + othersPayment) > netTotal}
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
          <div className="pos-modal-card" style={{ maxWidth: '680px', width: '95%' }}>
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
                                setCustomerSearch('');
                              } else if (target.client) {
                                setSelectedClient(target.client);
                                setCustomerSearch(target.client.name);
                              }
                              setShowCustomerModal(false);
                              if (target.isWalkIn) {
                                skipCustomerModalOnFocus.current = true;
                                setTimeout(() => customerInputRef.current?.focus(), 60);
                              } else {
                                setTimeout(() => searchInputRef.current?.focus(), 60);
                              }
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
                                setCustomerSearch('');
                                setShowCustomerModal(false);
                                skipCustomerModalOnFocus.current = true;
                                setTimeout(() => customerInputRef.current?.focus(), 60);
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

              {/* Quick Add Client Section */}
              <div style={{
                marginTop: '6px',
                padding: '12px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0F172A' }}>
                      + Register New Customer
                    </span>
                    <span style={{ fontSize: '10px', color: '#F97316', fontWeight: 700, background: '#FFEDD5', padding: '1px 6px', borderRadius: '4px' }}>
                      Instant Khata
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Save customer &amp; immediately select for billing</span>
                </div>

                {/* Form Inputs Grid: Row 1 (Name & Phone) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="e.g. Haji Asif Paint Store"
                      className="pos-text-input"
                      style={{ width: '100%', fontSize: '12px', background: '#FFFFFF', padding: '7px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="pos-text-input"
                      style={{ width: '100%', fontSize: '12px', background: '#FFFFFF', padding: '7px 10px' }}
                    />
                  </div>
                </div>

                {/* Form Inputs Grid: Row 2 (Referrer, Prev Balance, Register Button) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                      Referrer / Agent (Optional)
                    </label>
                    <input
                      type="text"
                      value={newClientReference}
                      onChange={(e) => setNewClientReference(e.target.value)}
                      placeholder="e.g. Master Painter Bilal"
                      className="pos-text-input"
                      style={{ width: '100%', fontSize: '12px', background: '#FFFFFF', padding: '7px 10px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
                      Previous Balance (Rs.)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newClientPreviousBalance}
                      onChange={(e) => setNewClientPreviousBalance(e.target.value)}
                      placeholder="0.00"
                      className="pos-text-input"
                      style={{ width: '100%', fontSize: '12px', background: '#FFFFFF', padding: '7px 10px', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newClientName.trim()) {
                        alert('Customer Name is required!');
                        return;
                      }
                      try {
                        const res = await fetch('/api/clients', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            tenant_id: tenantId,
                            name: newClientName.trim(),
                            phone: newClientPhone.trim(),
                            reference: newClientReference?.trim() || undefined,
                            credit_limit: 50000,
                            previous_balance: parseFloat(newClientPreviousBalance) || 0,
                          }),
                        });
                        const data = await res.json();
                        if (data.success && data.client) {
                          setClients((prev) => [data.client, ...prev]);
                          setSelectedClient(data.client);
                          setCustomerSearch(data.client.name);
                          setNewClientName('');
                          setNewClientPhone('');
                          setNewClientReference('');
                          setNewClientPreviousBalance('');
                          setShowCustomerModal(false);
                          showFeedback(`Customer ${data.client.name} registered with balance Rs. ${data.client.current_balance || 0}!`);
                          setTimeout(() => searchInputRef.current?.focus(), 60);
                        } else {
                          alert(data.error || 'Failed to create customer');
                        }
                      } catch (err) {
                        console.error('Failed to create customer', err);
                        alert('Network error registering customer');
                      }
                    }}
                    style={{
                      height: '35px',
                      padding: '0 18px',
                      background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(249, 115, 22, 0.25)'
                    }}
                  >
                    + Register &amp; Select
                  </button>
                </div>
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
                    style={{ padding: '10px 12px', background: order.isLocalOnly ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${order.isLocalOnly ? '#FCD34D' : '#E2E8F0'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{order.customerName}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                        {order.items.length} items · Parked at {order.time}
                      </div>
                      {order.isLocalOnly && (
                        <div style={{ fontSize: '10px', color: '#D97706', fontWeight: 600, marginTop: '2px' }}>
                          📱 Saved on this device (not synced yet)
                        </div>
                      )}
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

      {/* ── UX-01: Print-Only Thermal Receipt Wrapper (screen-hidden; iframe handles actual printing) ── */}
      {printReceiptData && (
        <div id="pos-thermal-print-wrapper" aria-hidden="true">
          <style>{`
            #pos-thermal-print-wrapper,
            #printable-pos-thermal-slip {
              display: none !important;
              visibility: hidden !important;
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
                    {isTokenItem && isRemoved && (
                      <div style={{ fontSize: '9px', color: '#333333', marginTop: '1px', fontStyle: 'italic' }}>
                        🎫 Token removed — Rs. ${(item.tokenValue * item.qty).toLocaleString()} deducted
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, paddingTop: '3px', color: '#000000' }}>
                <span>Paid ({printReceiptData.payment_type?.toUpperCase() || 'CASH'}):</span>
                <span>Rs. {(printReceiptData.paid_amount || 0).toLocaleString()}</span>
              </div>
              {(printReceiptData.payment_type === 'split' || (Number(printReceiptData.cash_paid || 0) > 0 && (Number(printReceiptData.card_paid || 0) > 0 || Number(printReceiptData.bank_paid || 0) > 0 || Number(printReceiptData.others_paid || 0) > 0))) && (
                <div style={{ paddingLeft: '8px', fontSize: '9.5px', color: '#444444', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {Number(printReceiptData.cash_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Cash:</span>
                      <span>Rs. {Number(printReceiptData.cash_paid).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(printReceiptData.card_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Card:</span>
                      <span>Rs. {Number(printReceiptData.card_paid).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(printReceiptData.bank_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Bank:</span>
                      <span>Rs. {Number(printReceiptData.bank_paid).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(printReceiptData.others_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Tokens/Other:</span>
                      <span>Rs. {Number(printReceiptData.others_paid).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {Number(printReceiptData.change_returned || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#15803D', fontWeight: 700 }}>
                  <span>Change Returned:</span>
                  <span>Rs. {Number(printReceiptData.change_returned).toLocaleString()}</span>
                </div>
              )}
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