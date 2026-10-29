import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth, getSession } from '@/lib/session';

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

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Lifecycle events for the requesting branch (notifications for order status changes)
    if (searchParams.get('events') === 'lifecycle') {
      if (!tenantId) {
        return NextResponse.json({ success: false, error: 'tenant_id required' }, { status: 400 });
      }

      const serverTime = new Date().toISOString();

      // Return only the single newest event and the server time to anchor new browsers/sessions
      if (searchParams.get('latest') === '1') {
        const { data: latestEvents, error: evErr } = await supabaseAdmin
          .from('branch_order_events')
          .select('id, order_id, event_type, data, created_at')
          .eq('notify_tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (evErr) {
          return NextResponse.json({ success: false, error: evErr.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          latestEvent: latestEvents?.[0] || null,
          server_time: serverTime,
        });
      }

      const since = searchParams.get('since') || new Date(0).toISOString();
      const { data: events, error: evErr } = await supabaseAdmin
        .from('branch_order_events')
        .select('id, order_id, event_type, data, created_at')
        .eq('notify_tenant_id', tenantId)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(20);
      if (evErr) {
        return NextResponse.json({ success: false, error: evErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, events: events || [], server_time: serverTime });
    }

    // If count_only=incoming, return count of pending incoming orders & latest order info for toast alert
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

      let latestOrder: any = null;
      if (count && count > 0) {
        let latestQuery = supabaseAdmin
          .from('branch_orders')
          .select('id, order_no, from_tenant_id, created_at, from_counter')
          .eq('to_tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        if (counterUsername) {
          latestQuery = latestQuery.or(`target_counter.eq.${counterUsername},target_counter.is.null`);
        }

        const { data: latestData } = await latestQuery;
        if (latestData && latestData.length > 0) {
          const lo = latestData[0];
          const { data: fromTenant } = await supabaseAdmin
            .from('tenants')
            .select('name')
            .eq('id', lo.from_tenant_id)
            .maybeSingle();

          latestOrder = {
            id: lo.id,
            orderNo: lo.order_no,
            fromBranchName: fromTenant?.name || 'Sister Branch',
            fromCounter: lo.from_counter,
            createdAt: lo.created_at,
          };
        }
      }

      return NextResponse.json({ success: true, pendingCount: count || 0, latestOrder });
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

    // Enrich order items with supplying branch live stock and default rates (cost_price fallback retail * 0.85)
    // for orders where this tenant is the supplying branch (to_tenant_id === tenantId)
    const supplierItemCodes = Array.from(
      new Set(
        (orders || [])
          .filter((o: any) => o.to_tenant_id === tenantId)
          .flatMap((o: any) => (o.branch_order_items || []).map((it: any) => (it.item_code || '').trim().toUpperCase()))
          .filter(Boolean)
      )
    );

    let supplierStockMap: Record<string, { stock_qty: number; cost_price: number; retail_price: number; default_rate: number }> = {};
    if (supplierItemCodes.length > 0) {
      const { data: stockItems } = await supabaseAdmin
        .from('items')
        .select('code, stock_qty, cost_price, retail_price')
        .eq('tenant_id', tenantId);

      (stockItems || []).forEach((si: any) => {
        const c = (si.code || '').trim().toUpperCase();
        const cp = Number(si.cost_price) || 0;
        const rp = Number(si.retail_price) || 0;
        const defaultRate = cp > 0 ? cp : rp * 0.85;
        supplierStockMap[c] = {
          stock_qty: Number(si.stock_qty) || 0,
          cost_price: cp,
          retail_price: rp,
          default_rate: Math.round(defaultRate * 100) / 100,
        };
      });
    }

    // Attach tenant info and map items to each order
    const enrichedOrders = (orders || []).map((o: any) => {
      const isSupplier = o.to_tenant_id === tenantId;
      const rawItems = o.branch_order_items || o.items || [];
      const mappedItems = rawItems.map((it: any) => {
        const clean = (it.item_code || '').trim().toUpperCase();
        const stockInfo = isSupplier ? supplierStockMap[clean] : null;
        return {
          ...it,
          supplier_stock: stockInfo ? stockInfo.stock_qty : undefined,
          cost_price: stockInfo ? stockInfo.cost_price : undefined,
          retail_price: stockInfo ? stockInfo.retail_price : undefined,
          default_rate: stockInfo ? stockInfo.default_rate : undefined,
        };
      });

      return {
        ...o,
        items: mappedItems,
        from_tenant: tenantsMap[o.from_tenant_id] || null,
        to_tenant: tenantsMap[o.to_tenant_id] || null,
      };
    });

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

    const auth = await requireTenantAuth(req, from_tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
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

    // Server-side stock validation: validate every requested item's qty against source branch live stock
    for (const item of items) {
      const cleanCode = (item.item_code || '').trim().toUpperCase();
      if (!cleanCode) continue;

      const { data: sourceItem } = await supabaseAdmin
        .from('items')
        .select('name, stock_qty')
        .eq('tenant_id', to_tenant_id)
        .ilike('code', cleanCode)
        .maybeSingle();

      if (sourceItem) {
        const availableQty = Number(sourceItem.stock_qty || 0);
        const requestedQty = Number(item.qty || 1);
        const displayName = item.item_name || sourceItem.name || cleanCode;
        if (requestedQty > availableQty) {
          return NextResponse.json(
            {
              success: false,
              error: `Only ${availableQty} unit${availableQty !== 1 ? 's' : ''} of "${displayName}" available at this branch.`,
            },
            { status: 422 }
          );
        }
      }
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

    // 3. Insert initial 'placed' notification event for supplying branch (to_tenant_id)
    try {
      await supabaseAdmin.from('branch_order_events').insert({
        order_id: order.id,
        event_type: 'placed',
        notify_tenant_id: to_tenant_id,
        data: {
          order_no: order.order_no,
          from_tenant_id,
          from_counter: from_counter || null,
          items_count: orderItems.length,
          notes: notes || null,
        },
      });
    } catch (evtErr) {
      console.error('Failed to create order placed event:', evtErr);
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update order status (accept, reject, dispatch, receive)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Valid login session required' }, { status: 401 });
    }
    if (session.role !== 'developer' && !session.tenantId) {
      return NextResponse.json({ success: false, error: 'Forbidden: No tenant assigned to this session' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      status,
      items,
      discount,
      delivery_charges,
      delivery_method,
      dispatch_note,
      reject_reason,
    } = body;

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

    // Fetch the current order
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
      .from('branch_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const isDev = session.role === 'developer';
    const isCeo = session.role === 'ceo';
    const sessionTenantId = session.tenantId;

    // Helper: Verify if CEO owns a specific tenant
    const ceoOwnsTenant = (targetTenantId: string): boolean => {
      if (!isCeo) return false;
      if (sessionTenantId === targetTenantId) return true;
      if (session.ceoTenants && session.ceoTenants.some((t: any) => t.id === targetTenantId)) return true;
      return false;
    };

    // Enforce tenant authorization based on role
    if (!isDev) {
      const hasAccessToFrom = sessionTenantId === currentOrder.from_tenant_id || ceoOwnsTenant(currentOrder.from_tenant_id);
      const hasAccessToTo = sessionTenantId === currentOrder.to_tenant_id || ceoOwnsTenant(currentOrder.to_tenant_id);

      if (!hasAccessToFrom && !hasAccessToTo) {
        return NextResponse.json({ success: false, error: 'Forbidden: Access denied to this branch order' }, { status: 403 });
      }

      // Enforce role-specific transition restrictions:
      // 'accepted', 'dispatched', 'rejected' can only be executed by the supplying branch (to_tenant_id)
      if (['accepted', 'dispatched', 'rejected'].includes(status) && !hasAccessToTo) {
        return NextResponse.json(
          { success: false, error: `Forbidden: Only the supplying branch may ${status} this order` },
          { status: 403 }
        );
      }

      // 'received' can only be executed by the requesting branch (from_tenant_id)
      if (status === 'received' && !hasAccessToFrom) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only the requesting branch may confirm receipt of this order' },
          { status: 403 }
        );
      }
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

    const supplyingTenantId = currentOrder.to_tenant_id;
    const requestingTenantId = currentOrder.from_tenant_id;

    // ─── Status Specific Atomic Operations ───
    if (status === 'accepted') {
      const { error: rpcErr } = await supabaseAdmin.rpc('process_branch_accept_atomic', {
        p_order_id: id,
        p_to_tenant_id: supplyingTenantId,
      });

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

    } else if (status === 'rejected') {
      const cleanReason = typeof reject_reason === 'string' ? reject_reason.trim() : '';
      if (!cleanReason) {
        return NextResponse.json({ success: false, error: 'A non-empty rejection reason is required' }, { status: 400 });
      }
      if (cleanReason.length > 500) {
        return NextResponse.json({ success: false, error: 'Rejection reason cannot exceed 500 characters' }, { status: 400 });
      }

      const { error: rpcErr } = await supabaseAdmin.rpc('process_branch_reject_atomic', {
        p_order_id: id,
        p_to_tenant_id: supplyingTenantId,
        p_reject_reason: cleanReason,
      });

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

    } else if (status === 'dispatched') {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ success: false, error: 'Items payload is required for dispatch' }, { status: 400 });
      }

      // Validate each item strictly matches required contract
      const sanitizedItems: any[] = [];
      for (const it of items) {
        if (!it.id && !it.is_additional) {
          return NextResponse.json(
            { success: false, error: 'Each dispatched item must include a valid line id unless marked as additional' },
            { status: 400 }
          );
        }
        if (it.is_additional && (!it.item_code || !String(it.item_code).trim())) {
          return NextResponse.json(
            { success: false, error: 'Additional items must specify a valid item_code' },
            { status: 400 }
          );
        }
        if (typeof it.dispatched_qty !== 'number' || it.dispatched_qty < 0) {
          return NextResponse.json(
            { success: false, error: `Invalid dispatched quantity for item ${it.item_code || it.id}` },
            { status: 400 }
          );
        }
        if (it.is_additional && it.dispatched_qty < 1) {
          return NextResponse.json(
            { success: false, error: `Additional item ${it.item_code} must have dispatched quantity >= 1` },
            { status: 400 }
          );
        }
        if (it.unit_price === undefined || it.unit_price === null || typeof it.unit_price !== 'number' || it.unit_price < 0) {
          return NextResponse.json(
            { success: false, error: `Unit price is required and must be non-negative for item ${it.item_code || it.id}` },
            { status: 400 }
          );
        }

        const sanitizedLine: any = {
          dispatched_qty: it.dispatched_qty,
          unit_price: Math.round(Number(it.unit_price) * 100) / 100,
        };
        if (it.id) sanitizedLine.id = it.id;
        if (it.item_code) sanitizedLine.item_code = String(it.item_code).trim();
        if (it.is_additional) sanitizedLine.is_additional = true;
        if (it.discount_type !== undefined) sanitizedLine.discount_type = it.discount_type;
        if (it.discount_value !== undefined) {
          sanitizedLine.discount_value = typeof it.discount_value === 'number'
            ? Math.round(it.discount_value * 100) / 100
            : it.discount_value;
        }

        sanitizedItems.push(sanitizedLine);
      }

      const cleanDiscount = Number(discount) || 0;
      const cleanDelivery = Number(delivery_charges) || 0;
      const cleanMethod = delivery_method ? String(delivery_method).trim() : null;
      const cleanNote = dispatch_note ? String(dispatch_note).trim() : null;

      const { data: netTransferVal, error: rpcErr } = await supabaseAdmin.rpc('process_branch_dispatch_atomic', {
        p_order_id: id,
        p_to_tenant_id: supplyingTenantId,
        p_items: sanitizedItems,
        p_discount: cleanDiscount,
        p_delivery_charges: cleanDelivery,
        p_delivery_method: cleanMethod,
        p_dispatch_note: cleanNote,
      });

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }

    } else if (status === 'received') {
      const { error: rpcErr } = await supabaseAdmin.rpc('process_branch_receive_atomic', {
        p_order_id: id,
        p_from_tenant_id: requestingTenantId,
        p_to_tenant_id: supplyingTenantId,
      });

      if (rpcErr) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
      }
      // Note: Vouchers are created inside process_branch_receive_atomic atomically and idempotently.
    }

    // Fetch the updated order with all fields and items
    const { data: updatedOrder, error: reloadErr } = await supabaseAdmin
      .from('branch_orders')
      .select('*, branch_order_items(*)')
      .eq('id', id)
      .single();

    if (reloadErr) throw reloadErr;

    return NextResponse.json({
      success: true,
      order: {
        ...updatedOrder,
        items: updatedOrder.branch_order_items || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
