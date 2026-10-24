import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { sanitizePostgRESTLike } from '@/lib/utils';
import { validateLockedRates } from '@/lib/rate-lock';

// GET: Fetch invoices for a tenant / branch or shift with date filtering and search
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');
    const clientId = searchParams.get('client_id');
    const invoiceType = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const paymentType = searchParams.get('payment_type');
    const search = searchParams.get('search');
    const id = searchParams.get('id');
    const cursor = searchParams.get('cursor');
    const limitParam = searchParams.get('limit');
    // TASK-P11-01: Default limit set to 50 records to prevent multi-megabyte payloads
    let limit = 50;
    if (limitParam === 'all' || limitParam === 'none') {
      limit = 10000;
    } else if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 10000);
      }
    }

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const includeItems = searchParams.get('include_items') === 'true' || searchParams.get('include_items') === '1';
    const summary = searchParams.get('summary') === 'true' || searchParams.get('summary') === '1' || searchParams.get('select_fields') === 'summary';

    // TASK-P11-01: Only attach child line items when include_items=true is explicitly requested
    let query: any = (includeItems && !summary)
      ? supabaseAdmin.from('invoices').select('*, invoice_items(*)')
      : supabaseAdmin.from('invoices').select('*');

    query = query
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (id) {
      query = query.eq('id', id);
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    if (shiftId) {
      query = query.eq('shift_id', shiftId);
    }
    if (invoiceType && invoiceType !== 'all') {
      query = query.eq('invoice_type', invoiceType);
    }
    // Clean ISO strings to YYYY-MM-DD if needed to accurately match date column
    const cleanStartDate = startDate ? (startDate.includes('T') ? startDate.split('T')[0] : startDate) : null;
    const cleanEndDate = endDate ? (endDate.includes('T') ? endDate.split('T')[0] : endDate) : null;
    if (cleanStartDate) {
      query = query.gte('date', cleanStartDate);
    }
    if (cleanEndDate) {
      query = query.lte('date', cleanEndDate);
    }
    if (paymentType && paymentType !== 'all') {
      query = query.eq('payment_type', paymentType);
    }
    if (search) {
      // FIX FINDING-API-007: strip PostgREST meta-characters before interpolation
      const safeSearch = sanitizePostgRESTLike(search);
      if (safeSearch) {
        query = query.or(`invoice_no.ilike.%${safeSearch}%,client_name.ilike.%${safeSearch}%`);
      }
    }

    const { data: invoices, error } = await query;
    if (error) throw error;

    const invoiceList = invoices || [];
    const hasMore = invoiceList.length === limit;
    const nextCursor = hasMore && invoiceList.length > 0
      ? invoiceList[invoiceList.length - 1].created_at
      : null;

    return NextResponse.json({
      success: true,
      invoices: invoiceList,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: nextCursor,
      },
      next_cursor: nextCursor,
      has_more: hasMore,
    });
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

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // 0. Server-Side Price & Margin Bounds Validation (VAL-03)
    const parsedSubtotal = Number(subtotal) || 0;
    const parsedDiscount = Number(discount) || 0;
    const parsedDelivery = Number(delivery_charge) || 0;
    const parsedNetTotal = Number(net_total) || 0;
    const parsedPaid = Number(paid_amount) || 0;
    const parsedDue = Number(due_amount) || 0;

    if (parsedDiscount < 0) {
      return NextResponse.json(
        { success: false, error: 'Discount amount cannot be negative' },
        { status: 400 }
      );
    }

    if (invoice_type !== 'return' && parsedSubtotal > 0 && parsedDiscount > parsedSubtotal) {
      return NextResponse.json(
        {
          success: false,
          error: `Discount amount (Rs. ${parsedDiscount.toLocaleString()}) cannot exceed subtotal (Rs. ${parsedSubtotal.toLocaleString()})`,
        },
        { status: 400 }
      );
    }

    if (parsedNetTotal < 0) {
      return NextResponse.json(
        { success: false, error: `Net total cannot be negative (received Rs. ${parsedNetTotal.toLocaleString()})` },
        { status: 400 }
      );
    }

    if (parsedPaid < 0 || parsedDue < 0) {
      return NextResponse.json(
        { success: false, error: 'Paid and due amounts cannot be negative' },
        { status: 400 }
      );
    }

    for (const it of items) {
      const lineQty = Number(it.qty) || 0;
      const linePrice = Number(it.unit_price ?? it.rate ?? it.price ?? 0);
      const lineDiscPercent = Number(it.discount_percent ?? it.discountPercent ?? 0);

      if (lineQty <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item "${it.item_name || it.name || it.productName || 'Product'}": must be greater than zero` },
          { status: 400 }
        );
      }
      if (linePrice < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid unit price for item "${it.item_name || it.name || it.productName || 'Product'}": cannot be negative` },
          { status: 400 }
        );
      }
      if (lineDiscPercent < 0 || lineDiscPercent > 100) {
        return NextResponse.json(
          { success: false, error: `Invalid discount percentage (${lineDiscPercent}%) for item "${it.item_name || it.name || it.productName || 'Product'}": must be between 0 and 100` },
          { status: 400 }
        );
      }
    }

    // 0.05 Rate lock: sale rates must match the catalog retail price (returns exempt)
    if (auth.session.role !== 'developer') {
      const rateLockError = await validateLockedRates(tenant_id, items, invoice_type);
      if (rateLockError) {
        return NextResponse.json({ success: false, error: rateLockError, code: 'RATE_LOCKED' }, { status: 400 });
      }
    }

    // 0.1 Backend Safeguard: Block credit sales for walk-in (no account) customers
    if (!client_id && parsedDue > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot record a credit sale without a customer account' },
        { status: 400 }
      );
    }

    // 0.2 Backend Hard-Stop Credit Limit Validation
    if (client_id && invoice_type !== 'return' && parsedDue > 0) {
      const { data: clientRecord } = await supabaseAdmin
        .from('clients')
        .select('credit_limit, current_balance')
        .eq('id', client_id)
        .maybeSingle();

      if (clientRecord) {
        const currentBal = Number(clientRecord.current_balance) || 0;
        const limit = Number(clientRecord.credit_limit) || 0;
        const projectedBalance = currentBal + parsedDue;

        if (limit > 0 && projectedBalance > limit) {
          const availableLimit = Math.max(0, limit - currentBal);
          return NextResponse.json(
            {
              success: false,
              error: `Insufficient credit limit. Available limit: Rs. ${availableLimit.toLocaleString()}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 1. Prepare Atomic Invoice Data
    const invoiceData = {
      tenant_id,
      invoice_no: String(invoice_no).trim(),
      client_id: client_id || null,
      client_name,
      shift_id: shift_id || null,
      date,
      subtotal: parsedSubtotal,
      discount: parsedDiscount,
      delivery_charge: parsedDelivery,
      remarks: remarks || null,
      invoice_type,
      net_total: parsedNetTotal,
      paid_amount: parsedPaid,
      due_amount: parsedDue,
      payment_type,
      cash_paid: Number(cash_paid) || 0,
      card_paid: Number(card_paid) || 0,
      bank_paid: Number(bank_paid) || 0,
      others_paid: Number(others_paid) || 0,
      status,
      created_by: created_by || null,
      printed_as: 'regular',
    };

    // 2. Prepare Atomic Invoice Items
    const invoiceItemsToInsert = items.map((it: any) => ({
      item_id: it.item_id || it.item?.id || null,
      item_code: it.item_code || it.code || it.item?.code || '',
      item_name: it.item_name || it.productName || it.name || it.item?.name || 'Product',
      shade_code: it.shade_code || it.shadeCode || '',
      pack_size: it.pack_size || it.packSize || it.unit || 'Can',
      unit: it.unit || it.item?.unit || 'PCS',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price ?? it.rate ?? it.price ?? 0),
      discount: Number(it.discount ?? 0),
      discount_percent: Number(it.discount_percent ?? it.discountPercent ?? 0),
      total_price: Number(it.total_price ?? (Number(it.qty || 1) * Number(it.unit_price ?? it.rate ?? 0))),
    }));

    // 3. Prepare Atomic Tokens
    const tokensToInsert = (body.tokens && Array.isArray(body.tokens))
      ? body.tokens
      : items
          .filter((it: any) => Boolean(it.has_token || it.hasToken) && ((it.token_value ?? it.tokenValue) > 0 || it.token_action || it.tokenAction))
          .map((it: any) => ({
            token_action: it.token_action || it.tokenAction || 'keep',
            quantity: Number(it.qty) || 1,
            brand_id: it.brand_id || it.item?.brand_id || null,
            brand_name: it.brand_name || it.brand || it.item?.brand || '',
            series_id: it.series_id || it.item?.series_id || null,
            series_name: it.series_name || it.item?.series_name || '',
            unit_name: it.unit || it.pack_size || it.item?.unit || '',
            token_value: Number(it.token_value ?? it.tokenValue ?? 0),
          }));

    // 4. Execute Atomic RPC Transaction (Invoice + Items + Stock + Client Balance + Tokens)
    const { data: atomicResult, error: rpcErr } = await supabaseAdmin.rpc('create_invoice_atomic', {
      p_invoice_data: invoiceData,
      p_items: invoiceItemsToInsert,
      p_tokens: tokensToInsert,
    });

    if (rpcErr) {
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...(atomicResult?.invoice || {}),
        items: invoiceItemsToInsert,
      },
      is_duplicate: Boolean(atomicResult?.is_duplicate),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update and modify an existing invoice (reopened in POS to add/change items)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      tenant_id,
      client_id,
      client_name = 'Walk-in Customer',
      subtotal = 0,
      discount = 0,
      delivery_charge = 0,
      remarks,
      net_total = 0,
      paid_amount = 0,
      due_amount = 0,
      payment_type = 'cash',
      cash_paid = 0,
      card_paid = 0,
      bank_paid = 0,
      others_paid = 0,
      status = 'completed',
      items = [],
    } = body;

    if (!id || !tenant_id) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Query invoice to verify special receipt guards
    const { data: existingInv } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_type, printed_as')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (existingInv) {
      // TASK-FIX-02 (R2, D5): Block cancellation of special return invoices
      if ((status === 'cancelled' || body.action === 'cancel') && existingInv.invoice_type === 'return' && existingInv.printed_as === 'special') {
        return NextResponse.json(
          { success: false, error: 'Special return invoices cannot be cancelled.' },
          { status: 400 }
        );
      }
      // TASK-SR-02b (D1): Block editing of special invoices
      if (status !== 'cancelled' && body.action !== 'cancel' && existingInv.printed_as === 'special') {
        return NextResponse.json(
          { success: false, error: 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.' },
          { status: 400 }
        );
      }
    }

    // Cancellation request: delegate to atomic cancellation function
    if (status === 'cancelled' || body.action === 'cancel') {
      const { data: cancelResult, error: cancelErr } = await supabaseAdmin.rpc('cancel_invoice_atomic', {
        p_tenant_id: tenant_id,
        p_invoice_id: id,
        p_reason: body.cancel_reason || remarks || 'Cancelled by operator',
        p_cancelled_by: body.cancelled_by || auth.session?.username || null,
      });

      if (cancelErr) {
        return NextResponse.json({ success: false, error: cancelErr.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, ...cancelResult });
    }

    if (!items.length) {
      return NextResponse.json(
        { success: false, error: 'At least 1 item is required for invoice update' },
        { status: 400 }
      );
    }

    // VAL-03: Price, discount, and margin validation safeguards for modified invoices
    const parsedSubtotal = Number(subtotal) || 0;
    const parsedDiscount = Number(discount) || 0;
    const parsedNetTotal = Number(net_total) || 0;
    const parsedPaid = Number(paid_amount) || 0;
    const parsedDue = Number(due_amount) || 0;

    if (parsedDiscount < 0) {
      return NextResponse.json(
        { success: false, error: 'Discount amount cannot be negative' },
        { status: 400 }
      );
    }

    if (parsedSubtotal > 0 && parsedDiscount > parsedSubtotal) {
      return NextResponse.json(
        {
          success: false,
          error: `Discount amount (Rs. ${parsedDiscount.toLocaleString()}) cannot exceed subtotal (Rs. ${parsedSubtotal.toLocaleString()})`,
        },
        { status: 400 }
      );
    }

    if (parsedNetTotal < 0) {
      return NextResponse.json(
        { success: false, error: `Net total cannot be negative (received Rs. ${parsedNetTotal.toLocaleString()})` },
        { status: 400 }
      );
    }

    if (parsedPaid < 0 || parsedDue < 0) {
      return NextResponse.json(
        { success: false, error: 'Paid and due amounts cannot be negative' },
        { status: 400 }
      );
    }

    // Rate lock: lines must match catalog retail price, or the rate the line already had on this invoice
    if (auth.session.role !== 'developer') {
      const { data: existingLineRows } = await supabaseAdmin
        .from('invoice_items')
        .select('item_id, item_code, unit_price')
        .eq('invoice_id', id);
      const patchInvoiceType = (existingInv as any)?.invoice_type || body.invoice_type || 'sales';
      const rateLockError = await validateLockedRates(tenant_id, items, patchInvoiceType, existingLineRows || []);
      if (rateLockError) {
        return NextResponse.json({ success: false, error: rateLockError, code: 'RATE_LOCKED' }, { status: 400 });
      }
    }

    for (const it of items) {
      const lineQty = Number(it.qty) || 0;
      const linePrice = Number(it.unit_price ?? it.rate ?? it.price ?? 0);
      const lineDiscPercent = Number(it.discount_percent ?? it.discountPercent ?? 0);

      if (lineQty <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item "${it.item_name || it.name || it.productName || 'Product'}": must be greater than zero` },
          { status: 400 }
        );
      }
      if (linePrice < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid unit price for item "${it.item_name || it.name || it.productName || 'Product'}": cannot be negative` },
          { status: 400 }
        );
      }
      if (lineDiscPercent < 0 || lineDiscPercent > 100) {
        return NextResponse.json(
          { success: false, error: `Invalid discount percentage (${lineDiscPercent}%) for item "${it.item_name || it.name || it.productName || 'Product'}": must be between 0 and 100` },
          { status: 400 }
        );
      }
    }

    // Task 12.2 — FINDING-E2E-004 FIX:
    // All 6 sequential steps (stock revert, item delete, item insert, stock apply,
    // balance delta, header update) now execute inside a single PostgreSQL transaction
    // via update_invoice_atomic RPC. Partial failure auto-rolls back all changes.
    const invoiceData = {
      client_id: client_id || null,
      client_name,
      subtotal: Number(subtotal),
      discount: Number(discount),
      delivery_charge: Number(delivery_charge),
      remarks: remarks || null,
      net_total: Number(net_total),
      paid_amount: Number(paid_amount),
      due_amount: Number(due_amount),
      payment_type,
      cash_paid: Number(cash_paid),
      card_paid: Number(card_paid),
      bank_paid: Number(bank_paid),
      others_paid: Number(others_paid),
      status,
      invoice_type: body.invoice_type || 'sales',
    };

    const invoiceItemsToInsert = items.map((it: any) => ({
      item_id: it.item_id || it.item?.id || null,
      item_code: it.item_code || it.code || it.item?.code || '',
      item_name: it.item_name || it.productName || it.name || it.item?.name || '',
      shade_code: it.shade_code || it.shadeCode || '',
      pack_size: it.pack_size || it.packSize || it.unit || 'Can',
      unit: it.unit || it.item?.unit || 'PCS',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price || it.rate || it.price) || 0,
      discount: Number(it.discount) || 0,
      discount_percent: Number(it.discount_percent || it.discountPercent) || 0,
      total_price: Number(it.total_price || (it.qty * (it.unit_price || it.rate || 0))) || 0,
    }));

    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('update_invoice_atomic', {
      p_invoice_id:   id,
      p_tenant_id:    tenant_id,
      p_invoice_data: invoiceData,
      p_items:        invoiceItemsToInsert,
    });

    if (rpcErr) throw rpcErr;

    return NextResponse.json({
      success: true,
      invoice: {
        ...((rpcResult as any)?.invoice || {}),
        items: invoiceItemsToInsert,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Cancel an invoice atomically (reverts stock, client balance, and tokens)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenant_id');
    const reason = searchParams.get('reason') || 'Cancelled by operator';

    if (!id || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // TASK-FIX-02 (R2, D5): Block cancellation of special return invoices
    const { data: targetInv } = await supabaseAdmin
      .from('invoices')
      .select('invoice_type, printed_as')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (targetInv && targetInv.invoice_type === 'return' && targetInv.printed_as === 'special') {
      return NextResponse.json(
        { success: false, error: 'Special return invoices cannot be cancelled.' },
        { status: 400 }
      );
    }

    const { data: cancelRes, error: cancelErr } = await supabaseAdmin.rpc('cancel_invoice_atomic', {
      p_tenant_id: tenantId,
      p_invoice_id: id,
      p_reason: reason,
      p_cancelled_by: auth.session?.username || null,
    });

    if (cancelErr) {
      return NextResponse.json({ success: false, error: cancelErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...cancelRes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


