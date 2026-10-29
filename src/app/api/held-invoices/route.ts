import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch parked / held invoices for a tenant
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

    const { data: heldInvoices, error } = await supabaseAdmin
      .from('held_invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, held_invoices: heldInvoices || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Park / Hold an invoice in Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      hold_no,
      client_id,
      client_name,
      invoice_type = 'sales',
      items = [],
      subtotal = 0,
      discount = 0,
      delivery_charge = 0,
      net_total = 0,
      remarks,
      // Phase 5.3: Offline hold idempotency key (device-generated UUID)
      local_hold_id,
    } = body;

    if (!tenant_id || !hold_no || !items.length) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Hold No, and at least 1 item required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Phase 5.3: If local_hold_id provided, check for an existing duplicate before inserting.
    // This makes offline hold sync fully idempotent — a network-retry of the same hold
    // will return the existing record instead of creating a duplicate row.
    if (local_hold_id) {
      const { data: existing } = await supabaseAdmin
        .from('held_invoices')
        .select('id, hold_no')
        .eq('local_hold_id', local_hold_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, is_duplicate: true, held_order: existing });
      }
    }

    const { data: heldOrder, error } = await supabaseAdmin
      .from('held_invoices')
      .insert({
        tenant_id,
        hold_no,
        client_id: client_id || null,
        client_name: client_name || 'Walk-in Customer',
        invoice_type,
        items_json: items,
        subtotal: Number(subtotal),
        discount: Number(discount),
        delivery_charge: Number(delivery_charge),
        net_total: Number(net_total),
        remarks: remarks || null,
        // Phase 5.3: Store device UUID for future dedup on retry
        ...(local_hold_id ? { local_hold_id } : {}),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, held_order: heldOrder });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a held invoice after restoring or deleting
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    // FIX FINDING-API-010: Fetch resource first. If missing, return 404 immediately
    // before calling requireTenantAuth(). Passing undefined as tenant_id would fall
    // back to a null-scoped check, letting any authenticated user attempt deletion.
    const { data: existingHeld } = await supabaseAdmin
      .from('held_invoices')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!existingHeld) {
      return NextResponse.json({ success: false, error: 'Held invoice not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingHeld.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabaseAdmin
      .from('held_invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Held invoice removed' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
