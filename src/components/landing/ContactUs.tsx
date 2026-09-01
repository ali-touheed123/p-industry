import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, MessageSquare, Mail, MapPin, Send, CheckCircle2, Clock, ShieldCheck, ArrowUpRight } from 'lucide-react';

interface ContactUsProps {
  onOpenDemo?: (plan?: string) => void;
}

export const ContactUs: React.FC<ContactUsProps> = ({ onOpenDemo }) => {
  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    phone: '',
    city: '',
    topic: 'Live Counter Demo',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const topics = [
    'Live Counter Demo',
    'Pricing & Customization',
    'Excel / Register Migration',
    'Tinting Machine Setup'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setIsSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 sm:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Direct Support & Deployment</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Contact Our Paint POS Specialists
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            Have questions about machine tinting base tracking, multi-branch recovery, or data migration? Talk directly to our technical team.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Direct Contact Info & Guarantees (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Quick Contact Cards */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-2xs space-y-6">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                Immediate Channels
              </h3>

              <div className="space-y-4">
                <a
                  href="tel:+923063918529"
                  className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/60 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 group-hover:scale-105 transition-transform">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Direct Phone Line</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">+92 306 3918529</span>
                    <span className="text-xs text-slate-500 block mt-0.5">Mon–Sat, 9:00 AM – 9:00 PM</span>
                  </div>
                </a>

                <a
                  href="https://wa.me/923063918529"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-4 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">WhatsApp Desk</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">Instant</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 font-mono">+92 306 3918529</span>
                    <span className="text-xs text-emerald-700 block mt-0.5">Quick demos, audio notes & quote PDFs</span>
                  </div>
                </a>

                <a
                  href="mailto:sales@pyntflow.com"
                  className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/60 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email Inquiries</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">sales@pyntflow.com</span>
                    <span className="text-xs text-slate-500 block mt-0.5">Formal proposals & branch audits</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Service & Onboarding Guarantees */}
            <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-bold text-blue-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Onboarding Commitment</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Every pyntflow installation includes hands-on setup: we help import paint product catalogs, configure base codes, and train counter staff on fast billing and cash drawer closing.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>30-Min Response Time</span>
                </span>
                <span>Free On-Site Guidance</span>
              </div>
            </div>

          </div>

          {/* Right Column: Contact & Inquiry Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-9 shadow-2xs">
              
              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      Send a Direct Inquiry
                    </h3>
                    <p className="text-xs text-slate-600">
                      Fill out the details below and our paint software engineer will connect with you.
                    </p>
                  </div>

                  {/* Topic Selector Chips */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Inquiry Topic
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                      {topics.map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setFormData({ ...formData, topic: t })}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold text-left transition-all border cursor-pointer ${
                            formData.topic === t
                              ? 'bg-blue-50 border-blue-600 text-blue-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name & Shop Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tariq Mehmood"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Paint Shop / Business Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Master Color Center"
                        value={formData.shopName}
                        onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Phone & City */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phone / WhatsApp Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0306 3918529"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 font-mono transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        City / Market Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Lahore, Karachi, Rawalpindi"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Message textarea */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Specific Requirements or Current Issues
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tell us what brands you stock (Dulux, Berger, Nippon, Diamond), whether you need tinting machine integration, or khata migration..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all resize-none shadow-2xs"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Inquiry to Technical Desk</span>
                    </button>
                  </div>

                  <p className="text-center text-[11px] text-slate-500">
                    Strict privacy guaranteed. We never share dealer contact details.
                  </p>
                </form>
              ) : (
                /* Success Message */
                <div className="text-center py-10 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900">Message Received!</h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Thank you, <span className="font-bold text-slate-900">{formData.name}</span>. Our deployment consultant will contact you at <span className="font-mono text-blue-700 font-bold">{formData.phone}</span> shortly to assist with <span className="font-semibold text-slate-800">{formData.topic}</span>.
                  </p>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSubmitted(false);
                        setFormData({
                          name: '',
                          shopName: '',
                          phone: '',
                          city: '',
                          topic: 'Live Counter Demo',
                          message: ''
                        });
                      }}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                    >
                      Send Another Inquiry
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
