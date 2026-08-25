import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'pyntflow-super-secret-key-change-in-production-min-32-chars-key!'
);

export const SESSION_COOKIE_NAME = 'pyntflow_session';

export interface UserSession {
  userId: string;
  username: string;
  role: 'developer' | 'ceo' | 'staff' | 'godown_staff';
  tenantId?: string;
  tenantSlug?: string;
}

/**
 * Creates an encrypted JWT session token.
 */
export async function createSessionToken(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Validates session from incoming request (cookies or Authorization header).
 */
export async function getSession(req: NextRequest): Promise<UserSession | null> {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');

  const token = cookie || authHeader;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

/**
 * Helper to enforce tenant authorization on API routes.
 */
export async function requireTenantAuth(req: NextRequest, targetTenantId?: string | null) {
  const session = await getSession(req);

  if (!session) {
    return { authorized: false, error: 'Unauthorized: Login session required', status: 401, session: null };
  }

  // Developer Super Admin has access to all branches
  if (session.role === 'developer') {
    return { authorized: true, session };
  }

  // Staff and CEO must match the tenant they are accessing
  if (targetTenantId && session.tenantId !== targetTenantId) {
    return { authorized: false, error: 'Forbidden: Access to this branch is denied', status: 403, session };
  }

  return { authorized: true, session };
}
