import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
      amount,
      payment_mode = 'Cash',
      remarks,
      created_by,
    } = body;

    if (!tenant_id || !party_id || !amount) {
      return NextResponse.json({ success: false, error: 'Tenant ID, Party ID, and Amount are required' }, { status: 400 });
    }

    const voucher_no = `${voucher_type === 'receipt' ? 'RCP' : 'PMT'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const parsedAmt = Number(amount);

    // 1. Insert Voucher with resilient payment_mode handling
    const voucherData: Record<string, any> = {
      tenant_id,
      voucher_no,
      voucher_type,
      party_type,
      party_id,
      party_name: party_name || '',
      amount: parsedAmt,
      payment_mode: payment_mode || 'Cash',
      remarks: remarks || `${voucher_type === 'receipt' ? 'Payment Received' : 'Supplier Payment'}`,
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
      voucherData.remarks = `${payment_mode} ${remarks ? `— ${remarks}` : ''}`;
      voucherInsertRes = await supabaseAdmin
        .from('vouchers')
        .insert(voucherData)
        .select()
        .single();
    }

    if (voucherInsertRes.error) throw voucherInsertRes.error;
    const voucher = voucherInsertRes.data;

    // 2. Adjust Balance
    if (party_type === 'client') {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('current_balance')
        .eq('id', party_id)
        .single();

      if (client) {
        // Receipt decreases client debt (balance)
        const updatedBal = Math.max(0, (client.current_balance || 0) - parsedAmt);
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
        const updatedBal = Math.max(0, (supplier.current_balance || 0) - parsedAmt);
        await supabaseAdmin
          .from('suppliers')
          .update({ current_balance: updatedBal })
          .eq('id', party_id);
      }
    }

    return NextResponse.json({ success: true, voucher });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
