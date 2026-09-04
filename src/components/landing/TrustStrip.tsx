import React from 'react';
import { motion } from 'motion/react';
import { Layers, ShieldCheck, Gauge, CheckSquare } from 'lucide-react';

export const TrustStrip: React.FC = () => {
  const values = [
    { 
      icon: <Layers className="w-4 h-4 text-blue-600" />,
      label: 'Purpose-Built for Paint', 
      desc: 'Native 1L, 4L Gallons & 16L Drums with base and dispenser tracking.' 
    },
    { 
      icon: <Gauge className="w-4 h-4 text-blue-600" />,
      label: 'Rapid 2-Click Checkout', 
      desc: 'Minimal staff friction. Ring up walk-ins and painter khatas in seconds.' 
    },
    { 
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      label: '100% Offline Resilient', 
      desc: 'Never stop billing even if internet drops or power flickers.' 
    },
    { 
      icon: <CheckSquare className="w-4 h-4 text-indigo-600" />,
      label: 'Accurate Contractor Ledger', 
      desc: 'Real-time painter running balances, receipts, and WhatsApp statements.' 
    },
  ];

  return (
    <section className="relative z-10 -mt-2 mb-16 sm:mb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 divide-y sm:divide-y-0 lg:divide-x divide-slate-100">
            {values.map((item, idx) => (
              <div
                key={item.label}
                className={`flex flex-col items-start text-left ${
                  idx === 0 ? 'lg:pr-6' : 'lg:px-6 pt-4 sm:pt-0'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    {item.label}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

