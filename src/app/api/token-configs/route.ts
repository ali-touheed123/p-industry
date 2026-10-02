import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET /api/token-configs?tenant_id=...&series_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const seriesId = searchParams.get('series_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('series_token_configs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (seriesId) {
      query = query.eq('series_id', seriesId);
    }

    const { data: configs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, configs: configs || [] });
  } catch (error: any) {
    console.error('Error in GET /api/token-configs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/token-configs
// Body: { tenant_id, series_id, configs: [ { unit_name, is_enabled, token_value, is_drum_auto } ] }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, series_id, configs } = body;

    if (!tenant_id || !series_id || !Array.isArray(configs)) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Series ID, and configs array are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // ── Business Logic Rules (Section 8) ──────────────────────────────────────
    // 1. Resolve Gallon value first to compute Drum if auto-sync is on
    const gallonConfig = configs.find(c => c.unit_name?.trim().toLowerCase() === 'gallon');
    const gallonEnabled = Boolean(gallonConfig?.is_enabled);
    const gallonValue = Math.max(0, Number(gallonConfig?.token_value || 0));

    // Validate and process each config
    const processedConfigs = configs.map(c => {
      const unitName = c.unit_name.trim();
      const isDrum = unitName.toLowerCase() === 'drum';
      let isEnabled = Boolean(c.is_enabled);
      let isDrumAuto = isDrum ? Boolean(c.is_drum_auto) : false;
      let tokenValue = Math.max(0, Number(c.token_value || 0));

      if (isDrum) {
        // If Gallon is OFF and Drum is ON, drum cannot auto-sync to gallon (requires manual value)
        if (!gallonEnabled && isEnabled) {
          isDrumAuto = false;
        }

        // If Drum is auto-synced and Gallon is enabled, Drum = Gallon * 4
        if (isDrumAuto && gallonEnabled) {
          tokenValue = gallonValue * 4;
        }
      }

      // If unit is disabled, token value defaults to 0
      if (!isEnabled) {
        tokenValue = 0;
      }

      return {
        tenant_id,
        series_id,
        unit_name: unitName,
        is_enabled: isEnabled,
        token_value: tokenValue,
        is_drum_auto: isDrumAuto,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert configs into database
    for (const item of processedConfigs) {
      const { data: existing } = await supabaseAdmin
        .from('series_token_configs')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('series_id', series_id)
        .ilike('unit_name', item.unit_name)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabaseAdmin
          .from('series_token_configs')
          .update(item)
          .eq('id', existing.id);
        if (updErr) {
          console.error('Error updating series_token_config:', updErr);
          throw updErr;
        }
      } else {
        const { error: insErr } = await supabaseAdmin
          .from('series_token_configs')
          .insert(item);
        if (insErr) {
          console.error('Error inserting series_token_config:', insErr);
          throw insErr;
        }
      }
    }

    // Return full updated configs for the series
    const { data: updated, error: fetchErr } = await supabaseAdmin
      .from('series_token_configs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('series_id', series_id);

    if (fetchErr) throw fetchErr;

    return NextResponse.json({ success: true, configs: updated || [] });
  } catch (error: any) {
    console.error('Error in PUT /api/token-configs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
