import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPassword, hashPassword } from '@/lib/auth-passwords';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    
    // 1. Rate Limiting: max 5 failed/consecutive attempts per 5 mins per IP
    const limit = checkRateLimit(ip, 5, 5 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: `Too many login attempts. Please wait ${limit.retryAfterSec} seconds before trying again.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    const { username, password, target_slug, slug } = await req.json();
    const effectiveSlug = target_slug || slug;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 2. Query user
    const { data: user, error: userErr } = await supabaseAdmin
      .from('app_users')
      .select('*, tenants(*)')
      .eq('username', cleanUsername)
      .eq('is_active', true)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ success: false, error: 'Invalid username or inactive account' }, { status: 401 });
    }

    // 3. Verify password securely using bcrypt (with automatic fallback for plaintext)
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
    }

    // Auto-upgrade plain-text password to bcrypt hash on successful authentication
    if (!user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
      try {
        const secureHash = await hashPassword(password);
        await supabaseAdmin
          .from('app_users')
          .update({ password_hash: secureHash })
          .eq('id', user.id);
      } catch (upgradeErr) {
        console.error('Failed to auto-upgrade password hash:', upgradeErr);
      }
    }

    // Reset rate limit upon successful login
    resetRateLimit(ip);

    // Prepare response user object (never leak password hash)
    let sanitizedUser: any = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    let sessionTenantId = user.tenant_id;
    let sessionTenantSlug = user.tenants?.slug;

    // Developer Super Admin
    if (user.role === 'developer') {
      sanitizedUser.tenant = null;
    } else if (effectiveSlug) {
      // If logging into a specific branch slug
      const { data: targetTenant } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('slug', effectiveSlug.trim().toLowerCase())
        .single();

      if (!targetTenant) {
        return NextResponse.json({ success: false, error: 'Shop or Godown not found' }, { status: 404 });
      }

      if (user.role === 'ceo') {
        const { data: ceoAccess } = await supabaseAdmin
          .from('ceo_tenants')
          .select('*')
          .eq('user_id', user.id)
          .eq('tenant_id', targetTenant.id)
          .single();

        if (user.tenant_id !== targetTenant.id && !ceoAccess) {
          return NextResponse.json({ success: false, error: 'You do not have CEO access to this branch' }, { status: 403 });
        }
      } else {
        // Staff role: must match tenant
        if (user.tenant_id !== targetTenant.id) {
          return NextResponse.json({ success: false, error: 'Staff account is not authorized for this branch' }, { status: 403 });
        }
      }

      sanitizedUser.tenant = targetTenant;
      sessionTenantId = targetTenant.id;
      sessionTenantSlug = targetTenant.slug;
    } else {
      sanitizedUser.tenant = user.tenants;
    }

    // 4. Issue encrypted JWT session token
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: sessionTenantId,
      tenantSlug: sessionTenantSlug,
    });

    const res = NextResponse.json({
      success: true,
      user: sanitizedUser,
      token,
    });

    // 5. Set secure HTTP-only cookie
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
