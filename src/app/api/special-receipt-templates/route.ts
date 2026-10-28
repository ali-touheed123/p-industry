import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { BLANK_SPECIAL_TEMPLATE_JSON } from '@/types/receipt';
import { requireCeoApproval } from '@/lib/ceo-approval';

/**
 * Helper to authoritatively verify fresh database permission.
 * Anti-Stale Token Rule: never rely solely on JWT claims.
 */
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

// GET: Fetch branch special receipt template or fallback to blank
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

    // Fresh permission check
    const perm = await verifySpecialReceiptPermission(auth.session, tenantId);
    if (!perm.authorized) {
      return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
    }

    const { data: templateRecord, error } = await supabaseAdmin
      .from('special_receipt_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!templateRecord) {
      return NextResponse.json({
        success: true,
        isCustomized: false,
        template: {
          tenant_id: tenantId,
          paper_size: 'thermal_80',
          template_json: BLANK_SPECIAL_TEMPLATE_JSON,
        },
      });
    }

    return NextResponse.json({
      success: true,
      isCustomized: true,
      template: templateRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Save or update branch special receipt template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, paper_size = 'thermal_80', template_json } = body;

    if (!tenant_id || !template_json) {
      return NextResponse.json({ success: false, error: 'tenant_id and template_json are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    // CEO approval gate (staff must have entered the CEO password, unless disabled for this tenant)
    const ceoGate = await requireCeoApproval(req, auth.session, tenant_id);
    if (!ceoGate.ok) return ceoGate.response;

    // Fresh permission check
    const perm = await verifySpecialReceiptPermission(auth.session, tenant_id);
    if (!perm.authorized) {
      return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
    }

    const { data: saved, error } = await supabaseAdmin
      .from('special_receipt_templates')
      .upsert(
        {
          tenant_id,
          paper_size,
          template_json,
          updated_by: auth.session.username,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Reset special receipt template to default blank
export async function DELETE(req: NextRequest) {
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
    // CEO approval gate (staff must have entered the CEO password, unless disabled for this tenant)
    const ceoGate = await requireCeoApproval(req, auth.session, tenantId);
    if (!ceoGate.ok) return ceoGate.response;

    const perm = await verifySpecialReceiptPermission(auth.session, tenantId);
    if (!perm.authorized) {
      return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
    }

    const { error } = await supabaseAdmin
      .from('special_receipt_templates')
      .delete()
      .eq('tenant_id', tenantId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Reset to default blank special template',
      template: {
        tenant_id: tenantId,
        paper_size: 'thermal_80',
        template_json: BLANK_SPECIAL_TEMPLATE_JSON,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
