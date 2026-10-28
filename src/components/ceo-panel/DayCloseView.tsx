'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Branch, DayCloseRecord } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { CheckCircle2, AlertTriangle, Users, Coffee, CalendarCheck } from 'lucide-react';
import { DatePeriodFilter } from './DatePeriodFilter';
import { computeShiftCash, isCancelledInvoice, isReturnInvoice } from '@/utils/cashLedger';

interface DayCloseViewProps {
  branch: Branch;
}

export const DayCloseView: React.FC<DayCloseViewProps> = ({ branch }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayLocal = `${year}-${month}-${day}`;
  const firstOfMonthLocal = `${year}-${month}-01`;

  const [startDate, setStartDate] = useState<string>(firstOfMonthLocal);
  const [endDate, setEndDate] = useState<string>(todayLocal);
  const [shifts, setShifts] = useState<DayCloseRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchShiftsAndExpenses = async () => {
      const tenantId = branch?.id || branch?.slug || '';

      if (!tenantId) return;
      setLoading(true);
      try {
        const [shiftsRes, expensesRes, invoicesRes, tokensRes, vouchersRes, purchasesRes] = await Promise.all([
          fetch(`/api/shifts?tenant_id=${tenantId}`),
          fetch(`/api/expenses?tenant_id=${tenantId}`),
          fetch(`/api/invoices?tenant_id=${tenantId}`),
          fetch(`/api/tokens?tenant_id=${tenantId}`),
          fetch(`/api/vouchers?tenant_id=${tenantId}`),
          fetch(`/api/purchases?tenant_id=${tenantId}`),
        ]);

        const [shiftsData, expensesData, invoicesData, tokensData, vouchersData, purchasesData] = await Promise.all([
          shiftsRes.json(),
          expensesRes.json(),
          invoicesRes.json(),
          tokensRes.json(),
          vouchersRes.json(),
          purchasesRes.json(),
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
        const allTokens: any[] = tokensData.success && Array.isArray(tokensData.transactions) ? tokensData.transactions : [];
        const allVouchers: any[] = vouchersData.success && Array.isArray(vouchersData.vouchers) ? vouchersData.vouchers : [];
        const allPurchases: any[] = purchasesData.success && Array.isArray(purchasesData.purchases) ? purchasesData.purchases : [];

        const commEnabled = Boolean(currentTenant?.commission_enabled);
        const commRate = Number(currentTenant?.commission_rate || 2.0);
        const splitLead = Number(currentTenant?.commission_split_lead || 35.0);
        const splitStaff = Number(currentTenant?.commission_split_staff || 35.0);
        const splitReserve = Number(currentTenant?.commission_split_reserve || 30.0);

        if (shiftsData.success && shiftsData.shifts) {
          // Filter shifts for this specific branch/counter if multi-branch
          const branchShifts = shiftsData.shifts.filter((s: any) => {
            if (branch?.userId || branch?.counterUsername) {
              const matchUserId = Boolean(branch.userId && (s.opened_by === branch.userId || s.closed_by === branch.userId));
              const matchUsername = Boolean(branch.counterUsername && (
                (s.notes && s.notes.toLowerCase().includes(branch.counterUsername.toLowerCase())) ||
                (s.opened_by && typeof s.opened_by === 'string' && s.opened_by.toLowerCase().includes(branch.counterUsername.toLowerCase())) ||
                (s.closed_by && typeof s.closed_by === 'string' && s.closed_by.toLowerCase().includes(branch.counterUsername.toLowerCase()))
              ));
              const matchManager = Boolean(branch.manager && (
                (s.notes && s.notes.toLowerCase().includes(branch.manager.toLowerCase())) ||
                (s.closed_by && typeof s.closed_by === 'string' && s.closed_by.toLowerCase().includes(branch.manager.toLowerCase()))
              ));
              return matchUserId || matchUsername || matchManager;
            }
            return true;
          });

// N6: Compute shop local date with ONE consistent method everywhere (replaces mixes of split('T')[0] and toLocaleDateString)
const toShopLocalDate = (val: string | Date | null | undefined): string => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

          const mapped: DayCloseRecord[] = branchShifts.map((s: any) => {
            const rawStartTime = s.start_time || s.created_at;
            const shiftDate = toShopLocalDate(rawStartTime) || todayLocal;
            const isOpen = s.status === 'open';

            // Fix #5 & N6: Only use date fallback when this is the sole shift on the day.
            // With multiple shifts per day, date-based fallback double-counts records across shifts.
            const isOnlyShiftOnDay = branchShifts.filter((other: any) => {
              const otherDate = toShopLocalDate(other.start_time || other.created_at);
              return otherDate === shiftDate;
            }).length <= 1;

            // Match expenses: prefer shift_id; date fallback only when sole shift on that day
            const shiftExpenses = allExpenses.filter((e: any) =>
              (e.shift_id && e.shift_id === s.id) ||
              (!e.shift_id && isOnlyShiftOnDay && toShopLocalDate(e.created_at) === shiftDate)
            );

            // Match invoices: prefer shift_id; date fallback only when sole shift on that day
            // Exclude cancelled AND void invoices from all shift reconciliation (Phase 1)
            const shiftInvoices = allInvoices.filter((i: any) => {
              if (isCancelledInvoice(i)) return false;
              return (i.shift_id && i.shift_id === s.id) ||
                (!i.shift_id && isOnlyShiftOnDay && (toShopLocalDate(i.date) === shiftDate || toShopLocalDate(i.created_at) === shiftDate));
            });

            // Match token transactions for this shift; same date-fallback guard
            // Exclude reversed usage_status and reversal type (Phase 1)
            const shiftTokens = allTokens.filter((t: any) => {
              const matches = (t.shift_id && t.shift_id === s.id) ||
                (!t.shift_id && isOnlyShiftOnDay && toShopLocalDate(t.created_at) === shiftDate);
              if (!matches) return false;
              const uStatus = (t.usage_status || '').toLowerCase();
              const tType = (t.type || t.transaction_type || '').toLowerCase();
              return uStatus !== 'reversed' && tType !== 'reversal';
            });
            const tokensRedeemedAmt = shiftTokens
              .filter((t: any) => (t.type || t.transaction_type) === 'redeemed')
              .reduce((sum: number, t: any) => sum + Number(t.total_amount || t.redeemed_amount || t.token_value || 0), 0);

            // Match vouchers: prefer shift_id; vouchers without shift_id excluded from cash ledger (Phase 1)
            const shiftVouchers = allVouchers.filter((v: any) => v.shift_id && v.shift_id === s.id);

            // Match purchases: prefer shift_id; date fallback only when sole shift on that day
            const shiftPurchases = allPurchases.filter((p: any) =>
              (p.shift_id && p.shift_id === s.id) ||
              (!p.shift_id && isOnlyShiftOnDay && toShopLocalDate(p.date || p.created_at) === shiftDate)
            );

            const salesInvs = shiftInvoices.filter((i: any) => !isReturnInvoice(i));
            const returnInvs = shiftInvoices.filter((i: any) => isReturnInvoice(i));

            const grossSales = salesInvs.reduce((sum: number, i: any) => sum + Number(i.net_total || 0), 0);
            const returnTotal = returnInvs.reduce((sum: number, i: any) => sum + Number(i.net_total || 0), 0);
            const netShiftSales = grossSales - returnTotal;

            const totalExpensesAmt = shiftExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

            const openAmt = Number(s.opening_cash || 0);
            const closeAmt = isOpen ? 0 : Number(s.actual_cash !== undefined && s.actual_cash !== null ? s.actual_cash : openAmt);

            // For CLOSED shifts: use cash_breakdown persisted at close time if available.
            // For OPEN shifts: compute live with shared function.
            // For legacy closed shifts without cash_breakdown: use stored expected_cash.
            let expCash: number;
            let cashBreakdownLines: any = null;

            if (!isOpen && s.cash_breakdown) {
              cashBreakdownLines = s.cash_breakdown;
              expCash = Number(s.cash_breakdown.expectedCash ?? s.expected_cash ?? openAmt);
            } else if (!isOpen && s.expected_cash != null) {
              expCash = Number(s.expected_cash);
              cashBreakdownLines = null;
            } else {
              const bd = computeShiftCash({
                openingCash: openAmt,
                invoices: shiftInvoices,
                purchases: shiftPurchases,
                vouchers: shiftVouchers,
                expenses: shiftExpenses,
                tokens: shiftTokens,
                shiftId: s.id,
              });
              expCash = bd.expectedCash;
              cashBreakdownLines = bd;
            }

            const cashSalesAmt = cashBreakdownLines?.cashSales ??
              salesInvs.reduce((sum: number, i: any) => {
                const cp = Number(i.cash_paid || 0);
                if (cp > 0) return sum + cp;
                if (!i.payment_type || i.payment_type === 'cash') return sum + Number(i.paid_amount || i.net_total || 0);
                return sum;
              }, 0);
            const cashSales = cashSalesAmt;

            const creditSales = salesInvs.reduce((sum: number, i: any) => {
              const due = Number(i.due_amount || 0);
              if (due > 0) return sum + due;
              if (i.payment_type === 'credit') return sum + Number(i.net_total || 0);
              return sum;
            }, 0);

            const bankSales = salesInvs.reduce((sum: number, i: any) => {
              const bp = Number(i.bank_paid || 0) + Number(i.card_paid || 0);
              if (bp > 0) return sum + bp;
              if (i.payment_type === 'bank' || i.payment_type === 'card') {
                return sum + Number(i.paid_amount || i.net_total || 0);
              }
              return sum;
            }, 0);

            // B8: Others / Cheque tender bucket
            const othersSales = salesInvs.reduce((sum: number, i: any) => {
              const op = Number(i.others_paid || 0);
              if (op > 0) return sum + op;
              const cp = Number(i.cash_paid || 0);
              const bp = Number(i.bank_paid || 0) + Number(i.card_paid || 0);
              if (cp === 0 && bp === 0) {
                const pt = (i.payment_type || '').toLowerCase();
                if (pt === 'cheque' || pt === 'others') return sum + Number(i.paid_amount || 0);
              }
              return sum;
            }, 0);

            const variance = isOpen ? 0 : (closeAmt - expCash);
            const varianceStatus: 'MATCHED' | 'SHORT' | 'EXCESS' =
              isOpen ? 'MATCHED' : (variance === 0 ? 'MATCHED' : (variance < 0 ? 'SHORT' : 'EXCESS'));

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

            // B9: Only compare when a previous closed shift exists.
            // If there is no previous closed shift for the tenant/counter, previous_closing_cash is NULL
            // and handover_variance is NULL/0, and DayCloseView must not render the "Excess Cash Found" banner.
            const hasPrevClosedShift = Boolean(
              s.previous_closing_cash !== null &&
              s.previous_closing_cash !== undefined &&
              s.handover_notes !== 'First shift of the day' &&
              !(Number(s.previous_closing_cash) === 0 && (!s.handover_notes || !s.handover_notes.toLowerCase().startsWith('handover:')))
            );

            const prevClosingCash = hasPrevClosedShift ? Number(s.previous_closing_cash || 0) : null;
            const handoverVarianceAmt = hasPrevClosedShift && s.handover_variance !== null && s.handover_variance !== undefined
              ? Number(s.handover_variance)
              : null;
            const handoverStatus: 'MATCHED' | 'SHORT' | 'EXCESS' | undefined =
              handoverVarianceAmt !== null
                ? (handoverVarianceAmt === 0 ? 'MATCHED' : (handoverVarianceAmt < 0 ? 'SHORT' : 'EXCESS'))
                : undefined;

            const shiftTime = s.end_time
              ? new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (s.start_time
                ? `${new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Live)`
                : 'Open / Live');


            // FIX DB-13: Map opened_by UUID to a human-readable name.
            // Priority: closed_by name → notes field 'Opened/Closed by X' → UUID (trimmed) → fallback
            const resolveStaffName = (): string => {
              if (s.closed_by && typeof s.closed_by === 'string' && !s.closed_by.match(/^[0-9a-f-]{36}$/i)) {
                return s.closed_by;
              }
              if (s.notes) {
                const match = s.notes.match(/(?:opened|closed)\s+by\s+(.+)/i);
                if (match && match[1]) return match[1].trim();
              }
              if (s.opened_by && typeof s.opened_by === 'string' && !s.opened_by.match(/^[0-9a-f-]{36}$/i)) {
                return s.opened_by;
              }
              // Last resort: show truncated UUID so it's clear it's unresolved
              if (s.opened_by) return `Staff (${String(s.opened_by).substring(0, 8)}...)`;
              return 'Counter Staff';
            };

            return {
              id: s.id,
              status: s.status || (isOpen ? 'open' : 'closed'),
              isOpen,
              shiftTitle: `Register Shift #${s.id.substring(0, 4)}`,
              date: shiftDate,
              startTime: rawStartTime,
              shiftTime,
              cashierName: resolveStaffName(),
              registerNo: '01',
              financialSummary: {
                openingBalance: openAmt,
                cashSales,
                creditSales,
                bankCardSales: bankSales,
                othersSales,
                pettyExpenses: totalExpensesAmt,
                tokenPayouts: tokensRedeemedAmt,
                expectedCash: expCash,
                actualCashCounted: closeAmt,
                varianceAmount: variance,
                varianceStatus,
              },
              commissionBreakdown: {
                totalSales: netShiftSales,
                commissionRate: commEnabled ? commRate : 0,
                commissionPool,
                staffShares,
              },
              pettyCashLogs: pettyLogs,
              ...(hasPrevClosedShift && prevClosingCash !== null && handoverVarianceAmt !== null && handoverStatus ? {
                handover: {
                  previousClosingCash: prevClosingCash,
                  openingCountedCash: openAmt,
                  handoverVariance: handoverVarianceAmt,
                  handoverStatus,
                  handoverNotes: s.handover_notes || undefined,
                },
              } : {}),
              cash_breakdown: cashBreakdownLines,
            };
          });

          // Compute same-day shift-to-shift delta AND cumulative daily cash variance
          const dateGroups = new Map<string, DayCloseRecord[]>();
          mapped.forEach(rec => {
            const existing = dateGroups.get(rec.date) || [];
            existing.push(rec);
            dateGroups.set(rec.date, existing);
          });
          dateGroups.forEach(group => {
            // N6: Sort by start_time timestamp (ascending) within the day, not by the 12-hour string
            group.sort((a, b) => {
              const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
              const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
              return timeA - timeB;
            });

            // Shift-to-shift sales delta (only meaningful with 2+ shifts)
            if (group.length >= 2) {
              for (let i = 1; i < group.length; i++) {
                const prevNet = group[i - 1].commissionBreakdown.totalSales;
                const currNet = group[i].commissionBreakdown.totalSales;
                const deltaAmt = currNet - prevNet;
                group[i].sameDayDelta = {
                  amount: Math.abs(deltaAmt),
                  direction: deltaAmt > 0 ? 'more' : deltaAmt < 0 ? 'less' : 'same',
                  previousShiftNetSales: prevNet,
                };
              }
            }

            // Cumulative daily cash variance across all CLOSED shifts on this day
            const closedShifts = group.filter(r => !r.isOpen);
            if (closedShifts.length > 0) {
              const totalVariance = closedShifts.reduce(
                (sum, r) => sum + r.financialSummary.varianceAmount,
                0
              );
              const allShort = closedShifts.every(
                r => r.financialSummary.varianceStatus === 'SHORT'
              );
              const payload = { totalVariance, shiftCount: closedShifts.length, allShort };
              // Stamp every record in the group so any active selection can read it
              group.forEach(r => { r.dailyCashVariance = payload; });
            }
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
  }, [branch?.id, branch?.slug]);
  // FIX CEO-08: removed selectedRecordId from deps — it caused a new fetch every time
  // the user clicked a shift, creating a 4x re-fetch loop on every selection.

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (startDate && s.date && s.date < startDate) return false;
      if (endDate && s.date && s.date > endDate) return false;
      return true;
    });
  }, [shifts, startDate, endDate]);

  // FIX CEO-09: do NOT fall back to shifts[0] when the date filter has no matching shifts.
  // The old fallback silently showed a stale record from a different date range.
  const activeRecord: DayCloseRecord | undefined = useMemo(() => {
    return filteredShifts.find((r) => r.id === selectedRecordId) || filteredShifts[0];
  }, [filteredShifts, selectedRecordId]);

  if (!activeRecord) {
    return (
      <div id="executive-day-close-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Shift-End Cash Drawer Reconciliation
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>
              {branch.name} • End-of-shift drawer balancing, cash counting &amp; variance audits
            </p>
          </div>
        </div>
        <div style={{ padding: '48px', textAlign: 'center', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#64748B', backgroundColor: '#FFFFFF' }}>
          <CalendarCheck style={{ width: '32px', height: '32px', color: '#D97706', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>No Shift Reconciliation Records</div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Shift-End Cash Drawer Reconciliation
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>{activeRecord.date}</span>
            <span>•</span>
            <span className="ceo-font-mono" style={{ color: '#0F172A' }}>{activeRecord.shiftTime}</span>
            <span>•</span>
            <span style={{ color: '#0F172A' }}>{activeRecord.cashierName} (Reg {activeRecord.registerNo})</span>
          </div>
        </div>

        {/* Historical Shift Picker + Date Period */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <DatePeriodFilter
            startDate={startDate}
            endDate={endDate}
            onChangeStartDate={setStartDate}
            onChangeEndDate={setEndDate}
          />

          {filteredShifts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Shift:</span>
              <select
                value={activeRecord.id}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#0F172A', outline: 'none', cursor: 'pointer' }}
              >
                {filteredShifts.map((r) => (
                  <option key={r.id} value={r.id} style={{ backgroundColor: '#FFFFFF', color: '#0F172A' }}>
                    {r.date} — {r.shiftTime} {r.status === 'open' ? '🟢 (Open / Live)' : `(${r.financialSummary.varianceStatus})`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Handover Variance Alert ── */}
      {activeRecord.handover && (
        <div style={{
          border: `1px solid ${activeRecord.handover.handoverStatus === 'SHORT' ? '#EF4444' : activeRecord.handover.handoverStatus === 'EXCESS' ? '#F59E0B' : '#34D399'}`,
          borderRadius: '10px',
          padding: '16px 20px',
          backgroundColor: activeRecord.handover.handoverStatus === 'SHORT' ? 'rgba(239,68,68,0.07)' : activeRecord.handover.handoverStatus === 'EXCESS' ? 'rgba(245,158,11,0.07)' : 'rgba(52,211,153,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '22px' }}>
              {activeRecord.handover.handoverStatus === 'SHORT' ? '⚠️' : activeRecord.handover.handoverStatus === 'EXCESS' ? '🔶' : '✅'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: activeRecord.handover.handoverStatus === 'SHORT' ? '#EF4444' : activeRecord.handover.handoverStatus === 'EXCESS' ? '#F59E0B' : '#34D399' }}>
                Shift Handover — {activeRecord.handover.handoverStatus === 'SHORT' ? 'Cash Shortage Detected' : activeRecord.handover.handoverStatus === 'EXCESS' ? 'Excess Cash Found' : 'Cash Matched'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Prev shift closed with {formatCurrency(activeRecord.handover.previousClosingCash)} →
                This shift opened with {formatCurrency(activeRecord.handover.openingCountedCash)}
              </div>
              {activeRecord.handover.handoverStatus === 'SHORT' && (
                <div style={{ fontSize: '11px', color: '#FCA5A5', marginTop: '4px' }}>
                  🔒 Security Note: Rs. {Math.abs(activeRecord.handover.handoverVariance).toLocaleString()} missing between shift handover. Requires investigation.
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Handover Variance</div>
            <div className="ceo-font-mono" style={{
              fontSize: '22px',
              fontWeight: 800,
              color: activeRecord.handover.handoverStatus === 'SHORT' ? '#EF4444' : activeRecord.handover.handoverStatus === 'EXCESS' ? '#F59E0B' : '#34D399',
            }}>
              {activeRecord.handover.handoverVariance >= 0 ? '+' : ''}
              {formatCurrency(activeRecord.handover.handoverVariance)}
            </div>
          </div>
        </div>
      )}

      {/* ── Cumulative Daily Cash Variance Alert (shown when ≥2 closed shifts exist on selected day) ── */}
      {activeRecord.dailyCashVariance && activeRecord.dailyCashVariance.shiftCount >= 2 && (
        <div style={{
          border: `1px solid ${activeRecord.dailyCashVariance.totalVariance < 0 ? '#EF4444' : activeRecord.dailyCashVariance.totalVariance > 0 ? '#F59E0B' : '#34D399'}`,
          borderRadius: '10px',
          padding: '14px 20px',
          backgroundColor: activeRecord.dailyCashVariance.totalVariance < 0 ? 'rgba(239,68,68,0.07)' : activeRecord.dailyCashVariance.totalVariance > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(52,211,153,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '20px' }}>
              {activeRecord.dailyCashVariance.totalVariance < 0 ? '🔴' : activeRecord.dailyCashVariance.totalVariance > 0 ? '🟡' : '✅'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: activeRecord.dailyCashVariance.totalVariance < 0 ? '#EF4444' : activeRecord.dailyCashVariance.totalVariance > 0 ? '#F59E0B' : '#34D399' }}>
                {activeRecord.dailyCashVariance.totalVariance < 0
                  ? `Daily Cash Shortage — ${activeRecord.dailyCashVariance.allShort ? 'All Shifts Reported Short' : 'Combined Deficit Across Shifts'}`
                  : activeRecord.dailyCashVariance.totalVariance > 0
                  ? 'Daily Cash Excess — Combined Surplus Across Shifts'
                  : 'Daily Cash Balanced — All Shifts Matched'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Across {activeRecord.dailyCashVariance.shiftCount} closed shifts on {activeRecord.date}
                {activeRecord.dailyCashVariance.allShort && activeRecord.dailyCashVariance.totalVariance < 0 && (
                  <span style={{ color: '#FCA5A5', fontWeight: 600, marginLeft: '6px' }}>
                    ⚠️ Back-to-back shortages — escalate for investigation
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Daily Variance</div>
            <div className="ceo-font-mono" style={{
              fontSize: '22px',
              fontWeight: 800,
              color: activeRecord.dailyCashVariance.totalVariance < 0 ? '#EF4444' : activeRecord.dailyCashVariance.totalVariance > 0 ? '#F59E0B' : '#34D399',
            }}>
              {activeRecord.dailyCashVariance.totalVariance > 0 ? '+' : ''}
              {formatCurrency(activeRecord.dailyCashVariance.totalVariance)}
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Reconciliation Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {/* CARD 1: Financial Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ceo-card">
            <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }}>
              Cash Flow Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>Opening Cash Drawer</span>
                <span className="ceo-font-mono" style={{ color: '#0F172A', fontWeight: 600 }}>{formatCurrency(financialSummary.openingBalance)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>(+) Register Cash Sales</span>
                <span className="ceo-font-mono" style={{ color: '#34D399', fontWeight: 600 }}>{formatCurrency(financialSummary.cashSales)}</span>
              </div>

              {activeRecord.cash_breakdown?.cashRefundsOnSalesReturns > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>(-) Cash Refunds (Returns)</span>
                  <span className="ceo-font-mono" style={{ color: '#F87171' }}>{formatCurrency(activeRecord.cash_breakdown.cashRefundsOnSalesReturns)}</span>
                </div>
              )}

              {activeRecord.cash_breakdown?.supplierCashPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>(-) Supplier Cash Paid</span>
                  <span className="ceo-font-mono" style={{ color: '#F87171' }}>{formatCurrency(activeRecord.cash_breakdown.supplierCashPaid)}</span>
                </div>
              )}

              {activeRecord.cash_breakdown?.supplierReturnCashReceived > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>(+) Supplier Returns (Cash In)</span>
                  <span className="ceo-font-mono" style={{ color: '#34D399' }}>{formatCurrency(activeRecord.cash_breakdown.supplierReturnCashReceived)}</span>
                </div>
              )}

              {activeRecord.cash_breakdown?.voucherCashReceipts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>(+) Voucher Cash In</span>
                  <span className="ceo-font-mono" style={{ color: '#34D399' }}>{formatCurrency(activeRecord.cash_breakdown.voucherCashReceipts)}</span>
                </div>
              )}

              {activeRecord.cash_breakdown?.voucherCashPayments > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>(-) Voucher Cash Out</span>
                  <span className="ceo-font-mono" style={{ color: '#F87171' }}>{formatCurrency(activeRecord.cash_breakdown.voucherCashPayments)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>(-) Petty Cash Expenses</span>
                <span className="ceo-font-mono" style={{ color: '#F87171' }}>{formatCurrency(financialSummary.pettyExpenses)}</span>
              </div>

              {financialSummary.tokenPayouts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>(-) Token Cash Payouts</span>
                  <span className="ceo-font-mono" style={{ color: '#F87171' }}>{formatCurrency(financialSummary.tokenPayouts)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '11px', marginTop: '6px', borderTop: '1px dashed #E2E8F0', paddingTop: '6px' }}>
                <span>Sales (Credit / Udhaar)</span>
                <span className="ceo-font-mono">{formatCurrency(financialSummary.creditSales)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '11px' }}>
                <span>Sales (Bank / Card)</span>
                <span className="ceo-font-mono">{formatCurrency(financialSummary.bankCardSales)}</span>
              </div>

              {(financialSummary.othersSales ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: '11px' }}>
                  <span>Sales (Others / Cheque)</span>
                  <span className="ceo-font-mono">{formatCurrency(financialSummary.othersSales!)}</span>
                </div>
              )}

              <div style={{ paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>Expected Cash</span>
                <span className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                  {formatCurrency(financialSummary.expectedCash)}
                </span>
              </div>

              {/* Feature #3: Same-day shift-to-shift delta */}
              {activeRecord.sameDayDelta && (
                <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '6px', background: activeRecord.sameDayDelta.direction === 'less' ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', border: `1px solid ${activeRecord.sameDayDelta.direction === 'less' ? '#7F1D1D' : '#064E3B'}` }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>vs Previous Shift Today</div>
                  <div className="ceo-font-mono" style={{ fontSize: '13px', fontWeight: 700, color: activeRecord.sameDayDelta.direction === 'less' ? '#F87171' : '#34D399' }}>
                    {formatCurrency(activeRecord.sameDayDelta.amount)} {activeRecord.sameDayDelta.direction === 'same' ? '— same as' : activeRecord.sameDayDelta.direction} than previous shift
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    Previous shift net sales: {formatCurrency(activeRecord.sameDayDelta.previousShiftNetSales)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Variance Status Card */}
          <div className="ceo-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="ceo-font-heading" style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Physical Cash Audit
              </h3>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                backgroundColor: activeRecord.status === 'open' ? 'rgba(59, 130, 246, 0.15)' : (financialSummary.varianceStatus === 'MATCHED' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)'),
                color: activeRecord.status === 'open' ? '#60A5FA' : (financialSummary.varianceStatus === 'MATCHED' ? '#34D399' : '#F87171'),
              }}>
                {activeRecord.status === 'open' ? 'OPEN / LIVE' : financialSummary.varianceStatus}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0' }}>
              {activeRecord.status === 'open' ? 'Shift currently active. Reconciliation will be verified at shift close.' : 'Physical counted drawer vs Expected system register balance'}
            </p>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase' }}>
                  {activeRecord.status === 'open' ? 'EXPECTED DRAWER' : 'ACTUAL COUNTED CASH'}
                </div>
                <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#34D399', marginTop: '2px' }}>
                  {activeRecord.status === 'open' ? formatCurrency(financialSummary.expectedCash) : formatCurrency(financialSummary.actualCashCounted)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase' }}>
                  {activeRecord.status === 'open' ? 'AUDIT STATUS' : 'DRAWER VARIANCE'}
                </div>
                <div className="ceo-font-mono" style={{ fontSize: '18px', fontWeight: 700, color: activeRecord.status === 'open' ? '#60A5FA' : (financialSummary.varianceAmount < 0 ? '#F87171' : '#34D399'), marginTop: '2px' }}>
                  {activeRecord.status === 'open' ? 'In Progress' : formatCurrency(financialSummary.varianceAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Staff Commission Pool */}
        <div className="ceo-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users style={{ width: '18px', height: '18px', color: '#D97706' }} />
            <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Staff Sales Commission Pool
            </h3>
          </div>
          <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 16px' }}>
            {commissionBreakdown.commissionRate}% allocated pool from total shift revenue
          </p>

          <div style={{ padding: '14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase' }}>COMMISSION POOL VALUE</div>
                <div className="ceo-font-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#D97706', marginTop: '2px' }}>
                  {formatCurrency(commissionBreakdown.commissionPool)}
                </div>
              </div>
              <span className="ceo-font-mono" style={{ fontSize: '11px', color: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                {commissionBreakdown.commissionRate}% Rate
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
              Staff Distribution Shares
            </div>
            {commissionBreakdown.staffShares.map((staff) => (
              <div key={staff.id} style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{staff.name}</div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>Role: {staff.role} ({staff.sharePct}%)</div>
                </div>
                <div className="ceo-font-mono" style={{ fontWeight: 700, color: '#D97706' }}>
                  {formatCurrency(staff.amount)}
                </div>
              </div>
            ))}
            {commissionBreakdown.staffShares.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748B', fontSize: '11px' }}>
                Pool calculated automatically based on register activity.
              </div>
            )}
          </div>
        </div>

        {/* CARD 3: Petty Cash Expenses Log */}
        <div className="ceo-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Coffee style={{ width: '18px', height: '18px', color: '#F87171' }} />
            <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Petty Cash Vouchers
            </h3>
          </div>
          <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 16px' }}>
            Counter petty expenses deducted during this shift
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pettyCashLogs.map((log) => (
              <div key={log.id} style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{log.title}</div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>Dept: {log.department} • Time: {log.time}</div>
                </div>
                <div className="ceo-font-mono" style={{ fontWeight: 700, color: '#F87171' }}>
                  -{formatCurrency(log.amount)}
                </div>
              </div>
            ))}
            {pettyCashLogs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '12px' }}>
                No petty expenses recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
