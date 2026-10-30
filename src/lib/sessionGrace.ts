/**
 * src/lib/sessionGrace.ts
 *
 * Phase 7: Session Grace Window
 *
 * Allows an already-logged-in POS session to continue billing offline for up to
 * 24 hours from the last successful server verification. After the window expires
 * the POS locks and the user must reconnect to verify their identity.
 *
 * Security rules:
 * - The raw password is NEVER stored — only claims (role, tenantId, userId, etc.)
 * - Grace window is exactly 24 hours (configurable constant only, not user-settable).
 * - On logout the grace record is cleared immediately.
 * - On 401 from sync engine → stop, show "session expired" — keep pending items.
 * - Revoked user's queued items go to `needs_attention`, never auto-dropped.
 *
 * Storage: sessionStorage  (cleared when browser tab closes, intentionally)
 * Key format: `pyntflow_session_grace:<tenantId>:<userId>`
 */

export const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours — locked by product owner
export const GRACE_SCHEMA_VERSION = 1;

export interface GraceClaims {
  role: string;
  tenantId: string;
  tenantSlug?: string;
  branchId?: string | null;
  userId: string;
  username: string;
  canUseSpecialReceipt: boolean;
}

export interface GraceRecord {
  /** ISO timestamp of the last successful server API response */
  lastServerVerifiedAt: string;
  cachedClaims: GraceClaims;
  schemaVersion: number;
}

export interface GraceStatus {
  withinGrace: boolean;
  minutesRemaining: number;
  hoursRemaining: number;
  cachedClaims: GraceClaims | null;
  lastVerifiedAt: string | null;
}

function graceKey(tenantId: string, userId: string): string {
  return `pyntflow_session_grace:${tenantId}:${userId}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Record a successful server verification for the given user.
 * Call this after every successful API response that requires auth.
 */
export function recordServerVerification(
  tenantId: string,
  userId: string,
  claims: GraceClaims
): void {
  const storage = getStorage();
  if (!storage) return;
  const record: GraceRecord = {
    lastServerVerifiedAt: new Date().toISOString(),
    cachedClaims: claims,
    schemaVersion: GRACE_SCHEMA_VERSION,
  };
  try {
    storage.setItem(graceKey(tenantId, userId), JSON.stringify(record));
  } catch (err) {
    console.warn('[SessionGrace] Failed to record server verification:', err);
  }
}

/**
 * Check whether the user is within their 24-hour offline grace window.
 * Returns { withinGrace: false } if no record exists or the window has expired.
 */
export function getGraceStatus(tenantId: string, userId: string): GraceStatus {
  const storage = getStorage();
  if (!storage) {
    return { withinGrace: false, minutesRemaining: 0, hoursRemaining: 0, cachedClaims: null, lastVerifiedAt: null };
  }

  let record: GraceRecord | null = null;
  try {
    const raw = storage.getItem(graceKey(tenantId, userId));
    if (raw) record = JSON.parse(raw) as GraceRecord;
  } catch {
    // corrupt — treat as expired
  }

  if (!record) {
    return { withinGrace: false, minutesRemaining: 0, hoursRemaining: 0, cachedClaims: null, lastVerifiedAt: null };
  }

  const lastVerified = new Date(record.lastServerVerifiedAt).getTime();
  const elapsed = Date.now() - lastVerified;
  const remaining = GRACE_WINDOW_MS - elapsed;

  if (remaining <= 0) {
    return {
      withinGrace: false,
      minutesRemaining: 0,
      hoursRemaining: 0,
      cachedClaims: record.cachedClaims,
      lastVerifiedAt: record.lastServerVerifiedAt,
    };
  }

  return {
    withinGrace: true,
    minutesRemaining: Math.floor(remaining / 60_000),
    hoursRemaining: Math.floor(remaining / 3_600_000),
    cachedClaims: record.cachedClaims,
    lastVerifiedAt: record.lastServerVerifiedAt,
  };
}

/**
 * Clear the grace record for a user — call on logout.
 */
export function clearGrace(tenantId: string, userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(graceKey(tenantId, userId));
  } catch {
    // ignore
  }
}

