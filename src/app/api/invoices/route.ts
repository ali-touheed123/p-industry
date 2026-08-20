import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch invoices for a tenant / branch or shift
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (shiftId) {
      query = query.eq('shift_id', shiftId);
    }

    const { data: invoices, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, invoices: invoices || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create and persist new invoice with stock deduction & client balance update
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      invoice_no,
      client_id,
      client_name = 'Walk-in Customer',
      shift_id,
      date = new Date().toISOString().split('T')[0],
      subtotal = 0,
      discount = 0,
      tax = 0,
      net_total = 0,
      paid_amount = 0,
      due_amount = 0,
      payment_type = 'cash',
      status = 'completed',
      created_by,
      items = [],
    } = body;

    if (!tenant_id || !invoice_no || !items.length) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Invoice No, and at least 1 item are required' },
        { status: 400 }
      );
    }

    // 1. Insert Invoice Record
    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        tenant_id,
        invoice_no,
        client_id: client_id || null,
        client_name,
        shift_id: shift_id || null,
        date,
        subtotal: Number(subtotal),
        discount: Number(discount),
        tax: Number(tax),
        net_total: Number(net_total),
        paid_amount: Number(paid_amount),
        due_amount: Number(due_amount),
        payment_type,
        status,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (invoiceErr) throw invoiceErr;

    // 2. Prepare and Insert Invoice Items
    const invoiceItemsToInsert = items.map((it: any) => ({
      invoice_id: invoice.id,
      item_id: it.item_id || it.item?.id || null,
      item_code: it.item_code || it.item?.code || '',
      item_name: it.item_name || it.item?.name || '',
      unit: it.unit || it.item?.unit || 'Can',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price || it.price) || 0,
      discount: Number(it.discount) || 0,
      total_price: Number(it.total_price || (it.qty * (it.unit_price || it.price))) || 0,
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from('invoice_items')
      .insert(invoiceItemsToInsert);

    if (itemsErr) throw itemsErr;

    // 3. Deduct stock quantities for each sold item
    for (const lineItem of invoiceItemsToInsert) {
      if (lineItem.item_id) {
        // Fetch current stock
        const { data: currentItem } = await supabaseAdmin
          .from('items')
          .select('stock_qty')
          .eq('id', lineItem.item_id)
          .single();

        if (currentItem) {
          const newQty = Math.max(0, (currentItem.stock_qty || 0) - lineItem.qty);
          await supabaseAdmin
            .from('items')
            .update({ stock_qty: newQty })
            .eq('id', lineItem.item_id);
        }
      }
    }

    // 4. If credit purchase and client_id exists, increase client current_balance
    if (client_id && Number(due_amount) > 0) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('current_balance')
        .eq('id', client_id)
        .single();

      if (client) {
        const newBalance = (client.current_balance || 0) + Number(due_amount);
        await supabaseAdmin
          .from('clients')
          .update({ current_balance: newBalance })
          .eq('id', client_id);
      }
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        items: invoiceItemsToInsert,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
