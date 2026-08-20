import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET all tenants or single tenant by slug
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (slug) {
      const { data: tenant, error: singleErr } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('slug', slug.trim().toLowerCase())
        .single();

      if (singleErr || !tenant) {
        return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, tenant });
    }

    const { data: tenants, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantErr) throw tenantErr;

    // Fetch user counts for each tenant
    const { data: users, error: userErr } = await supabaseAdmin
      .from('app_users')
      .select('id, username, full_name, role, tenant_id');

    if (userErr) throw userErr;

    const tenantsWithDetails = (tenants || []).map(t => {
      const tenantUsers = (users || []).filter(u => u.tenant_id === t.id);
      const ceoUser = tenantUsers.find(u => u.role === 'ceo');
      const staffUsers = tenantUsers.filter(u => u.role === 'staff' || u.role === 'godown_staff');
      return {
        ...t,
        usersCount: tenantUsers.length,
        ceo: ceoUser ? { username: ceoUser.username, name: ceoUser.full_name } : null,
        staffCount: staffUsers.length,
      };
    });

    return NextResponse.json({ success: true, tenants: tenantsWithDetails });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create a new Shop / Godown / Factory with default CEO & Staff accounts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      slug,
      type = 'shop',
      owner_name,
      phone,
      city,
      address,
      ceo_username,
      ceo_password,
      staff_username,
      staff_password,
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: 'Name and URL slug are required' }, { status: 400 });
    }

    // Clean slug
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    // 1. Insert Tenant
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        name,
        slug: cleanSlug,
        type,
        owner_name,
        phone,
        city,
        address,
      })
      .select()
      .single();

    if (tenantErr) {
      if (tenantErr.code === '23505') {
        return NextResponse.json({ success: false, error: 'A shop or godown with this URL slug already exists!' }, { status: 400 });
      }
      throw tenantErr;
    }

    // 2. Create CEO user if credentials provided
    if (ceo_username && ceo_password) {
      const { data: ceoUser, error: ceoErr } = await supabaseAdmin
        .from('app_users')
        .insert({
          username: ceo_username.trim().toLowerCase(),
          password_hash: ceo_password,
          full_name: owner_name || `${name} Owner`,
          role: 'ceo',
          tenant_id: tenant.id,
        })
        .select()
        .single();

      if (!ceoErr && ceoUser) {
        // Link to ceo_tenants mapping table
        await supabaseAdmin
          .from('ceo_tenants')
          .insert({
            user_id: ceoUser.id,
            tenant_id: tenant.id,
          });
      }
    }

    // 3. Create Staff user if credentials provided
    if (staff_username && staff_password) {
      await supabaseAdmin
        .from('app_users')
        .insert({
          username: staff_username.trim().toLowerCase(),
          password_hash: staff_password,
          full_name: `${name} Counter Staff`,
          role: type === 'godown' ? 'godown_staff' : 'staff',
          tenant_id: tenant.id,
        });
    }

    return NextResponse.json({ success: true, tenant });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove tenant
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
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    // Clean up dependent child records
    await supabaseAdmin.from('ceo_tenants').delete().eq('tenant_id', id);
    await supabaseAdmin.from('app_users').delete().eq('tenant_id', id);
    await supabaseAdmin.from('items').delete().eq('tenant_id', id);
    await supabaseAdmin.from('shifts').delete().eq('tenant_id', id);
    await supabaseAdmin.from('petty_expenses').delete().eq('tenant_id', id);
    await supabaseAdmin.from('clients').delete().eq('tenant_id', id);
    await supabaseAdmin.from('suppliers').delete().eq('tenant_id', id);
    await supabaseAdmin.from('audit_logs').delete().eq('tenant_id', id);
    await supabaseAdmin.from('vouchers').delete().eq('tenant_id', id);
    await supabaseAdmin.from('stock_transfers').delete().or(`from_tenant_id.eq.${id},to_tenant_id.eq.${id}`);

    const { error } = await supabaseAdmin.from('tenants').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Toggle status or update info
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_active, name, phone, city, address, type } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (is_active !== undefined) updateData.is_active = is_active;
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (type) updateData.type = type;

    const { error } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
