import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE_NAME, getJwtSecret, revokeSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value || req.headers.get('authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const jti = (payload as any).jti || (payload as any).jti_claim;
      const userId = (payload as any).userId;
      const exp = payload.exp;

      if (jti) {
        await revokeSession(jti, userId, exp);
      }
    } catch {
      // Ignore invalid or expired token on logout
    }
  }

  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}
