import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch petty expenses for a tenant or shift
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('petty_expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (shiftId) {
      query = query.eq('shift_id', shiftId);
    }

    const { data: expenses, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, expenses: expenses || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Record a new petty expense
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      shift_id,
      category = 'General',
      title,
      amount,
      paid_by,
      notes,
    } = body;

    if (!tenant_id || !title || !amount) {
      return NextResponse.json({ success: false, error: 'Tenant ID, Title and Amount are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data: expense, error } = await supabaseAdmin
      .from('petty_expenses')
      .insert({
        tenant_id,
        shift_id: shift_id || null,
        category,
        title,
        amount: Number(amount),
        paid_by: paid_by || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, expense });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
