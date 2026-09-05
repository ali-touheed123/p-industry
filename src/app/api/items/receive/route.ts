import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// POST: Receive inward stock (GRN) with audit logging & sequential reference number
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

    // 1. Fetch current item
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('items')
      .select('id, code, name, stock_qty')
      .eq('id', item_id)
      .single();

    if (itemErr || !item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }

    // 2. Generate sequential unique GRN reference number
    const currentYear = new Date().getFullYear();
    const { count } = await supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('action_type', 'grn_receive');

    const nextSeq = (count || 0) + 1;
    const grn_no = `GRN-${currentYear}-${String(nextSeq).padStart(4, '0')}`;

    // 3. Update Item stock quantity
    const previousStock = Number(item.stock_qty || 0);
    const newStock = previousStock + parsedQty;

    const { error: updateErr } = await supabaseAdmin
      .from('items')
      .update({ stock_qty: newStock })
      .eq('id', item_id);

    if (updateErr) throw updateErr;

    // 4. Record stock movement audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id,
        user_name: received_by,
        action: `Goods Received (${grn_no})`,
        action_type: 'grn_receive',
        entity_type: 'item',
        entity_id: item.id,
        details: {
          grn_no,
          item_id: item.id,
          item_code: item.code,
          item_name: item.name,
          qty_received: parsedQty,
          previous_stock: previousStock,
          new_stock: newStock,
          batch_no: batch_no || null,
          supplier_bill_ref: supplier_bill_ref || null,
          received_at: new Date().toISOString(),
        },
      });
    } catch (logErr) {
      console.error('Failed to write GRN audit log:', logErr);
    }

    return NextResponse.json({
      success: true,
      grn_no,
      new_stock: newStock,
      item: {
        ...item,
        stock_qty: newStock,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
