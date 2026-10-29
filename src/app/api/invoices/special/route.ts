import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { validateLockedRates } from '@/lib/rate-lock';
import { isPlaceholderWalkInName } from '@/utils/customerName';

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
      net_total = 0,
      paid_amount = 0,
      due_amount = 0,
      payment_type = 'cash',
      cash_paid = 0,
      card_paid = 0,
      bank_paid = 0,
      others_paid = 0,
      items = [],
      tokens = [],
      receipt_snapshot = {},
      idempotency_key,
    } = body;

    if (!tenant_id || (!invoice_no && !idempotency_key) || !items.length) {
      return NextResponse.json(
        { success: false, error: 'tenant_id, invoice_no, and at least 1 item are required' },
        { status: 400 }
      );
    }

    // 1. Session Auth & Branch Isolation
    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Walk-in rule: a sale without a customer account must carry a real walk-in name
    if (!client_id && isPlaceholderWalkInName(client_name)) {
      return NextResponse.json(
        { success: false, error: 'Walk-in customer ka naam zaroori hai. Customer select karein ya naam likhein.', code: 'WALK_IN_NAME_REQUIRED' },
        { status: 400 }
      );
    }

    // Rate lock: printed rate on a special sale is the catalog retail price
    if (auth.session.role !== 'developer') {
      const rateLockError = await validateLockedRates(tenant_id, items, 'sales');
      if (rateLockError) {
        return NextResponse.json({ success: false, error: rateLockError, code: 'RATE_LOCKED' }, { status: 400 });
      }
    }

    // 2. Role & Database Permission Verification
    let printedBy = 'Staff';
    let effectiveUserId: string | null = null;

    if (auth.session.role === 'developer') {
      // In dev mode, map to the branch's first active staff user with special receipt permission.
      // This prevents RPC failures when testing special invoices from the dev panel on a branch route.
      const { data: devStaff } = await supabaseAdmin
        .from('app_users')
        .select('id, username, full_name')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .eq('can_use_special_receipt', true)
        .eq('role', 'staff')
        .limit(1)
        .maybeSingle();

      printedBy = devStaff
        ? `Dev (via ${devStaff.full_name || devStaff.username})`
        : 'Developer Super Admin';
      effectiveUserId = devStaff?.id ?? null;
    } else if (auth.session.role === 'ceo') {
      // CEO is allowed to create special invoices for branches they own
      printedBy = auth.session.username || 'CEO';
      effectiveUserId = null;
    } else if (auth.session.role === 'staff') {
      const { data: user, error: userErr } = await supabaseAdmin
        .from('app_users')
        .select('id, username, full_name, role, is_active, can_use_special_receipt, tenant_id')
        .eq('id', auth.session.userId)
        .maybeSingle();

      if (userErr || !user?.is_active || !user.can_use_special_receipt || user.tenant_id !== tenant_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied: Special Receipt permission required for this branch.' },
          { status: 403 }
        );
      }
      printedBy = user.full_name || user.username || 'Staff';
      effectiveUserId = user.id;
    } else {
      return NextResponse.json(
        { success: false, error: 'Access denied: Special sale checkout is restricted to counter staff.' },
        { status: 403 }
      );
    }

    // 3. Active Shift Validation (Must belong to tenant & be open)
    let activeShiftId = shift_id;
    if (!activeShiftId) {
      const { data: openShift } = await supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();

      if (!openShift) {
        return NextResponse.json(
          { success: false, error: 'Cannot record sale without an active open shift.' },
          { status: 400 }
        );
      }
      activeShiftId = openShift.id;
    } else {
      const { data: shiftCheck } = await supabaseAdmin
        .from('shifts')
        .select('id, status')
        .eq('id', activeShiftId)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (!shiftCheck || shiftCheck.status !== 'open') {
        return NextResponse.json(
          { success: false, error: 'The specified shift is not currently active or open.' },
          { status: 400 }
        );
      }
    }

    // 4. Server-Side Price & Margin Bounds Validation (VAL-03)
    const parsedSubtotal = Number(subtotal) || 0;
    const parsedDiscount = Number(discount) || 0;
    const parsedDelivery = Number(delivery_charge) || 0;
    const parsedNetTotal = Number(net_total) || 0;
    const parsedPaid = Number(paid_amount) || 0;
    const parsedDue = Number(due_amount) || 0;

    if (parsedDiscount < 0 || parsedDelivery < 0 || parsedPaid < 0 || parsedDue < 0) {
      return NextResponse.json(
        { success: false, error: 'Financial amounts cannot be negative.' },
        { status: 400 }
      );
    }

    // Option A rule: invoice-level discount is strictly 0 for special invoices
    if (parsedDiscount > 0) {
      return NextResponse.json(
        { success: false, error: 'Option A Content Rule: Invoice-level discounts are not allowed on special receipts. Use line discounts.' },
        { status: 400 }
      );
    }

    // Item-level validations
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const q = Number(it.qty) || 0;
      const rate = Number(it.unit_price ?? it.rate ?? 0);
      const disc = Number(it.discount || 0);

      if (q <= 0) {
        return NextResponse.json(
          { success: false, error: `Item ${i + 1} (${it.productName || it.item_name || 'Item'}): Quantity must be greater than 0.` },
          { status: 400 }
        );
      }
      if (rate < 0) {
        return NextResponse.json(
          { success: false, error: `Item ${i + 1}: Unit price cannot be negative.` },
          { status: 400 }
        );
      }
      if (disc < 0 || disc > (q * rate)) {
        return NextResponse.json(
          { success: false, error: `Item ${i + 1}: Line discount cannot exceed line total.` },
          { status: 400 }
        );
      }
    }

    // 5. Customer Account & Credit Limit Enforcement
    if (!client_id && parsedDue > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot record a credit sale without a customer account.' },
        { status: 400 }
      );
    }

    if (client_id && parsedDue > 0) {
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

    // 6. Build Atomic Payload & Execute create_special_invoice_atomic
    const invoiceData = {
      tenant_id,
      invoice_no: invoice_no ? String(invoice_no).trim() : null,
      idempotency_key: idempotency_key || null,
      client_id: client_id || null,
      client_name: client_name || 'Walk-in Customer',
      shift_id: activeShiftId,
      date,
      subtotal: parsedSubtotal,
      discount: 0, // Enforced 0
      delivery_charge: parsedDelivery,
      remarks: remarks || null,
      invoice_type: 'sales',
      net_total: parsedNetTotal,
      paid_amount: parsedPaid,
      due_amount: parsedDue,
      payment_type,
      cash_paid: Number(cash_paid) || 0,
      card_paid: Number(card_paid) || 0,
      bank_paid: Number(bank_paid) || 0,
      others_paid: Number(others_paid) || 0,
      status: 'completed',
      created_by: printedBy,
    };

    const cleanItems = items.map((it: any) => ({
      item_id: it.item_id || it.item?.id || null,
      item_code: it.item_code || it.code || it.item?.code || '',
      item_name: it.item_name || it.productName || it.name || it.item?.name || 'Product',
      shade_code: it.shade_code || it.shadeCode || '',
      pack_size: it.pack_size || it.packSize || it.unit || 'Can',
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price ?? it.rate ?? 0),
      pre_discount_rate: Number(it.pre_discount_rate ?? it.unit_price ?? it.rate ?? 0),
      discount: Number(it.discount || 0),
      discount_percent: Number(it.discount_percent ?? it.discountPercent ?? 0),
      total_price: Number(it.total_price ?? (Number(it.qty || 1) * Number(it.unit_price ?? it.rate ?? 0) - Number(it.discount || 0))),
      // Overrides for receipt snapshot
      receipt_name: it.receipt_name || undefined,
      receipt_shade: it.receipt_shade || undefined,
      receipt_pack_size: it.receipt_pack_size || undefined,
      receipt_notes: it.receipt_notes || undefined,
      has_token: it.has_token || it.hasToken || false,
      token_value: Number(it.token_value ?? it.tokenValue ?? 0),
      token_action: it.token_action || it.tokenAction || 'keep',
    }));

    const receiptSnap = {
      invoice_no,
      client_name: client_name || 'Walk-in Customer',
      date,
      header_note: receipt_snapshot?.header_note || '',
      footer_note: receipt_snapshot?.footer_note || '',
      delivery_charge: parsedDelivery,
      payment_type,
      paid_amount: parsedPaid,
      due_amount: parsedDue,
    };

    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('create_special_invoice_atomic', {
      p_invoice_data: invoiceData,
      p_items: cleanItems,
      p_receipt_snap: receiptSnap,
      p_printed_by: printedBy,
      p_user_id: effectiveUserId,
      p_tokens: tokens || [],
    });

    if (rpcErr) {
      if (rpcErr.message?.includes('IDEMPOTENCY_CONFLICT')) {
        return NextResponse.json({ success: false, error: rpcErr.message }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 400 });
    }

    if (rpcRes && rpcRes.snapshot) {
      rpcRes.snapshot.payment_type = rpcRes.snapshot.payment_type || payment_type;
      rpcRes.snapshot.paid_amount = rpcRes.snapshot.paid_amount ?? parsedPaid;
      rpcRes.snapshot.due_amount = rpcRes.snapshot.due_amount ?? parsedDue;
      rpcRes.snapshot.invoice_no = rpcRes.snapshot.invoice_no || invoice_no;
      rpcRes.snapshot.client_name = rpcRes.snapshot.client_name || client_name;
      rpcRes.snapshot.date = rpcRes.snapshot.date || date;
    }

    return NextResponse.json(rpcRes);
  } catch (err: any) {
    if (err?.message?.includes('IDEMPOTENCY_CONFLICT')) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
