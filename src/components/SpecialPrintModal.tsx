'use client';
import { karachiToday } from '@/lib/karachiDate';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Lock,
  AlertTriangle,
  Info,
  DollarSign,
  FileText,
  CreditCard,
  Building,
} from 'lucide-react';
import { printViaIframe } from '@/utils/iframePrint';
import { buildSpecialReceiptHtml } from '@/utils/receiptAdapters';
import { fetchWithTimeout, isNetworkOrTimeoutError } from '@/lib/fetchWithTimeout';
import { enqueueOfflineSale, deductOfflineStock } from '@/lib/offlineQueueStore';
import type { InvoiceLineItem } from '@/components/PosBilling';
import type { Client } from '@/types';

export interface SpecialPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  shiftId?: string;
  cartItems: InvoiceLineItem[];
  selectedClient: Client | null;
  customerName?: string;
  initialDeliveryCharge?: number;
  staffName: string;
  onSuccess: (savedInvoice: any) => void;
}

interface EditableSpecialLine {
  originalIndex: number;
  item_id: string | null;
  item_code: string;
  productName: string;
  brand_id?: string;
  brand?: string;
  unit: string;
  qty: number;
  unit_price: number;
  master_price: number;
  line_discount: number;
  discount_percent: number;
  line_total: number;
  receipt_name: string;
  receipt_shade: string;
  receipt_pack_size: string;
  has_token?: boolean;
  token_value?: number;
  token_action?: 'keep' | 'remove';
}

