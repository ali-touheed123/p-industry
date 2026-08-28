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

    // 2. Automatically sync this new product to all other branches/godowns
    try {
      // Find current tenant's owner or all other tenants
      const { data: currentTenant } = await supabaseAdmin
        .from('tenants')
        .select('id, owner_name, email')
        .eq('id', tenant_id)
        .single();

      let sisterTenantsQuery = supabaseAdmin
        .from('tenants')
        .select('id')
        .neq('id', tenant_id)
        .eq('is_active', true);

      if (currentTenant?.owner_name) {
        sisterTenantsQuery = sisterTenantsQuery.eq('owner_name', currentTenant.owner_name);
      }

      const { data: sisterTenants } = await sisterTenantsQuery;

      if (sisterTenants && sisterTenants.length > 0) {
        for (const sister of sisterTenants) {
          // Check if item code already exists in sister branch
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
              stock_qty: 0, // Other branches start with 0 stock
              min_stock_alert: Number(min_stock_alert) || 5,
            });
          }
        }
      }
    } catch (syncErr) {
      console.error('Error syncing new product across sister branches:', syncErr);
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
