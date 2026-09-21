import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

function getDevAdminSecret(): Uint8Array {
  const secret = process.env.DEV_ADMIN_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: DEV_ADMIN_SECRET or SESSION_SECRET must be configured in production.');
    }
    return new TextEncoder().encode('pyntflow-dev-secret-super-key-32-chars-min!');
  }
  return new TextEncoder().encode(secret);
}

const DEV_ADMIN_COOKIE = 'aura_dev_token';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // 1. Rate Limiting: Max 5 attempts per 15 minutes per IP (Brute-Force Shield)
    const rateCheck = checkRateLimit(`dev-pin:${ip}`, 5, 15 * 60 * 1000);
    if (!rateCheck.success) {
      const waitMin = Math.ceil(rateCheck.retryAfterSec / 60);
      return NextResponse.json(
        {
          success: false,
          error: `Security Lockout: Too many failed attempts. Try again in ${waitMin} minute${waitMin > 1 ? 's' : ''}.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSec) },
        }
      );
    }

    const { pin } = await req.json();
    const cleanPin = String(pin || '').trim();

    // In production, PIN must come exclusively from environment variable
    const masterPin = (process.env.DEV_ADMIN_PIN || (process.env.NODE_ENV !== 'production' ? 'dev2026' : '')).trim();

    if (!masterPin || !cleanPin || cleanPin !== masterPin) {
      return NextResponse.json(
        { success: false, error: 'Invalid Developer Master PIN' },
        { status: 401 }
      );
    }

    // Reset rate limiter on valid PIN authentication
    resetRateLimit(`dev-pin:${ip}`);

    // Sign developer super-admin token valid for 8 hours
    const token = await new SignJWT({
      role: 'developer',
      access: 'dev-panel',
      issuedAt: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(getDevAdminSecret());

    const res = NextResponse.json({
      success: true,
      token,
      message: 'Developer authenticated successfully',
    });

    res.cookies.set(DEV_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
