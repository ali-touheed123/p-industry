import { karachiToday } from '@/lib/karachiDate';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req, null);
    if (!auth.authorized || !auth.session) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const body = await req.json();
    const { tenant_ids, today } = body;

    if (!Array.isArray(tenant_ids) || tenant_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Array of tenant_ids is required' }, { status: 400 });
    }

    // Role-based scoping of requested tenant_ids
    let allowedTenantIds: string[] = [];

    if (auth.session.role === 'developer') {
      allowedTenantIds = tenant_ids;
    } else if (auth.session.role === 'ceo') {
      // Fetch authorized sister branches for this CEO
      const { data: callerTenant } = await supabaseAdmin
        .from('tenants')
        .select('owner_name, email')
        .eq('id', auth.session.tenantId)
        .maybeSingle();

      let branchQuery = supabaseAdmin
        .from('tenants')
        .select('id');

      if (callerTenant?.owner_name && callerTenant?.email) {
        branchQuery = branchQuery.or(`id.eq.${auth.session.tenantId},owner_name.eq.${callerTenant.owner_name},email.eq.${callerTenant.email}`);
      } else if (callerTenant?.owner_name) {
        branchQuery = branchQuery.or(`id.eq.${auth.session.tenantId},owner_name.eq.${callerTenant.owner_name}`);
      } else if (callerTenant?.email) {
        branchQuery = branchQuery.or(`id.eq.${auth.session.tenantId},email.eq.${callerTenant.email}`);
      } else {
        branchQuery = branchQuery.eq('id', auth.session.tenantId);
      }

      const { data: authorizedTenants } = await branchQuery;
      const authorizedSet = new Set((authorizedTenants || []).map(t => t.id));

      // Filter requested tenant_ids against authorized set
      allowedTenantIds = tenant_ids.filter(id => authorizedSet.has(id));
    } else {
      // Staff: only authorized for their assigned branch
      allowedTenantIds = tenant_ids.filter(id => id === auth.session!.tenantId);
    }

    if (allowedTenantIds.length === 0) {
      return NextResponse.json({ success: true, kpis: [] });
    }

    const todayDate = today || karachiToday();

    const { data: kpiData, error: rpcErr } = await supabaseAdmin.rpc('get_ceo_branches_kpi_summary', {
      p_tenant_ids: allowedTenantIds,
      p_today: todayDate,
    });

    if (rpcErr) throw rpcErr;

    return NextResponse.json({ success: true, kpis: kpiData || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req, null);
    if (!auth.authorized || !auth.session) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantIdsParam = searchParams.get('tenant_ids');
    const today = searchParams.get('today') || karachiToday();

    const tenantIds = tenantIdsParam ? tenantIdsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (tenantIds.length === 0) {
      return NextResponse.json({ success: false, error: 'tenant_ids parameter required' }, { status: 400 });
    }

    return POST(new NextRequest(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ tenant_ids: tenantIds, today }),
    }));
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
