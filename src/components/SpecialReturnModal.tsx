'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, RotateCcw, Lock, AlertTriangle, CheckCircle2, DollarSign, CreditCard } from 'lucide-react';
import { Invoice, InvoiceItem } from '@/types';

export interface SpecialReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  tenantId: string;
  onSuccess: () => void;
}

interface ReturnableItemState {
  original_item_id: string;
  item_id: string | null;
  item_name: string;
  shade_code?: string;
  pack_size?: string;
  unit_price: number;
  original_qty: number;
  original_total_price: number;
  already_returned_qty: number;
  already_refunded_amount: number;
  returnable_qty: number;
  return_qty: number;
  line_refund: number;
}

export default function SpecialReturnModal({
  isOpen,
  onClose,
  invoice,
  tenantId,
  onSuccess,
}: SpecialReturnModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ReturnableItemState[]>([]);
  const [clientBalance, setClientBalance] = useState<number>(0);

  // Refund tender
  const [refundMode, setRefundMode] = useState<'cash' | 'card' | 'mixed'>('cash');
  const [cashRefund, setCashRefund] = useState<number>(0);
  const [cardRefund, setCardRefund] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !invoice?.id) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    const loadData = async () => {
      try {
        // 1. Fetch original invoice with items
        const invRes = await fetch(`/api/invoices?tenant_id=${tenantId}&id=${invoice.id}&include_items=true`);
        const invData = await invRes.json();
        const fullInv = invData.invoices?.[0] || invoice;
        const origItems: InvoiceItem[] = fullInv.invoice_items || fullInv.items || [];

        // 2. Fetch prior non-cancelled returns for this invoice
        const retRes = await fetch(`/api/invoices?tenant_id=${tenantId}&type=return&include_items=true&limit=100`);
        const retData = await retRes.json();
        const allReturns: any[] = (retData.invoices || []).filter(
          (r: any) => r.original_invoice_id === invoice.id && r.status !== 'cancelled'
        );

        // Map prior returns per original item
        const returnedMap: Record<string, { qty: number; refund: number }> = {};
        for (const r of allReturns) {
          const rItems = r.invoice_items || r.items || [];
          for (const rit of rItems) {
            const key = rit.original_invoice_item_id || rit.id;
            if (!returnedMap[key]) returnedMap[key] = { qty: 0, refund: 0 };
            returnedMap[key].qty += Number(rit.qty || 0);
            returnedMap[key].refund += Number(rit.total_price || 0);
          }
        }

        // 3. Client balance if client sale
        let curBal = 0;
        if (invoice.client_id) {
          try {
            const clientRes = await fetch(`/api/clients?tenant_id=${tenantId}`);
            const clientJson = await clientRes.json();
            const cl = (clientJson.clients || []).find((c: any) => c.id === invoice.client_id);
            if (cl) curBal = Number(cl.current_balance) || 0;
          } catch {}
        }

        if (isMounted) {
          setClientBalance(curBal);

          const returnableList: ReturnableItemState[] = origItems
            .filter((it) => !!it.id)
            .map((it) => {
              const itemId = it.id as string;
              const origQty = Number(it.qty) || 1;
              const unitPrice = Number(it.unit_price) || 0;
              const origTotal = Number(it.total_price ?? origQty * unitPrice);
              const prior = returnedMap[itemId] || { qty: 0, refund: 0 };
              const returnable = Math.max(0, origQty - prior.qty);

              return {
                original_item_id: itemId,
                item_id: it.item_id || null,
                item_name: it.item_name || 'Product',
                shade_code: it.shade_code || '',
                pack_size: it.pack_size || '',
                unit_price: unitPrice,
                original_qty: origQty,
                original_total_price: origTotal,
                already_returned_qty: prior.qty,
                already_refunded_amount: prior.refund,
                returnable_qty: returnable,
                return_qty: 0,
                line_refund: 0,
              };
            });

          setItems(returnableList);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load returnable items.');
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoice?.id, tenantId]);

  // Handle return qty change
  const handleQtyChange = (origId: string, val: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.original_item_id !== origId) return it;
        const validQty = Math.min(it.returnable_qty, Math.max(0, Math.floor(val)));

        // Cents rule: if completes remaining quantity, refund remaining total price
        let lineRef = 0;
        if (validQty > 0) {
          if (validQty === it.returnable_qty) {
            lineRef = Math.max(0, it.original_total_price - it.already_refunded_amount);
          } else {
            lineRef = Math.round(validQty * (it.original_total_price / it.original_qty) * 100) / 100;
          }
        }

        return {
          ...it,
          return_qty: validQty,
          line_refund: lineRef,
        };
      })
    );
  };

  // Calculations
  const totalReturnNet = useMemo(() => {
    return Math.round(items.reduce((acc, it) => acc + it.line_refund, 0) * 100) / 100;
  }, [items]);

  // Server Khata offset rule (R1c)
  const khataOffset = useMemo(() => {
    if (!invoice.client_id || totalReturnNet <= 0) return 0;
    // Khata offset reduces customer's balance/debt up to the original due amount floored at 0
    const rawOffset = Math.min(totalReturnNet, Math.max(0, Number(invoice.due_amount || 0)), clientBalance);
    return Math.round(rawOffset * 100) / 100;
  }, [invoice.client_id, invoice.due_amount, totalReturnNet, clientBalance]);

  const cashierRefundRequired = useMemo(() => {
    return Math.max(0, Math.round((totalReturnNet - khataOffset) * 100) / 100);
  }, [totalReturnNet, khataOffset]);

  // Sync default cash refund when cashierRefundRequired changes
  useEffect(() => {
    if (refundMode === 'cash') {
      setCashRefund(cashierRefundRequired);
      setCardRefund(0);
    } else if (refundMode === 'card') {
      setCardRefund(cashierRefundRequired);
      setCashRefund(0);
    }
  }, [cashierRefundRequired, refundMode]);

  const handleSubmitReturn = async () => {
    if (submitting) return;
    setErrorMessage(null);

    const itemsToReturn = items.filter((it) => it.return_qty > 0);
    if (itemsToReturn.length === 0) {
      setErrorMessage('Please select at least one item and quantity to return.');
      return;
    }

    const currentPayout = Math.round((Number(cashRefund || 0) + Number(cardRefund || 0)) * 100) / 100;
    if (Math.abs(currentPayout - cashierRefundRequired) > 0.05) {
      setErrorMessage(
        `Disbursed refund (Rs. ${currentPayout.toLocaleString()}) must equal required payout (Rs. ${cashierRefundRequired.toLocaleString()}).`
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        tenant_id: tenantId,
        original_invoice_id: invoice.id,
        items: itemsToReturn.map((it) => ({
          original_invoice_item_id: it.original_item_id,
          item_id: it.item_id,
          qty: it.return_qty,
        })),
        payment_type: refundMode,
        cash_paid: refundMode === 'card' ? 0 : cashRefund,
        card_paid: refundMode === 'cash' ? 0 : cardRefund,
      };

      const res = await fetch('/api/invoices/special-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to process special return.');
      }

      alert(
        `Special Return #${resData.return_invoice_no || ''} completed successfully.\n` +
          `Total Refund: Rs. ${Number(resData.refund_total || totalReturnNet).toLocaleString()}\n` +
          (resData.khata_offset > 0 ? `Khata Debt Offset: Rs. ${Number(resData.khata_offset).toLocaleString()}\n` : '') +
          `Cashier Disbursed: Rs. ${Number(resData.cashier_refund || cashierRefundRequired).toLocaleString()}\n\n` +
          `(Option E: Paperless return recorded with zero receipt print)`
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Special return execution error:', err);
      setErrorMessage(err.message || 'An error occurred during special return.');
      setSubmitting(false);
    }
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
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
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
                background: 'rgba(249, 115, 22, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FB923C',
              }}
            >
              <RotateCcw style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                  Special Return Processing
                </h3>
                <span
                  style={{
                    background: '#F97316',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  Option E Zero-Print
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
                Original Invoice #{invoice.invoice_no} • Customer: {invoice.client_name || 'Walk-in'}
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
              borderRadius: '6px',
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Policy Notice */}
        <div
          style={{
            background: '#FFFBEB',
            borderBottom: '1px solid #FDE68A',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: '#92400E',
          }}
        >
          <Lock style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>
            <strong>Owner Decision Enforced:</strong> Rates are locked to original charged prices. Opened buckets are strictly rejected. Under Option E, special returns complete electronically with zero paper print.
          </span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '12px',
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

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              Loading returnable items...
            </div>
          ) : (
            <>
              {/* Items Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: 700 }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Item Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Sold</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Returned</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Returnable</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Locked Rate</th>
                      <th style={{ padding: '8px 10px', width: '90px', textAlign: 'center' }}>Return Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Line Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.original_item_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B' }}>{it.item_name}</div>
                          {it.shade_code && (
                            <div style={{ fontSize: '10.5px', color: '#64748B' }}>Shade: {it.shade_code}</div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>{it.original_qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: it.already_returned_qty > 0 ? '#EA580C' : '#94A3B8' }}>
                          {it.already_returned_qty}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#16A34A' }}>
                          {it.returnable_qty}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                          Rs. {it.unit_price.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={it.returnable_qty}
                            disabled={it.returnable_qty === 0}
                            value={it.return_qty || ''}
                            onChange={(e) => handleQtyChange(it.original_item_id, parseInt(e.target.value, 10) || 0)}
                            placeholder="0"
                            style={{
                              width: '60px',
                              textAlign: 'center',
                              padding: '5px',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                          Rs. {it.line_refund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tender & Khata Offset Breakdown */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '14px',
                  border: '1px solid #E2E8F0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#64748B' }}>Gross Return Value:</span>
                    <strong style={{ color: '#0F172A' }}>Rs. {totalReturnNet.toLocaleString()}</strong>
                  </div>

                  {khataOffset > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: '#0284C7' }}>
                      <span>Khata Debt Offset (Ledger):</span>
                      <strong>- Rs. {khataOffset.toLocaleString()}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>Net Cashier Payout Due:</span>
                    <strong style={{ fontSize: '15px', color: '#16A34A', fontWeight: 800 }}>
                      Rs. {cashierRefundRequired.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Refund Payment Tender
                  </label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {(['cash', 'card', 'mixed'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRefundMode(m)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: refundMode === m ? '#0F172A' : '#CBD5E1',
                          background: refundMode === m ? '#0F172A' : '#FFFFFF',
                          color: refundMode === m ? '#FFFFFF' : '#475569',
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

                  {refundMode === 'mixed' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: '#64748B' }}>Cash Payout</label>
                        <input
                          type="number"
                          min="0"
                          value={cashRefund || ''}
                          onChange={(e) => setCashRefund(parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: '#64748B' }}>Card Payout</label>
                        <input
                          type="number"
                          min="0"
                          value={cardRefund || ''}
                          onChange={(e) => setCardRefund(parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      Disbursing <strong>Rs. {cashierRefundRequired.toLocaleString()}</strong> via {refundMode.toUpperCase()}.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
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
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            Zero Paper Print • Database &amp; Ledger Updated Instantly
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting || totalReturnNet <= 0}
              onClick={handleSubmitReturn}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: totalReturnNet <= 0 ? '#94A3B8' : '#F97316',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 800,
                cursor: totalReturnNet <= 0 || submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              {submitting ? 'Recording Return...' : `Confirm Return (Rs. ${totalReturnNet.toLocaleString()})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
