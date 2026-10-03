import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { generateUniqueCode } from '@/lib/utils';

// GET: Fetch suppliers for a tenant
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

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // FIX FINDING-API-013: Use collision-safe unique code generator
    const code = await generateUniqueCode('SUP', 'suppliers', 'code', tenant_id);

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

// PATCH: Update supplier details
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, phone, city, address, current_balance } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });
    }

    // Fetch record first — prevents null-scope auth bypass when supplier not found
    const { data: existingSupplier } = await supabaseAdmin
      .from('suppliers')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingSupplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingSupplier.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name?.trim() || null;
    if (phone !== undefined) updates.phone = phone || null;
    if (city !== undefined) updates.city = city || null;
    if (address !== undefined) updates.address = address || null;
    if (current_balance !== undefined) updates.current_balance = Number(current_balance) || 0;

    // Scope update to tenant as defence-in-depth
    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', existingSupplier.tenant_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Soft-delete a supplier (preserves ledger / purchase history)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });
    }

    // Fetch record first — prevents null-scope auth bypass when supplier not found
    const { data: existingSupplier } = await supabaseAdmin
      .from('suppliers')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingSupplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingSupplier.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Soft-delete: preserve financial history, do not hard-delete
    const { error } = await supabaseAdmin
      .from('suppliers')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('tenant_id', existingSupplier.tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
