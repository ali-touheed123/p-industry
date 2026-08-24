'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { HeldInvoice } from '@/types';
import {
  Search,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  User,
  ShoppingBag,
  PauseCircle,
  CheckCircle2,
  X,
  Eye,
} from 'lucide-react';

interface Props {
  tenantId?: string;
  tenantName?: string;
  staffName?: string;
  onResumeOrder: (order: HeldInvoice) => void;
  onNavigateToPos?: () => void;
}

export default function HoldInvoices({
  tenantId,
  tenantName = 'PaintERP Branch',
  staffName = 'Counter Staff',
  onResumeOrder,
  onNavigateToPos,
}: Props) {
  const [heldOrders, setHeldOrders] = useState<HeldInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPreviewOrder, setSelectedPreviewOrder] = useState<HeldInvoice | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch Held Invoices from Database
  const fetchHeldInvoices = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/held-invoices?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.held_invoices)) {
        setHeldOrders(data.held_invoices);
      } else {
        setHeldOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch held invoices', err);
      setHeldOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeldInvoices();
  }, [tenantId]);

  // Handle Resume
  const handleResume = async (order: HeldInvoice) => {
    // 1. Delete from DB so it's not held anymore
    try {
      await fetch(`/api/held-invoices?id=${order.id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to remove from DB on resume', err);
    }

    // 2. Trigger Resume in parent & navigate to POS
    onResumeOrder(order);
  };

  // Handle Discard / Delete
  const handleDelete = async (order: HeldInvoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to discard held invoice ${order.hold_no}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/held-invoices?id=${order.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
        showToast(`Discarded ${order.hold_no}.`);
      }
    } catch (err) {
      console.error('Failed to delete held order', err);
    }
  };

  // Helper to format date & time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { time: '12:00 PM', dateLabel: 'Today' };
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    let dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
    return { time, dateLabel };
  };

  // Filtered Held Orders
  const filteredOrders = useMemo(() => {
    return heldOrders.filter((order) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        order.hold_no?.toLowerCase().includes(q) ||
        order.client_name?.toLowerCase().includes(q) ||
        order.remarks?.toLowerCase().includes(q)
      );
    });
  }, [heldOrders, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC', padding: '1.5rem', overflowY: 'auto' }}>
      {/* ── Notification Toast ── */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 style={{ width: 16, height: 16, color: '#22C55E' }} />
          {notification}
        </div>
      )}

      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', margin: 0 }}>
            Hold Invoices
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            Resume parked customer orders directly into POS billing
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search
              style={{
                width: 15,
                height: 15,
                color: '#94A3B8',
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hold ID or customer..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchHeldInvoices}
            title="Refresh list"
            style={{
              padding: '7px 12px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Main Hold Invoices Card & Table (Matching User Screenshot Exactly) ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <th style={{ padding: '14px 20px', width: '180px' }}>Hold ID</th>
                <th style={{ padding: '14px 20px', width: '180px' }}>Time / Date</th>
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px', width: '120px', textAlign: 'center' }}>Items</th>
                <th style={{ padding: '14px 20px', width: '180px', textAlign: 'left' }}>Total Amount</th>
                <th style={{ padding: '14px 20px', width: '160px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3.5rem', textAlign: 'center', color: '#64748B' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.75rem', borderColor: '#2563EB', borderTopColor: 'transparent' }} />
                    <p style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>Loading parked invoices...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '12px',
                        background: '#EFF6FF',
                        color: '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                      }}
                    >
                      <PauseCircle style={{ width: 28, height: 28 }} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                      No Hold Invoices Found
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '380px', margin: '0 auto 1.25rem' }}>
                      There are currently no parked customer carts. When you park an invoice in POS billing (`Hold F7`), it will appear here.
                    </p>
                    {onNavigateToPos && (
                      <button
                        onClick={onNavigateToPos}
                        style={{
                          padding: '8px 18px',
                          background: '#0F172A',
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
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const { time, dateLabel } = formatDateTime(order.created_at);
                  const itemCount = order.items_json?.length || 0;
                  const totalFormatted = `Rs. ${Number(order.net_total || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                  return (
                    <tr
                      key={order.id || idx}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                    >
                      {/* Hold ID */}
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            color: '#1D4ED8',
                            fontWeight: 700,
                            fontSize: '14px',
                            fontFamily: 'Inter, sans-serif',
                            letterSpacing: '-0.01em',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedPreviewOrder(order)}
                          title="Click to preview items"
                        >
                          {order.hold_no || `#HLD-${idx + 1}`}
                        </span>
                      </td>

                      {/* Time / Date */}
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                          {time}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', lineHeight: 1.2 }}>
                          {dateLabel}
                        </div>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                          {order.client_name || 'Walk-in Customer'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', lineHeight: 1.2 }}>
                          {order.remarks || '-'}
                        </div>
                      </td>

                      {/* Items Count Badge */}
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '28px',
                            height: '24px',
                            padding: '0 8px',
                            background: '#EFF6FF',
                            color: '#1D4ED8',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {itemCount}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#0F172A',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {totalFormatted}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleResume(order)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '7px 18px',
                              background: '#1D4ED8',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(29, 78, 216, 0.2)',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#1E40AF')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#1D4ED8')}
                          >
                            <span style={{ fontSize: '10px' }}>▶</span>
                            Resume
                          </button>

                          {/* Discard / Delete */}
                          <button
                            type="button"
                            onClick={(e) => handleDelete(order, e)}
                            title="Discard held order"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              background: 'transparent',
                              color: '#94A3B8',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#DC2626';
                              e.currentTarget.style.borderColor = '#FECACA';
                              e.currentTarget.style.background = '#FEF2F2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#94A3B8';
                              e.currentTarget.style.borderColor = '#E2E8F0';
                              e.currentTarget.style.background = 'transparent';
                            }}
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

        {/* ── Table Footer ── */}
        <div
          style={{
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            padding: '14px 20px',
            fontSize: '13px',
            color: '#475569',
            fontWeight: 500,
          }}
        >
          Showing {filteredOrders.length > 0 ? 1 : 0} to {filteredOrders.length} of {heldOrders.length} entries
        </div>
      </div>

      {/* ── Quick Preview Items Modal ── */}
      {selectedPreviewOrder && (
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
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
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
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800 }}>
                  Held Cart Items — {selectedPreviewOrder.hold_no}
                </h3>
                <p style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Customer: {selectedPreviewOrder.client_name || 'Walk-in Customer'}
                </p>
              </div>
              <button
                onClick={() => setSelectedPreviewOrder(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  width: '26px',
                  height: '26px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.25rem', maxHeight: '350px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', color: '#475569', borderBottom: '1px solid #CBD5E1' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Item Name</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPreviewOrder.items_json?.map((it: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#0F172A' }}>
                        {it.productName || it.item_name || it.name}
                        {it.shadeCode && (
                          <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '6px' }}>
                            ({it.shadeCode})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>
                        {it.qty}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        Rs. {Number(it.rate || it.unit_price || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>
                        Rs. {Number((it.qty || 1) * (it.rate || it.unit_price || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px dashed #CBD5E1',
                  fontWeight: 800,
                  fontSize: '14px',
                }}
              >
                <span>Net Total:</span>
                <span style={{ color: '#1D4ED8' }}>
                  Rs. {Number(selectedPreviewOrder.net_total || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div
              style={{
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                onClick={() => setSelectedPreviewOrder(null)}
                style={{
                  padding: '7px 14px',
                  background: '#E2E8F0',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  const ord = selectedPreviewOrder;
                  setSelectedPreviewOrder(null);
                  handleResume(ord);
                }}
                style={{
                  padding: '7px 16px',
                  background: '#1D4ED8',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>▶</span> Resume in POS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
