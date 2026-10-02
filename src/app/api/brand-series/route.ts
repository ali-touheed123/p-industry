import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET /api/brand-series?tenant_id=...&brand_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const brandId = searchParams.get('brand_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('brand_series')
      .select('*, brands(id, name, status), series_token_configs(*)')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data: series, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, series: series || [] });
  } catch (error: any) {
    console.error('Error in GET /api/brand-series:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/brand-series
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, brand_id, name, status = 'active' } = body;

    if (!tenant_id || !brand_id || !name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Brand ID, and Series Name are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const trimmedName = name.trim();

    // Check case-insensitive uniqueness under the same brand
    const { data: existing } = await supabaseAdmin
      .from('brand_series')
      .select('id, name')
      .eq('tenant_id', tenant_id)
      .eq('brand_id', brand_id)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Series "${trimmedName}" already exists for this brand` },
        { status: 400 }
      );
    }

    // Insert new series
    const { data: newSeries, error: insertErr } = await supabaseAdmin
      .from('brand_series')
      .insert({
        tenant_id,
        brand_id,
        name: trimmedName,
        status: status === 'inactive' ? 'inactive' : 'active',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Seed default standard unit configurations (Gallon, Drum, Quarter)
    const { data: configs } = await supabaseAdmin
      .from('series_token_configs')
      .insert([
        { tenant_id, series_id: newSeries.id, unit_name: 'Gallon', is_enabled: false, token_value: 0, is_drum_auto: false },
        { tenant_id, series_id: newSeries.id, unit_name: 'Drum', is_enabled: false, token_value: 0, is_drum_auto: true },
        { tenant_id, series_id: newSeries.id, unit_name: 'Quarter', is_enabled: false, token_value: 0, is_drum_auto: false },
      ])
      .select();

    return NextResponse.json({ success: true, series: { ...newSeries, series_token_configs: configs || [] } });
  } catch (error: any) {
    console.error('Error in POST /api/brand-series:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/brand-series
// Supports status toggle OR Series Renaming (Rule A7: deactivates old series, creates new active series)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tenant_id, name, status } = body;

    if (!id || !tenant_id) {
      return NextResponse.json({ success: false, error: 'Series ID and Tenant ID are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Fetch current series
    const { data: currentSeries, error: fetchErr } = await supabaseAdmin
      .from('brand_series')
      .select('*, series_token_configs(*)')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchErr || !currentSeries) {
      return NextResponse.json({ success: false, error: 'Series not found' }, { status: 404 });
    }

    const isRenaming = name !== undefined && name.trim().toLowerCase() !== currentSeries.name.toLowerCase();

    if (isRenaming) {
      const newTrimmedName = name.trim();
      if (!newTrimmedName) {
        return NextResponse.json({ success: false, error: 'Series name cannot be empty' }, { status: 400 });
      }

      // Check unique constraint for new name under same brand
      const { data: existing } = await supabaseAdmin
        .from('brand_series')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('brand_id', currentSeries.brand_id)
        .ilike('name', newTrimmedName)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Series "${newTrimmedName}" already exists for this brand` },
          { status: 400 }
        );
      }

      // ── Core Invariant A7: Deactivate old Series, Create new Series ──────────
      // 1. Deactivate old series so existing products/history remain safely linked
      await supabaseAdmin
        .from('brand_series')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', id);

      // 2. Insert new active series with the new name
      const { data: createdSeries, error: createErr } = await supabaseAdmin
        .from('brand_series')
        .insert({
          tenant_id,
          brand_id: currentSeries.brand_id,
          name: newTrimmedName,
          status: 'active',
        })
        .select()
        .single();

      if (createErr) throw createErr;

      // 3. Rule A7: New Series starts with fresh/default token configuration (NOT copied values).
      // Old Series token configuration remains intact and attached to the old inactive Series.
      await supabaseAdmin.from('series_token_configs').insert([
        { tenant_id, series_id: createdSeries.id, unit_name: 'Gallon', is_enabled: false, token_value: 0, is_drum_auto: false },
        { tenant_id, series_id: createdSeries.id, unit_name: 'Drum', is_enabled: false, token_value: 0, is_drum_auto: true },
        { tenant_id, series_id: createdSeries.id, unit_name: 'Quarter', is_enabled: false, token_value: 0, is_drum_auto: false },
      ]);

      return NextResponse.json({
        success: true,
        renamed: true,
        old_series_id: id,
        series: createdSeries,
        message: `Old series "${currentSeries.name}" deactivated for historical safety. New series "${newTrimmedName}" created.`,
      });
    }

    // Normal update (e.g. status toggle active <-> inactive)
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (status !== undefined) {
      updatePayload.status = status === 'inactive' ? 'inactive' : 'active';
    }

    const { data: updatedSeries, error: updateErr } = await supabaseAdmin
      .from('brand_series')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select('*, series_token_configs(*)')
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, series: updatedSeries });
  } catch (error: any) {
    console.error('Error in PATCH /api/brand-series:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
