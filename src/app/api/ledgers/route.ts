import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Fetch combined chronological statement of account (Invoices + Receipts)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const partyId = searchParams.get('party_id');
    const partyType = searchParams.get('party_type') || 'client'; // 'client' | 'supplier'

    if (!tenantId || !partyId) {
      return NextResponse.json({ success: false, error: 'Tenant ID and Party ID are required' }, { status: 400 });
    }

    // 1. Fetch Invoices for this client
    const { data: invoices, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', partyId)
      .order('created_at', { ascending: true });

    if (invErr) throw invErr;

    // 2. Fetch Vouchers (Receipts/Payments) for this party
    const { data: vouchers, error: vouchErr } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('party_id', partyId)
      .order('created_at', { ascending: true });

    if (vouchErr) throw vouchErr;

    // 3. Merge & Sort Chronologically
    const transactions: any[] = [];

    (invoices || []).forEach(inv => {
      transactions.push({
        id: inv.id,
        date: inv.date || new Date(inv.created_at).toISOString().split('T')[0],
        timestamp: new Date(inv.created_at).getTime(),
        type: 'INV',
        typeClass: 'badge-target',
        desc: `${inv.invoice_no} (${inv.payment_type?.toUpperCase() || 'SALE'})`,
        debit: Number(inv.net_total || 0),
        credit: 0,
      });
    });

    (vouchers || []).forEach(v => {
      transactions.push({
        id: v.id,
        date: v.date || new Date(v.created_at).toISOString().split('T')[0],
        timestamp: new Date(v.created_at).getTime(),
        type: v.voucher_type === 'receipt' ? 'PAY' : 'PMT',
        typeClass: v.voucher_type === 'receipt' ? 'badge-paid' : 'badge-credit',
        desc: `${v.voucher_no} (${v.remarks || 'Payment Received'})`,
        debit: 0,
        credit: Number(v.amount || 0),
      });
    });

    // Sort by timestamp
    transactions.sort((a, b) => a.timestamp - b.timestamp);

    // Compute Running Balance
    let runningBalance = 0;
    const computedStatement = transactions.map(t => {
      runningBalance += t.debit - t.credit;
      return {
        ...t,
        bal: runningBalance,
      };
    });

    return NextResponse.json({
      success: true,
      statement: computedStatement,
      totalDebit: transactions.reduce((s, t) => s + t.debit, 0),
      totalCredit: transactions.reduce((s, t) => s + t.credit, 0),
      finalBalance: runningBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
