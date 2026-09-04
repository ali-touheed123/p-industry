import React from 'react';
import { 
  Bell, 
  Search, 
  Barcode, 
  Plus, 
  Printer, 
  Save, 
  XCircle, 
  CheckCircle2, 
  CalendarDays, 
  User, 
  RotateCcw, 
  FileText,
  Boxes,
  PauseCircle
} from 'lucide-react';

export const PosBillingView: React.FC = () => {
  return (
    <div className="grid grid-cols-10 flex-1">
      {/* 2. CENTER WORKSPACE (7 of 10 cols) */}
      <div className="col-span-7 p-3.5 flex flex-col justify-between space-y-3 bg-[#EEF2F6]">
        
        {/* Top Bar: Counter Staff & F2-F9 Shortcuts */}
        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-xs font-bold text-slate-700">01</span>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">Counter Staff</div>
              <div className="text-[10px] font-mono text-slate-500">Active Register: 01</div>
            </div>
          </div>

          {/* Shortcut Keys Badge Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F2</strong> Save
            </span>
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F3</strong> Search
            </span>
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F4</strong> Add Item
            </span>
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F5</strong> Save & Print
            </span>
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F7</strong> Hold
            </span>
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F8</strong> Hold List
            </span>
            <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium">
              <strong className="text-[#C2410C]">F9</strong> Cancel
            </span>
          </div>

          <button type="button" aria-label="Notifications" className="p-1 text-slate-500 hover:text-slate-700">
            <Bell className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Header Tabs & Info Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button className="px-3.5 py-1.5 bg-[#EA580C] text-white text-xs font-bold rounded-lg shadow-xs">
              Sales Invoice
            </button>
            <button className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50">
              Credit Note (Return)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800">
              <span className="text-slate-600 text-[11px] font-sans font-medium uppercase mr-1">INVOICE #</span>
              <strong className="font-bold text-slate-900">INV-72358</strong>
            </div>
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 flex items-center gap-1.5">
              <span className="text-slate-600 text-[11px] font-sans font-medium uppercase">DATE</span>
              <strong className="font-bold">27/08/2026</strong>
              <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-sans font-semibold flex items-center gap-1 hover:bg-slate-50">
              <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Hold (F7)</span>
            </button>
          </div>
        </div>

        {/* 3 Detail Cards (Customer Account, Customer History, Remarks) */}
        <div className="grid grid-cols-12 gap-2.5">
          {/* Customer Account */}
          <div className="col-span-4 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#C2410C] uppercase tracking-wider mb-1.5">
              <User className="w-3 h-3" />
              <span>CUSTOMER ACCOUNT</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
              <span>Walk-in Customer</span>
              <Search className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>

          {/* Customer History */}
          <div className="col-span-4 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700 mb-1.5">
              <div className="flex items-center gap-1 text-[#C2410C]">
                <RotateCcw className="w-3 h-3" />
                <span className="uppercase tracking-wider">CUSTOMER HISTORY</span>
              </div>
              <span className="text-[10px] font-normal text-slate-600">Walk-in</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <div>
                <div className="text-[9px] text-slate-600">Last Purchase</div>
                <div className="font-semibold text-slate-700">—</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-600">Total Sales</div>
                <div className="font-semibold text-slate-700">—</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-600">Outstanding</div>
                <div className="font-bold text-emerald-600">Clear / No Overdue</div>
              </div>
            </div>
          </div>

          {/* Remarks & Notes */}
          <div className="col-span-4 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              <FileText className="w-3 h-3 text-[#C2410C]" />
              <span>REMARKS & NOTES</span>
            </div>
            <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 truncate">
              Optional invoice notes or gate pass r...
            </div>
          </div>
        </div>

        {/* Product Search Bar & Add Item Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/90 shadow-2xs text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">Search product by name, code, barcode or shade... (F3)</span>
            </div>
            <Barcode className="w-5 h-4 text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-slate-200/90 text-xs font-mono">
            <span className="text-slate-600 text-[10px] font-sans uppercase">QTY:</span>
            <strong className="font-bold text-slate-900 text-sm">1</strong>
          </div>

          <button className="flex items-center gap-1.5 px-4 py-2 bg-[#EA580C] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#C2410C] cursor-pointer">
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Item (F4)</span>
          </button>
        </div>

        {/* Items Table Header & Body with cells */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th scope="col" className="py-2.5 px-3">#</th>
                <th scope="col" className="py-2.5 px-2">CODE</th>
                <th scope="col" className="py-2.5 px-2">PRODUCT</th>
                <th scope="col" className="py-2.5 px-2">SHADE</th>
                <th scope="col" className="py-2.5 px-2">PACK / UNIT</th>
                <th scope="col" className="py-2.5 px-2 text-center">QTY</th>
                <th scope="col" className="py-2.5 px-2">UNIT</th>
                <th scope="col" className="py-2.5 px-2 text-right">RATE</th>
                <th scope="col" className="py-2.5 px-2 text-right">DISC %</th>
                <th scope="col" className="py-2.5 px-2 text-right">AMOUNT</th>
                <th scope="col" className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={11} className="p-8 text-center text-xs font-mono text-slate-600">
                  No items in current invoice. Search product above to add.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* 3. RIGHT BILLING SUMMARY PANEL (3 of 10 cols) */}
      <div className="col-span-3 bg-white p-3.5 border-l border-slate-200 flex flex-col justify-between space-y-3">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#FF6B00]" />
            <span className="font-bold text-xs text-slate-900 tracking-wider uppercase">BILLING SUMMARY</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold border border-slate-200">
            0 Units
          </span>
        </div>

        {/* Subtotals & Adjustments */}
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-mono font-bold text-slate-900">0.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Discount (Item)</span>
            <span className="font-mono text-slate-700">0.00</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span>Invoice Discount</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600 font-mono">Rs.</span>
              <span className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-900">
                0
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span>Delivery Charge</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600 font-mono">Rs.</span>
              <span className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-slate-900">
                0
              </span>
            </div>
          </div>
        </div>

        {/* NET TOTAL Large Block */}
        <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
          <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">NET TOTAL</span>
          <span className="text-xl font-extrabold text-slate-950 font-mono">
            <span className="text-xs text-slate-600 font-normal mr-1">Rs.</span>
            0.00
          </span>
        </div>

        {/* PAYMENT Section Inputs */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="text-[10px] font-mono font-semibold text-slate-600 uppercase">PAYMENT</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] font-semibold text-slate-600 uppercase">CASH</div>
              <div className="mt-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 text-xs">
                0
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-slate-600 uppercase">CARD</div>
              <div className="mt-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 text-xs">
                0
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-slate-600 uppercase">BANK TRANSFER</div>
              <div className="mt-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 text-xs">
                0
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-slate-600 uppercase">OTHERS</div>
              <div className="mt-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 text-xs">
                0
              </div>
            </div>
          </div>

          {/* Paid Amount & Balance Tag */}
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-slate-600">Paid Amount</span>
            <span className="font-mono font-bold text-slate-900">Rs. 0.00</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Balance</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span>Payment Success</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {/* Primary Orange Save & Print F5 */}
          <button className="w-full py-2.5 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer">
            <Printer className="w-4 h-4" />
            <span>SAVE & PRINT (F5)</span>
          </button>

          {/* Sub Actions Row */}
          <div className="grid grid-cols-2 gap-2">
            <button className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save (F2)</span>
            </button>
            <button className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
              <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
              <span>Hold (F7)</span>
            </button>
          </div>

          {/* Cancel Invoice F9 */}
          <button className="w-full py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Cancel Invoice (F9)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
