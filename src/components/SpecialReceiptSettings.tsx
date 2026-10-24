'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sliders,
  Type,
  FileText,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Store,
  Layers,
  DollarSign,
  Hash,
  Eye,
} from 'lucide-react';
import {
  TemplateJson,
  PaperSize,
  PAPER_SIZE_CONFIG,
  BLANK_SPECIAL_TEMPLATE_JSON,
  TableColumnId,
} from '@/types/receipt';
import { DevReceiptPreview, ReceiptInvoiceData } from './dev-panel/DevReceiptPreview';
import { printViaIframe } from '@/utils/iframePrint';
import { buildSpecialReceiptHtml } from '@/utils/receiptAdapters';
import { ceoFetch } from '@/lib/ceoApprovalClient';

interface SpecialReceiptSettingsProps {
  tenantId: string;
  tenantName?: string;
}

interface BrandItem {
  id: string;
  name: string;
}

type DesignerTabKey = 'header' | 'paper' | 'meta' | 'table' | 'totals' | 'footer' | 'labels';

const ALL_TABLE_COLUMNS: { id: TableColumnId; label: string; desc: string }[] = [
  { id: 'name', label: 'Product Name', desc: 'Item description and title' },
  { id: 'code', label: 'Item Code / SKU', desc: 'Product barcode or SKU number' },
  { id: 'qty', label: 'Quantity', desc: 'Count / units sold' },
  { id: 'rate', label: 'Unit Rate', desc: 'Price per individual unit' },
  { id: 'discount', label: 'Line Discount', desc: 'Per-item discount deduction' },
  { id: 'amount', label: 'Line Total', desc: 'Final line item total' },
];

