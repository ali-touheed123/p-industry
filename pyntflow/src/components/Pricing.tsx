import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, ArrowRight, ShieldCheck, Plus, Minus, Building2, HelpCircle, Layers } from 'lucide-react';
import { PRICING_PLANS } from '../data/posData';

interface PricingProps {
  onSelectPlan: (planId: string) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const [extraBranches, setExtraBranches] = useState<number>(1);
  const baseFullPrice = 19999;
  const branchAddonPrice = 2999;
  const calculatedFullMonthly = baseFullPrice + Math.max(0, extraBranches - 1) * branchAddonPrice;

  return (
    <section id="pricing" className="py-20 sm:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Commercial Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Straightforward Investment Plans
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            Choose the tier tailored to your paint operations — from a single high-speed counter to multi-branch networks with CEO audit and debt recovery.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-16">
          {PRICING_PLANS.map((plan, idx) => {
            const isRec = plan.isPopular;
            const isFullPlan = plan.id === 'full-pos-ceo';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between relative transition-all duration-200 ${
                  isRec
                    ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-xl'
                    : 'bg-white text-slate-900 border border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                {/* Top Badge for Recommended Plan */}
                {isRec && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wide uppercase shadow-xs whitespace-nowrap">
                    Most Popular • Complete Suite
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className={`text-2xl font-bold tracking-tight ${isRec ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  </div>

                  <p className={`text-xs min-h-[38px] mb-6 leading-relaxed ${isRec ? 'text-slate-300' : 'text-slate-600'}`}>
                    {plan.tagline}
                  </p>

                  {/* Price Header Block */}
                  <div className={`pb-6 mb-6 border-b ${isRec ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-tight ${isRec ? 'text-white' : 'text-slate-900'}`}>
                        {isFullPlan ? `Rs. ${calculatedFullMonthly.toLocaleString()}` : plan.priceMonthly}
                      </span>
                      <span className={`text-xs font-mono ${isRec ? 'text-slate-400' : 'text-slate-500'}`}>
                        {plan.period}
                      </span>
                    </div>

                    {plan.addonText && (
                      <div className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        isRec 
                          ? 'bg-slate-800 text-blue-300 border border-slate-700' 
                          : 'bg-blue-50 text-blue-800 border border-blue-100'
                      }`}>
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span>{plan.addonText}</span>
                      </div>
                    )}

                    {plan.priceNote && (
                      <span className={`text-[11px] mt-2 block font-mono ${isRec ? 'text-slate-400' : 'text-slate-500'}`}>
                        {plan.priceNote}
                      </span>
                    )}

                    {/* Interactive Branch Counter for Full Plan */}
                    {isFullPlan && (
                      <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                          <span className="font-semibold">Branches / Outlets:</span>
                          <span className="font-mono font-bold text-blue-400">{extraBranches} {extraBranches === 1 ? 'Location' : 'Locations'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExtraBranches(Math.max(1, extraBranches - 1))}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
                            aria-label="Decrease branch count"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={extraBranches}
                            onChange={(e) => setExtraBranches(parseInt(e.target.value, 10))}
                            className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setExtraBranches(Math.min(10, extraBranches + 1))}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition-colors"
                            aria-label="Increase branch count"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {extraBranches > 1 && (
                          <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                            Base Rs. 19,999 + {extraBranches - 1} extra branch × Rs. 2,999
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 mb-8">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isRec ? 'text-slate-400' : 'text-slate-500'}`}>
                      Included in this tier:
                    </span>
                    
                    {plan.features.map((feat, fIdx) => (
                      <div key={fIdx} className={`flex items-start gap-2.5 text-xs ${isRec ? 'text-slate-200' : 'text-slate-700'}`}>
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 font-bold ${isRec ? 'text-blue-400' : 'text-emerald-600'}`} />
                        <span>{feat}</span>
                      </div>
                    ))}

                    {plan.omittedFeatures && plan.omittedFeatures.map((omit, oIdx) => (
                      <div key={oIdx} className="flex items-start gap-2.5 text-xs text-slate-400 opacity-60">
                        <X className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="line-through">{omit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card CTA Button */}
                <div>
                  <button
                    onClick={() => onSelectPlan(plan.id)}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                      isRec
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Free shop migration & staff onboarding</span>
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 overflow-hidden shadow-2xs"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tier Comparison Matrix</h3>
              <p className="text-xs text-slate-600">Side-by-side feature breakdown across the three tiers</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700 font-semibold bg-slate-50/60">
                  <th className="py-3 px-4">Feature / Capability</th>
                  <th className="py-3 px-4 text-center">POS Only<br /><span className="text-[11px] font-mono text-slate-500">Rs. 14,999/mo</span></th>
                  <th className="py-3 px-4 text-center bg-blue-50/50">Full (POS + CEO)<br /><span className="text-[11px] font-mono text-blue-700 font-bold">Rs. 19,999/mo base</span></th>
                  <th className="py-3 px-4 text-center">Customized<br /><span className="text-[11px] font-mono text-slate-500">Per Feature</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">POS Sales & Fast Billing Counter</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Sales Return & Invoicing Adjustments</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Basic Paint Inventory (Gallons, Drums, Liters)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Purchase & Purchase Returns (Supplier Bills)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Day Close Register & Cash Drawer Balancing</td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Branch Orders & Inter-Branch Stock Transfers</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Sales Team Management & Staff Quotas</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Credit Customers & Painter Khata Ledgers</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Recovery Management & Overdue Debt Tracking</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Percentage Pool Commission for Managers</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">Full CEO Oversight & Executive Mobile Dashboards</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">One-off Bespoke Features & Unique Custom Workflows</td>
                  <td className="py-3.5 px-4 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/30"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto font-bold" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Pricing Guarantee note */}
        <div className="mt-12 text-center text-xs text-slate-600 max-w-xl mx-auto flex items-center justify-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Have custom tinting machines, barcode printers, or multi-city depots? Contact our team for a tailored quote.</span>
        </div>

        {/* WhatsApp CTA */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href="https://wa.me/923063918529?text=Hi%2C%20I%20want%20to%20know%20more%20about%20Pyntflow%20for%20my%20paint%20shop."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L.057 23.885a.5.5 0 00.606.606l6.04-1.471A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.647-.49-5.18-1.348l-.372-.214-3.857.94.958-3.752-.234-.385A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            WhatsApp Us — +92 306 3918529
          </a>
          <p className="text-[11px] text-slate-500">Mon–Sat, 9am–9pm PKT · Usually replies within minutes</p>
        </div>

      </div>
    </section>
  );
};


