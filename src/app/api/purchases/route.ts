import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch purchases / purchase returns for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('purchases')
      .select('*, purchase_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type && type !== 'all') {
      query = query.eq('purchase_type', type);
    }

    const { data: purchases, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, purchases: purchases || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create Purchase Invoice or Purchase Return
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      purchase_no,
      purchase_type = 'purchase', // 'purchase' or 'return'
      supplier_id,
      supplier_name = 'Supplier',
      date = new Date().toISOString().split('T')[0],
      subtotal = 0,
      discount = 0,
      net_total = 0,
      paid_amount = 0,
      due_amount = 0,
      payment_type = 'credit',
      created_by,
      items = [],
    } = body;

    if (!tenant_id || !purchase_no || !items.length) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Purchase No, and at least 1 item are required' },
        { status: 400 }
      );
    }

    // 1. Insert Purchase Header
    const { data: purchase, error: purchaseErr } = await supabaseAdmin
      .from('purchases')
      .insert({
        tenant_id,
        purchase_no,
        purchase_type,
        supplier_id: supplier_id || null,
        supplier_name,
        date,
        subtotal: Number(subtotal) || 0,
        discount: Number(discount) || 0,
        net_total: Number(net_total) || 0,
        paid_amount: Number(paid_amount) || 0,
        due_amount: Number(due_amount) || 0,
        payment_type,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (purchaseErr) throw purchaseErr;

    // 2. Insert Line Items
    const purchaseItemsToInsert = items.map((it: any) => ({
      purchase_id: purchase.id,
      item_id: it.itemId || it.item_id || null,
      item_code: it.code || it.item_code || '',
      item_name: it.productName || it.item_name || '',
      unit: it.unit || 'Can',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.rate || it.unit_price) || 0,
      total_price: Number(it.rate || it.unit_price || 0) * (Number(it.qty) || 1),
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from('purchase_items')
      .insert(purchaseItemsToInsert);

    if (itemsErr) throw itemsErr;

    // 3. Stock Inventory Adjustment
    const isReturn = purchase_type === 'return';
    for (const lineItem of purchaseItemsToInsert) {
      if (lineItem.item_id) {
        const { data: currentItem } = await supabaseAdmin
          .from('items')
          .select('stock_qty')
          .eq('id', lineItem.item_id)
          .single();

        if (currentItem) {
          const currentQty = Number(currentItem.stock_qty) || 0;
          // Purchase INCREASES stock; Purchase Return DECREASES stock
          const newQty = isReturn
            ? Math.max(0, currentQty - lineItem.qty)
            : currentQty + lineItem.qty;

          await supabaseAdmin
            .from('items')
            .update({ stock_qty: newQty })
            .eq('id', lineItem.item_id);
        }
      }
    }

    // 4. Update Supplier Balance if supplier exists
    if (supplier_id) {
      const { data: supplier } = await supabaseAdmin
        .from('suppliers')
        .select('current_balance')
        .eq('id', supplier_id)
        .single();

      if (supplier) {
        const currentBal = Number(supplier.current_balance) || 0;
        let newBalance = currentBal;

        if (isReturn) {
          // Returning goods reduces our payable to supplier
          newBalance = Math.max(0, currentBal - Number(net_total));
        } else {
          // Buying goods adds unpaid balance to supplier debt
          newBalance = currentBal + Number(due_amount > 0 ? due_amount : (net_total - paid_amount));
        }

        await supabaseAdmin
          .from('suppliers')
          .update({
            current_balance: newBalance,
            last_payment_amount: paid_amount > 0 ? Number(paid_amount) : undefined,
            last_payment_date: paid_amount > 0 ? date : undefined,
          })
          .eq('id', supplier_id);
      }
    }

    // 5. Create Audit Log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id,
        user_name: supplier_name,
        action: isReturn ? 'Purchase Return' : 'Purchase Invoice Complete',
        action_type: isReturn ? 'purchase_return' : 'purchase',
        entity_type: 'purchase',
        entity_id: purchase.id,
        details: {
          purchase_no,
          net_total,
          paid_amount,
          due_amount,
          items_count: items.length,
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      purchase: {
        ...purchase,
        items: purchaseItemsToInsert,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
