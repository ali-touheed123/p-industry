import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_TEMPLATE_JSON, ReceiptTemplate } from '@/types/receipt';
import { requireDevAuth, requireTenantAuth } from '@/lib/session';

// GET all non-deleted receipt templates (or single template by ?id=...)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req, null);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // FIX FINDING-API-015: Scope templates to the caller's tenant.
    // Previously this returned ALL templates from ALL tenants (null-scope).
    // Developers may still fetch any template by explicit ?id=
    const callerTenantId = auth.session?.tenantId ?? null;
    const isDeveloper = auth.session?.role === 'developer';

    if (id) {
      const templateQuery = supabaseAdmin
        .from('receipt_templates')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false);

      const { data, error } = await templateQuery.single();

      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
      }

      // Non-developers may only read templates belonging to their tenant or system templates (null tenant_id)
      if (!isDeveloper && callerTenantId && data.tenant_id && data.tenant_id !== callerTenantId) {
        return NextResponse.json({ success: false, error: 'Forbidden: template belongs to another tenant' }, { status: 403 });
      }

      return NextResponse.json({ success: true, template: data });
    }

    // FIX FINDING-API-016: Add default pagination limit (50) to prevent unbounded catalog scans
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

    let listQuery = supabaseAdmin
      .from('receipt_templates')
      .select('*')
      .eq('is_deleted', false)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // Scope to caller's tenant (or global system templates with null tenant_id)
    if (!isDeveloper && callerTenantId) {
      listQuery = listQuery.or(`tenant_id.eq.${callerTenantId},tenant_id.is.null`);
    }

    const { data: templates, error } = await listQuery;

    if (error) throw error;

    // If no templates exist yet, seed a default one (scoped to caller's tenant)
    if (!templates || templates.length === 0) {
      const defaultRecord = {
        name: 'Standard Thermal 80mm',
        description: 'Standard 80mm thermal roll receipt with logo, invoice details, and footer.',
        paper_size: 'thermal_80',
        template_json: DEFAULT_TEMPLATE_JSON,
        is_default: true,
        is_deleted: false,
        tenant_id: callerTenantId,
      };

      const { data: created, error: seedErr } = await supabaseAdmin
        .from('receipt_templates')
        .insert(defaultRecord)
        .select()
        .single();

      if (!seedErr && created) {
        return NextResponse.json({ success: true, templates: [created] });
      }
    }

    return NextResponse.json({ success: true, templates: templates || [] });
  } catch (err: any) {
    console.error('Error fetching receipt templates:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST: Create a new template or clone
export async function POST(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { name, description, paper_size, template_json, is_default } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Template name is required' }, { status: 400 });
    }

    const newTemplate = {
      name: name.trim(),
      description: description?.trim() || null,
      paper_size: paper_size || 'thermal_80',
      template_json: template_json || DEFAULT_TEMPLATE_JSON,
      is_default: false,
      is_deleted: false,
    };

    const { data, error } = await supabaseAdmin
      .from('receipt_templates')
      .insert(newTemplate)
      .select()
      .single();

    if (error) throw error;

    let finalTemplate = data;
    if (is_default && data?.id) {
      // TASK-P11-11: Atomic default template assignment
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('set_default_receipt_template', {
        p_template_id: data.id,
      });
      if (rpcErr) throw rpcErr;
      if (rpcData?.template) {
        finalTemplate = rpcData.template;
      }
    }

    return NextResponse.json({ success: true, template: finalTemplate }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to create template' }, { status: 500 });
  }
}

// PATCH: Update template
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { id, name, description, paper_size, template_json, is_default } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID is required' }, { status: 400 });
    }

    const updatePayload: Partial<ReceiptTemplate> = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description?.trim() || null;
    if (paper_size !== undefined) updatePayload.paper_size = paper_size;
    if (template_json !== undefined) updatePayload.template_json = template_json;
    if (is_default !== undefined && !is_default) {
      updatePayload.is_default = false;
    }

    let updatedTemplate: any = null;
    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('receipt_templates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      updatedTemplate = data;
    }

    if (is_default) {
      // TASK-P11-11: Atomic procedure resets all others and marks this as default in one transaction
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('set_default_receipt_template', {
        p_template_id: id,
      });
      if (rpcErr) throw rpcErr;
      if (rpcData?.template) {
        updatedTemplate = rpcData.template;
      }
    }

    if (!updatedTemplate) {
      const { data: current } = await supabaseAdmin.from('receipt_templates').select('*').eq('id', id).single();
      updatedTemplate = current;
    }

    return NextResponse.json({ success: true, template: updatedTemplate });
  } catch (err: any) {
    console.error('Error updating receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to update template' }, { status: 500 });
  }
}

// DELETE: Soft delete template
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Template ID is required' }, { status: 400 });
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('receipt_templates')
      .update({ is_deleted: true, is_default: false })
      .eq('id', id);

    if (error) throw error;

    // Also remove tenant overrides that pointed to this template
    await supabaseAdmin
      .from('tenant_receipt_template')
      .delete()
      .eq('template_id', id);

    return NextResponse.json({ success: true, message: 'Template deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to delete template' }, { status: 500 });
  }
}
