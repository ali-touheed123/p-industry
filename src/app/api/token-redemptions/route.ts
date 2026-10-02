import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

/**
 * GET /api/token-redemptions?tenant_id=...&shift_id=...&client_id=...&limit=...
 * Fetch past token redemption headers and items.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');
    const clientId = searchParams.get('client_id');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Number(limitParam) || 500, 2000);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('token_redemptions')
      .select('*, token_redemption_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (shiftId) query = query.eq('shift_id', shiftId);
    if (clientId) query = query.eq('client_id', clientId);

    const { data: redemptions, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, redemptions: redemptions || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/token-redemptions
 * Thin API layer executing redeem_tokens_atomic RPC.
 *
 * Body:
 * {
 *   tenant_id, redemption_no?, client_id?, client_name, shift_id?, created_by?, notes?,
 *   lines: [{ brand_id?, brand_name?, series_id?, series_name?, unit_name, quantity }]
 * }
 *
 * Locked rules enforced:
 * A4:  Authoritative token value resolved server-side in DB RPC from series_token_configs.
 * A12: Creates token_redemptions header + token_redemption_items + token_transactions per line.
 *      Physical tokens enter shop stockpile as type='redeemed', usage_status='available'.
 *      Never reads or writes clients.token_balance.
 *      CASH payout only.
 *      True database atomicity via single PostgreSQL transaction; full rollback on error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      redemption_no,
      client_id,
      client_name,
      shift_id,
      created_by,
      notes,
      lines,
      payout_method,
    } = body;

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'Tenant ID is required' }, { status: 400 });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one redemption line is required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Basic request sanitization without client-side value calculation
    const sanitizedLines = lines.map((l: any, idx: number) => ({
      brand_id: l.brand_id || null,
      brand_name: l.brand_name ? String(l.brand_name).trim() : '',
      series_id: l.series_id || null,
      series_name: l.series_name ? String(l.series_name).trim() : '',
      unit_name: l.unit_name ? String(l.unit_name).trim() : '',
      quantity: Math.floor(Number(l.quantity) || 0),
      token_value: l.token_value != null ? Number(l.token_value) : 0, // Passed for authoritative mismatch check only; server ignores if 0
    }));

    const redemptionData = {
      tenant_id,
      redemption_no: redemption_no ? String(redemption_no).trim() : undefined,
      client_id: client_id || null,
      client_name: client_name ? String(client_name).trim() : 'Walk-in Customer',
      shift_id: shift_id || null,
      created_by: created_by || null,
      notes: notes || null,
      payout_method: payout_method ? String(payout_method).toLowerCase().trim() : 'cash',
    };

    // Execute Atomic DB RPC
    const { data: atomicResult, error: rpcErr } = await supabaseAdmin.rpc('redeem_tokens_atomic', {
      p_redemption_data: redemptionData,
      p_lines: sanitizedLines,
    });

    if (rpcErr) {
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      redemption: atomicResult?.redemption,
      items: atomicResult?.items,
      total_tokens: atomicResult?.total_tokens,
      total_amount: atomicResult?.total_amount,
      redemption_no: atomicResult?.redemption_no,
      is_duplicate: Boolean(atomicResult?.is_duplicate),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
