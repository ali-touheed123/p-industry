import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

import { sanitizePostgRESTLike } from '@/lib/utils';

export {
  getJwtSecret,
  getDevSecret,
  SESSION_COOKIE_NAME,
  DEV_ADMIN_COOKIE,
} from './jwt-secrets';
import { getJwtSecret, getDevSecret, SESSION_COOKIE_NAME, DEV_ADMIN_COOKIE } from './jwt-secrets';

export interface UserSession {
  userId: string;
  username: string;
  role: 'developer' | 'ceo' | 'staff' | 'godown_staff';
  tenantId?: string;
  tenantSlug?: string;
  ownerId?: string;
  canUseSpecialReceipt?: boolean;
  ceoTenants?: Array<{ id: string; slug: string; name?: string }>;
  jti?: string;
}

/**
 * Checks if a JWT session (by JTI) has been explicitly revoked on the server.
 */
export async function isSessionRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;
  try {
    const { data } = await supabaseAdmin
      .from('revoked_sessions')
      .select('jti')
      .eq('jti', jti)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Revokes a session by adding its JTI to the revoked_sessions table.
 */
export async function revokeSession(jti: string, userId?: string, expiresAtSec?: number): Promise<void> {
  if (!jti) return;
  try {
    const expiresAt = expiresAtSec
      ? new Date(expiresAtSec * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('revoked_sessions')
      .insert({
        jti,
        user_id: userId || null,
        expires_at: expiresAt,
      });
  } catch (err) {
    console.error('[SessionRevocation] Failed to revoke session token:', err);
  }
}

/**
 * Creates an encrypted JWT session token with a unique JTI claim.
 */
export async function createSessionToken(payload: UserSession): Promise<string> {
  const jti = payload.jti || crypto.randomUUID();
  return new SignJWT({ ...payload, jti })
    .setJti(jti)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

/**
 * Validates session from incoming request (cookies or Authorization header).
 * Supports both standard user sessions and developer admin tokens.
 * Checks server-side revocation list.
 */
export async function getSession(req: NextRequest): Promise<UserSession | null> {
  const userCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const devCookie = req.cookies.get(DEV_ADMIN_COOKIE)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');

  // 1. Explicit Authorization header takes highest priority (used by Dev Panel and API callers)
  if (authHeader) {
    // Try developer secret first
    try {
      const { payload } = await jwtVerify(authHeader, getDevSecret());
      if ((payload as any).role === 'developer') {
        return {
          userId: 'developer-super-admin',
          username: 'developer',
          role: 'developer',
        };
      }
    } catch {
      // Not a dev token, try standard user JWT
    }

    try {
      const { payload } = await jwtVerify(authHeader, getJwtSecret());
      const jti = (payload as any).jti || (payload as any).jti_claim;

      if (jti && (await isSessionRevoked(jti))) {
        return null;
      }

      return payload as unknown as UserSession;
    } catch {
      // Invalid authHeader token
    }
  }

  // 2. Standard user session cookie takes priority over dev cookie.
  //    This ensures a cashier logged in on a branch route (/[slug]) is not
  //    hijacked by a dev admin cookie that may also exist in the same browser.
  if (userCookie) {
    try {
      const { payload } = await jwtVerify(userCookie, getJwtSecret());
      const jti = (payload as any).jti || (payload as any).jti_claim;

      if (jti && (await isSessionRevoked(jti))) {
        return null;
      }

      return payload as unknown as UserSession;
    } catch {
      // Invalid user token — fall through to dev cookie
    }
  }

  // 3. Developer admin cookie as fallback (only reached when no valid user session exists)
  if (devCookie) {
    try {
      const { payload } = await jwtVerify(devCookie, getDevSecret());
      if ((payload as any).role === 'developer') {
        return {
          userId: 'developer-super-admin',
          username: 'developer',
          role: 'developer',
        };
      }
    } catch {
      // Invalid dev cookie
    }
  }

  return null;
}

/**
 * Helper to enforce tenant authorization on API routes.
 * Ensures the caller is authenticated and either a developer or belongs to the target tenant.
 */
export type AuthResult =
  | { authorized: true; session: UserSession; error?: string; status?: number }
  | { authorized: false; error: string; status: number; session: UserSession | null };

export async function requireTenantAuth(
  req: NextRequest,
  targetTenantId?: string | null
): Promise<AuthResult> {
  const session = await getSession(req);

  if (!session) {
    return { authorized: false, error: 'Unauthorized: Valid login session required', status: 401, session: null };
  }

  // Developer Super Admin has full multi-tenant access
  if (session.role === 'developer') {
    return { authorized: true, session };
  }

  // Strict Tenant Isolation: Non-developers MUST have a tenantId assigned
  if (!session.tenantId) {
    return { authorized: false, error: 'Forbidden: No tenant assigned to this session', status: 403, session };
  }

  if (targetTenantId) {
    // 1. Direct match with primary tenant ID or slug
    if (session.tenantId === targetTenantId || session.tenantSlug === targetTenantId) {
      return { authorized: true, session };
    }

    // 2. Multi-Branch CEO Authorization
    if (session.role === 'ceo') {
      // Check session JWT cached sister branches
      if (session.ceoTenants && session.ceoTenants.some((t) => t.id === targetTenantId || t.slug === targetTenantId)) {
        return { authorized: true, session };
      }

      // Check database
      try {
        // Query target tenant
        const { data: targetTenant } = await supabaseAdmin
          .from('tenants')
          .select('id, slug, owner_id, owner_name, email, is_active')
          .or(`id.eq.${targetTenantId},slug.eq.${targetTenantId}`)
          .maybeSingle();

        if (targetTenant && targetTenant.is_active) {
          // Priority 1: Check by ownerId (new clean foreign key path)
          let ceoOwnerId = session.ownerId;
          let primaryTenant: { owner_id?: string | null; owner_name?: string | null; email?: string | null } | null = null;

          // Gracefully resolve ownerId for old JWTs where ownerId wasn't embedded
          if (!ceoOwnerId && session.tenantId) {
            const { data: pt } = await supabaseAdmin
              .from('tenants')
              .select('owner_id, owner_name, email')
              .eq('id', session.tenantId)
              .maybeSingle();
            primaryTenant = pt;
            ceoOwnerId = pt?.owner_id || undefined;
          }

          if (ceoOwnerId && targetTenant.owner_id && ceoOwnerId === targetTenant.owner_id) {
            return { authorized: true, session };
          }

          // Priority 2: Fallback path (owner_name / email match) with sanitized values
          if (!primaryTenant && session.tenantId) {
            const { data: pt } = await supabaseAdmin
              .from('tenants')
              .select('owner_name, email')
              .eq('id', session.tenantId)
              .maybeSingle();
            primaryTenant = pt;
          }

          if (primaryTenant) {
            const safeOwner = sanitizePostgRESTLike(primaryTenant.owner_name);
            const safeEmail = sanitizePostgRESTLike(primaryTenant.email);

            const isOwnerMatch = safeOwner && targetTenant.owner_name && safeOwner.toLowerCase() === targetTenant.owner_name.toLowerCase();
            const isEmailMatch = safeEmail && targetTenant.email && safeEmail.toLowerCase() === targetTenant.email.toLowerCase();

            if (isOwnerMatch || isEmailMatch) {
              return { authorized: true, session };
            }
          }
        }
      } catch (err) {
        console.error('Failed to verify sister branch ownership:', err);
      }
    }

    // Staff or unauthorized cross-branch attempt
    return { authorized: false, error: 'Forbidden: Access to this branch is denied', status: 403, session };
  }

  return { authorized: true, session };
}

/**
 * Helper to enforce developer-only authorization.
 */
export async function requireDevAuth(req: NextRequest): Promise<AuthResult> {
  const session = await getSession(req);

  if (session && session.role === 'developer') {
    return { authorized: true, session };
  }

  // Fallback: check devCookie and authHeader directly
  const devCookie = req.cookies.get(DEV_ADMIN_COOKIE)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  const devToken = devCookie || authHeader;
  if (devToken) {
    try {
      const { payload } = await jwtVerify(devToken, getDevSecret());
      if ((payload as any).role === 'developer') {
        return {
          authorized: true,
          session: {
            userId: 'developer-super-admin',
            username: 'developer',
            role: 'developer',
          } as UserSession,
        };
      }
    } catch {
      // Invalid dev token
    }
  }

  if (!session) {
    return { authorized: false, error: 'Unauthorized: Login session required', status: 401, session: null };
  }

  return { authorized: false, error: 'Forbidden: Developer privileges required', status: 403, session };
}
