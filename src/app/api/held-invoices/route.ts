import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch parked / held invoices for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: heldInvoices, error } = await supabaseAdmin
      .from('held_invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, held_invoices: heldInvoices || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Park / Hold an invoice in Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      hold_no,
      client_id,
      client_name,
      invoice_type = 'sales',
      items = [],
      subtotal = 0,
      discount = 0,
      delivery_charge = 0,
      net_total = 0,
      remarks,
    } = body;

    if (!tenant_id || !hold_no || !items.length) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Hold No, and at least 1 item required' },
        { status: 400 }
      );
    }

    const { data: heldOrder, error } = await supabaseAdmin
      .from('held_invoices')
      .insert({
        tenant_id,
        hold_no,
        client_id: client_id || null,
        client_name: client_name || 'Walk-in Customer',
        invoice_type,
        items_json: items,
        subtotal: Number(subtotal),
        discount: Number(discount),
        delivery_charge: Number(delivery_charge),
        net_total: Number(net_total),
        remarks: remarks || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, held_order: heldOrder });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a held invoice after restoring or deleting
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('held_invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Held invoice removed' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