export default function SpecialPrintModal({
  isOpen,
  onClose,
  tenantId,
  shiftId,
  cartItems,
  selectedClient,
  customerName = 'Walk-in Customer',
  initialDeliveryCharge = 0,
  staffName,
  onSuccess,
}: SpecialPrintModalProps) {
  // Invoice No generated ONCE on mount / modal open and preserved across retries
  const initialInvoiceNo = useMemo(() => {
    return `INV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
  }, [isOpen]);

  const [invoiceNo] = useState<string>(initialInvoiceNo);
  // F2: Stable idempotency key — persists across retries, resets on modal close/success
  const activeSubmitKeyRef = useRef<string | null>(null);
  // F2: Reset idempotency key when modal closes
  useEffect(() => {
    if (!isOpen) {
      activeSubmitKeyRef.current = null;
    }
  }, [isOpen]);

  const [deliveryCharge, setDeliveryCharge] = useState<number>(initialDeliveryCharge);
  const [headerNote, setHeaderNote] = useState<string>('');
  const [footerNote, setFooterNote] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Tender state
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'bank' | 'split' | 'credit'>('cash');
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [cardPaid, setCardPaid] = useState<number>(0);
  const [bankPaid, setBankPaid] = useState<number>(0);
  const [othersPaid, setOthersPaid] = useState<number>(0);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable lines state initialized from cart items
  const [lines, setLines] = useState<EditableSpecialLine[]>([]);

  useEffect(() => {
    if (isOpen) {
      const initialLines: EditableSpecialLine[] = cartItems.map((ci, idx) => {
        const qty = Number(ci.qty) || 1;
        const rate = Number(ci.rate) || 0;
        const masterPrice = Number(ci.item?.retail_price ?? ci.originalRate ?? rate);
        const discPercent = Number(ci.discountPercent) || 0;
        const lineDisc = Math.round(((qty * rate * discPercent) / 100) * 100) / 100;
        const total = Math.max(0, Math.round((qty * rate - lineDisc) * 100) / 100);

        return {
          originalIndex: idx,
          item_id: ci.item?.id || null,
          item_code: ci.code || ci.item?.code || '',
          productName: ci.productName || ci.item?.name || 'Product',
          brand_id: ci.brand_id || ci.item?.brand_id,
          brand: ci.brand || ci.item?.brand,
          unit: ci.unit || 'Can',
          qty,
          unit_price: rate,
          master_price: masterPrice,
          line_discount: lineDisc,
          discount_percent: discPercent,
          line_total: total,
          receipt_name: ci.productName || ci.item?.name || '',
          receipt_shade: ci.shadeCode || '',
          receipt_pack_size: ci.packSize || ci.unit || '',
          has_token: ci.hasToken,
          token_value: ci.tokenValue,
          token_action: ci.tokenAction || 'keep',
        };
      });

      setLines(initialLines);
      setDeliveryCharge(initialDeliveryCharge);
      setErrorMessage(null);
      setSubmitting(false);

      const itemsTotal = initialLines.reduce((acc, l) => acc + l.line_total, 0);
      const initialNet = itemsTotal + initialDeliveryCharge;
      setCashPaid(initialNet);
      setCardPaid(0);
      setBankPaid(0);
      setOthersPaid(0);
      setPaymentType('cash');
    }
  }, [isOpen, cartItems, initialDeliveryCharge]);

  // Handle line discount change
  const handleDiscountChange = (idx: number, rawVal: number, isPercent = false) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const gross = line.qty * line.unit_price;
        let lineDisc = 0;
        let discPct = 0;

        if (isPercent) {
          discPct = Math.min(100, Math.max(0, rawVal));
          lineDisc = Math.round(((gross * discPct) / 100) * 100) / 100;
        } else {
          lineDisc = Math.min(gross, Math.max(0, rawVal));
          discPct = gross > 0 ? Math.round(((lineDisc / gross) * 100) * 100) / 100 : 0;
        }

        const total = Math.max(0, Math.round((gross - lineDisc) * 100) / 100);

        return {
          ...line,
          line_discount: lineDisc,
          discount_percent: discPct,
          line_total: total,
        };
      })
    );
  };

  const handleReceiptFieldChange = (
    idx: number,
    field: 'receipt_name' | 'receipt_shade' | 'receipt_pack_size',
    val: string
  ) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l))
    );
  };

  // 4-Metric Live Totals
  const masterTotal = useMemo(() => {
    return Math.round(lines.reduce((acc, l) => acc + l.qty * l.master_price, 0) * 100) / 100;
  }, [lines]);

  const printedTotal = useMemo(() => {
    // Option A: Paper shows pre-discount rates and derived total
    const preDiscountLines = lines.reduce((acc, l) => acc + l.qty * l.unit_price, 0);
    return Math.round((preDiscountLines + Number(deliveryCharge || 0)) * 100) / 100;
  }, [lines, deliveryCharge]);

  const chargedTotal = useMemo(() => {
    // Actual POS billed amount
    const linesTotal = lines.reduce((acc, l) => acc + l.line_total, 0);
    return Math.round((linesTotal + Number(deliveryCharge || 0)) * 100) / 100;
  }, [lines, deliveryCharge]);

  const totalVariance = useMemo(() => {
    // R4 Formula: (charged_total - delivery_charge) - master_total
    const baseCharged = chargedTotal - Number(deliveryCharge || 0);
    return Math.round((baseCharged - masterTotal) * 100) / 100;
  }, [chargedTotal, deliveryCharge, masterTotal]);

  // Auto-sync cash when total changes if single cash payment
  useEffect(() => {
    if (paymentType === 'cash') {
      setCashPaid(chargedTotal);
    }
  }, [chargedTotal, paymentType]);

  // Payment calculations
  const totalPaid = useMemo(() => {
    if (paymentType === 'cash') return cashPaid;
    if (paymentType === 'card') return cardPaid;
    if (paymentType === 'bank') return bankPaid;
    if (paymentType === 'credit') return 0;
    return (
      Number(cashPaid || 0) +
      Number(cardPaid || 0) +
      Number(bankPaid || 0) +
      Number(othersPaid || 0)
    );
  }, [paymentType, cashPaid, cardPaid, bankPaid, othersPaid]);

  const dueAmount = useMemo(() => {
    const raw = chargedTotal - totalPaid;
    return raw > 0.01 ? Math.round(raw * 100) / 100 : 0;
  }, [chargedTotal, totalPaid]);

  const changeReturned = useMemo(() => {
    const raw = totalPaid - chargedTotal;
    return raw > 0.01 ? Math.round(raw * 100) / 100 : 0;
  }, [chargedTotal, totalPaid]);

  // Execute Submission & Print Pipeline
  const handleSubmitSpecial = async () => {
    if (submitting) return;
    setErrorMessage(null);

    if (lines.length === 0) {
      setErrorMessage('Cannot complete sale with zero items.');
      return;
    }

    if (!selectedClient && dueAmount > 0) {
      setErrorMessage('Cannot sell on credit to a walk-in customer. Collect full payment.');
      return;
    }

    if (selectedClient && dueAmount > 0) {
      const curBal = Number(selectedClient.current_balance) || 0;
      const limit = Number(selectedClient.credit_limit) || 0;
      if (limit > 0 && curBal + dueAmount > limit) {
        setErrorMessage(
          `Credit limit exceeded. Available: Rs. ${(limit - curBal).toLocaleString()}`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      let resolvedPaymentType = paymentType;
      if (dueAmount > 0) {
        resolvedPaymentType = 'credit';
      } else if (
        (cashPaid > 0 ? 1 : 0) +
          (cardPaid > 0 ? 1 : 0) +
          (bankPaid > 0 ? 1 : 0) +
          (othersPaid > 0 ? 1 : 0) >
        1
      ) {
        resolvedPaymentType = 'split';
      }

      let sendCash = 0;
      let sendCard = 0;
      let sendBank = 0;
      let sendOthers = 0;

      const finalPaidAmount = Math.min(totalPaid, chargedTotal);

      if (paymentType === 'cash') {
        sendCash = finalPaidAmount;
      } else if (paymentType === 'card') {
        sendCard = finalPaidAmount;
      } else if (paymentType === 'bank') {
        sendBank = finalPaidAmount;
      } else if (paymentType === 'credit') {
        sendCash = 0;
        sendCard = 0;
        sendBank = 0;
        sendOthers = 0;
      } else if (paymentType === 'split') {
        sendCash = Number(cashPaid || 0);
        sendCard = Number(cardPaid || 0);
        sendBank = Number(bankPaid || 0);
        sendOthers = Number(othersPaid || 0);
      }

      // F2: Reuse key on retry; mint fresh only on first submit
      const keyToUse =
        activeSubmitKeyRef.current ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      if (!activeSubmitKeyRef.current) {
        activeSubmitKeyRef.current = keyToUse;
      }
      const payload = {
        tenant_id: tenantId,
        invoice_no: undefined, // Omit client-generated invoice_no so server allocates sequentially
        idempotency_key: keyToUse,
        client_id: selectedClient?.id || null,
        client_name: selectedClient ? selectedClient.name : customerName,
        shift_id: shiftId || null,
        date: karachiToday(),
        subtotal: chargedTotal - Number(deliveryCharge || 0), // Option A POS Rule: subtotal = charged total
        discount: 0, // Option A Content Rule: strictly 0
        delivery_charge: Number(deliveryCharge || 0),
        remarks: remarks || null,
        net_total: chargedTotal,
        paid_amount: finalPaidAmount,
        due_amount: dueAmount,
        payment_type: resolvedPaymentType,
        cash_paid: sendCash,
        card_paid: sendCard,
        bank_paid: sendBank,
        others_paid: sendOthers,
        items: lines.map((l) => ({
          item_id: l.item_id,
          item_code: l.item_code,
          item_name: l.productName,
          shade_code: l.receipt_shade,
          pack_size: l.receipt_pack_size,
          unit: l.unit,
          qty: l.qty,
          unit_price: l.unit_price,
          pre_discount_rate: l.unit_price,
          discount: l.line_discount,
          discount_percent: l.discount_percent,
          total_price: l.line_total,
          receipt_name: l.receipt_name.trim() || l.productName,
          receipt_shade: l.receipt_shade.trim() || undefined,
          receipt_pack_size: l.receipt_pack_size.trim() || l.unit,
          receipt_notes: undefined,
          has_token: l.has_token,
          token_value: l.token_value,
          token_action: l.token_action,
        })),
        receipt_snapshot: {
          header_note: headerNote.trim() || undefined,
          footer_note: footerNote.trim() || undefined,
          delivery_charge: Number(deliveryCharge || 0),
          payment_type: resolvedPaymentType,
          paid_amount: finalPaidAmount,
          due_amount: dueAmount,
        },
      };

      // Phase 6: Direct offline special checkout helper
      const executeOfflineSpecial = async () => {
        const rateSnapshot: Record<string, number> = {};
        lines.forEach((l) => {
          if (l.item_id) rateSnapshot[l.item_id] = l.unit_price;
        });

        const { localReceiptNo } = await enqueueOfflineSale({
          type: 'special_sale',
          tenantId,
          branchId: null,
          userId: staffName || null,
          payload,
          rateSnapshot,
        });

        deductOfflineStock(tenantId, lines.map((l) => ({ item_id: l.item_id, qty: l.qty })));

        const enrichedSnapshot: any = {
          ...payload,
          invoice_no: localReceiptNo,
          local_receipt_no: localReceiptNo,
          is_offline: true,
          payment_type: resolvedPaymentType,
          paid_amount: finalPaidAmount,
          due_amount: dueAmount,
          client_name: selectedClient ? selectedClient.name : (customerName || 'Walk-in Customer'),
          show_sales_return: true,
        };

        const specialHtml = buildSpecialReceiptHtml(enrichedSnapshot, undefined);
        printViaIframe(specialHtml);

        activeSubmitKeyRef.current = null;
        onSuccess(enrichedSnapshot);
        onClose();
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await executeOfflineSpecial();
        return;
      }

      let res: Response | null = null;
      try {
        res = await fetchWithTimeout('/api/invoices/special', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          timeoutMs: 20000,
        });
      } catch (fetchErr: any) {
        if (isNetworkOrTimeoutError(fetchErr)) {
          console.warn('[SpecialModal] Network down. Enqueueing offline special sale:', fetchErr.message);
          await executeOfflineSpecial();
          return;
        }
        throw fetchErr;
      }

      const resData = await res.json();

      if (res.status === 409) {
        throw new Error(`Cart Conflict: ${resData.error || 'Cart contents changed during checkout attempt.'}`);
      }

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to record special sale.');
      }

      // Single-Transaction Execution: Print strictly from server snapshot
      if (resData.snapshot) {
        const enrichedSnapshot = {
          ...resData.snapshot,
          payment_type: resData.snapshot.payment_type || resolvedPaymentType,
          paid_amount: resData.snapshot.paid_amount ?? finalPaidAmount,
          due_amount: resData.snapshot.due_amount ?? dueAmount,
          client_name: resData.snapshot.client_name || (selectedClient ? selectedClient.name : customerName),
          invoice_no: resData.invoice_no || resData.snapshot?.invoice_no || resData.invoice?.invoice_no,
        };
        const specialHtml = buildSpecialReceiptHtml(
          enrichedSnapshot,
          resData.template
        );
        printViaIframe(specialHtml);
      }

      activeSubmitKeyRef.current = null; // F2: clear key on success
      onSuccess(resData.invoice || { invoice_no: resData.invoice_no || resData.snapshot?.invoice_no });
      onClose();
    } catch (err: any) {
      console.error('Special sale execution error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during special sale checkout.');
      setSubmitting(false);
    }
  };

  // Keyboard shortcut listener for F6 and Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        e.preventDefault();
        handleSubmitSpecial();
      } else if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, lines, chargedTotal, totalPaid, dueAmount]);

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
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1060px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 20px',
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
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38BDF8',
              }}
            >
              <Printer style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                  Special Receipt Pre-Print Studio
                </h2>
                <span
                  style={{
                    background: '#38BDF8',
                    color: '#0F172A',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  Option A Locked
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                Invoice #{invoiceNo} • Cashier: {staffName} • Customer: {customerName}
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

        {/* 4-Metric Live Totals Summary Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            padding: '12px 20px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Master Catalog Total
            </span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
              Rs. {masterTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7', textTransform: 'uppercase' }}>
              Printed Paper Total
            </span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0369A1', marginTop: '2px' }}>
              Rs. {printedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>
              Actual Charged Total
            </span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>
              Rs. {chargedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div
            style={{
              background: totalVariance >= 0 ? '#F0FDF4' : '#FEF2F2',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${totalVariance >= 0 ? '#BBF7D0' : '#FECACA'}`,
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: totalVariance >= 0 ? '#166534' : '#991B1B',
                textTransform: 'uppercase',
              }}
            >
              Price Variance
            </span>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: totalVariance >= 0 ? '#15803D' : '#DC2626',
                marginTop: '2px',
              }}
            >
              {totalVariance >= 0 ? '+' : ''}
              Rs. {totalVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                color: '#DC2626',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Locked Notice */}
          <div
            style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#1E40AF',
            }}
          >
            <Lock style={{ width: 14, height: 14, flexShrink: 0 }} />
            <span>
              <strong>Option A Rule Enforced:</strong> Unit rates and quantities are locked. You can apply line discounts only. Receipt item names and shades can be customized for this printout only without altering the inventory catalog. Zero discount text will be shown on paper.
            </span>
          </div>

          {/* Items Editor Table */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '8px 12px' }}>Item & Catalog Code</th>
                  <th style={{ padding: '8px 10px', width: '22%' }}>Receipt Print Description</th>
                  <th style={{ padding: '8px 10px', width: '14%' }}>Receipt Shade / Pack</th>
                  <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '8px 10px', width: '90px', textAlign: 'right' }}>Locked Rate</th>
                  <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>Line Disc (Rs)</th>
                  <th style={{ padding: '8px 12px', width: '100px', textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{line.productName}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Code: {line.item_code || '—'} {line.brand ? `• ${line.brand}` : ''}
                      </div>
                    </td>

                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="text"
                        value={line.receipt_name}
                        onChange={(e) => handleReceiptFieldChange(idx, 'receipt_name', e.target.value)}
                        placeholder="Printed item title"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      />
                    </td>

                    <td style={{ padding: '6px 10px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          value={line.receipt_shade}
                          onChange={(e) => handleReceiptFieldChange(idx, 'receipt_shade', e.target.value)}
                          placeholder="Shade"
                          style={{
                            width: '50%',
                            padding: '6px 6px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            fontSize: '11px',
                          }}
                        />
                        <input
                          type="text"
                          value={line.receipt_pack_size}
                          onChange={(e) => handleReceiptFieldChange(idx, 'receipt_pack_size', e.target.value)}
                          placeholder="Pack"
                          style={{
                            width: '50%',
                            padding: '6px 6px',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            fontSize: '11px',
                          }}
                        />
                      </div>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: '#F1F5F9',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {line.qty} {line.unit}
                      </span>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#334155' }}>
                        Rs. {line.unit_price.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>Locked</div>
                    </td>

                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <input
                        type="number"
                        min="0"
                        max={line.qty * line.unit_price}
                        step="1"
                        value={line.line_discount || ''}
                        onChange={(e) => handleDiscountChange(idx, parseFloat(e.target.value) || 0, false)}
                        placeholder="0"
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '6px 8px',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#DC2626',
                        }}
                      />
                    </td>

                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
                        Rs. {line.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment & Delivery Split Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Left: Notes & Delivery */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Delivery Charge (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={deliveryCharge || ''}
                    onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Internal Remarks (ERP only)
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional remarks"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Custom Receipt Notes (Prints on Special Paper)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={headerNote}
                    onChange={(e) => setHeaderNote(e.target.value)}
                    placeholder="Header note (e.g. Project Site #4)"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <input
                    type="text"
                    value={footerNote}
                    onChange={(e) => setFooterNote(e.target.value)}
                    placeholder="Footer note (e.g. Delivery confirmed)"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Tender & Payments */}
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Payment Method</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['cash', 'card', 'bank', 'split', 'credit'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentType(m);
                        if (m === 'cash') {
                          setCashPaid(chargedTotal);
                          setCardPaid(0);
                          setBankPaid(0);
                          setOthersPaid(0);
                        } else if (m === 'card') {
                          setCardPaid(chargedTotal);
                          setCashPaid(0);
                          setBankPaid(0);
                          setOthersPaid(0);
                        } else if (m === 'bank') {
                          setBankPaid(chargedTotal);
                          setCashPaid(0);
                          setCardPaid(0);
                          setOthersPaid(0);
                        } else if (m === 'credit') {
                          setCashPaid(0);
                          setCardPaid(0);
                          setBankPaid(0);
                          setOthersPaid(0);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: paymentType === m ? '#0F172A' : '#CBD5E1',
                        background: paymentType === m ? '#0F172A' : '#FFFFFF',
                        color: paymentType === m ? '#FFFFFF' : '#475569',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentType === 'split' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Cash Paid</label>
                    <input
                      type="number"
                      min="0"
                      value={cashPaid || ''}
                      onChange={(e) => setCashPaid(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Card Paid</label>
                    <input
                      type="number"
                      min="0"
                      value={cardPaid || ''}
                      onChange={(e) => setCardPaid(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Bank Paid</label>
                    <input
                      type="number"
                      min="0"
                      value={bankPaid || ''}
                      onChange={(e) => setBankPaid(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Others</label>
                    <input
                      type="number"
                      min="0"
                      value={othersPaid || ''}
                      onChange={(e) => setOthersPaid(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    {paymentType.toUpperCase()} Tender Received:
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={
                      paymentType === 'cash'
                        ? cashPaid || ''
                        : paymentType === 'card'
                        ? cardPaid || ''
                        : paymentType === 'bank'
                        ? bankPaid || ''
                        : 0
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (paymentType === 'cash') setCashPaid(val);
                      if (paymentType === 'card') setCardPaid(val);
                      if (paymentType === 'bank') setBankPaid(val);
                    }}
                    disabled={paymentType === 'credit'}
                    style={{
                      width: '120px',
                      textAlign: 'right',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  />
                </div>
              )}

              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#64748B' }}>Net Charged: <strong>Rs. {chargedTotal.toLocaleString()}</strong></span>
                {changeReturned > 0 && (
                  <span style={{ color: '#16A34A', fontWeight: 700 }}>Change: Rs. {changeReturned.toLocaleString()}</span>
                )}
                {dueAmount > 0 && (
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>Due (Debt): Rs. {dueAmount.toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: '12px 20px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Press <strong>F6</strong> to Confirm & Print • <strong>ESC</strong> to cancel
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
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
              disabled={submitting || lines.length === 0}
              onClick={handleSubmitSpecial}
              className="pos-btn-special"
              style={{
                padding: '10px 22px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <Printer style={{ width: 16, height: 16 }} />
              {submitting ? 'Executing & Printing...' : 'Confirm & Print Special Receipt (F6)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
