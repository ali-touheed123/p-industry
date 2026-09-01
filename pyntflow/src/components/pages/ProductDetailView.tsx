import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  HelpCircle, 
  Layers, 
  ShieldCheck, 
  FileText,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  directAnswer?: string;
}

interface ProductDetailViewProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
  title: string;
  seoTitle: string;
  metaDescription: string;
  canonical: string;
  keywords: string[];
  heroBadge: string;
  h1: string;
  subtitle: string;
  overviewHeading: string;
  overviewParagraphs: string[];
  keyFeatures: {
    title: string;
    description: string;
    icon?: any;
    bulletPoints?: string[];
  }[];
  whyItMatters: {
    title: string;
    description: string;
  }[];
  faqItems: FaqItem[];
  relatedPages: {
    title: string;
    url: string;
    category: string;
  }[];
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  onNavigate,
  onOpenDemo,
  title,
  seoTitle,
  metaDescription,
  canonical,
  keywords,
  heroBadge,
  h1,
  subtitle,
  overviewHeading,
  overviewParagraphs,
  keyFeatures,
  whyItMatters,
  faqItems,
  relatedPages
}) => {
  // Build JSON-LD structured schema
  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'Pyntflow ' + title,
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web, Windows, Android, macOS',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'description': metaDescription,
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
          'name': title,
          'item': canonical
        }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faqItems.map((faq) => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': `${faq.directAnswer ? faq.directAnswer + ' ' : ''}${faq.answer}`
        }
      }))
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: seoTitle,
          description: metaDescription,
          h1: h1,
          canonical: canonical,
          keywords: keywords,
          ogType: 'product'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <Breadcrumb items={[{ name: title, url: canonical.replace('https://pyntflow.com', '') }]} onNavigate={onNavigate} />

        {/* Hero Section */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-12">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-orange-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
          
          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF6B00]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{heroBadge}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              {h1}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              {subtitle}
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenDemo}
                className="px-6 py-3 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Launch Interactive Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('/contact')}
                className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Book Custom Onboarding
              </button>
            </div>
          </div>
        </div>

        {/* Overview & Direct AI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          <div className="lg:col-span-8 bg-white p-8 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#FF6B00]" />
              <span>{overviewHeading}</span>
            </h2>

            {overviewParagraphs.map((p, idx) => (
              <p key={idx} className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {p}
              </p>
            ))}
          </div>

          <div className="lg:col-span-4 bg-[#0A0F1D] text-slate-200 p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-[11px] font-mono font-semibold text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>Pyntflow Fast Specs</span>
              </div>
              <h3 className="text-lg font-bold text-white">Direct Operational Summary</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pyntflow eliminates manual guesswork by connecting front-counter sales, base-can tint inventory, contractor khata ledgers, and supplier debit notes into a single cohesive database.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>Billing Hotkeys:</span>
                <span className="font-bold text-[#FF6B00]">F2 to F9</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Offline Support:</span>
                <span className="text-emerald-400 font-bold">Enabled (PWA/Local)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Ledger Auditing:</span>
                <span className="text-white font-bold">Automatic WhatsApp</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mb-14 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Purpose-Built Capabilities
            </h2>
            <p className="text-sm text-slate-500">
              Designed specifically for paint shops, paint retail stores, and paint wholesale dealers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keyFeatures.map((feat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all space-y-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF6B00]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{feat.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{feat.description}</p>
                {feat.bulletPoints && feat.bulletPoints.length > 0 && (
                  <ul className="pt-2 space-y-1 text-xs text-slate-500 font-medium">
                    {feat.bulletPoints.map((bp, bidx) => (
                      <li key={bidx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                        <span>{bp}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Why It Matters / Business Value */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-sm mb-14 space-y-6">
          <div className="max-w-2xl space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>Measurable Business Outcomes</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              How paint stores and authorized dealers optimize daily operations with Pyntflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {whyItMatters.map((item, idx) => (
              <div key={idx} className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="text-xs font-mono font-bold text-[#FF6B00]">0{idx + 1} IMPACT</div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Answer Engine & FAQ Section (AEO/GEO Optimized) */}
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-sm mb-14 space-y-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Frequently Asked Questions & Answers</span>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Direct Questions About {title}
          </h2>

          <div className="divide-y divide-slate-100">
            {faqItems.map((faq, idx) => (
              <div key={idx} className="py-5 space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  {faq.question}
                </h3>
                {faq.directAnswer && (
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs font-medium text-emerald-900">
                    <strong className="font-bold text-emerald-950">Direct Answer: </strong>
                    {faq.directAnswer}
                  </div>
                )}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Cluster & Internal Links */}
        {relatedPages && relatedPages.length > 0 && (
          <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 space-y-3 mb-10">
            <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              RELATED PYNTFLOW MODULES & TOPIC CLUSTER
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {relatedPages.map((rp, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate(rp.url)}
                  className="p-3 bg-white hover:bg-orange-50/60 border border-slate-200 hover:border-orange-300 rounded-xl text-left transition-all group cursor-pointer"
                >
                  <div className="text-[10px] font-mono text-slate-400 group-hover:text-[#FF6B00] uppercase">
                    {rp.category}
                  </div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B00] flex items-center justify-between mt-0.5">
                    <span>{rp.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA Banner */}
        <div className="bg-[#0A0F1D] text-white p-8 md:p-10 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tight">Ready to test {title}?</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Test the live interactive counter register, godown vault, and credit recovery modules right now.
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
