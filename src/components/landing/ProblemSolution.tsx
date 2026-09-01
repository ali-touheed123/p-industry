import React from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { BEFORE_AFTER_ITEMS } from './data/posData';

export const ProblemSolution: React.FC = () => {
  return (
    <section id="comparison" className="py-20 sm:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>The Paint Trade Reality</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Stop Losing Profits to Manual Registers & Stock Discrepancies
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            Paint shops face unique challenges that generic grocery software can't handle. Here is what changes when you switch to a dedicated system.
          </p>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* Left Column: The Problem (Before) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl p-6 sm:p-8 bg-white border border-rose-200 shadow-xs relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-rose-600 block">The Trade Dilemma</span>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Manual Registers & Generic POS</h3>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                  Manual Chaos
                </span>
              </div>

              <div className="space-y-3.5">
                {BEFORE_AFTER_ITEMS.before.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-rose-50/40 border border-rose-100 flex items-start gap-3.5"
                  >
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-rose-100 text-xs text-slate-500 flex items-center justify-between">
              <span>Cost: Missing drums, unbilled tinting fees, khata disputes</span>
              <span className="text-rose-600 font-bold font-mono">High Risk</span>
            </div>
          </motion.div>

          {/* Right Column: The Solution (After) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl p-6 sm:p-8 bg-slate-900 border border-slate-800 text-white shadow-lg relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-blue-400 block">The Trade Solution</span>
                    <h3 className="text-lg sm:text-xl font-bold text-white">pyntflow Unified System</h3>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">
                  Digital Control
                </span>
              </div>

              <div className="space-y-3.5">
                {BEFORE_AFTER_ITEMS.after.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-3.5"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Outcome: Exact stock count, zero math errors, verified contractor ledgers</span>
              <span className="text-emerald-400 font-bold font-mono">100% Controlled</span>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

