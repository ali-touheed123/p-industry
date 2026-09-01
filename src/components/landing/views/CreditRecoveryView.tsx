import React from 'react';
import { 
  Wifi, 
  Bell, 
  Search, 
  Plus, 
  Calendar, 
  Scale, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';

export const CreditRecoveryView: React.FC = () => {
  return (
    <div className="w-full space-y-3.5 bg-[#EEF2F6] p-4 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-xs font-bold text-slate-700">01</span>
          <div>
            <div className="text-xs font-bold text-slate-900 leading-tight">hamza paint Counter 01</div>
            <div className="text-[10px] font-mono text-slate-500">Register: COUNTER1</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>Online</span>
          </span>
          <button className="p-1 text-slate-400 hover:text-slate-600">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Credit & Recovery (Udhaar)</h2>
          <p className="text-xs text-slate-500 font-medium">Track customer overdue balances, payment collections, and recovery logs</p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Record Payment Received</span>
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">TOTAL PENDING RECEIVABLES</div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono mt-1">Rs. 92,500</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across 4 contractor accounts</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">COLLECTED THIS WEEK</div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">Rs. 45,000</div>
          <div className="text-[10px] text-slate-500 mt-0.5">3 installments deposited</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">OVERDUE {'>'} 30 DAYS</div>
          <div className="text-2xl font-extrabold text-red-600 font-mono mt-1">Rs. 12,000</div>
          <div className="text-[10px] text-slate-500 mt-0.5">1 contractor flagged for follow-up</div>
        </div>
      </div>

      {/* Recovery Table */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-400">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Filter credit ledgers by customer name or phone...</span>
        </div>

        <div className="border border-slate-200/80 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">CUSTOMER</th>
                <th className="py-2.5 px-2">CONTACT</th>
                <th className="py-2.5 px-2">LAST PAYMENT</th>
                <th className="py-2.5 px-2">DUE DATE</th>
                <th className="py-2.5 px-2">TOTAL CREDIT</th>
                <th className="py-2.5 px-2 text-center">STATUS</th>
                <th className="py-2.5 px-3 text-right">COLLECTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 px-3 font-bold text-slate-900">shayan pstar</td>
                <td className="py-2.5 px-2 font-mono text-slate-600">0300-1234567</td>
                <td className="py-2.5 px-2 font-mono text-slate-500">24 Aug 2026</td>
                <td className="py-2.5 px-2 font-mono text-amber-600 font-medium">31 Aug 2026</td>
                <td className="py-2.5 px-2 font-mono font-bold text-slate-900">Rs. 55,000</td>
                <td className="py-2.5 px-2 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                    Active Udhaar
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button className="px-2.5 py-1 bg-[#FF6B00] text-white text-[11px] font-bold rounded-lg shadow-2xs hover:bg-[#E55F00]">
                    Receive Cash
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 px-3 font-bold text-slate-900">ali</td>
                <td className="py-2.5 px-2 font-mono text-slate-600">0321-7654321</td>
                <td className="py-2.5 px-2 font-mono text-slate-500">27 Aug 2026</td>
                <td className="py-2.5 px-2 font-mono text-amber-600 font-medium">05 Sep 2026</td>
                <td className="py-2.5 px-2 font-mono font-bold text-slate-900">Rs. 5,000</td>
                <td className="py-2.5 px-2 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                    Active Udhaar
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button className="px-2.5 py-1 bg-[#FF6B00] text-white text-[11px] font-bold rounded-lg shadow-2xs hover:bg-[#E55F00]">
                    Receive Cash
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
