import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { 
  Building, 
  Target, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

interface AboutPageViewProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

export const AboutPageView: React.FC<AboutPageViewProps> = ({ onNavigate, onOpenDemo }) => {
  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Pyntflow',
      'url': 'https://pyntflow.com',
      'logo': 'https://pyntflow.com/icon.svg',
      'description': 'Pyntflow provides specialized POS and business management software for paint shops, paint stores, and paint dealers.',
      'sameAs': []
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
          'name': 'About',
          'item': 'https://pyntflow.com/about'
        }
      ]
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'About Pyntflow | Specialized Paint Shop POS Software',
          description: 'Learn how Pyntflow was built to eliminate calculation errors, unrecorded contractor credit, and inventory shrinkage for paint shops and dealers.',
          h1: 'About Pyntflow — Dedicated Paint Retail Engineering',
          canonical: 'https://pyntflow.com/about',
          keywords: [
            'about Pyntflow',
            'paint shop POS company',
            'paint retail software team',
            'paint store management mission'
          ],
          ogType: 'website'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'About', url: '/about' }]} onNavigate={onNavigate} />

        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-12">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF6B00]">
              <Building className="w-3.5 h-3.5" />
              <span>Company & Engineering Mission</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Built for the Nuances of Paint Retail
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Generic retail point-of-sale systems treat paint like boxed cereal or packaged t-shirts. Paint stores, however, operate in gallons, quarter cans, tinting bases, colorant formulas, contractor udhaar ledgers, and distributor debit notes. Pyntflow was engineered specifically to solve these domain-specific operational challenges.
            </p>
          </div>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF6B00]">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Domain-Specific Precision</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every workflow—from F2-F9 keyboard shortcuts to automatic container unit conversions—is modeled on how real paint counters operate during peak rush hours.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Financial Integrity</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Protecting working capital through shift-end drawer cash reconciliation, customer credit limit enforcement, and itemized debit notes for manufacturer returns.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Accessible for Counter Staff</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Designed with clear visual cues and hotkeys so non-technical store staff can learn billing and inventory tracking without extensive training.
            </p>
          </div>
        </div>

        {/* Explore Links */}
        <div className="p-8 bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-slate-900">See Pyntflow in Action</h3>
            <p className="text-xs text-slate-500">Explore how Pyntflow transforms paint store billing, inventory, and ledger accounting.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenDemo}
              className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Launch Live Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('/paint-shop-pos')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Explore POS Module
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
