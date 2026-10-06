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

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Expense amount must be a positive number' }, { status: 400 });
    }

    // Task 12.10 — FINDING-E2E-012 FIX: Server-side upper-bound guard.
    // A single petty expense cannot exceed Rs. 50,000 to prevent accidental large entries.
    // Larger disbursements must go through the main voucher/payment system.
    const PETTY_EXPENSE_MAX = 50_000;
    if (parsedAmount > PETTY_EXPENSE_MAX) {
      return NextResponse.json(
        {
          success: false,
          error: `Petty expense amount (Rs. ${parsedAmount.toLocaleString()}) exceeds the single-entry limit of Rs. ${PETTY_EXPENSE_MAX.toLocaleString()}. Use the voucher system for larger disbursements.`,
        },
        { status: 400 }
      );
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
        amount: parsedAmount,
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
