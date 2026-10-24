import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';
import { requireCeoApproval } from '@/lib/ceo-approval';

// Helper: match item unit string to config unit string safely without accidental fuzzy collisions
function matchUnitToConfig(itemUnitRaw: string | null | undefined, configUnitRaw: string | null | undefined): boolean {
  if (!itemUnitRaw || !configUnitRaw) return false;
  const u = itemUnitRaw.trim().toLowerCase();
  const cu = configUnitRaw.trim().toLowerCase();
  if (u === cu) return true;

  // Normalized alphanumeric match (handles whitespace/casing variations e.g. "20 kg bag" vs "20kg bag")
  const normU = u.replace(/[^a-z0-9]/g, '');
  const normCU = cu.replace(/[^a-z0-9]/g, '');
  if (normU === normCU && normU.length > 0) return true;

  // Standard paint unit word boundary matching (prevents accidental substring matches with custom units)
  const isDrum = (s: string) => /\bdrums?\b/i.test(s) || /^(20\s*(l|ltr|liters?|litres?))$/i.test(s.trim());
  const isGallon = (s: string) => /\bgallons?\b/i.test(s) || /^(4\s*(l|ltr|liters?|litres?))$/i.test(s.trim());
  const isQuarter = (s: string) => /\bquarters?\b/i.test(s) || /^(1\s*(l|ltr|liters?|litres?))$/i.test(s.trim());

  if (isDrum(cu) && isDrum(u)) return true;
  if (isGallon(cu) && isGallon(u)) return true;
  if (isQuarter(cu) && isQuarter(u)) return true;

  return false;
}

