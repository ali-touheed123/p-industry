import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

/**
 * GET /api/purchases/check-duplicate
 * Query Params: tenant_id, purchase_no, supplier_id (optional), supplier_name (optional)
 *
 * Checks if a purchase invoice number already exists for a given supplier in the tenant.
 * When supplier_id is null/unselected, supplier_name is matched to avoid false positive
 * warnings across distinct unnamed suppliers.
 *
 * NOTE: This warning is purely ADVISORY and pre-save/scan UX assistance. It is NOT race-proof.
 * The database enforces uniqueness for registered suppliers via uq_purchases_tenant_supplier_purchase_no.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const purchaseNo = searchParams.get('purchase_no')?.trim();
    const supplierId = searchParams.get('supplier_id')?.trim() || null;
    const supplierName = searchParams.get('supplier_name')?.trim() || null;

    if (!tenantId || !purchaseNo) {
      return NextResponse.json(
        { success: false, error: 'tenant_id and purchase_no are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('purchases')
      .select('id, purchase_no, supplier_id, supplier_name, date, net_total')
      .eq('tenant_id', tenantId)
      .eq('purchase_no', purchaseNo);

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    } else if (supplierName) {
      // Unnamed/ad-hoc supplier: match both null supplier_id AND matching supplier_name
      query = query.is('supplier_id', null).ilike('supplier_name', supplierName);
    } else {
      // No supplier specified: check for null supplier_id
      query = query.is('supplier_id', null);
    }

    const { data: existing, error } = await query.limit(1).maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      is_duplicate: Boolean(existing),
      existing_purchase: existing
        ? {
            id: existing.id,
            purchase_no: existing.purchase_no,
            supplier_name: existing.supplier_name,
            date: existing.date,
            net_total: existing.net_total,
          }
        : null,
      advisory_note: 'Advisory warning only; not race-proof.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

