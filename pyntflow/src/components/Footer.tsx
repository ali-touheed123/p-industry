import React from 'react';
import { Phone, MessageSquare, Mail, ArrowUpRight, ArrowRight } from 'lucide-react';
import { PyntflowLogo } from './PyntflowLogo';

interface FooterProps {
  onOpenDemo: () => void;
  onNavigate?: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenDemo, onNavigate }) => {
  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
      window.scrollTo(0, 0);
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white pt-16 pb-12 relative text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-slate-100">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => handleNav('/')} className="cursor-pointer">
                <PyntflowLogo height={26} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm">
              Pyntflow is specialized point of sale and business management software designed for paint retail stores, wholesale paint dealers, and hardware businesses.
            </p>

            <div className="pt-2 text-xs text-slate-500 font-mono">
              Designed specifically for paint retail, trade counters, and wholesale distributors.
            </div>
          </div>

          {/* Dedicated Products */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Products & Solutions
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => handleNav('/paint-shop-pos')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Paint Shop POS Software
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/paint-store-management-software')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Paint Store Management
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/paint-shop-billing-software')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Paint Shop Billing Software
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/paint-inventory-management-software')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Paint Inventory Software
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/paint-dealer-software')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Software for Paint Dealers
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/pos-software-pakistan')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer text-emerald-700 font-semibold">
                  POS Software in Pakistan 🇵🇰
                </button>
              </li>
            </ul>
          </div>

          {/* Features & Modules */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Features & Modules
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button onClick={() => handleNav('/features/pos')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  POS Counter Register (F2-F9)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/features/inventory')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Multi-Vault Godown Stock
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/features/sales')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Sales & Contractor Ledgers
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/features/sales-returns')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Sales Returns & Credit Notes
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/features/purchases')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Supplier Purchasing & Payables
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/features/purchase-returns')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Purchase Returns (Debit Notes)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/features/reports')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Shift Close & Margin Reports
                </button>
              </li>
            </ul>
          </div>

          {/* Resources & Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Resources & Company
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => handleNav('/blog')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Knowledge Blog (15 Guides)
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/faq')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Frequently Asked Questions
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/pricing')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Pricing Plans & Licensing
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/about')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  About Pyntflow
                </button>
              </li>
              <li>
                <button onClick={() => handleNav('/contact')} className="hover:text-[#FF6B00] transition-colors text-left cursor-pointer">
                  Contact Support Team
                </button>
              </li>
              <li className="pt-2">
                <button
                  onClick={onOpenDemo}
                  className="w-full py-2 px-3 rounded-lg bg-[#0A0F1D] hover:bg-[#FF6B00] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Launch Live Simulator</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Pyntflow. Engineered specifically for paint retail and distribution.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-700 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-700 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-700 cursor-pointer">Hardware Standards</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
