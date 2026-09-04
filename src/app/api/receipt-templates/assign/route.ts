import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_TEMPLATE_JSON } from '@/types/receipt';

// GET: Fetch assignment for single tenant or all tenants
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get('tenant_id');

    // 1. Single tenant lookup: returns the assigned template, or falls back to platform default
    if (tenant_id) {
      const { data: assignment, error: assignErr } = await supabaseAdmin
        .from('tenant_receipt_template')
        .select('template_id, receipt_templates(*)')
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (!assignErr && assignment?.receipt_templates && !(assignment.receipt_templates as any).is_deleted) {
        return NextResponse.json({
          success: true,
          is_custom: true,
          template: assignment.receipt_templates,
        });
      }

      // Fallback to platform default template
      const { data: defaultTemplate } = await supabaseAdmin
        .from('receipt_templates')
        .select('*')
        .eq('is_default', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (defaultTemplate) {
        return NextResponse.json({
          success: true,
          is_custom: false,
          template: defaultTemplate,
        });
      }

      // If even default is not found, fallback to first non-deleted or static default
      const { data: anyTemplate } = await supabaseAdmin
        .from('receipt_templates')
        .select('*')
        .eq('is_deleted', false)
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        is_custom: false,
        template: anyTemplate || {
          id: 'default',
          name: 'Fallback Template',
          paper_size: 'thermal_80',
          template_json: DEFAULT_TEMPLATE_JSON,
          is_default: true,
          is_deleted: false,
        },
      });
    }

    // 2. Fetch all tenants with their assigned template (for Dev Panel Assignment table)
    const { data: tenants, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, type, is_active')
      .order('name', { ascending: true });

    if (tenantErr) throw tenantErr;

    const { data: assignments, error: assignErr } = await supabaseAdmin
      .from('tenant_receipt_template')
      .select('tenant_id, template_id, receipt_templates(id, name, paper_size, is_default, is_deleted)');

    if (assignErr) throw assignErr;

    const assignmentMap = new Map<string, any>();
    (assignments || []).forEach((a) => {
      assignmentMap.set(a.tenant_id, a);
    });

    const result = (tenants || []).map((t) => {
      const match = assignmentMap.get(t.id);
      return {
        tenant_id: t.id,
        tenant_name: t.name,
        tenant_slug: t.slug,
        tenant_type: t.type,
        is_active: t.is_active,
        template_id: match && !match.receipt_templates?.is_deleted ? match.template_id : null,
        template_name: match && !match.receipt_templates?.is_deleted ? match.receipt_templates?.name : null,
        paper_size: match && !match.receipt_templates?.is_deleted ? match.receipt_templates?.paper_size : null,
      };
    });

    return NextResponse.json({ success: true, assignments: result });
  } catch (err: any) {
    console.error('Error fetching receipt template assignments:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch assignments' }, { status: 500 });
  }
}

// POST: Set template assignment for tenant (upsert)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, template_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    // If template_id is null or empty string, remove override (revert to default)
    if (!template_id) {
      await supabaseAdmin
        .from('tenant_receipt_template')
        .delete()
        .eq('tenant_id', tenant_id);

      return NextResponse.json({ success: true, message: 'Reverted to platform default template' });
    }

    // Verify template exists and not deleted
    const { data: tmpl, error: tmplErr } = await supabaseAdmin
      .from('receipt_templates')
      .select('id')
      .eq('id', template_id)
      .eq('is_deleted', false)
      .single();

    if (tmplErr || !tmpl) {
      return NextResponse.json({ success: false, error: 'Invalid or deleted template' }, { status: 404 });
    }

    // Upsert assignment
    const { data, error } = await supabaseAdmin
      .from('tenant_receipt_template')
      .upsert({ tenant_id, template_id }, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assignment: data });
  } catch (err: any) {
    console.error('Error assigning receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to assign template' }, { status: 500 });
  }
}

// DELETE: Remove assignment (revert tenant to platform default)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get('tenant_id');

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('tenant_receipt_template')
      .delete()
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Reverted to platform default template' });
  } catch (err: any) {
    console.error('Error removing assignment:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to remove assignment' }, { status: 500 });
  }
}
