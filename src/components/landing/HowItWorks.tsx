import React from 'react';
import { motion } from 'motion/react';
import { Database, ShoppingCart, LineChart, ArrowRight, Check } from 'lucide-react';

export const HowItWorks: React.FC<{ onOpenDemo: () => void }> = ({ onOpenDemo }) => {
  const steps = [
    {
      num: '01',
      title: 'Setup Products & Bases',
      subtitle: 'Fast Catalog Import',
      desc: 'Import or add your paint brands (Dulux, Berger, Diamond, Nippon), packaging sizes (1L, 4L Gallons, 16L Drums), and machine tinting base codes.',
      icon: <Database className="w-5 h-5 text-blue-600" />,
      features: ['Pre-configured paint brand templates', 'Barcode scanner & color code input', 'Supplier cost & batch tracking']
    },
    {
      num: '02',
      title: 'Counter Billing in Seconds',
      subtitle: '2-Click Checkout',
      desc: 'Ring up walk-in customers or contractor credit khatas in seconds. Apply painter discounts, add tinting fees, and print clean thermal slips.',
      icon: <ShoppingCart className="w-5 h-5 text-blue-600" />,
      features: ['Instant gallon/drum switching', 'Cash, Card, Khata & Split tender', 'Instant thermal slip & WhatsApp copy']
    },
    {
      num: '03',
      title: 'Daily Close & Control',
      subtitle: 'Full Business Oversight',
      desc: 'Track real-time inventory, record supplier delivery bills, process returns without errors, and review daily closing profits with zero discrepancies.',
      icon: <LineChart className="w-5 h-5 text-emerald-600" />,
      features: ['Automated low-stock base alerts', 'Supplier payables & debit notes', 'Daily profit & tax closing report']
    }
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Implementation Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Operational in Under an Hour
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            No convoluted setup or months of downtime. Our technical onboarding team helps you populate your inventory and train counter staff immediately.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {steps.map((step, idx) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-8 flex flex-col justify-between relative shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-3xl font-extrabold text-slate-300">
                  {step.num}
                </span>
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  {step.icon}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block mb-1">
                  {step.subtitle}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  {step.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                {step.features.map((f, fIdx) => (
                  <div key={fIdx} className="text-xs text-slate-700 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Action strip */}
        <div className="mt-12 text-center">
          <button
            onClick={onOpenDemo}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 transition-colors cursor-pointer shadow-2xs"
          >
            <span>Need help migrating from manual khatas or Excel? Request free onboarding</span>
            <ArrowRight className="w-4 h-4 text-blue-600" />
          </button>
        </div>

      </div>
    </section>
  );
};

