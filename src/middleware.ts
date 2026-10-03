import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  getJwtSecret,
  getDevSecret,
  SESSION_COOKIE_NAME,
  DEV_ADMIN_COOKIE,
} from '@/lib/jwt-secrets';

/**
 * Public endpoints under /api/* that do not require an active session.
 */
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/dev-pin',
  '/api/auth/logout',
];

/**
 * Centralized Edge Middleware for PyntFlow.
 * Enforces edge-level perimeter authentication and filters unauthenticated requests
 * before reaching Next.js API Route Handlers.
 */
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Only intercept /api/* routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Allow OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // 1. Whitelist public authentication endpoints
  if (PUBLIC_API_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // 2. Whitelist public tenant slug lookup (used by cashier/staff login screens to load branding)
  if (pathname === '/api/tenants' && req.method === 'GET') {
    if (req.nextUrl.searchParams.has('slug')) {
      return NextResponse.next();
    }
  }

  // 3. Extract credentials from cookies or Authorization header
  const userCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const devCookie = req.cookies.get(DEV_ADMIN_COOKIE)?.value;
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

  const token = userCookie || devCookie || authHeader;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Authentication credentials required',
      },
      { status: 401 }
    );
  }

  // 4. Verify cryptographic signature of session token
  let authenticated = false;

  // Try user session secret
  try {
    const jwtSecret = getJwtSecret();
    await jwtVerify(token, jwtSecret);
    authenticated = true;
  } catch {
    // If user token verification failed, try developer admin secret
    try {
      const devSecret = getDevSecret();
      await jwtVerify(token, devSecret);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Invalid or expired session token',
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

// Next.js 16 proxy convention compatibility
export const proxy = middleware;
export default middleware;

export const config = {
  matcher: ['/api/:path*'],
};
