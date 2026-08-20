import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch current active shift or shift history for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
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

// POST: Open a new shift
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, opened_by, opening_cash = 0, notes } = body;

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .insert({
        tenant_id,
        opened_by: opened_by || null,
        opening_cash: Number(opening_cash) || 0,
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
