import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

async function resolveTenantId(idOrSlug: string): Promise<string | null> {
  if (!idOrSlug) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  if (isUuid) return idOrSlug;

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', idOrSlug.trim().toLowerCase())
    .maybeSingle();

  return tenant?.id || idOrSlug;
}

// GET: Fetch current active shift or shift history for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const lastClosed = searchParams.get('last_closed'); // get last closed shift
    const sameDayPrevious = searchParams.get('same_day_previous');
    const currentShiftId = searchParams.get('current_shift_id');

    if (!tenantIdParam) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const tenantId = await resolveTenantId(tenantIdParam);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Special: return only last closed shift (for handover pre-fill)
    if (lastClosed === '1') {
      const { data: lastShift, error } = await supabaseAdmin
        .from('shifts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ success: true, lastClosedShift: lastShift || null });
    }

    // Special: return previous closed shift on the same calendar day
    if (sameDayPrevious === '1' && currentShiftId) {
      // First get the current shift to know its date
      const { data: currentShift } = await supabaseAdmin
        .from('shifts')
        .select('start_time, created_at')
        .eq('id', currentShiftId)
        .maybeSingle();

      if (currentShift) {
        const shiftDate = (currentShift.start_time || currentShift.created_at || '').split('T')[0];
        if (shiftDate) {
          const { data: prevShifts, error } = await supabaseAdmin
            .from('shifts')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('status', 'closed')
            .neq('id', currentShiftId)
            .gte('start_time', `${shiftDate}T00:00:00`)
            .lte('start_time', `${shiftDate}T23:59:59`)
            .order('created_at', { ascending: false })
            .limit(1);

          if (error) throw error;
          const prevShift = prevShifts && prevShifts.length > 0 ? prevShifts[0] : null;
          if (prevShift) {
            const { data: prevInvoices } = await supabaseAdmin
              .from('invoices')
              .select('net_total, invoice_type, status')
              .eq('shift_id', prevShift.id)
              .neq('status', 'cancelled');

            let prevNetSales = 0;
            if (prevInvoices && prevInvoices.length > 0) {
              prevNetSales = prevInvoices.reduce((sum: number, inv: any) => {
                const amt = Number(inv.net_total || 0);
                return (inv.invoice_type || 'sales') === 'return' ? sum - amt : sum + amt;
              }, 0);
            }
            return NextResponse.json({
              success: true,
              previousSameDayShift: { ...prevShift, net_sales: prevNetSales },
            });
          }
          return NextResponse.json({
            success: true,
            previousSameDayShift: null,
          });
        }
      }
      return NextResponse.json({ success: true, previousSameDayShift: null });
    }

    let query = supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: shifts, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      activeShift: shifts?.find(s => s.status === 'open') || null,
      shifts: shifts || [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Open a new shift (with handover tracking)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id: rawTenantId,
      opened_by,
      opening_cash = 0,
      previous_closing_cash = 0,
      handover_variance = 0,
      handover_notes,
      notes,
    } = body;

    if (!rawTenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const tenant_id = await resolveTenantId(rawTenantId);
    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // FIX DB-08: block new shift if an open shift already exists for this tenant
    const { data: existingOpen } = await supabaseAdmin
      .from('shifts')
      .select('id, start_time')
      .eq('tenant_id', tenant_id)
      .eq('status', 'open')
      .maybeSingle();

    if (existingOpen) {
      return NextResponse.json(
        {
          success: false,
          error: 'A shift is already open for this register. Please close the current shift before opening a new one.',
          existing_shift_id: existingOpen.id,
        },
        { status: 409 }
      );
    }

    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .insert({
        tenant_id,
        opened_by: opened_by || null,
        opening_cash: Number(opening_cash) || 0,
        previous_closing_cash: Number(previous_closing_cash) || 0,
        handover_variance: Number(handover_variance) || 0,
        handover_notes: handover_notes || null,
        start_time: new Date().toISOString(),
        status: 'open',
        notes: notes || 'Counter Shift Opened',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Close an existing shift with reconciliation numbers
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      closed_by,
      expected_cash = 0,
      actual_cash = 0,
      difference = 0,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Shift ID required' }, { status: 400 });
    }

    // FIX FINDING-API-011: Fetch resource first. If missing, return 404 immediately
    // before calling requireTenantAuth() to avoid null-scope auth bypass.
    const { data: existingShift } = await supabaseAdmin
      .from('shifts')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingShift) {
      return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingShift.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // FIX DB-08: recompute expected_cash server-side from DB transactions.
    // The client-supplied expected_cash cannot be trusted — a tampered POS could
    // submit any value to hide a cash shortage on shift close.
    let serverExpectedCash = Number(expected_cash); // client value as starting fallback
    try {
      const shiftRecord = await supabaseAdmin
        .from('shifts')
        .select('opening_cash, tenant_id, start_time')
        .eq('id', id)
        .maybeSingle();

      if (shiftRecord.data) {
        const openingAmt = Number(shiftRecord.data.opening_cash || 0);
        const tenantId = shiftRecord.data.tenant_id;
        const startTime = shiftRecord.data.start_time || new Date().toISOString().split('T')[0] + 'T00:00:00';

        // Sum cash received and cash returned: invoices linked to this shift (excluding cancelled)
        const { data: shiftInvoices } = await supabaseAdmin
          .from('invoices')
          .select('net_total, paid_amount, cash_paid, payment_type, invoice_type, status')
          .eq('shift_id', id)
          .eq('tenant_id', tenantId)
          .neq('status', 'cancelled');

        let cashIn = 0;
        let cashReturns = 0;
        if (shiftInvoices) {
          shiftInvoices.forEach((inv: any) => {
            const isReturn = (inv.invoice_type || 'sales') === 'return';
            const cp = Number(inv.cash_paid || 0);
            const pt = (inv.payment_type || '').toLowerCase();
            const fallbackAmount = Number(inv.paid_amount || inv.net_total || 0);
            const cashAmount = cp > 0 ? cp : (!pt || pt === 'cash' || pt === 'refund' ? fallbackAmount : 0);

            if (isReturn) {
              cashReturns += cashAmount;
            } else {
              cashIn += cashAmount;
            }
          });
        }

        // Deduct supplier purchases paid in cash from the drawer during this shift
        let supplierCashPaid = 0;
        const { data: shiftPurchases } = await supabaseAdmin
          .from('purchases')
          .select('net_total, paid_amount, payment_type, purchase_type, shift_id, created_at')
          .eq('tenant_id', tenantId)
          .or(`shift_id.eq.${id},and(shift_id.is.null,created_at.gte.${startTime})`);

        if (shiftPurchases) {
          shiftPurchases.forEach((p: any) => {
            if ((p.purchase_type || 'purchase') === 'return') return;
            const pt = (p.payment_type || '').toLowerCase();
            if (pt === 'cash') {
              const paid = Number(p.paid_amount || p.net_total || 0);
              supplierCashPaid += paid;
            } else if (Number(p.paid_amount || 0) > 0 && pt.includes('cash')) {
              supplierCashPaid += Number(p.paid_amount);
            }
          });
        }

        // Deduct cash expenses
        const { data: shiftExpenses } = await supabaseAdmin
          .from('petty_expenses')
          .select('amount')
          .eq('shift_id', id)
          .eq('tenant_id', tenantId);
        const totalExpenses = (shiftExpenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

        // Deduct token cash payouts from token_transactions (type = 'redeemed', matching ShiftDrawer authoritative path)
        const { data: shiftRedemptions } = await supabaseAdmin
          .from('token_transactions')
          .select('total_amount')
          .eq('shift_id', id)
          .eq('tenant_id', tenantId)
          .eq('type', 'redeemed');
        const totalTokenPayouts = (shiftRedemptions || []).reduce(
          (s: number, r: any) => s + Number(r.total_amount || 0), 0
        );

        // Formula matches ShiftDrawer.tsx parity:
        // Expected Cash = Opening Cash + Cash Sales - Cash Returns - Supplier Cash Paid - Total Expenses - Tokens Redeemed Cash
        serverExpectedCash = Math.max(
          0,
          openingAmt + cashIn - cashReturns - supplierCashPaid - totalExpenses - totalTokenPayouts
        );
      }
    } catch (calcErr) {
      // FIX FINDING-API-014: Hard-fail on reconciliation error.
      // The previous code fell back to the client-supplied expected_cash, which
      // a tampered POS could manipulate to conceal a cash shortage on shift close.
      console.error('Server-side expected_cash recomputation failed — aborting shift close:', calcErr);
      return NextResponse.json(
        { success: false, error: 'Shift close failed: unable to recompute expected cash from server transactions. Please try again.' },
        { status: 500 }
      );
    }

    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .update({
        closed_by: closed_by || null,
        end_time: new Date().toISOString(),
        expected_cash: serverExpectedCash,
        actual_cash: Number(actual_cash),
        difference: Number(actual_cash) - serverExpectedCash,
        notes: notes || 'Shift Closed & Reconciled',
        status: 'closed',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift, server_expected_cash: serverExpectedCash });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
