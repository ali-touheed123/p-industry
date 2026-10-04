import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

/**
 * Generate a collision-resistant voucher identifier.
 * Format: {PREFIX}-YYYYMMDD-XXXX (e.g. RCP-20261005-A1B2)
 * Space: 61,440 combinations per date per prefix.
 */
function generateVoucherCode(prefix: string, dateStr: string): string {
  const datePart = (dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const randPart = Math.floor(0x1000 + Math.random() * 0xf000).toString(16).toUpperCase();
  return `${prefix}-${datePart}-${randPart}`;
}

// GET: Fetch payment receipts & vouchers
// Task 8.3 (FINDING-LEDG-003): Add default limit 100, max limit 500, optional offset
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const partyId = searchParams.get('party_id');
    const partyType = searchParams.get('party_type');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID required' }, { status: 400 });
    }

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Default limit 100, max limit 500 per Task 8.3
    const limit = limitParam
      ? Math.min(Math.max(1, parseInt(limitParam, 10) || 100), 500)
      : 100;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

    let query = supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (partyId) query = query.eq('party_id', partyId);
    if (partyType) query = query.eq('party_type', partyType);

    if (offset > 0) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(limit);
    }

    const { data: vouchers, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, vouchers: vouchers || [], limit, offset });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Record receipt / payment voucher and atomically update party balance
// Task 8.1 (FINDING-LEDG-001): All operations execute atomically via create_voucher_atomic RPC.
// Task 8.2 (FINDING-LEDG-002): Uses collision-resistant voucher identifier format.
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
      date = new Date().toISOString().split('T')[0],
    } = body;

    const cashAmt = Math.max(0, Number(amount) || 0);

    if (!tenant_id || !party_id) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and Party ID are required' },
        { status: 400 }
      );
    }

    const auth = await requireTenantAuth(req, tenant_id);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Task 8.2: Generate collision-resistant candidate voucher_no
    const voucherPrefix = voucher_type === 'receipt' ? 'RCP' : 'PMT';
    const candidateVoucherNo = generateVoucherCode(voucherPrefix, date);

    const tokenIds: string[] = Array.isArray(applied_token_ids) ? applied_token_ids : [];

    const voucherData = {
      voucher_no: candidateVoucherNo,
      voucher_type,
      party_type,
      party_id,
      party_name: party_name || '',
      amount: cashAmt,
      payment_mode: payment_mode || 'Cash',
      reference_no: reference_no || null,
      remarks: remarks || (voucher_type === 'receipt' ? 'Payment Received' : 'Supplier Payment'),
      created_by: created_by || null,
      date,
    };

    // Task 8.1: Invoke atomic stored procedure
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_voucher_atomic',
      {
        p_tenant_id:    tenant_id,
        p_voucher_data: voucherData,
        p_token_ids:    tokenIds.length > 0 ? tokenIds : null,
      }
    );

    if (rpcError) throw rpcError;

    const result = rpcResult as {
      voucher_id: string;
      voucher_no: string;
      voucher_type: string;
      party_type: string;
      party_id: string;
      party_name: string;
      amount: number;
      tokens_applied_amount: number;
      cash_paid_amount: number;
      updated_balance: number;
      date: string;
    };

    return NextResponse.json({
      success: true,
      voucher: {
        id: result.voucher_id,
        tenant_id,
        voucher_no: result.voucher_no,
        voucher_type: result.voucher_type,
        party_type: result.party_type,
        party_id: result.party_id,
        party_name: result.party_name,
        amount: result.amount,
        payment_mode: voucherData.payment_mode,
        reference_no: voucherData.reference_no,
        remarks: voucherData.remarks,
        date: result.date,
        created_by: voucherData.created_by,
      },
      tokens_applied_amount: result.tokens_applied_amount,
      cash_paid_amount: result.cash_paid_amount,
      total_settlement: result.amount,
      updated_balance: result.updated_balance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
