import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

// GET: Fetch payment receipts & vouchers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const partyId = searchParams.get('party_id');
    const partyType = searchParams.get('party_type');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    let query = supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (partyId) query = query.eq('party_id', partyId);
    if (partyType) query = query.eq('party_type', partyType);

    const { data: vouchers, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, vouchers: vouchers || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Record receipt / payment voucher and update party balance
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      voucher_type = 'receipt', // 'receipt' (receive cash from client) or 'payment' (pay supplier)
      party_type = 'client',    // 'client' or 'supplier'
      party_id,
      party_name,
      amount = 0,
      payment_mode = 'Cash',
      reference_no,
      remarks,
      created_by,
      applied_token_ids = [],
    } = body;

    const cashAmt = Math.max(0, Number(amount) || 0);

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // 0. Validate Applied Tokens (if any)
    let totalTokensAmount = 0;
    if (Array.isArray(applied_token_ids) && applied_token_ids.length > 0) {
      const { data: validTokens, error: tokensFetchErr } = await supabaseAdmin
        .from('token_transactions')
        .select('id, token_value, usage_status, used_against_purchase_id, used_against_voucher_id')
        .eq('tenant_id', tenant_id)
        .in('id', applied_token_ids);

      if (tokensFetchErr) throw tokensFetchErr;

      if (!validTokens || validTokens.length !== applied_token_ids.length) {
        return NextResponse.json(
          { success: false, error: 'One or more selected tokens were not found.' },
          { status: 400 }
        );
      }

      const alreadyUsed = validTokens.filter(
        (t) =>
          t.usage_status === 'used' ||
          t.used_against_purchase_id !== null ||
          t.used_against_voucher_id !== null
      );
      if (alreadyUsed.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'One or more selected tokens have already been applied to another purchase or payment.',
          },
          { status: 400 }
        );
      }

      totalTokensAmount = validTokens.reduce((sum, t) => sum + (Number(t.token_value) || 0), 0);
    }

    const totalSettlementAmount = cashAmt + totalTokensAmount;

    if (!tenant_id || !party_id || totalSettlementAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID, Party ID, and a valid Amount or Token selection are required' },
        { status: 400 }
      );
    }

    const voucher_no = `${voucher_type === 'receipt' ? 'RCP' : 'PMT'}-${Math.floor(1000 + Math.random() * 9000)}`;

    const resolvedPaymentMode =
      totalTokensAmount > 0
        ? cashAmt > 0
          ? `${payment_mode} + Tokens`
          : 'Stockpile Tokens'
        : payment_mode || 'Cash';

    const resolvedRemarks =
      totalTokensAmount > 0
        ? `Stockpile Tokens (Rs. ${totalTokensAmount.toLocaleString()})${
            cashAmt > 0 ? ` + ${payment_mode} (Rs. ${cashAmt.toLocaleString()})` : ''
          }${remarks ? ` — ${remarks}` : ''}`
        : remarks || (voucher_type === 'receipt' ? 'Payment Received' : 'Supplier Payment');

    // 1. Insert Voucher
    const voucherData: Record<string, any> = {
      tenant_id,
      voucher_no,
      voucher_type,
      party_type,
      party_id,
      party_name: party_name || '',
      amount: totalSettlementAmount,
      payment_mode: resolvedPaymentMode,
      reference_no: reference_no || null,
      remarks: resolvedRemarks,
      created_by: created_by || null,
      date: new Date().toISOString().split('T')[0],
    };

    let voucherInsertRes = await supabaseAdmin
      .from('vouchers')
      .insert(voucherData)
      .select()
      .single();

    if (voucherInsertRes.error && voucherInsertRes.error.message.includes('payment_mode')) {
      // In case column does not exist on table, fallback without payment_mode column
      delete voucherData.payment_mode;
      voucherData.remarks = `${resolvedPaymentMode} ${resolvedRemarks ? `— ${resolvedRemarks}` : ''}`;
      voucherInsertRes = await supabaseAdmin
        .from('vouchers')
        .insert(voucherData)
        .select()
        .single();
    }

    if (voucherInsertRes.error) throw voucherInsertRes.error;
    const voucher = voucherInsertRes.data;

    // 1b. Mark tokens as used against this voucher
    if (Array.isArray(applied_token_ids) && applied_token_ids.length > 0) {
      const updatePayload: Record<string, any> = {
        usage_status: 'used',
        used_against_voucher_id: voucher.id,
        used_date: new Date().toISOString(),
      };

      let markTokensRes = await supabaseAdmin
        .from('token_transactions')
        .update(updatePayload)
        .in('id', applied_token_ids);

      if (markTokensRes.error && markTokensRes.error.message?.includes('used_against_voucher_id')) {
        delete updatePayload.used_against_voucher_id;
        markTokensRes = await supabaseAdmin
          .from('token_transactions')
          .update(updatePayload)
          .in('id', applied_token_ids);
      }

      if (markTokensRes.error) {
        console.error('Failed to mark tokens as used against voucher:', markTokensRes.error);
      }
    }

    // 2. Adjust Balance
    if (party_type === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('current_balance')
        .eq('id', party_id)
        .single();

      if (client) {
        // Receipt decreases client debt (balance)
        const updatedBal = Math.max(0, (client.current_balance || 0) - totalSettlementAmount);
        await supabaseAdmin
          .from('clients')
          .update({ current_balance: updatedBal })
          .eq('id', party_id);
      }
    } else if (party_type === 'supplier') {
      const { data: supplier } = await supabaseAdmin
        .from('suppliers')
        .select('current_balance')
        .eq('id', party_id)
        .single();

      if (supplier) {
        // Payment decreases supplier payable (balance)
        const updatedBal = Math.max(0, (supplier.current_balance || 0) - totalSettlementAmount);
        await supabaseAdmin
          .from('suppliers')
          .update({
            current_balance: updatedBal,
            last_payment_amount: totalSettlementAmount,
            last_payment_date: voucherData.date,
          })
          .eq('id', party_id);
      }
    }

    return NextResponse.json({
      success: true,
      voucher,
      tokens_applied_amount: totalTokensAmount,
      cash_paid_amount: cashAmt,
      total_settlement: totalSettlementAmount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