export default function SpecialReceiptSettings({
  tenantId,
  tenantName = 'PyntFlow Branch',
}: SpecialReceiptSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'designer' | 'brands'>('designer');
  const [designerTab, setDesignerTab] = useState<DesignerTabKey>('header');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [paperSize, setPaperSize] = useState<PaperSize>('thermal_80');
  const [templateJson, setTemplateJson] = useState<TemplateJson>(BLANK_SPECIAL_TEMPLATE_JSON);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Brand Triggers state
  const [allBrands, setAllBrands] = useState<BrandItem[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<string>>(new Set());
  const [savingBrands, setSavingBrands] = useState<boolean>(false);

  // Load existing special template and brand triggers
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        // 1. Load special template
        const tmplRes = await fetch(`/api/special-receipt-templates?tenant_id=${tenantId}`);
        const tmplData = await tmplRes.json();
        if (isMounted && tmplData.success && tmplData.template) {
          setPaperSize(tmplData.template.paper_size || 'thermal_80');
          setTemplateJson({
            ...BLANK_SPECIAL_TEMPLATE_JSON,
            ...(tmplData.template.template_json || {}),
            header: { ...BLANK_SPECIAL_TEMPLATE_JSON.header, ...(tmplData.template.template_json?.header || {}) },
            invoiceInfo: { ...BLANK_SPECIAL_TEMPLATE_JSON.invoiceInfo, ...(tmplData.template.template_json?.invoiceInfo || {}) },
            itemsTable: { ...BLANK_SPECIAL_TEMPLATE_JSON.itemsTable, ...(tmplData.template.template_json?.itemsTable || {}) },
            totals: { ...BLANK_SPECIAL_TEMPLATE_JSON.totals, ...(tmplData.template.template_json?.totals || {}) },
            footer: { ...BLANK_SPECIAL_TEMPLATE_JSON.footer, ...(tmplData.template.template_json?.footer || {}) },
            layout: { ...BLANK_SPECIAL_TEMPLATE_JSON.layout, ...(tmplData.template.template_json?.layout || {}) },
          });
          setIsCustom(Boolean(tmplData.isCustomized));
        }

        // 2. Load branch brands
        const brandsRes = await fetch(`/api/brands?tenant_id=${tenantId}`);
        const brandsData = await brandsRes.json();
        if (isMounted && brandsData.success && Array.isArray(brandsData.brands)) {
          setAllBrands(brandsData.brands.map((b: any) => ({ id: b.id, name: b.name })));
        }

        // 3. Load selected special brands
        const triggersRes = await fetch(`/api/special-receipt-brands?tenant_id=${tenantId}`);
        const triggersData = await triggersRes.json();
        if (isMounted && triggersData.success && Array.isArray(triggersData.brand_ids)) {
          setSelectedBrandIds(new Set(triggersData.brand_ids));
        }
      } catch (err: any) {
        if (isMounted) {
          showToast('Failed to load Special Receipt settings: ' + err.message, 'error');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (tenantId) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Updaters for nested templateJson properties
  const updateHeader = (fields: Partial<TemplateJson['header']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      header: { ...prev.header, ...fields },
    }));
  };

  const updateLayout = (fields: Partial<TemplateJson['layout']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      layout: { ...prev.layout, ...fields },
    }));
  };

  const updateInvoiceInfo = (fields: Partial<TemplateJson['invoiceInfo']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      invoiceInfo: { ...prev.invoiceInfo, ...fields },
    }));
  };

  const updateItemsTable = (fields: Partial<TemplateJson['itemsTable']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      itemsTable: { ...prev.itemsTable, ...fields },
    }));
  };

  const updateTotals = (fields: Partial<TemplateJson['totals']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      totals: { ...prev.totals, ...fields },
    }));
  };

  const updateFooter = (fields: Partial<TemplateJson['footer']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      footer: { ...prev.footer, ...fields },
    }));
  };

  const toggleColumn = (colId: TableColumnId) => {
    setTemplateJson((prev) => {
      const curCols = prev.itemsTable.columns || ['name', 'qty', 'rate', 'amount'];
      let nextCols: TableColumnId[];
      if (curCols.includes(colId)) {
        if (curCols.length <= 1) return prev;
        nextCols = curCols.filter((c) => c !== colId);
      } else {
        nextCols = [...curCols, colId];
      }
      return {
        ...prev,
        itemsTable: { ...prev.itemsTable, columns: nextCols },
      };
    });
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const res = await ceoFetch('/api/special-receipt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          paper_size: paperSize,
          template_json: templateJson,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setIsCustom(true);
      showToast('Special receipt template saved successfully!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!confirm('Are you sure you want to reset the Special Receipt to the default blank canvas?')) return;
    setSaving(true);
    try {
      const res = await ceoFetch(`/api/special-receipt-templates?tenant_id=${tenantId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to reset');
      setTemplateJson(BLANK_SPECIAL_TEMPLATE_JSON);
      setPaperSize('thermal_80');
      setIsCustom(false);
      showToast('Template reset to default clean format.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = () => {
    const html = buildSpecialReceiptHtml(
      {
        invoice_no: 'SR-TEST-001',
        date: new Date().toLocaleDateString('en-GB') + ' 03:30 PM',
        client_name: 'Walk-in Customer',
        printed_total: 10200,
        master_total: 10200,
        delivery_charge: 0,
        items: [
          { item_name: 'Weather Shield Matt Finish (Off-White)', qty: 2, unit_price: 4200, total_price: 8400, receipt_name: 'Weather Shield Matt Finish (Off-White)' },
          { item_name: 'Wall Primer Undercoat 4L', qty: 1, unit_price: 1800, total_price: 1800, receipt_name: 'Wall Primer Undercoat 4L' },
        ],
      },
      { template_json: templateJson, paper_size: paperSize }
    );
    printViaIframe(html);
  };

  const handleToggleBrand = (brandId: string) => {
    setSelectedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) {
        next.delete(brandId);
      } else {
        next.add(brandId);
      }
      return next;
    });
  };

  const handleSaveBrands = async () => {
    setSavingBrands(true);
    try {
      const res = await ceoFetch('/api/special-receipt-brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          brand_ids: Array.from(selectedBrandIds),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save brand triggers');
      showToast(`Successfully saved ${selectedBrandIds.size} special brand triggers!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingBrands(false);
    }
  };

  const mockInvoiceData: ReceiptInvoiceData = useMemo(() => ({
    invoice_no: 'SR-2026-0042',
    date: new Date().toLocaleDateString('en-GB') + ' 03:30 PM',
    cashier_name: 'Counter Staff',
    client_name: 'Cash Customer',
    payment_method: 'CASH',
    shop_name: templateJson.header.customShopName || '',
    shop_address: templateJson.header.customAddress || '',
    shop_phone: templateJson.header.customPhone || '',
    items: [
      { item_name: 'Weather Shield Matt Finish (Off-White)', qty: 2, unit_price: 4200, total_price: 8400 },
      { item_name: 'Wall Primer Undercoat 4L', qty: 1, unit_price: 1800, total_price: 1800 },
    ],
    subtotal: 10200,
    discount: 0,
    net_total: 10200,
    paid_amount: 10200,
    due_amount: 0,
  }), [templateJson]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading Special Receipt Studio...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: '10px',
            background: toast.type === 'success' ? '#065F46' : '#991B1B',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : <AlertCircle style={{ width: 16, height: 16 }} />}
          {toast.message}
        </div>
      )}

      {/* Top Banner / Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #2E1065 0%, #4C1D95 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(167, 139, 250, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C4B5FD' }}>
            <Sparkles style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Special Receipt Studio
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
                {isCustom ? 'CUSTOM FORMAT' : 'DEFAULT FORMAT'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#DDD6FE', margin: '2px 0 0' }}>
              Design clean non-branded receipts with complete control over fonts, headings, layout, and brand triggers
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('designer')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'designer' ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
              color: activeSubTab === 'designer' ? '#4C1D95' : '#FFFFFF',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sliders style={{ width: 14, height: 14 }} />
            Receipt Designer
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('brands')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeSubTab === 'brands' ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
              color: activeSubTab === 'brands' ? '#4C1D95' : '#FFFFFF',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Tag style={{ width: 14, height: 14 }} />
            Brand Triggers ({selectedBrandIds.size})
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Full-Control Designer View */}
      {activeSubTab === 'designer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(340px, 1fr)', gap: '20px', alignItems: 'start' }}>
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            {/* Designer Sub-Tabs Bar */}
            <div
              style={{
                display: 'flex',
                overflowX: 'auto',
                borderBottom: '1px solid #E2E8F0',
                background: '#F8FAFC',
                padding: '6px 8px',
                gap: '4px',
              }}
            >
              {[
                { id: 'header', label: 'Header & Store', icon: Store },
                { id: 'paper', label: 'Layout & Paper', icon: FileText },
                { id: 'meta', label: 'Invoice Info', icon: Hash },
                { id: 'table', label: 'Table Columns', icon: Layers },
                { id: 'totals', label: 'Totals Section', icon: DollarSign },
                { id: 'footer', label: 'Footer & Notes', icon: Type },
                { id: 'labels', label: 'Custom Labels', icon: AlignLeft },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = designerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDesignerTab(tab.id as DesignerTabKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      background: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#6D28D9' : '#64748B',
                      boxShadow: isActive ? '0 2px 6px rgba(109, 40, 217, 0.1)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon style={{ width: 14, height: 14, color: isActive ? '#7C3AED' : '#94A3B8' }} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Sub-Tab Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* ── 1. HEADER & STORE DETAILS ── */}
              {designerTab === 'header' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Receipt Header &amp; Branding</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Configure top heading text, sizing, alignment, and separator lines.</p>
                  </div>

                  {/* Shop Name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Shop Name / Receipt Header</label>
                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showShopName}
                          onChange={(e) => updateHeader({ showShopName: e.target.checked })}
                          style={{ accentColor: '#7C3AED' }}
                        />
                        Show Header
                      </label>
                    </div>
                    <input
                      type="text"
                      value={templateJson.header.customShopName || ''}
                      onChange={(e) => updateHeader({ customShopName: e.target.value, showShopName: e.target.value.trim().length > 0 })}
                      placeholder="Leave blank for clean non-branded receipt"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Shop Name Size & Uppercase */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Header Font Size: {templateJson.header.shopNameSize || 15}px</label>
                      <input
                        type="range"
                        min="10"
                        max="26"
                        value={templateJson.header.shopNameSize || 15}
                        onChange={(e) => updateHeader({ shopNameSize: Number(e.target.value) })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px' }}>
                      <input
                        type="checkbox"
                        id="spc_uppercase"
                        checked={templateJson.header.shopNameUppercase ?? true}
                        onChange={(e) => updateHeader({ shopNameUppercase: e.target.checked })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                      <label htmlFor="spc_uppercase" style={{ fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        Uppercase Text
                      </label>
                    </div>
                  </div>

                  {/* Address */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Address Line (Optional)</label>
                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showAddress}
                          onChange={(e) => updateHeader({ showAddress: e.target.checked })}
                          style={{ accentColor: '#7C3AED' }}
                        />
                        Show Address
                      </label>
                    </div>
                    <input
                      type="text"
                      value={templateJson.header.customAddress || ''}
                      onChange={(e) => updateHeader({ customAddress: e.target.value, showAddress: e.target.value.trim().length > 0 })}
                      placeholder="e.g. Industrial Area, Lahore"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Phone */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Phone Number (Optional)</label>
                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showPhone}
                          onChange={(e) => updateHeader({ showPhone: e.target.checked })}
                          style={{ accentColor: '#7C3AED' }}
                        />
                        Show Phone
                      </label>
                    </div>
                    <input
                      type="text"
                      value={templateJson.header.customPhone || ''}
                      onChange={(e) => updateHeader({ customPhone: e.target.value, showPhone: e.target.value.trim().length > 0 })}
                      placeholder="e.g. 0300-1234567"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Alignment & Separator */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Header Alignment</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(['left', 'center', 'right'] as const).map((al) => (
                          <button
                            key={al}
                            type="button"
                            onClick={() => updateHeader({ align: al })}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '6px',
                              border: templateJson.header.align === al ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                              background: templateJson.header.align === al ? '#F5F3FF' : '#FFFFFF',
                              color: templateJson.header.align === al ? '#6D28D9' : '#475569',
                              fontWeight: 700,
                              fontSize: '11px',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                            }}
                          >
                            {al}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Separator Line</label>
                      <select
                        value={templateJson.header.separator || 'dashed'}
                        onChange={(e) => updateHeader({ separator: e.target.value as any })}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#FFFFFF' }}
                      >
                        <option value="none">None</option>
                        <option value="dashed">Dashed (-----)</option>
                        <option value="solid">Solid (_____)</option>
                        <option value="double">Double (=====)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 2. LAYOUT & PAPER ── */}
              {designerTab === 'paper' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Paper Size &amp; Margins</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Configure paper roll width, margins, font family, and scale zoom.</p>
                  </div>

                  {/* Paper Size */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Printer Roll Width</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {(['thermal_80', 'thermal_58'] as PaperSize[]).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPaperSize(size)}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: paperSize === size ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                            background: paperSize === size ? '#F5F3FF' : '#FFFFFF',
                            color: paperSize === size ? '#6D28D9' : '#334155',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                          }}
                        >
                          {PAPER_SIZE_CONFIG[size].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Family */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Font Family</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { id: 'mono', label: 'Monospace (POS)' },
                        { id: 'sans', label: 'Clean Sans' },
                        { id: 'serif', label: 'Classic Serif' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateLayout({ fontFamily: f.id as any })}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: templateJson.layout.fontFamily === f.id ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                            background: templateJson.layout.fontFamily === f.id ? '#F5F3FF' : '#FFFFFF',
                            color: templateJson.layout.fontFamily === f.id ? '#6D28D9' : '#334155',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scale & Base Font Size */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Print Scale: {templateJson.layout.scale || 1}x</label>
                      <input
                        type="range"
                        min="0.8"
                        max="1.2"
                        step="0.05"
                        value={templateJson.layout.scale || 1}
                        onChange={(e) => updateLayout({ scale: parseFloat(e.target.value) })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Base Font Size: {templateJson.layout.fontSize || 12}px</label>
                      <input
                        type="range"
                        min="9"
                        max="16"
                        step="0.5"
                        value={templateJson.layout.fontSize || 12}
                        onChange={(e) => updateLayout({ fontSize: parseFloat(e.target.value) })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                    </div>
                  </div>

                  {/* Margins */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Margins (mm)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { key: 'marginTop', label: 'Top' },
                        { key: 'marginRight', label: 'Right' },
                        { key: 'marginBottom', label: 'Bottom' },
                        { key: 'marginLeft', label: 'Left' },
                      ].map((m) => (
                        <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>{m.label}</span>
                          <input
                            type="number"
                            min="0"
                            max="15"
                            value={(templateJson.layout as any)[m.key] ?? 0}
                            onChange={(e) => updateLayout({ [m.key]: Number(e.target.value) } as any)}
                            style={{ padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', textAlign: 'center' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3. INVOICE META ── */}
              {designerTab === 'meta' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Invoice Information / Meta</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Control visibility and labels for Invoice #, Date, Cashier, Customer, and Payment Method.</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { key: 'showInvoiceNo', label: 'Print Invoice Number', fieldKey: 'invoiceLabel', defaultLabel: 'Invoice #' },
                      { key: 'showDate', label: 'Print Date & Time', fieldKey: 'dateLabel', defaultLabel: 'Date:' },
                      { key: 'showCashier', label: 'Print Cashier / Staff Name', fieldKey: 'cashierLabel', defaultLabel: 'Staff:' },
                      { key: 'showCustomer', label: 'Print Customer Name', fieldKey: 'customerLabel', defaultLabel: 'Customer:' },
                      { key: 'showPaymentMethod', label: 'Print Payment Method', fieldKey: 'paymentLabel', defaultLabel: 'Payment:' },
                    ].map((m) => {
                      const isChecked = (templateJson.invoiceInfo as any)[m.key] !== undefined
                        ? Boolean((templateJson.invoiceInfo as any)[m.key])
                        : Boolean((BLANK_SPECIAL_TEMPLATE_JSON.invoiceInfo as any)[m.key]);
                      return (
                        <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => updateInvoiceInfo({ [m.key]: e.target.checked } as any)}
                              style={{ accentColor: '#7C3AED' }}
                            />
                            {m.label}
                          </label>
                          <input
                            type="text"
                            value={(templateJson.invoiceInfo as any)[m.fieldKey] || m.defaultLabel}
                            onChange={(e) => updateInvoiceInfo({ [m.fieldKey]: e.target.value } as any)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px', width: '100px' }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Meta Font Size */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Info Section Font Size: {templateJson.invoiceInfo.fontSize || 10.5}px</label>
                    <input
                      type="range"
                      min="8"
                      max="14"
                      step="0.5"
                      value={templateJson.invoiceInfo.fontSize || 10.5}
                      onChange={(e) => updateInvoiceInfo({ fontSize: parseFloat(e.target.value) })}
                      style={{ accentColor: '#7C3AED' }}
                    />
                  </div>
                </div>
              )}

              {/* ── 4. ITEMS TABLE ── */}
              {designerTab === 'table' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Items Table Columns &amp; Style</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Select which columns print on paper and configure table borders and density.</p>
                  </div>

                  {/* Columns Selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Active Table Columns</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {ALL_TABLE_COLUMNS.map((col) => {
                        const isColActive = (templateJson.itemsTable.columns || []).includes(col.id);
                        return (
                          <div
                            key={col.id}
                            onClick={() => toggleColumn(col.id)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isColActive ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                              background: isColActive ? '#F5F3FF' : '#FFFFFF',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: isColActive ? 700 : 500, color: isColActive ? '#6D28D9' : '#334155' }}>
                                {col.label}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94A3B8' }}>{col.desc}</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isColActive}
                              onChange={() => {}}
                              style={{ accentColor: '#7C3AED' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Table Styling Toggles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.itemsTable.showBorders}
                        onChange={(e) => updateItemsTable({ showBorders: e.target.checked })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                      Show Table Borders
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.itemsTable.compact}
                        onChange={(e) => updateItemsTable({ compact: e.target.checked })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                      Compact Density
                    </label>
                  </div>

                  {/* Table Font Size & Row Padding */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Table Font Size: {templateJson.itemsTable.fontSize || 10}px</label>
                      <input
                        type="range"
                        min="8"
                        max="14"
                        step="0.5"
                        value={templateJson.itemsTable.fontSize || 10}
                        onChange={(e) => updateItemsTable({ fontSize: parseFloat(e.target.value) })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Row Padding: {templateJson.itemsTable.rowPadding || 3}px</label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={templateJson.itemsTable.rowPadding || 3}
                        onChange={(e) => updateItemsTable({ rowPadding: parseInt(e.target.value, 10) })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 5. TOTALS SECTION ── */}
              {designerTab === 'totals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Totals &amp; Summary Section</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Configure totals visibility, grand total emphasis, and currency symbol.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { key: 'showSubtotal', label: 'Show Subtotal' },
                      { key: 'showGrandTotal', label: 'Show NET Total' },
                      { key: 'boldTotal', label: 'Bold NET Total' },
                    ].map((t) => (
                      <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean((templateJson.totals as any)[t.key])}
                          onChange={(e) => updateTotals({ [t.key]: e.target.checked } as any)}
                          style={{ accentColor: '#7C3AED' }}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>

                  {/* Currency Symbol & Font Sizes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Currency Symbol</label>
                      <input
                        type="text"
                        value={templateJson.totals.currencySymbol || 'Rs.'}
                        onChange={(e) => updateTotals({ currencySymbol: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>NET Total Font Size: {templateJson.totals.grandTotalFontSize || 13}px</label>
                      <input
                        type="range"
                        min="10"
                        max="20"
                        value={templateJson.totals.grandTotalFontSize || 13}
                        onChange={(e) => updateTotals({ grandTotalFontSize: parseInt(e.target.value, 10) })}
                        style={{ accentColor: '#7C3AED' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 6. FOOTER & NOTES ── */}
              {designerTab === 'footer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Receipt Footer &amp; Closing Notes</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Configure multi-line closing remarks, WhatsApp contact, and QR code.</p>
                  </div>

                  {/* Line 1 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Footer Line 1 (Main Note)</label>
                    <input
                      type="text"
                      value={templateJson.footer.line1 || ''}
                      onChange={(e) => updateFooter({ line1: e.target.value })}
                      placeholder="e.g. Thank you for your business!"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Line 2 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Footer Line 2 (Sub Note / Terms)</label>
                    <input
                      type="text"
                      value={templateJson.footer.line2 || ''}
                      onChange={(e) => updateFooter({ line2: e.target.value })}
                      placeholder="e.g. Goods once sold cannot be returned without receipt."
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Footer Alignment */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Footer Alignment</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(['left', 'center', 'right'] as const).map((al) => (
                        <button
                          key={al}
                          type="button"
                          onClick={() => updateFooter({ align: al })}
                          style={{
                            flex: 1,
                            padding: '6px',
                            borderRadius: '6px',
                            border: (templateJson.footer.align || 'center') === al ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                            background: (templateJson.footer.align || 'center') === al ? '#F5F3FF' : '#FFFFFF',
                            color: (templateJson.footer.align || 'center') === al ? '#6D28D9' : '#475569',
                            fontWeight: 700,
                            fontSize: '11px',
                            textTransform: 'capitalize',
                            cursor: 'pointer',
                          }}
                        >
                          {al}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* WhatsApp Line */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>WhatsApp Support Number</label>
                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#64748B' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.footer.showWhatsapp}
                          onChange={(e) => updateFooter({ showWhatsapp: e.target.checked })}
                          style={{ accentColor: '#7C3AED' }}
                        />
                        Show WhatsApp
                      </label>
                    </div>
                    <input
                      type="text"
                      value={templateJson.footer.whatsappNumber || ''}
                      onChange={(e) => updateFooter({ whatsappNumber: e.target.value, showWhatsapp: e.target.value.trim().length > 0 })}
                      placeholder="e.g. 0300-1234567"
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {/* ── 7. CUSTOM LABELS ── */}
              {designerTab === 'labels' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Custom Table &amp; Total Header Labels</h4>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Rename any label printed on the receipt according to your branch preference.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B' }}>Item Name Label</label>
                      <input
                        type="text"
                        value={templateJson.itemsTable.colLabelName || 'Item'}
                        onChange={(e) => updateItemsTable({ colLabelName: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B' }}>Quantity Label</label>
                      <input
                        type="text"
                        value={templateJson.itemsTable.colLabelQty || 'Qty'}
                        onChange={(e) => updateItemsTable({ colLabelQty: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B' }}>Rate Label</label>
                      <input
                        type="text"
                        value={templateJson.itemsTable.colLabelRate || 'Rate'}
                        onChange={(e) => updateItemsTable({ colLabelRate: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B' }}>Line Total Label</label>
                      <input
                        type="text"
                        value={templateJson.itemsTable.colLabelAmount || 'Total'}
                        onChange={(e) => updateItemsTable({ colLabelAmount: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B' }}>NET Total Label</label>
                      <input
                        type="text"
                        value={templateJson.totals.netTotalLabel || 'NET TOTAL:'}
                        onChange={(e) => updateTotals({ netTotalLabel: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B' }}>Subtotal Label</label>
                      <input
                        type="text"
                        value={templateJson.totals.subtotalLabel || 'Subtotal:'}
                        onChange={(e) => updateTotals({ subtotalLabel: e.target.value })}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  disabled={saving}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  Reset to Blank Format
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Printer style={{ width: 14, height: 14 }} />
                    Test Print
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#7C3AED',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                    }}
                  >
                    <Save style={{ width: 14, height: 14 }} />
                    {saving ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Thermal Preview Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Live Thermal Preview</span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{PAPER_SIZE_CONFIG[paperSize].label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#F1F5F9', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', minHeight: '480px' }}>
              <DevReceiptPreview
                template={templateJson}
                paperSize={paperSize}
                invoiceData={mockInvoiceData}
                scale={templateJson.layout.scale}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Brand Triggers View */}
      {activeSubTab === 'brands' && (
        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Brand Pulse Triggers
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
              Configure specific brands associated with this non-branded thermal printout format.
            </p>
          </div>

          {allBrands.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No brands found for this branch. Create brands in inventory first.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {allBrands.map((b) => {
                const isSelected = selectedBrandIds.has(b.id);
                return (
                  <div
                    key={b.id}
                    onClick={() => handleToggleBrand(b.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                      background: isSelected ? '#F5F3FF' : '#FAFAFA',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: '16px', height: '16px', accentColor: '#7C3AED', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#4C1D95' : '#1E293B' }}>
                        {b.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {selectedBrandIds.size} of {allBrands.length} brands selected
            </span>
            <button
              type="button"
              onClick={handleSaveBrands}
              disabled={savingBrands}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#7C3AED',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Save style={{ width: 15, height: 15 }} />
              {savingBrands ? 'Saving Triggers...' : 'Save Brand Triggers'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
