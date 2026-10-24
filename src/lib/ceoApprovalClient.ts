/**
 * Client-side storage + fetch helper for the CEO approval token (1 hour, per browser tab).
 * The token only unlocks the protected actions for the staff user that earned it;
 * the server re-validates it on every protected request.
 */
const STORAGE_KEY = 'pyntflow_ceo_approval_v1';
export const CEO_APPROVAL_HEADER = 'x-ceo-approval';

interface StoredApproval {
  token: string;
  expiresAt: number;
  tenantId: string;
}

let memoryApproval: StoredApproval | null = null;

function readStored(): StoredApproval | null {
  if (memoryApproval) return memoryApproval;
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredApproval;
    if (parsed && parsed.token && parsed.expiresAt) {
      memoryApproval = parsed;
      return parsed;
    }
  } catch {
    // storage unavailable — fall through
  }
  return null;
}

export function getCeoApproval(tenantId?: string | null): StoredApproval | null {
  const a = readStored();
  if (!a) return null;
  // 30s safety margin so a token never expires mid-request
  if (a.expiresAt - 30_000 <= Date.now()) {
    clearCeoApproval();
    return null;
  }
  if (tenantId && a.tenantId !== tenantId) return null;
  return a;
}

export function setCeoApproval(tenantId: string, token: string, expiresAt: number): void {
  memoryApproval = { token, expiresAt, tenantId };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryApproval));
  } catch {
    // ignore storage failures; memory copy still works for this page load
  }
}

export function clearCeoApproval(): void {
  memoryApproval = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** fetch() that attaches the CEO approval header when one is held; clears it if the server rejects it. */
export async function ceoFetch(input: string, init: RequestInit = {}, tenantId?: string | null): Promise<Response> {
  const approval = getCeoApproval(tenantId);
  const headers = new Headers(init.headers || {});
  if (approval) headers.set(CEO_APPROVAL_HEADER, approval.token);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 403) {
    try {
      const body = await res.clone().json();
      if (body?.code === 'CEO_APPROVAL_REQUIRED') clearCeoApproval();
    } catch {
      // not JSON
    }
  }
  return res;
}
