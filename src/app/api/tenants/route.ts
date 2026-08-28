import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth-passwords';

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

      // Fetch counters/users belonging to this shop
      const { data: tenantUsers } = await supabaseAdmin
        .from('app_users')
        .select('id, username, full_name, role')
        .eq('tenant_id', tenant.id);

      const staffCounters = (tenantUsers || []).filter(u => u.role === 'staff' || u.role === 'godown_staff');

      return NextResponse.json({ 
        success: true, 
        tenant: {
          ...tenant,
          users: tenantUsers || [],
          counters: staffCounters,
        }
      });
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
      email,
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
        email: email || null,
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
      const secureCeoHash = await hashPassword(ceo_password);
      const { data: ceoUser, error: ceoErr } = await supabaseAdmin
        .from('app_users')
        .insert({
          username: ceo_username.trim().toLowerCase(),
          password_hash: secureCeoHash,
          full_name: owner_name || `${name} Owner`,
          email: email || `${ceo_username.trim().toLowerCase()}@pyntflow.com`,
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

    // 3. Create Staff / Counter users if credentials provided
    if (staff_username && staff_password) {
      const secureStaffHash = await hashPassword(staff_password);
      await supabaseAdmin
        .from('app_users')
        .insert({
          username: staff_username.trim().toLowerCase(),
          password_hash: secureStaffHash,
          full_name: `${name} Counter 01`,
          role: type === 'godown' ? 'godown_staff' : 'staff',
          tenant_id: tenant.id,
        });
    }

    // 4. Create multiple custom counters if provided
    if (Array.isArray(body.counters) && body.counters.length > 0) {
      for (const c of body.counters) {
        if (c.username && c.password && c.username.trim().toLowerCase() !== staff_username?.trim().toLowerCase()) {
          const secureCounterHash = await hashPassword(c.password);
          await supabaseAdmin
            .from('app_users')
            .insert({
              username: c.username.trim().toLowerCase(),
              password_hash: secureCounterHash,
              full_name: c.name || `${name} ${c.username.toUpperCase()}`,
              role: type === 'godown' ? 'godown_staff' : 'staff',
              tenant_id: tenant.id,
            });
        }
      }
    }

    // 5. Automatically seed existing catalog products into this new branch with stock_qty = 0
    try {
      // Find other branches from same owner or any other active branch
      let query = supabaseAdmin
        .from('tenants')
        .select('id')
        .neq('id', tenant.id)
        .eq('is_active', true);

      if (owner_name) {
        query = query.eq('owner_name', owner_name);
      }

      const { data: sisterTenants } = await query;

      if (sisterTenants && sisterTenants.length > 0) {
        // Fetch existing items from sister branch
        const sisterId = sisterTenants[0].id;
        const { data: existingItems } = await supabaseAdmin
          .from('items')
          .select('*')
          .eq('tenant_id', sisterId);

        if (existingItems && existingItems.length > 0) {
          const newBranchItems = existingItems.map((it: any) => ({
            tenant_id: tenant.id,
            code: it.code,
            name: it.name,
            category: it.category || 'General',
            item_type: it.item_type || 'finish_goods',
            unit: it.unit || 'Can',
            pack_size: it.pack_size || it.unit || 'Can',
            shade_code: it.shade_code || null,
            shade_hex: it.shade_hex || null,
            cost_price: it.cost_price || 0,
            retail_price: it.retail_price || 0,
            wholesale_price: it.wholesale_price || 0,
            trade_price: it.trade_price || 0,
            stock_qty: 0, // Fresh branch starts with 0 stock
            min_stock_alert: it.min_stock_alert || 5,
          }));

          await supabaseAdmin.from('items').insert(newBranchItems);
        }
      }
    } catch (seedErr) {
      console.error('Failed to seed catalog items to new branch:', seedErr);
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

    // 1. Clean up branch orders & branch order items (as sender or receiver)
    try {
      const { data: relatedOrders } = await supabaseAdmin
        .from('branch_orders')
        .select('id')
        .or(`from_tenant_id.eq.${id},to_tenant_id.eq.${id}`);

      if (relatedOrders && relatedOrders.length > 0) {
        const orderIds = relatedOrders.map((o: any) => o.id);
        await supabaseAdmin.from('branch_order_items').delete().in('order_id', orderIds);
        await supabaseAdmin.from('branch_orders').delete().in('id', orderIds);
      }
    } catch (err) {
      console.error('Error cleaning branch orders on tenant delete:', err);
    }

    // 2. Clean up invoices & invoice items
    try {
      const { data: relatedInvoices } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('tenant_id', id);

      if (relatedInvoices && relatedInvoices.length > 0) {
        const invIds = relatedInvoices.map((i: any) => i.id);
        await supabaseAdmin.from('invoice_items').delete().in('invoice_id', invIds);
        await supabaseAdmin.from('invoices').delete().in('id', invIds);
      }
    } catch (err) {
      console.error('Error cleaning invoices on tenant delete:', err);
    }

    // 3. Clean up purchases & purchase items
    try {
      const { data: relatedPurchases } = await supabaseAdmin
        .from('purchases')
        .select('id')
        .eq('tenant_id', id);

      if (relatedPurchases && relatedPurchases.length > 0) {
        const pIds = relatedPurchases.map((p: any) => p.id);
        await supabaseAdmin.from('purchase_items').delete().in('purchase_id', pIds);
        await supabaseAdmin.from('purchases').delete().in('id', pIds);
      }
    } catch (err) {
      console.error('Error cleaning purchases on tenant delete:', err);
    }

    // 4. Clean up other child tables
    await supabaseAdmin.from('app_users').delete().eq('tenant_id', id);
    await supabaseAdmin.from('held_invoices').delete().eq('tenant_id', id);
    await supabaseAdmin.from('items').delete().eq('tenant_id', id);
    await supabaseAdmin.from('shifts').delete().eq('tenant_id', id);
    await supabaseAdmin.from('expenses').delete().eq('tenant_id', id);
    await supabaseAdmin.from('petty_expenses').delete().eq('tenant_id', id);
    await supabaseAdmin.from('clients').delete().eq('tenant_id', id);
    await supabaseAdmin.from('suppliers').delete().eq('tenant_id', id);
    await supabaseAdmin.from('audit_logs').delete().eq('tenant_id', id);
    await supabaseAdmin.from('vouchers').delete().eq('tenant_id', id);

    // 5. Finally delete the tenant
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
    const { 
      id, 
      is_active, 
      name, 
      phone, 
      email, 
      city, 
      address, 
      type,
      commission_enabled,
      commission_rate,
      commission_split_lead,
      commission_split_staff,
      commission_split_reserve,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (is_active !== undefined) updateData.is_active = is_active;
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (type) updateData.type = type;
    if (commission_enabled !== undefined) updateData.commission_enabled = commission_enabled;
    if (commission_rate !== undefined) updateData.commission_rate = Number(commission_rate);
    if (commission_split_lead !== undefined) updateData.commission_split_lead = Number(commission_split_lead);
    if (commission_split_staff !== undefined) updateData.commission_split_staff = Number(commission_split_staff);
    if (commission_split_reserve !== undefined) updateData.commission_split_reserve = Number(commission_split_reserve);

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
