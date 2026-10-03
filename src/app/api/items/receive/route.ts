import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// POST: Receive inward stock (GRN) with atomic stock increment and audit logging (FINDING-INV-002)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      item_id,
      qty,
      batch_no,
      supplier_bill_ref,
      received_by = 'Inventory Staff',
    } = body;

    const parsedQty = Number(qty);
    if (!tenant_id || !item_id || !parsedQty || parsedQty <= 0) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Item ID, and positive Quantity are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Execute atomic receiving RPC (locks item row, updates stock, creates GRN audit log)
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('receive_goods_atomic', {
      p_tenant_id: tenant_id,
      p_item_id: item_id,
      p_qty: parsedQty,
      p_batch_no: batch_no ? String(batch_no).trim() : null,
      p_supplier_ref: supplier_bill_ref ? String(supplier_bill_ref).trim() : null,
      p_received_by: received_by || 'Inventory Staff',
    });

    if (rpcErr) {
      const isNotFound = rpcErr.message?.includes('not found');
      return NextResponse.json(
        { success: false, error: rpcErr.message },
        { status: isNotFound ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      grn_no: rpcRes.grn_no,
      new_stock: Number(rpcRes.new_stock),
      item: {
        id: rpcRes.item_id,
        code: rpcRes.item_code,
        name: rpcRes.item_name,
        stock_qty: Number(rpcRes.new_stock),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
