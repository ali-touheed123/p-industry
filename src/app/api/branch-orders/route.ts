import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch branch orders for a tenant (both sent & received)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const counterUsername = searchParams.get('counter');
    const countOnly = searchParams.get('count_only'); // For notification badge polling

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    // If count_only=incoming, return just the count of pending incoming orders (for notification dot)
    if (countOnly === 'incoming') {
      let countQuery = supabaseAdmin
        .from('branch_orders')
        .select('*', { count: 'exact', head: true })
        .eq('to_tenant_id', tenantId)
        .eq('status', 'pending');

      if (counterUsername) {
        countQuery = countQuery.or(`target_counter.eq.${counterUsername},target_counter.is.null`);
      }

      const { count, error } = await countQuery;

      if (error) throw error;
      return NextResponse.json({ success: true, pendingCount: count || 0 });
    }

    // Fetch all orders where this tenant is either sender or receiver
    const { data: orders, error } = await supabaseAdmin
      .from('branch_orders')
      .select('*, branch_order_items(*)')
      .or(`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch tenant names for display (from_tenant and to_tenant)
    const tenantIds = new Set<string>();
    (orders || []).forEach((o: any) => {
      tenantIds.add(o.from_tenant_id);
      tenantIds.add(o.to_tenant_id);
    });

    let tenantsMap: Record<string, any> = {};
    if (tenantIds.size > 0) {
      const { data: tenants } = await supabaseAdmin
        .from('tenants')
        .select('id, name, slug, city')
        .in('id', Array.from(tenantIds));

      (tenants || []).forEach((t: any) => {
        tenantsMap[t.id] = t;
      });
    }

    // Attach tenant info and map items to each order
    const enrichedOrders = (orders || []).map((o: any) => ({
      ...o,
      items: o.branch_order_items || o.items || [],
      from_tenant: tenantsMap[o.from_tenant_id] || null,
      to_tenant: tenantsMap[o.to_tenant_id] || null,
    }));

    return NextResponse.json({ success: true, orders: enrichedOrders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create a new inter-branch or inter-counter order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      from_tenant_id,
      to_tenant_id,
      from_counter,
      target_counter,
      items, // Array of { item_code, item_name, unit, qty }
      notes,
      created_by,
    } = body;

    if (!from_tenant_id || !to_tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Both requesting branch/counter and source branch/counter are required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one item is required in the order' },
        { status: 400 }
      );
    }

    // Disallow ordering from self (same tenant AND same counter)
    if (from_tenant_id === to_tenant_id && (!from_counter || !target_counter || from_counter === target_counter)) {
      return NextResponse.json(
        { success: false, error: 'Cannot order from your own branch/counter' },
        { status: 400 }
      );
    }

    const order_no = `BO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Insert the order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('branch_orders')
      .insert({
        order_no,
        from_tenant_id,
        to_tenant_id,
        from_counter: from_counter || null,
        target_counter: target_counter || null,
        status: 'pending',
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 2. Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      item_code: item.item_code || '',
      item_name: item.item_name || '',
      unit: item.unit || 'Can',
      qty: Number(item.qty) || 1,
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from('branch_order_items')
      .insert(orderItems);

    if (itemsErr) throw itemsErr;

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update order status (accept, reject, dispatch, receive)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 });
    }

    const validStatuses = ['accepted', 'dispatched', 'received', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch the current order to validate transition
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
      .from('branch_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      pending: ['accepted', 'rejected'],
      accepted: ['dispatched', 'rejected'],
      dispatched: ['received'],
    };

    const allowed = allowedTransitions[currentOrder.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Cannot change status from "${currentOrder.status}" to "${status}"` },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: updateErr } = await supabaseAdmin
      .from('branch_orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
