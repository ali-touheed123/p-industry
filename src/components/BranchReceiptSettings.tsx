'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  FileText,
  Layers,
  Store,
  Phone,
  MapPin,
  Image as ImageIcon,
  Hash,
  DollarSign,
  Info,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from 'lucide-react';
import {
  ReceiptTemplate,
  TemplateJson,
  PaperSize,
  PAPER_SIZE_CONFIG,
  DEFAULT_TEMPLATE_JSON,
  TableColumnId,
} from '@/types/receipt';
import { DevReceiptPreview, ReceiptInvoiceData } from './dev-panel/DevReceiptPreview';
import { renderReceiptDocument, RenderReceiptData } from '@/utils/receiptRenderCore';
import { printViaIframe } from '@/utils/iframePrint';

interface BranchReceiptSettingsProps {
  tenantId: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantAddress?: string;
  staffName?: string;
  onTemplateSaved?: (savedTemplate: ReceiptTemplate) => void;
}

type TabKey = 'paper' | 'header' | 'meta' | 'table' | 'totals' | 'footer' | 'labels';

const ALL_TABLE_COLUMNS: { id: TableColumnId; label: string; desc: string }[] = [
  { id: 'name', label: 'Product Name', desc: 'Item description and title' },
  { id: 'code', label: 'Item Code / SKU', desc: 'Product barcode or SKU number' },
  { id: 'qty', label: 'Quantity', desc: 'Count / packs sold' },
  { id: 'rate', label: 'Unit Rate', desc: 'Price per individual unit' },
  { id: 'discount', label: 'Item Discount', desc: 'Per-item discount deduction' },
  { id: 'amount', label: 'Total Amount', desc: 'Final line item total' },
];

