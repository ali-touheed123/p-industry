import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch token transactions or redeemable summary
// ?tenant_id=&item_id=&summary=redeemable  → redeemable balance for item
// ?tenant_id=&shift_id=                   → shift token summary
// ?tenant_id=&client_id=                  → client token balance history
// ?tenant_id=&transaction_type=redeemed   → token payouts for sales history
// ?tenant_id=&usage_status=available      → shop retained tokens available for purchase offset
// ?tenant_id=&usage_status=used           → shop retained tokens used against purchases
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
          q = q.or('usage_status.eq.available,and(usage_status.is.null,transaction_type.in.(shop_retained,redeemed))');
        } else {
          q = q.eq('usage_status', usageStatus);
        }
      }
      if (brand) {
        q = q.ilike('brand', `%${brand}%`);
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

// POST: Create a token transaction
// Body shape varies by type:
//   issued        → { type, tenant_id, invoice_id?, client_id?, client_name?, item_id, item_name?, brand?, category?, token_value, shift_id? }
//   shop_retained → { type, tenant_id, invoice_id?, item_id, item_name?, brand?, category?, token_value, shift_id? }
//   redeemed      → { type, tenant_id, client_id?, client_name?, item_id?, item_name?, brand?, category?, redeemed_amount, shift_id? }
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
      redeemed_amount,
      shift_id,
      notes,
    } = body;

    if (!tenant_id || !type) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and transaction type are required' },
        { status: 400 }
      );
    }

    if (!['issued', 'redeemed', 'shop_retained'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type. Must be: issued, redeemed, or shop_retained' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // --- Handle each type ---

    if (type === 'issued') {
      if (!item_id || !token_value) {
        return NextResponse.json(
          { success: false, error: 'item_id and token_value are required for issued transactions' },
          { status: 400 }
        );
      }

      const parsedTokenValue = Number(token_value) || 0;

      // Insert token transaction record
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
          redeemed_amount: 0,
          remaining_balance: parsedTokenValue,
          shift_id: shift_id || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      // Side effect: increase client token_balance if registered customer
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

    if (type === 'shop_retained') {
      if (!token_value) {
        return NextResponse.json(
          { success: false, error: 'token_value is required for shop_retained transactions' },
          { status: 400 }
        );
      }

      const parsedTokenValue = Number(token_value) || 0;

      // Insert token transaction record with usage_status = 'available'
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
          redeemed_amount: 0,
          remaining_balance: 0,
          shift_id: shift_id || null,
          notes: notes || null,
          usage_status: 'available',
        })
        .select()
        .single();

      if (txnErr) throw txnErr;

      return NextResponse.json({ success: true, transaction: txn });
    }

    if (type === 'redeemed') {
      const parsedAmount = Number(redeemed_amount) || 0;
      if (parsedAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'redeemed_amount must be greater than 0' },
          { status: 400 }
        );
      }

      // If item_id is specified, enforce server-side per-item redeemable balance cap
      if (item_id) {
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
              error: `Redemption amount (Rs. ${parsedAmount.toLocaleString()}) exceeds available redeemable tokens for this item (Rs. ${itemRedeemableBalance.toLocaleString()})`,
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

      // Insert token transaction record with usage_status = 'available'
      const { data: txn, error: txnErr } = await supabaseAdmin
        .from('token_transactions')
        .insert({
          tenant_id,
          transaction_type: 'redeemed',
          invoice_id: null,
          client_id: client_id || null,
          client_name: client_name || null,
          item_id: item_id || null,
          item_name: item_name || null,
          brand: brand || null,
          category: category || null,
          token_value: parsedAmount,
          redeemed_amount: parsedAmount,
          remaining_balance: remainingBalance,
          shift_id: shift_id || null,
          notes: notes || null,
          usage_status: 'available',
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

    return NextResponse.json({ success: false, error: 'Unhandled transaction type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
