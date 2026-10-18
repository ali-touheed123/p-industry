export interface BulkRowDraft {
  id: number;
  shadeName: string;
  code: string;
  retail: string;
  cost: string;
  qty: string;
  retailOverridden?: boolean;
  costOverridden?: boolean;
}

export interface BulkDraftState {
  tenantId: string;
  brand: string;
  brandId: string;
  seriesId: string;
  category: string;
  unit: string;
  minAlert: string;
  costPrice: string;
  retailPrice: string;
  rows: BulkRowDraft[];
  nextId: number;
  timestamp: number;
}

// Module-level in-memory singleton registry scoped strictly by tenantId.
// Zero persistent browser storage (no localStorage, no sessionStorage, no cookies, no database tables).
const registry = new Map<string, BulkDraftState>();

export function getBulkDraft(tenantId?: string | null): BulkDraftState | null {
  if (!tenantId || typeof tenantId !== 'string') return null;
  return registry.get(tenantId) || null;
}

export function setBulkDraft(
  tenantId: string,
  draft: Omit<BulkDraftState, 'tenantId' | 'timestamp'>
): void {
  if (!tenantId || typeof tenantId !== 'string') return;
  registry.set(tenantId, {
    ...draft,
    tenantId,
    timestamp: Date.now(),
  });
}

export function clearBulkDraft(tenantId?: string | null): void {
  if (!tenantId || typeof tenantId !== 'string') return;
  registry.delete(tenantId);
}

export function clearAllBulkDrafts(): void {
  registry.clear();
}

export function hasBulkDraft(tenantId?: string | null): boolean {
  if (!tenantId || typeof tenantId !== 'string') return false;
  return registry.has(tenantId);
}
