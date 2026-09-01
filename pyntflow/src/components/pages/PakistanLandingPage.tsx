import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { 
  Building2, 
  MapPin, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  ShieldCheck, 
  CreditCard,
  Layers,
  HelpCircle,
  Sparkles
} from 'lucide-react';

interface PakistanLandingPageProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

export const PakistanLandingPage: React.FC<PakistanLandingPageProps> = ({ onNavigate, onOpenDemo }) => {
  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'Pyntflow POS Software Pakistan Edition',
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web, Windows, Android, macOS',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'PKR'
      },
      'description': 'Pyntflow is POS software for paint shops and paint dealers in Pakistan. Manage billing, sales, purchases, inventory, returns and reports in one system.',
      'areaServed': {
        '@type': 'Country',
        'name': 'Pakistan'
      },
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
          'name': 'POS Software Pakistan',
          'item': 'https://pyntflow.com/pos-software-pakistan'
        }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': 'Is Pyntflow tailored for paint shops in Pakistan?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Yes. Pyntflow is specifically engineered with local workflows including painter contractor udhaar (credit ledgers), cash drawer (daraz) hisab shift reconciliation, WhatsApp billing receipts, and multi-unit pack sizing (quarter, gallon, drum).'
          }
        },
        {
          '@type': 'Question',
          'name': 'Does Pyntflow support thermal receipt printers used in Pakistani markets?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Yes, Pyntflow supports standard 80mm and 58mm ESC/POS USB and Bluetooth thermal printers as well as A4 and A5 laser invoices.'
          }
        },
        {
          '@type': 'Question',
          'name': 'How does Pyntflow handle painter commission and contractor discounts?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Pyntflow allows store owners to record painter commission logs per bill or contractor account, automatically calculating cumulative payouts and adjusting net margins.'
          }
        }
      ]
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'POS Software for Paint Shops in Pakistan | Pyntflow',
          description: 'Pyntflow is POS software for paint shops and paint dealers in Pakistan. Manage billing, sales, purchases, inventory, returns and reports in one system.',
          h1: 'Paint Shop POS Software in Pakistan',
          canonical: 'https://pyntflow.com/pos-software-pakistan',
          keywords: [
            'paint shop POS software Pakistan',
            'paint shop software Pakistan',
            'paint store software Pakistan',
            'POS software for paint shops Pakistan',
            'paint shop billing software Pakistan',
            'paint inventory software Pakistan',
            'paint dealer software Pakistan',
            'paint shop management software Pakistan',
            'best POS software for paint shops in Pakistan'
          ],
          ogType: 'website'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'POS Software Pakistan', url: '/pos-software-pakistan' }]} onNavigate={onNavigate} />

        {/* Hero Card */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-12">
          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              <MapPin className="w-3.5 h-3.5" />
              <span>Pakistan Paint Retail & Wholesale Edition</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Paint Shop POS Software in Pakistan
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Pyntflow provides specialized POS and business management software tailored specifically for Pakistani paint retailers, paint dealers, and hardware stores. Manage sales, supplier purchases, contractor udhaar khata, base-can inventory, and daily drawer reconciliation in one reliable system.
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenDemo}
                className="px-6 py-3 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Launch Live Interactive Counter</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('/contact')}
                className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Request Pakistan Onboarding
              </button>
            </div>
          </div>
        </div>

        {/* Regional Workflow Grid (Pakistani Market Specifics) */}
        <div className="mb-14 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Pakistani Paint Business Realities
            </h2>
            <p className="text-sm text-slate-500">
              Solving the operational challenges faced every day across Karachi, Lahore, Rawalpindi, Islamabad, Faisalabad, and nationwide paint markets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Udhaar Khata Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF6B00]">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Contractor & Painter Udhaar (Khata)</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Maintain accurate digital customer ledgers for contractors and painters. Track partial installments, overdue aging, and credit limits with automatic balance stamping on every bill.
              </p>
            </div>

            {/* Shift Close / Daraz Hisab */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Shift End Daraz Hisab Reconciliation</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Count physical cash in the drawer at the end of the shift and compare directly with system sales. Log staff chai/lunch petty cash expenses to reconcile the register before closing.
              </p>
            </div>

            {/* WhatsApp Invoicing */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Instant WhatsApp Invoicing & Receipts</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Send professional digital bills and khata payment receipts straight to customer WhatsApp numbers, reducing paper costs and keeping contractors informed of their outstanding balance.
              </p>
            </div>

            {/* Pack Sizing */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Quarter, Gallon & Drum Conversions</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Manage emulsions, enamels, and primers across standard Pakistani packaging sizes (Quarter, Gallon, Drum / 16L Bucket) under synchronized inventory units without manual math.
              </p>
            </div>

            {/* Brand Catalogues */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Brand Dealer Catalogues</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Easily structure products from major Pakistani manufacturers (Berger, Dulux, Diamond, Brighto, Master, Happilac, Nippon, Kansai) with shade codes, tinting bases, and retail price lists.
              </p>
            </div>

            {/* Multi Counter & Godown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multi-Counter & Godown Vault Transfers</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Operate multiple billing counters simultaneously with real-time stock deduction from central warehouse godowns. Request stock transfers between branches when shop shelves run low.
              </p>
            </div>
          </div>
        </div>

        {/* Localized FAQ Section */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-sm mb-12 space-y-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Pakistan Paint Shop Questions & Direct Answers</span>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions for Pakistani Retailers
          </h2>

          <div className="divide-y divide-slate-100">
            <div className="py-4 space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Can non-technical counter staff in Pakistan learn Pyntflow quickly?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Yes. Pyntflow is designed around quick function keys (F2 Save, F3 Search, F4 Add, F5 Print) and clear visual prompts, allowing store staff with minimal computer experience to create bills in seconds.
              </p>
            </div>

            <div className="py-4 space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Does the software function during internet load-shedding?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Yes. Pyntflow includes local offline caching capabilities so checkout counters can continue issuing invoices and recording cash transactions even if internet connectivity temporarily drops.
              </p>
            </div>

            <div className="py-4 space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                How do I track supplier purchases and factory returns?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Pyntflow includes dedicated Purchase Invoicing and Purchase Return debit notes, updating supplier payable accounts and stock quantities automatically upon delivery.
              </p>
            </div>
          </div>
        </div>

        {/* Internal Topic Cluster Links */}
        <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 space-y-3 mb-10">
          <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
            EXPLORE SPECIFIC PYNTFLOW MODULES
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            <button
              onClick={() => onNavigate('/paint-shop-pos')}
              className="p-3 bg-white hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="text-[10px] font-mono text-slate-400 group-hover:text-[#FF6B00] uppercase">Product</div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B00] flex items-center justify-between mt-0.5">
                <span>Paint Shop POS Software</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => onNavigate('/paint-inventory-management-software')}
              className="p-3 bg-white hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="text-[10px] font-mono text-slate-400 group-hover:text-[#FF6B00] uppercase">Inventory</div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B00] flex items-center justify-between mt-0.5">
                <span>Paint Inventory Software</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => onNavigate('/blog/paint-shop-pos-software-pakistan-guide')}
              className="p-3 bg-white hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="text-[10px] font-mono text-slate-400 group-hover:text-[#FF6B00] uppercase">Guide</div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B00] flex items-center justify-between mt-0.5">
                <span>Pakistan Paint POS Guide</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
