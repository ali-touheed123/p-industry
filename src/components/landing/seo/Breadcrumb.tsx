import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-slate-500 font-medium overflow-x-auto no-scrollbar">
      <button 
        onClick={() => onNavigate('/')}
        className="flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
      >
        <Home className="w-3.5 h-3.5 text-slate-400" />
        <span>Home</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.url}>
            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="text-[#FF6B00] font-semibold truncate" aria-current="page">
                {item.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(item.url)}
                className="hover:text-slate-900 transition-colors cursor-pointer truncate"
              >
                {item.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
