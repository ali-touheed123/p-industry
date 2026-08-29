'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Item } from '@/types';
import {
  Search,
  Plus,
  Boxes,
  CheckCircle2,
  Filter,
  Download,
  PackagePlus,
  Edit2,
  X,
} from 'lucide-react';

interface Props {
  items: Item[];
  tenantId?: string;
  tenantName?: string;
  onStockUpdated?: () => void;
}

const DEFAULT_CATEGORIES = [
  'Interior Emulsion',
  'Weather Shield Exterior',
  'Primers & Putty',
  'Synthetic Enamel',
  'Wood & Varnish',
  'Solvents & Thinners',
  'Accessories',
];

const DEFAULT_UNITS = [
  '20L Drum',
  '4L Gallon',
  '1L Quarter',
  '500ml Can',
  '20 KG Bag',
  'PCS',
  'Drum',
  'Gallon',
  'Quarter',
  'Bag',
];

export default function StockInventory({
  items,
  tenantId,
  tenantName = 'Main Godown & Retail Counter #1',
  onStockUpdated,
}: Props) {
  // Filters state (Matching painterp InventoryView.tsx)
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [stockStatus, setStockStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Item>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modals state
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Custom Categories & Units state (Dynamic additions)
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState<boolean>(false);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState<boolean>(false);
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [newUnitInput, setNewUnitInput] = useState<string>('');

  // Add / Edit Product Form State (Text-only shade name, no visual color swatch)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Interior Emulsion');
  const [formUnit, setFormUnit] = useState<string>('4L Gallon');

  const [formShadeCode, setFormShadeCode] = useState<string>('Off-White 101');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formRetailPrice, setFormRetailPrice] = useState<string>('');
  const [formStockQty, setFormStockQty] = useState<string>('20');
  const [formMinAlert, setFormMinAlert] = useState<string>('5');

  // Receive Stock Form State
  const [selectedProdForReceive, setSelectedProdForReceive] = useState<string>(items[0]?.id || '');
  const [receiveQty, setReceiveQty] = useState<number>(20);
  const [receiveBatchNo, setReceiveBatchNo] = useState<string>(
    () => `BATCH-${new Date().toISOString().slice(2, 7).replace('-', '')}-A9`
  );
  const [supplierBillRef, setSupplierBillRef] = useState<string>(
    () => `SUP-INV-${Math.floor(10000 + Math.random() * 90000)}`
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3200);
  };

  // Merge default + existing item categories + custom added categories
  const allCategories = useMemo(() => {
    const fromItems = items.map((i) => i.category).filter(Boolean) as string[];
    const set = new Set([...DEFAULT_CATEGORIES, ...fromItems, ...customCategories]);
    return Array.from(set);
  }, [items, customCategories]);

  // Merge default + existing item units + custom added units
  const allUnits = useMemo(() => {
    const fromItems = items.map((i) => i.pack_size || i.unit).filter(Boolean) as string[];
    const set = new Set([...DEFAULT_UNITS, ...fromItems, ...customUnits]);
    return Array.from(set);
  }, [items, customUnits]);



  // Inventory stats calculations (Matching painterp top row)
  const totalSKUs = items.length;
  const totalStockUnits = items.reduce((acc, p) => acc + (Number(p.stock_qty) || 0), 0);
  const lowStockCount = items.filter((p) => (p.stock_qty || 0) <= (p.min_stock_alert || 5)).length;
  const totalValuation = items.reduce(
    (acc, p) => acc + (Number(p.stock_qty) || 0) * (Number(p.cost_price) || 0),
    0
  );

  // Filter products
  const filteredProducts = items.filter((p) => {
    if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;

    const minAlert = p.min_stock_alert || 5;
    if (stockStatus === 'low_stock' && p.stock_qty > minAlert) return false;
    if (stockStatus === 'in_stock' && p.stock_qty <= minAlert) return false;
    if (stockStatus === 'out_of_stock' && p.stock_qty > 0) return false;

    if (tableSearch.trim() !== '') {
      const q = tableSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.shade_code && p.shade_code.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const valA = (a as any)[sortField];
    const valB = (b as any)[sortField];
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return 0;
  });

  const handleSort = (field: keyof Item) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Open modal for new product
  const handleOpenAddProduct = () => {
    setEditingItemId(null);
    setFormCode(`PNT-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormCategory(allCategories[0] || 'Interior Emulsion');
    setFormUnit(allUnits[0] || '4L Gallon');

    setFormShadeCode('Off-White 101');
    setFormCostPrice('');
    setFormRetailPrice('');
    setFormStockQty('20');
    setFormMinAlert('5');
    setIsAddingNewCategory(false);
    setIsAddingNewUnit(false);
    setShowAddProductModal(true);
  };

  // Open modal for editing existing product
  const handleOpenEditProduct = (item: Item) => {
    setEditingItemId(item.id);
    setFormCode(item.code);
    setFormName(item.name);
    setFormCategory(item.category || allCategories[0]);
    setFormUnit(item.pack_size || item.unit || allUnits[0]);

    setFormShadeCode(item.shade_code || 'Standard');
    setFormCostPrice(item.cost_price?.toString() || '');
    setFormRetailPrice(item.retail_price?.toString() || '');
    setFormStockQty(item.stock_qty?.toString() || '0');
    setFormMinAlert((item.min_stock_alert || 5).toString());
    setIsAddingNewCategory(false);
    setIsAddingNewUnit(false);
    setShowAddProductModal(true);
  };

  // Add custom new category handler
  const handleAddNewCategory = () => {
    if (!newCategoryInput.trim()) return;
    const cat = newCategoryInput.trim();
    if (!customCategories.includes(cat)) {
      setCustomCategories((prev) => [...prev, cat]);
    }
    setFormCategory(cat);
    setNewCategoryInput('');
    setIsAddingNewCategory(false);
    showToast(`Category "${cat}" added to system!`);
  };

  // Add custom new unit handler
  const handleAddNewUnit = () => {
    if (!newUnitInput.trim()) return;
    const unit = newUnitInput.trim();
    if (!customUnits.includes(unit)) {
      setCustomUnits((prev) => [...prev, unit]);
    }
    setFormUnit(unit);
    setNewUnitInput('');
    setIsAddingNewUnit(false);
    showToast(`Unit/Pack Size "${unit}" added to system!`);
  };

  // Save product to Supabase
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      alert('Product name and code are required');
      return;
    }
    if (!tenantId) {
      alert('Tenant ID missing');
      return;
    }

    const normalizedCode = formCode.trim().toUpperCase();

    // Check duplicate SKU / Product Code
    const duplicate = items.find(
      (it) => it.code?.trim().toUpperCase() === normalizedCode && it.id !== editingItemId
    );
    if (duplicate) {
      alert('A product with this code already exists.');
      return;
    }

    setSubmitting(true);
    const retail = Number(formRetailPrice) || 0;
    const cost = Number(formCostPrice) || Math.round(retail * 0.75);

    const payload = {
      tenant_id: tenantId,
      code: normalizedCode,
      name: formName.trim(),
      category: formCategory,
      unit: formUnit,
      pack_size: formUnit,

      shade_code: formShadeCode.trim() || 'Standard',
      cost_price: cost,
      retail_price: retail,
      stock_qty: Number(formStockQty) || 0,
      min_stock_alert: Number(formMinAlert) || 5,
    };

    try {
      if (editingItemId) {
        // Update existing item
        const res = await fetch('/api/items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItemId, ...payload }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Product "${formName}" updated successfully!`);
          setShowAddProductModal(false);
          onStockUpdated?.();
        } else {
          alert(`Failed to update: ${data.error}`);
        }
      } else {
        // Insert new item
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`New Product "${formName}" added to catalog!`);
          setShowAddProductModal(false);
          onStockUpdated?.();
        } else {
          alert(`Failed to create: ${data.error}`);
        }
      }
    } catch (err: any) {
      alert(`Network error saving product: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Inward Goods Receipt (GRN)
  const handleConfirmReceive = async () => {
    if (!selectedProdForReceive || receiveQty <= 0 || !tenantId) return;
    setSubmitting(true);

    const prod = items.find((i) => i.id === selectedProdForReceive);
    if (!prod) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/items/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          item_id: prod.id,
          qty: receiveQty,
          batch_no: receiveBatchNo.trim(),
          supplier_bill_ref: supplierBillRef.trim(),
          received_by: tenantName || 'Inventory Staff',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Received ${receiveQty} units of ${prod.name}! (${data.grn_no || 'GRN Saved'})`);
        setShowReceiveModal(false);
        onStockUpdated?.();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error receiving stock: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ['Code', 'Product Name', 'Category', 'Pack Size', 'Shade', 'Stock Qty', 'Retail Price'];
    const rows = items.map((i) => [
      i.code,
      `"${i.name.replace(/"/g, '""')}"`,
      i.category || 'General',
      i.pack_size || i.unit || 'Can',
      i.shade_code || 'Standard',
      i.stock_qty,
      i.retail_price,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PaintERP_Inventory_${tenantName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Inventory manifest exported to CSV!');
  };

  return (
    <section className="inv-screen" style={{ width: '100%', overflowX: 'hidden' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 60, background: '#0F172A', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: '#F97316' }} />
          {notification}
        </div>
      )}

      {/* Top Metric KPI Cards Row (Matching painterp) */}
      <div className="inv-kpi-grid">
        <div className="inv-kpi-card">
          <p className="inv-kpi-label">
            Total Catalog SKUs
          </p>
          <p className="inv-kpi-val">
            {totalSKUs}
          </p>
        </div>

        <div className="inv-kpi-card">
          <p className="inv-kpi-label">
            Units In Stock
          </p>
          <p className="inv-kpi-val">
            {totalStockUnits.toLocaleString()}
          </p>
        </div>

        <div className="inv-kpi-card">
          <p className="inv-kpi-label">
            Stock Valuation (Cost)
          </p>
          <p className="inv-kpi-val">
            Rs. {(totalValuation / 100000).toFixed(2)} Lac
          </p>
        </div>

        <div className="inv-kpi-card">
          <p className="inv-kpi-label">
            Low Stock Alerts
          </p>
          <p className="inv-kpi-val" style={{ color: lowStockCount > 0 ? '#DC2626' : '#16A34A' }}>
            {lowStockCount} Items
          </p>
        </div>
      </div>

      {/* Main Content Area: Left Filters Panel + Right Inventory Table */}
      <div className="inv-main-layout" style={{ width: '100%', overflowX: 'hidden' }}>
        {/* Left Filter Panel (Matching painterp) */}
        <aside className="inv-filter-sidebar no-scrollbar">
          <div>
            <h3 style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter style={{ width: 14, height: 14, color: '#F97316' }} />
              Filters &amp; Grouping
            </h3>



            {/* Stock Status Radio Buttons */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Stock Status
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#334155' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="stockStatus"
                    checked={stockStatus === 'all'}
                    onChange={() => setStockStatus('all')}
                    style={{ accentColor: '#F97316' }}
                  />
                  <span>All Statuses</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="stockStatus"
                    checked={stockStatus === 'in_stock'}
                    onChange={() => setStockStatus('in_stock')}
                    style={{ accentColor: '#F97316' }}
                  />
                  <span>Healthy Stock</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="stockStatus"
                    checked={stockStatus === 'low_stock'}
                    onChange={() => setStockStatus('low_stock')}
                    style={{ accentColor: '#F97316' }}
                  />
                  <span style={{ color: '#DC2626', fontWeight: 600 }}>
                    Low Stock ({lowStockCount})
                  </span>
                </label>
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'block' }}>
                  Categories
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewCategory(true);
                    setShowAddProductModal(true);
                  }}
                  style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#F97316', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  title="Add New Category"
                >
                  + New
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: '#334155' }}>
                {['All', ...allCategories].map((cat) => (
                  <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="categorySelection"
                      checked={selectedCategory === cat}
                      onChange={() => setSelectedCategory(cat)}
                      style={{ accentColor: '#F97316' }}
                    />
                    <span style={{ fontWeight: selectedCategory === cat ? 700 : 400, color: selectedCategory === cat ? '#F97316' : '#475569' }}>
                      {cat}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Table Container (Strictly fits without horizontal scroll) */}
        <div className="inv-table-card" style={{ width: '100%', minWidth: 0, overflowX: 'hidden' }}>
          {/* Action Row */}
          <div className="inv-action-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '420px', position: 'relative' }}>
              <Search style={{ width: 15, height: 15, color: '#94A3B8', position: 'absolute', left: '10px' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filter by SKU, product name, shade or category..."
                style={{ width: '100%', fontSize: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '7px 10px 7px 32px', color: '#0F172A', borderRadius: '8px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleExportCSV}
                className="inv-btn-secondary"
                title="Export stock manifest to CSV"
              >
                <Download style={{ width: 14, height: 14 }} />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedProdForReceive(items[0]?.id || '');
                  setShowReceiveModal(true);
                }}
                className="inv-btn-secondary"
                title="Audit stock count correction or damage adjustment"
              >
                <PackagePlus style={{ width: 14, height: 14, color: '#F97316' }} />
                Stock Adjustment
              </button>

              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="inv-btn-primary"
                title="Create a new paint product in catalog"
              >
                <Plus style={{ width: 15, height: 15 }} />
                Add Product
              </button>
            </div>
          </div>

          {/* Data Table – vertical scroll only */}
          <div className="inv-table-wrap">
            <table className="inv-data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '108px' }} />
                <col />
                <col style={{ width: '120px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '72px' }} />
                <col style={{ width: '52px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th onClick={() => handleSort('code')} style={{ cursor: 'pointer' }}>
                    Code {sortField === 'code' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    Product &amp; Shade {sortField === 'name' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th>Category</th>
                  <th>Pack Size</th>
                  <th onClick={() => handleSort('stock_qty')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                    Stock {sortField === 'stock_qty' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th style={{ textAlign: 'right' }}>Retail Price</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      No products found. Click &quot;+ Add Product&quot; above.
                    </td>
                  </tr>
                ) : (
                  sortedProducts.map((prod) => {
                    const minAlert = prod.min_stock_alert || 5;
                    const isCritical = prod.stock_qty <= minAlert;
                    return (
                      <tr key={prod.id}>
                        {/* Code */}
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.code}
                        </td>
                        {/* Product & Shade */}
                        <td style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod.name}</div>
                          {prod.shade_code && prod.shade_code !== '—' && (
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prod.shade_code}
                            </div>
                          )}
                        </td>
                        {/* Category */}
                        <td style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.category || 'General'}
                        </td>
                        {/* Pack Size */}
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prod.pack_size || prod.unit || 'Can'}
                        </td>
                        {/* Stock Qty */}
                        <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                          <span style={{ fontWeight: 700, color: isCritical ? '#DC2626' : '#0F172A' }}>
                            {prod.stock_qty}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block' }}>
                            Min: {minAlert}
                          </span>
                        </td>
                        {/* Retail Price only */}
                        <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                          <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '12px' }}>
                            Rs. {Number(prod.retail_price).toLocaleString()}
                          </span>
                        </td>
                        {/* Status */}
                        <td style={{ textAlign: 'center' }}>
                          {isCritical ? (
                            <span className="inv-badge-alert">Low</span>
                          ) : (
                            <span className="inv-badge-optimal">OK</span>
                          )}
                        </td>
                        {/* Action */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(prod)}
                            style={{ padding: '5px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                            title="Edit Product Details"
                          >
                            <Edit2 style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL 1: ADD / EDIT PRODUCT WITH DYNAMIC CATEGORY & UNIT (TEXT-ONLY SHADE) ── */}
      {showAddProductModal && (
        <div className="pos-modal-overlay">
          <div className="pos-modal-card" style={{ maxWidth: '620px' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes style={{ width: 16, height: 16, color: '#F97316' }} />
                <h3 style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#0F172A' }}>
                  {editingItemId ? 'Edit Product SKU' : 'Add New Paint Product SKU'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
              {/* Code & Name Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Product Code / SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. EM-INT-101"
                    className="pos-text-input"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Super Matt Plastic Emulsion (Base A)"
                    className="pos-text-input"
                    style={{ fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Dynamic Category Row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontWeight: 700, color: '#334155' }}>
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#F97316', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {isAddingNewCategory ? '← Choose Existing' : '+ Add New Category'}
                  </button>
                </div>

                {isAddingNewCategory ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      placeholder="Type new category (e.g. Epoxy Flooring, Auto Paints)..."
                      className="pos-text-input"
                      style={{ flex: 1, borderColor: '#F97316' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      style={{ padding: '0 14px', background: '#F97316', color: '#ffffff', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11.5px' }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingNewCategory(true);
                      } else {
                        setFormCategory(e.target.value);
                      }
                    }}
                    className="pos-text-input"
                    style={{ fontWeight: 500 }}
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add New Category...</option>
                  </select>
                )}
              </div>

              {/* Dynamic Unit / Pack Size Row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontWeight: 700, color: '#334155' }}>
                    Unit / Pack Size *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewUnit(!isAddingNewUnit)}
                    style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#F97316', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {isAddingNewUnit ? '← Choose Existing' : '+ Add New Unit / Size'}
                  </button>
                </div>

                {isAddingNewUnit ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={newUnitInput}
                      onChange={(e) => setNewUnitInput(e.target.value)}
                      placeholder="Type new pack size (e.g. 10L Bucket, 250ml Bottle)..."
                      className="pos-text-input"
                      style={{ flex: 1, borderColor: '#F97316' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewUnit}
                      style={{ padding: '0 14px', background: '#F97316', color: '#ffffff', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11.5px' }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    value={formUnit}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingNewUnit(true);
                      } else {
                        setFormUnit(e.target.value);
                      }
                    }}
                    className="pos-text-input"
                    style={{ fontWeight: 500 }}
                  >
                    {allUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add New Unit / Pack Size...</option>
                  </select>
                )}
              </div>

              {/* Shade / Color Name (Text-only, no visual picker) */}
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Paint Shade / Color Name (Optional)
                </label>
                <input
                  type="text"
                  value={formShadeCode}
                  onChange={(e) => setFormShadeCode(e.target.value)}
                  placeholder="e.g. Off-White 101, Ocean Blue, Signal Red, Matt Finish"
                  className="pos-text-input"
                  style={{ fontWeight: 500 }}
                />
              </div>



              {/* Price Matrix (Cost & Retail only, 2 columns) */}
              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Price Matrix (PKR)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', display: 'block', marginBottom: '2px' }}>Cost</label>
                    <input
                      type="number"
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="pos-text-input"
                      style={{ fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B', display: 'block', marginBottom: '2px' }}>Retail *</label>
                    <input
                      type="number"
                      required
                      value={formRetailPrice}
                      onChange={(e) => setFormRetailPrice(e.target.value)}
                      placeholder="0.00"
                      className="pos-text-input"
                      style={{ fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {/* Stock Qty & Low Alert with min="0" validation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Opening Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStockQty}
                    onChange={(e) => setFormStockQty(e.target.value)}
                    className="pos-text-input"
                    style={{ fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Min Stock Low Alert Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinAlert}
                    onChange={(e) => setFormMinAlert(e.target.value)}
                    className="pos-text-input"
                    style={{ fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#334155', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, padding: '10px', background: '#F97316', color: '#ffffff', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Plus style={{ width: 15, height: 15 }} />
                  {submitting ? 'Saving...' : editingItemId ? 'Update Product SKU' : 'Save New Product to DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: STOCK ADJUSTMENT (+ / -) ── */}
      {showReceiveModal && (
        <div className="pos-modal-overlay">
          <div className="pos-modal-card" style={{ maxWidth: '480px' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#0F172A' }}>
                  Stock Adjustment (+ / -)
                </h3>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}>
                  Physical Count / Damage / Audit Correction (Logged to Audit Trail)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: '#1E40AF', lineHeight: 1.4 }}>
                ℹ️ <strong>Note:</strong> Standard vendor stock must be entered via <strong>Purchases</strong>, and branch transfers via <strong>Branch Orders</strong>. Use this tool only for audit variances or damaged stock.
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Select SKU / Product:
                </label>
                <select
                  value={selectedProdForReceive}
                  onChange={(e) => setSelectedProdForReceive(e.target.value)}
                  className="pos-text-input"
                  style={{ fontWeight: 500 }}
                >
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name} ({p.pack_size || p.unit}) • Current Stock: {p.stock_qty}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Adjustment Qty (+):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(Number(e.target.value) || 1)}
                    className="pos-text-input"
                    style={{ fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Adjustment Reason:
                  </label>
                  <select
                    value={supplierBillRef}
                    onChange={(e) => setSupplierBillRef(e.target.value)}
                    className="pos-text-input"
                  >
                    <option value="Physical Audit Discrepancy">Physical Audit Discrepancy</option>
                    <option value="Damaged / Leaked Cans">Damaged / Leaked Cans</option>
                    <option value="Opening Stock Correction">Opening Stock Correction</option>
                    <option value="Sample / Tester Consumption">Sample / Tester Consumption</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Audit Batch Ref / Notes:
                </label>
                <input
                  type="text"
                  value={receiveBatchNo}
                  onChange={(e) => setReceiveBatchNo(e.target.value)}
                  placeholder="e.g. Audit Notes / Shelf 4 verification"
                  className="pos-text-input"
                />
              </div>
            </div>

            <div style={{ padding: '1rem', display: 'flex', gap: '8px', borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#334155', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmReceive}
                style={{ flex: 1, padding: '10px', background: '#F97316', color: '#ffffff', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                {submitting ? 'Saving Adjustment...' : 'Apply Stock Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}