// Helper: resolve brand and series from names or IDs
async function resolveBrandAndSeries(
  tenantId: string,
  brandName?: string | null,
  brandId?: string | null,
  seriesId?: string | null
): Promise<{ brand_id: string | null; series_id: string | null; brand: string }> {
  let resolvedBrandId = brandId || null;
  let resolvedSeriesId = seriesId || null;
  let resolvedBrandName = brandName?.trim() || '';

  if (resolvedBrandId && !resolvedBrandName) {
    const { data: b } = await supabaseAdmin
      .from('brands')
      .select('name')
      .eq('id', resolvedBrandId)
      .maybeSingle();
    if (b) resolvedBrandName = b.name;
  }

  if (!resolvedBrandId && resolvedBrandName) {
    const { data: existingBrand } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', resolvedBrandName)
      .maybeSingle();

    if (existingBrand) {
      resolvedBrandId = existingBrand.id;
      resolvedBrandName = existingBrand.name;
    } else {
      const { data: newBrand } = await supabaseAdmin
        .from('brands')
        .insert({ tenant_id: tenantId, name: resolvedBrandName.toUpperCase() })
        .select('id, name')
        .single();
      if (newBrand) {
        resolvedBrandId = newBrand.id;
        resolvedBrandName = newBrand.name;
      }
    }
  }

  // Validate seriesId belongs to this brand and tenant if provided
  // DO NOT silently assign an arbitrary active series if missing or ambiguous
  if (resolvedSeriesId && resolvedBrandId) {
    const { data: validSeries } = await supabaseAdmin
      .from('brand_series')
      .select('id')
      .eq('id', resolvedSeriesId)
      .eq('brand_id', resolvedBrandId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    if (!validSeries) {
      resolvedSeriesId = null;
    }
  } else if (!resolvedSeriesId) {
    resolvedSeriesId = null;
  }

  return {
    brand_id: resolvedBrandId,
    series_id: resolvedSeriesId,
    brand: resolvedBrandName,
  };
}

// Helper: resolve dynamic token config from series_token_configs
async function resolveItemTokenConfig(
  tenantId: string,
  seriesId: string | null | undefined,
  packSizeOrUnit: string | null | undefined
): Promise<{ has_token: boolean; token_value: number }> {
  if (!seriesId || !packSizeOrUnit) {
    return { has_token: false, token_value: 0 };
  }

  const { data: configs } = await supabaseAdmin
    .from('series_token_configs')
    .select('unit_name, is_enabled, token_value')
    .eq('series_id', seriesId)
    .eq('tenant_id', tenantId);

  if (!configs || configs.length === 0) {
    return { has_token: false, token_value: 0 };
  }

  const matched = configs.find(c => matchUnitToConfig(packSizeOrUnit, c.unit_name));

  if (matched && matched.is_enabled && Number(matched.token_value) > 0) {
    return { has_token: true, token_value: Number(matched.token_value) };
  }

  return { has_token: false, token_value: 0 };
}

// GET: Fetch items for a tenant / branch with dynamic series token inheritance
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch active series token configs and series names to dynamically enrich live token values
    const [configsRes, seriesRes] = await Promise.all([
      supabaseAdmin
        .from('series_token_configs')
        .select('series_id, unit_name, is_enabled, token_value')
        .eq('tenant_id', tenantId),
      supabaseAdmin
        .from('brand_series')
        .select('id, name')
        .eq('tenant_id', tenantId),
    ]);

    const configs = configsRes.data || [];
    const seriesList = seriesRes.data || [];
    const seriesMap = new Map(seriesList.map(s => [s.id, s.name]));

    // TASK-P11-05: Index token configs by series_id to reduce lookup from O(N * M) to O(N)
    const configsBySeries = new Map<string, typeof configs>();
    for (const c of configs) {
      if (!c.series_id) continue;
      const group = configsBySeries.get(c.series_id);
      if (group) {
        group.push(c);
      } else {
        configsBySeries.set(c.series_id, [c]);
      }
    }

    const enrichedItems = (items || []).map((item) => {
      let hasToken = false;
      let tokenValue = 0;
      const seriesName = item.series_id ? seriesMap.get(item.series_id) : undefined;

      if (item.series_id) {
        const seriesConfigs = configsBySeries.get(item.series_id);
        if (seriesConfigs && seriesConfigs.length > 0) {
          const itemUnit = item.pack_size || item.unit || '';
          const matched = seriesConfigs.find(c => matchUnitToConfig(itemUnit, c.unit_name));

          if (matched && matched.is_enabled && Number(matched.token_value) > 0) {
            hasToken = true;
            tokenValue = Number(matched.token_value);
          }
        }
      }

      return {
        ...item,
        series_name: seriesName,
        has_token: hasToken,
        token_value: tokenValue,
      };
    });

    return NextResponse.json({ success: true, items: enrichedItems });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add a single item OR bulk batch of items
// Single: { tenant_id, code, name, brand, brand_id, series_id, ... }
// Bulk:   { tenant_id, brand, brand_id, series_id, category, unit, ... , items: [{ name, code, shade_code, retail_price, cost_price, stock_qty }] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // ── Helper: resolve sister branches for cross-branch catalog sync ──────────
    const getSisterTenants = async () => {
      const { data: currentTenant } = await supabaseAdmin
        .from('tenants')
        .select('id, owner_name, email')
        .eq('id', tenant_id)
        .single();

      let sisterQuery = supabaseAdmin
        .from('tenants')
        .select('id, name')
        .neq('id', tenant_id)
        .eq('is_active', true);

      if (currentTenant?.email) {
        sisterQuery = sisterQuery.eq('email', currentTenant.email);
      } else if (currentTenant?.owner_name) {
        sisterQuery = sisterQuery.eq('owner_name', currentTenant.owner_name);
      } else {
        return [];
      }
      const { data } = await sisterQuery;
      return data || [];
    };

    // ── Helper: insert one item + sync to sisters ──────────────────────────────
    const insertOneItem = async (payload: {
      code: string; name: string; category: string; brand: string;
      brand_id?: string | null; series_id?: string | null;
      unit: string; pack_size: string; shade_code: string | null;
      cost_price: number; retail_price: number; stock_qty: number;
      min_stock_alert: number; has_token: boolean; token_value: number;
    }, sisterTenants: { id: string; name: string }[]) => {
      const normalizedCode = payload.code.trim().toUpperCase();

      // Uniqueness check
      const { data: existing } = await supabaseAdmin
        .from('items').select('id')
        .eq('tenant_id', tenant_id).eq('code', normalizedCode).maybeSingle();
      if (existing) {
        return { ok: false, code: normalizedCode, error: `Code "${normalizedCode}" already exists` };
      }

      const { data: item, error } = await supabaseAdmin
        .from('items')
        .insert({ tenant_id, ...payload, code: normalizedCode })
        .select().single();
      if (error) return { ok: false, code: normalizedCode, error: error.message };

      // Sister branch sync (stock_qty always 0 on sisters)
      for (const sister of sisterTenants) {
        const { data: sisterExisting } = await supabaseAdmin
          .from('items').select('id')
          .eq('tenant_id', sister.id).eq('code', normalizedCode).maybeSingle();
        if (!sisterExisting) {
          await supabaseAdmin.from('items').insert({
            tenant_id: sister.id, ...payload, code: normalizedCode, stock_qty: 0,
          });
        }
      }
      return { ok: true, code: normalizedCode, item };
    };

    // ── BULK MODE: body.items is an array ──────────────────────────────────────
    if (Array.isArray(body.items) && body.items.length > 0) {
      const {
        brand = '', brand_id = null, series_id = null,
        category = 'General', unit = 'Can', min_stock_alert = 5,
      } = body;

      if (!brand.trim() && !brand_id) {
        return NextResponse.json({ success: false, error: 'Brand is required for bulk entry' }, { status: 400 });
      }

      const resolved = await resolveBrandAndSeries(tenant_id, brand, brand_id, series_id);
      const tokenConfig = await resolveItemTokenConfig(tenant_id, resolved.series_id, unit);

      const sisterTenants = await getSisterTenants();
      const saved: any[] = [];
      const errors: { row: number; code: string; error: string }[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const row = body.items[i];
        if (!row.name?.trim() || !row.code?.trim()) continue; // skip empty rows silently

        const retail = Number(row.retail_price) || 0;
        const cost = Number(row.cost_price) || 0;

        if (cost <= 0) {
          errors.push({ row: i + 1, code: row.code?.trim() || '', error: 'Cost price must be greater than zero' });
          continue;
        }

        const result = await insertOneItem({
          code: row.code.trim(),
          name: row.name.trim(),
          category,
          brand: resolved.brand,
          brand_id: resolved.brand_id,
          series_id: resolved.series_id,
          unit,
          pack_size: unit,
          shade_code: row.shade_code?.trim() || null,
          cost_price: cost,
          retail_price: retail,
          stock_qty: Number(row.stock_qty) || 0,
          min_stock_alert: Number(min_stock_alert) || 5,
          has_token: tokenConfig.has_token,
          token_value: tokenConfig.token_value,
        }, sisterTenants);

        if (result.ok) {
          saved.push(result.item);
        } else {
          errors.push({ row: i + 1, code: result.code ?? '', error: result.error ?? 'Unknown error' });
        }
      }

      return NextResponse.json({ success: true, saved, errors, count: saved.length });
    }

    // ── SINGLE MODE ────────────────────────────────────────────────────────────
    const {
      code, name, category, brand, brand_id, series_id, unit = 'Can',
      cost_price = 0, retail_price = 0, stock_qty = 0,
      min_stock_alert = 5, shade_code, pack_size,
    } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'Name and Item Code are required' }, { status: 400 });
    }
    if (!brand?.trim() && !brand_id) {
      return NextResponse.json({ success: false, error: 'Brand / Manufacturer is required' }, { status: 400 });
    }

    const resolved = await resolveBrandAndSeries(tenant_id, brand, brand_id, series_id);
    const targetUnit = pack_size || unit;
    const tokenConfig = await resolveItemTokenConfig(tenant_id, resolved.series_id, targetUnit);

    const retail = Number(retail_price) || 0;
    const cost = Number(cost_price) || 0;

    if (cost <= 0) {
      return NextResponse.json({ success: false, error: 'Cost price must be greater than zero' }, { status: 400 });
    }

    const sisterTenants = await getSisterTenants();
    const result = await insertOneItem({
      code, name, category: category || 'General', brand: resolved.brand,
      brand_id: resolved.brand_id,
      series_id: resolved.series_id,
      unit, pack_size: targetUnit,
      shade_code: shade_code || null,
      cost_price: cost, retail_price: retail,
      stock_qty: Number(stock_qty) || 0,
      min_stock_alert: Number(min_stock_alert) || 5,
      has_token: tokenConfig.has_token,
      token_value: tokenConfig.token_value,
    }, sisterTenants);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, item: result.item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Update item
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // ── BATCH PRICE UPDATE MODE ───────────────────────────────────────────────
    if (Array.isArray(body.items)) {
      const { tenant_id, items: updates } = body;
      if (!tenant_id || typeof tenant_id !== 'string') {
        return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
      }

      if (updates.length === 0) {
        return NextResponse.json({ success: false, error: 'Items array must not be empty' }, { status: 400 });
      }

      if (updates.length > 250) {
        return NextResponse.json({ success: false, error: 'Batch size exceeds maximum limit of 250 items' }, { status: 400 });
      }

      // Check for duplicate IDs in the submitted batch
      const idSet = new Set<string>();
      for (const u of updates) {
        if (!u.id || typeof u.id !== 'string') {
          return NextResponse.json({ success: false, error: 'Each item in batch must have a valid string id' }, { status: 400 });
        }
        if (idSet.has(u.id)) {
          return NextResponse.json({ success: false, error: `Duplicate item ID "${u.id}" detected in batch` }, { status: 400 });
        }
        idSet.add(u.id);
      }

      // Authenticate calling user against requested tenant
      const auth = await requireTenantAuth(req, tenant_id);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }
      // CEO approval gate: bulk price edit requires the CEO password for staff
      const ceoGateBatch = await requireCeoApproval(req, auth.session);
      if (!ceoGateBatch.ok) return ceoGateBatch.response;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validItemIds = updates.map((u: any) => u.id).filter((id: string) => uuidRegex.test(id));

      // Fetch all valid items belonging to this tenant to verify ownership
      const { data: dbItems, error: fetchErr } = await supabaseAdmin
        .from('items')
        .select('id, code, cost_price, retail_price')
        .eq('tenant_id', tenant_id)
        .in('id', validItemIds);

      if (fetchErr) throw fetchErr;

      const tenantItemMap = new Map((dbItems || []).map(d => [d.id, d]));
      const updated: any[] = [];
      const errors: Array<{
        id: string;
        code?: string;
        error: string;
        failureType?: 'INVALID_FORMAT' | 'UPDATE_DATABASE_ERROR' | 'VERIFICATION_READ_ERROR' | 'DELETED_OR_INACCESSIBLE' | 'STALE_PRICE_CONFLICT' | 'UNRESOLVED_UPDATE_FAILURE';
        conflictedFields?: Array<'cost' | 'retail'>;
        currentPrices?: { cost_price: number; retail_price: number };
      }> = [];

      for (const u of updates) {
        if (!uuidRegex.test(u.id)) {
          errors.push({ id: u.id, error: 'Invalid UUID format for item ID', failureType: 'INVALID_FORMAT' });
          continue;
        }

        const existingDbItem = tenantItemMap.get(u.id);
        if (!existingDbItem) {
          errors.push({ id: u.id, error: 'Item not found in authorized tenant catalog', failureType: 'DELETED_OR_INACCESSIBLE' });
          continue;
        }

        // Validate price fields independently
        const hasCost = u.cost_price !== undefined;
        const hasRetail = u.retail_price !== undefined;

        if (!hasCost && !hasRetail) {
          errors.push({ id: u.id, code: existingDbItem.code, error: 'Update payload must specify at least one price field (cost_price or retail_price)', failureType: 'INVALID_FORMAT' });
          continue;
        }

        const updatePayload: Record<string, number> = {};

        // Cost price validation
        if (hasCost) {
          if (typeof u.cost_price !== 'number' || !Number.isFinite(u.cost_price) || isNaN(u.cost_price)) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Cost price must be a valid finite number', failureType: 'INVALID_FORMAT' });
            continue;
          }
          // Reject more than two decimal places without rounding:
          const costStr = u.cost_price.toString();
          if (costStr.includes('.') && costStr.split('.')[1].length > 2) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Cost price cannot exceed two decimal places', failureType: 'INVALID_FORMAT' });
            continue;
          }
          if (u.cost_price <= 0) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Cost price must be greater than zero', failureType: 'INVALID_FORMAT' });
            continue;
          }
          // Concurrency predicate requirement:
          if (typeof u.expected_cost !== 'number' || !Number.isFinite(u.expected_cost) || u.expected_cost < 0) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Concurrency validation failure: expected_cost is required and must be a non-negative finite number', failureType: 'INVALID_FORMAT' });
            continue;
          }
          updatePayload.cost_price = u.cost_price;
        }

        // Retail price validation
        if (hasRetail) {
          if (typeof u.retail_price !== 'number' || !Number.isFinite(u.retail_price) || isNaN(u.retail_price)) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Retail price must be a valid finite number', failureType: 'INVALID_FORMAT' });
            continue;
          }
          const retailStr = u.retail_price.toString();
          if (retailStr.includes('.') && retailStr.split('.')[1].length > 2) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Retail price cannot exceed two decimal places', failureType: 'INVALID_FORMAT' });
            continue;
          }
          if (u.retail_price < 0) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Retail price cannot be negative', failureType: 'INVALID_FORMAT' });
            continue;
          }
          // Concurrency predicate requirement:
          if (typeof u.expected_retail !== 'number' || !Number.isFinite(u.expected_retail) || u.expected_retail < 0) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Concurrency validation failure: expected_retail is required and must be a non-negative finite number', failureType: 'INVALID_FORMAT' });
            continue;
          }
          updatePayload.retail_price = u.retail_price;
        }

        // Atomic update statement with field-specific concurrency predicates
        let query = supabaseAdmin
          .from('items')
          .update(updatePayload)
          .eq('id', u.id)
          .eq('tenant_id', tenant_id);

        if (hasCost) {
          query = query.eq('cost_price', u.expected_cost);
        }
        if (hasRetail) {
          query = query.eq('retail_price', u.expected_retail);
        }

        const { data: updatedItem, error: updateErr } = await query
          .select('id, code, cost_price, retail_price')
          .maybeSingle();

        if (updateErr) {
          errors.push({ id: u.id, code: existingDbItem.code, error: `Database update failed: ${updateErr.message}`, failureType: 'UPDATE_DATABASE_ERROR' });
          continue;
        }

        if (!updatedItem) {
          // Zero rows updated: perform diagnostic reread
          const { data: currentItem, error: readErr } = await supabaseAdmin
            .from('items')
            .select('id, code, cost_price, retail_price')
            .eq('id', u.id)
            .eq('tenant_id', tenant_id)
            .maybeSingle();

          if (readErr) {
            errors.push({ id: u.id, code: existingDbItem.code, error: `Verification read failed: ${readErr.message}`, failureType: 'VERIFICATION_READ_ERROR' });
            continue;
          }

          if (!currentItem) {
            errors.push({ id: u.id, code: existingDbItem.code, error: 'Product was deleted or is no longer accessible to this store', failureType: 'DELETED_OR_INACCESSIBLE' });
            continue;
          }

          const costConflict = hasCost && Number(currentItem.cost_price) !== u.expected_cost;
          const retailConflict = hasRetail && Number(currentItem.retail_price) !== u.expected_retail;
          const conflictedFields: Array<'cost' | 'retail'> = [];
          if (costConflict) conflictedFields.push('cost');
          if (retailConflict) conflictedFields.push('retail');

          if (conflictedFields.length > 0) {
            errors.push({
              id: u.id,
              code: currentItem.code,
              error: `Concurrent modification: ${conflictedFields.join(' and ')} price was modified by another user`,
              failureType: 'STALE_PRICE_CONFLICT',
              conflictedFields,
              currentPrices: {
                cost_price: Number(currentItem.cost_price),
                retail_price: Number(currentItem.retail_price),
              },
            });
          } else {
            errors.push({
              id: u.id,
              code: currentItem.code,
              error: 'Database update did not affect any rows, but current prices match expected values. Please retry.',
              failureType: 'UNRESOLVED_UPDATE_FAILURE',
            });
          }
        } else {
          updated.push({
            id: updatedItem.id,
            code: updatedItem.code,
            cost_price: hasCost ? Number(updatedItem.cost_price) : undefined,
            retail_price: hasRetail ? Number(updatedItem.retail_price) : undefined,
          });
        }
      }

      return NextResponse.json({ success: true, updated, errors, count: updated.length });
    }

    // ── SINGLE ITEM UPDATE MODE ───────────────────────────────────────────────
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    // AUTH-002: Fetch existing item first to derive true tenant ownership from database
    const { data: existingItem, error: existingErr } = await supabaseAdmin
      .from('items')
      .select('id, tenant_id, series_id, pack_size, unit, brand_id')
      .eq('id', id)
      .maybeSingle();

    if (existingErr || !existingItem) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    const targetTenantId = existingItem.tenant_id;
    const auth = await requireTenantAuth(req, targetTenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    // CEO approval gate: editing a product requires the CEO password for staff
    const ceoGateSingle = await requireCeoApproval(req, auth.session);
    if (!ceoGateSingle.ok) return ceoGateSingle.response;

    // Strip tenant_id from update payload to prevent cross-tenant hijacking or reassignment
    delete (updateFields as any).tenant_id;

    if (updateFields.code && targetTenantId) {
      const normalizedCode = updateFields.code.trim().toUpperCase();
      const { data: existingCodeItem } = await supabaseAdmin
        .from('items')
        .select('id')
        .eq('tenant_id', targetTenantId)
        .eq('code', normalizedCode)
        .neq('id', id)
        .maybeSingle();

      if (existingCodeItem) {
        return NextResponse.json(
          { success: false, error: 'A product with this code already exists.' },
          { status: 400 }
        );
      }
      updateFields.code = normalizedCode;
    }

    // Always enforce that token values come EXCLUSIVELY from Series + Unit configuration.
    // Product-level token value override is strictly prohibited.
    if (
      updateFields.series_id !== undefined ||
      updateFields.pack_size !== undefined ||
      updateFields.unit !== undefined ||
      updateFields.has_token !== undefined ||
      updateFields.token_value !== undefined
    ) {
      let effectiveSeriesId = updateFields.series_id !== undefined ? updateFields.series_id : existingItem.series_id;
      const effectiveBrandId = updateFields.brand_id !== undefined ? updateFields.brand_id : existingItem.brand_id;
      const effectiveUnit = updateFields.pack_size || updateFields.unit || existingItem.pack_size || existingItem.unit;

      // Validate series belongs to brand if both present
      if (effectiveSeriesId && effectiveBrandId) {
        const { data: validSeries } = await supabaseAdmin
          .from('brand_series')
          .select('id')
          .eq('id', effectiveSeriesId)
          .eq('brand_id', effectiveBrandId)
          .eq('tenant_id', targetTenantId)
          .eq('status', 'active')
          .maybeSingle();

        if (!validSeries) {
          effectiveSeriesId = null;
          updateFields.series_id = null;
        }
      }

      if (effectiveSeriesId) {
        const tokenConfig = await resolveItemTokenConfig(targetTenantId, effectiveSeriesId, effectiveUnit);
        updateFields.has_token = tokenConfig.has_token;
        updateFields.token_value = tokenConfig.token_value;
      } else {
        updateFields.has_token = false;
        updateFields.token_value = 0;
      }
    }

    const { data: item, error } = await supabaseAdmin
      .from('items')
      .update(updateFields)
      .eq('id', id)
      .eq('tenant_id', targetTenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove item
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID required' }, { status: 400 });
    }

    const { data: existingItem, error: fetchErr } = await supabaseAdmin
      .from('items')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingItem) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    const auth = await requireTenantAuth(req, existingItem.tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { error } = await supabaseAdmin
      .from('items')
      .delete()
      .eq('id', id)
      .eq('tenant_id', existingItem.tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
