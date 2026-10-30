import React from 'react';
import { motion } from 'motion/react';
import { 
  ReceiptText, 
  RotateCcw, 
  Layers, 
  Truck, 
  Users, 
  BarChart3, 
  Tag, 
  Check,
  ScanLine,
  Ticket,
  WifiOff,
  Printer,
  GitBranch,
  Coins,
  FileSpreadsheet,
  PauseCircle,
  Sliders
} from 'lucide-react';
import { POS_FEATURES } from './data/posData';

interface FeaturesBentoProps {
  onSelectFeature?: (featureId: string) => void;
}

export const FeaturesBento: React.FC<FeaturesBentoProps> = ({ onSelectFeature }) => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'ReceiptText':
        return <ReceiptText className="w-5 h-5 text-blue-600" />;
      case 'WifiOff':
        return <WifiOff className="w-5 h-5 text-emerald-600" />;
      case 'Printer':
        return <Printer className="w-5 h-5 text-indigo-600" />;
      case 'Layers':
        return <Layers className="w-5 h-5 text-blue-600" />;
      case 'RotateCcw':
        return <RotateCcw className="w-5 h-5 text-indigo-600" />;
      case 'Truck':
        return <Truck className="w-5 h-5 text-slate-700" />;
      case 'GitBranch':
        return <GitBranch className="w-5 h-5 text-teal-600" />;
      case 'Coins':
        return <Coins className="w-5 h-5 text-amber-600" />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'PauseCircle':
        return <PauseCircle className="w-5 h-5 text-orange-600" />;
      case 'Sliders':
        return <Sliders className="w-5 h-5 text-purple-600" />;
      case 'Users':
        return <Users className="w-5 h-5 text-emerald-600" />;
      case 'BarChart3':
        return <BarChart3 className="w-5 h-5 text-blue-600" />;
      case 'ScanLine':
        return <ScanLine className="w-5 h-5 text-violet-600" />;
      case 'Ticket':
        return <Ticket className="w-5 h-5 text-amber-600" />;
      default:
        return <Tag className="w-5 h-5 text-slate-700" />;
    }
  };

  return (
    <section id="features" className="py-20 sm:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Complete Feature Suite</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-5">
            Engineered for Daily Paint Counter Realities
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            From 100% offline billing during internet cuts and paint bucket token custody to multi-branch godown transfers, AI bill scanning, and custom thermal receipts.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POS_FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className={`rounded-2xl p-6 sm:p-7.5 bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all duration-200 flex flex-col justify-between relative ${
                feature.gridSpan || 'col-span-1'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                    {getIcon(feature.iconName)}
                  </div>
                  {feature.badge && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                      {feature.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {feature.title}
                </h3>
                
                <p className="text-xs font-semibold text-blue-600 mb-2.5">
                  {feature.tagline}
                </p>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  {feature.description}
                </p>
              </div>

              {/* Bulleted detail tags */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                {feature.details.map((detail, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-2 text-xs text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
