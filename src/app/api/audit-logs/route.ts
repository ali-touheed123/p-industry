import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch audit logs for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }
    if (entityType && entityType !== 'all') {
      query = query.eq('entity_type', entityType);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
