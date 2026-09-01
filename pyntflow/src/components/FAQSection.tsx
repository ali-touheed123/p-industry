import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQ_ITEMS } from '../data/posData';

interface FAQProps {
  onOpenDemo: () => void;
}

export const FAQSection: React.FC<FAQProps> = ({ onOpenDemo }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 sm:py-28 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Common Questions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-slate-600">
            Have questions about paint tinting, contractor khata recovery, offline stability, or hardware compatibility? Find clear answers below.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className={`rounded-2xl transition-all duration-200 overflow-hidden border ${
                  isOpen
                    ? 'bg-white border-blue-200 shadow-sm'
                    : 'bg-white hover:border-slate-300 border-slate-200'
                }`}
              >
                <button
                  onClick={() => toggleFAQ(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-bold text-slate-900 pr-2">
                    {item.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Help Box */}
        <div className="mt-12 p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-900">Have a specific question about your paint brand or shop setup?</h4>
            <p className="text-xs text-slate-600 mt-0.5">Our paint trade software specialists are available on phone or WhatsApp.</p>
          </div>
          <button
            onClick={onOpenDemo}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 cursor-pointer transition-colors"
          >
            Ask a Specialist
          </button>
        </div>

      </div>
    </section>
  );
};

