'use client';

import StockAdjustmentGrid from './StockAdjustmentGrid';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Minus,
  RefreshCw,
  Sparkles,
  Trash2,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Check,
  ArrowRight,
  FileSpreadsheet,
  Printer,
  ClipboardList,
} from 'lucide-react';
import AiInvoiceScan from './AiInvoiceScan';
import CompanyOrderSheetModal from './inventory/CompanyOrderSheetModal';
import { exportToXlsx } from '@/utils/excelExporter';
import { printViaIframe } from '@/utils/iframePrint';
import {
  getBulkDraft,
  setBulkDraft,
  clearBulkDraft,
  hasBulkDraft,
} from '@/lib/bulkDraftStore';

interface BrandOption { id: string; name: string; }
interface SeriesOption { id: string; name: string; brand_id: string; }
interface TokenConfigOption { unit_name: string; is_enabled: boolean; token_value: number; }

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
  tenantName = 'PyntFlow Store',
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
  const [showAiScanModal, setShowAiScanModal] = useState<boolean>(false);
  const [showOrderSheetModal, setShowOrderSheetModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // ── Brand / Series catalog (loaded once) ─────────────────────────────────
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [allSeries, setAllSeries] = useState<SeriesOption[]>([]);
  const [seriesConfigs, setSeriesConfigs] = useState<Record<string, TokenConfigOption[]>>({});

  const fetchBrandsAndSeries = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [bRes, sRes, cRes, uRes] = await Promise.all([
        fetch(`/api/brands?tenant_id=${tenantId}`),
        fetch(`/api/brand-series?tenant_id=${tenantId}`),
        fetch(`/api/token-configs?tenant_id=${tenantId}`),
        fetch(`/api/custom-units?tenant_id=${tenantId}`),
      ]);
      const [bData, sData, cData, uData] = await Promise.all([bRes.json(), sRes.json(), cRes.json(), uRes.json()]);
      if (bData.success) setBrands(bData.brands || []);
      if (sData.success) {
        const activeSeries = (sData.series || []).filter((s: any) => s.is_active !== false);
        setAllSeries(activeSeries);
      }
      if (cData.success) {
        const configMap: Record<string, TokenConfigOption[]> = {};
        for (const cfg of (cData.configs || [])) {
          if (!configMap[cfg.series_id]) configMap[cfg.series_id] = [];
          configMap[cfg.series_id].push({ unit_name: cfg.unit_name, is_enabled: cfg.is_enabled, token_value: Number(cfg.token_value) });
        }
        setSeriesConfigs(configMap);
      }
      if (uData.success && Array.isArray(uData.units)) {
        setCustomUnits(uData.units.map((u: any) => u.name));
      }
    } catch { /* silent */ }
  }, [tenantId]);

  useEffect(() => { fetchBrandsAndSeries(); }, [fetchBrandsAndSeries]);

  // Lookup maps for fast O(1) resolution across search and price editor
  const brandsMap = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const seriesMap = useMemo(() => new Map(allSeries.map((s) => [s.id, s.name])), [allSeries]);

  // Helper: match item unit string to config unit string safely without accidental fuzzy collisions
  const matchUnitToConfig = (itemUnitRaw: string, configUnitRaw: string): boolean => {
    if (!itemUnitRaw || !configUnitRaw) return false;
    const u = itemUnitRaw.trim().toLowerCase();
    const cu = configUnitRaw.trim().toLowerCase();
    if (u === cu) return true;

    const normU = u.replace(/[^a-z0-9]/g, '');
    const normCU = cu.replace(/[^a-z0-9]/g, '');
    if (normU === normCU && normU.length > 0) return true;

    const isDrum = (s: string) => /\bdrums?\b/i.test(s) || /^(20\s*(l|ltr|liters?|litres?))$/i.test(s.trim());
    const isGallon = (s: string) => /\bgallons?\b/i.test(s) || /^(4\s*(l|ltr|liters?|litres?))$/i.test(s.trim());
    const isQuarter = (s: string) => /\bquarters?\b/i.test(s) || /^(1\s*(l|ltr|liters?|litres?))$/i.test(s.trim());

    if (isDrum(cu) && isDrum(u)) return true;
    if (isGallon(cu) && isGallon(u)) return true;
    if (isQuarter(cu) && isQuarter(u)) return true;

    return false;
  };

  // Resolve inherited token from series + unit
  const resolveInheritedToken = useCallback((seriesId: string | null, unit: string): { has_token: boolean; token_value: number } => {
    if (!seriesId || !seriesConfigs[seriesId]) return { has_token: false, token_value: 0 };
    const matched = seriesConfigs[seriesId].find(c => matchUnitToConfig(unit, c.unit_name));
    if (matched && matched.is_enabled && matched.token_value > 0) {
      return { has_token: true, token_value: matched.token_value };
    }
    return { has_token: false, token_value: 0 };
  }, [seriesConfigs]);

  // ── Single Product Form — brand/series state ──────────────────────────────
  const [formBrandId, setFormBrandId] = useState<string>('');
  const [formSeriesId, setFormSeriesId] = useState<string>('');

  // ── Bulk Add Modal State ───────────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkBrand, setBulkBrand] = useState<string>('');
  const [bulkBrandId, setBulkBrandId] = useState<string>('');
  const [bulkSeriesId, setBulkSeriesId] = useState<string>('');
  const [bulkCategory, setBulkCategory] = useState<string>('Interior Emulsion');
  const [bulkUnit, setBulkUnit] = useState<string>('4L Gallon');
  const [bulkCostPrice, setBulkCostPrice] = useState<string>('0');
  const [bulkRetailPrice, setBulkRetailPrice] = useState<string>('0');
  const [bulkMinAlert, setBulkMinAlert] = useState<string>('5');
  interface BulkRow {
    id: number;
    shadeName: string;
    code: string;
    retail: string;
    cost: string;
    qty: string;
    retailOverridden?: boolean;
    costOverridden?: boolean;
  }
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { id: 1, shadeName: '', code: '', retail: '0', cost: '0', qty: '0', retailOverridden: false, costOverridden: false },
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);
  const [bulkErrors, setBulkErrors] = useState<{ row: number; code: string; error: string }[]>([]);
  const [bulkSavedCount, setBulkSavedCount] = useState<number | null>(null);
  const bulkNextId = React.useRef<number>(2);
  const isSpawningRowRef = React.useRef<boolean>(false);
  const [hasActiveDraft, setHasActiveDraft] = useState<boolean>(() => hasBulkDraft(tenantId));

  useEffect(() => {
    setHasActiveDraft(hasBulkDraft(tenantId));
  }, [tenantId]);

  // Common Fields Keyboard Navigation Element Refs
  const commonBrandSelectRef = useRef<HTMLSelectElement>(null);
  const commonBrandInputRef = useRef<HTMLInputElement>(null);
  const commonSeriesRef = useRef<HTMLSelectElement>(null);
  const commonCategoryRef = useRef<HTMLSelectElement>(null);
  const commonUnitRef = useRef<HTMLSelectElement>(null);
  const commonCostRef = useRef<HTMLInputElement>(null);
  const commonRetailRef = useRef<HTMLInputElement>(null);
  const commonMinAlertRef = useRef<HTMLInputElement>(null);

  // Derived: series filtered by selected brand
  const formSeriesOptions = useMemo(() => allSeries.filter(s => !formBrandId || s.brand_id === formBrandId), [allSeries, formBrandId]);
  const bulkSeriesOptions = useMemo(() => allSeries.filter(s => !bulkBrandId || s.brand_id === bulkBrandId), [allSeries, bulkBrandId]);
  // Note: formInheritedToken and bulkInheritedToken are declared after formUnit/bulkUnit state below

  // Manual live refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onStockUpdated) {
        await onStockUpdated();
      }
      showToast('Live stock updated from database!');
    } catch {
      showToast('Failed to refresh stock');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Custom Categories & Units state (Dynamic additions)
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState<boolean>(false);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState<boolean>(false);
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [newUnitInput, setNewUnitInput] = useState<string>('');

  // Add / Edit Product Form State (Text-only shade name, no visual color swatch)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Interior Emulsion');
  const [formUnit, setFormUnit] = useState<string>('4L Gallon');

  const [formShadeCode, setFormShadeCode] = useState<string>('Off-White 101');
  const [formBrand, setFormBrand] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formRetailPrice, setFormRetailPrice] = useState<string>('');
  const [formStockQty, setFormStockQty] = useState<string>('20');
  const [formMinAlert, setFormMinAlert] = useState<string>('5');

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

  // Derived: inherited token info for current form state (after formUnit/bulkUnit are declared)
  const formInheritedToken = useMemo(() => resolveInheritedToken(formSeriesId || null, formUnit), [resolveInheritedToken, formSeriesId, formUnit]);
  const bulkInheritedToken = useMemo(() => resolveInheritedToken(bulkSeriesId || null, bulkUnit), [resolveInheritedToken, bulkSeriesId, bulkUnit]);



  // ── MODAL: BULK PRICE EDITOR STATE & CRITERIA ─────────────────────────────
  interface BulkPriceRowState {
    item: Item;
    costInput: string;
    retailInput: string;
    isCostOverride: boolean;
    isRetailOverride: boolean;
    expectedCost: number;
    expectedRetail: number;
    status: 'idle' | 'conflict' | 'error' | 'success';
    errorMessage?: string;
    failureType?: 'INVALID_FORMAT' | 'UPDATE_DATABASE_ERROR' | 'VERIFICATION_READ_ERROR' | 'DELETED_OR_INACCESSIBLE' | 'STALE_PRICE_CONFLICT' | 'UNRESOLVED_UPDATE_FAILURE';
    conflictedFields?: Array<'cost' | 'retail'>;
    currentPrices?: { cost_price: number; retail_price: number };
  }

  const [showBulkPriceModal, setShowBulkPriceModal] = useState<boolean>(false);
  const [showPriceReviewModal, setShowPriceReviewModal] = useState<boolean>(false);
  const [priceFilterBrandId, setPriceFilterBrandId] = useState<string>('ALL');
  const [priceFilterSeriesId, setPriceFilterSeriesId] = useState<string>('ALL');
  const [priceFilterCategory, setPriceFilterCategory] = useState<string>('ALL');
  const [priceFilterUnit, setPriceFilterUnit] = useState<string>('ALL');
  const [commonCostInput, setCommonCostInput] = useState<string>('');
  const [commonRetailInput, setCommonRetailInput] = useState<string>('');
  const [bulkPriceSubmitting, setBulkPriceSubmitting] = useState<boolean>(false);
  const [bulkPriceError, setBulkPriceError] = useState<string | null>(null);
  const [bulkPriceRows, setBulkPriceRows] = useState<BulkPriceRowState[]>([]);

  // Dependent Series options
  const priceFilterSeriesOptions = useMemo(() => {
    if (priceFilterBrandId === 'ALL') {
      return allSeries;
    }
    return allSeries.filter((s) => s.brand_id === priceFilterBrandId);
  }, [allSeries, priceFilterBrandId]);

  // Dependent Category options
  const priceFilterCategoryOptions = useMemo(() => {
    const brandName = priceFilterBrandId !== 'ALL' ? brandsMap.get(priceFilterBrandId) : null;
    const matching = items.filter((p) => {
      if (priceFilterBrandId !== 'ALL') {
        const matchesBrand = p.brand_id === priceFilterBrandId || (brandName && p.brand === brandName);
        if (!matchesBrand) return false;
      }
      if (priceFilterSeriesId !== 'ALL') {
        if (p.series_id !== priceFilterSeriesId) return false;
      }
      return true;
    });
    const cats = new Set(matching.map((p) => p.category).filter(Boolean) as string[]);
    return Array.from(cats);
  }, [items, priceFilterBrandId, priceFilterSeriesId, brandsMap]);

  // Dependent Unit options
  const priceFilterUnitOptions = useMemo(() => {
    const brandName = priceFilterBrandId !== 'ALL' ? brandsMap.get(priceFilterBrandId) : null;
    const matching = items.filter((p) => {
      if (priceFilterBrandId !== 'ALL') {
        const matchesBrand = p.brand_id === priceFilterBrandId || (brandName && p.brand === brandName);
        if (!matchesBrand) return false;
      }
      if (priceFilterSeriesId !== 'ALL') {
        if (p.series_id !== priceFilterSeriesId) return false;
      }
      if (priceFilterCategory !== 'ALL') {
        if (p.category !== priceFilterCategory) return false;
      }
      return true;
    });
    const units = new Set(matching.map((p) => p.pack_size || p.unit).filter(Boolean) as string[]);
    return Array.from(units);
  }, [items, priceFilterBrandId, priceFilterSeriesId, priceFilterCategory, brandsMap]);

  // Matched products based on dependent criteria
  const matchedPriceItems = useMemo(() => {
    const brandName = priceFilterBrandId !== 'ALL' ? brandsMap.get(priceFilterBrandId) : null;
    return items.filter((p) => {
      if (priceFilterBrandId !== 'ALL') {
        const matchesBrand = p.brand_id === priceFilterBrandId || (brandName && p.brand === brandName);
        if (!matchesBrand) return false;
      }
      if (priceFilterSeriesId !== 'ALL') {
        if (p.series_id !== priceFilterSeriesId) return false;
      }
      if (priceFilterCategory !== 'ALL') {
        if (p.category !== priceFilterCategory) return false;
      }
      if (priceFilterUnit !== 'ALL') {
        const matchesUnit = p.unit === priceFilterUnit || p.pack_size === priceFilterUnit;
        if (!matchesUnit) return false;
      }
      return true;
    });
  }, [items, priceFilterBrandId, priceFilterSeriesId, priceFilterCategory, priceFilterUnit, brandsMap]);

  // Synchronize matching products to bulkPriceRows, preserving existing edits and statuses
  useEffect(() => {
    if (!showBulkPriceModal) return;
    setBulkPriceRows((prevRows) => {
      const prevMap = new Map(prevRows.map((r) => [r.item.id, r]));
      return matchedPriceItems.map((item) => {
        const existing = prevMap.get(item.id);
        if (existing) {
          return {
            ...existing,
            item,
          };
        }
        return {
          item,
          costInput: commonCostInput.trim() !== '' ? commonCostInput.trim() : (item.cost_price ? String(item.cost_price) : ''),
          retailInput: commonRetailInput.trim() !== '' ? commonRetailInput.trim() : (item.retail_price ? String(item.retail_price) : ''),
          isCostOverride: false,
          isRetailOverride: false,
          expectedCost: Number(item.cost_price) || 0,
          expectedRetail: Number(item.retail_price) || 0,
          status: 'idle',
        };
      });
    });
  }, [showBulkPriceModal, matchedPriceItems]);

  const handlePriceBrandChange = (newBrandId: string) => {
    setPriceFilterBrandId(newBrandId);
    setPriceFilterSeriesId('ALL');
    setPriceFilterCategory('ALL');
    setPriceFilterUnit('ALL');
  };

  const handlePriceSeriesChange = (newSeriesId: string) => {
    setPriceFilterSeriesId(newSeriesId);
    setPriceFilterCategory('ALL');
    setPriceFilterUnit('ALL');
  };

  const handlePriceCategoryChange = (newCat: string) => {
    setPriceFilterCategory(newCat);
    setPriceFilterUnit('ALL');
  };

  const handleApplyCommonPrices = () => {
    const trimmedCost = commonCostInput.trim();
    const trimmedRetail = commonRetailInput.trim();

    setBulkPriceRows((prev) =>
      prev.map((row) => {
        let updatedCost = row.costInput;
        let updatedRetail = row.retailInput;

        if (trimmedCost !== '' && !row.isCostOverride) {
          updatedCost = trimmedCost;
        }
        if (trimmedRetail !== '' && !row.isRetailOverride) {
          updatedRetail = trimmedRetail;
        }

        return {
          ...row,
          costInput: updatedCost,
          retailInput: updatedRetail,
          status: 'idle',
        };
      })
    );
  };

  const handleResetAllOverrides = () => {
    setBulkPriceRows((prev) =>
      prev.map((row) => ({
        ...row,
        costInput: commonCostInput.trim() !== '' ? commonCostInput.trim() : (row.item.cost_price ? String(row.item.cost_price) : ''),
        retailInput: commonRetailInput.trim() !== '' ? commonRetailInput.trim() : (row.item.retail_price ? String(row.item.retail_price) : ''),
        isCostOverride: false,
        isRetailOverride: false,
        status: 'idle',
      }))
    );
  };

  const handleResetRowToCommon = (itemId: string) => {
    setBulkPriceRows((prev) =>
      prev.map((row) => {
        if (row.item.id !== itemId) return row;
        return {
          ...row,
          costInput: commonCostInput.trim() !== '' ? commonCostInput.trim() : (row.item.cost_price ? String(row.item.cost_price) : ''),
          retailInput: commonRetailInput.trim() !== '' ? commonRetailInput.trim() : (row.item.retail_price ? String(row.item.retail_price) : ''),
          isCostOverride: false,
          isRetailOverride: false,
          status: 'idle',
          errorMessage: undefined,
          failureType: undefined,
          conflictedFields: undefined,
          currentPrices: undefined,
        };
      })
    );
  };

  const handleRowCostChange = (itemId: string, val: string) => {
    setBulkPriceRows((prev) =>
      prev.map((row) => {
        if (row.item.id !== itemId) return row;
        return {
          ...row,
          costInput: val,
          isCostOverride: true,
          status: 'idle',
        };
      })
    );
  };

  const handleRowRetailChange = (itemId: string, val: string) => {
    setBulkPriceRows((prev) =>
      prev.map((row) => {
        if (row.item.id !== itemId) return row;
        return {
          ...row,
          retailInput: val,
          isRetailOverride: true,
          status: 'idle',
        };
      })
    );
  };

  const handleAcceptConflictPrice = (itemId: string) => {
    setBulkPriceRows((prev) =>
      prev.map((row) => {
        if (row.item.id !== itemId || !row.currentPrices) return row;
        return {
          ...row,
          expectedCost: row.currentPrices.cost_price,
          expectedRetail: row.currentPrices.retail_price,
          costInput: String(row.currentPrices.cost_price),
          retailInput: String(row.currentPrices.retail_price),
          isCostOverride: false,
          isRetailOverride: false,
          status: 'idle',
          errorMessage: undefined,
          failureType: undefined,
          conflictedFields: undefined,
          currentPrices: undefined,
        };
      })
    );
  };

  const handleForceProposedPrice = (itemId: string) => {
    setBulkPriceRows((prev) =>
      prev.map((row) => {
        if (row.item.id !== itemId || !row.currentPrices) return row;
        return {
          ...row,
          expectedCost: row.currentPrices.cost_price,
          expectedRetail: row.currentPrices.retail_price,
          status: 'idle',
          errorMessage: undefined,
          failureType: undefined,
          conflictedFields: undefined,
          currentPrices: undefined,
        };
      })
    );
  };

  const toCents = (val: number | string | undefined | null): number | null => {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    if (!Number.isFinite(num) || isNaN(num)) return null;
    return Math.round(num * 100);
  };

  const validatePriceField = (
    val: string,
    isCost: boolean
  ): { valid: boolean; error?: string; cents: number | null } => {
    const trimmed = val.trim();
    if (trimmed === '') return { valid: true, cents: null };
    const num = Number(trimmed);
    if (!Number.isFinite(num) || isNaN(num)) {
      return { valid: false, error: 'Must be a finite number', cents: null };
    }
    if (trimmed.includes('.') && trimmed.split('.')[1].length > 2) {
      return { valid: false, error: 'Max 2 decimal places', cents: null };
    }
    if (isCost && num <= 0) {
      return { valid: false, error: 'Cost must be > 0', cents: null };
    }
    if (!isCost && num < 0) {
      return { valid: false, error: 'Retail cannot be negative', cents: null };
    }
    return { valid: true, cents: Math.round(num * 100) };
  };

  const rowsWithChanges = useMemo(() => {
    return bulkPriceRows.map((row) => {
      const costValidation = validatePriceField(row.costInput, true);
      const retailValidation = validatePriceField(row.retailInput, false);

      const hasInvalidCost = !costValidation.valid;
      const hasInvalidRetail = !retailValidation.valid;

      const costChanged =
        costValidation.valid &&
        costValidation.cents !== null &&
        costValidation.cents !== toCents(row.expectedCost);

      const retailChanged =
        retailValidation.valid &&
        retailValidation.cents !== null &&
        retailValidation.cents !== toCents(row.expectedRetail);

      const isChanged = costChanged || retailChanged;

      const proposedCostNum =
        costValidation.valid && costValidation.cents !== null
          ? costValidation.cents / 100
          : row.expectedCost;
      const proposedRetailNum =
        retailValidation.valid && retailValidation.cents !== null
          ? retailValidation.cents / 100
          : row.expectedRetail;

      const marginWarning = proposedCostNum >= proposedRetailNum;

      return {
        row,
        costValidation,
        retailValidation,
        costChanged,
        retailChanged,
        isChanged,
        hasInvalidInput: hasInvalidCost || hasInvalidRetail,
        marginWarning,
        proposedCostNum,
        proposedRetailNum,
      };
    });
  }, [bulkPriceRows]);

  const changedRows = useMemo(
    () => rowsWithChanges.filter((r) => r.isChanged),
    [rowsWithChanges]
  );

  const hasAnyInvalidInput = useMemo(
    () => rowsWithChanges.some((r) => r.hasInvalidInput),
    [rowsWithChanges]
  );

  const openBulkPriceModal = () => {
    setPriceFilterBrandId('ALL');
    setPriceFilterSeriesId('ALL');
    setPriceFilterCategory('ALL');
    setPriceFilterUnit('ALL');
    setCommonCostInput('');
    setCommonRetailInput('');
    setBulkPriceError(null);
    setShowPriceReviewModal(false);
    setShowBulkPriceModal(true);
  };

  const handleOpenReview = () => {
    setBulkPriceError(null);
    if (hasAnyInvalidInput) {
      setBulkPriceError('Please correct invalid price values before reviewing.');
      return;
    }
    if (changedRows.length === 0) {
      setBulkPriceError('No price changes detected. Modify at least one price to continue.');
      return;
    }
    if (changedRows.length > 250) {
      setBulkPriceError(`Batch size (${changedRows.length}) exceeds the maximum limit of 250 items. Please refine your criteria.`);
      return;
    }
    setShowPriceReviewModal(true);
  };

  const handleSaveBulkPrices = async () => {
    if (!tenantId) {
      setBulkPriceError('Tenant ID missing.');
      return;
    }

    setBulkPriceSubmitting(true);
    setBulkPriceError(null);

    try {
      const updates = changedRows.map(({ row, costChanged, retailChanged }) => {
        const payloadItem: any = { id: row.item.id };
        if (costChanged) {
          payloadItem.cost_price = Number(Number(row.costInput).toFixed(2));
          payloadItem.expected_cost = row.expectedCost;
        }
        if (retailChanged) {
          payloadItem.retail_price = Number(Number(row.retailInput).toFixed(2));
          payloadItem.expected_retail = row.expectedRetail;
        }
        return payloadItem;
      });

      const res = await fetch('/api/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          items: updates,
        }),
      });

      if (!res.ok && res.status >= 500) {
        throw new Error(`Server returned error status ${res.status}. Pending edits have been preserved.`);
      }

      const data = await res.json();
      if (!data.success && !Array.isArray(data.updated) && !Array.isArray(data.errors)) {
        throw new Error(data.error || 'Failed to update prices. Pending edits preserved.');
      }

      const updatedList: any[] = data.updated || [];
      const errorList: any[] = data.errors || [];
      const updatedMap = new Map(updatedList.map((u) => [u.id, u]));
      const errorMap = new Map(errorList.map((e) => [e.id, e]));

      setBulkPriceRows((prev) =>
        prev.map((row) => {
          if (updatedMap.has(row.item.id)) {
            const u = updatedMap.get(row.item.id);
            const newExpectedCost = u.cost_price !== undefined ? Number(u.cost_price) : row.expectedCost;
            const newExpectedRetail = u.retail_price !== undefined ? Number(u.retail_price) : row.expectedRetail;
            return {
              ...row,
              expectedCost: newExpectedCost,
              expectedRetail: newExpectedRetail,
              costInput: String(newExpectedCost),
              retailInput: String(newExpectedRetail),
              isCostOverride: false,
              isRetailOverride: false,
              status: 'success',
              errorMessage: undefined,
              failureType: undefined,
              conflictedFields: undefined,
              currentPrices: undefined,
            };
          }
          if (errorMap.has(row.item.id)) {
            const err = errorMap.get(row.item.id);
            return {
              ...row,
              status: err.failureType === 'STALE_PRICE_CONFLICT' ? 'conflict' : 'error',
              errorMessage: err.error,
              failureType: err.failureType,
              conflictedFields: err.conflictedFields,
              currentPrices: err.currentPrices,
            };
          }
          return row;
        })
      );

      setShowPriceReviewModal(false);

      if (updatedList.length > 0) {
        onStockUpdated?.();
      }

      if (errorList.length === 0) {
        showToast(`Successfully updated prices for ${updatedList.length} products.`);
      } else if (updatedList.length > 0) {
        showToast(`Updated ${updatedList.length} products. ${errorList.length} products had conflicts or errors.`);
        setBulkPriceError(`${errorList.length} product(s) could not be updated due to concurrency conflicts or errors. Review the table below.`);
      } else {
        setBulkPriceError(`Failed to update ${errorList.length} product(s). Concurrency conflicts detected; review below.`);
      }
    } catch (err: any) {
      setBulkPriceError(err.message || 'Ambiguous network error: updates could not be confirmed. Pending edits preserved.');
    } finally {
      setBulkPriceSubmitting(false);
    }
  };

  // Inventory stats calculations (Matching painterp top row)
  const totalSKUs = items.length;
  const totalStockUnits = items.reduce((acc, p) => acc + (Number(p.stock_qty) || 0), 0);
  const lowStockCount = items.filter((p) => (p.stock_qty || 0) <= (p.min_stock_alert || 5)).length;
  const totalValuation = items.reduce(
    (acc, p) => acc + (Number(p.stock_qty) || 0) * (Number(p.cost_price) || 0),
    0
  );

  // Filter products: Universal Inventory Search (7 fields with whitespace trimming & case-insensitivity)
  const filteredProducts = items.filter((p) => {
    if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;

    const minAlert = p.min_stock_alert || 5;
    if (stockStatus === 'low_stock' && p.stock_qty > minAlert) return false;
    if (stockStatus === 'in_stock' && p.stock_qty <= minAlert) return false;
    if (stockStatus === 'out_of_stock' && p.stock_qty > 0) return false;

    const trimmedQuery = tableSearch.trim().toLowerCase();
    if (trimmedQuery !== '') {
      const brandStr = (p.brand || (p.brand_id ? brandsMap.get(p.brand_id) : '') || '').toLowerCase();
      const seriesStr = (p.series_name || (p.series_id ? seriesMap.get(p.series_id) : '') || '').toLowerCase();
      const packUnitStr = `${p.pack_size || ''} ${p.unit || ''}`.toLowerCase();
      const nameStr = (p.name || '').toLowerCase();
      const codeStr = (p.code || '').toLowerCase();
      const shadeStr = (p.shade_code || '').toLowerCase();
      const categoryStr = (p.category || '').toLowerCase();

      return (
        nameStr.includes(trimmedQuery) ||
        codeStr.includes(trimmedQuery) ||
        shadeStr.includes(trimmedQuery) ||
        brandStr.includes(trimmedQuery) ||
        seriesStr.includes(trimmedQuery) ||
        categoryStr.includes(trimmedQuery) ||
        packUnitStr.includes(trimmedQuery)
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
    setFormError(null);
    setFormCode(`PNT-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormBrand('');
    setFormBrandId('');
    setFormSeriesId('');
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

  // ── Bulk Add Helpers ───────────────────────────────────────────────────────
  const addBulkRow = (focusNewRow = true) => {
    const newId = bulkNextId.current++;
    setBulkRows(prev => [
      ...prev,
      {
        id: newId,
        shadeName: '',
        code: '',
        retail: bulkRetailPrice,
        cost: bulkCostPrice,
        qty: '0',
        retailOverridden: false,
        costOverridden: false,
      },
    ]);
    if (focusNewRow) {
      setTimeout(() => {
        const el = document.getElementById(`bulk-row-${newId}-shade`);
        el?.focus();
        isSpawningRowRef.current = false;
      }, 50);
    } else {
      isSpawningRowRef.current = false;
    }
  };

  const removeBulkRow = (id: number) => {
    setBulkRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const updateBulkRow = (id: number, field: keyof BulkRow, value: string) => {
    setBulkRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        if (field === 'retail') {
          return { ...r, retail: value, retailOverridden: true };
        }
        if (field === 'cost') {
          return { ...r, cost: value, costOverridden: true };
        }
        return { ...r, [field]: value };
      })
    );
  };

  const handleRowPriceBlur = (id: number, field: 'retail' | 'cost') => {
    setBulkRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        if (field === 'retail' && !r.retail.trim()) {
          return { ...r, retail: bulkRetailPrice, retailOverridden: false };
        }
        if (field === 'cost' && !r.cost.trim()) {
          return { ...r, cost: bulkCostPrice, costOverridden: false };
        }
        return r;
      })
    );
  };

  const handleCommonCostChange = (val: string) => {
    setBulkCostPrice(val);
    setBulkRows(prev => prev.map(r => (r.costOverridden ? r : { ...r, cost: val })));
  };

  const handleCommonRetailChange = (val: string) => {
    setBulkRetailPrice(val);
    setBulkRows(prev => prev.map(r => (r.retailOverridden ? r : { ...r, retail: val })));
  };

  const handleRowShiftEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || isSpawningRowRef.current) return;
      isSpawningRowRef.current = true;
      addBulkRow(true);
    }
  };

  const handleMinimizeBulkModal = () => {
    if (tenantId) {
      setBulkDraft(tenantId, {
        brand: bulkBrand,
        brandId: bulkBrandId,
        seriesId: bulkSeriesId,
        category: bulkCategory,
        unit: bulkUnit,
        minAlert: bulkMinAlert,
        costPrice: bulkCostPrice,
        retailPrice: bulkRetailPrice,
        rows: bulkRows,
        nextId: bulkNextId.current,
      });
      setHasActiveDraft(true);
    }
    setShowBulkModal(false);
    showToast('Bulk entry minimized. Resume anytime from Inventory.');
  };

  const handleResumeBulkModal = () => {
    const draft = getBulkDraft(tenantId);
    if (draft) {
      setBulkBrand(draft.brand);
      setBulkBrandId(draft.brandId);
      setBulkSeriesId(draft.seriesId);
      setBulkCategory(draft.category);
      setBulkUnit(draft.unit);
      setBulkMinAlert(draft.minAlert);
      setBulkCostPrice(draft.costPrice);
      setBulkRetailPrice(draft.retailPrice);
      setBulkRows(draft.rows);
      bulkNextId.current = draft.nextId || draft.rows.length + 1;
      setBulkErrors([]);
      setBulkSavedCount(null);
    }
    setShowBulkModal(true);
  };

  const handleCancelBulkModal = () => {
    if (tenantId) {
      clearBulkDraft(tenantId);
      setHasActiveDraft(false);
    }
    setShowBulkModal(false);
  };

  const openBulkModal = () => {
    const existingDraft = getBulkDraft(tenantId);
    if (existingDraft) {
      handleResumeBulkModal();
      return;
    }
    setBulkBrand('');
    setBulkBrandId('');
    setBulkSeriesId('');
    setBulkCategory(allCategories[0] || 'Interior Emulsion');
    setBulkUnit(allUnits[0] || '4L Gallon');
    setBulkCostPrice('0');
    setBulkRetailPrice('0');
    setBulkMinAlert('5');
    setBulkRows([
      {
        id: 1,
        shadeName: '',
        code: '',
        retail: '0',
        cost: '0',
        qty: '0',
        retailOverridden: false,
        costOverridden: false,
      },
    ]);
    bulkNextId.current = 2;
    setBulkErrors([]);
    setBulkSavedCount(null);
    setShowBulkModal(true);
  };

  const handleBulkSave = async () => {
    if (!tenantId) { alert('Tenant ID missing'); return; }
    if (!bulkBrand.trim() && !bulkBrandId) { alert('Brand is required'); return; }

    const validRows = bulkRows.filter(r => r.shadeName.trim() && r.code.trim());
    if (validRows.length === 0) { alert('Please fill at least one product row (Shade Name + Code required)'); return; }

    // Case-insensitive, whitespace-trimmed duplicate-code validation before network request
    const seenCodes = new Set<string>();
    const duplicateCodes = new Set<string>();
    for (const r of validRows) {
      const norm = r.code.trim().toUpperCase();
      if (seenCodes.has(norm)) {
        duplicateCodes.add(norm);
      } else {
        seenCodes.add(norm);
      }
    }
    if (duplicateCodes.size > 0) {
      alert(`Duplicate item code(s) detected: ${Array.from(duplicateCodes).join(', ')}. Each row must have a unique Item Code.`);
      return;
    }

    setBulkSubmitting(true);
    setBulkErrors([]);
    setBulkSavedCount(null);

    // Build auto-generated full name for each row: "BRAND CATEGORY SHADENAME"
    const itemsPayload = validRows.map(r => ({
      name: `${bulkBrand.trim().toUpperCase()} ${bulkCategory.toUpperCase()} ${r.shadeName.trim().toUpperCase()}`,
      code: r.code.trim(),
      shade_code: r.shadeName.trim(),
      retail_price: Number(r.retail) || 0,
      cost_price: Number(r.cost) || 0,
      stock_qty: Number(r.qty) || 0,
    }));

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          brand: bulkBrand.trim(),
          brand_id: bulkBrandId || undefined,
          series_id: bulkSeriesId || undefined,
          category: bulkCategory,
          unit: bulkUnit,
          min_stock_alert: Number(bulkMinAlert) || 5,
          items: itemsPayload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkSavedCount(data.count || 0);
        setBulkErrors(data.errors || []);
        if ((data.errors || []).length === 0) {
          showToast(`${data.count} products added to catalog successfully!`);
          if (tenantId) {
            clearBulkDraft(tenantId);
            setHasActiveDraft(false);
          }
          setShowBulkModal(false);
          onStockUpdated?.();
        } else {
          // Positive-success reconciliation: identify saved rows ONLY when explicitly confirmed in data.saved
          const confirmedSavedCodes = new Set<string>(
            (data.saved || []).map((s: any) => s.code?.trim().toUpperCase()).filter(Boolean)
          );

          // Map confirmed saved codes to their stable client row IDs from submitted validRows
          const confirmedSavedRowIds = new Set<number>();
          for (const r of validRows) {
            if (confirmedSavedCodes.has(r.code.trim().toUpperCase())) {
              confirmedSavedRowIds.add(r.id);
            }
          }

          // Retain every row that is NOT positively confirmed as saved (failed, unconfirmed, or incomplete)
          const remainingRows = bulkRows.filter(r => !confirmedSavedRowIds.has(r.id));
          setBulkRows(remainingRows);
          if (tenantId) {
            setBulkDraft(tenantId, {
              brand: bulkBrand,
              brandId: bulkBrandId,
              seriesId: bulkSeriesId,
              category: bulkCategory,
              unit: bulkUnit,
              minAlert: bulkMinAlert,
              costPrice: bulkCostPrice,
              retailPrice: bulkRetailPrice,
              rows: remainingRows,
              nextId: bulkNextId.current,
            });
            setHasActiveDraft(true);
          }
          onStockUpdated?.();
        }
      } else {
        alert(`Bulk save failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Open modal for editing existing product
  const handleOpenEditProduct = (item: Item) => {
    setEditingItemId(item.id);
    setFormError(null);
    setFormCode(item.code);
    setFormName(item.name);
    setFormBrand(item.brand || '');
    setFormBrandId(item.brand_id || '');
    setFormSeriesId(item.series_id || '');
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

  // Add custom new unit handler (FINDING-INV-005: Persist custom packaging unit to database)
  const handleAddNewUnit = async () => {
    if (!newUnitInput.trim()) return;
    const unit = newUnitInput.trim();
    if (!customUnits.includes(unit)) {
      setCustomUnits((prev) => [...prev, unit]);
      if (tenantId) {
        try {
          await fetch('/api/custom-units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: tenantId, name: unit }),
          });
        } catch (e) {
          console.error('Failed to persist custom unit to database:', e);
        }
      }
    }
    setFormUnit(unit);
    setNewUnitInput('');
    setIsAddingNewUnit(false);
    showToast(`Unit/Pack Size "${unit}" added to system!`);
  };

  // Save product to Supabase
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formCode.trim()) {
      setFormError('Product name and code are required');
      return;
    }
    if (!formBrand.trim()) {
      setFormError('Brand / Manufacturer is required');
      return;
    }
    if (!tenantId) {
      setFormError('Tenant ID missing');
      return;
    }

    const normalizedCode = formCode.trim().toUpperCase();

    // Check duplicate SKU / Product Code locally
    const duplicate = items.find(
      (it) => it.code?.trim().toUpperCase() === normalizedCode && it.id !== editingItemId
    );
    if (duplicate) {
      setFormError(`A product with code "${normalizedCode}" already exists.`);
      return;
    }

    setSubmitting(true);
    const retail = Number(formRetailPrice) || 0;
    const cost = Number(formCostPrice) || 0;

    if (!editingItemId && cost <= 0) {
      setFormError('Cost price must be greater than zero');
      setSubmitting(false);
      return;
    }

    const payload = {
      tenant_id: tenantId,
      code: normalizedCode,
      name: formName.trim(),
      category: formCategory,
      brand: formBrand.trim(),
      brand_id: formBrandId || undefined,
      series_id: formSeriesId || undefined,
      unit: formUnit,
      pack_size: formUnit,

      shade_code: formShadeCode.trim() || 'Standard',
      cost_price: cost,
      retail_price: retail,
      stock_qty: Number(formStockQty) || 0,
      min_stock_alert: Number(formMinAlert) || 5,
      // Token value is auto-resolved strictly from series config on the backend (no product-level override)
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
          // FIX FINDING-INV-004: Display server-side duplicate SKU / validation errors in modal
          setFormError(data.error || 'Failed to update product.');
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
          // FIX FINDING-INV-004: Display server-side duplicate SKU / validation errors in modal
          setFormError(data.error || 'Failed to create product.');
        }
      }
    } catch (err: any) {
      setFormError(`Network error saving product: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/items?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Product "${name}" deleted successfully!`);
        onStockUpdated?.();
      } else {
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error deleting product: ${err.message}`);
    }
  };

  // Confirm Inward Goods Receipt (GRN)

  // State for Export dropdown menu (Requirement A: Exactly Excel and Print)
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Workstream C: Export to Excel (.xlsx) using sortedProducts
  const handleExportExcel = async () => {
    setShowExportMenu(false);
    if (sortedProducts.length === 0) {
      showToast('No inventory records to export for the current filters.');
      return;
    }
    setExportingExcel(true);
    try {
      await exportToXlsx(
        `Inventory_${tenantName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`,
        sortedProducts,
        [
          { header: 'Product Code', type: 'String', width: 14, getValue: (i) => i.code || '—' },
          { header: 'Product Name', type: 'String', width: 30, getValue: (i) => i.name },
          { header: 'Category', type: 'String', width: 20, getValue: (i) => i.category || 'General' },
          { header: 'Brand', type: 'String', width: 16, getValue: (i) => i.brand || '—' },
          { header: 'Pack Size / Unit', type: 'String', width: 16, getValue: (i) => i.pack_size || i.unit || 'Can' },
          { header: 'Shade Code', type: 'String', width: 16, getValue: (i) => i.shade_code || 'Standard' },
          { header: 'Stock Qty', type: 'Number', width: 14, format: '#,##0', getValue: (i) => i.stock_qty },
          { header: 'Cost Price (PKR)', type: 'Number', width: 16, format: '#,##0.00', getValue: (i) => i.cost_price || 0 },
          { header: 'Retail Price (PKR)', type: 'Number', width: 16, format: '#,##0.00', getValue: (i) => i.retail_price || 0 },
          { header: 'Stock Valuation (PKR)', type: 'Number', width: 20, format: '#,##0.00', getValue: (i) => (i.stock_qty || 0) * (i.cost_price || 0) },
        ],
        'Inventory'
      );
      showToast(`Exported ${sortedProducts.length} inventory items to Excel!`);
    } catch (err: any) {
      console.error('Failed to export inventory to Excel:', err);
      showToast('Failed to generate Excel file.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Workstream C: Print Inventory Report (isolated printable report, NOT whole ERP shell)
  const handlePrintInventory = () => {
    setShowExportMenu(false);
    if (sortedProducts.length === 0) {
      showToast('No inventory records to print.');
      return;
    }

    const rowsHtml = sortedProducts.map((i, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0; ${idx % 2 === 1 ? 'background: #F8FAFC;' : ''}">
        <td style="padding: 6px 8px; font-family: monospace; font-size: 11px;">${i.code || '—'}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${i.name}</td>
        <td style="padding: 6px 8px;">${i.category || 'General'}</td>
        <td style="padding: 6px 8px;">${i.pack_size || i.unit || '—'}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 700;">${i.stock_qty}</td>
        <td style="padding: 6px 8px; text-align: right;">Rs. ${(i.retail_price || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Inventory Manifest — ${tenantName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #0F172A; padding: 10px; }
    .header { margin-bottom: 16px; border-bottom: 2px solid #0F172A; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 800; color: #0F172A; }
    .sub { font-size: 11px; color: #64748B; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 10px; }
    th { background: #0F172A; color: #FFF; padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${tenantName} — Inventory Manifest</div>
      <div class="sub">Generated on ${new Date().toLocaleString()} · Filtered records: ${sortedProducts.length} items</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Code</th>
        <th style="width: 35%;">Product Name</th>
        <th style="width: 20%;">Category</th>
        <th style="width: 12%;">Pack / Unit</th>
        <th style="width: 8%; text-align: center;">Qty</th>
        <th style="width: 10%; text-align: right;">Retail</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

    const printOk = printViaIframe(printHtml);
    if (!printOk) {
      showToast('Could not open print window. Please check permissions.');
    }
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
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="inv-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
                title="Sync live inventory with cloud database"
              >
                <RefreshCw
                  style={{
                    width: 14,
                    height: 14,
                    color: '#F97316',
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  }}
                />
                {isRefreshing ? 'Syncing...' : 'Refresh Stock'}
              </button>

              {/* Workstream C: Export Menu offering exactly Excel and Print */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportingExcel}
                  className="inv-btn-secondary"
                  title="Export inventory data"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download style={{ width: 14, height: 14, color: '#38BDF8' }} />
                  {exportingExcel ? 'Exporting...' : 'Export'}
                </button>

                {showExportMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '6px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '4px',
                      minWidth: '150px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                      zIndex: 50,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#F8FAFC',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1E293B')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <FileSpreadsheet style={{ width: 15, height: 15, color: '#10B981' }} />
                      Excel (.xlsx)
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintInventory}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#F8FAFC',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: '6px',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1E293B')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Printer style={{ width: 15, height: 15, color: '#F97316' }} />
                      Print
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowReceiveModal(true)}
                className="inv-btn-secondary"
                title="Audit stock count correction or damage adjustment"
              >
                <PackagePlus style={{ width: 14, height: 14, color: '#F97316' }} />
                Stock Adjustment
              </button>

              <button
                type="button"
                onClick={() => setShowAiScanModal(true)}
                className="inv-btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Scan physical invoice photo with Gemini AI to inward stock"
              >
                <Sparkles style={{ width: 15, height: 15 }} />
                Scan AI Invoice
              </button>

              {hasActiveDraft && !showBulkModal && (
                <button
                  type="button"
                  onClick={handleResumeBulkModal}
                  className="inv-btn-secondary"
                  title="Resume previously minimized bulk entry"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF3C7', borderColor: '#FDE68A', color: '#B45309', fontWeight: 700 }}
                >
                  <Boxes style={{ width: 14, height: 14, color: '#D97706' }} />
                  Resume Bulk Entry ({getBulkDraft(tenantId)?.rows?.length || 'In-Progress'})
                </button>
              )}

              <button
                type="button"
                onClick={openBulkPriceModal}
                className="inv-btn-secondary"
                title="Bulk update cost and retail prices with concurrency safety"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857', fontWeight: 600 }}
              >
                <DollarSign style={{ width: 14, height: 14, color: '#059669' }} />
                Bulk Edit Prices
              </button>

              <button
                type="button"
                onClick={() => setShowOrderSheetModal(true)}
                className="inv-btn-secondary"
                title="Create Company Demand Order Sheet and Print Slip"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', borderColor: '#BBF7D0', color: '#16A34A', fontWeight: 600 }}
              >
                <ClipboardList style={{ width: 14, height: 14, color: '#16A34A' }} />
                Order Sheet
              </button>

              <button
                type="button"
                onClick={openBulkModal}
                className="inv-btn-secondary"
                title="Add multiple products of same brand in one go"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', borderColor: '#BFDBFE', color: '#2563EB' }}
              >
                <Boxes style={{ width: 14, height: 14 }} />
                Bulk Add
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
                    <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <span>
                          {selectedCategory !== 'All'
                            ? `No products found in "${selectedCategory}" matching your criteria.`
                            : 'No products found. Click "+ Add Product" above.'}
                        </span>
                        {selectedCategory !== 'All' && (
                          <button
                            type="button"
                            onClick={() => setSelectedCategory('All')}
                            className="inv-btn-secondary"
                            style={{
                              marginTop: '4px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              color: '#2563EB',
                              borderColor: '#BFDBFE',
                              background: '#EFF6FF',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            <Filter style={{ width: 13, height: 13 }} />
                            Search across All Categories
                          </button>
                        )}
                      </div>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod.name}</span>
                            {prod.has_token && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontWeight: 700,
                                  background: '#FEF3C7',
                                  color: '#D97706',
                                  border: '1px solid #FDE68A',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                                title={`Paint Token worth Rs. ${Number(prod.token_value || 0).toLocaleString()}`}
                              >
                                🎫 Rs. {Number(prod.token_value || 0).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            {prod.brand && (
                              <span style={{ fontSize: '10px', color: '#0284C7', fontWeight: 600, background: '#E0F2FE', padding: '0 4px', borderRadius: '3px' }}>
                                {prod.brand}
                              </span>
                            )}
                            {prod.series_name && (
                              <span style={{ fontSize: '10px', color: '#7C3AED', fontWeight: 600, background: '#EDE9FE', padding: '0 4px', borderRadius: '3px' }}>
                                {prod.series_name}
                              </span>
                            )}
                            {prod.shade_code && prod.shade_code !== '—' && (
                              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {prod.shade_code}
                              </span>
                            )}
                          </div>
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(prod)}
                              style={{ padding: '5px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                              title="Edit Product Details"
                            >
                              <Edit2 style={{ width: 14, height: 14 }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              style={{ padding: '5px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                              title="Delete Product"
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

              {/* Brand, Series & Token Configuration — inherited from Series */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', background: '#F8FAFC' }}>
                <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Brand &amp; Series — Token value auto-inherited
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Brand / Manufacturer *
                    </label>
                    {brands.length > 0 ? (
                      <select
                        value={formBrandId}
                        onChange={(e) => {
                          const bid = e.target.value;
                          setFormBrandId(bid);
                          const b = brands.find(b => b.id === bid);
                          if (b) setFormBrand(b.name);
                          setFormSeriesId('');
                        }}
                        className="pos-text-input"
                        style={{ fontWeight: 600 }}
                      >
                        <option value="">— Select Brand —</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        placeholder="e.g. Berger, Nippon, Master, Diamond"
                        className="pos-text-input"
                        style={{ fontWeight: 500 }}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Series
                    </label>
                    <select
                      value={formSeriesId}
                      onChange={(e) => setFormSeriesId(e.target.value)}
                      className="pos-text-input"
                      style={{ fontWeight: 600 }}
                      disabled={!formBrandId && formSeriesOptions.length === 0}
                    >
                      <option value="">— None / No Series —</option>
                      {formSeriesOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Inherited token badge */}
                {formSeriesId ? (
                  formInheritedToken.has_token ? (
                    <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', padding: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>🎫</span>
                      <div>
                        <div style={{ fontWeight: 700, color: '#92400E', fontSize: '12px' }}>Token Enabled — Inherited from Series</div>
                        <div style={{ fontSize: '11px', color: '#B45309' }}>Rs. {formInheritedToken.token_value.toLocaleString()} per {formUnit} (auto-resolved)</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px', fontSize: '11px', color: '#64748B' }}>
                      ℹ️ This unit is not token-enabled in the selected Series. Product will be created without token.
                    </div>
                  )
                ) : (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 12px', fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>ℹ️</span>
                    <span>No Series selected. Token values are determined exclusively by Brand + Series + Unit configuration. Select a Series above if this product has tokens.</span>
                  </div>
                )}
              </div>

              {/* FIX FINDING-INV-004: Inline server-side error banner (duplicate SKU, validation, network errors) */}
              {formError && (
                <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '10px 14px', color: '#DC2626', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ flexShrink: 0 }}>⚠</span>
                  <span>{formError}</span>
                </div>
              )}

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

      {/* ── MODAL 2: STOCK ADJUSTMENT (+ / -) — keyboard grid ── */}
      {showReceiveModal && tenantId && (
        <StockAdjustmentGrid
          items={items}
          tenantId={tenantId}
          staffName={tenantName || 'Inventory Staff'}
          onClose={() => setShowReceiveModal(false)}
          onSaved={(msg) => {
            showToast(msg);
            onStockUpdated?.();
          }}
        />
      )}

      {/* AI Invoice Scanner Modal */}
      {tenantId && (
        <AiInvoiceScan
          tenantId={tenantId}
          isOpen={showAiScanModal}
          onClose={() => setShowAiScanModal(false)}
          onPurchaseCompleted={() => {
            onStockUpdated?.();
            showToast('Stock updated from AI invoice purchase!');
          }}
          catalogItems={items}
        />
      )}

      {/* ── MODAL 3: BULK ADD PRODUCTS ── */}
      {/* ── MODAL 3: BULK ADD PRODUCTS ── */}
      {showBulkModal && (
        <div className="pos-modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '32px' }}>
          <div className="pos-modal-card" style={{ maxWidth: '960px', width: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Boxes style={{ width: 18, height: 18, color: '#2563EB' }} />
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#1E3A8A' }}>Bulk Product Entry</h3>
                  <p style={{ fontSize: '11px', color: '#3B82F6', marginTop: '1px' }}>Fill common fields once — add unlimited variant rows</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleMinimizeBulkModal}
                  style={{
                    background: '#DBEAFE',
                    border: '1px solid #BFDBFE',
                    borderRadius: '6px',
                    color: '#1D4ED8',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Minimize bulk entry — access POS and resume anytime"
                >
                  <Minus style={{ width: 13, height: 13 }} />
                  <span>Minimize</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelBulkModal}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                  title="Close & Discard"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {/* ── Section A: Common Fields (7 Columns) ── */}
              <div style={{ padding: '1rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                  Common Fields — same for all rows below (Enter advances across fields)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', fontSize: '12px' }}>
                  {/* 1. Brand */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Brand *</label>
                    {brands.length > 0 ? (
                      <select
                        ref={commonBrandSelectRef}
                        value={bulkBrandId}
                        onChange={e => {
                          const bid = e.target.value;
                          setBulkBrandId(bid);
                          const b = brands.find(b => b.id === bid);
                          if (b) setBulkBrand(b.name);
                          setBulkSeriesId('');
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commonSeriesRef.current?.focus();
                          }
                        }}
                        className="pos-text-input"
                        style={{ fontWeight: 600 }}
                        autoFocus
                      >
                        <option value="">— Brand —</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      <input
                        ref={commonBrandInputRef}
                        type="text"
                        value={bulkBrand}
                        onChange={e => setBulkBrand(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commonSeriesRef.current?.focus();
                          }
                        }}
                        placeholder="e.g. BRIGHTO"
                        className="pos-text-input"
                        style={{ fontWeight: 600, textTransform: 'uppercase' }}
                        autoFocus
                      />
                    )}
                  </div>

                  {/* 2. Series */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Series</label>
                    <select
                      ref={commonSeriesRef}
                      value={bulkSeriesId}
                      onChange={e => setBulkSeriesId(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commonCategoryRef.current?.focus();
                        }
                      }}
                      className="pos-text-input"
                      style={{ fontWeight: 600 }}
                    >
                      <option value="">— None —</option>
                      {bulkSeriesOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* 3. Category */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Category</label>
                    <select
                      ref={commonCategoryRef}
                      value={bulkCategory}
                      onChange={e => setBulkCategory(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commonUnitRef.current?.focus();
                        }
                      }}
                      className="pos-text-input"
                    >
                      {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* 4. Pack Size / Unit */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Pack Size / Unit</label>
                    <select
                      ref={commonUnitRef}
                      value={bulkUnit}
                      onChange={e => setBulkUnit(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commonCostRef.current?.focus();
                        }
                      }}
                      className="pos-text-input"
                    >
                      {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  {/* 5. Cost Price */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Cost Price</label>
                    <input
                      ref={commonCostRef}
                      type="number"
                      min="0"
                      value={bulkCostPrice}
                      onChange={e => handleCommonCostChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commonRetailRef.current?.focus();
                        }
                      }}
                      placeholder="0"
                      className="pos-text-input"
                      style={{ fontWeight: 600 }}
                    />
                  </div>

                  {/* 6. Retail Price */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Retail Price</label>
                    <input
                      ref={commonRetailRef}
                      type="number"
                      min="0"
                      value={bulkRetailPrice}
                      onChange={e => handleCommonRetailChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commonMinAlertRef.current?.focus();
                        }
                      }}
                      placeholder="0"
                      className="pos-text-input"
                      style={{ fontWeight: 600 }}
                    />
                  </div>

                  {/* 7. Min Stock Alert */}
                  <div>
                    <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Min Stock Alert</label>
                    <input
                      ref={commonMinAlertRef}
                      type="number"
                      min="0"
                      value={bulkMinAlert}
                      onChange={e => setBulkMinAlert(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const firstRowShade = document.getElementById(`bulk-row-${bulkRows[0]?.id || 1}-shade`);
                          firstRowShade?.focus();
                        }
                      }}
                      className="pos-text-input"
                      style={{ fontWeight: 600 }}
                    />
                  </div>
                </div>

                {/* Token Inherited Info Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', fontSize: '12px' }}>
                  {bulkSeriesId ? (
                    bulkInheritedToken.has_token ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', padding: '6px 12px' }}>
                        <span>🎫</span>
                        <span style={{ fontWeight: 700, color: '#92400E' }}>Token Enabled — Rs. {bulkInheritedToken.token_value.toLocaleString()} per {bulkUnit} (inherited from Series)</span>
                      </div>
                    ) : (
                      <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', color: '#64748B' }}>
                        ℹ️ This unit is not token-enabled in the selected Series
                      </div>
                    )
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>💡 Select a Series to auto-inherit token configuration</span>
                  )}
                  {bulkBrand && (
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', background: '#E2E8F0', padding: '3px 8px', borderRadius: '4px' }}>
                      Preview: {bulkBrand.toUpperCase()} {bulkCategory.toUpperCase()} [SHADE NAME]
                    </span>
                  )}
                </div>
              </div>

              {/* ── Section B: Variant Rows ── */}
              <div style={{ padding: '0 1.25rem 1rem' }}>
                {/* Partial save errors */}
                {bulkErrors.length > 0 && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 12px', margin: '10px 0', fontSize: '11px', color: '#991B1B' }}>
                    <strong>⚠ {bulkErrors.length} row(s) had errors (remaining rows saved):</strong>
                    {bulkErrors.map(e => <div key={e.row}>Row {e.row} ({e.code}): {e.error}</div>)}
                  </div>
                )}

                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 110px 110px 80px 36px', gap: '6px', padding: '8px 0 4px', borderBottom: '2px solid #0F172A', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  <span>#</span>
                  <span>Shade / Color Name *</span>
                  <span>Item Code *</span>
                  <span>Retail Rs.</span>
                  <span>Cost Rs.</span>
                  <span>Qty</span>
                  <span></span>
                </div>

                {/* Rows */}
                {bulkRows.map((row, idx) => {
                  const rowError = bulkErrors.find(e => e.code === row.code.trim().toUpperCase());
                  return (
                    <div key={row.id} style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr 130px 110px 110px 80px 36px',
                      gap: '6px', padding: '5px 0', borderBottom: '1px solid #F1F5F9',
                      background: rowError ? '#FEF2F2' : 'transparent',
                    }}>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center' }}>{idx + 1}</span>
                      <input
                        id={`bulk-row-${row.id}-shade`}
                        type="text"
                        value={row.shadeName}
                        onChange={e => updateBulkRow(row.id, 'shadeName', e.target.value)}
                        placeholder="e.g. Pale Cream 3071"
                        className="pos-text-input"
                        style={{ fontSize: '12px' }}
                        onKeyDown={e => {
                          handleRowShiftEnter(e);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            document.getElementById(`bulk-row-${row.id}-code`)?.focus();
                          }
                        }}
                      />
                      <input
                        id={`bulk-row-${row.id}-code`}
                        type="text"
                        value={row.code}
                        onChange={e => updateBulkRow(row.id, 'code', e.target.value.toUpperCase())}
                        placeholder="e.g. BG3071"
                        className="pos-text-input"
                        style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                        onKeyDown={e => {
                          handleRowShiftEnter(e);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            document.getElementById(`bulk-row-${row.id}-retail`)?.focus();
                          }
                        }}
                      />
                      <input
                        id={`bulk-row-${row.id}-retail`}
                        type="number"
                        value={row.retail}
                        onChange={e => updateBulkRow(row.id, 'retail', e.target.value)}
                        onBlur={() => handleRowPriceBlur(row.id, 'retail')}
                        placeholder="0"
                        className="pos-text-input"
                        style={{ fontSize: '12px', borderColor: row.retailOverridden ? '#F59E0B' : undefined }}
                        title={row.retailOverridden ? 'Manually overridden (will not auto-update from Common Retail Price)' : 'Inherited from Common Retail Price'}
                        onKeyDown={e => {
                          handleRowShiftEnter(e);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            document.getElementById(`bulk-row-${row.id}-cost`)?.focus();
                          }
                        }}
                      />
                      <input
                        id={`bulk-row-${row.id}-cost`}
                        type="number"
                        value={row.cost}
                        onChange={e => updateBulkRow(row.id, 'cost', e.target.value)}
                        onBlur={() => handleRowPriceBlur(row.id, 'cost')}
                        placeholder="0"
                        className="pos-text-input"
                        style={{ fontSize: '12px', borderColor: row.costOverridden ? '#F59E0B' : undefined }}
                        title={row.costOverridden ? 'Manually overridden (will not auto-update from Common Cost Price)' : 'Inherited from Common Cost Price'}
                        onKeyDown={e => {
                          handleRowShiftEnter(e);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            document.getElementById(`bulk-row-${row.id}-qty`)?.focus();
                          }
                        }}
                      />
                      <input
                        id={`bulk-row-${row.id}-qty`}
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={e => updateBulkRow(row.id, 'qty', e.target.value)}
                        className="pos-text-input"
                        style={{ fontSize: '12px' }}
                        onKeyDown={e => {
                          handleRowShiftEnter(e);
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const isLastRow = idx === bulkRows.length - 1;
                            if (isLastRow) {
                              if (e.repeat || isSpawningRowRef.current) return;
                              isSpawningRowRef.current = true;
                              addBulkRow(true);
                            } else {
                              const nextRow = bulkRows[idx + 1];
                              if (nextRow) {
                                document.getElementById(`bulk-row-${nextRow.id}-shade`)?.focus();
                              }
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeBulkRow(row.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remove this row"
                      >
                        <X style={{ width: 15, height: 15 }} />
                      </button>
                    </div>
                  );
                })}

                {/* Add Row Button */}
                <button
                  type="button"
                  onClick={() => addBulkRow(true)}
                  style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#2563EB', background: '#EFF6FF', border: '1px dashed #93C5FD', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> Add Row (or press Enter in Quantity on last row, or Shift+Enter anywhere in row)
                </button>

                <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {bulkRows.filter(r => r.shadeName.trim() && r.code.trim()).length} valid row(s) ready to save • Rows with empty Name or Code will be skipped
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', flexShrink: 0, background: '#F8FAFC' }}>
              <button
                type="button"
                onClick={handleCancelBulkModal}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#334155', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSave}
                disabled={bulkSubmitting}
                style={{ flex: 2, padding: '10px', background: '#2563EB', color: '#ffffff', fontWeight: 700, fontSize: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: bulkSubmitting ? 0.7 : 1 }}
              >
                <Boxes style={{ width: 16, height: 16 }} />
                {bulkSubmitting ? 'Saving all products...' : `Save All ${bulkRows.filter(r => r.shadeName.trim() && r.code.trim()).length > 0 ? `(${bulkRows.filter(r => r.shadeName.trim() && r.code.trim()).length} products)` : ''} to Catalog`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: BULK PRICE EDITOR ── */}
      {showBulkPriceModal && (
        <div className="pos-modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '24px' }}>
          <div className="pos-modal-card" style={{ maxWidth: '1080px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign style={{ width: 20, height: 20, color: '#059669' }} />
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#065F46' }}>Bulk Price Editor</h3>
                  <p style={{ fontSize: '11px', color: '#047857', marginTop: '1px' }}>
                    Update cost & retail prices with strict optimistic concurrency control (OCC)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBulkPriceModal(false);
                  setShowPriceReviewModal(false);
                }}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '18px', fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Error banner if any */}
              {bulkPriceError && (
                <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, color: '#DC2626' }} />
                  <span>{bulkPriceError}</span>
                </div>
              )}

              {/* ── Section 1: Dependent Selection Criteria ── */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                    1. Filter Target Products (Brand → Series → Category → Pack Size)
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>
                    {matchedPriceItems.length} Product(s) Matched
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {/* Brand */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                      Brand
                    </label>
                    <select
                      value={priceFilterBrandId}
                      onChange={(e) => handlePriceBrandChange(e.target.value)}
                      className="pos-text-input"
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                    >
                      <option value="ALL">All Brands</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Series */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                      Series
                    </label>
                    <select
                      value={priceFilterSeriesId}
                      onChange={(e) => handlePriceSeriesChange(e.target.value)}
                      className="pos-text-input"
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                    >
                      <option value="ALL">All Series</option>
                      {priceFilterSeriesOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                      Category
                    </label>
                    <select
                      value={priceFilterCategory}
                      onChange={(e) => handlePriceCategoryChange(e.target.value)}
                      className="pos-text-input"
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                    >
                      <option value="ALL">All Categories</option>
                      {priceFilterCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Pack Size / Unit */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                      Pack Size / Unit
                    </label>
                    <select
                      value={priceFilterUnit}
                      onChange={(e) => setPriceFilterUnit(e.target.value)}
                      className="pos-text-input"
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                    >
                      <option value="ALL">All Pack Sizes</option>
                      {priceFilterUnitOptions.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Common Price Inputs ── */}
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#065F46' }}>
                    2. Common Pricing Baseline (Applies to non-overridden rows)
                  </span>
                  <button
                    type="button"
                    onClick={handleResetAllOverrides}
                    style={{ fontSize: '11px', color: '#047857', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    Reset All Row Overrides
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#065F46', marginBottom: '4px' }}>
                      Common Cost Price (Rs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 1500"
                      value={commonCostInput}
                      onChange={(e) => setCommonCostInput(e.target.value)}
                      className="pos-text-input"
                      style={{ background: '#ffffff', borderColor: '#86EFAC', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#065F46', marginBottom: '4px' }}>
                      Common Retail Price (Rs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1850"
                      value={commonRetailInput}
                      onChange={(e) => setCommonRetailInput(e.target.value)}
                      className="pos-text-input"
                      style={{ background: '#ffffff', borderColor: '#86EFAC', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleApplyCommonPrices}
                      style={{
                        padding: '8px 16px',
                        background: '#059669',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Apply Common Prices
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '10px', color: '#047857', marginTop: '6px' }}>
                  Note: Values applied here will only update rows that haven&apos;t been individually customized. Overrides have amber borders and take precedence.
                </p>
              </div>

              {/* ── Section 3: Matching Products Table with Overrides & OCC ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                    3. Matched Products & Per-Row Overrides
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    {changedRows.length} item(s) pending price change
                  </span>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ maxHeight: '38vh', overflowY: 'auto' }}>
                    <table className="inv-data-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '120px' }}>SKU / Code</th>
                          <th>Product Name & Shade</th>
                          <th style={{ width: '110px' }}>Unit / Pack</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Current Baseline</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Proposed Cost</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Proposed Retail</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Margin</th>
                          <th style={{ width: '110px', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPriceRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                              No products match the selected criteria.
                            </td>
                          </tr>
                        ) : (
                          rowsWithChanges.map(({ row, costValidation, retailValidation, isChanged, marginWarning, proposedCostNum, proposedRetailNum }) => {
                            const isCostOverridden = row.isCostOverride;
                            const isRetailOverridden = row.isRetailOverride;

                            return (
                              <React.Fragment key={row.item.id}>
                                <tr style={{ background: row.status === 'conflict' ? '#FEF2F2' : row.status === 'success' ? '#F0FDF4' : isChanged ? '#F8FAFC' : 'transparent' }}>
                                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#475569' }}>
                                    {row.item.code}
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {row.item.name}
                                    </div>
                                    {row.item.shade_code && row.item.shade_code !== '—' && (
                                      <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                        Shade: {row.item.shade_code}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ color: '#475569' }}>
                                    {row.item.pack_size || row.item.unit || 'Can'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#64748B' }}>
                                    <div>C: Rs. {Number(row.expectedCost).toLocaleString()}</div>
                                    <div>R: Rs. {Number(row.expectedRetail).toLocaleString()}</div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={row.costInput}
                                        onChange={(e) => handleRowCostChange(row.item.id, e.target.value)}
                                        style={{
                                          width: '100%',
                                          padding: '4px 6px',
                                          fontSize: '11px',
                                          fontFamily: 'JetBrains Mono, monospace',
                                          textAlign: 'right',
                                          borderRadius: '4px',
                                          border: !costValidation.valid
                                            ? '1px solid #EF4444'
                                            : isCostOverridden
                                            ? '1px solid #F59E0B'
                                            : '1px solid #CBD5E1',
                                          background: !costValidation.valid
                                            ? '#FEF2F2'
                                            : isCostOverridden
                                            ? '#FFFBEB'
                                            : '#ffffff',
                                          outline: 'none',
                                        }}
                                      />
                                      {isCostOverridden && (
                                        <span style={{ position: 'absolute', left: '4px', top: '3px', fontSize: '8px', color: '#B45309', fontWeight: 700, pointerEvents: 'none' }}>
                                          OVR
                                        </span>
                                      )}
                                    </div>
                                    {!costValidation.valid && (
                                      <div style={{ fontSize: '9px', color: '#DC2626', marginTop: '1px', textAlign: 'right' }}>
                                        {costValidation.error}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.retailInput}
                                        onChange={(e) => handleRowRetailChange(row.item.id, e.target.value)}
                                        style={{
                                          width: '100%',
                                          padding: '4px 6px',
                                          fontSize: '11px',
                                          fontFamily: 'JetBrains Mono, monospace',
                                          textAlign: 'right',
                                          borderRadius: '4px',
                                          border: !retailValidation.valid
                                            ? '1px solid #EF4444'
                                            : isRetailOverridden
                                            ? '1px solid #F59E0B'
                                            : '1px solid #CBD5E1',
                                          background: !retailValidation.valid
                                            ? '#FEF2F2'
                                            : isRetailOverridden
                                            ? '#FFFBEB'
                                            : '#ffffff',
                                          outline: 'none',
                                        }}
                                      />
                                      {isRetailOverridden && (
                                        <span style={{ position: 'absolute', left: '4px', top: '3px', fontSize: '8px', color: '#B45309', fontWeight: 700, pointerEvents: 'none' }}>
                                          OVR
                                        </span>
                                      )}
                                    </div>
                                    {!retailValidation.valid && (
                                      <div style={{ fontSize: '9px', color: '#DC2626', marginTop: '1px', textAlign: 'right' }}>
                                        {retailValidation.error}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {marginWarning ? (
                                      <span
                                        style={{ fontSize: '10px', background: '#FEF3C7', color: '#B45309', padding: '2px 4px', borderRadius: '3px', fontWeight: 700, cursor: 'help' }}
                                        title={`Warning: Proposed Cost (Rs. ${proposedCostNum}) >= Retail (Rs. ${proposedRetailNum}). Saving is permitted.`}
                                      >
                                        ≤0
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                                        +{(proposedRetailNum - proposedCostNum).toFixed(0)}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                      {(isCostOverridden || isRetailOverridden) && (
                                        <button
                                          type="button"
                                          onClick={() => handleResetRowToCommon(row.item.id)}
                                          style={{ padding: '3px 6px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', color: '#475569', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                          title="Reset overrides back to common input"
                                        >
                                          <RotateCcw style={{ width: 10, height: 10 }} />
                                          Reset
                                        </button>
                                      )}
                                      {row.status === 'success' && (
                                        <span style={{ color: '#059669', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                                          <Check style={{ width: 12, height: 12 }} /> Saved
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Concurrency Conflict or Error Resolution Banner */}
                                {row.status === 'conflict' && (
                                  <tr style={{ background: '#FEF2F2' }}>
                                    <td colSpan={8} style={{ padding: '8px 12px', borderTop: '1px dashed #FCA5A5', borderBottom: '1px solid #FECACA' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991B1B', fontSize: '11px' }}>
                                          <AlertTriangle style={{ width: 14, height: 14, color: '#DC2626' }} />
                                          <span>
                                            <strong>Concurrency Conflict:</strong> Another user updated prices on the server.
                                            {row.currentPrices && (
                                              <span> Latest server prices: Cost: Rs. {row.currentPrices.cost_price}, Retail: Rs. {row.currentPrices.retail_price}.</span>
                                            )}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleAcceptConflictPrice(row.item.id)}
                                            style={{
                                              padding: '3px 8px',
                                              background: '#FEE2E2',
                                              border: '1px solid #FCA5A5',
                                              borderRadius: '4px',
                                              color: '#991B1B',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Accept Latest Prices
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleForceProposedPrice(row.item.id)}
                                            style={{
                                              padding: '3px 8px',
                                              background: '#DC2626',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: '#ffffff',
                                              fontSize: '11px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Override with My Proposed Price
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}

                                {row.status === 'error' && (
                                  <tr style={{ background: '#FEF2F2' }}>
                                    <td colSpan={8} style={{ padding: '6px 12px', color: '#991B1B', fontSize: '11px' }}>
                                      <strong>Error:</strong> {row.errorMessage || 'Failed to update this product.'}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setShowBulkPriceModal(false);
                  setShowPriceReviewModal(false);
                }}
                style={{ padding: '8px 16px', background: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleOpenReview}
                disabled={changedRows.length === 0 || hasAnyInvalidInput || bulkPriceSubmitting}
                style={{
                  padding: '9px 20px',
                  background: changedRows.length === 0 || hasAnyInvalidInput || bulkPriceSubmitting ? '#94A3B8' : '#059669',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: changedRows.length === 0 || hasAnyInvalidInput || bulkPriceSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Review & Save Changes</span>
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                  {changedRows.length}
                </span>
                <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REVIEW BEFORE SAVE DRAWER ── */}
      {showPriceReviewModal && (
        <div className="pos-modal-overlay" style={{ alignItems: 'center', zIndex: 1100 }}>
          <div className="pos-modal-card" style={{ maxWidth: '780px', width: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>Review Price Changes</h3>
                <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Please confirm the {changedRows.length} product price update(s) before applying to database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPriceReviewModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
              <table className="inv-data-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '110px' }}>SKU</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Cost Change</th>
                    <th style={{ textAlign: 'right' }}>Retail Change</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {changedRows.map(({ row, costChanged, retailChanged, marginWarning, proposedCostNum, proposedRetailNum }) => (
                    <tr key={row.item.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#475569' }}>
                        {row.item.code}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{row.item.name}</span>
                        {row.item.shade_code && row.item.shade_code !== '—' && (
                          <span style={{ color: '#64748B', fontSize: '11px', marginLeft: '6px' }}>
                            ({row.item.shade_code})
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                        {costChanged ? (
                          <span>
                            <span style={{ color: '#94A3B8', textDecoration: 'line-through' }}>Rs. {Number(row.expectedCost).toLocaleString()}</span>
                            {' → '}
                            <strong style={{ color: '#0F172A' }}>Rs. {Number(row.costInput).toLocaleString()}</strong>
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Unchanged</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                        {retailChanged ? (
                          <span>
                            <span style={{ color: '#94A3B8', textDecoration: 'line-through' }}>Rs. {Number(row.expectedRetail).toLocaleString()}</span>
                            {' → '}
                            <strong style={{ color: '#0F172A' }}>Rs. {Number(row.retailInput).toLocaleString()}</strong>
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>Unchanged</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {marginWarning ? (
                          <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#B45309', padding: '2px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            ≤0
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                            +{(proposedRetailNum - proposedCostNum).toFixed(0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', background: '#F8FAFC' }}>
              <button
                type="button"
                onClick={() => setShowPriceReviewModal(false)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#334155', fontWeight: 700, fontSize: '12px', borderRadius: '6px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={bulkPriceSubmitting}
                onClick={handleSaveBulkPrices}
                style={{
                  flex: 2,
                  padding: '10px',
                  background: '#059669',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: bulkPriceSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: bulkPriceSubmitting ? 0.7 : 1,
                }}
              >
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                <span>{bulkPriceSubmitting ? 'Updating Database...' : `Confirm & Save ${changedRows.length} Product Price(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showOrderSheetModal && (
        <CompanyOrderSheetModal
          isOpen={showOrderSheetModal}
          onClose={() => setShowOrderSheetModal(false)}
          items={items}
          tenantName={tenantName}
        />
      )}
    </section>
  );
}