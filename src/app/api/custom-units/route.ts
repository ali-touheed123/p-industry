import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET /api/custom-units?tenant_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data: units, error } = await supabaseAdmin
      .from('custom_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, units: units || [] });
  } catch (error: any) {
    console.error('Error in GET /api/custom-units:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/custom-units
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, name } = body;

    if (!tenant_id || !name?.trim()) {
      return NextResponse.json({ success: false, error: 'Tenant ID and Unit Name are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const trimmedName = name.trim();

    // Check case-insensitive uniqueness
    const { data: existing } = await supabaseAdmin
      .from('custom_units')
      .select('id, name')
      .eq('tenant_id', tenant_id)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: `Unit "${trimmedName}" already exists` }, { status: 400 });
    }

    const { data: unit, error: insertErr } = await supabaseAdmin
      .from('custom_units')
      .insert({ tenant_id, name: trimmedName })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, unit });
  } catch (error: any) {
    console.error('Error in POST /api/custom-units:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/custom-units
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tenant_id, name } = body;

    if (!id || !tenant_id || !name?.trim()) {
      return NextResponse.json({ success: false, error: 'ID, Tenant ID, and new Unit Name are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const trimmedName = name.trim();

    // Check unique constraint
    const { data: existing } = await supabaseAdmin
      .from('custom_units')
      .select('id')
      .eq('tenant_id', tenant_id)
      .ilike('name', trimmedName)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: `Unit "${trimmedName}" already exists` }, { status: 400 });
    }

    // Fetch previous name to update series_token_configs referencing it
    const { data: oldUnit } = await supabaseAdmin
      .from('custom_units')
      .select('name')
      .eq('id', id)
      .single();

    const { data: unit, error: updateErr } = await supabaseAdmin
      .from('custom_units')
      .update({ name: trimmedName })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Sync unit name in series_token_configs if renamed
    if (oldUnit && oldUnit.name !== trimmedName) {
      await supabaseAdmin
        .from('series_token_configs')
        .update({ unit_name: trimmedName, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenant_id)
        .ilike('unit_name', oldUnit.name);
    }

    return NextResponse.json({ success: true, unit });
  } catch (error: any) {
    console.error('Error in PATCH /api/custom-units:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
