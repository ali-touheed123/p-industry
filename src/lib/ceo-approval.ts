import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { getJwtSecret } from './jwt-secrets';
import type { UserSession } from './session';
import { supabaseAdmin } from './supabase';

/**
 * CEO approval — a short-lived, tenant- and user-bound token that a staff session
 * receives after entering a CEO password. Protected routes (stock adjustment, price
 * edits, product edits, receipt settings) require it for staff roles.
 *
 * The token is signed with a key DERIVED from the session secret so it can never be
 * accepted as a normal session cookie, and carries its own audience claim.
 */
export const CEO_APPROVAL_HEADER = 'x-ceo-approval';
export const CEO_APPROVAL_TTL_SEC = 60 * 60; // 1 hour
const CEO_APPROVAL_AUDIENCE = 'pyntflow-ceo-approval';

function getApprovalKey(): Uint8Array {
  const base = getJwtSecret();
  const suffix = new TextEncoder().encode(':ceo-approval:v1');
  const key = new Uint8Array(base.length + suffix.length);
  key.set(base, 0);
  key.set(suffix, base.length);
  return key;
}

/** Roles that already are the CEO (or above) and never need the approval token. */
export function isCeoLevelRole(role?: string | null): boolean {
  return role === 'ceo' || role === 'developer';
}

export async function createCeoApprovalToken(
  session: UserSession
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + CEO_APPROVAL_TTL_SEC * 1000;
  const token = await new SignJWT({
    userId: session.userId,
    tenantId: session.tenantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(CEO_APPROVAL_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CEO_APPROVAL_TTL_SEC}s`)
    .sign(getApprovalKey());
  return { token, expiresAt };
}

export async function hasValidCeoApproval(
  req: NextRequest,
  session: UserSession
): Promise<boolean> {
  if (isCeoLevelRole(session.role)) return true;
  const token = req.headers.get(CEO_APPROVAL_HEADER);
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getApprovalKey(), {
      audience: CEO_APPROVAL_AUDIENCE,
    });
    return payload.userId === session.userId && payload.tenantId === session.tenantId;
  } catch {
    return false;
  }
}

export type CeoGateResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * Call AFTER requireTenantAuth succeeded. Staff sessions must present a valid approval token,
 * UNLESS the branch has CEO password requirement disabled (require_ceo_pass === false).
 */
export async function requireCeoApproval(
  req: NextRequest,
  session: UserSession,
  tenantId?: string | null
): Promise<CeoGateResult> {
  if (isCeoLevelRole(session.role)) return { ok: true };
  if (await hasValidCeoApproval(req, session)) return { ok: true };

  // Check if this tenant has master CEO pass switch disabled
  const targetTenantId = tenantId || session.tenantId;
  if (targetTenantId) {
    try {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('require_ceo_pass')
        .eq('id', targetTenantId)
        .maybeSingle();

      if (tenant && tenant.require_ceo_pass === false) {
        return { ok: true };
      }
    } catch {
      // Fall through to requiring approval on DB error
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        error: 'CEO approval required. Please enter the CEO password.',
        code: 'CEO_APPROVAL_REQUIRED',
      },
      { status: 403 }
    ),
  };
}
