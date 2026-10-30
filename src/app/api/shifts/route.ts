import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { computeShiftCash } from '@/utils/cashLedger';

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
      previous_closing_cash = null,
      handover_variance = null,
      handover_notes,
      notes,
      // Phase 7: Offline shift fields
      is_offline = false,
      device_id = null,
      local_shift_id = null,
      opened_at_local = null,
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
        previous_closing_cash: previous_closing_cash !== null && previous_closing_cash !== undefined ? Number(previous_closing_cash) : null,
        handover_variance: handover_variance !== null && handover_variance !== undefined ? Number(handover_variance) : null,
        handover_notes: handover_notes || null,
        start_time: new Date().toISOString(),
        status: 'open',
        notes: notes || 'Counter Shift Opened',
        // Phase 7: Offline shift reconciliation fields (M07)
        is_offline: Boolean(is_offline),
        device_id: device_id || null,
        local_shift_id: local_shift_id || null,
        synced_at: is_offline ? new Date().toISOString() : null,
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

    // FIX B1/B2/B3: Recompute expected_cash server-side using shared computeShiftCash.
    // The client-supplied expected_cash cannot be trusted.
    // Uses the same formula as ShiftDrawer and DayCloseView — single source of truth.
    let serverExpectedCash = Number(expected_cash); // fallback before DB fetch
    let cashBreakdownJson: any = null;
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
        const endBound = new Date().toISOString();

        // Invoices — shift-scoped, exclude cancelled AND void
        const { data: shiftInvoices } = await supabaseAdmin
          .from('invoices')
          .select('net_total, paid_amount, cash_paid, payment_type, invoice_type, status, is_late_sync')
          .eq('shift_id', id)
          .eq('tenant_id', tenantId)
          .not('status', 'in', '(cancelled,void,CANCELLED,VOID)');

        // Purchases — shift-scoped with time-window fallback for legacy NULL shift_id
        const { data: shiftPurchases, error: purchErr } = await supabaseAdmin
          .from('purchases')
          .select('net_total, paid_amount, payment_type, purchase_type, shift_id, created_at')
          .eq('tenant_id', tenantId)
          .or(`shift_id.eq.${id},and(shift_id.is.null,created_at.gte.${startTime},created_at.lte.${endBound})`);

        if (purchErr) {
          console.error('Error fetching shift purchases during shift close:', purchErr);
        }

        // Vouchers — shift-scoped only (vouchers without shift_id excluded per spec)
        const { data: shiftVouchers } = await supabaseAdmin
          .from('vouchers')
          .select('voucher_type, payment_mode, amount, shift_id')
          .eq('tenant_id', tenantId)
          .eq('shift_id', id);

        // Petty expenses
        const { data: shiftExpenses } = await supabaseAdmin
          .from('petty_expenses')
          .select('amount')
          .eq('shift_id', id)
          .eq('tenant_id', tenantId);

        // Token redemptions — exclude reversed
        const { data: shiftTokens } = await supabaseAdmin
          .from('token_transactions')
          .select('type, usage_status, total_amount')
          .eq('shift_id', id)
          .eq('tenant_id', tenantId)
          .eq('type', 'redeemed')
          .neq('usage_status', 'reversed');

        // Use shared pure function — NO Math.max clamp
        const breakdown = computeShiftCash({
          openingCash: openingAmt,
          invoices: shiftInvoices || [],
          purchases: shiftPurchases || [],
          vouchers: shiftVouchers || [],
          expenses: shiftExpenses || [],
          tokens: shiftTokens || [],
          shiftId: id,
        });

        serverExpectedCash = breakdown.expectedCash;
        cashBreakdownJson = {
          openingCash: breakdown.openingCash,
          cashSales: breakdown.cashSales,
          cashRefundsOnSalesReturns: breakdown.cashRefundsOnSalesReturns,
          supplierCashPaid: breakdown.supplierCashPaid,
          supplierReturnCashReceived: breakdown.supplierReturnCashReceived,
          voucherCashReceipts: breakdown.voucherCashReceipts,
          voucherCashPayments: breakdown.voucherCashPayments,
          pettyExpenses: breakdown.pettyExpenses,
          tokenCashPayouts: breakdown.tokenCashPayouts,
          expectedCash: breakdown.expectedCash,
          offlineLateSalesCash: breakdown.offlineLateSalesCash,
          offlineLateReturnsCash: breakdown.offlineLateReturnsCash,
          offlineLateNetCash: breakdown.offlineLateNetCash,
          offlineLateSalesCount: breakdown.offlineLateSalesCount,
          offlineLateReturnsCount: breakdown.offlineLateReturnsCount,
          computedAt: new Date().toISOString(),
        };
      }
    } catch (calcErr) {
      // Hard-fail: do not fall back to client-supplied expected_cash (FINDING-API-014)
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
        cash_breakdown: cashBreakdownJson,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift, server_expected_cash: serverExpectedCash, cash_breakdown: cashBreakdownJson });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
