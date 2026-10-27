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
    const shiftId = searchParams.get('shift_id');

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
    if (shiftId) query = query.eq('shift_id', shiftId);

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
      shift_id: inputShiftId,
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
      token_allocations = null,
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

    // Resolve current open shift for this tenant/counter if not explicitly supplied
    let targetShiftId: string | null = inputShiftId || null;
    if (!targetShiftId) {
      const { data: openShift } = await supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('status', 'open')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openShift) {
        targetShiftId = openShift.id;
      }
    }

    // Validate token allocations if supplied (Canonical Contract per Plan Section 4.2)
    let validatedAllocations: { token_id: string; quantity: number }[] | null = null;
    if (token_allocations !== null && token_allocations !== undefined) {
      if (!Array.isArray(token_allocations)) {
        return NextResponse.json(
          { success: false, error: 'token_allocations must be a JSON array' },
          { status: 400 }
        );
      }
      const seenTokenIds = new Set<string>();
      for (const alloc of token_allocations) {
        if (!alloc || typeof alloc !== 'object') {
          return NextResponse.json(
            { success: false, error: 'Each token allocation must be a JSON object' },
            { status: 400 }
          );
        }
        const { token_id, quantity } = alloc;
        if (!token_id || typeof token_id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Allocation token_id must be a string UUID' },
            { status: 400 }
          );
        }
        if (
          typeof quantity !== 'number' ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 2147483647
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `Allocation quantity for token ${token_id} must be a positive integer between 1 and 2147483647`,
            },
            { status: 400 }
          );
        }
        if (seenTokenIds.has(token_id)) {
          return NextResponse.json(
            { success: false, error: `Duplicate token ID in allocations: ${token_id}` },
            { status: 400 }
          );
        }
        seenTokenIds.add(token_id);
      }
      if (token_allocations.length > 0) {
        validatedAllocations = token_allocations;
      }
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
      shift_id: targetShiftId,
    };

    // Task 8.1: Invoke atomic stored procedure
    // Selects canonical overload (p_token_allocations) if allocations present, else legacy wrapper (p_token_ids)
    const rpcPayload: Record<string, any> = {
      p_tenant_id: tenant_id,
      p_voucher_data: voucherData,
    };
    if (validatedAllocations && validatedAllocations.length > 0) {
      rpcPayload.p_token_allocations = validatedAllocations;
    } else {
      rpcPayload.p_token_ids = tokenIds.length > 0 ? tokenIds : null;
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'create_voucher_atomic',
      rpcPayload
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
        shift_id: targetShiftId,
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
