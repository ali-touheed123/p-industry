import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { username, password, target_slug } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Query user
    const { data: user, error: userErr } = await supabaseAdmin
      .from('app_users')
      .select('*, tenants(*)')
      .eq('username', cleanUsername)
      .eq('is_active', true)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ success: false, error: 'Invalid username or inactive account' }, { status: 401 });
    }

    // Password verification (in production this can use bcrypt; currently comparing password_hash directly)
    if (user.password_hash !== password) {
      return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
    }

    // Developer Super Admin can access everything
    if (user.role === 'developer') {
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
        }
      });
    }

    // If logging into a specific shop/godown URL slug
    if (target_slug) {
      const { data: targetTenant } = await supabaseAdmin
        .from('tenants')
        .select('*')
        .eq('slug', target_slug)
        .single();

      if (!targetTenant) {
        return NextResponse.json({ success: false, error: 'Shop or Godown not found' }, { status: 404 });
      }

      // If user is CEO, check if they own this tenant or have access in ceo_tenants
      if (user.role === 'ceo') {
        const { data: ceoAccess } = await supabaseAdmin
          .from('ceo_tenants')
          .select('*')
          .eq('user_id', user.id)
          .eq('tenant_id', targetTenant.id)
          .single();

        if (user.tenant_id !== targetTenant.id && !ceoAccess) {
          return NextResponse.json({ success: false, error: 'You do not have CEO access to this branch' }, { status: 403 });
        }
      } else {
        // Staff role: must match the specific tenant
        if (user.tenant_id !== targetTenant.id) {
          return NextResponse.json({ success: false, error: 'Staff account is not authorized for this branch' }, { status: 403 });
        }
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          tenant: targetTenant,
        }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        tenant: user.tenants,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
