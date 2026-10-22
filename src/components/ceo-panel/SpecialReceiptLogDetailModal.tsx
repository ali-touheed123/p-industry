'use client';

import React from 'react';
import { X, Printer, Lock, Info, Calendar, User, FileText, ArrowRight } from 'lucide-react';
import { renderReceiptDocument } from '@/utils/receiptRenderCore';
import { normalizeSpecialTemplate } from '@/utils/receiptRenderCore';
import type { RenderReceiptData, RenderReceiptItem } from '@/utils/receiptRenderCore';

export interface SpecialLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: any;
}

export default function SpecialReceiptLogDetailModal({
  isOpen,
  onClose,
  log,
}: SpecialLogDetailModalProps) {
  if (!isOpen || !log) return null;

  const rawSnap = log.receipt_snapshot;
  const snap = typeof rawSnap === 'string' ? JSON.parse(rawSnap) : (rawSnap || {});
  const rawTmpl = log.template_snapshot;
  const parsedTmpl = typeof rawTmpl === 'string' ? JSON.parse(rawTmpl) : rawTmpl;
  const tmpl = normalizeSpecialTemplate(parsedTmpl);
  const items: any[] = snap.items || [];

  const isReturn = log.event_type === 'return';

  // Render receipt HTML for visual reconstruction
  const receiptItems: RenderReceiptItem[] = items.map((it: any) => {
    const qty = Number(it.qty || 1);
    const rate = Number(it.unit_price ?? it.rate ?? 0);
    const lineTotal = Number(it.total_price ?? it.line_total ?? (qty * rate));
    return {
      name: it.receipt_name || it.item_name || '—',
      code: it.item_code || undefined,
      shadeCode: it.receipt_shade || it.shade_code || undefined,
      qty,
      rate,
      total: lineTotal,
    };
  });

  const effectiveTotal = isReturn
    ? Number(log.charged_total || snap.refund_total || 0)
    : Number(log.printed_total || snap.printed_total || 0);

  const rawPaid = snap.paid_amount !== undefined ? Number(snap.paid_amount) : (log.paid_amount !== undefined ? Number(log.paid_amount) : undefined);
  const rawDue = snap.due_amount !== undefined ? Number(snap.due_amount) : (log.due_amount !== undefined ? Number(log.due_amount) : undefined);

  let paidAmount = effectiveTotal;
  let dueAmount = 0;

  if (isReturn) {
    paidAmount = effectiveTotal;
    dueAmount = 0;
  } else if (rawDue !== undefined) {
    if (rawDue > 0) {
      dueAmount = rawDue;
      paidAmount = rawPaid !== undefined ? rawPaid : Math.max(0, effectiveTotal - rawDue);
    } else {
      // Settled in full: zero balance due on paper
      dueAmount = 0;
      paidAmount = effectiveTotal;
    }
  } else if (rawPaid !== undefined) {
    if (rawPaid >= effectiveTotal) {
      paidAmount = effectiveTotal;
      dueAmount = 0;
    } else {
      paidAmount = rawPaid;
      dueAmount = Math.max(0, effectiveTotal - rawPaid);
    }
  }

  const resolvedPaymentType = isReturn
    ? (snap.payment_type ? String(snap.payment_type).toUpperCase() : 'REFUND')
    : (snap.payment_type
        ? String(snap.payment_type).toUpperCase()
        : (log.payment_type
            ? String(log.payment_type).toUpperCase()
            : (dueAmount > 0 ? 'CREDIT' : 'CASH')));

  const resolvedClientName = snap.client_name || log.client_name || undefined;
  const resolvedInvoiceNo = snap.invoice_no || log.invoice_no || '';

  const dateRaw = log.printed_at || log.created_at;
  const dateObj = dateRaw ? new Date(dateRaw) : null;
  const resolvedDate = snap.date || log.date || (dateObj ? dateObj.toLocaleDateString() : undefined);
  const resolvedTime = dateObj ? dateObj.toLocaleTimeString() : undefined;

  const renderData: RenderReceiptData = {
    tenantName: tmpl.template_json.header.customShopName || '',
    tenantAddress: tmpl.template_json.header.customAddress || '',
    tenantPhone: tmpl.template_json.header.customPhone || '',
    invoiceType: isReturn ? 'return' : 'sales',
    invoiceNo: resolvedInvoiceNo,
    date: resolvedDate,
    time: resolvedTime,
    clientName: resolvedClientName,
    paymentMethod: resolvedPaymentType,
    items: receiptItems,
    subTotal: effectiveTotal,
    discount: 0,
    grandTotal: effectiveTotal,
    paidAmount,
    dueAmount,
    deliveryCharge: Number(snap.delivery_charge || log.delivery_charge || 0),
    headerNote: snap.header_note || undefined,
    footerNote: snap.footer_note || undefined,
    isReprint: log.event_type === 'reprint',
  };

  const receiptHtml = renderReceiptDocument(renderData, tmpl.template_json, tmpl.paper_size);

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
          maxWidth: '1000px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38BDF8',
              }}
            >
              <FileText style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                  Special Receipt Audit Inspection
                </h3>
                <span
                  style={{
                    background:
                      log.event_type === 'reprint'
                        ? '#3B82F6'
                        : log.event_type === 'return'
                        ? '#F97316'
                        : '#10B981',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  {log.event_type}
                </span>
                {log.invoice_status === 'cancelled' && (
                  <span
                    style={{
                      background: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Cancelled
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
                Invoice #{log.invoice_no} • Printed By: {log.printed_by} • Recorded: {dateObj ? dateObj.toLocaleString() : '—'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Content Body: 2 Columns */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* Left Column: 3-Way Price Comparison & Audit Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#334155', margin: '0 0 10px', textTransform: 'uppercase' }}>
                {isReturn ? 'Return Line Items Breakdown' : '3-Way Line Item Price Breakdown'}
              </h4>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', background: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                    <tr>
                      <th style={{ padding: '6px 8px' }}>Item (Catalog / Print)</th>
                      <th style={{ padding: '6px 6px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>{isReturn ? 'Refund Rate' : 'Master Price'}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>{isReturn ? 'Original Unit' : 'Printed Rate'}</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>{isReturn ? 'Refund Total' : 'Charged Rate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, i: number) => {
                      const qty = Number(it.qty || 1);
                      const unitPrice = Number(it.unit_price ?? it.rate ?? 0);
                      const masterRate = isReturn ? unitPrice : Number(it.master_price ?? unitPrice);
                      const printedRate = unitPrice;
                      const disc = Number(it.discount || 0);
                      const chargedRate = isReturn
                        ? Number(it.line_total ?? it.total_price ?? (qty * unitPrice))
                        : Math.round((printedRate - disc / qty) * 100) / 100;

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{it.item_name}</div>
                            {it.receipt_name && it.receipt_name !== it.item_name && (
                              <div style={{ fontSize: '10px', color: '#0284C7' }}>
                                Printed as: {it.receipt_name}
                              </div>
                            )}
                            {(it.receipt_shade || it.shade_code) && (
                              <div style={{ fontSize: '10px', color: '#64748B' }}>
                                Shade: {it.receipt_shade || it.shade_code}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>
                            Rs. {masterRate.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#0284C7', fontWeight: 600 }}>
                            Rs. {printedRate.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: isReturn ? '#EA580C' : '#16A34A', fontWeight: 700 }}>
                            Rs. {chargedRate.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            {(() => {
              const calculatedVariance = snap.total_variance !== undefined
                ? Number(snap.total_variance)
                : (isReturn ? 0 : ((Number(log.charged_total || 0) - Number(log.delivery_charge || 0)) - Number(log.master_total || 0)));

              return (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      {isReturn ? 'Return Event Type' : 'Master Catalog Value'}
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      {isReturn ? 'Sales Return' : `Rs. ${Number(log.master_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#0284C7', fontWeight: 700, textTransform: 'uppercase' }}>
                      {isReturn ? 'Total Refund Amount' : 'Printed Paper Total'}
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: isReturn ? '#EA580C' : '#0284C7' }}>
                      Rs. {Number(effectiveTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 700, textTransform: 'uppercase' }}>
                      Actual Charged / Logged Total
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A' }}>
                      Rs. {Number(log.charged_total || snap.refund_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase' }}>
                      Price Variance
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: calculatedVariance >= 0 ? '#16A34A' : '#DC2626' }}>
                      {calculatedVariance >= 0 ? '+' : ''}
                      Rs. {calculatedVariance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11px',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Lock style={{ width: 14, height: 14, flexShrink: 0 }} />
              <span>
                <strong>CEO Read-Only Audit Policy:</strong> Special receipts are permanently locked in immutable audit logs. CEO panel allows full forensic reconstruction; reprinting is strictly disabled.
              </span>
            </div>
          </div>

          {/* Right Column: Visual Thermal Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              Reconstructed Paper Document
            </span>
            <div
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'auto',
                maxHeight: '520px',
              }}
            >
            <iframe
              srcDoc={receiptHtml}
              title="Reconstructed receipt"
              style={{
                width: '100%',
                maxWidth: '340px',
                border: 'none',
                minHeight: '480px',
                background: '#FFFFFF',
                borderRadius: '4px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              sandbox="allow-scripts allow-same-origin"
            />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
}
