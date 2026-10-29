/**
 * src/lib/cartDraftStore.ts
 *
 * Phase 3: Cart Auto-Save & Recovery Store (Crash / Refresh Resilience)
 *
 * Security Review & Data Privacy (Task 3.7):
 * - STORED: Line items (product name, code, qty, rate, discount), customer walk-in name,
 *   selected client reference, remarks, discount, delivery charge, payment breakdown,
 *   and active checkout idempotency keys.
 * - STRICTLY PROHIBITED & NEVER STORED: Passwords, CEO approval tokens, JWT tokens,
 *   credit card numbers, bank credentials.
 * - SCOPED STORAGE (Task 3.2): Keyed strictly by `${tenantId}:${branchId}:${userId}` to
 *   prevent draft leaking across tenants, branches, or different user accounts on shared devices.
 * - LIFECYCLE (Task 3.5): Cleared on successful sale completion, explicit "Cancel / Clear Cart",
 *   or user logout.
 */

import { Item } from '@/types';
import { InvoiceLineItem } from '@/components/PosBilling';

export const CART_DRAFT_SCHEMA_VERSION = 1;
export const CART_DRAFT_STORAGE_PREFIX = 'pyntflow_cart_draft:';

export interface CartDraftContent {
  lineItems: InvoiceLineItem[];
  invoiceType: 'sales' | 'return';
  selectedClient: any | null;
  customerSearch: string;
  remarks: string;
  invoiceDiscount: number;
  deliveryCharge: number;
  cashPayment: number;
  cardPayment: number;
  bankPayment: number;
  othersPayment: number;
  activeCheckoutKey?: string | null;
  activeSpecialCheckoutKey?: string | null;
  activeHeldOrderId?: string | null;
}

export interface CartDraftPayload {
  schemaVersion: number;
  tenantId: string;
  branchId: string;
  userId: string;
  updatedAt: string; // ISO 8601 string
  cart: CartDraftContent;
}

