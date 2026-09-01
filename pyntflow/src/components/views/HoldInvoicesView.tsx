import React from 'react';
import { 
  Search, 
  RefreshCw, 
  PauseCircle 
} from 'lucide-react';

interface HoldInvoicesViewProps {
  onGoToPos?: () => void;
}

export const HoldInvoicesView: React.FC<HoldInvoicesViewProps> = ({ onGoToPos }) => {
  return (
    <div className="w-full space-y-3.5 bg-[#EEF2F6] p-4 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Hold Invoices</h2>
          <p className="text-xs text-slate-500 font-medium">Resume parked customer orders directly into POS billing</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-400">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Search hold ID or customer...</span>
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Frame with Empty State */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex-1 flex flex-col justify-between min-h-[360px]">
        
        {/* Table Header */}
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Hold ID</th>
              <th className="py-2.5 px-3">Time / Date</th>
              <th className="py-2.5 px-3">Customer</th>
              <th className="py-2.5 px-3">Items</th>
              <th className="py-2.5 px-3">Total Amount</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
        </table>

        {/* Empty State Center */}
        <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 px-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
            <PauseCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <div className="text-base font-bold text-slate-900">
              No Hold Invoices Found
            </div>
            <div className="text-xs text-slate-500 max-w-sm">
              There are currently no parked customer carts. When you park an invoice in POS billing ('Hold F7'), it will appear here.
            </div>
          </div>

          <button 
            onClick={onGoToPos}
            className="mt-2 px-5 py-2.5 bg-[#0D1B2A] hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer"
          >
            Go to POS Billing
          </button>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-medium">
          Showing 0 to 0 of 0 entries
        </div>

      </div>

    </div>
  );
};
