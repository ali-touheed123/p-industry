import { supabaseAdmin } from '@/lib/supabase';

/**
 * POS rate lock (server side).
 * A sale line's unit price must equal the item's current retail price. The only other
 * accepted values are:
 *   - retail price minus the item's token value (cart "remove token" action), and
 *   - on invoice edit, the unit price that line already had on the saved invoice
 *     (so older invoices stay editable even if the catalog price changed since).
 * Return invoices are exempt: a return refunds what the customer originally paid.
 */
const TOLERANCE = 0.011;

interface LockLine {
  item_id?: string | null;
  item?: { id?: string | null } | null;
  item_code?: string | null;
  code?: string | null;
  item_name?: string | null;
  productName?: string | null;
  name?: string | null;
  unit_price?: number | string | null;
  rate?: number | string | null;
  price?: number | string | null;
}

export interface ExistingInvoiceLine {
  item_id?: string | null;
  item_code?: string | null;
  unit_price: number | string | null;
}

export function isRateLockedInvoiceType(invoiceType?: string | null): boolean {
  const t = String(invoiceType || 'sales').toLowerCase();
  return t !== 'return' && t !== 'purchase_return' && t !== 'sales_return';
}

export async function validateLockedRates(
  tenantId: string,
  lines: LockLine[],
  invoiceType?: string | null,
  existingLines: ExistingInvoiceLine[] = []
): Promise<string | null> {
  if (!isRateLockedInvoiceType(invoiceType)) return null;
  if (!Array.isArray(lines) || lines.length === 0) return null;

  const ids = Array.from(
    new Set(lines.map((l) => l.item_id || l.item?.id).filter((v): v is string => Boolean(v)))
  );
  const codes = Array.from(
    new Set(
      lines
        .filter((l) => !(l.item_id || l.item?.id))
        .map((l) => String(l.item_code || l.code || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const byId = new Map<string, { retail_price: number; token_value: number; name: string }>();
  const byCode = new Map<string, { retail_price: number; token_value: number; name: string }>();

  if (ids.length > 0) {
    const { data } = await supabaseAdmin
      .from('items')
      .select('id, code, name, retail_price, token_value')
      .eq('tenant_id', tenantId)
      .in('id', ids);
    (data || []).forEach((r: any) => {
      byId.set(r.id, {
        retail_price: Number(r.retail_price) || 0,
        token_value: Number(r.token_value) || 0,
        name: r.name,
      });
    });
  }
  if (codes.length > 0) {
    const { data } = await supabaseAdmin
      .from('items')
      .select('id, code, name, retail_price, token_value')
      .eq('tenant_id', tenantId)
      .in('code', codes);
    (data || []).forEach((r: any) => {
      byCode.set(String(r.code).toUpperCase(), {
        retail_price: Number(r.retail_price) || 0,
        token_value: Number(r.token_value) || 0,
        name: r.name,
      });
    });
  }

  for (const line of lines) {
    const lineId = line.item_id || line.item?.id || null;
    const lineCode = String(line.item_code || line.code || '').trim().toUpperCase();
    const catalog = (lineId && byId.get(lineId)) || (lineCode && byCode.get(lineCode)) || null;
    if (!catalog) continue; // unknown items are rejected by the atomic RPCs themselves

    const price = Number(line.unit_price ?? line.rate ?? line.price ?? 0);
    const allowed: number[] = [catalog.retail_price];
    if (catalog.token_value > 0) allowed.push(Math.max(0, catalog.retail_price - catalog.token_value));

    existingLines.forEach((e) => {
      const sameItem =
        (lineId && e.item_id && e.item_id === lineId) ||
        (lineCode && e.item_code && String(e.item_code).trim().toUpperCase() === lineCode);
      if (sameItem) allowed.push(Number(e.unit_price) || 0);
    });

    if (!allowed.some((a) => Math.abs(a - price) <= TOLERANCE)) {
      const label = catalog.name || line.item_name || line.productName || line.name || 'Product';
      return `Rate locked: "${label}" ka rate Rs. ${price.toLocaleString()} allowed nahi. Current rate Rs. ${catalog.retail_price.toLocaleString()} hai (rate sirf CEO Edit Product / Bulk Edit Prices se badal sakta hai).`;
    }
  }
  return null;
}
