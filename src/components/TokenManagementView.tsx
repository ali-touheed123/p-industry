'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  Layers,
  Sliders,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  Info,
  ShieldCheck,
  Package,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { Brand, BrandSeries, CustomUnit, SeriesTokenConfig } from '@/types';

interface Props {
  tenantId: string;
  tenantName?: string;
}

export default function TokenManagementView({ tenantId }: Props) {
  // State: Brands
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [loadingBrands, setLoadingBrands] = useState(false);

  // State: Series
  const [seriesList, setSeriesList] = useState<BrandSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesSearch, setSeriesSearch] = useState('');
  const [loadingSeries, setLoadingSeries] = useState(false);

  // State: Custom Units
  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);
  const [showCustomUnitModal, setShowCustomUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [editingCustomUnit, setEditingCustomUnit] = useState<CustomUnit | null>(null);

  // State: Token Configs for selected series
  const [configs, setConfigs] = useState<{ [unit: string]: { is_enabled: boolean; token_value: number; is_drum_auto: boolean } }>({
    Gallon: { is_enabled: false, token_value: 0, is_drum_auto: false },
    Drum: { is_enabled: false, token_value: 0, is_drum_auto: true },
    Quarter: { is_enabled: false, token_value: 0, is_drum_auto: false },
  });
  const [savingConfigs, setSavingConfigs] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal State: Brand Creation / Edit
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandModalMode, setBrandModalMode] = useState<'create' | 'edit'>('create');
  const [brandForm, setBrandForm] = useState<{ id?: string; name: string; status: 'active' | 'inactive' }>({
    name: '',
    status: 'active',
  });
  const [brandModalError, setBrandModalError] = useState<string | null>(null);
  const [submittingBrand, setSubmittingBrand] = useState(false);

  // Modal State: Series Creation / Edit
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [seriesModalMode, setSeriesModalMode] = useState<'create' | 'edit'>('create');
  const [seriesForm, setSeriesForm] = useState<{ id?: string; name: string; status: 'active' | 'inactive' }>({
    name: '',
    status: 'active',
  });
  const [seriesModalError, setSeriesModalError] = useState<string | null>(null);
  const [submittingSeries, setSubmittingSeries] = useState(false);

  // Fetch Brands
  const fetchBrands = useCallback(async () => {
    if (!tenantId) return;
    setLoadingBrands(true);
    try {
      const res = await fetch(`/api/brands?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setBrands(data.brands || []);
        if (data.brands?.length > 0 && !selectedBrandId) {
          setSelectedBrandId(data.brands[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setLoadingBrands(false);
    }
  }, [tenantId, selectedBrandId]);

  // Fetch Custom Units
  const fetchCustomUnits = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/custom-units?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        setCustomUnits(data.units || []);
      }
    } catch (err) {
      console.error('Failed to fetch custom units:', err);
    }
  }, [tenantId]);

  // Fetch Series for selected Brand
  const fetchSeries = useCallback(async (brandId: string) => {
    if (!tenantId || !brandId) return;
    setLoadingSeries(true);
    try {
      const res = await fetch(`/api/brand-series?tenant_id=${tenantId}&brand_id=${brandId}`);
      const data = await res.json();
      if (data.success) {
        setSeriesList(data.series || []);
        if (data.series?.length > 0) {
          setSelectedSeriesId(data.series[0].id);
        } else {
          setSelectedSeriesId(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch series:', err);
    } finally {
      setLoadingSeries(false);
    }
  }, [tenantId]);

  // Initial Load
  useEffect(() => {
    fetchBrands();
    fetchCustomUnits();
  }, [fetchBrands, fetchCustomUnits]);

  // When selectedBrandId changes, fetch series
  useEffect(() => {
    if (selectedBrandId) {
      fetchSeries(selectedBrandId);
    } else {
      setSeriesList([]);
      setSelectedSeriesId(null);
    }
  }, [selectedBrandId, fetchSeries]);

  // Populate config state when selectedSeriesId changes
  useEffect(() => {
    if (!selectedSeriesId) return;
    const current = seriesList.find((s) => s.id === selectedSeriesId);
    if (!current) return;

    const newMap: { [unit: string]: { is_enabled: boolean; token_value: number; is_drum_auto: boolean } } = {
      Gallon: { is_enabled: false, token_value: 0, is_drum_auto: false },
      Drum: { is_enabled: false, token_value: 0, is_drum_auto: true },
      Quarter: { is_enabled: false, token_value: 0, is_drum_auto: false },
    };

    // Load custom units into map as disabled by default
    customUnits.forEach((u) => {
      newMap[u.name] = { is_enabled: false, token_value: 0, is_drum_auto: false };
    });

    if (current.series_token_configs) {
      current.series_token_configs.forEach((c: SeriesTokenConfig) => {
        newMap[c.unit_name] = {
          is_enabled: Boolean(c.is_enabled),
          token_value: Number(c.token_value) || 0,
          is_drum_auto: Boolean(c.is_drum_auto),
        };
      });
    }

    setConfigs(newMap);
    setSaveSuccessMsg(null);
  }, [selectedSeriesId, seriesList, customUnits]);

  // Active selected brand & series objects
  const selectedBrand = useMemo(() => brands.find((b) => b.id === selectedBrandId), [brands, selectedBrandId]);
  const selectedSeries = useMemo(() => seriesList.find((s) => s.id === selectedSeriesId), [seriesList, selectedSeriesId]);

  // Handle Gallon change with Drum auto-sync
  const handleGallonChange = (enabled: boolean, val: number) => {
    setConfigs((prev) => {
      const next = { ...prev };
      next['Gallon'] = {
        is_enabled: enabled,
        token_value: val,
        is_drum_auto: false,
      };

      // If Drum is auto-synced, update Drum's value to Gallon * 4
      if (next['Drum']?.is_drum_auto) {
        next['Drum'] = {
          ...next['Drum'],
          token_value: enabled ? val * 4 : next['Drum'].token_value,
        };
      }
      return next;
    });
  };

  // Handle Drum change
  const handleDrumChange = (enabled: boolean, val: number, isAuto: boolean) => {
    setConfigs((prev) => {
      const next = { ...prev };
      const gallonVal = next['Gallon']?.token_value || 0;
      const gallonEnabled = next['Gallon']?.is_enabled;

      let finalVal = val;
      let finalAuto = isAuto;

      if (!gallonEnabled) {
        finalAuto = false;
      }

      if (finalAuto && gallonEnabled) {
        finalVal = gallonVal * 4;
      }

      next['Drum'] = {
        is_enabled: enabled,
        token_value: finalVal,
        is_drum_auto: finalAuto,
      };
      return next;
    });
  };

  // Handle Generic Unit change
  const handleUnitChange = (unitName: string, enabled: boolean, val: number) => {
    setConfigs((prev) => ({
      ...prev,
      [unitName]: {
        is_enabled: enabled,
        token_value: Math.max(0, val),
        is_drum_auto: false,
      },
    }));
  };

  // Save Token Configuration
  const handleSaveConfigs = async () => {
    if (!selectedSeriesId) return;
    setSavingConfigs(true);
    setSaveSuccessMsg(null);

    const payload = Object.entries(configs).map(([unit_name, cfg]) => ({
      unit_name,
      is_enabled: cfg.is_enabled,
      token_value: cfg.token_value,
      is_drum_auto: cfg.is_drum_auto,
    }));

    try {
      const res = await fetch('/api/token-configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          series_id: selectedSeriesId,
          configs: payload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg('Token values updated successfully. Applies to future sales & redemptions.');
        if (selectedBrandId) {
          fetchSeries(selectedBrandId);
        }
      } else {
        alert(data.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving configuration');
    } finally {
      setSavingConfigs(false);
    }
  };

  // Brand Submit (Create / Edit)
  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandForm.name.trim()) {
      setBrandModalError('Brand name is required');
      return;
    }
    setSubmittingBrand(true);
    setBrandModalError(null);

    try {
      const url = '/api/brands';
      const method = brandModalMode === 'create' ? 'POST' : 'PATCH';
      const body =
        brandModalMode === 'create'
          ? { tenant_id: tenantId, name: brandForm.name, status: brandForm.status }
          : { id: brandForm.id, tenant_id: tenantId, name: brandForm.name, status: brandForm.status };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setBrandModalOpen(false);
        fetchBrands();
        if (brandModalMode === 'create' && data.brand) {
          setSelectedBrandId(data.brand.id);
        }
      } else {
        setBrandModalError(data.error || 'Failed to save brand');
      }
    } catch (err: any) {
      setBrandModalError(err.message || 'Error saving brand');
    } finally {
      setSubmittingBrand(false);
    }
  };

  // Series Submit (Create / Edit with A7 Rename Rule)
  const handleSeriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesForm.name.trim()) {
      setSeriesModalError('Series name is required');
      return;
    }
    if (!selectedBrandId) {
      setSeriesModalError('No brand selected');
      return;
    }

    setSubmittingSeries(true);
    setSeriesModalError(null);

    try {
      const url = '/api/brand-series';
      const method = seriesModalMode === 'create' ? 'POST' : 'PATCH';
      const body =
        seriesModalMode === 'create'
          ? { tenant_id: tenantId, brand_id: selectedBrandId, name: seriesForm.name, status: seriesForm.status }
          : { id: seriesForm.id, tenant_id: tenantId, name: seriesForm.name, status: seriesForm.status };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setSeriesModalOpen(false);
        await fetchSeries(selectedBrandId);
        if (data.series) {
          setSelectedSeriesId(data.series.id);
        }
      } else {
        setSeriesModalError(data.error || 'Failed to save series');
      }
    } catch (err: any) {
      setSeriesModalError(err.message || 'Error saving series');
    } finally {
      setSubmittingSeries(false);
    }
  };

  // Custom Unit Create / Rename
  const handleCustomUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;

    try {
      const url = '/api/custom-units';
      const method = editingCustomUnit ? 'PATCH' : 'POST';
      const body = editingCustomUnit
        ? { id: editingCustomUnit.id, tenant_id: tenantId, name: newUnitName.trim() }
        : { tenant_id: tenantId, name: newUnitName.trim() };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setNewUnitName('');
        setEditingCustomUnit(null);
        fetchCustomUnits();
      } else {
        alert(data.error || 'Failed to save custom unit');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving custom unit');
    }
  };

  // Filtered lists
  const filteredBrands = useMemo(() => {
    return brands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brands, brandSearch]);

  const filteredSeries = useMemo(() => {
    return seriesList.filter((s) => s.name.toLowerCase().includes(seriesSearch.toLowerCase()));
  }, [seriesList, seriesSearch]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Brand & Token Configuration
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define token rules per <span className="font-semibold text-amber-600 dark:text-amber-400">Brand + Series + Unit</span>. Products inherit values automatically without shade coupling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCustomUnitModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all font-medium text-sm flex items-center gap-2 shadow-sm"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            Manage Custom Units ({customUnits.length})
          </button>
        </div>
      </div>

      {/* 3-Column Layout: Brands | Series | Token Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Brands (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Brands</h2>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                {brands.length}
              </span>
            </div>
            <button
              onClick={() => {
                setBrandForm({ name: '', status: 'active' });
                setBrandModalMode('create');
                setBrandModalError(null);
                setBrandModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              title="Add New Brand"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Brand Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search brands..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Brands List */}
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {loadingBrands ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading brands...
              </div>
            ) : filteredBrands.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No brands found.</div>
            ) : (
              filteredBrands.map((b) => {
                const isSelected = b.id === selectedBrandId;
                const isInactive = b.status === 'inactive';
                const seriesCount = b.brand_series?.length || 0;

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBrandId(b.id)}
                    className={`group w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{b.name}</span>
                        {isInactive && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Inactive
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {seriesCount} {seriesCount === 1 ? 'series' : 'series'}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrandForm({ id: b.id, name: b.name, status: b.status });
                        setBrandModalMode('edit');
                        setBrandModalError(null);
                        setBrandModalOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                      title="Edit Brand"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Series under selected Brand (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Series ({selectedBrand?.name || 'Select Brand'})
              </h2>
            </div>
            {selectedBrandId && (
              <button
                onClick={() => {
                  setSeriesForm({ name: '', status: 'active' });
                  setSeriesModalMode('create');
                  setSeriesModalError(null);
                  setSeriesModalOpen(true);
                }}
                className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                title="Add Series to this Brand"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Series Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search series..."
              value={seriesSearch}
              onChange={(e) => setSeriesSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Series List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {loadingSeries ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading series...
              </div>
            ) : !selectedBrandId ? (
              <div className="py-8 text-center text-xs text-slate-400">Select a brand first</div>
            ) : filteredSeries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No series for this brand.</div>
            ) : (
              filteredSeries.map((s) => {
                const isSelected = s.id === selectedSeriesId;
                const isInactive = s.status === 'inactive';
                const enabledCount = s.series_token_configs?.filter((c) => c.is_enabled)?.length || 0;

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSeriesId(s.id)}
                    className={`group w-full text-left p-3.5 rounded-xl transition-all cursor-pointer border flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm'
                        : 'bg-transparent border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{s.name}</span>
                        {isInactive && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Inactive
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        {enabledCount > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {enabledCount} unit tokens active
                          </span>
                        ) : (
                          <span>No tokens enabled</span>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSeriesForm({ id: s.id, name: s.name, status: s.status });
                        setSeriesModalMode('edit');
                        setSeriesModalError(null);
                        setSeriesModalOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                      title="Edit / Rename Series"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Token Configurations for selected Series (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Unit Token Values</h2>
            </div>
            {selectedSeries && (
              <span className="text-xs text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {selectedBrand?.name} · {selectedSeries?.name}
              </span>
            )}
          </div>

          {!selectedSeries ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Select a Brand and Series to configure unit token values.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Informative Security Banner */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5 leading-relaxed">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                <div>
                  <span className="font-semibold">Historical Preservation Rule:</span> Changing token values updates
                  future POS checkouts and redemptions. Existing completed transactions permanently preserve their
                  original values.
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Units Editor List */}
              <div className="space-y-3">
                {/* 1. Gallon */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="unit-gallon"
                      checked={configs['Gallon']?.is_enabled || false}
                      onChange={(e) => handleGallonChange(e.target.checked, configs['Gallon']?.token_value || 0)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-500"
                    />
                    <div>
                      <label htmlFor="unit-gallon" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                        Gallon (4 Liters)
                      </label>
                      <p className="text-[11px] text-slate-400">Standard paint gallon</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!configs['Gallon']?.is_enabled}
                      value={configs['Gallon']?.token_value || 0}
                      onChange={(e) => handleGallonChange(configs['Gallon']?.is_enabled || false, Number(e.target.value))}
                      className="w-24 px-2.5 py-1.5 text-right font-mono text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>

                {/* 2. Drum */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="unit-drum"
                        checked={configs['Drum']?.is_enabled || false}
                        onChange={(e) =>
                          handleDrumChange(
                            e.target.checked,
                            configs['Drum']?.token_value || 0,
                            configs['Drum']?.is_drum_auto ?? true
                          )
                        }
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-500"
                      />
                      <div>
                        <label htmlFor="unit-drum" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                          Drum (16 Liters)
                        </label>
                        <p className="text-[11px] text-slate-400">Standard bucket/drum</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        disabled={!configs['Drum']?.is_enabled || configs['Drum']?.is_drum_auto}
                        value={configs['Drum']?.token_value || 0}
                        onChange={(e) =>
                          handleDrumChange(
                            configs['Drum']?.is_enabled || false,
                            Number(e.target.value),
                            false // manual override disables auto
                          )
                        }
                        className="w-24 px-2.5 py-1.5 text-right font-mono text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Drum 4x Auto-sync Toggle */}
                  {configs['Drum']?.is_enabled && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Package className="w-3.5 h-3.5 text-amber-500" />
                        <span>Drum default is 4× Gallon</span>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(configs['Drum']?.is_drum_auto)}
                          disabled={!configs['Gallon']?.is_enabled}
                          onChange={(e) =>
                            handleDrumChange(
                              configs['Drum']?.is_enabled || false,
                              configs['Drum']?.token_value || 0,
                              e.target.checked
                            )
                          }
                          className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-500"
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          Auto-sync (Gallon × 4)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 3. Quarter */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="unit-quarter"
                      checked={configs['Quarter']?.is_enabled || false}
                      onChange={(e) => handleUnitChange('Quarter', e.target.checked, configs['Quarter']?.token_value || 0)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-500"
                    />
                    <div>
                      <label htmlFor="unit-quarter" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                        Quarter (1 Liter)
                      </label>
                      <p className="text-[11px] text-slate-400">Small can/quarter</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!configs['Quarter']?.is_enabled}
                      value={configs['Quarter']?.token_value || 0}
                      onChange={(e) => handleUnitChange('Quarter', configs['Quarter']?.is_enabled || false, Number(e.target.value))}
                      className="w-24 px-2.5 py-1.5 text-right font-mono text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                    />
                  </div>
                </div>

                {/* 4. Custom Units configured */}
                {customUnits.map((u) => {
                  const unitName = u.name;
                  const cfg = configs[unitName] || { is_enabled: false, token_value: 0, is_drum_auto: false };

                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`unit-${u.id}`}
                          checked={cfg.is_enabled}
                          onChange={(e) => handleUnitChange(unitName, e.target.checked, cfg.token_value)}
                          className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-700 focus:ring-amber-500"
                        />
                        <div>
                          <label htmlFor={`unit-${u.id}`} className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                            {unitName}
                          </label>
                          <p className="text-[11px] text-slate-400">Custom unit</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Rs.</span>
                        <input
                          type="number"
                          min="0"
                          disabled={!cfg.is_enabled}
                          value={cfg.token_value}
                          onChange={(e) => handleUnitChange(unitName, cfg.is_enabled, Number(e.target.value))}
                          className="w-24 px-2.5 py-1.5 text-right font-mono text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  onClick={handleSaveConfigs}
                  disabled={savingConfigs}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {savingConfigs ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving Configuration...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save Token Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brand Modal */}
      {brandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {brandModalMode === 'create' ? 'Create New Paint Brand' : 'Edit Paint Brand'}
            </h3>

            {brandModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {brandModalError}
              </div>
            )}

            <form onSubmit={handleBrandSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master, Brighto, Berger"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Status
                </label>
                <select
                  value={brandForm.status}
                  onChange={(e) => setBrandForm({ ...brandForm, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">Active (Available for product creation)</option>
                  <option value="inactive">Inactive (Historical redemptions only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBrandModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBrand}
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow transition-all disabled:opacity-50"
                >
                  {submittingBrand ? 'Saving...' : 'Save Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Series Modal (With Invariant A7 Warning) */}
      {seriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {seriesModalMode === 'create' ? 'Create New Series' : 'Edit / Rename Series'}
            </h3>

            {seriesModalMode === 'edit' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Historical Safety Rule (A7):</span> Renaming a series automatically
                  deactivates the existing series and creates a new active series with fresh default token configuration.
                  Historical products and old physical tokens remain redeemable using the old inactive series configuration.
                </div>
              </div>
            )}

            {seriesModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {seriesModalError}
              </div>
            )}

            <form onSubmit={handleSeriesSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Series Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Super Emulsion, Weathercoat"
                  value={seriesForm.name}
                  onChange={(e) => setSeriesForm({ ...seriesForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Status
                </label>
                <select
                  value={seriesForm.status}
                  onChange={(e) => setSeriesForm({ ...seriesForm, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">Active (Available for product creation)</option>
                  <option value="inactive">Inactive (Historical redemptions only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSeriesModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSeries}
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow transition-all disabled:opacity-50"
                >
                  {submittingSeries ? 'Saving...' : seriesModalMode === 'edit' ? 'Apply & Deactivate Old' : 'Save Series'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Units Manager Modal */}
      {showCustomUnitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Custom Unit Manager</h3>
              </div>
              <button
                onClick={() => {
                  setShowCustomUnitModal(false);
                  setEditingCustomUnit(null);
                  setNewUnitName('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Custom units are globally reusable across all paint series under this branch (e.g. "Half Gallon", "Special Can"). Standard units (Gallon, Drum, Quarter) are built-in.
            </p>

            {/* Add / Edit Form */}
            <form onSubmit={handleCustomUnitSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder={editingCustomUnit ? `Rename "${editingCustomUnit.name}"...` : 'Enter new custom unit name...'}
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="flex-1 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-xl shadow transition-colors"
              >
                {editingCustomUnit ? 'Rename' : 'Add Unit'}
              </button>
              {editingCustomUnit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomUnit(null);
                    setNewUnitName('');
                  }}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs"
                >
                  Cancel
                </button>
              )}
            </form>

            {/* Existing Custom Units List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {customUnits.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">No custom units created yet.</div>
              ) : (
                customUnits.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                  >
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{u.name}</span>
                    <button
                      onClick={() => {
                        setEditingCustomUnit(u);
                        setNewUnitName(u.name);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                      title="Rename Unit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
