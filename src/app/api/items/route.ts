import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch items for a tenant / branch
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

    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, items: items || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add a single item OR bulk batch of items
// Single: { tenant_id, code, name, brand, ... }
// Bulk:   { tenant_id, brand, category, unit, ... , items: [{ name, code, shade_code, retail_price, cost_price, stock_qty }] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // ── Helper: resolve sister branches for cross-branch catalog sync ──────────
    const getSisterTenants = async () => {
      const { data: currentTenant } = await supabaseAdmin
        .from('tenants')
        .select('id, owner_name, email')
        .eq('id', tenant_id)
        .single();

      let sisterQuery = supabaseAdmin
        .from('tenants')
        .select('id, name')
        .neq('id', tenant_id)
        .eq('is_active', true);

      if (currentTenant?.email) {
        sisterQuery = sisterQuery.eq('email', currentTenant.email);
      } else if (currentTenant?.owner_name) {
        sisterQuery = sisterQuery.eq('owner_name', currentTenant.owner_name);
      } else {
        return [];
      }
      const { data } = await sisterQuery;
      return data || [];
    };

    // ── Helper: insert one item + sync to sisters ──────────────────────────────
    const insertOneItem = async (payload: {
      code: string; name: string; category: string; brand: string;
      unit: string; pack_size: string; shade_code: string | null;
      cost_price: number; retail_price: number; stock_qty: number;
      min_stock_alert: number; has_token: boolean; token_value: number;
    }, sisterTenants: { id: string; name: string }[]) => {
      const normalizedCode = payload.code.trim().toUpperCase();

      // Uniqueness check
      const { data: existing } = await supabaseAdmin
        .from('items').select('id')
        .eq('tenant_id', tenant_id).eq('code', normalizedCode).maybeSingle();
      if (existing) {
        return { ok: false, code: normalizedCode, error: `Code "${normalizedCode}" already exists` };
      }

      const { data: item, error } = await supabaseAdmin
        .from('items')
        .insert({ tenant_id, ...payload, code: normalizedCode })
        .select().single();
      if (error) return { ok: false, code: normalizedCode, error: error.message };

      // Sister branch sync (stock_qty always 0 on sisters)
      for (const sister of sisterTenants) {
        const { data: sisterExisting } = await supabaseAdmin
          .from('items').select('id')
          .eq('tenant_id', sister.id).eq('code', normalizedCode).maybeSingle();
        if (!sisterExisting) {
          await supabaseAdmin.from('items').insert({
            tenant_id: sister.id, ...payload, code: normalizedCode, stock_qty: 0,
          });
        }
      }
      return { ok: true, code: normalizedCode, item };
    };

    // ── BULK MODE: body.items is an array ──────────────────────────────────────
    if (Array.isArray(body.items) && body.items.length > 0) {
      const {
        brand = '', category = 'General', unit = 'Can',
        has_token = false, token_value = 0, min_stock_alert = 5,
      } = body;

      if (!brand.trim()) {
        return NextResponse.json({ success: false, error: 'Brand is required for bulk entry' }, { status: 400 });
      }

      const sisterTenants = await getSisterTenants();
      const saved: any[] = [];
      const errors: { row: number; code: string; error: string }[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const row = body.items[i];
        if (!row.name?.trim() || !row.code?.trim()) continue; // skip empty rows silently

        const retail = Number(row.retail_price) || 0;
        const cost = Number(row.cost_price) || Math.round(retail * 0.75);

        const result = await insertOneItem({
          code: row.code.trim(),
          name: row.name.trim(),
          category,
          brand: brand.trim(),
          unit,
          pack_size: unit,
          shade_code: row.shade_code?.trim() || null,
          cost_price: cost,
          retail_price: retail,
          stock_qty: Number(row.stock_qty) || 0,
          min_stock_alert: Number(min_stock_alert) || 5,
          has_token: Boolean(has_token),
          token_value: Number(token_value) || 0,
        }, sisterTenants);

        if (result.ok) {
          saved.push(result.item);
        } else {
          errors.push({ row: i + 1, code: result.code ?? '', error: result.error ?? 'Unknown error' });
        }
      }

      return NextResponse.json({ success: true, saved, errors, count: saved.length });
    }

    // ── SINGLE MODE (existing behavior — unchanged) ────────────────────────────
    const {
      code, name, category, brand, unit = 'Can',
      cost_price = 0, retail_price = 0, stock_qty = 0,
      min_stock_alert = 5, shade_code, pack_size,
      has_token = false, token_value = 0,
    } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'Name and Item Code are required' }, { status: 400 });
    }
    if (!brand?.trim()) {
      return NextResponse.json({ success: false, error: 'Brand / Manufacturer is required' }, { status: 400 });
    }

    const retail = Number(retail_price) || 0;
    const cost = Number(cost_price) || 0;

    const sisterTenants = await getSisterTenants();
    const result = await insertOneItem({
      code, name, category: category || 'General', brand: brand.trim(),
      unit, pack_size: pack_size || unit,
      shade_code: shade_code || null,
      cost_price: cost, retail_price: retail,
      stock_qty: Number(stock_qty) || 0,
      min_stock_alert: Number(min_stock_alert) || 5,
      has_token: Boolean(has_token),
      token_value: Number(token_value) || 0,
    }, sisterTenants);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, item: result.item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update item
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    let targetTenantId = updateFields.tenant_id;
    if (!targetTenantId) {
      const { data: existing } = await supabaseAdmin.from('items').select('tenant_id').eq('id', id).maybeSingle();
      targetTenantId = existing?.tenant_id;
    }

    const auth = await requireTenantAuth(req, targetTenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    if (updateFields.code && updateFields.tenant_id) {
      const normalizedCode = updateFields.code.trim().toUpperCase();
      const { data: existingItem } = await supabaseAdmin
        .from('items')
        .select('id')
        .eq('tenant_id', updateFields.tenant_id)
        .eq('code', normalizedCode)
        .neq('id', id)
        .maybeSingle();

      if (existingItem) {
        return NextResponse.json(
          { success: false, error: 'A product with this code already exists.' },
          { status: 400 }
        );
      }
      updateFields.code = normalizedCode;
    }

    const { data: item, error } = await supabaseAdmin
      .from('items')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove item
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    const { data: existingItem } = await supabaseAdmin.from('items').select('tenant_id').eq('id', id).maybeSingle();
    const auth = await requireTenantAuth(req, existingItem?.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabaseAdmin.from('items').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
