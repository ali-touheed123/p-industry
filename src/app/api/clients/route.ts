import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch clients for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, clients: clients || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add new customer / client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      name,
      phone,
      city,
      area,
      address,
      credit_limit = 50000,
      current_balance = 0,
    } = body;

    if (!tenant_id || !name) {
      return NextResponse.json({ success: false, error: 'Tenant ID and Name are required' }, { status: 400 });
    }

    const code = `CL-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .insert({
        tenant_id,
        code,
        name,
        phone: phone || null,
        city: city || null,
        area: area || null,
        address: address || null,
        credit_limit: Number(credit_limit) || 50000,
        current_balance: Number(current_balance) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
