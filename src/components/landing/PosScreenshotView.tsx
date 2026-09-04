import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Package, 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  GitBranch, 
  PauseCircle, 
  Scale, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  ArrowUpDown, 
  LogOut 
} from 'lucide-react';
import { PosBillingView } from './views/PosBillingView';
import { InventoryView } from './views/InventoryView';
import { PurchasesView } from './views/PurchasesView';
import { SalesView } from './views/SalesView';
import { BranchOrdersView } from './views/BranchOrdersView';
import { HoldInvoicesView } from './views/HoldInvoicesView';
import { DayCloseView } from './views/DayCloseView';
import { CustomersView } from './views/CustomersView';
import { CreditRecoveryView } from './views/CreditRecoveryView';

export type PosTabId = 
  | 'pos'
  | 'inventory'
  | 'purchases'
  | 'sales'
  | 'customers'
  | 'branch-orders'
  | 'hold-invoices'
  | 'credit-recovery'
  | 'day-close';

interface PosScreenshotViewProps {
  onTabChange?: (tab: PosTabId) => void;
}

export const PosScreenshotView: React.FC<PosScreenshotViewProps> = ({ onTabChange }) => {
  const [activeTab, setActiveTab] = useState<PosTabId>('pos');

  const handleTabClick = (tabId: PosTabId) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const navItems = [
    { id: 'pos' as PosTabId, label: 'POS Billing', icon: ShoppingCart },
    { id: 'inventory' as PosTabId, label: 'Inventory', icon: Package },
    { id: 'purchases' as PosTabId, label: 'Purchases', icon: ShoppingBag },
    { id: 'sales' as PosTabId, label: 'Sales', icon: TrendingUp },
    { id: 'customers' as PosTabId, label: 'Customers', icon: Users },
    { id: 'branch-orders' as PosTabId, label: 'Branch Orders', icon: GitBranch },
    { id: 'hold-invoices' as PosTabId, label: 'Hold Invoices', icon: PauseCircle },
    { id: 'credit-recovery' as PosTabId, label: 'Credit & Recovery', icon: Scale },
    { id: 'day-close' as PosTabId, label: 'Day Close', icon: Calendar },
  ];

  return (
    <div className="w-full min-w-[1040px] bg-[#EAEEF4] text-[#1E293B] font-sans antialiased select-none overflow-hidden text-[13px] leading-tight">
      {/* Main Grid: Left Sidebar + Center Workspace */}
      <div className="grid grid-cols-12 min-h-[580px] bg-[#EAEEF4]">
        
        {/* ========================================================= */}
        {/* 1. LEFT SIDEBAR (Dark Navy) */}
        {/* ========================================================= */}
        <div className="col-span-2 bg-[#0A0F1D] text-slate-300 flex flex-col justify-between p-3.5 border-r border-slate-800 shrink-0">
          <div>
            {/* Top Brand Logo */}
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Pyntflow" className="h-5 w-auto object-contain" width={60} height={20} />
              </div>
              <button type="button" aria-label="Toggle sidebar" className="text-slate-400 hover:text-slate-200">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Section: WORKSPACE */}
            <div className="text-[10px] font-mono font-semibold text-slate-400 tracking-wider uppercase px-2 mb-2">
              WORKSPACE
            </div>

            {/* Nav Items */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Branch & User Info */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <div className="text-[10px] font-mono text-slate-400 uppercase px-1">BRANCH</div>
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#141B2D] border border-slate-800 rounded-lg text-xs font-medium text-slate-200">
              <span>hamza paint</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#FF6B00]" />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono text-slate-300">T01 • Online</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 hover:text-rose-400 cursor-pointer">
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. DYNAMIC WORKSPACE (Col-span-10) */}
        {/* ========================================================= */}
        <div className="col-span-10 flex flex-col min-h-full">
          {activeTab === 'pos' && <PosBillingView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'sales' && <SalesView />}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'branch-orders' && <BranchOrdersView />}
          {activeTab === 'hold-invoices' && (
            <HoldInvoicesView onGoToPos={() => handleTabClick('pos')} />
          )}
          {activeTab === 'credit-recovery' && <CreditRecoveryView />}
          {activeTab === 'day-close' && <DayCloseView />}
        </div>

      </div>
    </div>
  );
};
