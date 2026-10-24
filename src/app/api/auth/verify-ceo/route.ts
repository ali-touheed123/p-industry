import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { verifyPassword } from '@/lib/auth-passwords';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { createCeoApprovalToken, isCeoLevelRole } from '@/lib/ceo-approval';

/**
 * POST { tenant_id, password }
 * A logged-in staff member proves the CEO password. Any active CEO account of the same
 * owner (this branch or a sister branch sharing owner_name / email) is accepted.
 * Returns a 1-hour approval token bound to this staff user + tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenant_id, password } = await req.json();
    if (!tenant_id || !password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'CEO password required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const session = auth.session;

    // CEO / developer sessions never need approval.
    if (isCeoLevelRole(session.role)) {
      return NextResponse.json({ success: true, bypass: true, token: null, expires_at: null });
    }
    if (!session.tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant assigned to this session' }, { status: 403 });
    }

    const rateKey = `ceo-verify:${session.userId}`;
    const limit = await checkRateLimit(rateKey, 5, 5 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: `Too many attempts. Please wait ${limit.retryAfterSec} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      );
    }

    // Collect this branch + sister branches of the same owner.
    const { data: ownTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, owner_name, email')
      .eq('id', session.tenantId)
      .maybeSingle();

    const tenantIds = new Set<string>([session.tenantId]);
    if (ownTenant?.owner_name) {
      const { data } = await supabaseAdmin
        .from('tenants').select('id').eq('is_active', true).eq('owner_name', ownTenant.owner_name);
      (data || []).forEach((t: any) => tenantIds.add(t.id));
    }
    if (ownTenant?.email) {
      const { data } = await supabaseAdmin
        .from('tenants').select('id').eq('is_active', true).eq('email', ownTenant.email);
      (data || []).forEach((t: any) => tenantIds.add(t.id));
    }

    const { data: ceos } = await supabaseAdmin
      .from('app_users')
      .select('id, username, password_hash')
      .eq('role', 'ceo')
      .eq('is_active', true)
      .in('tenant_id', Array.from(tenantIds));

    if (!ceos || ceos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active CEO account found for this shop.' },
        { status: 404 }
      );
    }

    let approvedBy: string | null = null;
    for (const ceo of ceos) {
      if (await verifyPassword(password, ceo.password_hash)) {
        approvedBy = ceo.username;
        break;
      }
    }

    if (!approvedBy) {
      return NextResponse.json({ success: false, error: 'Incorrect CEO password.' }, { status: 401 });
    }

    await resetRateLimit(rateKey);
    const { token, expiresAt } = await createCeoApprovalToken(session);

    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: session.tenantId,
        user_name: session.username,
        action: 'CEO Approval Granted',
        action_type: 'update',
        entity_type: 'security',
        entity_id: session.userId,
        details: { approved_by: approvedBy, valid_minutes: 60 },
      });
    } catch (logErr) {
      console.warn('[CeoApproval] audit log write failed', logErr);
    }

    return NextResponse.json({ success: true, token, expires_at: expiresAt });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
