'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, InvoiceItem } from '@/types';
import { printViaIframe, buildThermalHtmlDocument } from '@/utils/iframePrint';
import { ReceiptTemplate } from '@/types/receipt';
import {
  Search,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  CreditCard,
  Banknote,
  Clock,
  ChevronDown,
  ChevronRight,
  Eye,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Share2,
  X,
  XCircle,
  User,
  ShoppingBag,
  Ticket,
  Coins,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { generateReceiptImageBlob } from '@/utils/receiptCanvas';
import { calculateSalesSummary } from '@/utils/salesMath';

/** UX-01: Build an 80mm thermal receipt as a plain HTML string for iframe printing.
 * Applies footer/branding from assigned template when available (DEV-07). */
function buildSalesHistoryThermalHtml(inv: any, tenantName: string, tmpl?: ReceiptTemplate | null): string {
  const fmt = (n: number) => Number(n || 0).toLocaleString();
  const isSplit = inv.payment_type === 'split' ||
    (Number(inv.cash_paid || 0) > 0 &&
      (Number(inv.card_paid || 0) > 0 || Number(inv.bank_paid || 0) > 0 || Number(inv.others_paid || 0) > 0));

  const items: any[] = inv.invoice_items || inv.items || [];
  const itemRows = items.map((it: any, idx: number) => {
    const lineTotal = Number(it.total_price || (it.qty * it.unit_price) || 0);
    const code = it.item_code ? `[${it.item_code}] ` : '';
    const shade = it.shade_code ? ` (${it.shade_code})` : '';
    return `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;border-bottom:${idx < items.length - 1 ? '1px dotted #ccc' : 'none'};padding-bottom:3px">
      <span>${code}${it.item_name || '—'}${shade} x${it.qty}</span>
      <span style="font-weight:700">Rs. ${fmt(lineTotal)}</span>
    </div>`;
  }).join('');

  const splitRows = isSplit ? `
    <div style="padding-left:8px;font-size:11px;color:#444">
      ${Number(inv.cash_paid || 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>&bull; Cash:</span><span>Rs. ${fmt(inv.cash_paid)}</span></div>` : ''}
      ${Number(inv.card_paid || 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>&bull; Card:</span><span>Rs. ${fmt(inv.card_paid)}</span></div>` : ''}
      ${Number(inv.bank_paid || 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>&bull; Bank:</span><span>Rs. ${fmt(inv.bank_paid)}</span></div>` : ''}
      ${Number(inv.others_paid || 0) > 0 ? `<div style="display:flex;justify-content:space-between"><span>&bull; Other:</span><span>Rs. ${fmt(inv.others_paid)}</span></div>` : ''}
    </div>` : '';

  const dueRow = Number(inv.due_amount || 0) > 0
    ? `<div style="display:flex;justify-content:space-between;font-weight:700"><span>BALANCE DUE:</span><span>Rs. ${fmt(inv.due_amount)}</span></div>` : '';
  const discRow = Number(inv.discount || 0) > 0
    ? `<div style="display:flex;justify-content:space-between"><span>Discount:</span><span>-Rs. ${fmt(inv.discount)}</span></div>` : '';

  const footer = tmpl?.template_json?.footer;
  const footerLine1 = footer?.line1 || `Thank you for your business!`;
  const footerLine2 = footer?.line2 || '';
  const whatsappRow = (footer?.showWhatsapp && footer?.whatsappNumber)
    ? `<div style="text-align:center;font-size:9px;color:#555">WhatsApp: ${footer.whatsappNumber}</div>` : '';
  const poweredBy = (footer?.showPoweredBy !== false)
    ? `<div style="text-align:center;font-size:8px;color:#aaa;margin-top:2px">${footer?.poweredByText || 'Powered by Pyntflow'}</div>` : '';

  return `
<div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:12px;margin-bottom:12px">
  <h2 style="font-size:16px;font-weight:900;text-transform:uppercase;margin:0 0 2px 0">${tenantName}</h2>
  <p style="font-size:11px;color:#555;margin:0">Pyntflow Retail &amp; Wholesale POS</p>
  <div style="font-size:12px;font-weight:800;margin-top:4px">${inv.invoice_no || '—'}</div>
  <div style="font-size:11px;color:#666">Date: ${inv.date || '—'} &middot; Customer: ${inv.client_name || 'Walk-in'}</div>
</div>
<div style="border-bottom:1px dashed #000;padding-bottom:12px;margin-bottom:12px">
  ${itemRows}
</div>
<div style="display:flex;flex-direction:column;gap:4px;font-size:12px;margin-bottom:16px">
  <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>Rs. ${fmt(inv.subtotal)}</span></div>
  ${discRow}
  <div style="display:flex;justify-content:space-between;font-weight:900;font-size:14px;border-top:1px solid #000;padding-top:4px;margin-top:2px">
    <span>NET TOTAL:</span><span>Rs. ${fmt(inv.net_total)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-weight:700">
    <span>PAID (${(inv.payment_type || 'CASH').toUpperCase()}):</span><span>Rs. ${fmt(inv.paid_amount)}</span>
  </div>
  ${splitRows}${dueRow}
</div>
<div style="text-align:center;font-size:9.5px;color:#555">${footerLine1}</div>
${footerLine2 ? `<div style="text-align:center;font-size:9px;color:#777;margin-top:2px">${footerLine2}</div>` : ''}
${whatsappRow}
${poweredBy}
`;
}

interface TokenRedemptionRow {
  id: string;
  tenant_id?: string;
  type?: 'redeemed';
  redemption_no?: string;
  client_id?: string | null;
  client_name: string | null;
  total_tokens?: number;
  total_amount?: number;
  redeemed_amount?: number;
  notes?: string | null;
  shift_id?: string | null;
  created_at: string;
  token_redemption_items?: Array<{
    brand_name: string;
    series_name: string;
    unit_name: string;
    quantity: number;
    token_value: number;
    line_total: number;
  }>;
  // Legacy compatibility fields
  item_name?: string | null;
  brand?: string | null;
}

interface Props {
  tenantId: string;
  tenantName?: string;
  staffName?: string;
  onNavigateToPos?: () => void;
  onEditInvoiceInPos?: (invoice: Invoice) => void;
}

export default function SalesHistory({
  tenantId,
  tenantName = 'PaintERP Branch',
  staffName = 'Counter Staff',
  onNavigateToPos,
  onEditInvoiceInPos,
}: Props) {
  // Date Helpers
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getSevenDaysAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const getMonthStartStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Filter States (Prominent Date Range Filter From / To above tables)
  const [startDate, setStartDate] = useState<string>(getMonthStartStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'custom' | 'all'>('month');
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'return' | 'token_redemption'>('all');

  // Invoices & Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tokenRedemptions, setTokenRedemptions] = useState<TokenRedemptionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingTokens, setLoadingTokens] = useState<boolean>(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Task 9.7: Cursor-based pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Selected Invoice Modal / Print
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [thermalPrintInvoice, setThermalPrintInvoice] = useState<Invoice | null>(null);

  // Registered Clients Directory (for WhatsApp Phone Resolution)
  const [clientsMap, setClientsMap] = useState<Record<string, { name: string; phone?: string }>>({});

  // WhatsApp Image Modal State
  const [whatsAppModal, setWhatsAppModal] = useState<{
    invoice: Invoice;
    phone: string;
    blob: Blob;
    imageUrl: string;
  } | null>(null);
  const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState<boolean>(false);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  // Assigned receipt template for this branch (DEV-07)
  const [assignedTemplate, setAssignedTemplate] = useState<ReceiptTemplate | null>(null);

  // Task 9.6: Invoice cancellation state
  const [cancelModal, setCancelModal] = useState<{ invoice: Invoice } | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const handleCancelInvoice = async () => {
    if (!cancelModal) return;
    const reason = cancelReason.trim();
    if (!reason) {
      alert('Cancellation reason is required.');
      return;
    }
    setIsCancelling(true);
    try {
      const inv = cancelModal.invoice;
      const url = `/api/invoices?id=${inv.id}&tenant_id=${tenantId}&reason=${encodeURIComponent(reason)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCancelModal(null);
        setCancelReason('');
        await fetchInvoices();
      } else {
        alert(`Failed to cancel invoice: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  // TASK-P11-01: Lazy-fetch invoice items on-demand when expanding row, opening details, or printing
  const ensureInvoiceItems = async (inv: Invoice): Promise<Invoice> => {
    if (inv.invoice_items && inv.invoice_items.length > 0) return inv;
    if (inv.items && inv.items.length > 0) return inv;
    try {
      const res = await fetch(`/api/invoices?tenant_id=${tenantId}&id=${inv.id}&include_items=true`);
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices) && data.invoices[0]) {
        const fullInv = data.invoices[0];
        const items = fullInv.invoice_items || fullInv.items || [];
        setInvoices(prev => prev.map(item => item.id === inv.id ? { ...item, invoice_items: items, items } : item));
        return { ...inv, invoice_items: items, items };
      }
    } catch (err) {
      console.error('Failed to lazy load invoice line items', err);
    }
    return inv;
  };

  // Helper: Strictly Registered Customer Check (Excludes Walk-in)
  const isRegisteredCustomer = (inv: Invoice | null | undefined): boolean => {
    if (!inv) return false;
    const name = (inv.client_name || '').toLowerCase().trim();
    if (!name || name.includes('walk-in') || name.includes('walk in') || name.includes('cash customer') || name === 'walkin') {
      return false;
    }
    if (inv.client_id) return true;
    if (clientsMap[name]) return true;
    return false;
  };

  // Fetch Invoices from Backend (Task 9.7: cursor-based pagination)
  const fetchInvoices = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      let url = `/api/invoices?tenant_id=${tenantId}&limit=100`;
      if (startDate && activeDatePreset !== 'all') {
        url += `&start_date=${startDate}`;
      }
      if (endDate && activeDatePreset !== 'all') {
        url += `&end_date=${endDate}`;
      }
      if (typeFilter === 'sales' || typeFilter === 'return') {
        url += `&type=${typeFilter}`;
      }
      if (paymentFilter !== 'all') {
        url += `&payment_type=${paymentFilter}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        const next = data.next_cursor || data.pagination?.next_cursor || null;
        setNextCursor(next);
        setHasMore(Boolean(data.pagination?.has_more ?? (next !== null)));
      } else {
        setInvoices([]);
        setNextCursor(null);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to fetch sales invoices', err);
      setInvoices([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // Task 9.7: Load More Invoices
  const handleLoadMore = async () => {
    if (!tenantId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      let url = `/api/invoices?tenant_id=${tenantId}&limit=100&cursor=${encodeURIComponent(nextCursor)}`;
      if (startDate && activeDatePreset !== 'all') {
        url += `&start_date=${startDate}`;
      }
      if (endDate && activeDatePreset !== 'all') {
        url += `&end_date=${endDate}`;
      }
      if (typeFilter === 'sales' || typeFilter === 'return') {
        url += `&type=${typeFilter}`;
      }
      if (paymentFilter !== 'all') {
        url += `&payment_type=${paymentFilter}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        setInvoices(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newInvs = data.invoices.filter((i: any) => !existingIds.has(i.id));
          return [...prev, ...newInvs];
        });
        const next = data.next_cursor || data.pagination?.next_cursor || null;
        setNextCursor(next);
        setHasMore(Boolean(data.pagination?.has_more ?? (next !== null)));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more invoices', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch Token Redemptions from Backend
  const fetchTokenRedemptions = async () => {
    if (!tenantId) return;
    setLoadingTokens(true);
    try {
      const res = await fetch(`/api/token-redemptions?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setTokenRedemptions(data.redemptions || []);
      } else {
        setTokenRedemptions([]);
      }
    } catch (err) {
      console.error('Failed to fetch token redemptions', err);
      setTokenRedemptions([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Fetch Clients Directory
  const fetchClients = async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
      if (res.ok) {
        const json = await res.json();
        const list = json.clients || json.data || (Array.isArray(json) ? json : []);
        const map: Record<string, { name: string; phone?: string }> = {};
        if (Array.isArray(list)) {
          list.forEach((c: any) => {
            if (c.id) {
              map[c.id] = { name: c.name, phone: c.phone };
            }
            if (c.name) {
              map[c.name.trim().toLowerCase()] = { name: c.name, phone: c.phone };
            }
          });
        }
        setClientsMap(map);
      }
    } catch (err) {
      console.error('Failed to fetch clients in SalesHistory', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchTokenRedemptions();
    fetchClients();
  }, [tenantId, startDate, endDate, typeFilter, paymentFilter, activeDatePreset]);

  // Fetch assigned receipt template for this tenant on mount (DEV-07)
  useEffect(() => {
    if (!tenantId) return;
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/receipt-templates/assign?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success && data.template) {
          setAssignedTemplate(data.template);
        }
      } catch (err) {
        console.error('Failed to load receipt template for SalesHistory:', err);
      }
    };
    fetchTemplate();
  }, [tenantId]);

  // Handle Preset Clicks
  const handlePresetSelect = (preset: 'today' | 'yesterday' | '7days' | 'month' | 'all') => {
    setActiveDatePreset(preset);
    const today = getTodayStr();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const yest = getYesterdayStr();
      setStartDate(yest);
      setEndDate(yest);
    } else if (preset === '7days') {
      setStartDate(getSevenDaysAgoStr());
      setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(getMonthStartStr());
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Client-side search & filtering for Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search matches
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = inv.invoice_no?.toLowerCase().includes(q);
        const matchClient = inv.client_name?.toLowerCase().includes(q);
        const matchRemarks = inv.remarks?.toLowerCase().includes(q);
        const invoiceItems = inv.invoice_items || inv.items;
        const matchItem = invoiceItems?.some((it) =>
          it.item_name?.toLowerCase().includes(q) ||
          it.item_code?.toLowerCase().includes(q) ||
          it.shade_code?.toLowerCase().includes(q)
        );
        if (!matchNo && !matchClient && !matchRemarks && !matchItem) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, searchQuery]);

  // Client-side search & filtering for Token Redemptions
  const filteredTokenRedemptions = useMemo(() => {
    return tokenRedemptions.filter((t) => {
      if (activeDatePreset !== 'all' && t.created_at) {
        const itemDate = t.created_at.split('T')[0];
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = t.redemption_no?.toLowerCase().includes(q);
        const matchClient = t.client_name?.toLowerCase().includes(q);
        const matchNotes = t.notes?.toLowerCase().includes(q);
        const matchItem = t.item_name?.toLowerCase().includes(q);
        const matchBrand = t.brand?.toLowerCase().includes(q);
        const matchItems = t.token_redemption_items?.some(
          (it) =>
            it.brand_name.toLowerCase().includes(q) ||
            it.series_name.toLowerCase().includes(q) ||
            it.unit_name.toLowerCase().includes(q)
        );
        if (!matchNo && !matchClient && !matchNotes && !matchItem && !matchBrand && !matchItems) {
          return false;
        }
      }
      return true;
    });
  }, [tokenRedemptions, searchQuery, activeDatePreset, startDate, endDate]);

  // Combined and sorted row list for display
  type CombinedRow =
    | { type: 'invoice'; data: Invoice; date: string }
    | { type: 'token_redemption'; data: TokenRedemptionRow; date: string };

  const combinedRows: CombinedRow[] = useMemo(() => {
    const list: CombinedRow[] = [];

    if (typeFilter !== 'token_redemption') {
      filteredInvoices.forEach((inv) => {
        list.push({
          type: 'invoice',
          data: inv,
          date: inv.created_at || `${inv.date}T00:00:00Z`,
        });
      });
    }

    if (typeFilter === 'all' || typeFilter === 'token_redemption') {
      if (paymentFilter === 'all' || paymentFilter === 'cash') {
        filteredTokenRedemptions.forEach((t) => {
          list.push({
            type: 'token_redemption',
            data: t,
            date: t.created_at || new Date().toISOString(),
          });
        });
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredInvoices, filteredTokenRedemptions, typeFilter, paymentFilter]);

  // Summary Metrics Calculation — Task 9.5: Standardized finance math via salesMath
  // Task 9.1: Cancelled invoices are excluded from all metric totals
  const summaryMetrics = useMemo(() => {
    const summary = calculateSalesSummary(filteredInvoices);
    return {
      ...summary,
      totalInvoices: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredInvoices.length) {
      alert('No sales records to export for the selected period.');
      return;
    }

    const headers = [
      'Invoice No',
      'Date',
      'Time',
      'Type',
      'Customer',
      'Payment Mode',
      'Items Count',
      'Subtotal (PKR)',
      'Discount (PKR)',
      'Delivery (PKR)',
      'Net Total (PKR)',
      'Paid Amount (PKR)',
      'Due Balance (PKR)',
      'Status',
      'Remarks',
    ];

    const rows = filteredInvoices.map((inv) => {
      const createdDate = inv.created_at ? new Date(inv.created_at) : new Date();
      const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
      return [
        `"${inv.invoice_no}"`,
        `"${inv.date}"`,
        `"${timeStr}"`,
        `"${inv.invoice_type === 'return' ? 'RETURN' : 'SALE'}"`,
        `"${inv.client_name || 'Walk-in Customer'}"`,
        `"${inv.payment_type?.toUpperCase() || 'CASH'}"`,
        (inv.invoice_items || inv.items)?.length || 0,
        inv.subtotal || 0,
        inv.discount || 0,
        inv.delivery_charge || 0,
        inv.net_total || 0,
        inv.paid_amount || 0,
        inv.due_amount || 0,
        `"${inv.status}"`,
        `"${inv.remarks || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `PaintERP_SalesReport_${tenantName.replace(/\s+/g, '_')}_${startDate || 'start'}_to_${endDate || 'end'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Share Receipt Image (Registered Customers Only)
  const handleWhatsAppShare = async (inv: Invoice) => {
    if (!isRegisteredCustomer(inv)) {
      alert('WhatsApp receipt sharing is strictly available for registered clients.');
      return;
    }

    try {
      setIsGeneratingWhatsApp(true);
      const fullInv = await ensureInvoiceItems(inv);
      const blob = await generateReceiptImageBlob(fullInv, tenantName);
      const imageUrl = URL.createObjectURL(blob);

      // Customer phone formatting
      const normClientName = (inv.client_name || '').trim().toLowerCase();
      let rawPhone =
        (inv.client_id ? clientsMap[inv.client_id]?.phone : undefined) ||
        (normClientName ? clientsMap[normClientName]?.phone : undefined) ||
        (inv as any).client_phone ||
        (inv as any).phone ||
        '';

      // Fallback: If phone is not yet in memory, fetch client directory on-demand
      if (!rawPhone && (inv.client_id || normClientName)) {
        try {
          const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
          if (res.ok) {
            const json = await res.json();
            const list = json.clients || json.data || (Array.isArray(json) ? json : []);
            if (Array.isArray(list)) {
              const matched = list.find((c: any) =>
                (inv.client_id && c.id === inv.client_id) ||
                (normClientName && c.name?.trim().toLowerCase() === normClientName)
              );
              if (matched?.phone) {
                rawPhone = matched.phone;
                setClientsMap(prev => ({
                  ...prev,
                  [matched.id]: { name: matched.name, phone: matched.phone },
                  [matched.name.trim().toLowerCase()]: { name: matched.name, phone: matched.phone }
                }));
              }
            }
          }
        } catch (fetchErr) {
          console.error('Error fetching fallback client phone:', fetchErr);
        }
      }

      let cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '92' + cleanPhone.slice(1);
      } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('92')) {
        cleanPhone = '92' + cleanPhone;
      }

      // Automatically copy image to clipboard if supported
      let copied = false;
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          copied = true;
        }
      } catch (clipErr) {
        console.warn('Clipboard write permission denied or unsupported:', clipErr);
        copied = false;
      }

      setCopiedReceipt(copied);
      setWhatsAppModal({
        invoice: inv,
        phone: cleanPhone,
        blob,
        imageUrl,
      });
    } catch (err: any) {
      console.error('Error generating WhatsApp receipt image:', err);
      alert('Could not render receipt image. Please use thermal print.');
    } finally {
      setIsGeneratingWhatsApp(false);
    }
  };

  const handleCopyReceiptImage = async () => {
    if (!whatsAppModal) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': whatsAppModal.blob })
      ]);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 3000);
    } catch (err) {
      console.error('Failed to copy receipt image to clipboard', err);
      alert('Unable to copy to clipboard automatically. Please download the image below.');
    }
  };

  const handleDownloadReceiptImage = () => {
    if (!whatsAppModal) return;
    const a = document.createElement('a');
    a.href = whatsAppModal.imageUrl;
    a.download = `Receipt_${whatsAppModal.invoice.invoice_no}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenWhatsAppChat = () => {
    if (!whatsAppModal) return;
    const phone = whatsAppModal.phone.replace(/[^0-9]/g, '');
    if (!phone) {
      alert('Please enter a valid phone number for the customer (e.g. 923001234567).');
      return;
    }
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const closeWhatsAppModal = () => {
    if (whatsAppModal) {
      URL.revokeObjectURL(whatsAppModal.imageUrl);
    }
    setWhatsAppModal(null);
    setCopiedReceipt(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC', overflowY: 'auto' }}>
      {/* ── Top Header Bar ── */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#0F172A',
              color: '#F97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            <TrendingUp style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Sales Register &amp; Invoices
              </h1>
              <span
                style={{
                  background: '#FEF3C7',
                  color: '#92400E',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #FDE68A',
                }}
              >
                {filteredInvoices.length} Invoices
              </span>
              {filteredTokenRedemptions.length > 0 && (
                <span
                  style={{
                    background: '#FEF3C7',
                    color: '#B45309',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid #FDE68A',
                  }}
                >
                  +{filteredTokenRedemptions.length} Payouts
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              {tenantName} · Live sales reporting, invoice history &amp; item breakdowns
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            title="Refresh Invoices"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet style={{ width: 14, height: 14, color: '#38BDF8' }} />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#F97316',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <Printer style={{ width: 14, height: 14 }} />
            Print Report
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* ── Summary Metric Cards (Disaggregated KPIs - BUG-04) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Net Sales */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Net Sales
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.netSales.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
              {summaryMetrics.completedCount} sales{summaryMetrics.returnCount > 0 ? ` · ${summaryMetrics.returnCount} returns` : ''}
            </div>
          </div>

          {/* Physical Cash */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Physical Cash
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Banknote style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.physicalCash.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600, marginTop: '4px' }}>
              Physical till cash
            </div>
          </div>

          {/* Digital / Card / Bank */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Digital &amp; Bank
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#F0FDF4', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.digitalPaid.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
              Card &amp; online transfers
            </div>
          </div>

          {/* Credit / Receivables */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Credit (Udhar)
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#D97706', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              Rs. {summaryMetrics.creditAmount.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, marginTop: '4px' }}>
              Booked to customer accounts
            </div>
          </div>

          {/* Items Sold */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                Volume Sold
              </span>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers style={{ width: 16, height: 16 }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>
              {summaryMetrics.totalItemsCount.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>units</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Avg ticket: Rs. {summaryMetrics.avgTicket.toLocaleString()}
            </div>
          </div>
        </div>

        {/* ── DATE RANGE FILTER BAR & FILTER CONTROLS (PROMINENTLY ABOVE ITEM TABLES) ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Top Row: Date Range Selector (From Date, To Date & Quick Presets) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            {/* From & To Date Pickers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar style={{ width: 16, height: 16, color: '#F97316' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Date Period:
                </span>
              </div>

              {/* From Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                  FROM:
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>

              <span style={{ color: '#94A3B8', fontWeight: 700 }}>→</span>

              {/* To Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                  TO:
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Quick Date Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: '4px' }}>
                Quick:
              </span>
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((preset) => {
                const isActive = activeDatePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #F97316' : '1px solid #E2E8F0',
                      background: isActive ? '#FFF7ED' : '#FFFFFF',
                      color: isActive ? '#EA580C' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row: Search Bar, Payment Mode Filter, Invoice Type Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <Search
                style={{
                  width: 16,
                  height: 16,
                  color: '#94A3B8',
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice #, customer name, shade, or product..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>

            {/* Type Selector (Sales vs Returns vs All) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setTypeFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'all' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'all' ? '#0F172A' : '#64748B',
                  boxShadow: typeFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter('sales')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'sales' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'sales' ? '#16A34A' : '#64748B',
                  boxShadow: typeFilter === 'sales' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Sales Only
              </button>
              <button
                onClick={() => setTypeFilter('return')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'return' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'return' ? '#DC2626' : '#64748B',
                  boxShadow: typeFilter === 'return' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Returns Only
              </button>
              <button
                onClick={() => setTypeFilter('token_redemption')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: typeFilter === 'token_redemption' ? '#FFFFFF' : 'transparent',
                  color: typeFilter === 'token_redemption' ? '#D97706' : '#64748B',
                  boxShadow: typeFilter === 'token_redemption' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Ticket style={{ width: 13, height: 13, color: '#D97706' }} />
                Token Payouts
              </button>
            </div>

            {/* Payment Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Payment:
              </span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#0F172A',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Modes</option>
                <option value="cash">Cash Only</option>
                <option value="credit">Credit (Udhar)</option>
                <option value="card">Card Payment</option>
                <option value="bank">Bank Transfer</option>
                <option value="split">Split Payment</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── SALES INVOICES & ITEMS TABLE ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div
                className="spinner"
                style={{ margin: '0 auto 1rem', borderColor: '#f97316', borderTopColor: 'transparent' }}
              />
              <p style={{ fontSize: '13px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Loading sales records from Supabase...
              </p>
            </div>
          ) : combinedRows.length === 0 ? (
            <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Receipt style={{ width: 28, height: 28 }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                No Records Found
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
                No completed sales, returns, or token payouts recorded for the selected date range ({startDate || 'All'} to {endDate || 'All'}).
              </p>
              {onNavigateToPos && (
                <button
                  onClick={onNavigateToPos}
                  style={{
                    padding: '8px 16px',
                    background: '#F97316',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Go to POS Billing
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#FFFFFF', borderBottom: '1px solid #1E293B' }}>
                    <th style={{ padding: '12px 14px', width: '40px' }}></th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Invoice #
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Date &amp; Time
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Customer
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                      Payment
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Items
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Subtotal
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Discount
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Net Total
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Paid
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                      Balance
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {combinedRows.map((row, idx) => {
                    if (row.type === 'token_redemption') {
                      const t = row.data;
                      const createdDate = t.created_at ? new Date(t.created_at) : new Date();
                      const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = createdDate.toISOString().split('T')[0];

                      return (
                        <tr
                          key={`token-${t.id || idx}`}
                          style={{
                            borderBottom: '1px solid #FDE68A',
                            background: idx % 2 === 0 ? '#FFFDF5' : '#FEFCE8',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Icon Indicator */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <Ticket style={{ width: 14, height: 14, color: '#D97706', margin: '0 auto' }} />
                          </td>

                          {/* Invoice # replacement */}
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 800,
                                background: '#FEF3C7',
                                color: '#B45309',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                border: '1px solid #FDE68A',
                                fontFamily: 'JetBrains Mono, monospace',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {t.redemption_no || 'TOKEN PAYOUT'}
                            </span>
                          </td>

                          {/* Date & Time */}
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                              {dateStr}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                              {timeStr}
                            </div>
                          </td>

                          {/* Customer */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: '#FEF3C7',
                                  color: '#B45309',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {t.client_name ? t.client_name.charAt(0).toUpperCase() : 'W'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 600, color: '#0F172A', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.client_name || 'Walk-in Customer'}
                                </span>
                                {t.notes && (
                                  <span style={{ fontSize: '10px', color: '#64748B', fontStyle: 'italic', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Payment Mode */}
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontFamily: 'JetBrains Mono, monospace',
                                background: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                              }}
                            >
                              <Coins style={{ width: 11, height: 11 }} />
                              Cash Payout
                            </span>
                          </td>

                          {/* Items */}
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11.5px', color: '#334155' }}>
                            {t.token_redemption_items && t.token_redemption_items.length > 0 ? (
                              <span style={{ fontWeight: 600 }}>
                                {t.token_redemption_items.map((it) => `${it.brand_name} ${it.series_name} (${it.quantity}x ${it.unit_name})`).join(', ')}
                              </span>
                            ) : t.item_name ? (
                              <span style={{ fontWeight: 600 }}>
                                {t.item_name}
                                {t.brand && <span style={{ color: '#64748B', fontSize: '10px', display: 'block' }}>({t.brand})</span>}
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>—</span>
                            )}
                          </td>

                          {/* Subtotal */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                            —
                          </td>

                          {/* Discount */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                            —
                          </td>

                          {/* Net Total */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 800,
                              fontSize: '13.5px',
                              color: '#D97706',
                            }}
                          >
                            -Rs. {Number(t.total_amount ?? t.redeemed_amount ?? 0).toLocaleString()}
                          </td>

                          {/* Paid */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                            —
                          </td>

                          {/* Due / Balance */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8' }}>
                            —
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                background: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FDE68A',
                              }}
                            >
                              PAYOUT
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>
                            —
                          </td>
                        </tr>
                      );
                    }

                    const inv = row.data;
                    const isExpanded = expandedInvoiceId === inv.id;
                    const isReturn = inv.invoice_type === 'return';
                    const createdDate = inv.created_at ? new Date(inv.created_at) : new Date();
                    const timeStr = createdDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <React.Fragment key={inv.id || idx}>
                        <tr
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            background: isExpanded ? '#F8FAFC' : idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Expand Toggle */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={async () => {
                                if (isExpanded) {
                                  setExpandedInvoiceId(null);
                                } else {
                                  setExpandedInvoiceId(inv.id);
                                  if ((!inv.invoice_items || inv.invoice_items.length === 0) && (!inv.items || inv.items.length === 0)) {
                                    await ensureInvoiceItems(inv);
                                  }
                                }
                              }}
                              title={isExpanded ? 'Collapse items' : 'Expand item details'}
                              style={{
                                background: isExpanded ? '#0F172A' : '#F1F5F9',
                                color: isExpanded ? '#FFFFFF' : '#475569',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                width: '22px',
                                height: '22px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              {isExpanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                            </button>
                          </td>

                          {/* Invoice No */}
                          <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{inv.invoice_no}</span>
                              {isReturn && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    border: '1px solid #FECACA',
                                  }}
                                >
                                  RETURN
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: '#1E293B', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                              {inv.date}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                              {timeStr}
                            </div>
                          </td>

                          {/* Customer */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: inv.client_id ? '#DBEAFE' : '#F1F5F9',
                                  color: inv.client_id ? '#1D4ED8' : '#64748B',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {inv.client_name ? inv.client_name.charAt(0).toUpperCase() : 'W'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 600, color: '#0F172A', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {inv.client_name || 'Walk-in Customer'}
                                </span>
                                {inv.created_by && (
                                  <span style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                    By: {inv.created_by}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Payment Mode */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  background:
                                    inv.payment_type === 'cash'
                                      ? '#DCFCE7'
                                      : inv.payment_type === 'credit'
                                      ? '#FEF3C7'
                                      : inv.payment_type === 'card'
                                      ? '#EFF6FF'
                                      : '#F3E8FF',
                                  color:
                                    inv.payment_type === 'cash'
                                      ? '#166534'
                                      : inv.payment_type === 'credit'
                                      ? '#92400E'
                                      : inv.payment_type === 'card'
                                      ? '#1E40AF'
                                      : '#6B21A8',
                                }}
                              >
                                {inv.payment_type === 'credit' ? 'ON ACCOUNT' : (inv.payment_type || 'cash')}
                              </span>

                              {(inv.payment_type === 'split' || (Number(inv.cash_paid || 0) > 0 && (Number(inv.card_paid || 0) > 0 || Number(inv.bank_paid || 0) > 0 || Number(inv.others_paid || 0) > 0))) && (
                                <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.2' }}>
                                  {Number(inv.cash_paid || 0) > 0 && <div>Cash: Rs. {Number(inv.cash_paid).toLocaleString()}</div>}
                                  {Number(inv.card_paid || 0) > 0 && <div>Card: Rs. {Number(inv.card_paid).toLocaleString()}</div>}
                                  {Number(inv.bank_paid || 0) > 0 && <div>Bank: Rs. {Number(inv.bank_paid).toLocaleString()}</div>}
                                  {Number(inv.others_paid || 0) > 0 && <div>Other: Rs. {Number(inv.others_paid).toLocaleString()}</div>}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Items Count */}
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                            <span style={{ background: '#F1F5F9', padding: '2px 7px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                              {(inv.invoice_items || inv.items)?.length || 0}
                            </span>
                          </td>

                          {/* Subtotal */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                            Rs. {Number(inv.subtotal || 0).toLocaleString()}
                          </td>

                          {/* Discount */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: Number(inv.discount) > 0 ? '#DC2626' : '#94A3B8' }}>
                            {Number(inv.discount) > 0 ? `-Rs. ${Number(inv.discount).toLocaleString()}` : '—'}
                          </td>

                          {/* Net Total */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 800,
                              fontSize: '13.5px',
                              color: isReturn ? '#DC2626' : '#0F172A',
                            }}
                          >
                            {isReturn ? '-' : ''}Rs. {Number(inv.net_total || 0).toLocaleString()}
                          </td>

                          {/* Paid */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#16A34A' }}>
                            Rs. {Number(inv.paid_amount || 0).toLocaleString()}
                          </td>

                          {/* Due / Balance */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 700,
                              color: Number(inv.due_amount) > 0 ? '#D97706' : '#94A3B8',
                            }}
                          >
                            {Number(inv.due_amount) > 0 ? `Rs. ${Number(inv.due_amount).toLocaleString()}` : 'Rs. 0'}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: isReturn
                                  ? '#FEE2E2'
                                  : (inv.status || '').toLowerCase() === 'cancelled'
                                  ? '#F1F5F9'
                                  : Number(inv.due_amount) > 0
                                  ? '#FEF3C7'
                                  : '#DCFCE7',
                                color: isReturn
                                  ? '#991B1B'
                                  : (inv.status || '').toLowerCase() === 'cancelled'
                                  ? '#64748B'
                                  : Number(inv.due_amount) > 0
                                  ? '#92400E'
                                  : '#166534',
                              }}
                            >
                              {isReturn ? 'RETURN' : (inv.status || '').toLowerCase() === 'cancelled' ? 'CANCELLED' : Number(inv.due_amount) > 0 ? 'DUE' : 'PAID'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  setSelectedInvoice(inv);
                                  if ((!inv.invoice_items || inv.invoice_items.length === 0) && (!inv.items || inv.items.length === 0)) {
                                    const full = await ensureInvoiceItems(inv);
                                    setSelectedInvoice(full);
                                  }
                                }}
                                title="View Complete Bill"
                                style={{
                                  padding: '5px',
                                  background: '#EFF6FF',
                                  color: '#2563EB',
                                  border: '1px solid #BFDBFE',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                }}
                              >
                                <Eye style={{ width: 14, height: 14 }} />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  setThermalPrintInvoice(inv);
                                  if ((!inv.invoice_items || inv.invoice_items.length === 0) && (!inv.items || inv.items.length === 0)) {
                                    const full = await ensureInvoiceItems(inv);
                                    setThermalPrintInvoice(full);
                                  }
                                }}
                                title="Print Thermal Receipt"
                                style={{
                                  padding: '5px',
                                  background: '#FFF7ED',
                                  color: '#EA580C',
                                  border: '1px solid #FED7AA',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                }}
                              >
                                <Printer style={{ width: 14, height: 14 }} />
                              </button>

                              {isRegisteredCustomer(inv) && (
                                <button
                                  type="button"
                                  onClick={() => handleWhatsAppShare(inv)}
                                  disabled={isGeneratingWhatsApp}
                                  title="Share Receipt Image via WhatsApp"
                                  style={{
                                    padding: '5px',
                                    background: '#DCFCE7',
                                    color: '#16A34A',
                                    border: '1px solid #BBF7D0',
                                    borderRadius: '6px',
                                    cursor: isGeneratingWhatsApp ? 'wait' : 'pointer',
                                    display: 'flex',
                                  }}
                                >
                                  <Share2 style={{ width: 14, height: 14 }} />
                                </button>
                              )}

                              {onEditInvoiceInPos && !isReturn && (
                                <button
                                  type="button"
                                  onClick={() => onEditInvoiceInPos(inv)}
                                  title="Open in POS & Add More Items"
                                  style={{
                                    padding: '4px 8px',
                                    background: '#FEF3C7',
                                    color: '#B45309',
                                    border: '1px solid #FDE68A',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <ShoppingBag style={{ width: 13, height: 13 }} />
                                  <span>POS Edit</span>
                                </button>
                              )}

                              {/* Task 9.6: Cancel/Void Invoice button (only for active, non-return invoices) */}
                              {!isReturn && (inv.status || '').toLowerCase() !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => { setCancelModal({ invoice: inv }); setCancelReason(''); }}
                                  title="Cancel / Void Invoice"
                                  style={{
                                    padding: '5px',
                                    background: '#FEE2E2',
                                    color: '#DC2626',
                                    border: '1px solid #FECACA',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                  }}
                                >
                                  <XCircle style={{ width: 14, height: 14 }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── EXPANDED ITEM BREAKDOWN ROW ── */}
                        {isExpanded && (
                          <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
                            <td colSpan={13} style={{ padding: '12px 1.5rem' }}>
                              <div
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShoppingBag style={{ width: 14, height: 14, color: '#F97316' }} />
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                      Purchased Items in {inv.invoice_no} ({(inv.invoice_items || inv.items)?.length || 0} items)
                                    </span>
                                  </div>
                                  {inv.remarks && (
                                    <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                                      Note: {inv.remarks}
                                    </span>
                                  )}
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: '#F1F5F9', color: '#475569', borderBottom: '1px solid #CBD5E1' }}>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Item Code &amp; Name</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Shade / Color</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Pack / Unit</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Qty</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Unit Price</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Discount</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Total (PKR)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(inv.invoice_items || inv.items) && (inv.invoice_items || inv.items)!.length > 0 ? (
                                      (inv.invoice_items || inv.items)!.map((item: any, iIdx: number) => (
                                        <tr key={item.id || iIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                          <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0F172A' }}>
                                            {item.item_name}
                                            {item.item_code && (
                                              <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                                                [{item.item_code}]
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '6px 10px', color: '#475569' }}>
                                            {item.shade_code ? (
                                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                {item.shade_color_hex && (
                                                  <span
                                                    style={{
                                                      width: '10px',
                                                      height: '10px',
                                                      borderRadius: '50%',
                                                      background: item.shade_color_hex,
                                                      display: 'inline-block',
                                                      border: '1px solid #CBD5E1',
                                                    }}
                                                  />
                                                )}
                                                {item.shade_code}
                                              </span>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td style={{ padding: '6px 10px', color: '#64748B' }}>
                                            {item.pack_size || item.unit || 'Standard'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                                            {item.qty}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                                            Rs. {Number(item.unit_price).toLocaleString()}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: Number(item.discount) > 0 ? '#DC2626' : '#94A3B8' }}>
                                            {Number(item.discount) > 0 ? `Rs. ${Number(item.discount).toLocaleString()}` : '0'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                                            Rs. {Number(item.total_price || (item.qty * item.unit_price)).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={7} style={{ padding: '8px 10px', textAlign: 'center', color: '#94A3B8' }}>
                                          No item records attached.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Task 9.7: Pagination Controls */}
          {!loading && combinedRows.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid #E2E8F0',
                background: '#F8FAFC',
                borderBottomLeftRadius: '10px',
                borderBottomRightRadius: '10px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                Showing <strong>{combinedRows.length}</strong> records{hasMore ? ' (more records available on server)' : ''}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0F172A',
                    cursor: loadingMore ? 'wait' : 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown style={{ width: 14, height: 14 }} />
                      Load More Invoices
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── FULL INVOICE DETAILS MODAL ── */}
      {selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(249, 115, 22, 0.2)',
                    color: '#F97316',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800 }}>
                    Invoice Details — {selectedInvoice.invoice_no}
                  </h2>
                  <p style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {tenantName} · {selectedInvoice.date}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Meta Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Customer
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                    {selectedInvoice.client_name || 'Walk-in Customer'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Payment Mode
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginTop: '2px' }}>
                    {selectedInvoice.payment_type === 'credit' ? 'ON ACCOUNT' : selectedInvoice.payment_type}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                    Invoice Type
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: selectedInvoice.invoice_type === 'return' ? '#DC2626' : '#16A34A', textTransform: 'uppercase', marginTop: '2px' }}>
                    {selectedInvoice.invoice_type === 'return' ? 'Sales Return' : 'Direct Sale'}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Line Items
                </h4>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', color: '#475569' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Shade</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.invoice_items || selectedInvoice.items)?.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0F172A' }}>
                            {it.item_code && (
                              <span style={{ fontSize: '10.5px', color: '#64748B', marginRight: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                                [{it.item_code}]
                              </span>
                            )}
                            {it.item_name} <span style={{ color: '#64748B', fontSize: '11px' }}>({it.pack_size || it.unit || 'Can'})</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {it.shade_code || 'Standard'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                            {it.qty}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                            Rs. {Number(it.unit_price).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                            Rs. {Number(it.total_price || (it.qty * it.unit_price)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.subtotal || 0).toLocaleString()}</span>
                </div>
                {Number(selectedInvoice.discount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                    <span>Discount:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>-Rs. {Number(selectedInvoice.discount).toLocaleString()}</span>
                  </div>
                )}
                {Number(selectedInvoice.delivery_charge) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Delivery Charge:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>+Rs. {Number(selectedInvoice.delivery_charge).toLocaleString()}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    fontSize: '16px',
                    color: '#0F172A',
                    borderTop: '1px dashed #CBD5E1',
                    paddingTop: '6px',
                    marginTop: '2px',
                  }}
                >
                  <span>Grand Net Total:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#16A34A' }}>
                    Rs. {Number(selectedInvoice.net_total || 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontWeight: 600 }}>
                  <span>Paid Amount ({selectedInvoice.payment_type?.toUpperCase() || 'CASH'}):</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.paid_amount || 0).toLocaleString()}</span>
                </div>
                {(selectedInvoice.payment_type === 'split' || (Number(selectedInvoice.cash_paid || 0) > 0 && (Number(selectedInvoice.card_paid || 0) > 0 || Number(selectedInvoice.bank_paid || 0) > 0 || Number(selectedInvoice.others_paid || 0) > 0))) && (
                  <div style={{ paddingLeft: '12px', fontSize: '11.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {Number(selectedInvoice.cash_paid || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Cash Paid:</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.cash_paid).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.card_paid || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Card Paid:</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.card_paid).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.bank_paid || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Bank Transfer:</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.bank_paid).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.others_paid || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>• Tokens/Other:</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.others_paid).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
                {Number(selectedInvoice.due_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706', fontWeight: 700 }}>
                    <span>Invoice Balance Due:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(selectedInvoice.due_amount).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                background: '#F1F5F9',
                borderTop: '1px solid #E2E8F0',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {isRegisteredCustomer(selectedInvoice) && (
                <button
                  onClick={() => handleWhatsAppShare(selectedInvoice)}
                  disabled={isGeneratingWhatsApp}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isGeneratingWhatsApp ? 'wait' : 'pointer',
                  }}
                >
                  <Share2 style={{ width: 14, height: 14 }} />
                  Share WhatsApp Image
                </button>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {onEditInvoiceInPos && selectedInvoice.invoice_type !== 'return' && (
                  <button
                    onClick={() => {
                      const invToEdit = selectedInvoice;
                      setSelectedInvoice(null);
                      onEditInvoiceInPos(invToEdit);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: '#FEF3C7',
                      color: '#B45309',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ShoppingBag style={{ width: 14, height: 14 }} />
                    Edit / Add in POS
                  </button>
                )}

                <button
                  onClick={() => {
                    setThermalPrintInvoice(selectedInvoice);
                    setSelectedInvoice(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#F97316',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer style={{ width: 14, height: 14 }} />
                  Thermal Print
                </button>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  style={{
                    padding: '8px 14px',
                    background: '#E2E8F0',
                    color: '#0F172A',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── THERMAL RECEIPT PRINT MODAL ── */}
      {thermalPrintInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              background: '#FFFFFF',
              color: '#000000',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            {/* Receipt Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>
                {tenantName}
              </h3>
              <p style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                Pyntflow Retail &amp; Wholesale POS
              </p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 800, marginTop: '4px' }}>
                {thermalPrintInvoice.invoice_no}
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Date: {thermalPrintInvoice.date} · Customer: {thermalPrintInvoice.client_name || 'Walk-in'}
              </div>
            </div>

            {/* Receipt Items */}
            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              {(thermalPrintInvoice.invoice_items || thermalPrintInvoice.items)?.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>
                    {it.item_code ? `[${it.item_code}] ` : ''}{it.item_name} {it.shade_code ? `(${it.shade_code})` : ''} x{it.qty}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                    Rs. {Number(it.total_price || (it.qty * it.unit_price)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Receipt Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(thermalPrintInvoice.discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discount:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>-Rs. {Number(thermalPrintInvoice.discount).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '14px', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '2px' }}>
                <span>NET TOTAL:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.net_total || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>PAID ({thermalPrintInvoice.payment_type?.toUpperCase() || 'CASH'}):</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.paid_amount || 0).toLocaleString()}</span>
              </div>
              {(thermalPrintInvoice.payment_type === 'split' || (Number(thermalPrintInvoice.cash_paid || 0) > 0 && (Number(thermalPrintInvoice.card_paid || 0) > 0 || Number(thermalPrintInvoice.bank_paid || 0) > 0 || Number(thermalPrintInvoice.others_paid || 0) > 0))) && (
                <div style={{ paddingLeft: '8px', fontSize: '11px', color: '#444', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {Number(thermalPrintInvoice.cash_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Cash:</span>
                      <span>Rs. {Number(thermalPrintInvoice.cash_paid).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(thermalPrintInvoice.card_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Card:</span>
                      <span>Rs. {Number(thermalPrintInvoice.card_paid).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(thermalPrintInvoice.bank_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Bank:</span>
                      <span>Rs. {Number(thermalPrintInvoice.bank_paid).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(thermalPrintInvoice.others_paid || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• Tokens/Other:</span>
                      <span>Rs. {Number(thermalPrintInvoice.others_paid).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              {Number(thermalPrintInvoice.due_amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>BALANCE DUE:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {Number(thermalPrintInvoice.due_amount).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Print & Close Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  if (thermalPrintInvoice) {
                    const html = buildThermalHtmlDocument(
                      buildSalesHistoryThermalHtml(thermalPrintInvoice, tenantName, assignedTemplate),
                      `Receipt ${thermalPrintInvoice.invoice_no}`
                    );
                    printViaIframe(html);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Print Receipt
              </button>
              <button
                onClick={() => setThermalPrintInvoice(null)}
                style={{
                  flex: 1,
                  padding: '9px',
                  background: '#E2E8F0',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP RECEIPT IMAGE SHARE MODAL ── */}
      {whatsAppModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            zIndex: 2500,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <MessageCircle style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                    WhatsApp Receipt Image
                  </h3>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {whatsAppModal.invoice.invoice_no} · {whatsAppModal.invoice.client_name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWhatsAppModal}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#CBD5E1',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Customer Phone Input Field */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Customer WhatsApp Number (with Country Code e.g. 923001234567)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={whatsAppModal.phone}
                    onChange={(e) => setWhatsAppModal({ ...whatsAppModal, phone: e.target.value })}
                    placeholder="923001234567"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono, monospace',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppChat}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '8px 14px',
                      background: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <ExternalLink style={{ width: 14, height: 14 }} />
                    Open Chat
                  </button>
                </div>
              </div>

              {/* Status / Instructions Notice */}
              <div
                style={{
                  background: copiedReceipt ? '#ECFDF5' : '#EFF6FF',
                  border: `1px solid ${copiedReceipt ? '#A7F3D0' : '#BFDBFE'}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: copiedReceipt ? '#065F46' : '#1E40AF',
                }}
              >
                {copiedReceipt ? (
                  <Check style={{ width: 16, height: 16, color: '#059669', flexShrink: 0 }} />
                ) : (
                  <Copy style={{ width: 16, height: 16, color: '#2563EB', flexShrink: 0 }} />
                )}
                <span>
                  {copiedReceipt
                    ? 'Receipt image copied to clipboard! In WhatsApp Web, simply press Ctrl + V to paste and send.'
                    : 'Click "Copy Image" below to place receipt on clipboard, then Ctrl + V into customer WhatsApp chat.'}
                </span>
              </div>

              {/* Thermal Receipt Visual Preview */}
              <div
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'center',
                  maxHeight: '340px',
                  overflowY: 'auto',
                }}
              >
                <img
                  src={whatsAppModal.imageUrl}
                  alt={`Receipt ${whatsAppModal.invoice.invoice_no}`}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyReceiptImage}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 12px',
                    background: copiedReceipt ? '#059669' : '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {copiedReceipt ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                  <span>{copiedReceipt ? 'Copied!' : 'Copy Image'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadReceiptImage}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 12px',
                    background: '#FFFFFF',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  <span>Download</span>
                </button>
              </div>

              <button
                type="button"
                onClick={closeWhatsAppModal}
                style={{
                  padding: '8px 14px',
                  background: '#E2E8F0',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Task 9.6: Cancel Invoice Confirmation Modal */}
      {cancelModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => { if (!isCancelling) setCancelModal(null); }}
        >
          <div
            style={{
              background: '#FFFFFF', borderRadius: '14px', padding: '28px',
              width: '460px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#FEE2E2', borderRadius: '8px', padding: '8px', display: 'flex' }}>
                <XCircle style={{ width: 20, height: 20, color: '#DC2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Cancel / Void Invoice
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                  {cancelModal.invoice.invoice_no} — Rs. {Number(cancelModal.invoice.net_total || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
              This will permanently cancel the invoice. Stock adjustments, client balance, and token
              applications will be reversed atomically. <strong>This action cannot be undone.</strong>
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
              Cancellation Reason <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation, duplicate entry, data entry error..."
              rows={3}
              style={{
                width: '100%', borderRadius: '8px', border: '1.5px solid #CBD5E1',
                padding: '8px 12px', fontSize: '13px', color: '#0F172A',
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              disabled={isCancelling}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                disabled={isCancelling}
                style={{
                  padding: '8px 16px', background: '#F1F5F9', color: '#334155',
                  border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '13px',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                Keep Invoice
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={isCancelling || !cancelReason.trim()}
                style={{
                  padding: '8px 20px',
                  background: isCancelling || !cancelReason.trim() ? '#FCA5A5' : '#DC2626',
                  color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 700,
                  cursor: isCancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isCancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
