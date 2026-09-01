import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { Pricing } from '../Pricing';
import { 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Layers 
} from 'lucide-react';

interface PricingPageViewProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

export const PricingPageView: React.FC<PricingPageViewProps> = ({ onNavigate, onOpenDemo }) => {
  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': 'Pyntflow Paint Shop POS Software',
      'description': 'Commercial pricing and license editions for Pyntflow Paint Shop POS Software.',
      'brand': {
        '@type': 'Brand',
        'name': 'Pyntflow'
      },
      'offers': {
        '@type': 'AggregateOffer',
        'lowPrice': '0',
        'priceCurrency': 'USD'
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
          'name': 'Pricing',
          'item': 'https://pyntflow.com/pricing'
        }
      ]
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'Pricing & Plans | Pyntflow Paint Shop POS Software',
          description: 'Transparent pricing for paint shops, retail paint stores, and authorized paint dealers. Compare Starter, Pro, and Multi-Branch Enterprise editions.',
          h1: 'Transparent Pricing for Paint Shops & Dealerships',
          canonical: 'https://pyntflow.com/pricing',
          keywords: [
            'paint shop POS pricing',
            'paint store software cost',
            'paint dealer POS price',
            'Pyntflow pricing plans'
          ],
          ogType: 'product'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'Pricing', url: '/pricing' }]} onNavigate={onNavigate} />

        {/* Pricing Component */}
        <Pricing />

        {/* Commercial FAQ */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-sm mt-12 space-y-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Pricing Questions & Answers</span>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions About Licensing
          </h2>

          <div className="divide-y divide-slate-100">
            <div className="py-4 space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Are there hidden fees for receipt printing or multiple counters?</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                No. Pyntflow provides clear tier configurations. You can connect standard USB/LAN thermal printers without proprietary per-print surcharge fees.
              </p>
            </div>

            <div className="py-4 space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Can I upgrade from single counter to multi-branch godown mode later?</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Yes, seamlessly. All master product catalogues, customer ledgers, and transaction histories migrate without any data loss.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
