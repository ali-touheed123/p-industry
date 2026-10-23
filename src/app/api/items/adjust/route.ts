import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// POST: Batch signed stock adjustment (+/-). Each row is applied independently and atomically,
// so one failing row never blocks the others. Every row is audit-logged by stock_adjustment_atomic.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, reason, batch_ref, adjusted_by = 'Inventory Staff', adjustments } = body;

    if (!tenant_id || !Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and at least one adjustment are required' },
        { status: 400 }
      );
    }
    if (adjustments.length > 200) {
      return NextResponse.json({ success: false, error: 'Maximum 200 rows per batch' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const seen = new Set<string>();
    const results: Array<{
      row_id: string;
      success: boolean;
      error?: string;
      previous_stock?: number;
      new_stock?: number;
    }> = [];

    for (const adj of adjustments) {
      const rowId = String(adj?.row_id ?? '');
      const itemId = String(adj?.item_id ?? '');
      const delta = Number(adj?.delta);

      if (!itemId || !Number.isFinite(delta) || delta === 0) {
        results.push({ row_id: rowId, success: false, error: 'Invalid item or quantity' });
        continue;
      }
      if (seen.has(itemId)) {
        results.push({ row_id: rowId, success: false, error: 'Duplicate product in batch' });
        continue;
      }
      seen.add(itemId);

      const { data, error } = await supabaseAdmin.rpc('stock_adjustment_atomic', {
        p_tenant_id: tenant_id,
        p_item_id: itemId,
        p_delta: delta,
        p_reason: reason ? String(reason).trim() : null,
        p_batch_ref: batch_ref ? String(batch_ref).trim() : null,
        p_adjusted_by: adjusted_by || 'Inventory Staff',
      });

      if (error) {
        results.push({ row_id: rowId, success: false, error: error.message });
      } else {
        results.push({
          row_id: rowId,
          success: true,
          previous_stock: Number(data?.previous_stock),
          new_stock: Number(data?.new_stock),
        });
      }
    }

    const failed = results.filter((r) => !r.success).length;
    return NextResponse.json({ success: true, results, failed_count: failed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
