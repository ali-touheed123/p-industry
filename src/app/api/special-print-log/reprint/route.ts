import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// POST: Execute atomic special reprint logging and fetch snapshot
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoice_id, tenant_id } = body;

    if (!invoice_id || !tenant_id) {
      return NextResponse.json({ success: false, error: 'invoice_id and tenant_id are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // D2 Mandate: Reprints are strictly allowed for counter staff with fresh permission.
    // CEO and Developer roles are strictly blocked from triggering reprints.
    if (auth.session.role !== 'staff') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only counter staff are authorized to reprint receipts.' },
        { status: 403 }
      );
    }

    // Fresh DB check
    const { data: user, error: userErr } = await supabaseAdmin
      .from('app_users')
      .select('id, full_name, username, is_active, can_use_special_receipt, tenant_id')
      .eq('id', auth.session.userId)
      .maybeSingle();

    if (userErr || !user?.is_active || !user.can_use_special_receipt || user.tenant_id !== tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Special Receipt permission required for this branch.' },
        { status: 403 }
      );
    }

    const printedBy = user.full_name || user.username || 'Staff';

    // Call atomic RPC
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('log_special_reprint_atomic', {
      p_invoice_id: invoice_id,
      p_user_id: user.id,
      p_printed_by: printedBy,
    });

    if (rpcErr) {
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json(rpcRes);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
