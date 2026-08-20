import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch all users or users by tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    let query = supabaseAdmin
      .from('app_users')
      .select('id, username, full_name, email, role, tenant_id, is_active, created_at, tenants(name, slug, type)')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, users: users || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create a new user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, full_name, role, tenant_id, email } = body;

    if (!username || !password || !role) {
      return NextResponse.json({ success: false, error: 'Username, password and role are required' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    const { data: newUser, error } = await supabaseAdmin
      .from('app_users')
      .insert({
        username: cleanUsername,
        password_hash: password,
        full_name: full_name || cleanUsername,
        email: email || null,
        role,
        tenant_id: tenant_id || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Username already exists' }, { status: 400 });
      }
      throw error;
    }

    if (role === 'ceo' && tenant_id) {
      await supabaseAdmin
        .from('ceo_tenants')
        .insert({ user_id: newUser.id, tenant_id });
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a user
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
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    await supabaseAdmin.from('ceo_tenants').delete().eq('user_id', id);
    const { error } = await supabaseAdmin.from('app_users').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
