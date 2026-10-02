import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch token transactions
// ?tenant_id=&shift_id=                   → shift token transactions
// ?tenant_id=&client_id=                  → client token activity
// ?tenant_id=&type=redeemed (or transaction_type=redeemed) → token payouts
// ?tenant_id=&usage_status=available      → stockpile tokens available in shop safe
// ?tenant_id=&usage_status=settled        → surrendered tokens
// ?tenant_id=&usage_status=written_off    → discarded/damaged tokens
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');
    const clientId = searchParams.get('client_id');
    const itemId = searchParams.get('item_id');
    const summary = searchParams.get('summary');
    const typeParam = searchParams.get('type') || searchParams.get('transaction_type');
    const usageStatus = searchParams.get('usage_status');
    const brand = searchParams.get('brand');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Deprecated summary mode compatibility
    if (summary === 'redeemable') {
      return NextResponse.json({
        success: true,
        item_id: itemId,
        issued_total: 0,
        redeemed_total: 0,
        redeemable_balance: 0,
      });
    }

    // Standard Query Mode on token_transactions
    const buildQuery = (includeVouchers: boolean) => {
      const selectFields = includeVouchers
        ? '*, purchases:used_against_purchase_id(id, purchase_no, supplier_name, date), vouchers:used_against_voucher_id(id, voucher_no, party_name, date)'
        : '*, purchases:used_against_purchase_id(id, purchase_no, supplier_name, date)';

      let q = supabaseAdmin
        .from('token_transactions')
        .select(selectFields)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (shiftId) {
        q = q.eq('shift_id', shiftId);
      }
      if (clientId) {
        q = q.eq('client_id', clientId);
      }
      if (typeParam) {
        q = q.eq('type', typeParam);
      }
      if (usageStatus) {
        q = q.eq('usage_status', usageStatus);
      }
      if (brand) {
        q = q.ilike('brand_name', `%${brand}%`);
      }
      if (startDate) {
        q = q.gte('created_at', startDate);
      }
      if (endDate) {
        q = q.lte('created_at', endDate);
      }
      return q;
    };

    let { data: transactions, error } = await buildQuery(true);
    if (error && (error.message?.includes('vouchers') || error.message?.includes('used_against_voucher_id'))) {
      const fallback = await buildQuery(false);
      transactions = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;

    return NextResponse.json({ success: true, transactions: transactions || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Manage token stockpile operations (opening_stock, shop_retained, write_off, settle_vendor)
// NOTE: Multi-line customer redemptions must use POST /api/token-redemptions (redeem_tokens_atomic)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type: rawType,
      transaction_type,
      tenant_id,
      invoice_id,
      client_id,
      client_name,
      brand_id,
      brand_name,
      brand,
      series_id,
      series_name,
      unit_name,
      token_value,
      token_count,
      quantity,
      unit_token_value,
      shift_id,
      notes,
      token_id,
      token_allocations,
      settlement_type,
      claim_reference,
      supplier_id,
      supplier_name,
      write_off_reason,
    } = body;

    const type = rawType || transaction_type;

    if (!tenant_id || !type) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and transaction type are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Customer redemption using virtual token balance is completely removed/deprecated
    if (type === 'redeemed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Legacy virtual-balance redemption is deprecated. Use POST /api/token-redemptions (redeem_tokens_atomic).',
        },
        { status: 400 }
      );
    }

    // --- 1. ISSUED (Customer earned token with purchase - activity log only, NO virtual balance) ---
    if (type === 'issued') {
      const parsedCount = Math.max(1, Number(token_count || quantity) || 1);
      const parsedTokenValue = Number(token_value) || 0;
      const totalAmount = parsedTokenValue * parsedCount;

      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          type: 'issued',
          invoice_id: invoice_id || null,
          client_id: client_id || null,
          client_name: client_name || null,
          brand_id: brand_id || null,
          brand_name: brand_name || brand || 'General',
          series_id: series_id || null,
          series_name: series_name || 'Standard',
          unit_name: unit_name || 'Can',
          token_value: parsedTokenValue,
          quantity: parsedCount,
          remaining_quantity: 0,
          total_amount: totalAmount,
          usage_status: 'n_a',
          shift_id: shift_id || null,
          notes: notes || 'Customer kept physical token with purchase',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({ success: true, transaction: txn });
    }

    // --- 2. SHOP_RETAINED (Customer left token at store during checkout) ---
    if (type === 'shop_retained') {
      const parsedCount = Math.max(1, Number(token_count || quantity) || 1);
      const parsedTokenValue = Number(token_value) || 0;
      const totalAmount = parsedTokenValue * parsedCount;

      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          type: 'shop_retained',
          invoice_id: invoice_id || null,
          client_id: client_id || null,
          client_name: client_name || null,
          brand_id: brand_id || null,
          brand_name: brand_name || brand || 'General',
          series_id: series_id || null,
          series_name: series_name || 'Standard',
          unit_name: unit_name || 'Can',
          token_value: parsedTokenValue,
          quantity: parsedCount,
          remaining_quantity: parsedCount,
          total_amount: totalAmount,
          usage_status: 'available',
          shift_id: shift_id || null,
          notes: notes || 'Shop retained token at sale',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({ success: true, transaction: txn });
    }

    // --- 3. OPENING_STOCK (Initial drawer/safe physical count on ERP setup) ---
    if (type === 'opening_stock') {
      // Require canonical 4-part identity fields
      if (!brand_name && !brand_id) {
        return NextResponse.json({ success: false, error: 'brand_name is required for opening_stock' }, { status: 400 });
      }
      if (!series_id || !series_name) {
        return NextResponse.json({ success: false, error: 'series_id and series_name are required for opening_stock' }, { status: 400 });
      }
      if (!unit_name) {
        return NextResponse.json({ success: false, error: 'unit_name is required for opening_stock' }, { status: 400 });
      }

      // Server-side: resolve authoritative token_value from series_token_configs
      const { data: configRow, error: configErr } = await supabaseAdmin
        .from('series_token_configs')
        .select('token_value, is_enabled')
        .eq('tenant_id', tenant_id)
        .eq('series_id', series_id)
        .ilike('unit_name', unit_name)
        .maybeSingle();

      if (configErr) throw configErr;
      if (!configRow) {
        return NextResponse.json(
          { success: false, error: `No token configuration found for series "${series_name}" unit "${unit_name}"` },
          { status: 400 }
        );
      }
      if (!configRow.is_enabled) {
        return NextResponse.json(
          { success: false, error: `Token configuration for "${series_name} ${unit_name}" is disabled` },
          { status: 400 }
        );
      }

      const authoritativeTokenValue = Number(configRow.token_value);
      if (authoritativeTokenValue <= 0) {
        return NextResponse.json(
          { success: false, error: 'Token value in configuration must be greater than 0' },
          { status: 400 }
        );
      }

      // Validate Series belongs to tenant and the specified Brand
      const { data: seriesRow, error: seriesErr } = await supabaseAdmin
        .from('brand_series')
        .select('id, brand_id')
        .eq('id', series_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (seriesErr) throw seriesErr;
      if (!seriesRow) {
        return NextResponse.json({ success: false, error: 'Series not found for this tenant' }, { status: 400 });
      }
      if (brand_id && seriesRow.brand_id !== brand_id) {
        return NextResponse.json({ success: false, error: 'Series does not belong to the specified Brand' }, { status: 400 });
      }

      const parsedCount = Math.max(1, Number(quantity) || 1);
      const totalAmount = parsedCount * authoritativeTokenValue;

      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          type: 'opening_stock',
          invoice_id: null,
          client_id: null,
          client_name: null,
          brand_id: brand_id || null,
          brand_name: brand_name || 'General',
          series_id: series_id,
          series_name: series_name,
          unit_name: unit_name,
          token_value: authoritativeTokenValue,
          quantity: parsedCount,
          remaining_quantity: parsedCount,
          total_amount: totalAmount,
          usage_status: 'available',
          shift_id: shift_id || null,
          notes: notes || 'Opening physical stockpile balance',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({ success: true, transaction: txn });
    }

    // --- 4. WRITE_OFF (Discard damaged, scratched, or rejected tokens) ---
    if (type === 'write_off') {
      const targetId = token_id || body.id;
      if (!targetId) {
        return NextResponse.json({ success: false, error: 'token_id is required for write_off' }, { status: 400 });
      }

      // Validate reason is from allowed set
      const ALLOWED_REASONS = ['Damaged', 'Lost', 'Invalid', 'Other'];
      const reason = write_off_reason || 'Damaged';
      if (!ALLOWED_REASONS.includes(reason)) {
        return NextResponse.json(
          { success: false, error: `write_off_reason must be one of: ${ALLOWED_REASONS.join(', ')}` },
          { status: 400 }
        );
      }
      // 'Other' requires a custom note
      const writeOffNote = notes?.trim() || '';
      if (reason === 'Other' && !writeOffNote) {
        return NextResponse.json(
          { success: false, error: 'A custom note is required when write_off_reason is "Other"' },
          { status: 400 }
        );
      }

      const { data: targetTxn, error: fetchErr } = await supabaseAdmin
        .from('token_transactions')
        .select('*')
        .eq('id', targetId)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!targetTxn) {
        return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
      }

      // Block if already settled or written off
      if (targetTxn.usage_status === 'settled' || targetTxn.usage_status === 'written_off') {
        return NextResponse.json(
          { success: false, error: 'Cannot write off a token that has already been settled or written off' },
          { status: 400 }
        );
      }
      // Block if already applied to a purchase or voucher (C2 fix)
      if (targetTxn.used_against_purchase_id || targetTxn.used_against_voucher_id) {
        return NextResponse.json(
          { success: false, error: 'Cannot write off a token that has already been applied to a purchase or voucher' },
          { status: 400 }
        );
      }

      const availableQty = Number(targetTxn.remaining_quantity ?? targetTxn.quantity ?? 1);
      const writeOffQty = body.write_off_quantity
        ? Math.min(availableQty, Math.max(1, Number(body.write_off_quantity) || 1))
        : availableQty; // Default: full write-off

      const unitVal = Number(targetTxn.token_value) || 0;
      const fullReasonLabel = reason === 'Other' ? `Other: ${writeOffNote}` : reason;

      if (writeOffQty >= availableQty) {
        // Full write-off
        const { data: updatedTxn, error: updateErr } = await supabaseAdmin
          .from('token_transactions')
          .update({
            usage_status: 'written_off',
            write_off_reason: fullReasonLabel,
            remaining_quantity: 0,
            total_amount: 0,
            notes: targetTxn.notes
              ? `${targetTxn.notes} | Written off (full): ${fullReasonLabel}`
              : `Written off (full): ${fullReasonLabel}`,
          })
          .eq('id', targetId)
          .select()
          .single();

        if (updateErr) throw updateErr;
        return NextResponse.json({ success: true, transaction: updatedTxn, write_off_qty: writeOffQty });
      } else {
        // Partial write-off: decrement remaining_quantity on parent, create a written-off child row
        const newRemaining = availableQty - writeOffQty;
        await supabaseAdmin
          .from('token_transactions')
          .update({
            remaining_quantity: newRemaining,
            total_amount: newRemaining * unitVal,
          })
          .eq('id', targetId);

        const { data: childTxn, error: childErr } = await supabaseAdmin
          .from('token_transactions')
          .insert({
            tenant_id,
            type: targetTxn.type,
            invoice_id: targetTxn.invoice_id,
            redemption_id: targetTxn.redemption_id,
            client_id: targetTxn.client_id,
            client_name: targetTxn.client_name,
            brand_id: targetTxn.brand_id,
            brand_name: targetTxn.brand_name,
            series_id: targetTxn.series_id,
            series_name: targetTxn.series_name,
            unit_name: targetTxn.unit_name,
            token_value: unitVal,
            quantity: writeOffQty,
            remaining_quantity: 0,
            total_amount: 0,
            parent_transaction_id: targetTxn.id,
            usage_status: 'written_off',
            write_off_reason: fullReasonLabel,
            notes: `Partial write-off from #${targetTxn.id.slice(0, 8)}: ${fullReasonLabel}`,
          })
          .select()
          .single();

        if (childErr) throw childErr;
        return NextResponse.json({ success: true, transaction: childTxn, write_off_qty: writeOffQty, remaining_qty: newRemaining });
      }
    }

    // --- 5. SETTLE_VENDOR (Direct token surrender to company rep for Cash or Credit Slip) ---
    if (type === 'settle_vendor') {
      const allocations: Array<{ id: string; count: number }> = token_allocations || (token_id ? [{ id: token_id, count: Number(token_count || quantity) || 1 }] : []);
      if (!allocations.length) {
        return NextResponse.json({ success: false, error: 'No token allocations provided for settlement' }, { status: 400 });
      }

      const settlementMode = settlement_type || 'vendor_rep_cash';
      const refCode = claim_reference || `REP-${Date.now().toString().slice(-6)}`;
      let totalSettledValue = 0;
      let totalTokensCount = 0;

      for (const alloc of allocations) {
        const { data: parent, error: pErr } = await supabaseAdmin
          .from('token_transactions')
          .select('*')
          .eq('id', alloc.id)
          .eq('tenant_id', tenant_id)
          .maybeSingle();

        if (pErr || !parent) continue;

        const availableCount = Number(parent.remaining_quantity ?? parent.quantity ?? 1);
        const surrenderQty = Math.min(availableCount, Math.max(1, Number(alloc.count) || 1));
        const unitVal = Number(parent.token_value) || (Number(parent.total_amount) / (availableCount || 1));
        const surrenderVal = surrenderQty * unitVal;

        totalSettledValue += surrenderVal;
        totalTokensCount += surrenderQty;

        if (surrenderQty >= availableCount) {
          // Full surrender of this row
          await supabaseAdmin
            .from('token_transactions')
            .update({
              usage_status: 'settled',
              remaining_quantity: 0,
              settled_vendor_name: supplier_name || 'Vendor / Paint Company',
              notes: parent.notes ? `${parent.notes} | Settled: ${refCode}` : `Settled with rep: ${refCode}`,
            })
            .eq('id', alloc.id);
        } else {
          // Partial surrender: decrement parent, insert child row for the surrendered count
          const newRemaining = availableCount - surrenderQty;
          await supabaseAdmin
            .from('token_transactions')
            .update({
              remaining_quantity: newRemaining,
              total_amount: newRemaining * unitVal,
            })
            .eq('id', alloc.id);

          await supabaseAdmin
            .from('token_transactions')
            .insert({
              tenant_id,
              type: parent.type,
              invoice_id: parent.invoice_id,
              redemption_id: parent.redemption_id,
              client_id: parent.client_id,
              client_name: parent.client_name,
              brand_id: parent.brand_id,
              brand_name: parent.brand_name,
              series_id: parent.series_id,
              series_name: parent.series_name,
              unit_name: parent.unit_name,
              token_value: unitVal,
              quantity: surrenderQty,
              remaining_quantity: 0,
              total_amount: surrenderVal,
              parent_transaction_id: parent.id,
              usage_status: 'settled',
              settled_vendor_name: supplier_name || 'Vendor / Paint Company',
              notes: `Partial surrender from #${parent.id.slice(0, 8)}: ${refCode}`,
            });
        }
      }

      // If settled for Supplier Credit Slip and supplier_id is provided, create a payment voucher
      if (settlementMode === 'vendor_rep_credit' && supplier_id) {
        try {
          const voucherNo = `VTK-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
          await supabaseAdmin
            .from('vouchers')
            .insert({
              tenant_id,
              voucher_no: voucherNo,
              voucher_type: 'payment',
              party_type: 'supplier',
              party_id: supplier_id,
              party_name: supplier_name || 'Vendor / Paint Company',
              amount: totalSettledValue,
              payment_method: 'tokens',
              reference_no: refCode,
              date: new Date().toISOString().split('T')[0],
              remarks: `Token Surrender to Rep (${totalTokensCount} tokens: Ref ${refCode})`,
            });
        } catch (vErr) {
          console.error('Error auto-creating credit voucher for token surrender:', vErr);
        }
      }

      return NextResponse.json({
        success: true,
        settled_value: totalSettledValue,
        settled_tokens: totalTokensCount,
        claim_reference: refCode,
        settlement_type: settlementMode,
      });
    }

    return NextResponse.json({ success: false, error: `Unhandled transaction type "${type}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
