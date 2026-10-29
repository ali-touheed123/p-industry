import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      original_invoice_id,
      tenant_id,
      items = [],
      shift_id,
      cash_refunded = 0,
      card_refunded = 0,
      idempotency_key,
    } = body;

    if (!original_invoice_id || !tenant_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'original_invoice_id, tenant_id, and items array are required.' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let operatorName = 'Staff';
    let effectiveUserId: string | null = null;

    if (auth.session.role === 'developer') {
      operatorName = 'Developer Super Admin';
      effectiveUserId = null;
    } else if (auth.session.role === 'staff') {
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
      operatorName = user.full_name || user.username || 'Staff';
      effectiveUserId = user.id;
    } else {
      return NextResponse.json(
        { success: false, error: 'Access denied: Special returns are restricted to counter staff.' },
        { status: 403 }
      );
    }

    // Verify active shift
    let activeShiftId = shift_id;
    if (!activeShiftId) {
      const { data: openShift } = await supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();

      if (!openShift) {
        return NextResponse.json(
          { success: false, error: 'Cannot process return without an active open shift.' },
          { status: 400 }
        );
      }
      activeShiftId = openShift.id;
    }

    // Clean items: { original_item_id, qty }
    const cleanItems = items.map((it: any) => ({
      original_item_id: it.original_item_id || it.id,
      qty: Number(it.qty) || 0,
    }));

    // Call atomic RPC
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('create_special_return_atomic', {
      p_original_invoice_id: original_invoice_id,
      p_items: cleanItems,
      p_user_id: effectiveUserId,
      p_printed_by: operatorName,
      p_shift_id: activeShiftId,
      p_cash_refunded: Number(cash_refunded) || 0,
      p_card_refunded: Number(card_refunded) || 0,
      p_idempotency_key: idempotency_key || null,
    });

    if (rpcErr) {
      if (rpcErr.message?.includes('IDEMPOTENCY_CONFLICT')) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json(rpcRes);
  } catch (err: any) {
    if (err?.message?.includes('IDEMPOTENCY_CONFLICT')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
