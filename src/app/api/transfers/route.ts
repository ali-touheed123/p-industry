import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch inter-godown transfers for a tenant (sent or received)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: transfers, error } = await supabaseAdmin
      .from('stock_transfers')
      .select('*, stock_transfer_items(*)')
      .or(`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, transfers: transfers || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create inter-godown transfer dispatch & deduct stock from source
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      from_tenant_id,
      to_tenant_id,
      bilty_no,
      transporter_name,
      driver_name,
      driver_phone,
      item_id,
      item_code,
      item_name,
      unit,
      qty,
      notes,
      created_by,
    } = body;

    if (!from_tenant_id || !to_tenant_id || !item_id || !qty) {
      return NextResponse.json(
        { success: false, error: 'Source godown, Destination godown, Item, and Quantity are required' },
        { status: 400 }
      );
    }

    const transfer_no = `TR-${Math.floor(1000 + Math.random() * 9000)}`;
    const parsedQty = Number(qty) || 1;

    // 1. Insert Stock Transfer Record
    const { data: transfer, error: transferErr } = await supabaseAdmin
      .from('stock_transfers')
      .insert({
        from_tenant_id,
        to_tenant_id,
        transfer_no,
        date: new Date().toISOString().split('T')[0],
        bilty_no: bilty_no || `BL-${Math.floor(1000 + Math.random() * 9000)}`,
        transporter_name: transporter_name || null,
        driver_name: driver_name || null,
        driver_phone: driver_phone || null,
        status: 'in_transit',
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (transferErr) throw transferErr;

    // 2. Insert Transfer Line Item
    const { error: itemErr } = await supabaseAdmin
      .from('stock_transfer_items')
      .insert({
        transfer_id: transfer.id,
        item_id,
        item_code: item_code || '',
        item_name: item_name || '',
        unit: unit || 'Can',
        qty: parsedQty,
      });

    if (itemErr) throw itemErr;

    // 3. Deduct stock from source godown
    const { data: sourceItem } = await supabaseAdmin
      .from('items')
      .select('stock_qty')
      .eq('id', item_id)
      .single();

    if (sourceItem) {
      const newSourceStock = Math.max(0, (sourceItem.stock_qty || 0) - parsedQty);
      await supabaseAdmin
        .from('items')
        .update({ stock_qty: newSourceStock })
        .eq('id', item_id);
    }

    return NextResponse.json({ success: true, transfer });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Receive stock at destination godown & increment destination stock
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Transfer ID required' }, { status: 400 });
    }

    // Fetch transfer details
    const { data: transfer, error: fetchErr } = await supabaseAdmin
      .from('stock_transfers')
      .select('*, stock_transfer_items(*)')
      .eq('id', id)
      .single();

    if (fetchErr || !transfer) throw fetchErr || new Error('Transfer not found');

    if (transfer.status === 'received') {
      return NextResponse.json({ success: false, error: 'Transfer already marked as received' }, { status: 400 });
    }

    // Mark as received
    const { data: updatedTransfer, error: updateErr } = await supabaseAdmin
      .from('stock_transfers')
      .update({ status: 'received' })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Increment destination godown stock if item exists or add stock
    for (const itemLine of transfer.stock_transfer_items || []) {
      if (itemLine.item_id) {
        // Check if item exists in destination tenant
        const { data: destItem } = await supabaseAdmin
          .from('items')
          .select('id, stock_qty')
          .eq('tenant_id', transfer.to_tenant_id)
          .eq('code', itemLine.item_code)
          .maybeSingle();

        if (destItem) {
          const newQty = (destItem.stock_qty || 0) + Number(itemLine.qty);
          await supabaseAdmin
            .from('items')
            .update({ stock_qty: newQty })
            .eq('id', destItem.id);
        }
      }
    }

    return NextResponse.json({ success: true, transfer: updatedTransfer });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
