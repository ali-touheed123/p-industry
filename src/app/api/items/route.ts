import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch items for a tenant / branch
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
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

// POST: Add a new item / paint product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      code,
      name,
      category,
      unit = 'Can',
      cost_price = 0,
      retail_price = 0,
      stock_qty = 0,
      min_stock_alert = 5,
      shade_code,
      pack_size,
    } = body;

    if (!tenant_id || !name || !code) {
      return NextResponse.json({ success: false, error: 'Tenant ID, Name and Item Code are required' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 0. Uniqueness check for product code within this tenant
    const { data: existingItem } = await supabaseAdmin
      .from('items')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('code', normalizedCode)
      .maybeSingle();

    if (existingItem) {
      return NextResponse.json(
        { success: false, error: 'A product with this code already exists.' },
        { status: 400 }
      );
    }

    // 1. Insert item for the active branch
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .insert({
        tenant_id,
        code: normalizedCode,
        name: name.trim(),
        category: category || 'General',
        unit,
        pack_size: pack_size || unit,
        shade_code: shade_code || null,
        cost_price: Number(cost_price) || 0,
        retail_price: Number(retail_price) || 0,
        stock_qty: Number(stock_qty) || 0,
        min_stock_alert: Number(min_stock_alert) || 5,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Sync new product catalog (with stock_qty=0) to ALL sister branches under same owner
    // Sister branches = other tenants with the same owner email
    try {
      const { data: currentTenant } = await supabaseAdmin
        .from('tenants')
        .select('id, owner_name, email')
        .eq('id', tenant_id)
        .single();

      // Build sister-branch query — group by email (most reliable), fallback to owner_name
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
        // No reliable grouping key — skip cross-branch sync
        console.warn('[items/POST] No email or owner_name on tenant, skipping sister sync');
      }

      const { data: sisterTenants } = await sisterQuery;

      if (sisterTenants && sisterTenants.length > 0) {
        for (const sister of sisterTenants) {
          // Skip if product already exists on that branch
          const { data: existing } = await supabaseAdmin
            .from('items')
            .select('id')
            .eq('tenant_id', sister.id)
            .eq('code', normalizedCode)
            .maybeSingle();

          if (!existing) {
            await supabaseAdmin.from('items').insert({
              tenant_id: sister.id,
              code: normalizedCode,
              name: name.trim(),
              category: category || 'General',
              unit,
              pack_size: pack_size || unit,
              shade_code: shade_code || null,
              cost_price: Number(cost_price) || 0,
              retail_price: Number(retail_price) || 0,
              stock_qty: 0,           // ← ALWAYS 0 — sister branches must use Branch Orders to get stock
              min_stock_alert: Number(min_stock_alert) || 5,
            });
            console.log(`[items/POST] Synced product ${normalizedCode} to sister branch "${sister.name}" with stock_qty=0`);
          }
        }
      }
    } catch (syncErr) {
      console.error('[items/POST] Error syncing product to sister branches:', syncErr);
    }

    return NextResponse.json({ success: true, item });
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

    const { error } = await supabaseAdmin.from('items').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