export default function BranchReceiptSettings({
  tenantId,
  tenantName = 'PyntFlow Branch',
  tenantPhone = '',
  tenantAddress = '',
  staffName = 'Counter Staff',
  onTemplateSaved,
}: BranchReceiptSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('header');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Template state
  const [templateName, setTemplateName] = useState<string>('');
  const [paperSize, setPaperSize] = useState<PaperSize>('thermal_80');
  const [templateJson, setTemplateJson] = useState<TemplateJson>(
    JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_JSON))
  );
  const [defaultTemplate, setDefaultTemplate] = useState<ReceiptTemplate | null>(null);

  // Preview zoom
  const [previewScale, setPreviewScale] = useState<number>(1);

  // Auto-dismiss toast
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Fetch branch receipt configuration
  const fetchBranchTemplate = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/receipt-templates/branch?tenant_id=${tenantId}`);
      const data = await res.json();

      if (data.success && data.template) {
        setIsCustom(Boolean(data.is_custom));
        setPaperSize(data.template.paper_size || 'thermal_80');
        setTemplateName(data.template.name || `${tenantName} Receipt`);

        // Merge fetched template_json with default to ensure all keys exist
        const mergedJson = {
          ...DEFAULT_TEMPLATE_JSON,
          ...(data.template.template_json || {}),
          header: { ...DEFAULT_TEMPLATE_JSON.header, ...(data.template.template_json?.header || {}) },
          invoiceInfo: { ...DEFAULT_TEMPLATE_JSON.invoiceInfo, ...(data.template.template_json?.invoiceInfo || {}) },
          itemsTable: { ...DEFAULT_TEMPLATE_JSON.itemsTable, ...(data.template.template_json?.itemsTable || {}) },
          totals: { ...DEFAULT_TEMPLATE_JSON.totals, ...(data.template.template_json?.totals || {}) },
          footer: { ...DEFAULT_TEMPLATE_JSON.footer, ...(data.template.template_json?.footer || {}) },
          layout: { ...DEFAULT_TEMPLATE_JSON.layout, ...(data.template.template_json?.layout || {}) },
        };
        setTemplateJson(mergedJson);

        if (data.defaultTemplate) {
          setDefaultTemplate(data.defaultTemplate);
        }
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to load receipt settings' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error fetching receipt settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchBranchTemplate();
    }
  }, [tenantId]);

  // Save changes specifically for this branch
  const handleSave = async () => {
    try {
      setSaving(true);
      setFeedback(null);

      const res = await fetch('/api/receipt-templates/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: templateName,
          paper_size: paperSize,
          template_json: templateJson,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCustom(true);
        setFeedback({
          type: 'success',
          message: 'Receipt layout saved successfully! Only your branch will use this customized receipt.',
        });
        if (data.template && onTemplateSaved) {
          onTemplateSaved(data.template);
        }
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to save receipt settings' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error saving receipt settings' });
    } finally {
      setSaving(false);
    }
  };

  // Reset to platform default
  const handleConfirmReset = async () => {
    try {
      setResetting(true);
      setShowResetModal(false);

      const res = await fetch(`/api/receipt-templates/branch?tenant_id=${tenantId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success && data.template) {
        setIsCustom(false);
        setPaperSize(data.template.paper_size || 'thermal_80');
        setTemplateName(data.template.name || 'Platform Default Template');
        setTemplateJson(JSON.parse(JSON.stringify(data.template.template_json || DEFAULT_TEMPLATE_JSON)));
        setFeedback({
          type: 'success',
          message: 'Branch receipt reverted to company default template.',
        });
        if (onTemplateSaved) {
          onTemplateSaved(data.template);
        }
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to reset receipt' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error resetting receipt' });
    } finally {
      setResetting(false);
    }
  };

  // Test Print via iframe
  const handleTestPrint = () => {
    const effectiveShopName = templateJson.header.showShopName
      ? (templateJson.header.customShopName?.trim() || tenantName)
      : '';

    const testReceiptData: RenderReceiptData = {
      tenantName: effectiveShopName || 'PyntFlow Store',
      invoiceNo: 'TEST-0042',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      clientName: 'Walk-in Customer (Test)',
      staffName: staffName || 'Counter Staff',
      paymentMethod: 'CASH',
      items: [
        {
          name: 'Weather Shield Matt Finish 4L',
          shadeCode: 'Off-White 101',
          code: 'WSM-04',
          qty: 2,
          rate: 3450,
          total: 6900,
        },
        {
          name: 'Super Gloss Enamel 1L',
          shadeCode: 'Signal Red 303',
          code: 'SGE-01',
          qty: 1,
          rate: 1150,
          total: 1150,
        },
        {
          name: 'Wall Putty Premium 20kg',
          shadeCode: 'White',
          code: 'WPP-20',
          qty: 1,
          rate: 1850,
          total: 1850,
        },
      ],
      subTotal: 9900,
      discount: 100,
      deliveryCharge: 0,
      grandTotal: 9800,
      paidAmount: 10000,
      changeReturned: 200,
      dueAmount: 0,
      isReprint: false,
    };

    const html = renderReceiptDocument(testReceiptData, templateJson, paperSize);
    const printOk = printViaIframe(html);
    if (!printOk) {
      alert('Could not initialize print dialog. Please check browser popups/printer permissions.');
    }
  };

  // Mock invoice data customized for this branch in live preview
  const previewInvoiceData: ReceiptInvoiceData = useMemo(() => {
    return {
      invoice_no: 'INV-2026-9021',
      date: '2026-10-20 02:30 PM',
      cashier_name: `${staffName} (Counter 1)`,
      client_name: 'Walk-in Customer',
      payment_method: 'Cash',
      shop_name: templateJson.header.showShopName
        ? (templateJson.header.customShopName?.trim() || tenantName)
        : '',
      shop_address: templateJson.header.showAddress
        ? (templateJson.header.customAddress?.trim() || tenantAddress || 'Branch Address')
        : '',
      shop_phone: templateJson.header.showPhone
        ? (templateJson.header.customPhone?.trim() || tenantPhone || '+92 300 0000000')
        : '',
      items: [
        {
          item_name: 'Weather Shield Matt Finish 4L',
          shade_code: 'Off-White 101',
          code: 'WSM-04',
          qty: 2,
          unit_price: 3450,
          discount: 100,
          total_price: 6800,
        },
        {
          item_name: 'Super Gloss Enamel 1L',
          shade_code: 'Signal Red 303',
          code: 'SGE-01',
          qty: 1,
          unit_price: 1150,
          discount: 0,
          total_price: 1150,
        },
        {
          item_name: 'Wall Putty Premium 20kg',
          shade_code: 'White',
          code: 'WPP-20',
          qty: 1,
          unit_price: 1850,
          discount: 50,
          total_price: 1800,
        },
      ],
      subtotal: 9800,
      discount: 150,
      tax: templateJson.totals.showGst ? Math.round(9650 * ((templateJson.totals.gstRate || 0) / 100)) : 0,
      net_total: templateJson.totals.showGst
        ? 9650 + Math.round(9650 * ((templateJson.totals.gstRate || 0) / 100))
        : 9650,
      paid_amount: 10000,
      due_amount: 0,
      token_claim_code: 'CLM-DEMO88',
      token_claim_details: 'Super Gloss Enamel 1L (x1) - Rs. 50 token',
    };
  }, [templateJson, tenantName, tenantAddress, tenantPhone, staffName]);

  // Nested property updaters
  const updateHeader = (fields: Partial<TemplateJson['header']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      header: { ...prev.header, ...fields },
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

  const updateLayout = (fields: Partial<TemplateJson['layout']>) => {
    setTemplateJson((prev) => ({
      ...prev,
      layout: { ...prev.layout, ...fields },
    }));
  };

  const toggleColumn = (colId: TableColumnId) => {
    setTemplateJson((prev) => {
      const curCols = prev.itemsTable.columns || ['name', 'qty', 'rate', 'amount'];
      let nextCols: TableColumnId[];
      if (curCols.includes(colId)) {
        if (curCols.length <= 1) return prev; // Keep at least one column
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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: '#0F172A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Loading receipt settings...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      {/* ── Top Header Bar ── */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '18px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#0F172A',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(15, 23, 42, 0.15)',
            }}
          >
            <Printer style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Receipt Settings &amp; Layout
              </h1>
              {isCustom ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: '#FEF3C7',
                    color: '#92400E',
                    border: '1px solid #FCD34D',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <Sparkles style={{ width: 12, height: 12 }} />
                  Custom Branch Layout
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 style={{ width: 12, height: 12 }} />
                  Company Default Active
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              Branch: <strong style={{ color: '#0F172A' }}>{tenantName}</strong> — Edit printer settings, logo, phone, header &amp; footer notes without affecting other branches.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleTestPrint}
            title="Print test receipt to verify thermal roll layout"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Printer style={{ width: 15, height: 15, color: '#0284C7' }} />
            Test Print
          </button>

          {isCustom && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={resetting}
              title="Reset branch receipt layout to company default"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid #FCA5A5',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 600,
                cursor: resetting ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              Reset to Default
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              background: '#0F172A',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
              opacity: saving ? 0.75 : 1,
            }}
          >
            <Save style={{ width: 15, height: 15, color: '#38BDF8' }} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── Status Explanation Banner ── */}
      <div
        style={{
          background: isCustom ? '#FFFBEB' : '#F0F9FF',
          border: `1px solid ${isCustom ? '#FDE68A' : '#BAE6FD'}`,
          borderRadius: '10px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Info style={{ width: 18, height: 18, color: isCustom ? '#D97706' : '#0284C7', flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: isCustom ? '#92400E' : '#0369A1', lineHeight: '1.5' }}>
          {isCustom ? (
            <span>
              <strong>Branch-Specific Isolation Active:</strong> Aap ki branch ke liye custom receipt layout save hai. Aap yahan jo bhi changes karenge, woh <strong>sirf aap ki branch ({tenantName})</strong> tak mehdood rahenge. Master Default Template aur doosri branches bilkul mehfooz hain.
            </span>
          ) : (
            <span>
              <strong>Platform Default Template:</strong> Yeh branch abhi company ka default receipt format use kar rahi hai. Neeche apni marzi ki settings ya shop name/phone badal kar <strong>Save Settings</strong> dabayein — aap ki branch ka apna alag layout tayar ho jayega aur default par koi asar nahi parega.
            </span>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
            color: feedback.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 style={{ width: 18, height: 18, color: '#10B981', flexShrink: 0 }} />
          ) : (
            <AlertCircle style={{ width: 18, height: 18, color: '#EF4444', flexShrink: 0 }} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── Main Split View (Editor Left, Simulator Right) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(360px, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* ── LEFT COLUMN: Configuration Controls ── */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Navigation Tabs */}
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
              { id: 'header', label: 'Store & Header', icon: Store },
              { id: 'paper', label: 'Paper & Page', icon: FileText },
              { id: 'meta', label: 'Invoice Meta', icon: Hash },
              { id: 'table', label: 'Table Columns', icon: Layers },
              { id: 'totals', label: 'Totals & Tax', icon: DollarSign },
              { id: 'footer', label: 'Footer & Notes', icon: Type },
              { id: 'labels', label: 'Custom Labels', icon: AlignLeft },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    background: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#0F172A' : '#64748B',
                    boxShadow: isActive ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon style={{ width: 14, height: 14, color: isActive ? '#0284C7' : '#94A3B8' }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Body */}
          <div style={{ padding: '24px' }}>
            {/* ── TAB 1: HEADER & STORE DETAILS ── */}
            {activeTab === 'header' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Store Branding &amp; Receipt Header
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Configure the top information printed on customer receipts.
                  </p>
                </div>

                {/* Shop Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Show Shop / Branch Name
                    </label>
                    <input
                      type="checkbox"
                      checked={templateJson.header.showShopName}
                      onChange={(e) => updateHeader({ showShopName: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </div>
                  {templateJson.header.showShopName && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={templateJson.header.customShopName ?? tenantName}
                        onChange={(e) => updateHeader({ customShopName: e.target.value })}
                        placeholder={tenantName}
                        style={{ fontSize: '13px' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Font Size</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              className="form-input"
                              min="9"
                              max="32"
                              value={templateJson.header.shopNameSize ?? 15}
                              onChange={(e) => updateHeader({ shopNameSize: Number(e.target.value) })}
                              style={{ fontSize: '12px' }}
                            />
                            <span style={{ fontSize: '11px', color: '#64748B' }}>px</span>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Letter Spacing</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="0.5"
                            className="form-input"
                            value={templateJson.header.shopNameLetterSpacing ?? 0.05}
                            onChange={(e) => updateHeader({ shopNameLetterSpacing: Number(e.target.value) })}
                            style={{ fontSize: '12px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '16px' }}>
                          <input
                            type="checkbox"
                            id="uppercaseShopName"
                            checked={templateJson.header.shopNameUppercase !== false}
                            onChange={(e) => updateHeader({ shopNameUppercase: e.target.checked })}
                            style={{ accentColor: '#0F172A', cursor: 'pointer' }}
                          />
                          <label htmlFor="uppercaseShopName" style={{ fontSize: '12px', color: '#334155', cursor: 'pointer' }}>UPPERCASE</label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Address */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Show Shop Address
                    </label>
                    <input
                      type="checkbox"
                      checked={templateJson.header.showAddress}
                      onChange={(e) => updateHeader({ showAddress: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </div>
                  {templateJson.header.showAddress && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={templateJson.header.customAddress ?? tenantAddress}
                        onChange={(e) => updateHeader({ customAddress: e.target.value })}
                        placeholder={tenantAddress || 'Enter branch address...'}
                        style={{ fontSize: '13px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Address Font Size:</span>
                        <input
                          type="number"
                          className="form-input"
                          min="8"
                          max="18"
                          value={templateJson.header.addressSize ?? 10}
                          onChange={(e) => updateHeader({ addressSize: Number(e.target.value) })}
                          style={{ width: '70px', fontSize: '12px' }}
                        />
                        <span style={{ fontSize: '11px', color: '#64748B' }}>px</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Show Contact / Phone
                    </label>
                    <input
                      type="checkbox"
                      checked={templateJson.header.showPhone}
                      onChange={(e) => updateHeader({ showPhone: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </div>
                  {templateJson.header.showPhone && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={templateJson.header.customPhone ?? tenantPhone}
                        onChange={(e) => updateHeader({ customPhone: e.target.value })}
                        placeholder={tenantPhone || 'e.g. +92 300 1234567'}
                        style={{ fontSize: '13px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Phone Font Size:</span>
                        <input
                          type="number"
                          className="form-input"
                          min="8"
                          max="18"
                          value={templateJson.header.phoneSize ?? 10}
                          onChange={(e) => updateHeader({ phoneSize: Number(e.target.value) })}
                          style={{ width: '70px', fontSize: '12px' }}
                        />
                        <span style={{ fontSize: '11px', color: '#64748B' }}>px</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Logo Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Show Store Logo
                    </label>
                    <input
                      type="checkbox"
                      checked={templateJson.header.showLogo}
                      onChange={(e) => updateHeader({ showLogo: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </div>
                  {templateJson.header.showLogo && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Logo URL</span>
                        <input
                          type="text"
                          className="form-input"
                          value={templateJson.header.logoUrl || ''}
                          onChange={(e) => updateHeader({ logoUrl: e.target.value })}
                          placeholder="/logo.png or https://example.com/logo.png"
                          style={{ fontSize: '12.5px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Logo Size: <strong>{templateJson.header.logoSize || 56}px</strong></span>
                        <input
                          type="range"
                          min="30"
                          max="120"
                          value={templateJson.header.logoSize || 56}
                          onChange={(e) => updateHeader({ logoSize: Number(e.target.value) })}
                          style={{ width: '160px', accentColor: '#0F172A' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Header Alignment & Separator */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Header Alignment
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateHeader({ align })}
                          style={{
                            flex: 1,
                            padding: '6px',
                            borderRadius: '6px',
                            border: `1px solid ${templateJson.header.align === align ? '#0F172A' : '#CBD5E1'}`,
                            background: templateJson.header.align === align ? '#0F172A' : '#FFFFFF',
                            color: templateJson.header.align === align ? '#FFFFFF' : '#475569',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      Divider Line
                    </label>
                    <select
                      className="form-input"
                      value={templateJson.header.separator || 'dashed'}
                      onChange={(e) => updateHeader({ separator: e.target.value as any })}
                      style={{ fontSize: '12.5px', height: '34px' }}
                    >
                      <option value="dashed">Dashed (Standard POS)</option>
                      <option value="solid">Solid Line</option>
                      <option value="double">Double Line</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: PAPER & PAGE ── */}
            {activeTab === 'paper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Paper Size &amp; Typography
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Select paper roll width and baseline font characteristics.
                  </p>
                </div>

                {/* Paper Size Selector */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                    Paper Type / Size
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {(
                      [
                        { id: 'thermal_80', label: 'Thermal 80mm', desc: 'Standard 3-inch roll (Recommended)' },
                        { id: 'thermal_58', label: 'Thermal 58mm', desc: 'Narrow 2-inch mini roll' },
                        { id: 'a4', label: 'A4 Standard', desc: 'Full office laser/inkjet sheet' },
                        { id: 'a5', label: 'A5 Sheet', desc: 'Half-page landscape format' },
                      ] as const
                    ).map((size) => {
                      const isSel = paperSize === size.id;
                      return (
                        <div
                          key={size.id}
                          onClick={() => setPaperSize(size.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: `2px solid ${isSel ? '#0284C7' : '#E2E8F0'}`,
                            background: isSel ? '#F0F9FF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 700, color: isSel ? '#0369A1' : '#0F172A' }}>
                            {size.label}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            {size.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                    Receipt Typography
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(
                      [
                        { id: 'mono', label: 'Monospace (Receipt)', example: 'Courier/JetBrains' },
                        { id: 'sans', label: 'Clean Sans', example: 'Modern UI' },
                        { id: 'serif', label: 'Serif', example: 'Formal' },
                      ] as const
                    ).map((font) => {
                      const isSel = templateJson.layout.fontFamily === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => updateLayout({ fontFamily: font.id })}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: `1px solid ${isSel ? '#0F172A' : '#CBD5E1'}`,
                            background: isSel ? '#0F172A' : '#FFFFFF',
                            color: isSel ? '#FFFFFF' : '#334155',
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700 }}>{font.label}</div>
                          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{font.example}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Base Font Size */}
                <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Base Font Size</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0284C7' }}>
                      {templateJson.layout.fontSize || 12}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="16"
                    value={templateJson.layout.fontSize || 12}
                    onChange={(e) => updateLayout({ fontSize: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#0F172A' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                    <span>10px (Dense)</span>
                    <span>12px (Standard)</span>
                    <span>16px (Large)</span>
                  </div>
                </div>

                {/* Margins */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                    Paper Margins (mm)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {(['marginTop', 'marginBottom', 'marginLeft', 'marginRight'] as const).map((mKey) => (
                      <div key={mKey}>
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px', textTransform: 'capitalize' }}>
                          {mKey.replace('margin', '')}
                        </span>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          max="20"
                          value={templateJson.layout[mKey] ?? 4}
                          onChange={(e) => updateLayout({ [mKey]: Number(e.target.value) })}
                          style={{ textAlign: 'center', fontSize: '12px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: INVOICE META ── */}
            {activeTab === 'meta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Invoice &amp; Transaction Details
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Control which invoice metadata fields appear below the header.
                  </p>
                </div>

                {/* Invoice Label */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Invoice Number Label
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={templateJson.invoiceInfo.invoiceLabel || 'Invoice #'}
                    onChange={(e) => updateInvoiceInfo({ invoiceLabel: e.target.value })}
                    placeholder="e.g. Invoice #, Bill No, Cash Memo"
                    style={{ fontSize: '13px' }}
                  />
                </div>

                {/* Meta Font Size */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block' }}>Meta Rows Font Size</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Size for date, cashier, customer, and payment method</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      className="form-input"
                      min="8"
                      max="18"
                      step="0.5"
                      value={templateJson.invoiceInfo.fontSize ?? 10.5}
                      onChange={(e) => updateInvoiceInfo({ fontSize: Number(e.target.value) })}
                      style={{ width: '80px', fontSize: '12px', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>px</span>
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { key: 'showInvoiceNo', label: 'Show Invoice Number' },
                    { key: 'showDate', label: 'Show Date & Time' },
                    { key: 'showCashier', label: 'Show Cashier / Staff Name' },
                    { key: 'showCustomer', label: 'Show Customer Name' },
                    { key: 'showPaymentMethod', label: 'Show Payment Method (Cash/Card/Split)' },
                  ].map((field) => (
                    <label
                      key={field.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{field.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(templateJson.invoiceInfo[field.key as keyof typeof templateJson.invoiceInfo])}
                        onChange={(e) => updateInvoiceInfo({ [field.key]: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 4: TABLE COLUMNS ── */}
            {activeTab === 'table' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Itemized Table Columns
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Select which columns print on the customer receipt roll.
                  </p>
                </div>

                {/* Column Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ALL_TABLE_COLUMNS.map((col) => {
                    const isChecked = templateJson.itemsTable.columns?.includes(col.id);
                    return (
                      <div
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${isChecked ? '#0284C7' : '#E2E8F0'}`,
                          background: isChecked ? '#F0F9FF' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isChecked ? '#0369A1' : '#334155' }}>
                            {col.label}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{col.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ width: '16px', height: '16px', accentColor: '#0284C7', cursor: 'pointer' }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Table formatting options */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Compact Spacing</span>
                    <input
                      type="checkbox"
                      checked={templateJson.itemsTable.compact}
                      onChange={(e) => updateItemsTable({ compact: e.target.checked })}
                      style={{ accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Show Table Borders</span>
                    <input
                      type="checkbox"
                      checked={templateJson.itemsTable.showBorders}
                      onChange={(e) => updateItemsTable({ showBorders: e.target.checked })}
                      style={{ accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ── TAB 5: TOTALS & TAX ── */}
            {activeTab === 'totals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Totals, Discount &amp; Tax Calculation
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Configure financial calculations and totals display format.
                  </p>
                </div>

                {/* Currency Symbol */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Currency Symbol</label>
                  <input
                    type="text"
                    className="form-input"
                    value={templateJson.totals.currencySymbol || 'Rs.'}
                    onChange={(e) => updateTotals({ currencySymbol: e.target.value })}
                    placeholder="Rs., PKR, $"
                    style={{ fontSize: '13px', maxWidth: '200px' }}
                  />
                </div>

                {/* Totals Section Typography */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Totals Base Font Size
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        className="form-input"
                        min="8"
                        max="18"
                        step="0.5"
                        value={templateJson.totals.fontSize ?? 11}
                        onChange={(e) => updateTotals({ fontSize: Number(e.target.value) })}
                        style={{ width: '90px', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#64748B' }}>px</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Grand Total Font Size
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        className="form-input"
                        min="10"
                        max="26"
                        step="0.5"
                        value={templateJson.totals.grandTotalFontSize ?? 13}
                        onChange={(e) => updateTotals({ grandTotalFontSize: Number(e.target.value) })}
                        style={{ width: '90px', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#64748B' }}>px</span>
                    </div>
                  </div>
                </div>

                {/* Tax / GST Toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Show GST / Sales Tax</span>
                    <input
                      type="checkbox"
                      checked={templateJson.totals.showGst}
                      onChange={(e) => updateTotals({ showGst: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </div>
                  {templateJson.totals.showGst && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Tax Rate (%):</span>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        max="100"
                        value={templateJson.totals.gstRate || 0}
                        onChange={(e) => updateTotals({ gstRate: Number(e.target.value) })}
                        style={{ width: '100px', fontSize: '12px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Row Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: 'showSubtotal', label: 'Show Subtotal' },
                    { key: 'showDiscount', label: 'Show Invoice Discount' },
                    { key: 'showGrandTotal', label: 'Show Grand Total' },
                    { key: 'boldTotal', label: 'Emphasize / Bold Total Line' },
                    { key: 'showPaid', label: 'Show Amount Paid & Change' },
                    { key: 'showBalance', label: 'Show Balance Due' },
                    { key: 'highlightBalanceDue', label: 'Highlight Due Balance in Red / Box' },
                  ].map((field) => (
                    <label
                      key={field.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#FFFFFF',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{field.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(templateJson.totals[field.key as keyof typeof templateJson.totals])}
                        onChange={(e) => updateTotals({ [field.key]: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 6: FOOTER & POLICY ── */}
            {activeTab === 'footer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Footer Notice &amp; Exchange Policy
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Custom messages, thank you notes, return policies, and support numbers.
                  </p>
                </div>

                {/* Footer Alignment */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                    Footer Alignment
                  </label>
                  <div style={{ display: 'flex', gap: '6px', maxWidth: '240px' }}>
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateFooter({ align })}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          border: `1px solid ${(templateJson.footer.align || 'center') === align ? '#0F172A' : '#CBD5E1'}`,
                          background: (templateJson.footer.align || 'center') === align ? '#0F172A' : '#FFFFFF',
                          color: (templateJson.footer.align || 'center') === align ? '#FFFFFF' : '#475569',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line 1 (Greeting) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Thank You Message (Line 1)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Size:</span>
                      <input
                        type="number"
                        className="form-input"
                        min="7"
                        max="18"
                        step="0.5"
                        value={templateJson.footer.line1Size ?? 9.5}
                        onChange={(e) => updateFooter({ line1Size: Number(e.target.value) })}
                        style={{ width: '65px', fontSize: '11px', padding: '3px 6px' }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748B' }}>px</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    value={templateJson.footer.line1}
                    onChange={(e) => updateFooter({ line1: e.target.value })}
                    placeholder="e.g. Thank you for your business!"
                    style={{ fontSize: '13px' }}
                  />
                </div>

                {/* Line 2 (Policy) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Return / Exchange Policy (Line 2)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Size:</span>
                      <input
                        type="number"
                        className="form-input"
                        min="7"
                        max="18"
                        step="0.5"
                        value={templateJson.footer.line2Size ?? 9}
                        onChange={(e) => updateFooter({ line2Size: Number(e.target.value) })}
                        style={{ width: '65px', fontSize: '11px', padding: '3px 6px' }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748B' }}>px</span>
                    </div>
                  </div>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={templateJson.footer.line2}
                    onChange={(e) => updateFooter({ line2: e.target.value })}
                    placeholder="e.g. Returns accepted within 7 days with original receipt."
                    style={{ fontSize: '13px', resize: 'vertical' }}
                  />
                </div>

                {/* WhatsApp Support */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      Show WhatsApp Support Number
                    </label>
                    <input
                      type="checkbox"
                      checked={templateJson.footer.showWhatsapp}
                      onChange={(e) => updateFooter({ showWhatsapp: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                    />
                  </div>
                  {templateJson.footer.showWhatsapp && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={templateJson.footer.whatsappNumber || ''}
                        onChange={(e) => updateFooter({ whatsappNumber: e.target.value })}
                        placeholder="e.g. +92 300 1234567"
                        style={{ fontSize: '13px', flex: 1 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Size:</span>
                        <input
                          type="number"
                          className="form-input"
                          min="7"
                          max="18"
                          step="0.5"
                          value={templateJson.footer.whatsappSize ?? 9}
                          onChange={(e) => updateFooter({ whatsappSize: Number(e.target.value) })}
                          style={{ width: '65px', fontSize: '11px', padding: '3px 6px' }}
                        />
                        <span style={{ fontSize: '11px', color: '#64748B' }}>px</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Powered By Pyntflow */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block' }}>
                      Show Powered by Pyntflow
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Displays software brand watermark at bottom</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={templateJson.footer.showPoweredBy}
                    onChange={(e) => updateFooter({ showPoweredBy: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#0F172A', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            {/* ── TAB 7: CUSTOM LABELS ── */}
            {activeTab === 'labels' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Custom Receipt Labels
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
                    Change any word or sentence printed on the receipt — invoice rows, totals labels, table headers, and more.
                  </p>
                </div>

                {/* Header Phone Prefix */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Header</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '13px', color: '#475569', flexShrink: 0, minWidth: '160px' }}>Phone / Contact Prefix</label>
                      <input
                        type="text"
                        className="form-input"
                        value={templateJson.header.phonePrefix ?? 'Tel:'}
                        onChange={(e) => updateHeader({ phonePrefix: e.target.value })}
                        placeholder="Tel:"
                        style={{ fontSize: '13px', maxWidth: '220px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Meta Labels */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice Info Rows</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'invoiceLabel', label: 'Invoice Number Label', placeholder: 'Invoice #', section: 'invoiceInfo' as const },
                      { key: 'dateLabel', label: 'Date Row Label', placeholder: 'Date:', section: 'invoiceInfo' as const },
                      { key: 'customerLabel', label: 'Customer Row Label', placeholder: 'Customer:', section: 'invoiceInfo' as const },
                      { key: 'cashierLabel', label: 'Cashier / Staff Label', placeholder: 'Staff:', section: 'invoiceInfo' as const },
                      { key: 'paymentLabel', label: 'Payment Method Label', placeholder: 'Payment:', section: 'invoiceInfo' as const },
                    ].map((f) => (
                      <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '13px', color: '#475569', flexShrink: 0, minWidth: '180px' }}>{f.label}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={(templateJson.invoiceInfo as any)[f.key] ?? f.placeholder}
                          onChange={(e) => updateInvoiceInfo({ [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          style={{ fontSize: '13px', maxWidth: '220px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Table Column Header Labels */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Table Column Headers</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'colLabelCode', label: 'Code / SKU Column', placeholder: 'Code' },
                      { key: 'colLabelName', label: 'Item Name Column', placeholder: 'Item' },
                      { key: 'colLabelQty', label: 'Quantity Column', placeholder: 'Qty' },
                      { key: 'colLabelRate', label: 'Rate / Price Column', placeholder: 'Rate' },
                      { key: 'colLabelDiscount', label: 'Discount Column', placeholder: 'Disc' },
                      { key: 'colLabelAmount', label: 'Amount / Total Column', placeholder: 'Total' },
                    ].map((f) => (
                      <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '13px', color: '#475569', flexShrink: 0, minWidth: '180px' }}>{f.label}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={(templateJson.itemsTable as any)[f.key] ?? f.placeholder}
                          onChange={(e) => updateItemsTable({ [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          style={{ fontSize: '13px', maxWidth: '220px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals Row Labels */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totals Section Labels</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'subtotalLabel', label: 'Subtotal Row', placeholder: 'Subtotal:' },
                      { key: 'discountLabel', label: 'Discount Row', placeholder: 'Discount:' },
                      { key: 'deliveryLabel', label: 'Delivery Charge Row', placeholder: 'Delivery:' },
                      { key: 'netTotalLabel', label: 'Grand / Net Total Row', placeholder: 'NET TOTAL:' },
                      { key: 'paidLabel', label: 'Amount Paid Row', placeholder: 'Paid:' },
                      { key: 'changeLabel', label: 'Change Returned Row', placeholder: 'Change Returned:' },
                      { key: 'balanceDueLabel', label: 'Balance Due Row', placeholder: 'Balance Due:' },
                    ].map((f) => (
                      <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '13px', color: '#475569', flexShrink: 0, minWidth: '180px' }}>{f.label}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={(templateJson.totals as any)[f.key] ?? f.placeholder}
                          onChange={(e) => updateTotals({ [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          style={{ fontSize: '13px', maxWidth: '220px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Section Labels */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Footer Section Labels</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '13px', color: '#475569', flexShrink: 0, minWidth: '180px' }}>WhatsApp Prefix / Label</label>
                      <input
                        type="text"
                        className="form-input"
                        value={templateJson.footer.whatsappLabel ?? 'WhatsApp:'}
                        onChange={(e) => updateFooter({ whatsappLabel: e.target.value })}
                        placeholder="WhatsApp:"
                        style={{ fontSize: '13px', maxWidth: '220px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Live Interactive Thermal Simulator ── */}
        <div
          style={{
            position: 'sticky',
            top: '20px',
            background: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye style={{ width: 17, height: 17, color: '#0284C7' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Live Receipt Preview
              </h3>
            </div>

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setPreviewScale((prev) => Math.max(0.75, prev - 0.05))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                <ZoomOut style={{ width: 13, height: 13, color: '#475569' }} />
              </button>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', width: '38px', textAlign: 'center' }}>
                {Math.round(previewScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewScale((prev) => Math.min(1.25, prev + 0.05))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                <ZoomIn style={{ width: 13, height: 13, color: '#475569' }} />
              </button>
            </div>
          </div>

          {/* Thermal Paper Simulation Container */}
          <div
            style={{
              background: '#F1F5F9',
              borderRadius: '12px',
              padding: '20px 10px',
              maxHeight: '680px',
              overflowY: 'auto',
              display: 'flex',
              justifyContent: 'center',
              boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', transition: 'transform 0.1s ease' }}>
              <DevReceiptPreview
                template={templateJson}
                paperSize={paperSize}
                invoiceData={previewInvoiceData}
                scale={1}
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
            * Preview updates live as you change settings above.
          </div>
        </div>
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              animation: 'scaleIn 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#FEF2F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                }}
              >
                <AlertCircle style={{ width: 22, height: 22 }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Reset Receipt to Default?
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: '0 0 20px' }}>
              Kya aap sach me <strong>{tenantName}</strong> ki receipt layout ko company ke <strong>Standard Default Template</strong> par reset karna chahte hain? Aap ke banaye gaye custom changes khatam ho jayenge aur yeh branch standard template use karne lagegi.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetting}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  opacity: resetting ? 0.7 : 1,
                }}
              >
                {resetting ? 'Resetting...' : 'Yes, Reset to Default'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
