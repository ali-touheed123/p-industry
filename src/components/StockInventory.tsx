'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Item } from '@/types';

interface Props {
  items: Item[];
  tenantId?: string;
  tenantName?: string;
  onStockUpdated?: () => void;
}

export default function StockInventory({
  items,
  tenantId,
  tenantName = 'Paint House',
  onStockUpdated,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  // Receive Stock Modal State
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveMode, setReceiveMode] = useState<'existing' | 'new'>('existing');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Existing Item Receiving State
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [receivedQty, setReceivedQty] = useState('10');
  const [receivedCost, setReceivedCost] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [biltyRef, setBiltyRef] = useState('');

  // New Item Creation State
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Emulsion');
  const [newItemUnit, setNewItemUnit] = useState('Can (4L)');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemRetail, setNewItemRetail] = useState('');
  const [newItemWholesale, setNewItemWholesale] = useState('');
  const [newItemTrade, setNewItemTrade] = useState('');
  const [newItemInitialStock, setNewItemInitialStock] = useState('20');
  const [newItemMinStock, setNewItemMinStock] = useState('5');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Set initial selected item for receiving
  useEffect(() => {
    if (items.length > 0 && !selectedExistingId) {
      setSelectedExistingId(items[0].id);
      setReceivedCost(items[0].cost_price?.toString() || '');
    }
  }, [items, selectedExistingId]);

  // Keyboard Shortcuts ([F2], [F3], [Escape])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setShowReceiveModal(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setShowReceiveModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories = Array.from(
    new Set(items.map(i => i.category).filter(Boolean))
  ) as string[];
  if (categories.length === 0) {
    categories.push('Emulsion', 'Enamel', 'Primer', 'Distemper', 'Solvent', 'Accessories');
  }

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
    setSelectedLocation('All Locations');
    setStockStatusFilter('all');
    setSearchQuery('');
  };

  const filteredItems = items.filter(it => {
    const matchesSearch =
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat =
      selectedCategories.length === 0 ||
      (it.category && selectedCategories.includes(it.category));

    const isOut = it.stock_qty <= 0;
    const isLow = !isOut && it.stock_qty <= (it.min_stock_alert ?? it.min_stock ?? 10);

    let matchesStock = true;
    if (stockStatusFilter === 'low') matchesStock = isLow;
    if (stockStatusFilter === 'out') matchesStock = isOut;

    return matchesSearch && matchesCat && matchesStock;
  });

  // Export to CSV Functionality
  const handleExportCSV = () => {
    if (items.length === 0) {
      alert('No items to export.');
      return;
    }

    const headers = [
      'Item Code',
      'Item Name',
      'Category',
      'Unit',
      'Current Stock',
      'Cost Price (PKR)',
      'Retail Price (PKR)',
      'Wholesale Price (PKR)',
      'Trade Price (PKR)',
    ];

    const rows = filteredItems.map(it => [
      `"${it.code}"`,
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.category || 'General'}"`,
      `"${it.unit}"`,
      it.stock_qty,
      it.cost_price || 0,
      it.retail_price,
      it.wholesale_price,
      it.trade_price,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Inventory_${tenantName.replace(/\s+/g, '_')}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Stock Inward
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (receiveMode === 'existing') {
        const itemObj = items.find(i => i.id === selectedExistingId);
        if (!itemObj) {
          setFormError('Please select a valid item');
          setSubmitting(false);
          return;
        }

        const qtyToAdd = parseFloat(receivedQty) || 0;
        const newTotalStock = (itemObj.stock_qty || 0) + qtyToAdd;

        const res = await fetch('/api/items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: itemObj.id,
            stock_qty: newTotalStock,
            cost_price: receivedCost ? parseFloat(receivedCost) : itemObj.cost_price,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setShowReceiveModal(false);
          setReceivedQty('10');
          setSupplierName('');
          setBiltyRef('');
          if (onStockUpdated) onStockUpdated();
        } else {
          setFormError(data.error || 'Failed to update stock');
        }
      } else {
        // Create brand new item
        if (!tenantId || !newItemName || !newItemCode) {
          setFormError('Tenant ID, Item Code and Name are required');
          setSubmitting(false);
          return;
        }

        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            code: newItemCode,
            name: newItemName,
            category: newItemCategory,
            unit: newItemUnit,
            cost_price: parseFloat(newItemCost) || 0,
            retail_price: parseFloat(newItemRetail) || 0,
            wholesale_price: parseFloat(newItemWholesale) || 0,
            trade_price: parseFloat(newItemTrade) || 0,
            stock_qty: parseFloat(newItemInitialStock) || 0,
            min_stock_alert: parseFloat(newItemMinStock) || 5,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setShowReceiveModal(false);
          setNewItemCode('');
          setNewItemName('');
          setNewItemCost('');
          setNewItemRetail('');
          setNewItemWholesale('');
          setNewItemTrade('');
          if (onStockUpdated) onStockUpdated();
        } else {
          setFormError(data.error || 'Failed to create item');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error while receiving stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top Action Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Stock Management</h1>
          <p className="page-subtitle">Warehouse inventory, multi-godown allocation &amp; 3-tier price matrices</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportCSV} className="btn btn-secondary-outline" title="Download Excel/CSV sheet">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export List
          </button>
          <button onClick={() => setShowReceiveModal(true)} className="btn btn-primary" title="Inward Stock (F2)">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_box</span>
            Receive Stock (F2)
          </button>
        </div>
      </div>

      {/* ── Main Layout: Filter Sidebar + Inventory Table ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Filter Panel */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tune</span>
              Filters
            </h3>
            <button
              onClick={handleClearFilters}
              style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>

          {/* Category Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.75rem' }}>Category</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categories.map(cat => (
                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--on-surface)' }}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat)}
                    onChange={() => handleCategoryToggle(cat)}
                    style={{ accentColor: 'var(--secondary)', width: 15, height: 15 }}
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Godown Location */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Godown Location</label>
            <select
              className="form-select"
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
            >
              <option value="All Locations">All Locations</option>
              <option value="Main Hub">Main Hub (Central)</option>
              <option value="North Wing">North Wing Godown</option>
              <option value="South Yard">South Yard Storage</option>
            </select>
          </div>

          {/* Stock Status */}
          <div>
            <label className="form-label" style={{ marginBottom: '0.75rem' }}>Stock Status</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="stockStatus"
                  checked={stockStatusFilter === 'all'}
                  onChange={() => setStockStatusFilter('all')}
                  style={{ accentColor: 'var(--secondary)' }}
                />
                <span>All Stock</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="stockStatus"
                  checked={stockStatusFilter === 'out'}
                  onChange={() => setStockStatusFilter('out')}
                  style={{ accentColor: 'var(--secondary)' }}
                />
                <span style={{ color: 'var(--error)' }}>Out of Stock</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="stockStatus"
                  checked={stockStatusFilter === 'low'}
                  onChange={() => setStockStatusFilter('low')}
                  style={{ accentColor: 'var(--secondary)' }}
                />
                <span style={{ color: '#b45309' }}>Low Stock Alert</span>
              </label>
            </div>
          </div>
        </div>

        {/* Data Table Panel */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
              Showing <strong style={{ color: 'var(--on-surface)' }}>{filteredItems.length}</strong> items
            </div>
            <div style={{ width: '280px', position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--on-surface-variant)' }}>search</span>
              <input
                ref={searchInputRef}
                type="text"
                className="form-input"
                placeholder="Search item code or name (F3)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem', height: '34px' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Item Code</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Stock (Unit)</th>
                  <th className="text-right">Retail (PKR)</th>
                  <th className="text-right">W.Sale (PKR)</th>
                  <th className="text-right">Trade (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => {
                  const isOut = it.stock_qty <= 0;
                  const isLow = !isOut && it.stock_qty <= (it.min_stock_alert ?? it.min_stock ?? 10);
                  return (
                    <tr key={it.id}>
                      <td className="font-mono text-blue font-bold" style={{ fontSize: '12px' }}>
                        {it.code}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: isOut ? 'var(--error)' : 'inherit' }}>
                          {it.name}
                        </div>
                      </td>
                      <td className="text-muted">{it.category || 'General'}</td>
                      <td className="text-muted">Main Hub</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isOut && <span className="badge badge-out">OUT</span>}
                          {isLow && <span className="badge badge-low">LOW</span>}
                          <span className="font-mono" style={{ fontWeight: 700, color: isOut ? 'var(--error)' : 'inherit' }}>
                            {it.stock_qty} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--on-surface-variant)' }}>{it.unit}</span>
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                        {it.retail_price.toLocaleString()}
                      </td>
                      <td className="text-right font-mono text-muted">
                        {it.wholesale_price.toLocaleString()}
                      </td>
                      <td className="text-right font-mono text-muted">
                        {it.trade_price.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)' }}>
                      No inventory matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Receive Stock Modal (F2) ── */}
      {showReceiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: 24, color: 'var(--secondary)' }}>inventory</span>
                <h3 className="headline-sm">Receive Stock / Inward Shipment (F2)</h3>
              </div>
              <button onClick={() => setShowReceiveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: 'flex', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setReceiveMode('existing')}
                className={`role-tab ${receiveMode === 'existing' ? 'active' : ''}`}
              >
                Inward Existing Product
              </button>
              <button
                type="button"
                onClick={() => setReceiveMode('new')}
                className={`role-tab ${receiveMode === 'new' ? 'active' : ''}`}
              >
                + Add New Paint Formulation
              </button>
            </div>

            {formError && (
              <div style={{ background: 'var(--error-container)', border: '1px solid rgba(186,26,26,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '13px', color: 'var(--on-error-container)', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleReceiveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {receiveMode === 'existing' ? (
                <>
                  <div>
                    <label className="form-label">Select Paint Product *</label>
                    <select
                      className="form-select"
                      value={selectedExistingId}
                      onChange={e => {
                        setSelectedExistingId(e.target.value);
                        const it = items.find(i => i.id === e.target.value);
                        if (it) setReceivedCost(it.cost_price?.toString() || '');
                      }}
                      required
                    >
                      {items.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.code} — {it.name} (Current Stock: {it.stock_qty} {it.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Quantity to Add (Units) *</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        className="form-input"
                        value={receivedQty}
                        onChange={e => setReceivedQty(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Purchase / Cost Price (PKR)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Cost per unit"
                        value={receivedCost}
                        onChange={e => setReceivedCost(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Supplier / Factory Vendor</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Master Paints / Berger"
                        value={supplierName}
                        onChange={e => setSupplierName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Bilty / Inward Challan No</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. BL-7821"
                        value={biltyRef}
                        onChange={e => setBiltyRef(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Item SKU / Code *</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. EM-109"
                        value={newItemCode}
                        onChange={e => setNewItemCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="form-label">Product Name *</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Matt Finish Super Emulsion"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Category</label>
                      <select
                        className="form-select"
                        value={newItemCategory}
                        onChange={e => setNewItemCategory(e.target.value)}
                      >
                        <option value="Emulsion">Interior Emulsion</option>
                        <option value="Weather Shield">Weather Shield Exterior</option>
                        <option value="Enamel">High Gloss Enamel</option>
                        <option value="Primer">Wall Primer &amp; Sealer</option>
                        <option value="Putty">Wall Putty</option>
                        <option value="Solvent">Thinner &amp; Solvent</option>
                        <option value="Accessories">Rollers &amp; Brushes</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Packaging Unit</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Drum (16L), Can (4L), Gallon"
                        value={newItemUnit}
                        onChange={e => setNewItemUnit(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label">Cost (Rs)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Cost"
                        value={newItemCost}
                        onChange={e => setNewItemCost(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Retail (Rs)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Retail"
                        value={newItemRetail}
                        onChange={e => setNewItemRetail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">W.Sale (Rs)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Wholesale"
                        value={newItemWholesale}
                        onChange={e => setNewItemWholesale(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Trade (Rs)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Trade"
                        value={newItemTrade}
                        onChange={e => setNewItemTrade(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Initial Stock Qty</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newItemInitialStock}
                        onChange={e => setNewItemInitialStock(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Low Stock Alert Level</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newItemMinStock}
                        onChange={e => setNewItemMinStock(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="btn btn-secondary-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Saving...' : 'Confirm Stock Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}