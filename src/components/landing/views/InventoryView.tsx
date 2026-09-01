import React from 'react';
import { 
  Plus, 
  Download, 
  Boxes, 
  Filter, 
  Pencil, 
  Search, 
  ChevronDown, 
  Wifi, 
  Bell 
} from 'lucide-react';

export const InventoryView: React.FC = () => {
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

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            TOTAL CATALOG SKUS
          </div>
          <div className="text-3xl font-extrabold text-slate-950 font-mono mt-1.5">
            1
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            UNITS IN STOCK
          </div>
          <div className="text-3xl font-extrabold text-slate-950 font-mono mt-1.5">
            5
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            STOCK VALUATION (WHOLESALE)
          </div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1.5">
            Rs. 0.23 Lac
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            LOW STOCK ALERTS
          </div>
          <div className="text-2xl font-extrabold text-red-600 font-mono mt-1.5">
            1 Items
          </div>
        </div>
      </div>

      {/* Lower Workspace: Filters & Table */}
      <div className="grid grid-cols-12 gap-3.5 flex-1 items-start">
        
        {/* Left Filter Column (col-span-3) */}
        <div className="col-span-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          
          {/* Header */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>FILTERS & GROUPING</span>
          </div>

          {/* Godown / Location */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-semibold text-slate-500 uppercase">
              GODOWN / LOCATION
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 cursor-pointer">
              <span>All Godowns & Vaults</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Stock Status */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono font-semibold text-slate-500 uppercase">
              STOCK STATUS
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#FF6B00] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                </span>
                <span>All Statuses</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Healthy Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span className="text-red-600 font-medium">Low Stock (1)</span>
              </label>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase">CATEGORIES</span>
              <span className="text-[10px] font-semibold text-[#FF6B00] cursor-pointer hover:underline">+ New</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#FF6B00] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                </span>
                <span>All</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Interior Emulsion</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Weather Shield Exterior</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Primers & Putty</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Synthetic Enamel</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Wood & Varnish</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Solvents & Thinners</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                <span>Accessories</span>
              </label>
            </div>
          </div>

        </div>

        {/* Right Inventory Table Column (col-span-9) */}
        <div className="col-span-9 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          
          {/* Top Search & Actions */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-400">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-400">Filter by SKU, product name, shade or category...</span>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer">
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer">
                <Boxes className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Receive Stock</span>
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>ADD PRODUCT</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200/80 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">CODE</th>
                  <th className="py-2.5 px-2">PRODUCT & SHADE ▲</th>
                  <th className="py-2.5 px-2">CATEGORY</th>
                  <th className="py-2.5 px-2">PACK SIZE</th>
                  <th className="py-2.5 px-2 text-center">STOCK</th>
                  <th className="py-2.5 px-2">RETAIL / WS / TRADE</th>
                  <th className="py-2.5 px-2 text-center">STATUS</th>
                  <th className="py-2.5 px-3 text-right">EDIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900 text-xs">
                    RG100
                  </td>
                  <td className="py-3 px-2">
                    <div className="font-bold text-slate-900">relaiance emulsion</div>
                    <div className="text-[11px] text-slate-400 font-mono">white100</div>
                  </td>
                  <td className="py-3 px-2 text-slate-600">
                    Interior Emulsi...
                  </td>
                  <td className="py-3 px-2 font-mono text-slate-700">
                    20L Dr...
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="font-bold font-mono text-red-600 text-sm">5</div>
                    <div className="text-[10px] text-slate-400 font-mono">Min: 5</div>
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">
                    <div className="font-bold text-slate-900">5,000</div>
                    <div className="text-slate-500 text-[11px]">4,700</div>
                    <div className="text-slate-400 text-[11px]">4,600</div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-200">
                      Low
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="p-1 text-slate-400 hover:text-slate-700">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
};
