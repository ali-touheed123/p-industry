import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: CEO audit log query with date, search, and status filtering
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const search = searchParams.get('search');
    const eventType = searchParams.get('event_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // CEO-only authorization (TASK-SR-05 / Decision 6):
    // Developer and staff roles are strictly rejected with 403 Forbidden.
    if (auth.session.role !== 'ceo') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Special Print Log is restricted to CEO role.' },
        { status: 403 }
      );
    }

    let query = supabaseAdmin
      .from('special_print_log')
      .select('id, tenant_id, invoice_id, invoice_no, printed_by, user_id, event_type, printed_at, master_total, printed_total, charged_total, delivery_charge, receipt_snapshot, template_snapshot, original_invoice_id')
      .eq('tenant_id', tenantId)
      .order('printed_at', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('printed_at', `${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      query = query.lte('printed_at', `${endDate}T23:59:59.999Z`);
    }

    if (eventType && ['sale', 'reprint', 'return'].includes(eventType)) {
      query = query.eq('event_type', eventType);
    }

    if (search) {
      const cleanSearch = search.trim();
      query = query.or(`invoice_no.ilike.%${cleanSearch}%,printed_by.ilike.%${cleanSearch}%`);
    }

    const { data: logs, error: logErr } = await query;
    if (logErr) {
      return NextResponse.json({ success: false, error: logErr.message }, { status: 500 });
    }

    // Attach live invoice status for each invoice_id (to reflect cancellations)
    const invoiceIds = Array.from(new Set((logs || []).map((l: any) => l.invoice_id).filter(Boolean)));
    const statusMap = new Map<string, string>();

    if (invoiceIds.length > 0) {
      const { data: invRows } = await supabaseAdmin
        .from('invoices')
        .select('id, status')
        .in('id', invoiceIds);

      (invRows || []).forEach((inv: { id: string; status: string }) => {
        statusMap.set(inv.id, inv.status);
      });
    }

    const enrichedLogs = (logs || []).map((l: any) => ({
      ...l,
      invoice_status: l.invoice_id ? (statusMap.get(l.invoice_id) ?? 'unknown') : null,
    }));

    const invoiceStatusParam = searchParams.get('invoice_status');
    let finalLogs = enrichedLogs;
    if (invoiceStatusParam && invoiceStatusParam !== 'all') {
      finalLogs = enrichedLogs.filter((l: any) => l.invoice_status === invoiceStatusParam);
    }

    return NextResponse.json({ success: true, logs: finalLogs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Any mutating method is strictly blocked on the audit log (R7 / Immutability mandate)
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed: Special Print Log entries are immutable and written only via atomic RPCs.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed: Special Print Log entries cannot be modified.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Method Not Allowed: Special Print Log entries cannot be deleted.' },
    { status: 405 }
  );
}
