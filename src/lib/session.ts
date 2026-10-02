import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function getJwtSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.DEV_ADMIN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET environment variable is missing.');
    }
    return new TextEncoder().encode('pyntflow-dev-local-only-fallback-secret-min-32-chars!');
  }
  return new TextEncoder().encode(secret);
}

function getDevSecret(): Uint8Array {
  const secret = process.env.DEV_ADMIN_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    return new TextEncoder().encode('pyntflow-dev-secret-super-key-32-chars-min!');
  }
  return new TextEncoder().encode(secret);
}

export const SESSION_COOKIE_NAME = 'pyntflow_session';
export const DEV_ADMIN_COOKIE = 'aura_dev_token';

export interface UserSession {
  userId: string;
  username: string;
  role: 'developer' | 'ceo' | 'staff' | 'godown_staff';
  tenantId?: string;
  tenantSlug?: string;
  ceoTenants?: Array<{ id: string; slug: string; name?: string }>;
}

/**
 * Creates an encrypted JWT session token.
 */
export async function createSessionToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

/**
 * Validates session from incoming request (cookies or Authorization header).
 * Supports both standard user sessions and developer admin tokens.
 */
export async function getSession(req: NextRequest): Promise<UserSession | null> {
  const userCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const devCookie = req.cookies.get(DEV_ADMIN_COOKIE)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');

  // 1. Try developer admin token FIRST (cookie or Authorization header)
  const devToken = devCookie || authHeader;
  if (devToken) {
    try {
      const { payload } = await jwtVerify(devToken, getDevSecret());
      if ((payload as any).role === 'developer') {
        return {
          userId: 'developer-super-admin',
          username: 'developer',
          role: 'developer',
        };
      }
    } catch {
      // Invalid dev token, proceed to check standard user session
    }
  }

  // 2. Try standard user session
  const primaryToken = userCookie || authHeader;
  if (primaryToken) {
    try {
      const { payload } = await jwtVerify(primaryToken, getJwtSecret());
      return payload as unknown as UserSession;
    } catch {
      // Invalid user token
    }
  }

  return null;
}

/**
 * Helper to enforce tenant authorization on API routes.
 * Ensures the caller is authenticated and either a developer or belongs to the target tenant.
 */
export async function requireTenantAuth(req: NextRequest, targetTenantId?: string | null) {
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

      // Check database: verify target tenant shares owner_name or email with the CEO's primary branch
      try {
        const { data: primaryTenant } = await supabaseAdmin
          .from('tenants')
          .select('owner_name, email')
          .eq('id', session.tenantId)
          .maybeSingle();

        if (primaryTenant && (primaryTenant.owner_name || primaryTenant.email)) {
          let sisterQuery = supabaseAdmin
            .from('tenants')
            .select('id, slug')
            .or(`id.eq.${targetTenantId},slug.eq.${targetTenantId}`)
            .eq('is_active', true);

          if (primaryTenant.owner_name && primaryTenant.email) {
            sisterQuery = sisterQuery.or(`owner_name.eq.${primaryTenant.owner_name},email.eq.${primaryTenant.email}`);
          } else if (primaryTenant.owner_name) {
            sisterQuery = sisterQuery.eq('owner_name', primaryTenant.owner_name);
          } else if (primaryTenant.email) {
            sisterQuery = sisterQuery.eq('email', primaryTenant.email);
          }

          const { data: sisterTenant } = await sisterQuery.maybeSingle();
          if (sisterTenant) {
            return { authorized: true, session };
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
export async function requireDevAuth(req: NextRequest) {
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
