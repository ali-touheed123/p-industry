import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_TEMPLATE_JSON, ReceiptTemplate } from '@/types/receipt';
import { requireDevAuth } from '@/lib/session';

// GET all non-deleted receipt templates (or single template by ?id=...)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

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

      return NextResponse.json({ success: true, template: data });
    }

    // Default pagination limit (50) to prevent unbounded catalog scans
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

    const listQuery = supabaseAdmin
      .from('receipt_templates')
      .select('*')
      .eq('is_deleted', false)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: templates, error } = await listQuery;

    if (error) throw error;

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
