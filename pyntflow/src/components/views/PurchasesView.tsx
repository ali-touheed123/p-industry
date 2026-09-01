import React from 'react';
import { 
  Wifi, 
  Bell, 
  RotateCcw, 
  Search, 
  Plus, 
  Calendar, 
  Building, 
  ArrowRight 
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  return (
    <div className="w-full space-y-3.5 bg-[#EEF2F6] p-4 flex flex-col justify-between">
      {/* Top Bar: Counter 01 & Status */}
      <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-xs font-bold text-slate-700">P-01</span>
          <div>
            <div className="text-xs font-bold text-slate-900 leading-tight">hamza paint Counter 01</div>
            <div className="text-[10px] font-mono text-slate-500">Register: P-01</div>
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

      {/* Action Mode Row: Purchase Invoice vs Return + Record # */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-[#FF6B00] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer">
            <Building className="w-3.5 h-3.5" />
            <span>Purchase Invoice</span>
          </button>
          <button className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Purchase Return</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600 flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">RECORD #:</span>
            <span className="font-bold text-slate-900">01</span>
          </div>

          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600 flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">P. INV #:</span>
            <span className="font-bold text-slate-900">P-INV-6835</span>
          </div>

          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-900">27/08/2026</span>
          </div>
        </div>
      </div>

      {/* Supplier & Credit Terms Cards */}
      <div className="grid grid-cols-12 gap-3">
        {/* Supplier Account Search */}
        <div className="col-span-6 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>SUPPLIER ACCOUNT</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
              NTN Verified
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400">
            <span>Search supplier name, phone, or city...</span>
            <Search className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Ledger & Credit Terms */}
        <div className="col-span-6 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
              LEDGER & CREDIT TERMS
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Paint Manufacturer
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-0.5 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 font-mono">Cur. Balance</div>
              <div className="font-bold text-slate-900 font-mono">Rs. 0</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-mono">Last Payment</div>
              <div className="font-bold text-slate-900 font-mono">Rs. 0</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-mono">Credit Terms</div>
              <div className="font-bold text-slate-900">15 Days Net</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-mono">City / Hub</div>
              <div className="font-bold text-slate-900">Industrial Hub</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Search & Table */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-400">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Search product by name, code, barcode or shade... (F3)</span>
          </div>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700">
            QTY: <span className="font-bold">1</span>
          </div>
          <button className="px-4 py-2 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Item (F4)</span>
          </button>
        </div>

        {/* Table */}
        <div className="border border-slate-200/80 rounded-lg overflow-hidden flex-1 min-h-[140px] flex flex-col justify-between">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-2">CODE</th>
                <th className="py-2.5 px-2">PRODUCT</th>
                <th className="py-2.5 px-2">SHADE</th>
                <th className="py-2.5 px-2">PACK / UNIT</th>
                <th className="py-2.5 px-2 text-center">QTY</th>
                <th className="py-2.5 px-2">UNIT</th>
                <th className="py-2.5 px-2">RATE</th>
                <th className="py-2.5 px-2">DISC %</th>
                <th className="py-2.5 px-2">AMOUNT</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
          </table>
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            No purchased items in current invoice. Search product above to add.
          </div>
        </div>

        {/* Bottom Total & Checkout */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-600 font-mono">
            Gross Subtotal: <span className="font-bold text-slate-900 font-mono text-sm">Rs. 0.00</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer">
              Clear Draft
            </button>
            <button className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer">
              <span>CHECKOUT</span>
              <span className="font-mono">Rs. 0</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
