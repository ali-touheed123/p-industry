import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const DEV_SECRET = new TextEncoder().encode(
  process.env.DEV_ADMIN_SECRET || process.env.SESSION_SECRET || 'pyntflow-dev-secret-super-key-32-chars-min!'
);

const DEV_ADMIN_COOKIE = 'aura_dev_token';

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    const envPin = process.env.DEV_ADMIN_PIN;
    const cleanPin = String(pin || '').trim();

    // Accepted PINs: explicitly configured env PIN, or defaults 'dev2026' and '1234'
    const validPins = [
      'dev2026',
      '1234',
      ...(envPin ? [String(envPin).trim()] : []),
    ];

    if (!cleanPin || !validPins.includes(cleanPin)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Developer Master PIN' },
        { status: 401 }
      );
    }

    // Sign developer super-admin token valid for 8 hours
    const token = await new SignJWT({
      role: 'developer',
      access: 'dev-panel',
      issuedAt: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(DEV_SECRET);

    const res = NextResponse.json({
      success: true,
      token,
      message: 'Developer authenticated successfully',
    });

    res.cookies.set(DEV_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
