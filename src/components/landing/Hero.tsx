import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Play, 
  Check,
  ArrowLeftRight
} from 'lucide-react';
import { PosScreenshotView, PosTabId } from './PosScreenshotView';

interface HeroProps {
  onOpenDemo: () => void;
  onExploreFeatures: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenDemo, onExploreFeatures }) => {
  const [activeTab, setActiveTab] = useState<PosTabId>('pos');

  const tabTitles: Record<PosTabId, string> = {
    'pos': 'Pyntflow POS Billing • Counter Register #01',
    'inventory': 'Pyntflow Inventory & Stock Vault • Live Catalog',
    'purchases': 'Pyntflow Purchases & Supplier Invoices • P-INV-6835',
    'sales': 'Pyntflow Sales Register & Invoices • Live History',
    'customers': 'Pyntflow Customer & Painter Khata Directory',
    'branch-orders': 'Pyntflow Branch Orders & Inter-Transfer Requests',
    'hold-invoices': 'Pyntflow Hold Invoices & Parked Carts',
    'credit-recovery': 'Pyntflow Credit & Recovery • Udhaar Balances',
    'day-close': 'Pyntflow Day Close • Shift End Reconciliation'
  };

  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header: Centered Headline, Value Proposition & CTA */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6">
          
          {/* Architectural Trade Eyebrow Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Built Specifically for Paint Retailers & Wholesale Dealers</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.12] tracking-tight text-slate-900"
          >
            The Point of Sale Built for Paint Buckets, Bases & Khatas.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-slate-600 text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl"
          >
            Stop forcing grocery software onto paint inventory. Manage gallons, 16L drums, tinting formulas, painter credit balances, and supplier bills from one purpose-built counter system.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto pt-2"
          >
            <button
              onClick={onOpenDemo}
              id="hero-request-demo-btn"
              className="w-full sm:w-auto bg-slate-900 hover:bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Request Free Live Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreFeatures}
              id="hero-explore-features-btn"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-semibold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
              <span>Explore Features</span>
            </button>
          </motion.div>

          {/* Quick Proof Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-3 text-xs text-slate-600"
          >
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 font-bold" />
              <span className="font-medium text-slate-700">Real-time Cloud Sync</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 font-bold" />
              <span className="font-medium text-slate-700">Gallon & Drum Units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 font-bold" />
              <span className="font-medium text-slate-700">Thermal Slip Printing</span>
            </div>
          </motion.div>
        </div>

        {/* Large-Format Desktop Window Showcase (Full-Width, No Element Collision) */}
        <div className="mt-12 sm:mt-16 relative max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100"
          >
            {/* App Window Titlebar */}
            <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-3 sm:px-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                </div>
                <span className="text-[11px] sm:text-xs text-slate-300 font-mono ml-1 sm:ml-2 font-medium truncate">
                  {tabTitles[activeTab]}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/50 text-emerald-400 text-[10px] sm:text-[11px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">Live System Ready</span>
                  <span className="sm:hidden">Live</span>
                </span>
              </div>
            </div>

            {/* Mobile Swipe Guidance Bar */}
            <div className="lg:hidden flex items-center justify-center gap-2 py-1.5 px-3 bg-slate-950/90 text-slate-300 text-[11px] border-b border-slate-800/80">
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Swipe horizontally to interact with full POS workspace</span>
            </div>

            {/* POS Interface Container with Responsive Overflow Protection */}
            <div className="relative bg-[#0A0F1D] overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
              <PosScreenshotView onTabChange={setActiveTab} />
            </div>
          </motion.div>

          {/* Bottom Trade Feature Highlights */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-2 sm:gap-3 mt-4 px-2 text-[11px] sm:text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span>Keyboard Hotkey Speed (F2 to F9 Navigation)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Instant Walk-in & Painter Khata Ledger</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <span>One-Click Thermal Save & Print (F5)</span>
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};

