import React from 'react';
import { 
  Wifi, 
  Bell, 
  Package, 
  ChevronDown, 
  Send 
} from 'lucide-react';

export const BranchOrdersView: React.FC = () => {
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

      {/* Title & Subtitle */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Branch Orders</h2>
        <p className="text-xs text-slate-500 font-medium">Order products from other branches or counters when out of stock</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button className="px-3.5 py-1.5 bg-white border border-slate-200 text-[#FF6B00] font-bold text-xs rounded-lg shadow-2xs">
          + Place Order
        </button>
        <button className="px-3.5 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium">
          My Requests (0)
        </button>
        <button className="px-3.5 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium">
          Incoming Orders (0)
        </button>
      </div>

      {/* Place Order Card */}
      <div className="max-w-2xl bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Package className="w-4 h-4 text-[#FF6B00]" />
          <span>Place New Branch Order</span>
        </div>

        {/* Source Branch selector & notice */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            ORDER FROM (SOURCE BRANCH / COUNTER) *
          </label>
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>🏢</span>
              <span>Koi doosri branch ya counter register nahi hai</span>
            </div>
            <div className="text-[11px] text-slate-600">
              Dusri branch (e.g. Branch 2, Branch 3 ya Central Godown) se samaan mangwane ke liye, Developer Panel me <span className="font-semibold text-slate-800">+ Create Branch</span> ya <span className="font-semibold text-slate-800">+ Add Counter</span> karein.
            </div>
            <div className="text-[11px] font-bold text-blue-600 hover:underline pt-0.5 cursor-pointer">
              + Open Developer Panel to Add Branch / Counter →
            </div>
          </div>
        </div>

        {/* Select Product & Qty */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8 space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              SELECT PRODUCT *
            </label>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium cursor-pointer">
              <span>RG100 — relaiance emulsion (5 in stock)</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="col-span-4 space-y-1.5">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              QUANTITY *
            </label>
            <input 
              type="number" 
              defaultValue={1}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            NOTES (OPTIONAL)
          </label>
          <textarea 
            placeholder="e.g. Urgently needed for customer order, please send ASAP"
            rows={2}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none resize-none"
          />
        </div>

        {/* Action Button */}
        <button className="w-full py-2.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer">
          <Send className="w-3.5 h-3.5" />
          <span>Place Order</span>
        </button>
      </div>

    </div>
  );
};
