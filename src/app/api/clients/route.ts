import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { generateUniqueCode } from '@/lib/utils';

// GET: Fetch clients for a tenant (with optional cursor pagination)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const cursor = searchParams.get('cursor');
    const limitParam = searchParams.get('limit');
    let limit = 50;
    if (limitParam === 'all' || limitParam === 'none') {
      limit = 10000;
    } else if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 10000);
      }
    }

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.gt('name', cursor);
    }

    const { data: clients, error } = await query;
    if (error) throw error;

    const clientList = clients || [];
    const hasMore = clientList.length === limit;
    const nextCursor = hasMore && clientList.length > 0 ? clientList[clientList.length - 1].name : null;

    return NextResponse.json({
      success: true,
      clients: clientList,
      has_more: hasMore,
      next_cursor: nextCursor,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add new customer / client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      name,
      phone,
      city,
      area,
      address,
      credit_limit = 50000,
      current_balance = 0,
      reference,
    } = body;

    if (!tenant_id || !name) {
      return NextResponse.json({ success: false, error: 'Tenant ID and Name are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // FIX FINDING-API-013: Use collision-safe unique code generator
    const code = await generateUniqueCode('CL', 'clients', 'code', tenant_id);

    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .insert({
        tenant_id,
        code,
        name,
        phone: phone || null,
        city: city || null,
        area: area || null,
        address: address || null,
        credit_limit: Number(credit_limit) || 50000,
        current_balance: Number(current_balance) || 0,
        reference: reference || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update client details (e.g. credit_limit, phone, address)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, credit_limit, name, phone, address, city, reference } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Client ID is required' }, { status: 400 });
    }

    // Fetch record first — prevents null-scope auth bypass when client not found
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingClient) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingClient.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const updates: Record<string, any> = {};
    if (credit_limit !== undefined) updates.credit_limit = Number(credit_limit);
    if (name !== undefined) updates.name = typeof name === 'string' ? name.trim() : name;
    if (phone !== undefined) updates.phone = phone || null;
    if (address !== undefined) updates.address = address || null;
    if (city !== undefined) updates.city = city || null;
    if (reference !== undefined) updates.reference = reference || null;

    // Scope update to tenant as defence-in-depth
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', existingClient.tenant_id)
      .select()
      .single();

    if (error) throw error;

    // Option B: Cascade updated client name to historical invoices and payment vouchers
    if (name !== undefined && typeof name === 'string' && name.trim()) {
      const trimmedName = name.trim();
      await Promise.all([
        supabaseAdmin
          .from('invoices')
          .update({ client_name: trimmedName })
          .eq('client_id', id)
          .eq('tenant_id', existingClient.tenant_id),
        supabaseAdmin
          .from('vouchers')
          .update({ party_name: trimmedName })
          .eq('party_id', id)
          .eq('party_type', 'client')
          .eq('tenant_id', existingClient.tenant_id),
      ]);
    }

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Soft-delete a client (preserves ledger / invoice history)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Client ID is required' }, { status: 400 });
    }

    // Fetch record first — prevents null-scope auth bypass when client not found
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingClient) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingClient.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Soft-delete: preserve financial history, do not hard-delete
    const { error } = await supabaseAdmin
      .from('clients')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('tenant_id', existingClient.tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

