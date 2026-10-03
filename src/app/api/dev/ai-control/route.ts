import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireDevAuth } from '@/lib/session';
import {
  getMemoryGlobalSettings,
  updateMemoryGlobalSettings,
  getMemoryTenantSettings,
  updateMemoryTenantSettings,
  getMemoryLedger,
} from '@/lib/ai-gateway';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dev/ai-control
 * Developer Panel: Fetch global AI controls, per-shop AI limits, analytics, and request history
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Global AI Settings
    let globalSettings: any = null;
    try {
      const { data } = await supabaseAdmin.from('global_ai_settings').select('*').eq('id', 1).maybeSingle();
      globalSettings = data;
    } catch (e) {}

    if (!globalSettings) {
      globalSettings = getMemoryGlobalSettings();
    }

    // 2. Fetch all tenants and their AI settings
    const [{ data: tenantsData }, tenantAiRes] = await Promise.all([
      supabaseAdmin.from('tenants').select('id, name, slug, city, is_active'),
      Promise.resolve(supabaseAdmin.from('tenant_ai_settings').select('*')).catch(() => ({ data: null, error: null })),
    ]);
    const tenantAiSettings = tenantAiRes?.data;

    const tenantAiMap = new Map<string, any>((tenantAiSettings || []).map((s: any) => [s.tenant_id, s]));

    // 3. Fetch Ledger Usage Data
    let dbLedger: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('ai_usage_ledger')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);
      dbLedger = data || [];
    } catch (e) {}

    const memLedger = getMemoryLedger();
    const combinedLedger = [...dbLedger, ...memLedger].sort(
      (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );

    const ledger30d = combinedLedger.filter(
      (r) => ['reserved', 'success', 'failed'].includes(r.status) && r.requested_at >= ago30d
    );

    // Aggregate Analytics
    const totalRequests30d = ledger30d.length;
    const global24hCount = ledger30d.filter((r) => r.requested_at >= ago24h).length;
    const global30dCost = ledger30d.reduce((sum, r) => sum + (Number(r.estimated_cost) || 0), 0);
    const totalTokens30d = ledger30d.reduce((sum, r) => sum + (Number(r.total_tokens) || 0), 0);

    // Per-shop 24h & 30d usage counts
    const shopUsage24h = new Map<string, number>();
    const shopUsage30d = new Map<string, number>();

    ledger30d.forEach((row) => {
      const tid = row.tenant_id;
      shopUsage30d.set(tid, (shopUsage30d.get(tid) || 0) + 1);
      if (row.requested_at >= ago24h) {
        shopUsage24h.set(tid, (shopUsage24h.get(tid) || 0) + 1);
      }
    });

    // Breakdown by Feature
    const featureBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};

    ledger30d.forEach((row) => {
      featureBreakdown[row.feature] = (featureBreakdown[row.feature] || 0) + 1;
      statusBreakdown[row.status] = (statusBreakdown[row.status] || 0) + 1;
    });

    // Combine Tenants with AI Settings & Usage
    const shopList = (tenantsData || []).map((tenant: any) => {
      const dbSetting = tenantAiMap.get(tenant.id);
      const memSetting = getMemoryTenantSettings(tenant.id);

      const dailyLimit = dbSetting?.daily_request_limit ?? memSetting.daily_request_limit;
      const monthlyLimit = dbSetting?.monthly_request_limit ?? memSetting.monthly_request_limit;
      const aiEnabled = dbSetting?.ai_enabled ?? memSetting.ai_enabled;

      const dailyUsed = shopUsage24h.get(tenant.id) || 0;
      const monthlyUsed = shopUsage30d.get(tenant.id) || 0;

      return {
        tenant_id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        city: tenant.city,
        is_active: tenant.is_active,
        ai_enabled: aiEnabled,
        daily_request_limit: dailyLimit,
        monthly_request_limit: monthlyLimit,
        daily_used: dailyUsed,
        monthly_used: monthlyUsed,
        remaining_daily: Math.max(0, dailyLimit - dailyUsed),
        remaining_monthly: Math.max(0, monthlyLimit - monthlyUsed),
      };
    });

    const tenantNameMap = new Map((tenantsData || []).map((t: any) => [t.id, t.name]));
    const formattedHistory = combinedLedger.slice(0, 100).map((row) => ({
      ...row,
      tenant_name: tenantNameMap.get(row.tenant_id) || 'Shop ID: ' + row.tenant_id.substring(0, 8),
    }));

    return NextResponse.json({
      success: true,
      global: {
        ai_enabled: globalSettings.ai_enabled,
        global_daily_request_cap: globalSettings.global_daily_request_cap,
        global_monthly_request_cap: globalSettings.global_monthly_request_cap,
        global_monthly_cost_cap: Number(globalSettings.global_monthly_cost_cap),
        short_term_rate_limit: globalSettings.short_term_rate_limit,
        daily_used: global24hCount || 0,
        monthly_used: totalRequests30d,
        monthly_cost: Number(global30dCost.toFixed(4)),
        total_tokens_30d: totalTokens30d,
      },
      analytics: {
        total_requests_30d: totalRequests30d,
        daily_requests_today: global24hCount || 0,
        total_tokens_30d: totalTokens30d,
        estimated_cost_30d: Number(global30dCost.toFixed(4)),
        by_feature: featureBreakdown,
        by_status: statusBreakdown,
      },
      shops: shopList,
      history: formattedHistory,
    });
  } catch (err: any) {
    console.error('[DEV-AI-CONTROL] GET Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/dev/ai-control
 * Developer Panel: Update Global AI Settings OR Shop AI Limits
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireDevAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { target, ...updates } = body;

    if (target === 'global') {
      const payload: any = {};
      if (updates.ai_enabled !== undefined) payload.ai_enabled = Boolean(updates.ai_enabled);
      if (updates.global_daily_request_cap !== undefined) payload.global_daily_request_cap = Number(updates.global_daily_request_cap);
      if (updates.global_monthly_request_cap !== undefined) payload.global_monthly_request_cap = Number(updates.global_monthly_request_cap);
      if (updates.global_monthly_cost_cap !== undefined) payload.global_monthly_cost_cap = Number(updates.global_monthly_cost_cap);
      if (updates.short_term_rate_limit !== undefined) payload.short_term_rate_limit = Number(updates.short_term_rate_limit);
      payload.updated_at = new Date().toISOString();

      updateMemoryGlobalSettings(payload);

      try {
        await supabaseAdmin.from('global_ai_settings').upsert({ id: 1, ...payload });
      } catch (e) {}

      return NextResponse.json({ success: true, global: getMemoryGlobalSettings() });
    } else if (target === 'shop') {
      const { tenant_id, ai_enabled, daily_request_limit, monthly_request_limit } = updates;
      if (!tenant_id) {
        return NextResponse.json({ success: false, error: 'tenant_id is required' }, { status: 400 });
      }

      const payload: any = {};
      if (ai_enabled !== undefined) payload.ai_enabled = Boolean(ai_enabled);
      if (daily_request_limit !== undefined) payload.daily_request_limit = Number(daily_request_limit);
      if (monthly_request_limit !== undefined) payload.monthly_request_limit = Number(monthly_request_limit);

      updateMemoryTenantSettings(tenant_id, payload);

      try {
        await supabaseAdmin.from('tenant_ai_settings').upsert({ tenant_id, ...payload, updated_at: new Date().toISOString() });
      } catch (e) {}

      return NextResponse.json({ success: true, shop: getMemoryTenantSettings(tenant_id) });
    } else {
      return NextResponse.json({ success: false, error: "Invalid target. Must be 'global' or 'shop'." }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[DEV-AI-CONTROL] PATCH Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
