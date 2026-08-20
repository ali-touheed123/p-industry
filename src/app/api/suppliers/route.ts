import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch suppliers for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: suppliers, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, suppliers: suppliers || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add new supplier / vendor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      name,
      phone,
      city,
      address,
      current_balance = 0,
    } = body;

    if (!tenant_id || !name) {
      return NextResponse.json({ success: false, error: 'Tenant ID and Name are required' }, { status: 400 });
    }

    const code = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .insert({
        tenant_id,
        code,
        name,
        phone: phone || null,
        city: city || null,
        address: address || null,
        current_balance: Number(current_balance) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
