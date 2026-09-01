import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle2, Paintbrush, Send } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: string;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose, initialPlan }) => {
  const [formData, setFormData] = useState({
    shopName: '',
    contactName: '',
    phone: '',
    city: '',
    counters: '1 Counter',
    selectedPlan: initialPlan || 'full-pos-ceo',
    hasTintingMachine: true,
    message: ''
  });

  // Sync initialPlan if passed
  React.useEffect(() => {
    if (initialPlan) {
      setFormData(prev => ({ ...prev, selectedPlan: initialPlan }));
    }
  }, [initialPlan]);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 bg-white text-left z-10 my-8 text-slate-900"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSubmitted ? (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                <Paintbrush className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Request pyntflow Demo & Quote</h3>
                <p className="text-xs text-slate-600">See how pyntflow fits your specific paint store operations</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paint Shop / Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Color Center & Hardware"
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Mehmood"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 transition-all font-mono shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plan / Tier Preference
                  </label>
                  <select
                    value={formData.selectedPlan}
                    onChange={(e) => setFormData({ ...formData, selectedPlan: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition-all shadow-2xs"
                  >
                    <option value="pos-only">POS Only (Rs. 19,999/mo)</option>
                    <option value="full-pos-ceo">Full POS + CEO (Rs. 29,999/mo base)</option>
                    <option value="customized">Customized (Quoted per feature)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Counters / Branches
                  </label>
                  <select
                    value={formData.counters}
                    onChange={(e) => setFormData({ ...formData, counters: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition-all shadow-2xs"
                  >
                    <option value="1 Counter">1 Counter (Single PC)</option>
                    <option value="2 Counters / Branches">2 Counters / Branches</option>
                    <option value="3+ Counters / Multi-Branch">3+ Counters / Multi-Branch</option>
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasTintingMachine}
                    onChange={(e) => setFormData({ ...formData, hasTintingMachine: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 w-4 h-4"
                  />
                  <span>We operate a Computerized Paint Tinting Machine</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Tell us about the paint brands you sell (Dulux, Berger, Nippon, Diamond, etc.) or specific requirements..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400 transition-all resize-none shadow-2xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Demo & Quote Request</span>
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-500">
                No spam. We respect your trade privacy and respond within 30 minutes.
              </p>

            </form>
          </div>
        ) : (
          /* Submission Confirmation View */
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Request Received!</h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6">
              Thank you, <span className="font-semibold text-slate-900">{formData.contactName || 'Shop Owner'}</span>. Our pyntflow deployment specialist will contact you at <span className="font-mono text-blue-700 font-bold">{formData.phone}</span> shortly with a custom walkthrough.
            </p>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700 space-y-1.5 mb-6 max-w-xs mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">Shop:</span>
                <span className="font-bold text-slate-900">{formData.shopName || 'Paint Store'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Tier:</span>
                <span className="font-bold text-blue-700">
                  {formData.selectedPlan === 'pos-only' ? 'POS Only (Rs. 19,999/mo)' : formData.selectedPlan === 'customized' ? 'Customized Plan' : 'Full POS + CEO (Rs. 29,999/mo)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terminals:</span>
                <span>{formData.counters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tinting Machine:</span>
                <span>{formData.hasTintingMachine ? 'Yes (Integrated)' : 'Standard'}</span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Back to Website
            </button>
          </div>
        )}

      </motion.div>
    </div>
  );
};

