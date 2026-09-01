import React from 'react';
import { 
  TrendingUp, 
  CreditCard, 
  Wallet, 
  Layers, 
  RefreshCw, 
  Download, 
  Printer, 
  Calendar, 
  Search, 
  Eye, 
  Share2, 
  ChevronRight, 
  ChevronDown 
} from 'lucide-react';

export const SalesView: React.FC = () => {
  const salesRows = [
    {
      inv: 'INV-16085',
      date: '2026-08-27 01:37 am',
      customer: 'shayan pstar',
      avatar: 'S',
      avatarColor: 'bg-blue-100 text-blue-700',
      payment: 'CREDIT',
      paymentColor: 'bg-amber-100 text-amber-800 border-amber-200',
      items: 0,
      subtotal: 'Rs. 55,000',
      discount: '—',
      netTotal: 'Rs. 55,000',
      paid: 'Rs. 0',
      balance: 'Rs. 55,000',
      status: 'DUE / CREDIT',
      statusColor: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold'
    },
    {
      inv: 'INV-97810',
      date: '2026-08-27 01:32 am',
      customer: 'Walk-in Customer',
      avatar: 'W',
      avatarColor: 'bg-slate-100 text-slate-700',
      payment: 'CASH',
      paymentColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      items: 0,
      subtotal: 'Rs. 5,000',
      discount: '—',
      netTotal: 'Rs. 5,000',
      paid: 'Rs. 5,000',
      balance: 'Rs. 0',
      status: 'PAID',
      statusColor: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold'
    },
    {
      inv: 'INV-47761',
      date: '2026-08-27 01:28 am',
      customer: 'Walk-in Customer',
      avatar: 'W',
      avatarColor: 'bg-slate-100 text-slate-700',
      payment: 'CREDIT',
      paymentColor: 'bg-amber-100 text-amber-800 border-amber-200',
      items: 0,
      subtotal: 'Rs. 5,000',
      discount: '—',
      netTotal: 'Rs. 5,000',
      paid: 'Rs. 0',
      balance: 'Rs. 5,000',
      status: 'DUE / CREDIT',
      statusColor: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold'
    },
    {
      inv: 'INV-24546',
      date: '2026-08-27 01:26 am',
      customer: 'ali',
      avatar: 'A',
      avatarColor: 'bg-indigo-100 text-indigo-700',
      payment: 'CREDIT',
      paymentColor: 'bg-amber-100 text-amber-800 border-amber-200',
      items: 0,
      subtotal: 'Rs. 5,000',
      discount: '—',
      netTotal: 'Rs. 5,000',
      paid: 'Rs. 0',
      balance: 'Rs. 5,000',
      status: 'DUE / CREDIT',
      statusColor: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold'
    },
    {
      inv: 'INV-68531',
      date: '2026-08-27 01:12 am',
      customer: 'ali',
      avatar: 'A',
      avatarColor: 'bg-indigo-100 text-indigo-700',
      payment: 'CASH',
      paymentColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      items: 0,
      subtotal: 'Rs. 5,000',
      discount: '—',
      netTotal: 'Rs. 5,000',
      paid: 'Rs. 5,000',
      balance: 'Rs. 0',
      status: 'PAID',
      statusColor: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold'
    },
    {
      inv: 'INV-91903',
      date: '2026-08-27 01:11 am',
      customer: 'Walk-in Customer',
      avatar: 'W',
      avatarColor: 'bg-slate-100 text-slate-700',
      payment: 'CASH',
      paymentColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      items: 0,
      subtotal: 'Rs. 10,000',
      discount: '—',
      netTotal: 'Rs. 10,000',
      paid: 'Rs. 10,000',
      balance: 'Rs. 0',
      status: 'PAID',
      statusColor: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold'
    },
    {
      inv: 'INV-19400',
      isReturn: true,
      date: '2026-08-26 03:09 pm',
      customer: 'Walk-in Customer',
      avatar: 'W',
      avatarColor: 'bg-slate-100 text-slate-700',
      payment: 'CASH',
      paymentColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      items: 0,
      subtotal: 'Rs. 5,000',
      discount: '—',
      netTotal: '-Rs. 5,000',
      paid: 'Rs. 5,000',
      balance: 'Rs. 0',
      status: 'RETURN',
      statusColor: 'bg-rose-50 text-rose-700 border border-rose-300 font-bold'
    }
  ];

  return (
    <div className="w-full space-y-3.5 bg-[#EEF2F6] p-4 flex flex-col justify-between">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-xl text-white">
            <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Sales Register & Invoices</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                14 Invoices
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              hamza paint • Live sales reporting, invoice history & item breakdowns
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              NET SALES
            </span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1">
            Rs. 158,500
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">12 completed sales</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              CASH INFLOW
            </span>
            <span className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Wallet className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1">
            Rs. 98,500
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Direct cash received</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              CREDIT (UDHAR)
            </span>
            <span className="p-1 rounded-md bg-amber-50 text-amber-600">
              <CreditCard className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono mt-1">
            Rs. 70,000
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Client ledger balance</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              VOLUME SOLD
            </span>
            <span className="p-1 rounded-md bg-purple-50 text-purple-600">
              <Layers className="w-3 h-3" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1">
            0 <span className="text-xs font-normal text-slate-500">units</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avg ticket: Rs. 14,042</div>
        </div>
      </div>

      {/* Date Filter & Search Row */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#FF6B00] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Date Period:</span>
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono text-[11px]">
              <span className="text-slate-400">FROM:</span>
              <span>dd/mm/yyyy</span>
              <Calendar className="w-3 h-3 text-slate-400 ml-1" />
            </div>
            <span className="text-slate-400">→</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-mono text-[11px]">
              <span className="text-slate-400">TO:</span>
              <span>dd/mm/yyyy</span>
              <Calendar className="w-3 h-3 text-slate-400 ml-1" />
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="text-slate-400 uppercase text-[10px] mr-1">QUICK:</span>
            <button className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Today</button>
            <button className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Yesterday</button>
            <button className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Last 7 Days</button>
            <button className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">This Month</button>
            <button className="px-2.5 py-1 rounded bg-[#FF6B00] text-white font-bold">All Time</button>
          </div>
        </div>

        {/* Search Bar + Sub-Filters */}
        <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-400">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Search by invoice #, customer name, shade, or product...</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            <button className="px-3 py-1 rounded-lg bg-white shadow-2xs text-slate-900">All Types</button>
            <button className="px-3 py-1 text-slate-600 hover:text-slate-900">Sales Only</button>
            <button className="px-3 py-1 text-slate-600 hover:text-slate-900">Returns Only</button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
            <span className="text-slate-400 font-mono text-[10px] uppercase">PAYMENT:</span>
            <span className="font-semibold">All Modes</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Invoice Records Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead className="bg-[#0D1B2A] text-white font-mono text-[10px] uppercase tracking-wider">
            <tr>
              <th className="py-2 px-2 text-center w-6"></th>
              <th className="py-2.5 px-2">INVOICE #</th>
              <th className="py-2.5 px-2">DATE & TIME</th>
              <th className="py-2.5 px-2">CUSTOMER</th>
              <th className="py-2.5 px-2 text-center">PAYMENT</th>
              <th className="py-2.5 px-2 text-center">ITEMS</th>
              <th className="py-2.5 px-2">SUBTOTAL</th>
              <th className="py-2.5 px-2">DISCOUNT</th>
              <th className="py-2.5 px-2 font-bold">NET TOTAL</th>
              <th className="py-2.5 px-2">PAID</th>
              <th className="py-2.5 px-2">BALANCE</th>
              <th className="py-2.5 px-2 text-center">STATUS</th>
              <th className="py-2.5 px-3 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {salesRows.map((row) => (
              <tr key={row.inv} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 px-2 text-center text-slate-400">
                  <ChevronRight className="w-3.5 h-3.5 mx-auto" />
                </td>
                <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span>{row.inv}</span>
                    {row.isReturn && (
                      <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">
                        RETURN
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-2 text-slate-600 font-mono text-[11px]">
                  {row.date}
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${row.avatarColor}`}>
                      {row.avatar}
                    </span>
                    <span className="font-medium text-slate-900">{row.customer}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${row.paymentColor}`}>
                    {row.payment}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center font-mono">
                  {row.items}
                </td>
                <td className="py-2.5 px-2 font-mono text-slate-700">
                  {row.subtotal}
                </td>
                <td className="py-2.5 px-2 text-slate-400 text-center">
                  {row.discount}
                </td>
                <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                  {row.netTotal}
                </td>
                <td className="py-2.5 px-2 font-mono text-emerald-700 font-medium">
                  {row.paid}
                </td>
                <td className="py-2.5 px-2 font-mono text-slate-900 font-medium">
                  {row.balance}
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.statusColor}`}>
                    {row.status}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-400">
                    <button className="p-1 rounded hover:bg-slate-100 hover:text-blue-600">
                      <Eye className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button className="p-1 rounded hover:bg-slate-100 hover:text-amber-600">
                      <Printer className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                    <button className="p-1 rounded hover:bg-slate-100 hover:text-emerald-600">
                      <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