export interface RateRevalidationResult {
  hasChanges: boolean;
  warnings: Array<{
    itemId: string;
    productName: string;
    cartRate: number;
    catalogRate: number;
  }>;
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Builds the strictly scoped localStorage key for a draft.
 */
export function buildCartDraftKey(tenantId: string, branchId: string, userId: string): string {
  const safeTenant = (tenantId || 'unknown_tenant').trim();
  const safeBranch = (branchId || safeTenant).trim();
  const safeUser = (userId || 'anonymous').trim();
  return `${CART_DRAFT_STORAGE_PREFIX}${safeTenant}:${safeBranch}:${safeUser}`;
}

/**
 * Saves in-progress cart draft to localStorage.
 * Handles storage quota limits gracefully without crashing.
 */
export function saveCartDraft(
  tenantId: string,
  branchId: string,
  userId: string,
  cart: CartDraftContent
): boolean {
  const storage = getStorage();
  if (!storage) return false;
  if (!tenantId || !userId) return false;

  // Don't persist empty drafts
  const hasContent =
    (cart.lineItems && cart.lineItems.length > 0) ||
    Boolean(cart.customerSearch && cart.customerSearch.trim()) ||
    Boolean(cart.selectedClient) ||
    (cart.invoiceDiscount && cart.invoiceDiscount > 0) ||
    (cart.deliveryCharge && cart.deliveryCharge > 0);

  if (!hasContent) {
    clearCartDraft(tenantId, branchId, userId);
    return true;
  }

  const key = buildCartDraftKey(tenantId, branchId, userId);
  const payload: CartDraftPayload = {
    schemaVersion: CART_DRAFT_SCHEMA_VERSION,
    tenantId,
    branchId: branchId || tenantId,
    userId,
    updatedAt: new Date().toISOString(),
    cart: {
      lineItems: cart.lineItems || [],
      invoiceType: cart.invoiceType || 'sales',
      selectedClient: cart.selectedClient || null,
      customerSearch: cart.customerSearch || '',
      remarks: cart.remarks || '',
      invoiceDiscount: Number(cart.invoiceDiscount) || 0,
      deliveryCharge: Number(cart.deliveryCharge) || 0,
      cashPayment: Number(cart.cashPayment) || 0,
      cardPayment: Number(cart.cardPayment) || 0,
      bankPayment: Number(cart.bankPayment) || 0,
      othersPayment: Number(cart.othersPayment) || 0,
      activeCheckoutKey: cart.activeCheckoutKey || null,
      activeSpecialCheckoutKey: cart.activeSpecialCheckoutKey || null,
      activeHeldOrderId: cart.activeHeldOrderId || null,
    },
  };

  try {
    storage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    console.warn('[CartDraftStore] Failed to save cart draft (storage quota or access issue):', err);
    return false;
  }
}

/**
 * Loads and validates an in-progress cart draft from localStorage.
 * Discards drafts with incompatible schema version or mismatched tenant/user scope.
 */
export function loadCartDraft(
  tenantId: string,
  branchId: string,
  userId: string
): CartDraftPayload | null {
  const storage = getStorage();
  if (!storage) return null;
  if (!tenantId || !userId) return null;

  const key = buildCartDraftKey(tenantId, branchId, userId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const data: CartDraftPayload = JSON.parse(raw);

    // Schema version check (Task 3.6)
    if (!data || data.schemaVersion !== CART_DRAFT_SCHEMA_VERSION) {
      console.warn('[CartDraftStore] Incompatible schema version. Discarding stale draft.');
      storage.removeItem(key);
      return null;
    }

    // Security scope verification (Task 3.2)
    if (data.tenantId !== tenantId || data.userId !== userId) {
      console.warn('[CartDraftStore] Scope mismatch detected. Refusing to load draft.');
      return null;
    }

    // Check if cart has meaningful items
    if (!data.cart || (!data.cart.lineItems?.length && !data.cart.selectedClient && !data.cart.customerSearch?.trim())) {
      storage.removeItem(key);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[CartDraftStore] Error reading or parsing draft from localStorage:', err);
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
}

/**
 * Explicitly removes the draft for the specified tenant, branch, and user.
 */
export function clearCartDraft(tenantId: string, branchId: string, userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const key = buildCartDraftKey(tenantId, branchId, userId);
    storage.removeItem(key);
  } catch (err) {
    console.warn('[CartDraftStore] Failed to clear cart draft:', err);
  }
}

/**
 * Clears all cart drafts across all users and tenants from localStorage.
 * Used during logout (Task 3.5) to guarantee clean state on shared POS terminals.
 */
export function clearAllCartDrafts(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(CART_DRAFT_STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch (err) {
    console.warn('[CartDraftStore] Failed to clear all cart drafts:', err);
  }
}

/**
 * Re-validates draft items against the live item catalog (Task 3.8).
 * Checks if current retail rates have changed since the draft was saved.
 */
export function validateCartDraftRates(
  draftItems: InvoiceLineItem[],
  catalogItems: Item[]
): RateRevalidationResult {
  const warnings: RateRevalidationResult['warnings'] = [];
  if (!draftItems || !draftItems.length || !catalogItems || !catalogItems.length) {
    return { hasChanges: false, warnings };
  }

  const catalogMap = new Map<string, Item>();
  for (const item of catalogItems) {
    if (item.id) catalogMap.set(item.id, item);
    if (item.code) catalogMap.set(item.code, item);
  }

  for (const line of draftItems) {
    const catalogMatch = (line.id && catalogMap.get(line.id)) || (line.code && catalogMap.get(line.code));
    if (!catalogMatch) continue;

    const catalogPrice = Number(catalogMatch.retail_price ?? catalogMatch.cost_price ?? 0);
    const cartPrice = Number(line.specialRate !== undefined ? line.specialRate : line.rate);

    // If regular rate differs by more than 0.01 Rs
    if (catalogPrice > 0 && Math.abs(cartPrice - catalogPrice) > 0.01) {
      warnings.push({
        itemId: line.id,
        productName: line.productName || catalogMatch.name,
        cartRate: cartPrice,
        catalogRate: catalogPrice,
      });
    }
  }

  return {
    hasChanges: warnings.length > 0,
    warnings,
  };
}
