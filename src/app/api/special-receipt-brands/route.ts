import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

async function verifySpecialReceiptPermission(session: any, tenantId: string) {
  if (session.role === 'developer') {
    return { authorized: true, user: { id: 'developer-super-admin', role: 'developer', can_use_special_receipt: true } };
  }

  if (session.role === 'ceo') {
    return { authorized: true, user: { id: session.userId, role: 'ceo', can_use_special_receipt: true } };
  }

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('id, role, is_active, can_use_special_receipt, tenant_id')
    .eq('id', session.userId)
    .maybeSingle();

  if (error || !user) {
    return { authorized: false, error: 'User account not found', status: 401 };
  }

  if (!user.is_active) {
    return { authorized: false, error: 'User account is deactivated', status: 403 };
  }

  if (user.role !== 'staff' || !user.can_use_special_receipt || user.tenant_id !== tenantId) {
    return { authorized: false, error: 'Access denied: Special Receipt permission required for this branch', status: 403 };
  }

  return { authorized: true, user };
}

// GET: Fetch brand triggers for special receipt pulsing
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const perm = await verifySpecialReceiptPermission(auth.session, tenantId);
    if (!perm.authorized) {
      return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('special_receipt_brands')
      .select('brand_id')
      .eq('tenant_id', tenantId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const brandIds = (rows || []).map((r: { brand_id: string }) => r.brand_id);
    return NextResponse.json({ success: true, brand_ids: brandIds });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Save selected brand triggers
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, brand_ids } = body;

    if (!tenant_id || !Array.isArray(brand_ids)) {
      return NextResponse.json({ success: false, error: 'tenant_id and brand_ids array are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const perm = await verifySpecialReceiptPermission(auth.session, tenant_id);
    if (!perm.authorized) {
      return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
    }

    // Replace all records for this tenant
    const { error: deleteErr } = await supabaseAdmin
      .from('special_receipt_brands')
      .delete()
      .eq('tenant_id', tenant_id);

    if (deleteErr) {
      return NextResponse.json({ success: false, error: deleteErr.message }, { status: 500 });
    }

    if (brand_ids.length > 0) {
      const recordsToInsert = brand_ids.map((id: string) => ({
        tenant_id,
        brand_id: id,
      }));

      const { error: insertErr } = await supabaseAdmin
        .from('special_receipt_brands')
        .insert(recordsToInsert);

      if (insertErr) {
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, brand_ids });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
