import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { sanitizePostgRESTLike } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Valid login session required' }, { status: 401 });
    }

    const { orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    // 1. Fetch the order to identify the supplying side (to_tenant_id)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('branch_orders')
      .select('id, to_tenant_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const supplyingTenantId = order.to_tenant_id;
    const isDev = session.role === 'developer';
    const isCeo = session.role === 'ceo';
    const sessionTenantId = session.tenantId;

    const ceoOwnsTenant = (targetTenantId: string): boolean => {
      if (!isCeo) return false;
      if (sessionTenantId === targetTenantId) return true;
      if (session.ceoTenants && session.ceoTenants.some((t: any) => t.id === targetTenantId)) return true;
      return false;
    };

    if (!isDev) {
      const hasAccessToSupplier = sessionTenantId === supplyingTenantId || ceoOwnsTenant(supplyingTenantId);
      if (!hasAccessToSupplier) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Access denied to supplying branch stock' },
          { status: 403 }
        );
      }
    }

    // 2. Parse search query
    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get('q') || '';
    const cleanQ = sanitizePostgRESTLike(rawQ.trim());

    let query = supabaseAdmin
      .from('items')
      .select('id, code, name, unit, pack_size, stock_qty, cost_price, retail_price')
      .eq('tenant_id', supplyingTenantId)
      .gt('stock_qty', 0);

    if (cleanQ) {
      query = query.or(`code.ilike.%${cleanQ}%,name.ilike.%${cleanQ}%`);
    }

    const { data: stockItems, error: itemsErr } = await query
      .order('name', { ascending: true })
      .limit(20);

    if (itemsErr) {
      return NextResponse.json({ success: false, error: itemsErr.message }, { status: 500 });
    }

    const items = (stockItems || []).map((it: any) => {
      const cp = Number(it.cost_price) || 0;
      const rp = Number(it.retail_price) || 0;
      const defaultRate = cp > 0 ? cp : rp * 0.85;
      return {
        id: it.id,
        code: it.code,
        name: it.name,
        unit: it.unit || it.pack_size || 'Can',
        pack_size: it.pack_size || it.unit || 'Can',
        stock_qty: Number(it.stock_qty) || 0,
        cost_price: cp,
        retail_price: rp,
        default_rate: Math.round(defaultRate * 100) / 100,
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

