'use client';

import React, { useState, useRef, useId } from 'react';
import { Item, Supplier } from '@/types';
import {
  Upload,
  Camera,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  Package,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface Props {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onPurchaseCompleted?: () => void;
  catalogItems?: Item[];
}

interface ScannedLineItem {
  id: string; // client-side temp id
  ai_name: string;
  ai_code: string | null;
  brand: string | null;
  unit: string;
  qty: number;
  unit_price: number;
  total_price: number;
  match_status: 'matched' | 'partial' | 'new';
  matched_item_id: string | null;
  matched_item_name: string;
  matched_item_code: string;
  current_stock?: number;
}

interface ScannedSupplier {
  id: string | null;
  name: string;
  code?: string;
  matched: boolean;
  current_balance?: number;
}

export default function AiInvoiceScan({
  tenantId,
  isOpen,
  onClose,
  onPurchaseCompleted,
  catalogItems = [],
}: Props) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'verify' | 'saving' | 'success'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scanned / Extracted Data
  const [supplier, setSupplier] = useState<ScannedSupplier>({ id: null, name: '', matched: false });
  const [allSuppliers, setAllSuppliers] = useState<Array<{ id: string; code: string; name: string; current_balance: number }>>([]);
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ScannedLineItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'credit' | 'cash'>('credit');

  // Success meta
  const [savedPurchaseNo, setSavedPurchaseNo] = useState<string>('');
  const [savedItemsCount, setSavedItemsCount] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (JPG, PNG, WebP, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size must be under 10MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  // Trigger Gemini AI Scan
  const handleScanInvoice = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select or capture an invoice image first.');
      return;
    }

    setStep('scanning');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('tenant_id', tenantId);
      formData.append('image', selectedFile);

      const res = await fetch('/api/ai-invoice-scan', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to scan invoice with AI');
      }

      // Populate state with extracted data
      setSupplier(data.supplier || { id: null, name: '', matched: false });
      setAllSuppliers(data.all_suppliers || []);
      setInvoiceNo(data.invoice_no || `PINV-${Math.floor(100000 + Math.random() * 900000)}`);
      setInvoiceDate(data.invoice_date || new Date().toISOString().split('T')[0]);
      setDiscount(Number(data.discount) || 0);

      const mappedItems: ScannedLineItem[] = (data.items || []).map((it: any, index: number) => ({
        id: `row-${Date.now()}-${index}`,
        ai_name: it.ai_name || 'Unidentified Item',
        ai_code: it.ai_code || null,
        brand: it.brand || '',
        unit: it.unit || 'Can',
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
        total_price: Number(it.total_price) || 0,
        match_status: it.match_status || 'new',
        matched_item_id: it.matched_item?.id || null,
        matched_item_name: it.matched_item?.name || it.ai_name || '',
        matched_item_code: it.matched_item?.code || it.ai_code || '',
        current_stock: it.matched_item?.stock_qty,
      }));

      setItems(mappedItems);
      setStep('verify');
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorMessage(err.message || 'Error occurred while scanning. Please try again.');
      setStep('upload');
    }
  };

  // Row update handlers
  const handleUpdateItem = (id: string, updates: Partial<ScannedLineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if (updates.qty !== undefined || updates.unit_price !== undefined) {
          updated.total_price = (Number(updated.qty) || 0) * (Number(updated.unit_price) || 0);
        }
        return updated;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddItem = () => {
    const newItem: ScannedLineItem = {
      id: `row-${Date.now()}-${items.length}`,
      ai_name: 'Manual Item',
      ai_code: '',
      brand: '',
      unit: 'Can',
      qty: 1,
      unit_price: 0,
      total_price: 0,
      match_status: 'new',
      matched_item_id: null,
      matched_item_name: '',
      matched_item_code: '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Select catalog item for row
  const handleLinkCatalogItem = (rowId: string, catalogItemId: string) => {
    if (!catalogItemId) {
      handleUpdateItem(rowId, {
        matched_item_id: null,
        matched_item_name: '',
        matched_item_code: '',
        match_status: 'new',
      });
      return;
    }

    const found = catalogItems.find((i) => i.id === catalogItemId);
    if (found) {
      handleUpdateItem(rowId, {
        matched_item_id: found.id,
        matched_item_name: found.name,
        matched_item_code: found.code,
        current_stock: found.stock_qty,
        unit_price: Number(found.cost_price) || 0,
        unit: found.unit || 'Can',
        match_status: 'matched',
      });
    }
  };

  // Computed Totals
  const subtotal = items.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
  const netTotal = Math.max(0, subtotal - (Number(discount) || 0));
  const dueAmount = Math.max(0, netTotal - (Number(paidAmount) || 0));

  // Confirm and Save to Database
  const handleConfirmAndSave = async () => {
    if (items.length === 0) {
      setErrorMessage('Please include at least 1 item in the purchase.');
      return;
    }

    setStep('saving');
    setErrorMessage(null);

    try {
      // Step 1: For any items that are 'new' (not in catalog), create them in the items catalog first
      // so their stock count is tracked in Supabase
      const finalItems = [...items];

      for (let i = 0; i < finalItems.length; i++) {
        const item = finalItems[i];
        if (!item.matched_item_id) {
          const generatedCode = item.ai_code || `P-${Math.floor(10000 + Math.random() * 90000)}`;
          const brandName = item.brand || supplier.name || 'General';

          try {
            const createRes = await fetch('/api/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenant_id: tenantId,
                code: generatedCode,
                name: item.matched_item_name || item.ai_name,
                category: 'General',
                brand: brandName,
                unit: item.unit || 'Can',
                cost_price: Number(item.unit_price) || 0,
                retail_price: Math.round((Number(item.unit_price) || 0) * 1.25), // 25% default markup
                stock_qty: 0, // will be incremented by purchase
                min_stock_alert: 5,
                shade_code: 'Standard',
              }),
            });

            const createData = await createRes.json();
            if (createData.success && createData.item?.id) {
              finalItems[i].matched_item_id = createData.item.id;
              finalItems[i].matched_item_code = createData.item.code;
            }
          } catch (createErr) {
            console.warn('Could not auto-create item in catalog:', createErr);
          }
        }
      }

      // Step 2: Call existing POST /api/purchases
      const purchasePayload = {
        tenant_id: tenantId,
        purchase_no: invoiceNo.trim() || `PINV-${Date.now().toString().slice(-6)}`,
        purchase_type: 'purchase',
        supplier_id: supplier.id || null,
        supplier_name: supplier.name.trim() || 'Direct Supplier',
        date: invoiceDate,
        subtotal: subtotal,
        discount: Number(discount) || 0,
        net_total: netTotal,
        paid_amount: Number(paidAmount) || 0,
        due_amount: dueAmount,
        payment_type: paymentType,
        items: finalItems.map((it) => ({
          itemId: it.matched_item_id || null,
          code: it.matched_item_code || it.ai_code || '',
          productName: it.matched_item_name || it.ai_name,
          unit: it.unit,
          qty: Number(it.qty) || 1,
          rate: Number(it.unit_price) || 0,
        })),
      };

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchasePayload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to save purchase in system.');
      }

      setSavedPurchaseNo(purchasePayload.purchase_no);
      setSavedItemsCount(finalItems.length);
      setStep('success');

      if (onPurchaseCompleted) {
        onPurchaseCompleted();
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.message || 'Error occurred while saving purchase.');
      setStep('verify');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setItems([]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: step === 'verify' ? '1100px' : '650px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          overflow: 'hidden',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
              }}
            >
              <Sparkles style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                AI Invoice Scanner &amp; Inward Stock
              </h2>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>
                Powered by Google Gemini 3.5 Flash Lite — Auto-read physical invoices &amp; update inventory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              margin: '12px 20px 0',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* STEP 1: UPLOAD ZONE */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #CBD5E1',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: previewUrl ? '#F8FAFC' : '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                    setErrorMessage(null);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {previewUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Invoice Preview"
                      style={{
                        maxHeight: '260px',
                        maxWidth: '100%',
                        borderRadius: '8px',
                        objectFit: 'contain',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                      Click or drop another photo to replace
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: '50%',
                        background: '#FFF7ED',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#F97316',
                      }}
                    >
                      <Upload style={{ width: 26, height: 26 }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', margin: '0 0 4px' }}>
                        Drag &amp; drop invoice photo here, or browse
                      </p>
                      <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                        Supports JPG, PNG, WEBP up to 10MB (Handwritten or Printed)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Camera style={{ width: 16, height: 16, color: '#F97316' }} />
                  Take Photo (Mobile / WebCam)
                </button>

                <button
                  type="button"
                  onClick={handleScanInvoice}
                  disabled={!selectedFile}
                  style={{
                    flex: 1.5,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: selectedFile
                      ? 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)'
                      : '#E2E8F0',
                    color: selectedFile ? '#FFFFFF' : '#94A3B8',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: selectedFile ? 'pointer' : 'not-allowed',
                    boxShadow: selectedFile ? '0 4px 12px rgba(249, 115, 22, 0.3)' : 'none',
                  }}
                >
                  <Sparkles style={{ width: 16, height: 16 }} />
                  ⚡ Scan Invoice with Gemini AI
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SCANNING ANIMATION */}
          {step === 'scanning' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 20px',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#FFF7ED',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <Loader2
                  style={{
                    width: 38,
                    height: 38,
                    color: '#F97316',
                    animation: 'spin 1.2s linear infinite',
                  }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px' }}>
                  🤖 AI parchi parh raha hai...
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, maxWidth: '400px' }}>
                  Extracting product names, quantities, packing sizes, rates, and fuzzy matching with your stock inventory...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFICATION TABLE */}
          {step === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Top Meta Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  background: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}
              >
                {/* Supplier Field */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <Building2 style={{ width: 12, height: 12, color: '#F97316' }} />
                    SUPPLIER:
                  </label>
                  <select
                    value={supplier.id || ''}
                    onChange={(e) => {
                      const supId = e.target.value;
                      const found = allSuppliers.find((s) => s.id === supId);
                      if (found) {
                        setSupplier({
                          id: found.id,
                          name: found.name,
                          code: found.code,
                          matched: true,
                          current_balance: found.current_balance,
                        });
                      } else {
                        setSupplier({ id: null, name: supplier.name, matched: false });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#FFFFFF',
                    }}
                  >
                    {supplier.id && !allSuppliers.some((s) => s.id === supplier.id) && (
                      <option value={supplier.id}>{supplier.name} (AI Suggestion)</option>
                    )}
                    <option value="">{supplier.name ? `AI: ${supplier.name} (Unlinked)` : '-- Select Supplier --'}</option>
                    {allSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || 'SUP'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice No */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <FileText style={{ width: 12, height: 12, color: '#F97316' }} />
                    INVOICE #:
                  </label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'JetBrains Mono, monospace',
                      background: '#FFFFFF',
                    }}
                  />
                </div>

                {/* Date */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <Calendar style={{ width: 12, height: 12, color: '#F97316' }} />
                    DATE:
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      background: '#FFFFFF',
                    }}
                  />
                </div>

                {/* Payment Type */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <DollarSign style={{ width: 12, height: 12, color: '#F97316' }} />
                    PAYMENT TERMS:
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as 'credit' | 'cash')}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#FFFFFF',
                    }}
                  >
                    <option value="credit">Credit (Udhaar / Payable)</option>
                    <option value="cash">Cash (Paid Now)</option>
                  </select>
                </div>
              </div>

              {/* Status Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: '#64748B' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }}></span>
                  <strong>Matched:</strong> Found in system
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#CA8A04' }}></span>
                  <strong>Partial:</strong> Suggested match (verify)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E11D48' }}></span>
                  <strong>New:</strong> Auto-creates product in catalog on confirm
                </span>
              </div>

              {/* Line Items Table */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#FFFFFF',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '8px 10px', width: '90px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }}>Product Details (AI Read / Catalog Item)</th>
                      <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 10px', width: '90px' }}>Unit</th>
                      <th style={{ padding: '8px 10px', width: '110px', textAlign: 'right' }}>Rate (Rs.)</th>
                      <th style={{ padding: '8px 10px', width: '110px', textAlign: 'right' }}>Total (Rs.)</th>
                      <th style={{ padding: '8px 10px', width: '45px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const rowBg =
                        it.match_status === 'matched'
                          ? '#F0FDF4'
                          : it.match_status === 'partial'
                          ? '#FEFCE8'
                          : '#FFF1F2';

                      const borderTint =
                        it.match_status === 'matched'
                          ? '#BBF7D0'
                          : it.match_status === 'partial'
                          ? '#FEF08A'
                          : '#FECDD3';

                      return (
                        <tr
                          key={it.id}
                          style={{
                            background: rowBg,
                            borderBottom: `1px solid ${borderTint}`,
                          }}
                        >
                          {/* Status */}
                          <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                            {it.match_status === 'matched' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}
                              >
                                <CheckCircle2 style={{ width: 10, height: 10 }} />
                                Matched
                              </span>
                            )}
                            {it.match_status === 'partial' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#FEF9C3',
                                  color: '#854D0E',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}
                              >
                                <AlertTriangle style={{ width: 10, height: 10 }} />
                                Partial
                              </span>
                            )}
                            {it.match_status === 'new' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#FFE4E6',
                                  color: '#9F1239',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}
                              >
                                <Plus style={{ width: 10, height: 10 }} />
                                New SKU
                              </span>
                            )}
                          </td>

                          {/* Product Details & Catalog Mapping */}
                          <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <input
                                type="text"
                                value={it.matched_item_name || it.ai_name}
                                onChange={(e) =>
                                  handleUpdateItem(it.id, {
                                    matched_item_name: e.target.value,
                                    ai_name: e.target.value,
                                  })
                                }
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #CBD5E1',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#0F172A',
                                  background: '#FFFFFF',
                                }}
                                title="Editable product name"
                              />

                              {/* Catalog link dropdown */}
                              {catalogItems.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '10px', color: '#64748B' }}>Link to SKU:</span>
                                  <select
                                    value={it.matched_item_id || ''}
                                    onChange={(e) => handleLinkCatalogItem(it.id, e.target.value)}
                                    style={{
                                      fontSize: '10.5px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #CBD5E1',
                                      background: '#FFFFFF',
                                      color: '#334155',
                                      maxWidth: '260px',
                                    }}
                                  >
                                    <option value="">-- Create as New Catalog Product --</option>
                                    {catalogItems.map((cat) => (
                                      <option key={cat.id} value={cat.id}>
                                        {cat.name} ({cat.code}) - In Stock: {cat.stock_qty}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })
                              }
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                fontSize: '12px',
                                textAlign: 'center',
                                fontWeight: 700,
                                background: '#FFFFFF',
                              }}
                            />
                          </td>

                          {/* Unit */}
                          <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                            <select
                              value={it.unit}
                              onChange={(e) => handleUpdateItem(it.id, { unit: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                fontSize: '11px',
                                background: '#FFFFFF',
                              }}
                            >
                              <option value="Can">Can</option>
                              <option value="Drum">Drum</option>
                              <option value="Gallon">Gallon</option>
                              <option value="Quarter">Quarter</option>
                              <option value="Kg">Kg</option>
                              <option value="Litre">Litre</option>
                              <option value="Bag">Bag</option>
                              <option value="Box">Box</option>
                              <option value="PCS">PCS</option>
                            </select>
                          </td>

                          {/* Rate (Cost Price) */}
                          <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              min="0"
                              value={it.unit_price}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })
                              }
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                fontSize: '12px',
                                textAlign: 'right',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontWeight: 600,
                                background: '#FFFFFF',
                              }}
                            />
                          </td>

                          {/* Total */}
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 700,
                              color: '#0F172A',
                              verticalAlign: 'middle',
                            }}
                          >
                            Rs. {(Number(it.total_price) || 0).toLocaleString()}
                          </td>

                          {/* Delete Action */}
                          <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(it.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94A3B8',
                                padding: '4px',
                              }}
                              title="Remove item"
                            >
                              <Trash2 style={{ width: 14, height: 14 }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add row manually */}
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    background: 'transparent',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#F97316',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} />
                  Add Another Line Item
                </button>
              </div>

              {/* Bottom Totals Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  background: '#F8FAFC',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      Rs. {subtotal.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748B' }}>
                    <span>Discount (Rs.):</span>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      style={{
                        width: '90px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E1',
                        textAlign: 'right',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '12px',
                        background: '#FFFFFF',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#0F172A',
                      borderTop: '1px solid #E2E8F0',
                      paddingTop: '6px',
                    }}
                  >
                    <span>Net Total:</span>
                    <span style={{ color: '#F97316', fontFamily: 'JetBrains Mono, monospace' }}>
                      Rs. {netTotal.toLocaleString()}
                    </span>
                  </div>

                  {paymentType === 'cash' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#16A34A', fontSize: '12px', fontWeight: 600 }}>
                      <span>Paid Amount:</span>
                      <input
                        type="number"
                        min="0"
                        value={paidAmount || netTotal}
                        onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                        style={{
                          width: '90px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #CBD5E1',
                          textAlign: 'right',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '12px',
                          background: '#FFFFFF',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', fontSize: '12px', fontWeight: 600 }}>
                      <span>Payable Debt:</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        Rs. {dueAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SAVING PROGRESS */}
          {step === 'saving' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 20px',
                textAlign: 'center',
                gap: '14px',
              }}
            >
              <Loader2
                style={{
                  width: 40,
                  height: 40,
                  color: '#F97316',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Updating Inventory &amp; Saving Purchase...
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                Incrementing warehouse stock counts and updating supplier ledger in Supabase.
              </p>
            </div>
          )}

          {/* STEP 5: SUCCESS CONFIRMATION */}
          {step === 'success' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px 20px',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16A34A',
                }}
              >
                <CheckCircle2 style={{ width: 34, height: 34 }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
                  Purchase Saved Successfully!
                </h3>
                <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px' }}>
                  Purchase Invoice <strong>#{savedPurchaseNo}</strong> has been logged.
                </p>
                <div
                  style={{
                    background: '#F8FAFC',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    color: '#334155',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Package style={{ width: 16, height: 16, color: '#F97316' }} />
                  <strong>{savedItemsCount} item(s)</strong> stock automatically adjusted in inventory.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
          }}
        >
          {step === 'verify' && (
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Re-scan Another Invoice
            </button>
          )}

          {step === 'upload' && <div></div>}

          {step === 'verify' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSave}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                }}
              >
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                Confirm &amp; Save Purchase (GRN)
              </button>
            </div>
          )}

          {step === 'success' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  handleReset();
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close &amp; View Inventory
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
