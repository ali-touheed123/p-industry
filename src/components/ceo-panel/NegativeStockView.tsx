'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Branch } from '@/types/ceo';
import {
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Package,
  DollarSign,
  Hash,
} from 'lucide-react';

interface NegativeStockItem {
  id: string;
  code: string;
  name: string;
  brand?: string;
  category?: string;
  unit?: string;
  stock_qty: number;
  cost_price?: number;
  retail_price?: number;
}

interface NegativeStockViewProps {
  branch: Branch;
}

export const NegativeStockView: React.FC<NegativeStockViewProps> = ({ branch }) => {
  const [items, setItems] = useState<NegativeStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchNegativeStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/items?tenant_id=${branch.id}&stock_status=negative_stock&page_size=500`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch items');
      // Filter strictly < 0 (backend returns <= 0 for out_of_stock; we want only negative)
      const negative = (data.items || []).filter((it: NegativeStockItem) => it.stock_qty < 0);
      setItems(negative);
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [branch.id]);

  useEffect(() => {
    fetchNegativeStock();
  }, [fetchNegativeStock]);

  // Summary calculations
  const totalItems = items.length;
  const totalDeficit = items.reduce((acc, it) => acc + Math.abs(it.stock_qty), 0);
  const totalValuationLoss = items.reduce((acc, it) => {
    const cost = it.cost_price ?? 0;
    return acc + Math.abs(it.stock_qty) * cost;
  }, 0);

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    padding: '20px 24px',
  };

  const summaryCardStyle = (bg: string): React.CSSProperties => ({
    background: bg,
    borderRadius: 10,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Loading negative stock data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444', color: '#991b1b', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>Error loading data</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={22} color="#ef4444" />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
              Negative Stock Alert
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
              Branch: <strong>{branch.name}</strong>
              {lastFetched && (
                <span style={{ marginLeft: 8 }}>
                  · Last updated: {lastFetched.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={fetchNegativeStock}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151',
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div style={summaryCardStyle('#fef2f2')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
            <Package size={18} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Items in Deficit
            </span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', lineHeight: 1.2 }}>
            {totalItems}
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>products below zero</span>
        </div>

        <div style={summaryCardStyle('#fff7ed')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f97316' }}>
            <TrendingDown size={18} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Units Short
            </span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#ea580c', lineHeight: 1.2 }}>
            {totalDeficit.toLocaleString()}
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>units to recover</span>
        </div>

        <div style={summaryCardStyle('#fdf4ff')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a855f7' }}>
            <DollarSign size={18} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Valuation Deficit
            </span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#9333ea', lineHeight: 1.2 }}>
            Rs {totalValuationLoss.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>at cost price</span>
        </div>
      </div>

      {/* Table / Empty State */}
      {totalItems === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
          <Package size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#374151' }}>
            No Negative Stock
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>
            All items in <strong>{branch.name}</strong> have stock ≥ 0. Great job! ✅
          </p>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 120px 100px 80px 110px 130px',
            gap: 0,
            background: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            padding: '10px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: '#991b1b',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Hash size={11} /> Code</span>
            <span>Item Name</span>
            <span>Brand</span>
            <span>Category</span>
            <span>Unit</span>
            <span style={{ textAlign: 'right' }}>Stock Qty</span>
            <span style={{ textAlign: 'right' }}>Val. Deficit (Rs)</span>
          </div>

          {/* Table rows */}
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {items.map((item, idx) => {
              const deficit = Math.abs(item.stock_qty);
              const valuationLoss = deficit * (item.cost_price ?? 0);
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 120px 100px 80px 110px 130px',
                    gap: 0,
                    padding: '10px 16px',
                    borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                    background: idx % 2 === 0 ? '#fff' : '#fafafa',
                    fontSize: 13,
                    color: '#374151',
                    alignItems: 'center',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                    {item.code || '—'}
                  </span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{item.name}</span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{item.brand || '—'}</span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{item.category || '—'}</span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{item.unit || '—'}</span>
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: '#dc2626',
                    fontSize: 14,
                  }}>
                    {item.stock_qty}
                  </span>
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: valuationLoss > 0 ? '#7c3aed' : '#9ca3af',
                    fontSize: 13,
                  }}>
                    {valuationLoss > 0
                      ? `Rs ${valuationLoss.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid #f3f4f6',
            background: '#fafafa',
            fontSize: 12,
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <AlertTriangle size={12} color="#f59e0b" />
            Valuation deficit is calculated at cost price. Purchase an inward GRN to restore stock to zero.
          </div>
        </div>
      )}
    </div>
  );
};

export default NegativeStockView;

