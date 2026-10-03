import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getDevSecret, DEV_ADMIN_COOKIE } from '@/lib/jwt-secrets';

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

    // PIN must come exclusively from environment variable DEV_ADMIN_PIN (no hardcoded fallback)
    const masterPin = (process.env.DEV_ADMIN_PIN || '').trim();
    if (!masterPin) {
      console.error('[SECURITY ERROR] DEV_ADMIN_PIN environment variable is not configured.');
      return NextResponse.json(
        { success: false, error: 'Developer authentication is not configured on this server.' },
        { status: 503 }
      );
    }

    if (!cleanPin || cleanPin !== masterPin) {
      return NextResponse.json(
        { success: false, error: 'Invalid Developer Master PIN' },
        { status: 401 }
      );
    }

    // Reset rate limiter on valid PIN authentication
    resetRateLimit(`dev-pin:${ip}`);

    // Sign developer super-admin token valid for 8 hours using strict high-entropy secret
    const token = await new SignJWT({
      role: 'developer',
      access: 'dev-panel',
      issuedAt: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(getDevSecret());

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

export async function DELETE() {
  try {
    const res = NextResponse.json({
      success: true,
      message: 'Developer session invalidated',
    });

    res.cookies.set(DEV_ADMIN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

