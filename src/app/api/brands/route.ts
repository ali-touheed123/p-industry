import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET /api/brands?tenant_id=...
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

    // Fetch brands with series count
    const { data: brands, error } = await supabaseAdmin
      .from('brands')
      .select('*, brand_series(id, name, status)')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, brands: brands || [] });
  } catch (error: any) {
    console.error('Error in GET /api/brands:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/brands
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, name, status = 'active' } = body;

    if (!tenant_id || !name?.trim()) {
      return NextResponse.json({ success: false, error: 'Tenant ID and Brand Name are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const trimmedName = name.trim();

    // Check case-insensitive uniqueness
    const { data: existing } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('tenant_id', tenant_id)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: `Brand "${trimmedName}" already exists` }, { status: 400 });
    }

    // Insert brand
    const { data: brand, error: insertErr } = await supabaseAdmin
      .from('brands')
      .insert({
        tenant_id,
        name: trimmedName,
        status: status === 'inactive' ? 'inactive' : 'active',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Automatically create a default "General Series" for the new brand
    const { data: series } = await supabaseAdmin
      .from('brand_series')
      .insert({
        tenant_id,
        brand_id: brand.id,
        name: 'General Series',
        status: 'active',
      })
      .select()
      .single();

    if (series) {
      // Seed default unit configs (Gallon, Drum, Quarter)
      await supabaseAdmin.from('series_token_configs').insert([
        { tenant_id, series_id: series.id, unit_name: 'Gallon', is_enabled: false, token_value: 0, is_drum_auto: false },
        { tenant_id, series_id: series.id, unit_name: 'Drum', is_enabled: false, token_value: 0, is_drum_auto: true },
        { tenant_id, series_id: series.id, unit_name: 'Quarter', is_enabled: false, token_value: 0, is_drum_auto: false },
      ]);
    }

    return NextResponse.json({ success: true, brand });
  } catch (error: any) {
    console.error('Error in POST /api/brands:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/brands
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tenant_id, name, status } = body;

    if (!id || !tenant_id) {
      return NextResponse.json({ success: false, error: 'ID and Tenant ID are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const updatePayload: any = { updated_at: new Date().toISOString() };

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json({ success: false, error: 'Brand name cannot be empty' }, { status: 400 });
      }

      // Check unique constraint if name is changing
      const { data: existing } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('tenant_id', tenant_id)
        .ilike('name', trimmedName)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: false, error: `Brand "${trimmedName}" already exists` }, { status: 400 });
      }

      updatePayload.name = trimmedName;
    }

    if (status !== undefined) {
      updatePayload.status = status === 'inactive' ? 'inactive' : 'active';
    }

    const { data: brand, error: updateErr } = await supabaseAdmin
      .from('brands')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, brand });
  } catch (error: any) {
    console.error('Error in PATCH /api/brands:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
