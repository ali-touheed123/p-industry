'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Client, Brand, BrandSeries, SeriesTokenConfig } from '@/types';
import {
  Ticket,
  Search,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Printer,
  X,
  Coins,
  ArrowRight,
  Receipt,
  FileText,
  Plus,
  Trash2,
  Layers,
  Building2,
  Tag,
  DollarSign,
} from 'lucide-react';

interface RedemptionLine {
  id: string;
  brandId: string;
  brandName: string;
  seriesId: string;
  seriesName: string;
  unitName: string;
  tokenValue: number;
  quantity: number;
  lineTotal: number;
}

interface CompletedRedemption {
  id: string;
  redemptionNo: string;
  clientName: string;
  totalTokens: number;
  totalAmount: number;
  date: string;
  notes?: string;
  shiftId?: string;
  items: Array<{
    brandName: string;
    seriesName: string;
    unitName: string;
    tokenValue: number;
    quantity: number;
    lineTotal: number;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
  tenantName?: string;
  shiftId?: string;
  staffName?: string;
  clients?: Client[];
  items?: any[];
  onRedeemed?: () => void;
}

export default function TokenRedemption({
  isOpen,
  onClose,
  tenantId,
  tenantName = 'Paint Shop',
  shiftId,
  staffName = 'Cashier',
  clients = [],
  items,
  onRedeemed,
}: Props) {
  // ── Customer Selection State ─────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<'registered' | 'walkin'>('registered');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [walkinName, setWalkinName] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);

  // ── Brand / Series / Unit Hierarchy State ────────────────────────────────
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState<boolean>(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  const [seriesList, setSeriesList] = useState<BrandSeries[]>([]);
  const [loadingSeries, setLoadingSeries] = useState<boolean>(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');

  const [selectedUnitName, setSelectedUnitName] = useState<string>('');
  const [lineQuantity, setLineQuantity] = useState<number>(1);

  // ── Redemption Lines Table ───────────────────────────────────────────────
  const [lines, setLines] = useState<RedemptionLine[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Success State ────────────────────────────────────────────────────────
  const [completedRedemption, setCompletedRedemption] = useState<CompletedRedemption | null>(null);

  // ── Customer Resolution ──────────────────────────────────────────────────
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 15);
    const q = clientSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [clients, clientSearch]);

  // ── Fetch Brands on open ─────────────────────────────────────────────────
  const fetchBrands = useCallback(async () => {
    if (!tenantId) return;
    setLoadingBrands(true);
    try {
      const res = await fetch(`/api/brands?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        const active = (data.brands || []).filter((b: Brand) => b.status === 'active');
        setBrands(active);
        if (active.length > 0 && !selectedBrandId) {
          setSelectedBrandId(active[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch brands for token redemption:', err);
    } finally {
      setLoadingBrands(false);
    }
  }, [tenantId, selectedBrandId]);

  useEffect(() => {
    if (isOpen) {
      fetchBrands();
    }
  }, [isOpen, fetchBrands]);

  // ── Fetch Series when selected Brand changes ─────────────────────────────
  const fetchSeries = useCallback(async (brandId: string) => {
    if (!tenantId || !brandId) {
      setSeriesList([]);
      setSelectedSeriesId('');
      setSelectedUnitName('');
      return;
    }
    setLoadingSeries(true);
    try {
      const res = await fetch(`/api/brand-series?tenant_id=${tenantId}&brand_id=${brandId}`);
      const data = await res.json();
      if (data.success) {
        const active = (data.series || []).filter((s: BrandSeries) => s.status === 'active');
        setSeriesList(active);
        if (active.length > 0) {
          setSelectedSeriesId(active[0].id);
        } else {
          setSelectedSeriesId('');
          setSelectedUnitName('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch series for brand:', err);
    } finally {
      setLoadingSeries(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedBrandId) {
      fetchSeries(selectedBrandId);
    }
  }, [selectedBrandId, fetchSeries]);

  // ── Selected Series & Available Enabled Units ─────────────────────────────
  const currentSeries = useMemo(() => {
    return seriesList.find((s) => s.id === selectedSeriesId) || null;
  }, [seriesList, selectedSeriesId]);

  const availableUnits = useMemo(() => {
    if (!currentSeries || !currentSeries.series_token_configs) return [];
    return currentSeries.series_token_configs.filter(
      (c: SeriesTokenConfig) => Boolean(c.is_enabled) && Number(c.token_value) > 0
    );
  }, [currentSeries]);

  // Auto-select first available configured unit when series changes
  useEffect(() => {
    if (availableUnits.length > 0) {
      const existing = availableUnits.find((u) => u.unit_name === selectedUnitName);
      if (!existing) {
        setSelectedUnitName(availableUnits[0].unit_name);
      }
    } else {
      setSelectedUnitName('');
    }
  }, [availableUnits, selectedUnitName]);

  // Read-only Token Value for current selection
  const currentConfig = useMemo(() => {
    return availableUnits.find((u) => u.unit_name === selectedUnitName) || null;
  }, [availableUnits, selectedUnitName]);

  const currentTokenValue = currentConfig ? Number(currentConfig.token_value) : 0;
  const currentLineTotal = currentTokenValue * Math.max(1, lineQuantity);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalTokens = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const totalAmount = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);

  // ── Add Line to Redemption ───────────────────────────────────────────────
  const handleAddLine = () => {
    setErrorMsg(null);
    if (!selectedBrandId || !selectedSeriesId || !selectedUnitName || currentTokenValue <= 0) {
      setErrorMsg('Please select a valid Brand, Series, and configured Unit.');
      return;
    }
    const qty = Math.floor(Number(lineQuantity) || 0);
    if (qty <= 0) {
      setErrorMsg('Quantity must be at least 1.');
      return;
    }

    const currentBrand = brands.find((b) => b.id === selectedBrandId);
    if (!currentBrand || !currentSeries || !currentConfig) return;

    // Check if matching Brand + Series + Unit already exists in lines
    const existingIdx = lines.findIndex(
      (l) => l.brandId === currentBrand.id && l.seriesId === currentSeries.id && l.unitName === currentConfig.unit_name
    );

    if (existingIdx >= 0) {
      // Increment existing line's quantity
      const updated = [...lines];
      const ex = updated[existingIdx];
      const newQty = ex.quantity + qty;
      updated[existingIdx] = {
        ...ex,
        quantity: newQty,
        lineTotal: ex.tokenValue * newQty,
      };
      setLines(updated);
    } else {
      // Add new line
      const newLine: RedemptionLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        brandId: currentBrand.id,
        brandName: currentBrand.name,
        seriesId: currentSeries.id,
        seriesName: currentSeries.name,
        unitName: currentConfig.unit_name,
        tokenValue: currentTokenValue,
        quantity: qty,
        lineTotal: currentTokenValue * qty,
      };
      setLines((prev) => [...prev, newLine]);
    }

    // Reset line quantity to 1 for quick next add
    setLineQuantity(1);
  };

  const handleUpdateLineQuantity = (lineId: string, newQty: number) => {
    const qty = Math.floor(newQty);
    if (qty <= 0) {
      handleRemoveLine(lineId);
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, quantity: qty, lineTotal: l.tokenValue * qty } : l))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // ── Submit Atomic Redemption ─────────────────────────────────────────────
  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!tenantId) {
      setErrorMsg('Tenant ID is required.');
      return;
    }
    if (lines.length === 0) {
      setErrorMsg('Please add at least one token redemption line.');
      return;
    }
    if (totalAmount <= 0) {
      setErrorMsg('Total payout amount must be greater than zero.');
      return;
    }
    if (customerMode === 'registered' && !selectedClientId) {
      setErrorMsg('Please select a registered customer/contractor, or switch to Walk-in Customer.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tenant_id: tenantId,
        client_id: customerMode === 'registered' ? selectedClientId : null,
        client_name:
          customerMode === 'registered'
            ? selectedClient?.name || 'Registered Customer'
            : walkinName.trim() || 'Walk-in Customer',
        shift_id: shiftId || null,
        created_by: staffName,
        notes: notes.trim() || null,
        payout_method: 'cash',
        lines: lines.map((l) => ({
          brand_id: l.brandId,
          brand_name: l.brandName,
          series_id: l.seriesId,
          series_name: l.seriesName,
          unit_name: l.unitName,
          quantity: l.quantity,
        })),
      };

      const res = await fetch('/api/token-redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process token redemption');
      }

      // Success
      setCompletedRedemption({
        id: data.redemption?.id || data.redemption_id,
        redemptionNo: data.redemption_no || data.redemption?.redemption_no || 'RDM-CONFIRMED',
        clientName: payload.client_name,
        totalTokens: data.total_tokens || totalTokens,
        totalAmount: data.total_amount || totalAmount,
        date: new Date().toLocaleString('en-PK', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        notes: payload.notes || undefined,
        shiftId: shiftId || undefined,
        items: lines.map((l) => ({
          brandName: l.brandName,
          seriesName: l.seriesName,
          unitName: l.unitName,
          tokenValue: l.tokenValue,
          quantity: l.quantity,
          lineTotal: l.lineTotal,
        })),
      });

      if (onRedeemed) {
        onRedeemed();
      }
    } catch (err: any) {
      console.error('Token redemption error:', err);
      setErrorMsg(err.message || 'Error executing atomic token redemption');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Thermal Slip Printing ─────────────────────────────────────────────────
  const handlePrintSlip = () => {
    if (!completedRedemption) return;
    const slipEl = document.getElementById('token-redemption-slip');
    if (!slipEl) return;

    const printWin = window.open('', '_blank', 'width=380,height=600');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redemption Voucher - ${completedRedemption.redemptionNo}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 4px;
              color: #000;
              font-size: 11px;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px solid #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; }
            th, td { padding: 2px 0; font-size: 10px; }
            .total-row { font-size: 13px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 15px;">${tenantName}</div>
          <div class="center">TOKEN CASHOUT VOUCHER</div>
          <div class="center" style="font-size: 9px;">Cash Paid From Drawer</div>
          <div class="divider"></div>
          <div>Voucher #: ${completedRedemption.redemptionNo}</div>
          <div>Date: ${completedRedemption.date}</div>
          <div>Customer: ${completedRedemption.clientName}</div>
          <div>Cashier: ${staffName}</div>
          ${completedRedemption.shiftId ? `<div>Shift ID: #${completedRedemption.shiftId.slice(0, 8)}</div>` : ''}
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item / Unit</th>
                <th class="right">Qty</th>
                <th class="right">Val</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${completedRedemption.items
                .map(
                  (it) => `
                <tr>
                  <td>${it.brandName} ${it.seriesName}<br/><span style="font-size:9px;color:#333;">(${it.unitName})</span></td>
                  <td class="right">${it.quantity}</td>
                  <td class="right">${it.tokenValue}</td>
                  <td class="right">${it.lineTotal.toLocaleString()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <table>
            <tr>
              <td>Total Tokens Redeemed:</td>
              <td class="right bold">${completedRedemption.totalTokens} Tokens</td>
            </tr>
            <tr class="total-row">
              <td>CASH PAID OUT:</td>
              <td class="right">Rs. ${completedRedemption.totalAmount.toLocaleString()}</td>
            </tr>
          </table>
          <div class="double-divider"></div>
          <div class="center" style="font-size: 9px;">Physical Tokens Deposited Into Safe</div>
          <div class="center" style="font-size: 9px; margin-top: 4px;">Powered by Pyntflow ERP</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const resetForm = () => {
    setLines([]);
    setNotes('');
    setLineQuantity(1);
    setSelectedClientId('');
    setWalkinName('');
    setClientSearch('');
    setErrorMsg(null);
    setCompletedRedemption(null);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(217, 119, 6, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B',
              }}
            >
              <Coins style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>
                  Multi-Line Token Redemption
                </h3>
                <span
                  style={{
                    background: '#10B981',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  CASH ONLY
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace' }}>
                Brand → Series → Unit → Quantity · Authoritative Payout From Drawer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: submitting ? 'not-allowed' : 'pointer',
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

        {completedRedemption ? (
          /* ── SUCCESS RECEIPT / VOUCHER VIEW ── */
          <div style={{ padding: '24px', overflowY: 'auto', background: '#F8FAFC' }}>
            <div
              style={{
                textAlign: 'center',
                marginBottom: '16px',
                padding: '16px',
                background: '#ECFDF5',
                borderRadius: '12px',
                border: '1px solid #A7F3D0',
              }}
            >
              <CheckCircle2 style={{ width: 36, height: 36, color: '#059669', margin: '0 auto 8px' }} />
              <h4 style={{ margin: 0, color: '#065F46', fontWeight: 800, fontSize: '16px' }}>
                Token Cash Payout Complete!
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#047857', fontWeight: 600 }}>
                Rs. {completedRedemption.totalAmount.toLocaleString()} paid in cash from active drawer
              </p>
            </div>

            {/* Thermal Slip */}
            <div
              id="token-redemption-slip"
              style={{
                background: '#FFFFFF',
                border: '1px dashed #CBD5E1',
                borderRadius: '12px',
                padding: '20px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11.5px',
                color: '#0F172A',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                maxWidth: '460px',
                margin: '0 auto 20px',
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #E2E8F0', paddingBottom: '10px' }}>
                <p style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>{tenantName}</p>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0' }}>
                  CUSTOMER TOKEN CASHOUT VOUCHER
                </p>
                <p style={{ fontSize: '10px', color: '#94A3B8', margin: '2px 0 0' }}>
                  {completedRedemption.date}
                </p>
              </div>

              <div style={{ padding: '12px 0', borderBottom: '1px dashed #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Voucher #:</span>
                  <span style={{ fontWeight: 700 }}>{completedRedemption.redemptionNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Beneficiary:</span>
                  <span style={{ fontWeight: 700 }}>{completedRedemption.clientName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Cashier:</span>
                  <span>{staffName}</span>
                </div>
                {completedRedemption.shiftId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Shift Linked:</span>
                    <span>#{completedRedemption.shiftId.slice(0, 8)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Payout Mode:</span>
                  <span style={{ fontWeight: 800, color: '#059669' }}>CASH (DRAWER)</span>
                </div>
              </div>

              <div style={{ padding: '10px 0', borderBottom: '1px dashed #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ color: '#64748B', borderBottom: '1px dotted #CBD5E1' }}>
                      <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Token Line</th>
                      <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Qty</th>
                      <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Val</th>
                      <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedRedemption.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dotted #F1F5F9' }}>
                        <td style={{ padding: '4px 0' }}>
                          <span style={{ fontWeight: 700 }}>{it.brandName}</span> {it.seriesName}
                          <div style={{ fontSize: '9.5px', color: '#64748B' }}>Unit: {it.unitName}</div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{it.tokenValue}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>
                          Rs. {it.lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Total Tokens:</span>
                  <span style={{ fontWeight: 700 }}>{completedRedemption.totalTokens} Tokens</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#059669',
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '2px solid #0F172A',
                  }}
                >
                  <span>CASH DISBURSED:</span>
                  <span>Rs. {completedRedemption.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', maxWidth: '460px', margin: '0 auto' }}>
              <button
                type="button"
                onClick={handlePrintSlip}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Printer style={{ width: 16, height: 16 }} />
                Print Voucher Slip
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#E2E8F0',
                  color: '#334155',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close & Return
              </button>
            </div>
          </div>
        ) : (
          /* ── REDEMPTION BUILDER FORM ── */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Error Message */}
              {errorMsg && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '8px',
                    color: '#991B1B',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Customer Mode Selector */}
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    1. Customer / Beneficiary
                  </span>
                  <div style={{ display: 'flex', background: '#E2E8F0', padding: '2px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('registered')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: customerMode === 'registered' ? '#FFFFFF' : 'transparent',
                        color: customerMode === 'registered' ? '#0F172A' : '#64748B',
                        boxShadow: customerMode === 'registered' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      Registered Contractor / Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('walkin')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        background: customerMode === 'walkin' ? '#FFFFFF' : 'transparent',
                        color: customerMode === 'walkin' ? '#0F172A' : '#64748B',
                        boxShadow: customerMode === 'walkin' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      Walk-in Customer
                    </button>
                  </div>
                </div>

                {customerMode === 'registered' ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 14,
                            height: 14,
                            color: '#94A3B8',
                          }}
                        />
                        <input
                          type="text"
                          value={clientSearch}
                          onFocus={() => setShowClientDropdown(true)}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setShowClientDropdown(true);
                          }}
                          placeholder={selectedClient ? selectedClient.name : 'Search contractor by name or phone...'}
                          style={{
                            width: '100%',
                            padding: '7px 10px 7px 32px',
                            fontSize: '12px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            outline: 'none',
                          }}
                        />
                      </div>
                      {selectedClient && (
                        <div
                          style={{
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            color: '#1D4ED8',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <User style={{ width: 14, height: 14 }} />
                          <span>{selectedClient.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClientId('');
                              setClientSearch('');
                            }}
                            style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', padding: 0 }}
                          >
                            <X style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      )}
                    </div>

                    {showClientDropdown && !selectedClientId && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                          marginTop: '4px',
                          maxHeight: '160px',
                          overflowY: 'auto',
                        }}
                      >
                        {filteredClients.length === 0 ? (
                          <div style={{ padding: '8px 12px', fontSize: '11px', color: '#94A3B8' }}>No customers found</div>
                        ) : (
                          filteredClients.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedClientId(c.id);
                                setClientSearch(c.name);
                                setShowClientDropdown(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                fontSize: '12px',
                                borderBottom: '1px solid #F1F5F9',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                            >
                              <span style={{ fontWeight: 600, color: '#0F172A' }}>{c.name}</span>
                              <span style={{ color: '#64748B', fontSize: '11px' }}>{c.phone || c.city || 'Contractor'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      placeholder="Walk-in Customer Name (Defaults to 'Walk-in Customer')"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        fontSize: '12px',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 2. Token Selector Row: Brand → Series → Unit → Quantity */}
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  padding: '14px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    2. Select Paint Token to Redeem
                  </span>
                  <span style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                    Token value automatically loaded &amp; immutable
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  {/* Brand */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350F', marginBottom: '4px' }}>
                      Brand
                    </label>
                    <select
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      disabled={loadingBrands}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        color: '#0F172A',
                      }}
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Series */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350F', marginBottom: '4px' }}>
                      Series
                    </label>
                    <select
                      value={selectedSeriesId}
                      onChange={(e) => setSelectedSeriesId(e.target.value)}
                      disabled={loadingSeries || seriesList.length === 0}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        color: '#0F172A',
                      }}
                    >
                      {seriesList.length === 0 ? (
                        <option value="">No series available</option>
                      ) : (
                        seriesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Unit */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350F', marginBottom: '4px' }}>
                      Pack Unit
                    </label>
                    <select
                      value={selectedUnitName}
                      onChange={(e) => setSelectedUnitName(e.target.value)}
                      disabled={availableUnits.length === 0}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        color: '#0F172A',
                      }}
                    >
                      {availableUnits.length === 0 ? (
                        <option value="">No configured unit</option>
                      ) : (
                        availableUnits.map((u) => (
                          <option key={u.id || u.unit_name} value={u.unit_name}>
                            {u.unit_name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Token Value (READ ONLY) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350F', marginBottom: '4px' }}>
                      Token Value (Configured)
                    </label>
                    <div
                      style={{
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                        background: '#FEF3C7',
                        border: '1px solid #FDE68A',
                        borderRadius: '8px',
                        color: '#92400E',
                        height: '37px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {currentTokenValue > 0 ? `Rs. ${currentTokenValue.toLocaleString()}` : '—'}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78350F', marginBottom: '4px' }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={lineQuantity}
                      onChange={(e) => setLineQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        color: '#0F172A',
                        height: '37px',
                      }}
                    />
                  </div>
                </div>

                {/* Line Total & Add Line Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#92400E' }}>
                    Line Total:{' '}
                    <span style={{ fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#B45309' }}>
                      Rs. {currentLineTotal.toLocaleString()}
                    </span>{' '}
                    <span style={{ fontSize: '11px', color: '#78350F' }}>
                      ({lineQuantity} × Rs. {currentTokenValue})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={currentTokenValue <= 0 || availableUnits.length === 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      background: currentTokenValue > 0 ? '#D97706' : '#CBD5E1',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: currentTokenValue > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: currentTokenValue > 0 ? '0 2px 4px rgba(217, 119, 6, 0.2)' : 'none',
                    }}
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                    Add Token Line
                  </button>
                </div>
              </div>

              {/* 3. Multi-Line Redemption Items Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    3. Redemption Lines ({lines.length})
                  </span>
                  {lines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLines([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#EF4444',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {lines.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                    No token lines added yet. Select a Brand, Series, and Unit above and click &quot;Add Token Line&quot;.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Brand</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Series</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Unit</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Token Value</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Line Total</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px', color: '#64748B', fontWeight: 700 }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>{l.brandName}</td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{l.seriesName}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                background: '#E2E8F0',
                                color: '#1E293B',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              {l.unitName}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 600,
                            }}
                          >
                            Rs. {l.tokenValue.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateLineQuantity(l.id, l.quantity - 1)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                }}
                              >
                                -
                              </button>
                              <span
                                style={{
                                  width: '32px',
                                  textAlign: 'center',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontWeight: 800,
                                }}
                              >
                                {l.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateLineQuantity(l.id, l.quantity + 1)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 800,
                              color: '#059669',
                            }}
                          >
                            Rs. {l.lineTotal.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(l.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94A3B8',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                            >
                              <Trash2 style={{ width: 15, height: 15 }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Optional Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reference / notes (e.g. 3x Gallons + 1x Drum returned by painter)"
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    fontSize: '12px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Sticky Footer Payout Summary */}
            <div
              style={{
                marginTop: 'auto',
                padding: '16px 20px',
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Tokens</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: '#0F172A' }}>
                    {totalTokens}{' '}
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Tokens</span>
                  </div>
                </div>

                <div style={{ height: '36px', width: '1px', background: '#CBD5E1' }} />

                <div>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 700 }}>Total Cash Payout</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#059669' }}>
                    Rs. {totalAmount.toLocaleString()}
                  </div>
                </div>

                {shiftId ? (
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#ECFDF5',
                      color: '#065F46',
                      border: '1px solid #A7F3D0',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    Active Shift Linked
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#FEF3C7',
                      color: '#92400E',
                      border: '1px solid #FDE68A',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    No Active Shift
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || lines.length === 0 || totalAmount <= 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: lines.length > 0 && totalAmount > 0 ? '#059669' : '#94A3B8',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: lines.length > 0 && totalAmount > 0 && !submitting ? 'pointer' : 'not-allowed',
                    boxShadow: lines.length > 0 && totalAmount > 0 ? '0 2px 4px rgba(5, 150, 105, 0.25)' : 'none',
                  }}
                >
                  <Coins style={{ width: 16, height: 16 }} />
                  {submitting ? 'Processing Payout...' : `Confirm Cash Payout (Rs. ${totalAmount.toLocaleString()})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
