import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_TEMPLATE_JSON, ReceiptTemplate } from '@/types/receipt';
import { requireTenantAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
};

// GET: Fetch the branch's active receipt template (custom or fallback to default)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get('tenant_id');

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status, headers: NO_CACHE_HEADERS });
    }

    // 1. Fetch platform default template
    const { data: defaultTemplate } = await supabaseAdmin
      .from('receipt_templates')
      .select('*')
      .eq('is_default', true)
      .eq('is_deleted', false)
      .maybeSingle();

    const fallbackTemplate: ReceiptTemplate = defaultTemplate || {
      id: 'default',
      name: 'Standard Thermal 80mm',
      description: 'Platform default receipt format',
      paper_size: 'thermal_80',
      template_json: DEFAULT_TEMPLATE_JSON,
      is_default: true,
      is_deleted: false,
    };

    // 2. Fetch tenant assignment
    const { data: assignment, error: assignErr } = await supabaseAdmin
      .from('tenant_receipt_template')
      .select('template_id, receipt_templates(*)')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!assignErr && assignment?.receipt_templates && !(assignment.receipt_templates as any).is_deleted) {
      const assignedTmpl = assignment.receipt_templates as any;
      const isCustom = !assignedTmpl.is_default;

      return NextResponse.json({
        success: true,
        is_custom: isCustom,
        template: assignedTmpl,
        defaultTemplate: fallbackTemplate,
      }, { headers: NO_CACHE_HEADERS });
    }

    // Fallback: Branch inherits the platform default
    return NextResponse.json({
      success: true,
      is_custom: false,
      template: fallbackTemplate,
      defaultTemplate: fallbackTemplate,
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    console.error('Error fetching branch receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch branch receipt template' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// POST: Save or update receipt settings specifically for this branch
// GUARANTEE: Never modifies the default template or any other branch's receipt
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, paper_size, template_json, name } = body;

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status, headers: NO_CACHE_HEADERS });
    }

    // Fetch tenant name for clean template identification
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    const branchName = tenantData?.name || 'Branch';

    // Check existing assignment
    const { data: existingAssignment } = await supabaseAdmin
      .from('tenant_receipt_template')
      .select('template_id, receipt_templates(id, is_default, is_deleted, name)')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    const currentTmpl = existingAssignment?.receipt_templates as any;
    const isCurrentlyCustom = currentTmpl && !currentTmpl.is_default && !currentTmpl.is_deleted;

    let savedTemplate: any = null;

    if (isCurrentlyCustom) {
      // Branch already has a custom template. Check if it is shared with other tenants.
      const { count: sharedCount } = await supabaseAdmin
        .from('tenant_receipt_template')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', currentTmpl.id);

      if (sharedCount === 1) {
        // Safe to update existing custom template in place
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from('receipt_templates')
          .update({
            name: name?.trim() || currentTmpl.name || `${branchName} Custom Receipt`,
            paper_size: paper_size || 'thermal_80',
            template_json: template_json || DEFAULT_TEMPLATE_JSON,
          })
          .eq('id', currentTmpl.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        savedTemplate = updated;
      } else {
        // Shared template: clone to a new independent template for this branch
        const { data: cloned, error: cloneErr } = await supabaseAdmin
          .from('receipt_templates')
          .insert({
            name: name?.trim() || `${branchName} Custom Receipt`,
            description: `Branch-specific receipt layout for ${branchName}`,
            paper_size: paper_size || 'thermal_80',
            template_json: template_json || DEFAULT_TEMPLATE_JSON,
            is_default: false,
            is_deleted: false,
          })
          .select()
          .single();

        if (cloneErr) throw cloneErr;

        await supabaseAdmin
          .from('tenant_receipt_template')
          .upsert({
            tenant_id,
            template_id: cloned.id,
          }, { onConflict: 'tenant_id' });

        savedTemplate = cloned;
      }
    } else {
      // Branch was using platform default or had no custom template.
      // Create a brand new template record specifically for this branch!
      // This strictly protects the platform default from being modified.
      const { data: created, error: createErr } = await supabaseAdmin
        .from('receipt_templates')
        .insert({
          name: name?.trim() || `${branchName} Custom Receipt`,
          description: `Branch-specific receipt layout for ${branchName}`,
          paper_size: paper_size || 'thermal_80',
          template_json: template_json || DEFAULT_TEMPLATE_JSON,
          is_default: false,
          is_deleted: false,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      // Assign the new custom template to this tenant
      const { error: assignErr } = await supabaseAdmin
        .from('tenant_receipt_template')
        .upsert({
          tenant_id,
          template_id: created.id,
        }, { onConflict: 'tenant_id' });

      if (assignErr) throw assignErr;

      savedTemplate = created;
    }

    return NextResponse.json({
      success: true,
      is_custom: true,
      template: savedTemplate,
      message: `Receipt layout updated successfully for ${branchName}`,
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    console.error('Error saving branch receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to save receipt template' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// DELETE: Reset branch receipt to platform default template
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get('tenant_id');

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status, headers: NO_CACHE_HEADERS });
    }

    // Delete assignment for this tenant
    const { error: delErr } = await supabaseAdmin
      .from('tenant_receipt_template')
      .delete()
      .eq('tenant_id', tenant_id);

    if (delErr) throw delErr;

    // Fetch the platform default template
    const { data: defaultTemplate } = await supabaseAdmin
      .from('receipt_templates')
      .select('*')
      .eq('is_default', true)
      .eq('is_deleted', false)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      is_custom: false,
      template: defaultTemplate,
      message: 'Branch receipt layout successfully reset to platform default',
    }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    console.error('Error resetting branch receipt template:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to reset receipt template' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
