import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch invoices for a tenant / branch or shift with date filtering and search
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');
    const invoiceType = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const paymentType = searchParams.get('payment_type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '500', 10);

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
    if (invoiceType && invoiceType !== 'all') {
      query = query.eq('invoice_type', invoiceType);
    }
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (paymentType && paymentType !== 'all') {
      query = query.eq('payment_type', paymentType);
    }
    if (search) {
      query = query.or(`invoice_no.ilike.%${search}%,client_name.ilike.%${search}%`);
    }

    const { data: invoices, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, invoices: invoices || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create and persist new invoice with stock deduction / return & client balance update
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
      delivery_charge = 0,
      remarks,
      invoice_type = 'sales',
      net_total = 0,
      paid_amount = 0,
      due_amount = 0,
      payment_type = 'cash',
      cash_paid = 0,
      card_paid = 0,
      bank_paid = 0,
      others_paid = 0,
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
        delivery_charge: Number(delivery_charge),
        remarks: remarks || null,
        invoice_type,
        net_total: Number(net_total),
        paid_amount: Number(paid_amount),
        due_amount: Number(due_amount),
        payment_type,
        cash_paid: Number(cash_paid),
        card_paid: Number(card_paid),
        bank_paid: Number(bank_paid),
        others_paid: Number(others_paid),
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
      item_code: it.item_code || it.code || it.item?.code || '',
      item_name: it.item_name || it.productName || it.name || it.item?.name || '',
      shade_code: it.shade_code || it.shadeCode || '',
      shade_hex: it.shade_hex || it.shadeColorHex || '#94A3B8',
      pack_size: it.pack_size || it.packSize || it.unit || 'Can',
      unit: it.unit || it.item?.unit || 'PCS',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price || it.rate || it.price) || 0,
      discount: Number(it.discount) || 0,
      discount_percent: Number(it.discount_percent || it.discountPercent) || 0,
      total_price: Number(it.total_price || (it.qty * (it.unit_price || it.rate || 0))) || 0,
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from('invoice_items')
      .insert(invoiceItemsToInsert);

    if (itemsErr) throw itemsErr;

    // 3. Stock Adjustment
    const isReturn = invoice_type === 'return';
    for (const lineItem of invoiceItemsToInsert) {
      if (lineItem.item_id) {
        const { data: currentItem } = await supabaseAdmin
          .from('items')
          .select('stock_qty')
          .eq('id', lineItem.item_id)
          .single();

        if (currentItem) {
          const currentQty = currentItem.stock_qty || 0;
          const newQty = isReturn
            ? currentQty + lineItem.qty
            : Math.max(0, currentQty - lineItem.qty);

          await supabaseAdmin
            .from('items')
            .update({ stock_qty: newQty })
            .eq('id', lineItem.item_id);
        }
      }
    }

    // 4. Client Balance Update
    if (client_id) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('current_balance')
        .eq('id', client_id)
        .single();

      if (client) {
        const currentBal = client.current_balance || 0;
        let newBalance = currentBal;

        if (isReturn) {
          // If return, reduce client debt
          newBalance = Math.max(0, currentBal - Number(net_total));
        } else if (Number(due_amount) > 0) {
          // If sales on credit / unpaid balance, add to client debt
          newBalance = currentBal + Number(due_amount);
        }

        await supabaseAdmin
          .from('clients')
          .update({ current_balance: newBalance })
          .eq('id', client_id);
      }
    }

    // 5. Create Audit Log Entry
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id,
        user_name: client_name,
        action: isReturn ? 'Credit Note Return' : 'Sales Invoice Complete',
        action_type: isReturn ? 'return' : 'sale',
        entity_type: 'invoice',
        entity_id: invoice.id,
        details: {
          invoice_no,
          net_total,
          paid_amount,
          due_amount,
          items_count: items.length,
        },
      });
    } catch {
      // Non-blocking audit log
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
