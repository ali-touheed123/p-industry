import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenantAuth } from '@/lib/session';

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

    const auth = await requireTenantAuth(req, tenantId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // 1. Fetch Invoices, Purchases, or Branch Transfers depending on partyType
    let records: any[] = [];
    if (partyType === 'branch') {
      // Branch accounting transactions are recorded as IBT vouchers in the vouchers table (Step 2)
      records = [];
    } else if (partyType === 'supplier') {
      const { data: purchases, error: purErr } = await supabaseAdmin
        .from('purchases')
        .select('*, purchase_items(*)')
        .eq('tenant_id', tenantId)
        .eq('supplier_id', partyId)
        .order('created_at', { ascending: true });

      if (purErr) throw purErr;
      records = (purchases || []).map(p => {
        const isReturn = p.purchase_type === 'return';
        const netTotal = Number(p.net_total || 0);
        const paidAmt = Number(p.paid_amount || 0);
        const dueAmt = Number(p.due_amount || 0);
        const mappedItems = (p.purchase_items || []).map((it: any) => ({
          item_name: it.item_name || it.name,
          code: it.item_code || it.code,
          shade_code: it.shade_code || '',
          pack_size: it.pack_size || it.unit || 'Can',
          qty: it.qty,
          unit_price: it.unit_price,
          total_price: it.total_price || (it.qty * it.unit_price),
        }));

        if (isReturn) {
          // B4: credit = items-returned net_total MINUS cash already received back from supplier.
          // Cash received on return: cash_paid if > 0, else paid_amount if payment_type is cash/empty.
          const cashReceived =
            Number(p.cash_paid || 0) > 0
              ? Number(p.cash_paid)
              : (!p.payment_type || p.payment_type === 'cash')
                ? paidAmt
                : 0;
          const returnCredit = netTotal - cashReceived;
          const cashNote = cashReceived > 0 ? ` · Cash received: Rs. ${cashReceived.toLocaleString()}` : '';
          return {
            id: p.id,
            date: p.date || new Date(p.created_at).toISOString().split('T')[0],
            timestamp: new Date(p.created_at).getTime(),
            type: 'RET',
            typeClass: 'badge-credit',
            desc: `${p.purchase_no} (PURCHASE RETURN) — Rs. ${netTotal.toLocaleString()}${cashNote}`,
            debit: 0,
            credit: returnCredit,
            items: mappedItems,
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
          items: mappedItems,
        };
      });
    } else {
      const { data: invoices, error: invErr } = await supabaseAdmin
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('tenant_id', tenantId)
        .eq('client_id', partyId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (invErr) throw invErr;
      records = (invoices || []).map(inv => {
        const isReturn = inv.invoice_type === 'return';
        const netTotal = Number(inv.net_total || 0);
        const paidAmt = Number(inv.paid_amount || 0);
        const dueAmt = Number(inv.due_amount || 0);
        const mappedItems = (inv.invoice_items || []).map((it: any) => ({
          item_name: it.item_name || it.name,
          code: it.item_code || it.code,
          shade_code: it.shade_code || '',
          pack_size: it.pack_size || it.unit || 'Can',
          qty: it.qty,
          unit_price: it.unit_price,
          total_price: it.total_price || (it.qty * it.unit_price),
        }));

        if (isReturn) {
          // B4: credit = items-returned net_total MINUS cash already refunded to customer.
          // Cash refunded: cash_paid if > 0, else paid_amount if payment_type is cash/refund/empty.
          const cashRefunded =
            Number(inv.cash_paid || 0) > 0
              ? Number(inv.cash_paid)
              : (!inv.payment_type || inv.payment_type === 'cash' || inv.payment_type === 'refund')
                ? paidAmt
                : 0;
          const returnCredit = netTotal - cashRefunded;
          const cashNote = cashRefunded > 0 ? ` · Cash refunded: Rs. ${cashRefunded.toLocaleString()}` : '';
          return {
            id: inv.id,
            date: inv.date || new Date(inv.created_at).toISOString().split('T')[0],
            timestamp: new Date(inv.created_at).getTime(),
            type: 'RET',
            typeClass: 'badge-credit',
            desc: `${inv.invoice_no} (SALES RETURN) — Rs. ${netTotal.toLocaleString()}${cashNote}`,
            debit: 0,
            credit: returnCredit,
            items: mappedItems,
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
          items: mappedItems,
        };
      });
    }

    // 2. Fetch Vouchers (Receipts/Payments) for this party
    // For counter parties (partyId starts with "counter_"), match on party_code TEXT column.
    // For all other parties (clients, suppliers, branches by UUID), match on party_id UUID column.
    let vouchersQuery = supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (partyId.startsWith('counter_')) {
      vouchersQuery = vouchersQuery.eq('party_code', partyId);
    } else {
      vouchersQuery = vouchersQuery.eq('party_id', partyId);
    }

    const { data: vouchers, error: vouchErr } = await vouchersQuery;

    if (vouchErr) throw vouchErr;

    // 2b. Branch transfer vouchers → attach the transferred products (branch_order_items) for detailed statements.
    //     Transfers are booked as one lump value, so only name/code/unit/qty are available (no rate/amount).
    const ibtRefs = Array.from(
      new Set(
        (vouchers || [])
          .filter((v: any) => v.voucher_type === 'branch_transfer_in' || v.voucher_type === 'branch_transfer_out')
          .map((v: any) => v.reference_no)
          .filter(Boolean)
      )
    );
    const transferItemsByOrderNo: Record<string, any[]> = {};
    const transferOrderMetaByOrderNo: Record<string, any> = {};
    if (ibtRefs.length > 0) {
      const { data: orders } = await supabaseAdmin
        .from('branch_orders')
        .select('order_no, subtotal, discount, delivery_charges, dispatch_note, transfer_value, dispatched_at, branch_order_items(*)')
        .in('order_no', ibtRefs as string[])
        .or(`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`);
      (orders || []).forEach((o: any) => {
        transferOrderMetaByOrderNo[o.order_no] = {
          subtotal: o.subtotal != null ? Number(o.subtotal) : null,
          discount: o.discount != null ? Number(o.discount) : null,
          delivery_charges: o.delivery_charges != null ? Number(o.delivery_charges) : null,
          dispatch_note: o.dispatch_note || null,
          transfer_value: o.transfer_value != null ? Number(o.transfer_value) : null,
        };
        transferItemsByOrderNo[o.order_no] = (o.branch_order_items || []).map((it: any) => {
          const isLegacy = it.dispatched_qty === null || it.dispatched_qty === undefined;
          return {
            item_name: it.item_name || it.item_code,
            code: it.item_code,
            shade_code: '',
            pack_size: it.unit || 'Can',
            qty: isLegacy ? Number(it.qty) || 0 : Number(it.dispatched_qty) || 0,
            unit_price: isLegacy ? null : Number(it.unit_price ?? 0),
            total_price: isLegacy ? null : Number(it.total_price ?? (Number(it.dispatched_qty || 0) * Number(it.unit_price || 0))),
            discount_type: it.discount_type || null,
            discount_value: it.discount_value != null ? Number(it.discount_value) : null,
            discount_amount: it.discount_amount != null ? Number(it.discount_amount) : null,
            is_additional: !!it.is_additional,
          };
        });
      });
    }

    // 3. Merge & Sort Chronologically
    const transactions: any[] = [...records];

    (vouchers || []).forEach(v => {
      const vType = v.voucher_type || '';
      const amt = Number(v.amount || 0);

      // ── Branch Transfer Vouchers ──────────────────────────────────────
      if (vType === 'branch_transfer_in') {
        // We received stock → Debit (we OWE them)
        const meta = transferOrderMetaByOrderNo[v.reference_no];
        const noteStr = meta?.dispatch_note ? ` · Note: ${meta.dispatch_note}` : '';
        transactions.push({
          id: v.id,
          date: v.date || new Date(v.created_at).toISOString().split('T')[0],
          timestamp: new Date(v.created_at).getTime(),
          type: 'IBT-IN',
          typeClass: 'badge-target',
          desc: `${v.voucher_no} — ${v.remarks || 'Stock Received (Payable)'}${noteStr}`,
          debit: amt,
          credit: 0,
          items: transferItemsByOrderNo[v.reference_no] || undefined,
          pricingMeta: meta || undefined,
        });
      } else if (vType === 'branch_transfer_out') {
        // We dispatched stock → Credit (they OWE us)
        const meta = transferOrderMetaByOrderNo[v.reference_no];
        const noteStr = meta?.dispatch_note ? ` · Note: ${meta.dispatch_note}` : '';
        transactions.push({
          id: v.id,
          date: v.date || new Date(v.created_at).toISOString().split('T')[0],
          timestamp: new Date(v.created_at).getTime(),
          type: 'IBT-OUT',
          typeClass: 'badge-credit',
          desc: `${v.voucher_no} — ${v.remarks || 'Stock Dispatched (Receivable)'}${noteStr}`,
          debit: 0,
          credit: amt,
          items: transferItemsByOrderNo[v.reference_no] || undefined,
          pricingMeta: meta || undefined,
        });
      } else if (vType === 'opening_balance') {
        // ── Opening Balance / Previous Credit ───────────────────────────
        transactions.push({
          id: v.id,
          date: v.date || new Date(v.created_at).toISOString().split('T')[0],
          timestamp: new Date(v.created_at).getTime() - 10000000, // sort at the very top of the day
          type: 'OB',
          typeClass: 'badge-target',
          desc: `${v.voucher_no} — ${v.remarks || 'Previous Balance / Opening Receivable'}`,
          debit: amt,
          credit: 0,
        });
      } else {
        // ── Standard Receipts / Payments / Settlements ──────────────────
        const isReceipt = vType === 'receipt';
        transactions.push({
          id: v.id,
          date: v.date || new Date(v.created_at).toISOString().split('T')[0],
          timestamp: new Date(v.created_at).getTime(),
          type: isReceipt ? 'PAY' : 'PMT',
          typeClass: isReceipt ? 'badge-paid' : 'badge-credit',
          desc: `${v.voucher_no} (${v.payment_mode
            ? `${v.payment_mode}${v.remarks ? ` — ${v.remarks}` : ''}`
            : (v.remarks || (isReceipt ? 'Payment Received' : 'Supplier Payment'))})`,
          debit: 0,
          credit: amt,
        });
      }
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

    // B4: Read-only balance mismatch warning
    // Fetch stored current_balance from the party table and compare.
    let storedBalance: number | null = null;
    try {
      if (partyType === 'supplier') {
        const { data: sup } = await supabaseAdmin
          .from('suppliers')
          .select('current_balance')
          .eq('id', partyId)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        storedBalance = sup ? Number(sup.current_balance ?? null) : null;
      } else if (partyType === 'client') {
        const { data: cli } = await supabaseAdmin
          .from('clients')
          .select('current_balance')
          .eq('id', partyId)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        storedBalance = cli ? Number(cli.current_balance ?? null) : null;
      }
    } catch {
      // Non-fatal: mismatch check is advisory only
    }

    const balanceMismatch =
      storedBalance !== null && Math.abs(runningBalance - storedBalance) > 0.5
        ? {
            statementBalance: runningBalance,
            storedBalance,
            diff: runningBalance - storedBalance,
            warning: `Statement balance (${runningBalance.toFixed(2)}) differs from party record (${storedBalance.toFixed(2)}) by ${(runningBalance - storedBalance).toFixed(2)}.`,
          }
        : null;

    return NextResponse.json({
      success: true,
      statement: computedStatement,
      totalDebit: transactions.reduce((s, t) => s + t.debit, 0),
      totalCredit: transactions.reduce((s, t) => s + t.credit, 0),
      finalBalance: runningBalance,
      ...(balanceMismatch ? { balanceMismatch } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
