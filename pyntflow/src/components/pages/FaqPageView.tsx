import React from 'react';
import { Breadcrumb } from '../seo/Breadcrumb';
import { MetaHead } from '../seo/MetaHead';
import { 
  HelpCircle, 
  ArrowRight, 
  Search, 
  CheckCircle2, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  Sparkles 
} from 'lucide-react';

interface FaqPageViewProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

export const FaqPageView: React.FC<FaqPageViewProps> = ({ onNavigate, onOpenDemo }) => {
  const faqCategories = [
    {
      category: 'Core Product & Pyntflow Entity',
      items: [
        {
          question: 'What is Pyntflow?',
          directAnswer: 'Pyntflow is specialized point-of-sale (POS) and business management software built specifically for paint shops, paint retail stores, and authorized paint dealers.',
          answer: 'It connects front-counter sales, base-can tint inventory, contractor khata credit ledgers, supplier purchase tracking, and day-end shift reconciliation in one unified system.'
        },
        {
          question: 'What is Pyntflow POS?',
          directAnswer: 'Pyntflow POS is the high-velocity counter billing register module of Pyntflow.',
          answer: 'It features full keyboard hotkey navigation (F2 Save, F3 Search, F4 Add Item, F5 Print, F7 Hold, F9 Cancel), thermal receipt printing, split payments, and instant shade code lookup.'
        },
        {
          question: 'Who is Pyntflow designed for?',
          directAnswer: 'Pyntflow is designed for paint shops, paint retail stores, paint distributors, and multi-counter paint dealerships.',
          answer: 'It serves both independent paint retailers and high-volume authorized dealers of brands like Berger, Dulux, Diamond, Brighto, Master, Nippon, Happilac, and Kansai.'
        },
        {
          question: 'What is paint shop POS software?',
          directAnswer: 'Paint shop POS software is specialized retail management software engineered for paint inventory dimensions and contractor khata accounting.',
          answer: 'Unlike generic retail POS tools, paint shop POS natively handles base-can conversions, colorant tint recipes, container size multipliers (quarter, gallon, drum), painter commission logs, and supplier debit notes.'
        }
      ]
    },
    {
      category: 'Inventory & Tinting Workflows',
      items: [
        {
          question: 'Can Pyntflow manage paint inventory?',
          directAnswer: 'Yes, Pyntflow provides comprehensive multi-vault paint inventory management.',
          answer: 'You can track physical quantities across front showroom counters and back-room godowns, manage batch numbers, monitor low stock alerts, and execute inter-branch transfers.'
        },
        {
          question: 'How does Pyntflow handle multi-pack units (quarter, gallon, drum)?',
          directAnswer: 'Pyntflow structures products with linked packaging variants under a unified master SKU.',
          answer: 'Selling a quarter can or a 16-liter drum automatically deducts the exact fractional unit or container volume from live stock balances without manual calculation.'
        }
      ]
    },
    {
      category: 'Sales, Purchases & Return Workflows',
      items: [
        {
          question: 'Can Pyntflow manage sales?',
          directAnswer: 'Yes, Pyntflow manages both walk-in retail sales and contractor credit transactions.',
          answer: 'It generates thermal and laser invoices, tracks payment methods (cash, card, bank transfer), applies role-guarded discounts, and records live sales histories.'
        },
        {
          question: 'Can Pyntflow manage purchases?',
          directAnswer: 'Yes, Pyntflow includes a dedicated Supplier Purchases module.',
          answer: 'Log incoming manufacturer shipments with landed cost calculations, track supplier payables, and verify purchase orders against delivery challans.'
        },
        {
          question: 'Can Pyntflow handle sales returns?',
          directAnswer: 'Yes, Pyntflow issues digital Credit Notes for customer sales returns.',
          answer: 'Returned items automatically re-enter inventory stock and adjust the customer ledger or provide an instant cash refund against original invoice references.'
        },
        {
          question: 'Can Pyntflow handle purchase returns?',
          directAnswer: 'Yes, Pyntflow generates Supplier Debit Notes for damaged or surplus vendor items.',
          answer: 'This immediately reduces vendor payable balances and keeps inventory records strictly synchronized.'
        },
        {
          question: 'Does Pyntflow provide reports?',
          directAnswer: 'Yes, Pyntflow delivers comprehensive real-time business reports.',
          answer: 'Store owners can access sales registers, gross margin analytics, inventory valuation summaries, contractor aging reports, and shift-end daraz hisab audit logs.'
        }
      ]
    },
    {
      category: 'Commercial Use & Regional Readiness',
      items: [
        {
          question: 'Who should use Pyntflow?',
          directAnswer: 'Any paint store owner, retail manager, or wholesale paint dealer seeking to eliminate inventory shrinkage and manual bookkeeping errors.',
          answer: 'Whether operating a single retail counter or multiple branch showrooms with central godowns, Pyntflow scales to meet your business demands.'
        },
        {
          question: 'How does Pyntflow help paint shops?',
          directAnswer: 'Pyntflow speeds up counter checkout times, eliminates calculation mistakes, and guarantees accurate stock tracking.',
          answer: 'It prevents revenue leakage by tracking contractor udhaar balances and sending automated WhatsApp statements.'
        },
        {
          question: 'How does Pyntflow help paint dealers?',
          directAnswer: 'Dealers benefit from multi-counter synchronization, central godown transfers, and volume contractor incentive tracking.',
          answer: 'It provides real-time visibility across all branch counters and simplifies manufacturer purchase reconciliation.'
        },
        {
          question: 'Is Pyntflow available in Pakistan?',
          directAnswer: 'Yes, Pyntflow is fully optimized for Pakistani paint retailers and dealers.',
          answer: 'It features contractor udhaar (khata) management, drawer cash (daraz hisab) shift reconciliation, local thermal printer support, and petty expense logging for staff chai and daily costs.'
        }
      ]
    }
  ];

  const allFaqItems = faqCategories.flatMap((c) => c.items);

  const jsonLdSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': allFaqItems.map((faq) => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': `${faq.directAnswer} ${faq.answer}`
        }
      }))
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
          'name': 'FAQ',
          'item': 'https://pyntflow.com/faq'
        }
      ]
    }
  ];

  return (
    <div className="pt-28 pb-20 bg-slate-50 min-h-screen">
      <MetaHead
        metadata={{
          title: 'Frequently Asked Questions (FAQ) | Pyntflow POS',
          description: 'Verified answers about Pyntflow paint shop POS software, inventory tracking, contractor khata, billing hotkeys, and business reporting.',
          h1: 'Frequently Asked Questions & Product Knowledge',
          canonical: 'https://pyntflow.com/faq',
          keywords: [
            'what is Pyntflow',
            'what is paint shop POS software',
            'can Pyntflow manage paint inventory',
            'paint shop POS FAQ',
            'paint store billing system questions'
          ],
          ogType: 'website'
        }}
        schema={jsonLdSchema}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ name: 'FAQ', url: '/faq' }]} onNavigate={onNavigate} />

        {/* Header */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/90 shadow-sm relative overflow-hidden mb-12 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF6B00] mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>AI-Verified Knowledge Base</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Frequently Asked Questions
          </h1>

          <p className="text-base text-slate-600 leading-relaxed font-normal mt-2">
            Direct, factual answers regarding Pyntflow's architecture, paint inventory controls, contractor khata ledgers, and billing workflows.
          </p>
        </div>

        {/* Structured FAQ Categories */}
        <div className="space-y-10">
          {faqCategories.map((cat, cIdx) => (
            <div key={cIdx} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {cat.category}
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {cat.items.map((item, iIdx) => (
                  <div key={iIdx} className="py-5 space-y-2.5">
                    <h3 className="text-base font-bold text-slate-900">
                      {item.question}
                    </h3>

                    {/* Direct Answer for AI / GEO Engine */}
                    <div className="p-3 bg-orange-50/70 border border-orange-200/70 rounded-xl text-xs font-medium text-slate-900">
                      <strong className="font-bold text-[#FF6B00]">Direct Answer: </strong>
                      {item.directAnswer}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="bg-[#0A0F1D] text-white p-8 md:p-10 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 mt-12">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tight">Experience Pyntflow Firsthand</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Launch the live simulated counter to test POS billing hotkeys, inventory vaults, and shift closing.
            </p>
          </div>
          <button
            onClick={onOpenDemo}
            className="px-6 py-3.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Launch Live Interactive Demo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
