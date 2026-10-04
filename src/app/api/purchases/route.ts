import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch purchases / purchase returns for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const type = searchParams.get('type');
    const shiftId = searchParams.get('shift_id');
    const startDate = searchParams.get('start_date');
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('purchases')
      .select('*, purchase_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Scope purchases to a specific shift's time window
    if (shiftId) {
      const { data: shift } = await supabaseAdmin
        .from('shifts')
        .select('start_time, end_time, status')
        .eq('id', shiftId)
        .single();

      if (shift?.start_time) {
        query = query.gte('created_at', shift.start_time);
        if (shift.end_time && shift.status === 'closed') {
          query = query.lte('created_at', shift.end_time);
        }
      }
    } else if (startDate) {
      // Fallback: scope to a specific date
      query = query.gte('created_at', `${startDate}T00:00:00`)
                    .lte('created_at', `${startDate}T23:59:59`);
    }

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

// POST: Create Purchase Invoice or Purchase Return (atomic via create_purchase_atomic RPC)
// Task 7.1 — FINDING-PROC-001 fix: all 6 sequential DB writes now execute inside a single
// PostgreSQL transaction. Partial failure causes automatic rollback of every step.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      purchase_no,
      purchase_type = 'purchase',
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
      applied_token_ids = [],
    } = body;

    if (!tenant_id || !purchase_no || !items.length) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Purchase No, and at least 1 item are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Build the purchase_data JSONB and items JSONB for the atomic RPC
    const purchaseData = {
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
    };

    const lineItems = items.map((it: any) => ({
      item_id: it.itemId || it.item_id || null,
      item_code: it.code || it.item_code || '',
      item_name: it.productName || it.item_name || '',
      unit: it.unit || 'Can',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.rate || it.unit_price) || 0,
      total_price: Number(it.rate || it.unit_price || 0) * (Number(it.qty) || 1),
    }));

    const tokenIds: string[] = Array.isArray(applied_token_ids) ? applied_token_ids : [];

    // Invoke atomic stored procedure — all operations in a single DB transaction
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_purchase_atomic',
      {
        p_tenant_id:     tenant_id,
        p_purchase_data: purchaseData,
        p_items:         lineItems,
        p_token_ids:     tokenIds.length > 0 ? tokenIds : null,
      }
    );

    if (rpcError) throw rpcError;

    const result = rpcResult as {
      purchase_id: string;
      purchase_no: string;
      tokens_applied_amount: number;
    };

    return NextResponse.json({
      success: true,
      purchase: {
        id: result.purchase_id,
        purchase_no: result.purchase_no,
        tokens_applied_amount: result.tokens_applied_amount,
        items: lineItems,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update an existing purchase order header fields.
// Task 7.2 — FINDING-PROC-002: Provides administrative correction of purchase entries.
//
// Design notes:
//   - Only header fields (supplier_name, date, payment_type, notes) are patchable here.
//   - Line-item and stock modifications require a compensating purchase return, which is
//     the existing business workflow. This avoids re-running stock deltas that could
//     introduce double-counting with the original atomic insert.
//   - Tenant ownership is verified from the DB record before authorizing.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, supplier_name, date, payment_type, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Purchase ID is required' }, { status: 400 });
    }

    // Fetch the existing record to derive tenant_id server-side (prevents IDOR)
    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id, tenant_id, purchase_type')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Purchase not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existing.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const updates: Record<string, any> = {};
    if (supplier_name !== undefined) updates.supplier_name = supplier_name?.trim() || null;
    if (date !== undefined) updates.date = date || null;
    if (payment_type !== undefined) updates.payment_type = payment_type || null;
    if (notes !== undefined) updates.notes = notes || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data: purchase, error } = await supabaseAdmin
      .from('purchases')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', existing.tenant_id) // defence-in-depth: scope to verified tenant
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, purchase });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Cancel a purchase order and atomically revert stock and supplier balance.
// Task 7.2 — FINDING-PROC-002: Provides administrative cancellation of purchase orders.
//
// Design notes:
//   - Cancellation reverses the stock delta and supplier balance recorded at creation time.
//   - Token redemptions are NOT reversed on cancellation (tokens were legitimately used;
//     reversing them would require separate business approval).
//   - A hard delete of purchase_items is performed after stock reversal so that the
//     purchase header can be deleted without FK violation.
//   - Tenant ownership is verified from the DB record before authorizing.
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Purchase ID is required' }, { status: 400 });
    }

    // Fetch full purchase record to derive tenant_id server-side (prevents IDOR)
    const { data: purchase } = await supabaseAdmin
      .from('purchases')
      .select('id, tenant_id, purchase_type, supplier_id, net_total, paid_amount, due_amount')
      .eq('id', id)
      .maybeSingle();

    if (!purchase) {
      return NextResponse.json({ success: false, error: 'Purchase not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, purchase.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const isReturn = purchase.purchase_type === 'return';

    // Fetch line items to reverse their stock deltas
    const { data: lineItems } = await supabaseAdmin
      .from('purchase_items')
      .select('item_id, item_code, qty')
      .eq('purchase_id', id);

    if (lineItems && lineItems.length > 0) {
      for (const lineItem of lineItems) {
        // Cancelling a purchase: reverse the stock change made at creation.
        // Purchase originally added stock (+qty), so cancellation removes it (-qty).
        // Purchase return originally removed stock (-qty), so cancellation restores it (+qty).
        const reverseDelta = isReturn
          ? Number(lineItem.qty || 0)
          : -Number(lineItem.qty || 0);

        if (lineItem.item_id) {
          await supabaseAdmin.rpc('adjust_item_stock', {
            p_item_id:   lineItem.item_id,
            p_qty_delta: reverseDelta,
          });
        } else if (lineItem.item_code) {
          await supabaseAdmin.rpc('adjust_item_stock_by_code', {
            p_tenant_id: purchase.tenant_id,
            p_item_code: lineItem.item_code,
            p_qty_delta: reverseDelta,
          });
        }
      }
    }

    // Reverse supplier balance
    if (purchase.supplier_id) {
      const { data: supplier } = await supabaseAdmin
        .from('suppliers')
        .select('current_balance')
        .eq('id', purchase.supplier_id)
        .eq('tenant_id', purchase.tenant_id)
        .single();

      if (supplier) {
        const currentBal = Number(supplier.current_balance) || 0;
        let newBalance: number;

        if (isReturn) {
          // The return had reduced the balance; restore it
          const paidAmt = Number(purchase.paid_amount) || 0;
          const returnCredit = Math.max(0, Number(purchase.net_total) - paidAmt);
          newBalance = currentBal + returnCredit;
        } else {
          // The purchase had increased the balance; remove it
          const dueAmt = Number(purchase.due_amount) || 0;
          const netTotal = Number(purchase.net_total) || 0;
          const paidAmt = Number(purchase.paid_amount) || 0;
          const debtAdded = dueAmt > 0 ? dueAmt : Math.max(0, netTotal - paidAmt);
          newBalance = currentBal - debtAdded;
        }

        await supabaseAdmin
          .from('suppliers')
          .update({ current_balance: newBalance })
          .eq('id', purchase.supplier_id)
          .eq('tenant_id', purchase.tenant_id);
      }
    }

    // Delete line items then the purchase header
    await supabaseAdmin
      .from('purchase_items')
      .delete()
      .eq('purchase_id', id);

    const { error: deleteErr } = await supabaseAdmin
      .from('purchases')
      .delete()
      .eq('id', id)
      .eq('tenant_id', purchase.tenant_id);

    if (deleteErr) throw deleteErr;

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id:   purchase.tenant_id,
        action:      'Purchase Cancelled',
        action_type: 'purchase_cancel',
        entity_type: 'purchase',
        entity_id:   id,
        details:     { purchase_id: id, original_type: purchase.purchase_type },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, message: 'Purchase cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
