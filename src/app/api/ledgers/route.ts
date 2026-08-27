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

    // 1. Fetch Invoices or Purchases depending on partyType
    let records: any[] = [];
    if (partyType === 'supplier') {
      const { data: purchases, error: purErr } = await supabaseAdmin
        .from('purchases')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('supplier_id', partyId)
        .order('created_at', { ascending: true });

      if (purErr) throw purErr;
      records = (purchases || []).map(p => {
        const isReturn = p.purchase_type === 'return';
        const netTotal = Number(p.net_total || 0);
        const paidAmt = Number(p.paid_amount || 0);
        const dueAmt = Number(p.due_amount || 0);

        if (isReturn) {
          return {
            id: p.id,
            date: p.date || new Date(p.created_at).toISOString().split('T')[0],
            timestamp: new Date(p.created_at).getTime(),
            type: 'RET',
            typeClass: 'badge-credit',
            desc: `${p.purchase_no} (PURCHASE RETURN) — Rs. ${netTotal.toLocaleString()}`,
            debit: 0,
            credit: netTotal,
          };
        }

        return {
          id: p.id,
          date: p.date || new Date(p.created_at).toISOString().split('T')[0],
          timestamp: new Date(p.created_at).getTime(),
          type: 'PUR',
          typeClass: 'badge-target',
          desc: `${p.purchase_no} (${p.payment_type?.toUpperCase() || 'PURCHASE'}) — Total: Rs. ${netTotal.toLocaleString()}, Paid: Rs. ${paidAmt.toLocaleString()}`,
          debit: dueAmt,
          credit: 0,
        };
      });
    } else {
      const { data: invoices, error: invErr } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', partyId)
        .order('created_at', { ascending: true });

      if (invErr) throw invErr;
      records = (invoices || []).map(inv => {
        const isReturn = inv.invoice_type === 'return';
        const netTotal = Number(inv.net_total || 0);
        const paidAmt = Number(inv.paid_amount || 0);
        const dueAmt = Number(inv.due_amount || 0);

        if (isReturn) {
          return {
            id: inv.id,
            date: inv.date || new Date(inv.created_at).toISOString().split('T')[0],
            timestamp: new Date(inv.created_at).getTime(),
            type: 'RET',
            typeClass: 'badge-credit',
            desc: `${inv.invoice_no} (SALES RETURN) — Rs. ${netTotal.toLocaleString()}`,
            debit: 0,
            credit: netTotal,
          };
        }

        return {
          id: inv.id,
          date: inv.date || new Date(inv.created_at).toISOString().split('T')[0],
          timestamp: new Date(inv.created_at).getTime(),
          type: 'INV',
          typeClass: 'badge-target',
          desc: `${inv.invoice_no} (${inv.payment_type?.toUpperCase() || 'SALE'}) — Total: Rs. ${netTotal.toLocaleString()}, Paid: Rs. ${paidAmt.toLocaleString()}`,
          debit: dueAmt,
          credit: 0,
        };
      });
    }

    // 2. Fetch Vouchers (Receipts/Payments) for this party
    const { data: vouchers, error: vouchErr } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('party_id', partyId)
      .order('created_at', { ascending: true });

    if (vouchErr) throw vouchErr;

    // 3. Merge & Sort Chronologically
    const transactions: any[] = [...records];

    (vouchers || []).forEach(v => {
      transactions.push({
        id: v.id,
        date: v.date || new Date(v.created_at).toISOString().split('T')[0],
        timestamp: new Date(v.created_at).getTime(),
        type: v.voucher_type === 'receipt' ? 'PAY' : 'PMT',
        typeClass: v.voucher_type === 'receipt' ? 'badge-paid' : 'badge-credit',
        desc: `${v.voucher_no} (${v.payment_mode ? `${v.payment_mode}${v.remarks ? ` — ${v.remarks}` : ''}` : (v.remarks || (v.voucher_type === 'receipt' ? 'Payment Received' : 'Supplier Payment'))})`,
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
