import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
          return NextResponse.json({
            success: true,
            previousSameDayShift: prevShifts && prevShifts.length > 0 ? prevShifts[0] : null,
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

    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .update({
        closed_by: closed_by || null,
        end_time: new Date().toISOString(),
        expected_cash: Number(expected_cash),
        actual_cash: Number(actual_cash),
        difference: Number(difference),
        notes: notes || 'Shift Closed & Reconciled',
        status: 'closed',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
