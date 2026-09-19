'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Client, Item } from '@/types';
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
  Package,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
  tenantName?: string;
  shiftId?: string;
  staffName?: string;
  clients?: Client[];
  items?: Item[];
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
  items = [],
  onRedeemed,
}: Props) {
  const [customerMode, setCustomerMode] = useState<'registered' | 'walkin'>('registered');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [walkinName, setWalkinName] = useState<string>('');

  // ── Item selector state ──────────────────────────────────────────────────
  const [itemSearch, setItemSearch] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemRedeemableBalance, setItemRedeemableBalance] = useState<number | null>(null);
  const [loadingItemBalance, setLoadingItemBalance] = useState<boolean>(false);

  const [redeemAmount, setRedeemAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Loose / External Brand Token State
  const [isLooseToken, setIsLooseToken] = useState<boolean>(false);
  const [looseBrand, setLooseBrand] = useState<string>('Master Paints');
  const [looseItemName, setLooseItemName] = useState<string>('');
  const [looseTokenCount, setLooseTokenCount] = useState<number>(1);
  const [looseUnitValue, setLooseUnitValue] = useState<string>('500');

  // Success Voucher State
  const [completedTxn, setCompletedTxn] = useState<{
    id: string;
    clientName: string;
    itemName: string;
    amount: number;
    remainingBalance: number;
    date: string;
    notes?: string;
  } | null>(null);

  // ── Computed: selected client ────────────────────────────────────────────
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Filtered clients for searchable dropdown
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

  // ── Computed: selected item ──────────────────────────────────────────────
  const selectedItem = useMemo(() => {
    return items.find((it) => it.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Filtered items — default view shows token-enabled items first
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items.filter((it) => it.has_token).slice(0, 15);
    const q = itemSearch.toLowerCase();
    return items
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.brand && it.brand.toLowerCase().includes(q)) ||
          (it.code && it.code.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [items, itemSearch]);

  const clientTokenBalance = Number((selectedClient as any)?.token_balance || 0);

  // Effective cap: if loose token, cap is client balance (if registered); otherwise check item redeemable balance
  const effectiveCap: number | undefined =
    isLooseToken
      ? customerMode === 'registered' && selectedClient
        ? clientTokenBalance
        : undefined
      : itemRedeemableBalance !== null
      ? customerMode === 'registered' && selectedClient
        ? Math.min(itemRedeemableBalance, clientTokenBalance)
        : itemRedeemableBalance
      : undefined;

  // NaN-safe parse: handles '', '-', '5.' without showing NaN anywhere
  const parsedRedeemAmount =
    redeemAmount === '' || redeemAmount === '-' ? 0 : parseFloat(redeemAmount) || 0;

  const remainingBalanceAfter =
    customerMode === 'registered' ? Math.max(0, clientTokenBalance - parsedRedeemAmount) : 0;

  const amountExceedsCap =
    effectiveCap !== undefined && parsedRedeemAmount > 0 && parsedRedeemAmount > effectiveCap;

  const isSubmitDisabled =
    submitting ||
    parsedRedeemAmount <= 0 ||
    amountExceedsCap ||
    (!isLooseToken && (!selectedItemId || loadingItemBalance)) ||
    (customerMode === 'registered' && !selectedClientId);

  // ── Fetch per-item redeemable balance from server ────────────────────────
  useEffect(() => {
    if (!selectedItemId || !tenantId) {
      setItemRedeemableBalance(null);
      return;
    }
    setLoadingItemBalance(true);
    fetch(`/api/tokens?tenant_id=${tenantId}&item_id=${selectedItemId}&summary=redeemable`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setItemRedeemableBalance(Number(data.redeemable_balance ?? 0));
        } else {
          setItemRedeemableBalance(0);
        }
      })
      .catch(() => setItemRedeemableBalance(0))
      .finally(() => setLoadingItemBalance(false));
  }, [selectedItemId, tenantId]);

  if (!isOpen) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientSearch(client.name);
    setErrorMsg(null);
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItemId(item.id);
    setItemSearch(item.name + (item.brand ? ` — ${item.brand}` : ''));
    setRedeemAmount('');
    setErrorMsg(null);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tenantId) {
      setErrorMsg('Tenant ID missing.');
      return;
    }

    // Item is mandatory if not loose token
    if (!isLooseToken && (!selectedItemId || !selectedItem)) {
      setErrorMsg('Please select the paint item whose token is being redeemed, or toggle "Accept Loose / External Brand Token".');
      return;
    }

    if (parsedRedeemAmount <= 0) {
      setErrorMsg('Please enter a valid redemption amount greater than 0.');
      return;
    }

    // Per-item redeemable balance check (client-side guard — skipped if loose/external)
    if (!isLooseToken && itemRedeemableBalance !== null) {
      if (itemRedeemableBalance <= 0) {
        setErrorMsg(`All tokens for "${selectedItem?.name}" have already been redeemed. Toggle "Accept Loose / External Brand Token" if accepting an older or non-system token.`);
        return;
      }
      if (parsedRedeemAmount > itemRedeemableBalance) {
        setErrorMsg(
          `Only Rs. ${itemRedeemableBalance.toLocaleString()} left to redeem for "${selectedItem?.name}".`
        );
        return;
      }
    }

    if (customerMode === 'registered') {
      if (!selectedClient) {
        setErrorMsg('Please select a registered customer.');
        return;
      }
      if (parsedRedeemAmount > clientTokenBalance) {
        setErrorMsg(
          `Redemption amount (Rs. ${parsedRedeemAmount.toLocaleString()}) exceeds customer balance (Rs. ${clientTokenBalance.toLocaleString()}).`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const resolvedItemName = isLooseToken
        ? (looseItemName.trim() || `${looseBrand} Token`)
        : selectedItem!.name;
      const resolvedBrand = isLooseToken ? looseBrand : (selectedItem?.brand || null);

      const payload = {
        type: 'redeemed',
        tenant_id: tenantId,
        client_id: customerMode === 'registered' ? selectedClient?.id : null,
        client_name:
          customerMode === 'registered'
            ? selectedClient?.name
            : walkinName.trim() || 'Walk-in Customer',
        item_id: isLooseToken ? (selectedItemId || null) : selectedItemId,
        item_name: resolvedItemName,
        brand: resolvedBrand,
        redeemed_amount: parsedRedeemAmount,
        token_count: isLooseToken ? Math.max(1, looseTokenCount) : 1,
        unit_token_value: isLooseToken ? (parseFloat(looseUnitValue) || (parsedRedeemAmount / looseTokenCount)) : parsedRedeemAmount,
        allow_external: isLooseToken,
        is_external: isLooseToken,
        shift_id: shiftId || null,
        notes: notes.trim()
          ? `${notes.trim()}${isLooseToken ? ' (Loose / External Token)' : ''}`
          : (isLooseToken ? 'Loose / External Token' : undefined),
      };

      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setErrorMsg(data.error || 'Failed to redeem token');
        setSubmitting(false);
        return;
      }

      setCompletedTxn({
        id: data.transaction?.id || 'TXN-' + Date.now(),
        clientName:
          customerMode === 'registered'
            ? selectedClient?.name || 'Customer'
            : walkinName.trim() || 'Walk-in Customer',
        itemName: resolvedItemName,
        amount: parsedRedeemAmount,
        remainingBalance: data.remaining_balance ?? remainingBalanceAfter,
        date: new Date().toLocaleString(),
        notes: notes.trim() || undefined,
      });

      onRedeemed?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error processing redemption');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintVoucher = () => {
    window.print();
  };

  const handleResetForNew = () => {
    setCompletedTxn(null);
    setSelectedClientId('');
    setClientSearch('');
    setWalkinName('');
    setItemSearch('');
    setSelectedItemId('');
    setItemRedeemableBalance(null);
    setRedeemAmount('');
    setNotes('');
    setErrorMsg(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pos-modal-overlay" style={{ zIndex: 100 }}>
      <div
        className="pos-modal-card"
        style={{
          maxWidth: '540px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
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
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0F172A',
              }}
            >
              <Ticket style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: 0,
                }}
              >
                Paint Token Redemption
              </h3>
              <p
                style={{
                  fontSize: '11px',
                  color: '#94A3B8',
                  margin: 0,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                Cash Payout for Returned Paint Tokens
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
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {completedTxn ? (
          /* ── SUCCESS RECEIPT / VOUCHER VIEW ── */
          <div style={{ padding: '1.5rem', background: '#F8FAFC' }}>
            <div
              style={{
                textAlign: 'center',
                marginBottom: '1rem',
                padding: '12px',
                background: '#ECFDF5',
                borderRadius: '8px',
                border: '1px solid #A7F3D0',
              }}
            >
              <CheckCircle2
                style={{ width: 32, height: 32, color: '#059669', margin: '0 auto 6px' }}
              />
              <h4 style={{ margin: 0, color: '#065F46', fontWeight: 800, fontSize: '14px' }}>
                Token Payout Successful!
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#047857' }}>
                Cash payment of Rs. {completedTxn.amount.toLocaleString()} recorded to shift
              </p>
            </div>

            {/* Thermal Printable Voucher Slip */}
            <div
              id="token-payout-slip"
              style={{
                background: '#FFFFFF',
                border: '1px dashed #CBD5E1',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#0F172A',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #E2E8F0', paddingBottom: '8px' }}>
                <p style={{ fontWeight: 800, fontSize: '13px', margin: 0 }}>{tenantName}</p>
                <p style={{ fontSize: '10px', color: '#64748B', margin: '2px 0 0' }}>
                  PAINT TOKEN CASHOUT VOUCHER
                </p>
                <p style={{ fontSize: '9px', color: '#94A3B8', margin: '2px 0 0' }}>
                  {completedTxn.date}
                </p>
              </div>

              <div style={{ padding: '10px 0', borderBottom: '1px dashed #E2E8F0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Beneficiary:</span>
                  <span style={{ fontWeight: 700 }}>{completedTxn.clientName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Paint Item:</span>
                  <span style={{ fontWeight: 700, textAlign: 'right', maxWidth: '200px' }}>{completedTxn.itemName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Cashier:</span>
                  <span>{staffName}</span>
                </div>
                {shiftId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Shift:</span>
                    <span style={{ fontSize: '10px' }}>{shiftId.slice(0, 8)}...</span>
                  </div>
                )}
                {completedTxn.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Notes:</span>
                    <span>{completedTxn.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '10px 0', borderBottom: '1px dashed #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: '#B45309' }}>
                  <span>PAID OUT (CASH):</span>
                  <span>Rs. {completedTxn.amount.toLocaleString()}</span>
                </div>
                {customerMode === 'registered' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '10px' }}>
                    <span>Remaining Token Bal:</span>
                    <span style={{ fontWeight: 700 }}>Rs. {completedTxn.remainingBalance.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div style={{ paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94A3B8' }}>
                <div>Cashier Sig: __________</div>
                <div>Customer Sig: __________</div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={handlePrintVoucher}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Printer style={{ width: 15, height: 15 }} />
                Print Voucher
              </button>
              <button
                type="button"
                onClick={handleResetForNew}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#F1F5F9',
                  color: '#0F172A',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                New Redemption
              </button>
            </div>
          </div>
        ) : (
          /* ── REDEMPTION FORM VIEW ── */
          <form onSubmit={handleRedeem} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '10px 12px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  color: '#DC2626',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                }}
              >
                <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Mode Selector (Registered Client vs Walk-in) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setCustomerMode('registered');
                  setErrorMsg(null);
                }}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border:
                    customerMode === 'registered' ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                  background: customerMode === 'registered' ? '#FEF3C7' : '#FFFFFF',
                  color: customerMode === 'registered' ? '#92400E' : '#64748B',
                }}
              >
                <Users style={{ width: 15, height: 15 }} />
                Registered Customer
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomerMode('walkin');
                  setErrorMsg(null);
                }}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border:
                    customerMode === 'walkin' ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                  background: customerMode === 'walkin' ? '#FEF3C7' : '#FFFFFF',
                  color: customerMode === 'walkin' ? '#92400E' : '#64748B',
                }}
              >
                <User style={{ width: 15, height: 15 }} />
                Walk-in Customer
              </button>
            </div>

            {/* Registered Customer Selection */}
            {customerMode === 'registered' ? (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Select Customer (with Token Balance)
                </label>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
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
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      if (selectedClientId) setSelectedClientId('');
                    }}
                    placeholder="Search client by name or phone..."
                    className="pos-text-input"
                    style={{ paddingLeft: '32px', fontSize: '12px' }}
                  />
                </div>

                {/* Dropdown search suggestions */}
                {!selectedClientId && clientSearch.trim().length > 0 && (
                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      background: '#FFFFFF',
                      marginBottom: '8px',
                    }}
                  >
                    {filteredClients.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                        No clients found
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          style={{
                            padding: '8px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #F1F5F9',
                            fontSize: '11.5px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{client.name}</span>
                            {client.phone && (
                              <span style={{ color: '#64748B', marginLeft: '6px', fontSize: '10.5px' }}>
                                ({client.phone})
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: 700,
                              color: Number((client as any).token_balance || 0) > 0 ? '#D97706' : '#94A3B8',
                              background: Number((client as any).token_balance || 0) > 0 ? '#FEF3C7' : '#F1F5F9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                            }}
                          >
                            🎫 Rs. {Number((client as any).token_balance || 0).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Client Card */}
                {selectedClient && (
                  <div
                    style={{
                      background: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#92400E', fontSize: '13px' }}>
                        {selectedClient.name}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#B45309' }}>
                        {selectedClient.phone || 'No phone'} · {selectedClient.city || 'Local'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#92400E', textTransform: 'uppercase', fontWeight: 700 }}>
                        Current Token Bal
                      </div>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          fontFamily: 'JetBrains Mono, monospace',
                          color: '#B45309',
                        }}
                      >
                        Rs. {clientTokenBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Walk-in Customer Input */
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Walk-in Beneficiary / Painter Name (Optional)
                </label>
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. Master Aslam (Painter) or Cash Walk-in"
                  className="pos-text-input"
                  style={{ fontSize: '12px' }}
                />
              </div>
            )}

            {/* ── Loose / External Brand Token Toggle ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: isLooseToken ? '#EFF6FF' : '#F8FAFC',
                border: `1px solid ${isLooseToken ? '#93C5FD' : '#E2E8F0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => {
                const next = !isLooseToken;
                setIsLooseToken(next);
                if (next) {
                  const autoAmt = (looseTokenCount * (parseFloat(looseUnitValue) || 500)).toString();
                  setRedeemAmount(autoAmt);
                  setErrorMsg(null);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ticket style={{ width: 16, height: 16, color: isLooseToken ? '#2563EB' : '#64748B' }} />
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: isLooseToken ? '#1E40AF' : '#1E293B' }}>
                    Accept Loose / External Brand Token
                  </div>
                  <div style={{ fontSize: '10px', color: isLooseToken ? '#3B82F6' : '#64748B' }}>
                    Accept tokens from previous stock or company promos without POS sales history
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isLooseToken}
                onChange={(e) => {
                  e.stopPropagation();
                  setIsLooseToken(e.target.checked);
                  if (e.target.checked) {
                    const autoAmt = (looseTokenCount * (parseFloat(looseUnitValue) || 500)).toString();
                    setRedeemAmount(autoAmt);
                    setErrorMsg(null);
                  }
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
              />
            </div>

            {isLooseToken ? (
              /* ── Loose Token Details (Brand, Count, Unit Value) ── */
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '4px' }}>
                      Paint Brand *
                    </label>
                    <select
                      value={looseBrand}
                      onChange={(e) => setLooseBrand(e.target.value)}
                      className="pos-text-input"
                      style={{ fontSize: '12px', background: '#FFFFFF' }}
                    >
                      {['Master Paints', 'Berger Paints', 'Dulux / AkzoNobel', 'Nippon Paint', 'Brighto Paints', 'Diamond Paints', 'Happilac Paints', 'Jotun Paints', 'Gobies Paints', 'General / Other'].map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '4px' }}>
                      Token Count *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={looseTokenCount}
                      onChange={(e) => {
                        const count = Math.max(1, parseInt(e.target.value) || 1);
                        setLooseTokenCount(count);
                        const autoAmt = (count * (parseFloat(looseUnitValue) || 0)).toString();
                        setRedeemAmount(autoAmt);
                      }}
                      className="pos-text-input"
                      style={{ fontSize: '12px', background: '#FFFFFF' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '4px' }}>
                      Value Per Token (Rs.) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={looseUnitValue}
                      onChange={(e) => {
                        setLooseUnitValue(e.target.value);
                        const autoAmt = (looseTokenCount * (parseFloat(e.target.value) || 0)).toString();
                        setRedeemAmount(autoAmt);
                      }}
                      className="pos-text-input"
                      style={{ fontSize: '12px', background: '#FFFFFF' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: '4px' }}>
                      Token Description / Campaign
                    </label>
                    <input
                      type="text"
                      value={looseItemName}
                      onChange={(e) => setLooseItemName(e.target.value)}
                      placeholder="e.g. Weathercoat 16L Token"
                      className="pos-text-input"
                      style={{ fontSize: '12px', background: '#FFFFFF' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Paint Item Selector (standard POS linked) ── */
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Select Paint / Item Being Redeemed *
                </label>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Package
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
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      if (selectedItemId) {
                        setSelectedItemId('');
                        setItemRedeemableBalance(null);
                      }
                    }}
                    placeholder="Search paint by name, brand, or code..."
                    className="pos-text-input"
                    style={{ paddingLeft: '32px', fontSize: '12px' }}
                  />
                </div>

                {/* Item dropdown suggestions */}
                {!selectedItemId && (
                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      background: '#FFFFFF',
                      marginBottom: '8px',
                    }}
                  >
                    {filteredItems.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                        {itemSearch.trim() ? 'No items found' : 'No token-enabled items — type to search all products'}
                      </div>
                    ) : (
                      filteredItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          style={{
                            padding: '8px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #F1F5F9',
                            fontSize: '11.5px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{item.name}</span>
                            {item.brand && (
                              <span style={{ color: '#64748B', marginLeft: '6px', fontSize: '10.5px' }}>
                                {item.brand}
                              </span>
                            )}
                            <span style={{ color: '#94A3B8', marginLeft: '6px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                              {item.code}
                            </span>
                          </div>
                          {item.has_token && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                background: '#FEF3C7',
                                color: '#92400E',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #FDE68A',
                              }}
                            >
                              🎫 Token
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Item Card */}
                {selectedItem && (
                  <div
                    style={{
                      background: selectedItemId ? '#FFFBEB' : '#F8FAFC',
                      border: `1px solid ${selectedItemId ? '#FDE68A' : '#E2E8F0'}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#92400E', fontSize: '13px' }}>
                        {selectedItem.name}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#B45309' }}>
                        {selectedItem.brand || 'No brand'} · {selectedItem.code}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#92400E', textTransform: 'uppercase', fontWeight: 700 }}>
                        Redeemable Pool
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 800,
                          fontFamily: 'JetBrains Mono, monospace',
                          color: loadingItemBalance
                            ? '#94A3B8'
                            : (itemRedeemableBalance ?? 0) > 0
                            ? '#B45309'
                            : '#DC2626',
                        }}
                      >
                        {loadingItemBalance
                          ? 'Loading...'
                          : itemRedeemableBalance !== null
                          ? `Rs. ${itemRedeemableBalance.toLocaleString()}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Redeem Amount Input & Quick Chips */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontWeight: 700, color: '#334155', fontSize: '12px' }}>
                  Redeem Amount to Pay Out (Rs.) *
                </label>
                {effectiveCap !== undefined && effectiveCap > 0 && (
                  <button
                    type="button"
                    onClick={() => setRedeemAmount(effectiveCap.toString())}
                    style={{
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#F97316',
                      fontWeight: 700,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Max (Rs. {effectiveCap.toLocaleString()})
                  </button>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  max={effectiveCap}
                  required
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  onKeyDown={(e) => {
                    // Block minus sign and exponential notation (e/E)
                    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="0.00"
                  className="pos-text-input"
                  style={{
                    paddingLeft: '45px',
                    fontSize: '16px',
                    fontWeight: 800,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: amountExceedsCap ? '#DC2626' : '#0F172A',
                    borderColor: amountExceedsCap ? '#FECACA' : '#F59E0B',
                  }}
                  autoFocus
                />
              </div>

              {/* Live cap warning */}
              {amountExceedsCap && effectiveCap !== undefined && (
                <div
                  style={{
                    marginTop: '5px',
                    padding: '6px 10px',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#DC2626',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
                  Max redeemable: Rs. {effectiveCap.toLocaleString()}
                  {selectedItem && ` for "${selectedItem.name}"`}
                </div>
              )}

              {/* Quick preset amount chips — clamp to effectiveCap */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {[200, 500, 1000, 1500, 2000].map((amt) => {
                  const cappedAmt = effectiveCap !== undefined ? Math.min(amt, effectiveCap) : amt;
                  const isDisabled = effectiveCap !== undefined && effectiveCap <= 0;
                  return (
                    <button
                      key={amt}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setRedeemAmount(cappedAmt.toString())}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 600,
                        background: isDisabled ? '#F8FAFC' : '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        color: isDisabled ? '#CBD5E1' : '#334155',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                    >
                      Rs. {cappedAmt.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remaining Balance Indicator for Registered Customers */}
            {customerMode === 'registered' && selectedClient && parsedRedeemAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                <span style={{ color: '#64748B' }}>Remaining Balance After Payout:</span>
                <span style={{ fontWeight: 800, color: remainingBalanceAfter >= 0 ? '#0F172A' : '#DC2626' }}>
                  Rs. {remainingBalanceAfter.toLocaleString()}
                </span>
              </div>
            )}

            {/* Cashier Notes */}
            <div>
              <label style={{ fontWeight: 700, color: '#334155', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                Transaction Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 5 Berger drum tokens returned by painter"
                className="pos-text-input"
                style={{ fontSize: '11.5px' }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#F1F5F9',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitDisabled}
                style={{
                  flex: 2,
                  padding: '10px',
                  background: isSubmitDisabled
                    ? '#94A3B8'
                    : 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: isSubmitDisabled ? 'none' : '0 4px 12px rgba(217, 119, 6, 0.3)',
                }}
              >
                <Coins style={{ width: 16, height: 16 }} />
                {submitting
                  ? 'Processing Payout...'
                  : `Pay Out Cash Rs. ${parsedRedeemAmount > 0 ? parsedRedeemAmount.toLocaleString() : '—'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
