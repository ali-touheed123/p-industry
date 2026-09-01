import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Sparkles, 
  CreditCard, 
  Boxes, 
  RotateCcw, 
  ShoppingCart, 
  FileSpreadsheet, 
  ShieldCheck, 
  Users, 
  Building2 
} from 'lucide-react';

interface FeaturesHubViewProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

export const FeaturesHubView: React.FC<FeaturesHubViewProps> = ({ onNavigate, onOpenDemo }) => {
  const featureCards = [
    {
      title: 'POS Billing Register',
      url: '/features/pos',
      description: 'High-speed keyboard billing (F2-F9), shade search, parked orders (F7 Hold), split payments, and thermal receipt printing.',
      icon: ShoppingCart,
      badge: 'F2-F9 Hotkeys'
    },
    {
      title: 'Multi-Vault Inventory',
      url: '/features/inventory',
      description: 'Track stock across showroom shelves and central godowns with pack size multipliers (quarter, gallon, drum) and low-stock alerts.',
      icon: Boxes,
      badge: 'Pack Multipliers'
    },
    {
      title: 'Sales & Invoice Management',
      url: '/features/sales',
      description: 'Complete sales history, contractor credit accounts, payment receipts, and automated customer ledger tracking.',
      icon: CreditCard,
      badge: 'Contractor Khata'
    },
    {
      title: 'Sales Return & Credit Notes',
      url: '/features/sales-returns',
      description: 'Process customer returns against original invoices, issue digital credit notes, and restore stock automatically.',
      icon: RotateCcw,
      badge: 'Credit Notes'
    },
    {
      title: 'Purchases & Supplier Procurement',
      url: '/features/purchases',
      description: 'Log supplier shipments, calculate landed costs with freight, and manage vendor payable ledgers.',
      icon: Building2,
      badge: 'Vendor Payables'
    },
    {
      title: 'Purchase Returns & Debit Notes',
      url: '/features/purchase-returns',
      description: 'Return damaged or defective paint stock to manufacturers and generate itemized debit notes.',
      icon: ShieldCheck,
      badge: 'Supplier Debits'
    },
    {
      title: 'Reports & Business Analytics',
      url: '/features/reports',
      description: 'Real-time sales registers, gross margin analytics, inventory valuations, and shift reconciliation logs.',
      icon: FileSpreadsheet,
      badge: 'Live Analytics'
    }
  ];

  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'Pyntflow Paint Shop POS Features',
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web, Windows, Android, macOS',
      'description': 'Comprehensive feature set of Pyntflow Paint Shop POS Software, including billing hotkeys, inventory vaults, contractor credit, and reports.',
      'provider': {
        '@type': 'Organization',
        'name': 'Pyntflow',
        'url': 'https://pyntflow.com'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://pyntflow.com/'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Features',
          'item': 'https://pyntflow.com/features'
        }
      ]
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'Features Overview | Pyntflow Paint Shop POS Software',
          description: 'Explore the full suite of Pyntflow features: high-speed POS billing, multi-vault inventory, contractor khata, supplier procurement, and reports.',
          h1: 'Pyntflow Features: Purpose-Built for Paint Retailers',
          canonical: 'https://pyntflow.com/features',
          keywords: [
            'paint shop POS features',
            'paint store software features',
            'paint inventory modules',
            'paint shop billing capabilities'
          ],
          ogType: 'website'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'Features', url: '/features' }]} onNavigate={onNavigate} />

        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-12 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF6B00] mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Complete Module Breakdown</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Engineered for Every Stage of Paint Retail
          </h1>

          <p className="text-base text-slate-600 leading-relaxed font-normal mt-2">
            Explore dedicated modules designed specifically for paint store counters, godown storage warehouses, contractor credit ledgers, and supplier procurement.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {featureCards.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate(feat.url)}
                className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF6B00] group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 px-2.5 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                      {feat.badge}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
                    {feat.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#FF6B00] mt-4">
                  <span>Explore Module Details</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive CTA */}
        <div className="bg-[#0A0F1D] text-white p-8 md:p-10 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tight">Test These Features Live</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Try the interactive simulator right in your browser to experience keyboard billing, inventory vaults, and shift closing firsthand.
            </p>
          </div>
          <button
            onClick={onOpenDemo}
            className="px-6 py-3.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Launch Interactive Simulator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
