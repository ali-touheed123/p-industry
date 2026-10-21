'use client';

import React, { useState, useEffect } from 'react';
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

interface SpecialReceiptSettingsProps {
  tenantId: string;
  tenantName?: string;
}

interface BrandItem {
  id: string;
  name: string;
}

export default function SpecialReceiptSettings({
  tenantId,
  tenantName = 'PyntFlow Branch',
}: SpecialReceiptSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'designer' | 'brands'>('designer');
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

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/special-receipt-templates', {
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
      const res = await fetch(`/api/special-receipt-templates?tenant_id=${tenantId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to reset');
      setTemplateJson(BLANK_SPECIAL_TEMPLATE_JSON);
      setIsCustom(false);
      showToast('Special template reset to blank canvas.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBrand = (brandId: string) => {
    const next = new Set(selectedBrandIds);
    if (next.has(brandId)) {
      next.delete(brandId);
    } else {
      next.add(brandId);
    }
    setSelectedBrandIds(next);
  };

  const handleSaveBrands = async () => {
    setSavingBrands(true);
    try {
      const res = await fetch('/api/special-receipt-brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          brand_ids: Array.from(selectedBrandIds),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save brand triggers');
      showToast(`Saved ${selectedBrandIds.size} brand triggers successfully!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingBrands(false);
    }
  };

  const handleTestPrint = () => {
    const mockSnap = {
      invoice_no: 'SR-TEST-001',
      date: new Date().toISOString().split('T')[0],
      items: [
        { item_name: 'Premium Silk Enamel (White)', qty: 2, pre_discount_rate: 4200, unit_price: 4200 },
        { item_name: 'Synthetic Undercoat Primer', qty: 1, pre_discount_rate: 1800, unit_price: 1800 },
      ],
      printed_total: 10200,
      delivery_charge: 0,
      header_note: templateJson.header.showAddress ? templateJson.header.customAddress : '',
      footer_note: templateJson.footer.line1 || 'Thank you!',
    };
    const html = buildSpecialReceiptHtml(mockSnap, templateJson, false);
    printViaIframe(html);
  };

  const mockInvoiceData: ReceiptInvoiceData = {
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
  };

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
                {isCustom ? 'CUSTOMIZED' : 'DEFAULT BLANK'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#DDD6FE', margin: '2px 0 0' }}>
              Design clean non-branded receipts & configure brand triggers for automatic button pulse in POS
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

      {/* Sub-Tab 1: Designer View */}
      {activeSubTab === 'designer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 0.8fr)', gap: '20px', alignItems: 'start' }}>
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Receipt Header &amp; Branding</span>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Zero store identity by default</span>
            </div>

            {/* Custom Header Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Custom Receipt Header / Shop Name (Optional)</label>
              <input
                type="text"
                value={templateJson.header.customShopName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateJson((prev) => ({
                    ...prev,
                    header: {
                      ...prev.header,
                      customShopName: val,
                      showShopName: val.trim().length > 0,
                    },
                  }));
                }}
                placeholder="Leave blank for zero store name"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
              />
              <span style={{ fontSize: '11px', color: '#64748B' }}>When left empty, no company or shop name appears at top of receipt.</span>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Custom Address Line (Optional)</label>
              <input
                type="text"
                value={templateJson.header.customAddress || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateJson((prev) => ({
                    ...prev,
                    header: {
                      ...prev.header,
                      customAddress: val,
                      showAddress: val.trim().length > 0,
                    },
                  }));
                }}
                placeholder="Leave blank to suppress address"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
              />
            </div>

            {/* Phone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Custom Phone / Contact (Optional)</label>
              <input
                type="text"
                value={templateJson.header.customPhone || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateJson((prev) => ({
                    ...prev,
                    header: {
                      ...prev.header,
                      customPhone: val,
                      showPhone: val.trim().length > 0,
                    },
                  }));
                }}
                placeholder="Leave blank to suppress phone"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
              />
            </div>

            {/* Paper Size Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Printer Paper Size</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['thermal_80', 'thermal_58'] as PaperSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPaperSize(size)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: paperSize === size ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                      background: paperSize === size ? '#F5F3FF' : '#FFFFFF',
                      color: paperSize === size ? '#6D28D9' : '#334155',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {PAPER_SIZE_CONFIG[size].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Notice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Footer Note</label>
              <input
                type="text"
                value={templateJson.footer.line1 || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateJson((prev) => ({
                    ...prev,
                    footer: {
                      ...prev.footer,
                      line1: val,
                    },
                  }));
                }}
                placeholder="e.g. Thank you for your business!"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
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
                Reset Blank
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
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#7C3AED',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12px',
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

          {/* Thermal Preview Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Live Thermal Preview</span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{PAPER_SIZE_CONFIG[paperSize].label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#F1F5F9', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', minHeight: '480px' }}>
              <DevReceiptPreview
                template={templateJson}
                paperSize={paperSize}
                invoiceData={mockInvoiceData}
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
              Select the brands that should cause the <strong>SPECIAL SAVE &amp; PRINT (F6)</strong> button to blink in vibrant violet when added to the POS cart.
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
                        onChange={() => {}} // handled by parent onClick
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
