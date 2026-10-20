'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Item } from '@/types';
import {
  X,
  Search,
  Printer,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Sliders,
} from 'lucide-react';
import { printViaIframe } from '@/utils/iframePrint';
import {
  generateOrderRef,
  computePackagingSummary,
  generateThermalOrderSlip,
  generateA4OrderSheet,
  OrderSheetLineItem,
} from './orderSheetPrintTemplates';

interface CompanyOrderSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  tenantName?: string;
}

// Memoized single row component to prevent sluggishness with large lists
const OrderItemRow = React.memo(function OrderItemRow({
  item,
  qty,
  onQtyChange,
}: {
  item: Item;
  qty: number;
  onQtyChange: (id: string, qty: number) => void;
}) {
  const stockNum = Number(item.stock_qty || 0);
  const isOutOfStock = stockNum <= 0;
  const isSelected = qty > 0;

  const handleIncrement = () => onQtyChange(item.id, (qty || 0) + 1);
  const handleDecrement = () => onQtyChange(item.id, Math.max(0, (qty || 0) - 1));
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onQtyChange(item.id, isNaN(val) ? 0 : Math.max(0, val));
  };

  return (
    <tr
      style={{
        borderBottom: '1px solid #f1f5f9',
        background: isSelected ? '#f0fdf4' : 'transparent',
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Code */}
      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '12px',
            color: '#0f172a',
            background: isSelected ? '#dcfce7' : '#f1f5f9',
            padding: '2px 6px',
            borderRadius: '4px',
            border: isSelected ? '1px solid #86efac' : '1px solid #e2e8f0',
          }}
        >
          {item.code}
        </span>
      </td>

      {/* Product Name & Shade */}
      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
          {item.name}
        </div>
        {item.shade_code && (
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
            Shade: <span style={{ fontWeight: 600, color: '#334155' }}>{item.shade_code}</span>
          </div>
        )}
      </td>

      {/* Brand */}
      <td style={{ padding: '8px 12px', verticalAlign: 'middle', fontSize: '12px', color: '#475569' }}>
        {item.brand || 'General'}
      </td>

      {/* Packaging / Unit */}
      <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#334155',
            background: '#e2e8f0',
            padding: '2px 8px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {item.pack_size || item.unit || 'Unit'}
        </span>
      </td>

      {/* Current Stock Qty */}
      <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: isOutOfStock ? '#dc2626' : '#16a34a',
            background: isOutOfStock ? '#fee2e2' : '#dcfce7',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {stockNum}
        </span>
      </td>

      {/* Order Quantity Stepper Input */}
      <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={qty <= 0}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: qty > 0 ? '#ffffff' : '#f8fafc',
              color: qty > 0 ? '#0f172a' : '#94a3b8',
              cursor: qty > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Minus style={{ width: 12, height: 12 }} />
          </button>
          <input
            type="number"
            min={0}
            step={1}
            value={qty === 0 ? '' : qty}
            placeholder="0"
            onChange={handleInputChange}
            style={{
              width: '56px',
              height: '26px',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '4px',
              border: isSelected ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleIncrement}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function CompanyOrderSheetModal({
  isOpen,
  onClose,
  items,
  tenantName = 'PyntFlow Store',
}: CompanyOrderSheetModalProps) {
  // Extract all distinct brands alphabetically
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.brand?.trim()) {
        set.add(it.brand.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Persistent draft state (itemId -> quantity) across brand switches
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [selectedBrand, setSelectedBrand] = useState<string>(() => availableBrands[0] || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [thermalWidth, setThermalWidth] = useState<80 | 58>(80);

  // Update selectedBrand if availableBrands changes
  React.useEffect(() => {
    if (availableBrands.length > 0 && selectedBrand === 'ALL' && !items.some(i => i.brand === selectedBrand)) {
      setSelectedBrand(availableBrands[0]);
    }
  }, [availableBrands, selectedBrand, items]);

  // Safe quantity updater callback
  const handleQtyChange = useCallback((id: string, qty: number) => {
    const validQty = Math.max(0, Math.floor(qty));
    setOrderQuantities((prev) => {
      if (validQty === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: validQty };
    });
  }, []);

  // Filtered items based on active brand and search query
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedBrand !== 'ALL') {
      list = list.filter((it) => (it.brand?.trim() || '') === selectedBrand);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((it) => {
        const c = (it.code || '').toLowerCase();
        const n = (it.name || '').toLowerCase();
        const s = (it.shade_code || '').toLowerCase();
        return c.includes(q) || n.includes(q) || s.includes(q);
      });
    }
    return list;
  }, [items, selectedBrand, searchQuery]);

  // Total items with qty > 0 across the whole catalog
  const orderedLineItems: OrderSheetLineItem[] = useMemo(() => {
    const list: OrderSheetLineItem[] = [];
    const itemMap = new Map(items.map((it) => [it.id, it]));

    for (const [id, qty] of Object.entries(orderQuantities)) {
      if (qty > 0 && itemMap.has(id)) {
        const it = itemMap.get(id)!;
        list.push({
          id: it.id,
          code: it.code,
          name: it.name,
          brand: it.brand || 'General',
          unit: it.unit || 'Unit',
          packSize: it.pack_size || it.unit,
          shadeCode: it.shade_code || null,
          qty,
        });
      }
    }
    return list;
  }, [items, orderQuantities]);

  // Compute live dynamic packaging summary
  const summary = useMemo(() => {
    return computePackagingSummary(orderedLineItems);
  }, [orderedLineItems]);

  // "Select All 0 Stock" action: scopes strictly to current active filtered items
  const handleSelectAllZeroStock = () => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      for (const it of filteredItems) {
        const stock = Number(it.stock_qty || 0);
        // If stock is <= 0 and qty not already set, set to 1
        if (stock <= 0 && (!next[it.id] || next[it.id] === 0)) {
          next[it.id] = 1;
        }
      }
      return next;
    });
  };

  // "Clear Selection" resets all quantities
  const handleClearSelection = () => {
    setOrderQuantities({});
  };

  // Discard confirmation on close
  const handleSafeClose = () => {
    const hasAnyQty = Object.values(orderQuantities).some((q) => q > 0);
    if (hasAnyQty) {
      const ok = window.confirm('Discard drafted order quantities?');
      if (!ok) return;
    }
    setOrderQuantities({});
    setSearchQuery('');
    setNotes('');
    onClose();
  };

  // Print handlers
  const handlePrintThermal = () => {
    if (orderedLineItems.length === 0) return;

    const now = new Date();
    const orderRef = generateOrderRef(now);
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const html = generateThermalOrderSlip(
      {
        tenantName,
        orderRef,
        dateStr,
        timeStr,
        notes: notes.trim() || undefined,
        items: orderedLineItems,
      },
      thermalWidth
    );

    printViaIframe(html);
  };

  const handlePrintA4 = () => {
    if (orderedLineItems.length === 0) return;

    const now = new Date();
    const orderRef = generateOrderRef(now);
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const html = generateA4OrderSheet({
      tenantName,
      orderRef,
      dateStr,
      timeStr,
      notes: notes.trim() || undefined,
      items: orderedLineItems,
    });

    printViaIframe(html);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Company Order Sheet &amp; Demand Slip
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#15803d',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                In-Memory Slip Generator
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Select company brand, enter demand quantities, and instantly print receipt slip for booking agent.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Toolbar & Filter Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left Controls: Brand Selector + Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '320px' }}>
            {/* Brand Dropdown */}
            <div style={{ minWidth: '170px' }}>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Brands ({items.length})</option>
                {availableBrands.map((b) => {
                  const count = items.filter((i) => (i.brand?.trim() || '') === b).length;
                  return (
                    <option key={b} value={b}>
                      {b} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 14,
                  height: 14,
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                placeholder="Search by code, shade, or item name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  paddingLeft: '32px',
                  paddingRight: '12px',
                  fontSize: '12.5px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>
          </div>

          {/* Right Actions: Auto-Select, Clear, Width Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSelectAllZeroStock}
              className="inv-btn-secondary"
              title="Set quantity = 1 for all zero-stock items in this view"
              style={{
                height: '36px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1d4ed8',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 style={{ width: 14, height: 14 }} />
              Select All 0 Stock ({filteredItems.filter((i) => Number(i.stock_qty || 0) <= 0).length})
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={Object.keys(orderQuantities).length === 0}
              className="inv-btn-secondary"
              title="Clear all ordered quantities"
              style={{
                height: '36px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 600,
                color: Object.keys(orderQuantities).length > 0 ? '#b91c1c' : '#94a3b8',
                background: Object.keys(orderQuantities).length > 0 ? '#fef2f2' : '#f8fafc',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                cursor: Object.keys(orderQuantities).length > 0 ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RotateCcw style={{ width: 13, height: 13 }} />
              Clear Selection
            </button>

            {/* Thermal Width Selector Toggle */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#f1f5f9',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid #cbd5e1',
              }}
            >
              <button
                type="button"
                onClick={() => setThermalWidth(80)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '4px',
                  background: thermalWidth === 80 ? '#0f172a' : 'transparent',
                  color: thermalWidth === 80 ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setThermalWidth(58)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '4px',
                  background: thermalWidth === 58 ? '#0f172a' : 'transparent',
                  color: thermalWidth === 58 ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                58mm
              </button>
            </div>
          </div>
        </div>

        {/* Product Table List */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: '#f8fafc',
                borderBottom: '1.5px solid #e2e8f0',
              }}
            >
              <tr>
                <th style={{ width: '110px', padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#475569' }}>
                  CODE
                </th>
                <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#475569' }}>
                  PRODUCT &amp; SHADE
                </th>
                <th style={{ width: '120px', padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#475569' }}>
                  BRAND
                </th>
                <th style={{ width: '100px', padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#475569', textAlign: 'center' }}>
                  PACKING
                </th>
                <th style={{ width: '90px', padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#475569', textAlign: 'center' }}>
                  IN STORE
                </th>
                <th style={{ width: '140px', padding: '10px 12px', fontSize: '11px', fontWeight: 800, color: '#475569', textAlign: 'right' }}>
                  ORDER QTY
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    <AlertCircle style={{ width: 24, height: 24, margin: '0 auto 8px auto', color: '#cbd5e1' }} />
                    No products found matching your current filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    qty={orderQuantities[item.id] || 0}
                    onQtyChange={handleQtyChange}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sticky Bottom Summary Bar & Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1.5px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Summary Text & Packaging Breakdown */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                Total Items: {summary.totalItems}
              </span>
              <span style={{ color: '#94a3b8' }}>&bull;</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803d' }}>
                {summary.totalPacks} Packs Total
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
              <strong>Tally:</strong> {summary.breakdownText}
            </div>
          </div>

          {/* Order Notes Field */}
          <div style={{ width: '220px' }}>
            <input
              type="text"
              placeholder="Order Notes / Instructions (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                padding: '0 8px',
                fontSize: '11.5px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSafeClose}
              style={{
                height: '38px',
                padding: '0 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePrintA4}
              disabled={summary.totalPacks === 0}
              style={{
                height: '38px',
                padding: '0 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                background: summary.totalPacks > 0 ? '#334155' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                cursor: summary.totalPacks > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: summary.totalPacks > 0 ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <FileText style={{ width: 14, height: 14 }} />
              Print A4 Sheet
            </button>

            <button
              type="button"
              onClick={handlePrintThermal}
              disabled={summary.totalPacks === 0}
              style={{
                height: '38px',
                padding: '0 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#ffffff',
                background: summary.totalPacks > 0 ? '#15803d' : '#86efac',
                border: 'none',
                borderRadius: '6px',
                cursor: summary.totalPacks > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: summary.totalPacks > 0 ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              <Printer style={{ width: 15, height: 15 }} />
              Print Thermal ({thermalWidth}mm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
