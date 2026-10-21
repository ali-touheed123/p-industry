import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Retrieve receipt snapshot and template snapshot for a special invoice
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('invoice_id');
    const tenantId = searchParams.get('tenant_id');

    if (!invoiceId || !tenantId) {
      return NextResponse.json({ success: false, error: 'invoice_id and tenant_id are required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Role check:
    // CEO is allowed for view-only preview in CEO panel.
    // Staff requires fresh can_use_special_receipt check for reprint.
    if (auth.session.role === 'staff') {
      const { data: user } = await supabaseAdmin
        .from('app_users')
        .select('is_active, can_use_special_receipt, tenant_id')
        .eq('id', auth.session.userId)
        .maybeSingle();

      if (!user?.is_active || !user.can_use_special_receipt || user.tenant_id !== tenantId) {
        return NextResponse.json(
          { success: false, error: 'Access denied: Special Receipt permission required.' },
          { status: 403 }
        );
      }
    } else if (auth.session.role !== 'ceo') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only CEO or authorized staff can retrieve snapshots.' },
        { status: 403 }
      );
    }

    // Fetch the sale event snapshot (which has the full original items and template)
    const { data: logRecord, error } = await supabaseAdmin
      .from('special_print_log')
      .select('id, invoice_id, invoice_no, printed_by, printed_at, master_total, printed_total, charged_total, delivery_charge, receipt_snapshot, template_snapshot')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('printed_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !logRecord) {
      return NextResponse.json({ success: false, error: 'Special receipt log record not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      snapshot: logRecord.receipt_snapshot,
      template: logRecord.template_snapshot,
      invoice_no: logRecord.invoice_no,
      printed_at: logRecord.printed_at,
      master_total: logRecord.master_total,
      printed_total: logRecord.printed_total,
      charged_total: logRecord.charged_total,
      delivery_charge: logRecord.delivery_charge,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
