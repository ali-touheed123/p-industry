import React from 'react';
import { 
  Wifi, 
  Bell, 
  Calendar, 
  MessageSquare, 
  Lock, 
  Plus 
} from 'lucide-react';

export const DayCloseView: React.FC = () => {
  return (
    <div className="w-full space-y-3.5 bg-[#EEF2F6] p-4 flex flex-col justify-between">
      {/* Top Bar: Counter 01 & Status */}
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

      {/* Title & Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Shift End Reconciliation</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>28 Aug 2026</span>
            </span>
            <span>•</span>
            <span className="text-rose-500 font-semibold">Active Register</span>
            <span>•</span>
            <span>hamza paint Counter 01</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
            <MessageSquare className="w-3.5 h-3.5 fill-white" />
            <span>WhatsApp</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
            <Lock className="w-3.5 h-3.5" />
            <span>Close & Reconcile</span>
          </button>
        </div>
      </div>

      {/* 4 Reconciliation Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Expected Cash */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              EXPECTED CASH
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              BALANCED
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1">
            Rs. 31,750
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Counted: Rs. 31,750</div>
        </div>

        {/* Net Sales */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              NET SALES
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              8 Bills
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">
            Rs. 125,000
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Gross: Rs. 130,000 (-5,000)</div>
        </div>

        {/* Purchases */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              PURCHASES
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
              0 Orders
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1">
            Rs. 0
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Paid Cash: <span className="text-red-500 font-bold">Rs. 0</span></div>
        </div>

        {/* Petty Expenses */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              PETTY EXPENSES
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
              3 Entries
            </span>
          </div>
          <div className="text-2xl font-extrabold text-red-600 font-mono mt-1">
            - Rs. 3,250
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Staff & Tea Expenses</div>
        </div>
      </div>

      {/* 3 Detail Panels */}
      <div className="grid grid-cols-12 gap-3.5 flex-1 items-start">
        
        {/* Panel 1: Cash Reconciliation (col-span-4) */}
        <div className="col-span-4 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase">
              <span>💵</span>
              <span>CASH RECONCILIATION</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase">DARAZ HISAB</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Opening Cash</span>
              <span className="font-bold font-mono text-slate-900">Rs. 15,000</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600">
              <span>(+) Cash Sales Inflow</span>
              <span className="font-bold font-mono">+ Rs. 25,000</span>
            </div>
            <div className="flex items-center justify-between text-red-600">
              <span>(-) Customer Returns</span>
              <span className="font-bold font-mono">- Rs. 5,000</span>
            </div>
            <div className="flex items-center justify-between text-red-600">
              <span>(-) Petty Expenses</span>
              <span className="font-bold font-mono">- Rs. 3,250</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-950">
              <span>Expected Cash</span>
              <span className="font-mono text-sm">Rs. 31,750</span>
            </div>
          </div>

          {/* Counted Cash Input */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">COUNTED PHYSICAL CASH</span>
              <span className="text-[10px] font-bold text-emerald-600">Exact Match</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs text-slate-400 font-mono">Rs.</span>
              <input 
                type="text" 
                defaultValue="31750" 
                className="w-full bg-transparent font-bold font-mono text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Sales & Commission Breakdown (col-span-4) */}
        <div className="col-span-4 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase">
              <span>📊</span>
              <span>SALES & COMMISSION</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase">BREAKDOWN</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Cash Sales</span>
              <span className="font-bold font-mono text-slate-900">Rs. 25,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Credit / Udhaar</span>
              <span className="font-bold font-mono text-slate-900">Rs. 65,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Bank / Online</span>
              <span className="font-bold font-mono text-slate-900">Rs. 20,000</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-950">
              <span>Gross Total Sales</span>
              <span className="font-mono text-sm">Rs. 130,000</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Petty Cash Log (col-span-4) */}
        <div className="col-span-4 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase">
              <span>💸</span>
              <span>PETTY CASH LOG</span>
            </div>
            <button className="px-2 py-0.5 bg-[#FF6B00] text-white text-[10px] font-bold rounded-md flex items-center gap-1">
              <Plus className="w-2.5 h-2.5" />
              <span>Add Expense</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">saad</div>
                <div className="text-[9px] text-slate-400 font-mono">Staff - 2026-08-28T10:10:04.364906+00:00</div>
              </div>
              <div className="font-mono font-bold text-red-600">Rs. 1,500</div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">faizan</div>
                <div className="text-[9px] text-slate-400 font-mono">Staff - 2026-08-28T10:09:51.962187+00:00</div>
              </div>
              <div className="font-mono font-bold text-red-600">Rs. 1,000</div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">khana</div>
                <div className="text-[9px] text-slate-400 font-mono">Staff - 2026-08-28T10:09:39.425206+00:00</div>
              </div>
              <div className="font-mono font-bold text-red-600">Rs. 750</div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold text-xs">
              <span className="text-slate-700">Total Expenses:</span>
              <span className="font-mono text-red-600">- Rs. 3,250</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
