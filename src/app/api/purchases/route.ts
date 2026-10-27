import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch purchases / purchase returns for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const type = searchParams.get('type');
    const paymentType = searchParams.get('payment_type');
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

    // Scope purchases to a specific shift (directly by shift_id, with fallback to time window for legacy records)
    if (shiftId) {
      const { data: shift } = await supabaseAdmin
        .from('shifts')
        .select('start_time, end_time, status')
        .eq('id', shiftId)
        .single();

      if (shift?.start_time) {
        if (shift.end_time && shift.status === 'closed') {
          query = query.or(`shift_id.eq.${shiftId},and(shift_id.is.null,created_at.gte.${shift.start_time},created_at.lte.${shift.end_time})`);
        } else {
          query = query.or(`shift_id.eq.${shiftId},and(shift_id.is.null,created_at.gte.${shift.start_time})`);
        }
      } else {
        query = query.eq('shift_id', shiftId);
      }
    } else if (startDate) {
      // Fallback: scope to a specific date
      query = query.gte('created_at', `${startDate}T00:00:00`)
                    .lte('created_at', `${startDate}T23:59:59`);
    }

    if (type && type !== 'all') {
      query = query.eq('purchase_type', type);
    }

    if (paymentType && paymentType !== 'all') {
      query = query.eq('payment_type', paymentType);
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
      shift_id,
      items = [],
      applied_token_ids = [],
      token_allocations = null,
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

    // Validate token allocations if supplied (Canonical Contract per Plan Section 4.2)
    let validatedAllocations: { token_id: string; quantity: number }[] | null = null;
    if (token_allocations !== null && token_allocations !== undefined) {
      if (!Array.isArray(token_allocations)) {
        return NextResponse.json(
          { success: false, error: 'token_allocations must be a JSON array' },
          { status: 400 }
        );
      }
      if (purchase_type === 'return' && token_allocations.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Stockpile tokens cannot be applied to purchase returns' },
          { status: 400 }
        );
      }
      const seenTokenIds = new Set<string>();
      for (const alloc of token_allocations) {
        if (!alloc || typeof alloc !== 'object') {
          return NextResponse.json(
            { success: false, error: 'Each token allocation must be a JSON object' },
            { status: 400 }
          );
        }
        const { token_id, quantity } = alloc;
        if (!token_id || typeof token_id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Allocation token_id must be a string UUID' },
            { status: 400 }
          );
        }
        if (
          typeof quantity !== 'number' ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 2147483647
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `Allocation quantity for token ${token_id} must be a positive integer between 1 and 2147483647`,
            },
            { status: 400 }
          );
        }
        if (seenTokenIds.has(token_id)) {
          return NextResponse.json(
            { success: false, error: `Duplicate token ID in allocations: ${token_id}` },
            { status: 400 }
          );
        }
        seenTokenIds.add(token_id);
      }
      if (token_allocations.length > 0) {
        validatedAllocations = token_allocations;
      }
    }

    // Server-Side N4 & N3 Validations for Purchases & Returns
    const parsedSubtotal = Number(subtotal) || 0;
    const parsedDiscount = Number(discount) || 0;
    const parsedNetTotal = Number(net_total) || 0;
    const parsedPaid = Number(paid_amount) || 0;
    const parsedDue = Number(due_amount) || 0;

    if (parsedSubtotal < 0 || parsedDiscount < 0 || parsedNetTotal < 0 || parsedPaid < 0 || parsedDue < 0) {
      return NextResponse.json(
        { success: false, error: 'Purchase subtotal, discount, net total, paid, and due amounts cannot be negative.' },
        { status: 400 }
      );
    }

    if (Math.abs(parsedNetTotal - (parsedSubtotal - parsedDiscount)) > 1.00) {
      return NextResponse.json(
        {
          success: false,
          error: `Formula error: Net total (Rs. ${parsedNetTotal}) does not match Subtotal (${parsedSubtotal}) - Discount (${parsedDiscount})`,
          code: 'INVALID_NET_TOTAL'
        },
        { status: 400 }
      );
    }

    if (Math.abs((parsedPaid + parsedDue) - parsedNetTotal) > 1.00) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment error: Paid (Rs. ${parsedPaid}) + Due (Rs. ${parsedDue}) does not equal Net Total (Rs. ${parsedNetTotal})`,
          code: 'INVALID_PAID_DUE_SUM'
        },
        { status: 400 }
      );
    }

    let calculatedLineItemsTotal = 0;
    for (const it of items) {
      const lineQty = Number(it.qty) || 0;
      const linePrice = Number(it.rate ?? it.unit_price ?? it.price ?? 0);
      const lineTotal = Number(it.total_price ?? (lineQty * linePrice));

      if (lineQty <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item "${it.productName || it.item_name || 'Product'}": must be greater than zero` },
          { status: 400 }
        );
      }
      if (linePrice < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid unit price for item "${it.productName || it.item_name || 'Product'}": cannot be negative` },
          { status: 400 }
        );
      }
      calculatedLineItemsTotal += lineTotal;
    }

    if (Math.abs(parsedSubtotal - calculatedLineItemsTotal) > 1.00) {
      return NextResponse.json(
        {
          success: false,
          error: `Item total error: Subtotal (Rs. ${parsedSubtotal}) does not match sum of line item totals (Rs. ${calculatedLineItemsTotal})`,
          code: 'INVALID_LINE_ITEMS_SUBTOTAL'
        },
        { status: 400 }
      );
    }

    // N3: Purchase Return stock checks & shift assignment
    let resolvedShiftId = shift_id;
    if (purchase_type === 'return') {
      if (!supplier_id) {
        return NextResponse.json(
          { success: false, error: 'Supplier is required for purchase returns to adjust supplier balance.', code: 'SUPPLIER_REQUIRED' },
          { status: 400 }
        );
      }

      for (const it of items) {
        const itemId = it.itemId || it.item_id;
        const itemCode = it.code || it.item_code;
        if (itemId || itemCode) {
          let stockCheckQuery = supabaseAdmin
            .from('items')
            .select('id, name, stock_qty')
            .eq('tenant_id', tenant_id);

          if (itemId) stockCheckQuery = stockCheckQuery.eq('id', itemId);
          else stockCheckQuery = stockCheckQuery.eq('code', itemCode);

          const { data: dbItem } = await stockCheckQuery.maybeSingle();
          if (dbItem) {
            const availStock = Number(dbItem.stock_qty || 0);
            const reqReturnQty = Number(it.qty || 0);
            if (reqReturnQty > availStock) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Cannot return item "${dbItem.name}": return quantity (${reqReturnQty}) exceeds available warehouse stock (${availStock}).`,
                  code: 'INSUFFICIENT_STOCK_FOR_RETURN'
                },
                { status: 400 }
              );
            }
          }
        }
      }

      // If supplier gave cash refund, ensure open shift exists to record cash in
      if (parsedPaid > 0 && (payment_type || '').toLowerCase() === 'cash') {
        if (!resolvedShiftId) {
          const { data: openShift } = await supabaseAdmin
            .from('shifts')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('status', 'open')
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!openShift) {
            return NextResponse.json(
              { success: false, error: 'Cannot record cash refund from supplier return without an active open register shift.', code: 'NO_OPEN_SHIFT' },
              { status: 400 }
            );
          }
          resolvedShiftId = openShift.id;
        }
      }
    }

    // Build the purchase_data JSONB and items JSONB for the atomic RPC
    const purchaseData = {
      purchase_no,
      purchase_type,
      supplier_id: supplier_id || null,
      supplier_name,
      date,
      subtotal: parsedSubtotal,
      discount: parsedDiscount,
      net_total: parsedNetTotal,
      paid_amount: parsedPaid,
      due_amount: parsedDue,
      payment_type,
      created_by: created_by || null,
      shift_id: resolvedShiftId || shift_id || null,
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
    // Selects canonical overload (p_token_allocations) if allocations present, else legacy wrapper (p_token_ids)
    const rpcPayload: Record<string, any> = {
      p_tenant_id:     tenant_id,
      p_purchase_data: purchaseData,
      p_items:         lineItems,
    };
    if (validatedAllocations && validatedAllocations.length > 0) {
      rpcPayload.p_token_allocations = validatedAllocations;
    } else {
      rpcPayload.p_token_ids = tokenIds.length > 0 ? tokenIds : null;
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_purchase_atomic',
      rpcPayload
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

    // Task 7.2 Residual (RESIDUAL-PROC-001): Execute entire cancellation sequence inside
    // a single atomic PostgreSQL transaction (cancel_purchase_atomic). If stock reversal,
    // supplier balance rollback, or deletion fails, all changes are rolled back automatically.
    const { data: cancelResult, error: cancelError } = await supabaseAdmin.rpc(
      'cancel_purchase_atomic',
      {
        p_tenant_id: purchase.tenant_id,
        p_purchase_id: id,
      }
    );

    if (cancelError) throw cancelError;

    return NextResponse.json({
      success: true,
      message: 'Purchase cancelled successfully',
      result: cancelResult,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
