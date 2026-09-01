import React from 'react';
import { 
  Wifi, 
  Bell, 
  Search, 
  Plus, 
  Phone, 
  Users, 
  CreditCard, 
  ChevronRight, 
  Download 
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const customerList = [
    { name: 'shayan pstar', phone: '0300-1234567', type: 'Painter / Contractor', balance: 'Rs. 55,000', balanceType: 'Udhaar (Due)', totalOrders: 14, lastActive: 'Today' },
    { name: 'ali', phone: '0321-7654321', type: 'Contractor', balance: 'Rs. 5,000', balanceType: 'Udhaar (Due)', totalOrders: 8, lastActive: 'Today' },
    { name: 'Tariq Mehmood', phone: '0333-9876543', type: 'General Contractor', balance: 'Rs. 32,500', balanceType: 'Udhaar (Due)', totalOrders: 29, lastActive: 'Yesterday' },
    { name: 'Master Paint Works', phone: '0345-1122334', type: 'Commercial Builder', balance: 'Rs. 0', balanceType: 'Clear', totalOrders: 42, lastActive: '3 days ago' },
    { name: 'Walk-in Customers', phone: 'Multiple Accounts', type: 'Retail Walk-in', balance: 'Rs. 0', balanceType: 'Clear', totalOrders: 180, lastActive: 'Today' }
  ];

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

      {/* Header with Metrics */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Customer & Khata Directory</h2>
          <p className="text-xs text-slate-500 font-medium">Manage painters, contractors, credit balances & khata ledgers</p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer">
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Ledgers</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">TOTAL REGISTERED CUSTOMERS</div>
          <div className="text-2xl font-extrabold text-slate-950 font-mono mt-1">128 Accounts</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">ACTIVE UDHAAR RECEIVABLES</div>
          <div className="text-2xl font-extrabold text-amber-600 font-mono mt-1">Rs. 92,500</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">RECOVERY RATE THIS MONTH</div>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono mt-1">94.2%</div>
        </div>
      </div>

      {/* Customers List Table */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-400">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Search by painter name, phone number, CNIC, or contractor firm...</span>
        </div>

        <div className="border border-slate-200/80 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">CUSTOMER / FIRM</th>
                <th className="py-2.5 px-2">CONTACT PHONE</th>
                <th className="py-2.5 px-2">CATEGORY</th>
                <th className="py-2.5 px-2 text-center">TOTAL ORDERS</th>
                <th className="py-2.5 px-2">LAST ACTIVE</th>
                <th className="py-2.5 px-2">KHATA BALANCE</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {customerList.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{c.name}</div>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 font-medium">
                    {c.type}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-medium">
                    {c.totalOrders}
                  </td>
                  <td className="py-2.5 px-2 text-slate-500">
                    {c.lastActive}
                  </td>
                  <td className="py-2.5 px-2 font-mono font-bold">
                    <span className={c.balance === 'Rs. 0' ? 'text-slate-700' : 'text-amber-600'}>
                      {c.balance}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button className="px-2 py-1 text-[#FF6B00] hover:bg-orange-50 font-bold rounded text-[11px]">
                      View Ledger →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
