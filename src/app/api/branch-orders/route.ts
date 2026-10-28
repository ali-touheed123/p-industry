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

    // ── Server-side stock validation ─────────────────────────────────────────
    // Validate every requested item's qty against the source branch's live stock_qty.
    // This guards against stale client-side stock numbers bypassing the client cap.
    for (const item of items) {
      const cleanCode = (item.item_code || '').trim().toUpperCase();
      if (!cleanCode) continue;

      const { data: sourceItem } = await supabaseAdmin
        .from('items')
        .select('stock_qty, name')
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
    // ─────────────────────────────────────────────────────────────────────────

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

    // Helper: calculate total transfer value from supplying branch's real cost prices
    const calcTransferValue = async (toTenantId: string, itemsList: any[]): Promise<number> => {
      let total = 0;
      for (const it of itemsList) {
        const cleanCode = (it.item_code || '').trim().toUpperCase();
        const { data: srcItem } = await supabaseAdmin
          .from('items')
          .select('cost_price, retail_price')
          .eq('tenant_id', toTenantId)
          .ilike('code', cleanCode)
          .maybeSingle();
        if (srcItem) {
          const unitCost = Number(srcItem.cost_price) || Number(srcItem.retail_price) * 0.85 || 0;
          total += unitCost * Number(it.qty || 1);
        }
      }
      return total;
    };

    // Task 12.3 — FINDING-E2E-008 FIX: Replace requireTenantAuth(req, null) with getSession.
    // Passing null to requireTenantAuth skips tenant matching — any authenticated session passes.
    // getSession enforces authentication without bypassing tenant isolation.
    // Strict tenant-party validation occurs post-fetch (lines below) after currentOrder is known.
    // FINDING-API-003 ordering preserved: auth check still occurs before order fetch.
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Valid login session required' }, { status: 401 });
    }
    if (session.role !== 'developer' && !session.tenantId) {
      return NextResponse.json({ success: false, error: 'Forbidden: No tenant assigned to this session' }, { status: 403 });
    }
    // Wrap session in auth-compatible shape for downstream code that uses auth.session
    const auth = { authorized: true, session };

    // Fetch the current order to validate transition
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
      .from('branch_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !currentOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Enforce tenant membership: caller must belong to one of the two branches
    if (auth.session && auth.session.role !== 'developer') {
      if (auth.session.tenantId !== currentOrder.from_tenant_id && auth.session.tenantId !== currentOrder.to_tenant_id) {
        return NextResponse.json({ success: false, error: 'Forbidden: Access denied to this branch order' }, { status: 403 });
      }

      // Enforce role-specific transition restrictions:
      //   'dispatched' can only be set by the supplying branch (to_tenant_id)
      //   'received'   can only be set by the requesting branch (from_tenant_id)
      if (status === 'dispatched' && auth.session.tenantId !== currentOrder.to_tenant_id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only the supplying branch may dispatch this order' },
          { status: 403 }
        );
      }
      if (status === 'received' && auth.session.tenantId !== currentOrder.from_tenant_id) {
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

    // 1. Fetch order items and tenant info
    const { data: orderItems } = await supabaseAdmin
      .from('branch_order_items')
      .select('*')
      .eq('order_id', id);

    const itemsList = orderItems || [];

    // 2. Fetch tenant names
    const { data: fromTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', currentOrder.from_tenant_id)
      .maybeSingle();

    const { data: toTenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', currentOrder.to_tenant_id)
      .maybeSingle();

    const fromName = fromTenant?.name || 'Requesting Branch';
    const toName = toTenant?.name || 'Supplying Branch';

    // 3. Handle Status Specific Actions (Stock & Financial Posting)
    if (status === 'dispatched') {
      // ─── STEP A: Deduct stock from Supplying Branch (to_tenant_id) ───
      // FIX FINDING-API-006: Use atomic RPC with FOR UPDATE row locking to prevent
      // concurrent dispatch race conditions. The RPC also persists the transfer_value.
      const { data: rpcTransferValue, error: dispatchErr } = await supabaseAdmin.rpc(
        'process_branch_dispatch_atomic',
        {
          p_order_id:     id,
          p_to_tenant_id: currentOrder.to_tenant_id,
        }
      );

      if (dispatchErr) throw dispatchErr;

      const realTransferValue = Number(rpcTransferValue || 0);

      // Log dispatch audit
      try {
        await supabaseAdmin.from('audit_logs').insert({
          tenant_id: currentOrder.to_tenant_id,
          user_name: toName,
          action: `Branch Order ${currentOrder.order_no} Dispatched to ${fromName}`,
          action_type: 'branch_dispatch',
          entity_type: 'branch_order',
          entity_id: id,
          details: {
            order_no: currentOrder.order_no,
            to: fromName,
            items_count: itemsList.length,
            transfer_value: realTransferValue,
          },
        });
      } catch {}

    } else if (status === 'received') {
      // ─── STEP B: Add stock to Requesting Branch (from_tenant_id) ───
      // FIX FINDING-API-006: Use atomic RPC with FOR UPDATE row locking to prevent
      // concurrent receive race conditions.
      const { error: receiveErr } = await supabaseAdmin.rpc(
        'process_branch_receive_atomic',
        {
          p_order_id:       id,
          p_from_tenant_id: currentOrder.from_tenant_id,
          p_to_tenant_id:   currentOrder.to_tenant_id,
        }
      );

      if (receiveErr) throw receiveErr;

      // Read transfer value that was stored at dispatch time
      const dispatchValue = Number((currentOrder as any).transfer_value || 0);
      const transferAmount = dispatchValue > 0
        ? dispatchValue
        : await calcTransferValue(currentOrder.to_tenant_id, itemsList);

      // ─── STEP C: Post Inter-Branch Ledger Vouchers (real amount only) ───

      // Determine if this is a same-tenant counter order or a true inter-branch order
      const isCounterOrder = currentOrder.from_tenant_id === currentOrder.to_tenant_id;

      // For counter orders, party_id must be "counter_<username>" to match ledger queries.
      // For branch orders, party_id is the tenant UUID.
      const receivingPartyId = isCounterOrder
        ? `counter_${currentOrder.target_counter}`   // the counter that supplied (supplier side)
        : currentOrder.to_tenant_id;
      const supplyingPartyId = isCounterOrder
        ? `counter_${currentOrder.from_counter}`     // the counter that requested (debtor side)
        : currentOrder.from_tenant_id;

      // Voucher for Receiving Counter/Branch — they OWE the supplying side (Debit / Payable)
      try {
        await supabaseAdmin.from('vouchers').insert({
          tenant_id: currentOrder.from_tenant_id,
          voucher_no: `IBT-${currentOrder.order_no.slice(-6)}`,
          voucher_type: 'branch_transfer_in',
          party_type: 'branch',
          party_id: currentOrder.to_tenant_id,          // always the tenant UUID
          party_code: isCounterOrder ? receivingPartyId : null, // counter_<username> for counter orders
          party_name: toName,
          amount: transferAmount,
          payment_mode: 'Transfer on Account',
          reference_no: currentOrder.order_no,
          remarks: `Stock Received from ${toName} | ${itemsList.length} item(s) | ${currentOrder.order_no}`,
          date: new Date().toISOString().split('T')[0],
        });
      } catch {}

      // Voucher for Supplying Counter/Branch — they are OWED by the receiving side (Credit / Receivable)
      try {
        await supabaseAdmin.from('vouchers').insert({
          tenant_id: currentOrder.to_tenant_id,
          voucher_no: `IBT-${currentOrder.order_no.slice(-6)}`,
          voucher_type: 'branch_transfer_out',
          party_type: 'branch',
          party_id: currentOrder.from_tenant_id,        // always the tenant UUID
          party_code: isCounterOrder ? supplyingPartyId : null, // counter_<username> for counter orders
          party_name: fromName,
          amount: transferAmount,
          payment_mode: 'Transfer on Account',
          reference_no: currentOrder.order_no,
          remarks: `Stock Dispatched to ${fromName} | ${itemsList.length} item(s) | ${currentOrder.order_no}`,
          date: new Date().toISOString().split('T')[0],
        });
      } catch {}

      // Log receive audit
      try {
        await supabaseAdmin.from('audit_logs').insert({
          tenant_id: currentOrder.from_tenant_id,
          user_name: fromName,
          action: `Branch Order ${currentOrder.order_no} Received & Restocked from ${toName}`,
          action_type: 'branch_receive',
          entity_type: 'branch_order',
          entity_id: id,
          details: {
            order_no: currentOrder.order_no,
            from: toName,
            amount: transferAmount,
            items_count: itemsList.length,
          },
        });
      } catch {}
    }

    // 4. Update the order status in DB
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
