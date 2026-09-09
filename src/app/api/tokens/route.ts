import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch token transactions or redeemable summary
// ?tenant_id=&item_id=&summary=redeemable  → redeemable balance for item
// ?tenant_id=&shift_id=                   → shift token summary
// ?tenant_id=&client_id=                  → client token balance history
// ?tenant_id=&transaction_type=redeemed   → token payouts for sales history
// ?tenant_id=&usage_status=available      → shop retained & opening tokens available for purchase offset
// ?tenant_id=&usage_status=used           → shop retained tokens used against purchases/settlements
// ?tenant_id=&usage_status=written_off    → discarded/damaged tokens
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const shiftId = searchParams.get('shift_id');
    const clientId = searchParams.get('client_id');
    const itemId = searchParams.get('item_id');
    const summary = searchParams.get('summary');
    const transactionType = searchParams.get('transaction_type');
    const usageStatus = searchParams.get('usage_status');
    const brand = searchParams.get('brand');
    const isExternal = searchParams.get('is_external');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // --- Summary Mode: Item Redeemable Balance ---
    if (summary === 'redeemable' && itemId) {
      const { data: issuedTxns, error: issuedErr } = await supabaseAdmin
        .from('token_transactions')
        .select('token_value')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .eq('transaction_type', 'issued');

      if (issuedErr) throw issuedErr;

      const { data: redeemedTxns, error: redeemedErr } = await supabaseAdmin
        .from('token_transactions')
        .select('redeemed_amount')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .eq('transaction_type', 'redeemed');

      if (redeemedErr) throw redeemedErr;

      const issuedTotal = (issuedTxns || []).reduce((sum, t) => sum + (Number(t.token_value) || 0), 0);
      const redeemedTotal = (redeemedTxns || []).reduce((sum, t) => sum + (Number(t.redeemed_amount) || 0), 0);
      const redeemableBalance = Math.max(0, issuedTotal - redeemedTotal);

      return NextResponse.json({
        success: true,
        item_id: itemId,
        issued_total: issuedTotal,
        redeemed_total: redeemedTotal,
        redeemable_balance: redeemableBalance,
      });
    }

    // --- Standard Query Mode ---
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
      if (itemId) {
        q = q.eq('item_id', itemId);
      }
      if (transactionType) {
        q = q.eq('transaction_type', transactionType);
      }
      if (usageStatus) {
        if (usageStatus === 'available') {
          q = q.or('usage_status.eq.available,and(usage_status.is.null,transaction_type.in.(shop_retained,redeemed,opening_stock))');
        } else {
          q = q.eq('usage_status', usageStatus);
        }
      }
      if (brand) {
        q = q.ilike('brand', `%${brand}%`);
      }
      if (isExternal !== null && isExternal !== undefined) {
        q = q.eq('is_external', isExternal === 'true');
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

// POST: Create or manage a token transaction
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      tenant_id,
      invoice_id,
      client_id,
      client_name,
      item_id,
      item_name,
      brand,
      category,
      token_value,
      token_count,
      unit_token_value,
      remaining_count,
      allow_external,
      is_external,
      redeemed_amount,
      shift_id,
      notes,
      // Vendor settlement & write-off fields
      token_id,
      token_allocations,
      settlement_type,
      claim_reference,
      supplier_id,
      supplier_name,
      write_off_reason,
    } = body;

    if (!tenant_id || !type) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and transaction type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['issued', 'redeemed', 'shop_retained', 'opening_stock', 'write_off', 'settle_vendor'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // --- 1. ISSUED (Customer earned token with purchase) ---
    if (type === 'issued') {
      if (!item_id || !token_value) {
        return NextResponse.json(
          { success: false, error: 'item_id and token_value are required for issued transactions' },
          { status: 400 }
        );
      }

      const parsedCount = Math.max(1, Number(token_count) || 1);
      const parsedTokenValue = Number(token_value) || 0;
      const parsedUnitValue = Number(unit_token_value) || (parsedTokenValue / parsedCount);

      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          transaction_type: 'issued',
          invoice_id: invoice_id || null,
          client_id: client_id || null,
          client_name: client_name || null,
          item_id: item_id || null,
          item_name: item_name || null,
          brand: brand || null,
          category: category || null,
          token_value: parsedTokenValue,
          token_count: parsedCount,
          unit_token_value: parsedUnitValue,
          remaining_count: parsedCount,
          redeemed_amount: 0,
          remaining_balance: parsedTokenValue,
          shift_id: shift_id || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      // Increase client token_balance if registered customer
      if (client_id && parsedTokenValue > 0) {
        const { data: clientRecord } = await supabaseAdmin
          .from('clients')
          .select('token_balance')
          .eq('id', client_id)
          .maybeSingle();

        if (clientRecord) {
          const newBalance = Number(clientRecord.token_balance || 0) + parsedTokenValue;
          await supabaseAdmin
            .from('clients')
            .update({ token_balance: newBalance })
            .eq('id', client_id);
        }
      }

      return NextResponse.json({ success: true, transaction: txn });
    }

    // --- 2. SHOP_RETAINED (Customer left token at store during checkout) ---
    if (type === 'shop_retained') {
      if (!token_value) {
        return NextResponse.json(
          { success: false, error: 'token_value is required for shop_retained transactions' },
          { status: 400 }
        );
      }

      const parsedCount = Math.max(1, Number(token_count) || 1);
      const parsedTokenValue = Number(token_value) || 0;
      const parsedUnitValue = Number(unit_token_value) || (parsedTokenValue / parsedCount);

      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          transaction_type: 'shop_retained',
          invoice_id: invoice_id || null,
          client_id: null,
          client_name: null,
          item_id: item_id || null,
          item_name: item_name || null,
          brand: brand || null,
          category: category || null,
          token_value: parsedTokenValue,
          token_count: parsedCount,
          unit_token_value: parsedUnitValue,
          remaining_count: parsedCount,
          redeemed_amount: 0,
          remaining_balance: 0,
          shift_id: shift_id || null,
          notes: notes || null,
          usage_status: 'available',
          claim_status: 'pending',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({ success: true, transaction: txn });
    }

    // --- 3. OPENING_STOCK (Initial drawer/safe physical count on ERP setup) ---
    if (type === 'opening_stock') {
      const parsedCount = Math.max(1, Number(token_count) || 1);
      const parsedUnitVal = Number(unit_token_value) || 0;
      const parsedTotalVal = Number(token_value) || (parsedCount * parsedUnitVal);

      if (parsedTotalVal <= 0) {
        return NextResponse.json(
          { success: false, error: 'Total token value must be greater than 0' },
          { status: 400 }
        );
      }

      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          transaction_type: 'opening_stock',
          invoice_id: null,
          client_id: null,
          client_name: null,
          item_id: item_id || null,
          item_name: item_name || `${brand || 'Paint'} Token (${parsedCount}x Rs. ${parsedUnitVal})`,
          brand: brand || 'General',
          category: category || 'Paint Tokens',
          token_value: parsedTotalVal,
          token_count: parsedCount,
          unit_token_value: parsedUnitVal,
          remaining_count: parsedCount,
          redeemed_amount: 0,
          remaining_balance: 0,
          shift_id: shift_id || null,
          notes: notes || 'Opening physical stockpile balance',
          usage_status: 'available',
          claim_status: 'pending',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({ success: true, transaction: txn });
    }

    // --- 4. REDEEMED (Customer or painter cashing in tokens) ---
    if (type === 'redeemed') {
      const parsedAmount = Number(redeemed_amount) || 0;
      if (parsedAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'redeemed_amount must be greater than 0' },
          { status: 400 }
        );
      }

      const isLooseExternal = Boolean(allow_external || is_external);

      // If item_id is specified AND NOT marked loose/external, enforce server-side balance cap
      if (item_id && !isLooseExternal) {
        const { data: issuedTxns, error: issuedErr } = await supabaseAdmin
          .from('token_transactions')
          .select('token_value')
          .eq('tenant_id', tenant_id)
          .eq('item_id', item_id)
          .eq('transaction_type', 'issued');

        if (issuedErr) throw issuedErr;

        const { data: redeemedTxns, error: redeemedErr } = await supabaseAdmin
          .from('token_transactions')
          .select('redeemed_amount')
          .eq('tenant_id', tenant_id)
          .eq('item_id', item_id)
          .eq('transaction_type', 'redeemed');

        if (redeemedErr) throw redeemedErr;

        const issuedTotal = (issuedTxns || []).reduce((sum, t) => sum + (Number(t.token_value) || 0), 0);
        const redeemedTotal = (redeemedTxns || []).reduce((sum, t) => sum + (Number(t.redeemed_amount) || 0), 0);
        const itemRedeemableBalance = Math.max(0, issuedTotal - redeemedTotal);

        if (parsedAmount > itemRedeemableBalance) {
          return NextResponse.json(
            {
              success: false,
              error: `Redemption amount (Rs. ${parsedAmount.toLocaleString()}) exceeds available redeemable tokens for this item (Rs. ${itemRedeemableBalance.toLocaleString()}). Check "Accept Loose / External Token" to bypass this for older or non-system tokens.`,
            },
            { status: 400 }
          );
        }
      }

      let remainingBalance = 0;

      // For registered customers, validate and deduct token_balance
      if (client_id) {
        const { data: clientRecord } = await supabaseAdmin
          .from('clients')
          .select('token_balance')
          .eq('id', client_id)
          .maybeSingle();

        if (!clientRecord) {
          return NextResponse.json(
            { success: false, error: 'Client not found' },
            { status: 404 }
          );
        }

        const currentBalance = Number(clientRecord.token_balance || 0);
        if (parsedAmount > currentBalance) {
          return NextResponse.json(
            {
              success: false,
              error: `Redemption amount (Rs. ${parsedAmount.toLocaleString()}) exceeds client token balance (Rs. ${currentBalance.toLocaleString()})`,
            },
            { status: 400 }
          );
        }

        remainingBalance = currentBalance - parsedAmount;

        // Deduct from client's token balance
        await supabaseAdmin
          .from('clients')
          .update({ token_balance: remainingBalance })
          .eq('id', client_id);
      }

      const parsedCount = Math.max(1, Number(token_count) || 1);
      const parsedUnitVal = Number(unit_token_value) || (parsedAmount / parsedCount);

      // Insert token transaction record with usage_status = 'available' (now in shop's safe)
      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          transaction_type: 'redeemed',
          invoice_id: invoice_id || null,
          client_id: client_id || null,
          client_name: client_name || null,
          item_id: item_id || null,
          item_name: item_name || null,
          brand: brand || null,
          category: category || null,
          token_value: parsedAmount,
          token_count: parsedCount,
          unit_token_value: parsedUnitVal,
          remaining_count: parsedCount,
          redeemed_amount: parsedAmount,
          remaining_balance: remainingBalance,
          shift_id: shift_id || null,
          is_external: isLooseExternal,
          notes: notes || (isLooseExternal ? 'Loose / External Token Intake' : null),
          usage_status: 'available',
          claim_status: 'pending',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({
        success: true,
        transaction: txn,
        remaining_balance: remainingBalance,
      });
    }

    // --- 5. WRITE_OFF (Discard damaged, scratched, or campaign-expired tokens) ---
    if (type === 'write_off') {
      const targetId = token_id || body.id;
      if (!targetId) {
        return NextResponse.json({ success: false, error: 'token_id is required for write_off' }, { status: 400 });
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

      if (targetTxn.usage_status === 'used') {
        return NextResponse.json({ success: false, error: 'Cannot write off a token that has already been surrendered or used' }, { status: 400 });
      }

      const reason = write_off_reason || notes || 'Damaged / Rejected Token';

      const { data: updatedTxn, error: updateErr } = await supabaseAdmin
        .from('token_transactions')
        .update({
          usage_status: 'written_off',
          write_off_reason: reason,
          remaining_count: 0,
          notes: targetTxn.notes ? `${targetTxn.notes} | Written off: ${reason}` : `Written off: ${reason}`,
        })
        .eq('id', targetId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true, transaction: updatedTxn });
    }

    // --- 6. SETTLE_VENDOR (Direct token surrender to company rep for Cash or Credit Slip) ---
    if (type === 'settle_vendor') {
      const allocations: Array<{ id: string; count: number }> = token_allocations || (token_id ? [{ id: token_id, count: Number(token_count) || 1 }] : []);
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

        const availableCount = Number(parent.remaining_count) || Number(parent.token_count) || 1;
        const surrenderQty = Math.min(availableCount, Math.max(1, Number(alloc.count) || 1));
        const unitVal = Number(parent.unit_token_value) || (Number(parent.token_value) / availableCount);
        const surrenderVal = surrenderQty * unitVal;

        totalSettledValue += surrenderVal;
        totalTokensCount += surrenderQty;

        if (surrenderQty >= availableCount) {
          // Full surrender of this row
          await supabaseAdmin
            .from('token_transactions')
            .update({
              usage_status: 'used',
              remaining_count: 0,
              claim_status: 'claimed',
              claimed_date: new Date().toISOString(),
              claim_reference: refCode,
              settlement_type: settlementMode,
              notes: parent.notes ? `${parent.notes} | Settled: ${refCode}` : `Settled with rep: ${refCode}`,
            })
            .eq('id', alloc.id);
        } else {
          // Partial surrender: decrement parent, insert child row for the surrendered count
          const newRemaining = availableCount - surrenderQty;
          await supabaseAdmin
            .from('token_transactions')
            .update({
              remaining_count: newRemaining,
              token_value: newRemaining * unitVal,
            })
            .eq('id', alloc.id);

          await supabaseAdmin
            .from('token_transactions')
            .insert({
              tenant_id,
              transaction_type: parent.transaction_type,
              invoice_id: parent.invoice_id,
              client_id: parent.client_id,
              client_name: parent.client_name,
              item_id: parent.item_id,
              item_name: parent.item_name,
              brand: parent.brand,
              category: parent.category,
              token_value: surrenderVal,
              token_count: surrenderQty,
              unit_token_value: unitVal,
              remaining_count: 0,
              parent_transaction_id: parent.id,
              usage_status: 'used',
              claim_status: 'claimed',
              claimed_date: new Date().toISOString(),
              claim_reference: refCode,
              settlement_type: settlementMode,
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

    return NextResponse.json({ success: false, error: 'Unhandled transaction type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
