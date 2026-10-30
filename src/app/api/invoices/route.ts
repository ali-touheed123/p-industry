import { karachiToday } from '@/lib/karachiDate';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { sanitizePostgRESTLike } from '@/lib/utils';
import { validateLockedRates, HistoricalPriceMatch } from '@/lib/rate-lock';
import { logAuditEvent } from '@/lib/audit-logs';
import { isPlaceholderWalkInName } from '@/utils/customerName';

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
        query = query.or(`invoice_no.ilike.%${safeSearch}%,client_name.ilike.%${safeSearch}%,local_receipt_no.ilike.%${safeSearch}%`);
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
    if (error?.message?.includes('IDEMPOTENCY_CONFLICT')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
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
      date = karachiToday(),
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
      idempotency_key,
    } = body;

    const isOffline = Boolean(body.is_offline);
    const createdAtLocal = body.created_at_local ? String(body.created_at_local) : null;
    const deviceId = body.device_id ? String(body.device_id) : null;
    const localReceiptNo = body.local_receipt_no ? String(body.local_receipt_no) : null;
    const offlineSchemaVersion = body.offline_schema_version ? Number(body.offline_schema_version) : null;
    const historicalMatches: HistoricalPriceMatch[] = [];

    if (localReceiptNo && !deviceId) {
      return NextResponse.json(
        { success: false, error: 'device_id is required when local_receipt_no is present', code: 'DEVICE_ID_REQUIRED' },
        { status: 400 }
      );
    }

    if (!tenant_id || (!invoice_no && !idempotency_key) || !items.length) {
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

    // Walk-in rule: a sale without a customer account must carry a real walk-in name
    if (invoice_type !== 'return' && !client_id && isPlaceholderWalkInName(client_name)) {
      return NextResponse.json(
        { success: false, error: 'Walk-in customer ka naam zaroori hai. Customer select karein ya naam likhein.', code: 'WALK_IN_NAME_REQUIRED' },
        { status: 400 }
      );
    }

    // 0.05 Rate lock: sale rates must match the catalog retail price (returns exempt)
    if (auth.session.role !== 'developer') {
      const rateLockError = await validateLockedRates(
        tenant_id,
        items,
        invoice_type,
        [],
        {
          isOffline,
          createdAtLocal,
          isSpecialSale: false,
          hasCeoOverride: Boolean(body.ceo_override_token || body.has_ceo_override),
          collectedHistoricalMatches: historicalMatches,
        }
      );
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

    // 0.3 Server-Side N4 Math & Equality Validations (1-Rupee Tolerance)
    const expectedNetTotal = parsedSubtotal - parsedDiscount + parsedDelivery;
    if (Math.abs(parsedNetTotal - expectedNetTotal) > 1.00) {
      return NextResponse.json(
        {
          success: false,
          error: `Formula error: Net total (Rs. ${parsedNetTotal}) does not match Subtotal (${parsedSubtotal}) - Discount (${parsedDiscount}) + Delivery (${parsedDelivery})`,
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

    const parsedCashPaid = Number(cash_paid) || 0;
    const parsedCardPaid = Number(card_paid) || 0;
    const parsedBankPaid = Number(bank_paid) || 0;
    const parsedOthersPaid = Number(others_paid) || 0;
    const tenderSum = parsedCashPaid + parsedCardPaid + parsedBankPaid + parsedOthersPaid;
    if (Math.abs(tenderSum - parsedPaid) > 1.00) {
      return NextResponse.json(
        {
          success: false,
          error: `Tender error: Sum of payments (Cash ${parsedCashPaid} + Card ${parsedCardPaid} + Bank ${parsedBankPaid} + Others ${parsedOthersPaid} = ${tenderSum}) does not match Paid Amount (${parsedPaid})`,
          code: 'INVALID_TENDER_SUM'
        },
        { status: 400 }
      );
    }

    let calculatedLineItemsTotal = 0;
    for (const it of items) {
      const lineQty = Number(it.qty) || 0;
      const linePrice = Number(it.unit_price ?? it.rate ?? it.price ?? 0);
      const lineDiscVal = Number(it.discount ?? 0);
      const lineTotal = Number(it.total_price ?? (lineQty * linePrice - lineDiscVal));
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

    // 0.4 Server-Side N3 Return Limits & Validation
    let resolvedShiftId = shift_id;
    if (invoice_type === 'return') {
      const originalInvoiceId = body.original_invoice_id;
      if (originalInvoiceId) {
        const { data: origInv, error: origErr } = await supabaseAdmin
          .from('invoices')
          .select('id, invoice_no, tenant_id, status, net_total, invoice_type, invoice_items(*)')
          .eq('id', originalInvoiceId)
          .eq('tenant_id', tenant_id)
          .maybeSingle();

        if (origErr || !origInv) {
          return NextResponse.json(
            { success: false, error: 'Original invoice not found for this return', code: 'ORIGINAL_INVOICE_NOT_FOUND' },
            { status: 400 }
          );
        }

        if (origInv.status === 'cancelled' || origInv.status === 'void') {
          return NextResponse.json(
            { success: false, error: `Cannot return items against ${origInv.status} invoice #${origInv.invoice_no}`, code: 'INVOICE_CANCELLED' },
            { status: 400 }
          );
        }

        // Fetch all prior non-cancelled returns against this invoice
        const { data: priorReturns } = await supabaseAdmin
          .from('invoices')
          .select('id, invoice_items(item_id, item_code, qty)')
          .eq('original_invoice_id', originalInvoiceId)
          .eq('tenant_id', tenant_id)
          .eq('invoice_type', 'return')
          .not('status', 'in', '(cancelled,void)');

        const returnedQtyMap = new Map<string, number>();
        (priorReturns || []).forEach((ret: any) => {
          (ret.invoice_items || []).forEach((it: any) => {
            const key = it.item_id || it.item_code;
            if (key) {
              returnedQtyMap.set(key, (returnedQtyMap.get(key) || 0) + Number(it.qty || 0));
            }
          });
        });

        // Validate each return item against original invoice item quantity
        for (const it of items) {
          const key = it.item_id || it.item_code;
          const origLine = (origInv.invoice_items || []).find((ol: any) =>
            (ol.item_id && ol.item_id === it.item_id) || (ol.item_code && ol.item_code === it.item_code)
          );

          if (!origLine) {
            return NextResponse.json(
              { success: false, error: `Item "${it.item_name || it.item_code}" was not found on original invoice #${origInv.invoice_no}`, code: 'ITEM_NOT_ON_INVOICE' },
              { status: 400 }
            );
          }

          const alreadyReturned = returnedQtyMap.get(key) || 0;
          const returnQty = Number(it.qty) || 0;
          const maxAllowed = Number(origLine.qty) - alreadyReturned;

          if (returnQty > maxAllowed + 0.0001) {
            return NextResponse.json(
              {
                success: false,
                error: `Return quantity (${returnQty}) for item "${it.item_name}" exceeds remaining returnable quantity (${maxAllowed}). Already returned: ${alreadyReturned}, Original: ${origLine.qty}`,
                code: 'RETURN_QUANTITY_EXCEEDED'
              },
              { status: 400 }
            );
          }
        }
      }

      // If returning for cash refund, ensure an active open shift exists
      if (parsedCashPaid > 0 || (payment_type || '').toLowerCase() === 'cash') {
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
              { success: false, error: 'Cannot process a cash sales refund without an active open register shift.', code: 'NO_OPEN_SHIFT' },
              { status: 400 }
            );
          }
          resolvedShiftId = openShift.id;
        }
      }
    }

    // Offline shift reconciliation: keep open shift, fallback to currently open shift as late-sync, or wait
    let finalShiftId = resolvedShiftId || shift_id || null;
    let isLateSync = false;
    let originalShiftId: string | null = null;

    if (isOffline) {
      const queuedShiftId = shift_id || null;
      let originalShiftIsOpen = false;

      if (queuedShiftId) {
        const { data: qShift } = await supabaseAdmin
          .from('shifts')
          .select('id, status')
          .eq('id', queuedShiftId)
          .eq('tenant_id', tenant_id)
          .maybeSingle();

        if (qShift && qShift.status === 'open') {
          originalShiftIsOpen = true;
          finalShiftId = queuedShiftId;
          isLateSync = false;
          originalShiftId = null;
        }
      }

      if (!originalShiftIsOpen) {
        const { data: openShift } = await supabaseAdmin
          .from('shifts')
          .select('id')
          .eq('tenant_id', tenant_id)
          .eq('status', 'open')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openShift) {
          finalShiftId = openShift.id;
          isLateSync = true;
          originalShiftId = queuedShiftId;
        } else {
          return NextResponse.json(
            {
              success: false,
              waiting_for_shift: true,
              error: 'Cannot sync offline sale: No register shift is currently open. Sale will sync automatically once a shift is opened.',
              code: 'WAITING_FOR_OPEN_SHIFT',
            },
            { status: 422 }
          );
        }
      }
    }

    // 1. Prepare Atomic Invoice Data
    const invoiceData = {
      tenant_id,
      invoice_no: invoice_no ? String(invoice_no).trim() : null,
      idempotency_key: idempotency_key || null,
      client_id: client_id || null,
      client_name,
      shift_id: finalShiftId,
      original_invoice_id: body.original_invoice_id || null,
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
      is_offline: isOffline,
      created_at_local: createdAtLocal,
      device_id: deviceId,
      local_receipt_no: localReceiptNo,
      offline_schema_version: offlineSchemaVersion,
      is_late_sync: isLateSync,
      original_shift_id: originalShiftId,
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
      cost_price: Number(it.cost_price ?? it.costPrice ?? it.item?.cost_price ?? 0) || null,
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
      if (rpcErr.message?.includes('IDEMPOTENCY_CONFLICT')) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 409 });
      }
      if (rpcErr.message?.includes('OFFLINE_RECEIPT_DUPLICATE')) {
        return NextResponse.json({ success: false, error: rpcErr.message, code: 'OFFLINE_RECEIPT_DUPLICATE' }, { status: 409 });
      }
      if (rpcErr.message?.includes('OFFLINE_TIME_FUTURE')) {
        return NextResponse.json({ success: false, error: rpcErr.message, code: 'OFFLINE_TIME_FUTURE' }, { status: 422 });
      }
      if (rpcErr.message?.includes('OFFLINE_TIME_TOO_OLD')) {
        return NextResponse.json({ success: false, error: rpcErr.message, code: 'OFFLINE_TIME_TOO_OLD', needs_attention: true }, { status: 422 });
      }
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    // Write audit log for accepted historical rates ONLY on first creation (never on duplicate retry)
    if (!atomicResult?.is_duplicate && historicalMatches.length > 0) {
      for (const match of historicalMatches) {
        await logAuditEvent({
          tenantId: tenant_id,
          userId: auth.session.userId || null,
          userName: auth.session.username || 'cashier',
          action: 'OFFLINE_HISTORICAL_PRICE_ACCEPTED',
          actionType: 'pos_offline_rate_lock',
          entityType: 'invoice',
          entityId: atomicResult?.invoice?.id || null,
          details: {
            invoice_no: atomicResult?.invoice?.invoice_no,
            itemId: match.itemId,
            itemName: match.itemName,
            quotedPrice: match.quotedPrice,
            currentCatalogPrice: match.currentPrice,
            historicalPrice: match.historicalPrice,
            effectiveFrom: match.effectiveFrom,
            createdAtLocal: createdAtLocal,
          },
        });
      }
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

    // Edit reason is mandatory when a saved sale is edited from POS
    const editReason = String(body.edit_reason ?? '').trim();
    if (auth.session.role !== 'developer' && editReason.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Edit karne ki wajah (reason) likhna zaroori hai.', code: 'EDIT_REASON_REQUIRED' },
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

    // Audit: who edited the sale and why (the RPC's own log has no reason)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id,
        user_name: auth.session.username,
        action: `Invoice Edit ${(existingInv as any)?.invoice_no || id} — Reason: ${editReason || 'n/a'}`,
        action_type: 'update',
        entity_type: 'invoice',
        entity_id: id,
        details: { reason: editReason || null, invoice_no: (existingInv as any)?.invoice_no || null },
      });
    } catch (auditErr) {
      console.warn('[Invoices PATCH] edit-reason audit log failed', auditErr);
    }

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

    // N5 & Special Return Checks
    const { data: targetInv } = await supabaseAdmin
      .from('invoices')
      .select('invoice_type, printed_as, cash_paid, payment_type, shift_id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!targetInv) {
      return NextResponse.json({ success: false, error: 'Invoice not found.' }, { status: 404 });
    }

    if (targetInv.status === 'cancelled' || targetInv.status === 'void') {
      return NextResponse.json({ success: false, error: 'Invoice is already cancelled or void.' }, { status: 400 });
    }

    // Block cancellation of special return invoices
    if (targetInv.invoice_type === 'return' && targetInv.printed_as === 'special') {
      return NextResponse.json(
        { success: false, error: 'Special return invoices cannot be cancelled.' },
        { status: 400 }
      );
    }

    // N5 Guard: If invoice had cash received and its shift is closed,
    // ensure an open shift exists to record the cash refund petty expense.
    if (Number(targetInv.cash_paid || 0) > 0 && targetInv.shift_id) {
      const { data: shiftRecord } = await supabaseAdmin
        .from('shifts')
        .select('status')
        .eq('id', targetInv.shift_id)
        .maybeSingle();

      if (shiftRecord && shiftRecord.status === 'closed') {
        const { data: openShift } = await supabaseAdmin
          .from('shifts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .limit(1)
          .maybeSingle();

        if (!openShift) {
          return NextResponse.json(
            {
              success: false,
              error: 'Cannot cancel an invoice with cash paid from a closed shift without an active open register shift to disburse and record the cash refund.',
              code: 'OPEN_SHIFT_REQUIRED_FOR_CASH_REFUND'
            },
            { status: 400 }
          );
        }
      }
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


