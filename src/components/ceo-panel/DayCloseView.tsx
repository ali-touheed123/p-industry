'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, DayCloseRecord } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { CheckCircle2, AlertTriangle, Users, Coffee, CalendarCheck } from 'lucide-react';

interface DayCloseViewProps {
  branch: Branch;
}

export const DayCloseView: React.FC<DayCloseViewProps> = ({ branch }) => {
  const [shifts, setShifts] = useState<DayCloseRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchShiftsAndExpenses = async () => {
      const tenantId = branch?.id
        ? (/-b\d+$/.test(branch.id) ? branch.id.replace(/-b\d+$/, '') : branch.id)
        : (branch?.slug || '');

      if (!tenantId) return;
      setLoading(true);
      try {
        const [shiftsRes, expensesRes, invoicesRes] = await Promise.all([
          fetch(`/api/shifts?tenant_id=${tenantId}`),
          fetch(`/api/expenses?tenant_id=${tenantId}`),
          fetch(`/api/invoices?tenant_id=${tenantId}`),
        ]);

        const [shiftsData, expensesData, invoicesData] = await Promise.all([
          shiftsRes.json(),
          expensesRes.json(),
          invoicesRes.json(),
        ]);

        if (!isMounted) return;

        let currentTenant: any = null;
        try {
          const tenantsRes = await fetch(`/api/tenants?slug=${branch?.slug || ''}`);
          const tenantsData = await tenantsRes.json();
          if (tenantsData.success && tenantsData.tenant) {
            currentTenant = tenantsData.tenant;
          }
        } catch {}

        const allExpenses: any[] = expensesData.success ? (expensesData.expenses || []) : [];
        const allInvoices: any[] = invoicesData.success ? (invoicesData.invoices || []) : [];

        const commEnabled = Boolean(currentTenant?.commission_enabled);
        const commRate = Number(currentTenant?.commission_rate || 2.0);
        const splitLead = Number(currentTenant?.commission_split_lead || 35.0);
        const splitStaff = Number(currentTenant?.commission_split_staff || 35.0);
        const splitReserve = Number(currentTenant?.commission_split_reserve || 30.0);

        if (shiftsData.success && shiftsData.shifts) {
          const mapped: DayCloseRecord[] = shiftsData.shifts.map((s: any) => {
            const shiftDate = s.created_at ? s.created_at.split('T')[0] : 'Recent';
            
            // Match expenses for this shift or date
            const shiftExpenses = allExpenses.filter((e: any) =>
              (e.shift_id && e.shift_id === s.id) ||
              (!e.shift_id && e.created_at?.split('T')[0] === shiftDate)
            );

            // Match invoices for this shift or date
            const shiftInvoices = allInvoices.filter((i: any) =>
              (i.shift_id && i.shift_id === s.id) ||
              (!i.shift_id && (i.date === shiftDate || i.created_at?.split('T')[0] === shiftDate))
            );

            const salesInvs = shiftInvoices.filter((i: any) => (i.invoice_type || 'sales') !== 'return');
            const returnInvs = shiftInvoices.filter((i: any) => (i.invoice_type || 'sales') === 'return');

            const cashSales = salesInvs
              .filter((i: any) => !i.payment_type || i.payment_type === 'cash')
              .reduce((sum: number, i: any) => sum + Number(i.cash_paid || i.paid_amount || i.net_total || 0), 0);

            const creditSales = salesInvs
              .filter((i: any) => i.payment_type === 'credit')
              .reduce((sum: number, i: any) => sum + Number(i.due_amount || i.net_total || 0), 0);

            const bankSales = salesInvs
              .filter((i: any) => i.payment_type === 'bank' || i.payment_type === 'card' || i.payment_type === 'cheque')
              .reduce((sum: number, i: any) => sum + Number(i.bank_paid || i.card_paid || i.net_total || 0), 0);

            const grossSales = salesInvs.reduce((sum: number, i: any) => sum + Number(i.net_total || 0), 0);
            const returnTotal = returnInvs.reduce((sum: number, i: any) => sum + Number(i.net_total || 0), 0);
            const netShiftSales = Math.max(0, grossSales - returnTotal);

            const totalExpensesAmt = shiftExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

            const openAmt = Number(s.opening_cash || 0);
            const closeAmt = Number(s.actual_cash !== undefined ? s.actual_cash : (s.closing_cash || openAmt));
            const expCash = Number(s.expected_cash !== undefined ? s.expected_cash : (openAmt + cashSales - totalExpensesAmt));
            const variance = closeAmt - expCash;

            // Commission distribution
            const commissionPool = commEnabled ? Math.round(netShiftSales * (commRate / 100)) : 0;
            const staffShares = commEnabled && commissionPool > 0 ? [
              {
                id: 'lead-share',
                name: 'Lead Cashier / Supervisor',
                role: 'Register Incharge',
                sharePct: splitLead,
                amount: Math.round(commissionPool * (splitLead / 100)),
              },
              {
                id: 'staff-share',
                name: 'Counter Sales Staff',
                role: 'Sales Executive',
                sharePct: splitStaff,
                amount: Math.round(commissionPool * (splitStaff / 100)),
              },
              {
                id: 'reserve-share',
                name: 'Branch Retention Reserve',
                role: 'Store Pool',
                sharePct: splitReserve,
                amount: Math.round(commissionPool * (splitReserve / 100)),
              },
            ] : [];

            // Petty cash logs
            const pettyLogs = shiftExpenses.map((e: any) => ({
              id: e.id,
              title: e.title || 'Petty Expense',
              time: e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
              department: e.category || 'General Store',
              amount: Number(e.amount || 0),
            }));

            return {
              id: s.id,
              shiftTitle: `Register Shift #${s.id.substring(0, 4)}`,
              date: shiftDate,
              shiftTime: s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (s.opened_at ? new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Day Shift'),
              cashierName: s.closed_by || s.opened_by || s.notes || 'Counter Staff',
              registerNo: '01',
              financialSummary: {
                openingBalance: openAmt,
                cashSales,
                creditSales,
                bankCardSales: bankSales,
                pettyExpenses: totalExpensesAmt,
                expectedCash: expCash,
                actualCashCounted: closeAmt,
                varianceAmount: variance,
                varianceStatus: variance === 0 ? 'MATCHED' : (variance < 0 ? 'SHORT' : 'EXCESS'),
              },
              commissionBreakdown: {
                totalSales: netShiftSales,
                commissionRate: commEnabled ? commRate : 0,
                commissionPool,
                staffShares,
              },
              pettyCashLogs: pettyLogs,
            };
          });

          setShifts(mapped);
          if (mapped.length > 0 && !selectedRecordId) {
            setSelectedRecordId(mapped[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load shift records', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchShiftsAndExpenses();
    return () => {
      isMounted = false;
    };
  }, [branch?.id, branch?.slug, selectedRecordId]);

  const activeRecord: DayCloseRecord | undefined = useMemo(() => {
    return shifts.find((r) => r.id === selectedRecordId) || shifts[0];
  }, [shifts, selectedRecordId]);

  if (!activeRecord) {
    return (
      <div id="executive-day-close-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2F38', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
                Shift-End Cash Drawer Reconciliation
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: '#8B93A1', margin: '4px 0 0' }}>
              {branch.name} • End-of-shift drawer balancing, cash counting &amp; variance audits
            </p>
          </div>
        </div>
        <div style={{ padding: '48px', textAlign: 'center', border: '1px solid #2A2F38', borderRadius: '8px', color: '#8B93A1', backgroundColor: '#1C2128' }}>
          <CalendarCheck style={{ width: '32px', height: '32px', color: '#C6A15B', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#E5E7EB', marginBottom: '4px' }}>No Shift Reconciliation Records</div>
          <div style={{ fontSize: '12px', color: '#8B93A1' }}>
            {loading ? 'Loading shift records...' : 'When counter staff close shifts in the POS Day Close module, reconciliation summaries will appear here.'}
          </div>
        </div>
      </div>
    );
  }

  const { financialSummary, commissionBreakdown, pettyCashLogs } = activeRecord;

  return (
    <div id="executive-day-close-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Shift Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2F38', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Shift-End Cash Drawer Reconciliation
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8B93A1', marginTop: '4px' }}>
            <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{activeRecord.date}</span>
            <span>•</span>
            <span className="ceo-font-mono" style={{ color: '#E5E7EB' }}>{activeRecord.shiftTime}</span>
            <span>•</span>
            <span style={{ color: '#E5E7EB' }}>{activeRecord.cashierName} (Reg {activeRecord.registerNo})</span>
          </div>
        </div>

        {/* Historical Shift Picker */}
        {shifts.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1C2128', border: '1px solid #2A2F38', borderRadius: '8px', padding: '6px 12px' }}>
            <span style={{ fontSize: '12px', color: '#8B93A1', fontWeight: 600 }}>Audit History:</span>
            <select
              value={activeRecord.id}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              style={{ backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#E5E7EB', outline: 'none', cursor: 'pointer' }}
            >
              {shifts.map((r) => (
                <option key={r.id} value={r.id} style={{ backgroundColor: '#1C2128', color: '#E5E7EB' }}>
                  {r.date} — {r.shiftTime} ({r.financialSummary.varianceStatus})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3-Column Reconciliation Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {/* CARD 1: Financial Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ceo-card">
            <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#E5E7EB', margin: '0 0 16px' }}>
              Cash Flow Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B93A1' }}>
                <span>Opening Cash Drawer</span>
                <span className="ceo-font-mono" style={{ color: '#E5E7EB', fontWeight: 600 }}>{formatCurrency(financialSummary.openingBalance)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B93A1' }}>
                <span>Total Register Sales (Cash)</span>
                <span className="ceo-font-mono" style={{ color: '#34D399', fontWeight: 600 }}>{formatCurrency(financialSummary.cashSales)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B93A1' }}>
                <span style={{ paddingLeft: '8px' }}>Sales (Credit / Udhaar)</span>
                <span className="ceo-font-mono" style={{ color: '#E5E7EB' }}>{formatCurrency(financialSummary.creditSales)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B93A1' }}>
                <span style={{ paddingLeft: '8px' }}>Sales (Bank / Card)</span>
                <span className="ceo-font-mono" style={{ color: '#E5E7EB' }}>{formatCurrency(financialSummary.bankCardSales)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8B93A1' }}>
                <span>Petty Cash Expenses</span>
                <span className="ceo-font-mono" style={{ color: '#F87171' }}>{formatCurrency(financialSummary.pettyExpenses)}</span>
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid #2A2F38', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#E5E7EB', textTransform: 'uppercase' }}>Expected Cash</span>
                <span className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#E5E7EB' }}>
                  {formatCurrency(financialSummary.expectedCash)}
                </span>
              </div>
            </div>
          </div>

          {/* Variance Status Card */}
          <div className="ceo-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="ceo-font-heading" style={{ fontSize: '14px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
                Physical Cash Audit
              </h3>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                backgroundColor: financialSummary.varianceStatus === 'MATCHED' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                color: financialSummary.varianceStatus === 'MATCHED' ? '#34D399' : '#F87171',
              }}>
                {financialSummary.varianceStatus}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#8B93A1', margin: '4px 0 0' }}>
              Physical counted drawer vs Expected system register balance
            </p>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #2A2F38', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase' }}>ACTUAL COUNTED CASH</div>
                <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#34D399', marginTop: '2px' }}>
                  {formatCurrency(financialSummary.actualCashCounted)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase' }}>DRAWER VARIANCE</div>
                <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: financialSummary.varianceAmount < 0 ? '#F87171' : '#34D399', marginTop: '2px' }}>
                  {formatCurrency(financialSummary.varianceAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Staff Commission Pool */}
        <div className="ceo-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#C6A15B' }} />
            <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Staff Sales Commission Pool
            </h3>
          </div>
          <p style={{ fontSize: '11px', color: '#8B93A1', margin: '0 0 16px' }}>
            {commissionBreakdown.commissionRate}% allocated pool from total shift revenue
          </p>

          <div style={{ padding: '14px', backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#8B93A1', textTransform: 'uppercase' }}>COMMISSION POOL VALUE</div>
                <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#C6A15B', marginTop: '2px' }}>
                  {formatCurrency(commissionBreakdown.commissionPool)}
                </div>
              </div>
              <span className="ceo-font-mono" style={{ fontSize: '11px', color: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                {commissionBreakdown.commissionRate}% Rate
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#8B93A1', letterSpacing: '0.05em' }}>
              Staff Distribution Shares
            </div>
            {commissionBreakdown.staffShares.map((staff) => (
              <div key={staff.id} style={{ padding: '10px 12px', backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#E5E7EB' }}>{staff.name}</div>
                  <div style={{ fontSize: '10px', color: '#8B93A1', marginTop: '1px' }}>Role: {staff.role} ({staff.sharePct}%)</div>
                </div>
                <div className="ceo-font-mono" style={{ fontWeight: 700, color: '#C6A15B' }}>
                  {formatCurrency(staff.amount)}
                </div>
              </div>
            ))}
            {commissionBreakdown.staffShares.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#8B93A1', fontSize: '11px' }}>
                Pool calculated automatically based on register activity.
              </div>
            )}
          </div>
        </div>

        {/* CARD 3: Petty Cash Expenses Log */}
        <div className="ceo-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Coffee style={{ width: '18px', height: '18px', color: '#F87171' }} />
            <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#E5E7EB', margin: 0 }}>
              Petty Cash Vouchers
            </h3>
          </div>
          <p style={{ fontSize: '11px', color: '#8B93A1', margin: '0 0 16px' }}>
            Counter petty expenses deducted during this shift
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pettyCashLogs.map((log) => (
              <div key={log.id} style={{ padding: '10px 12px', backgroundColor: '#12151B', border: '1px solid #2A2F38', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#E5E7EB' }}>{log.title}</div>
                  <div style={{ fontSize: '10px', color: '#8B93A1', marginTop: '1px' }}>Dept: {log.department} • Time: {log.time}</div>
                </div>
                <div className="ceo-font-mono" style={{ fontWeight: 700, color: '#F87171' }}>
                  -{formatCurrency(log.amount)}
                </div>
              </div>
            ))}
            {pettyCashLogs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#8B93A1', fontSize: '12px' }}>
                No petty expenses recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
