import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowRight, ChevronDown } from 'lucide-react';
import { PyntflowLogo } from './PyntflowLogo';

interface NavbarProps {
  onOpenDemo: (prefilledPlan?: string) => void;
  onNavigate: (path: string) => void;
  currentPath: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenDemo, onNavigate, currentPath }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);

      // Keep navbar visible if mobile drawer is currently open
      if (mobileMenuOpen) {
        setIsVisible(true);
        lastScrollY = currentScrollY;
        return;
      }

      // If near the very top, always show navbar
      if (currentScrollY < 15) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 60) {
        // Scrolling down -> hide navbar
        setIsVisible(false);
        setFeaturesDropdownOpen(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling back up -> show navbar
        setIsVisible(true);
      }

      lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen]);

  const handleLinkClick = (href: string) => {
    setMobileMenuOpen(false);
    setFeaturesDropdownOpen(false);

    if (href.startsWith('/')) {
      onNavigate(href);
    } else if (href.startsWith('#')) {
      if (currentPath !== '/') {
        onNavigate('/' + href);
      } else {
        const elem = document.querySelector(href);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  const featureLinks = [
    { title: 'POS Billing Register', path: '/features/pos', desc: 'F2-F9 counter keys, tint lookup & hold cart' },
    { title: 'Bulletproof Offline Engine', path: '/features/offline-mode', desc: '100% offline billing with auto FIFO cloud sync' },
    { title: 'Regular Receipt Designer', path: '/features/receipt-customization', desc: '80mm thermal & A4 designer with silent F5 print' },
    { title: 'Multi-Vault Paint Inventory', path: '/features/inventory', desc: 'Godown stock, gallon & drum pack multipliers' },
    { title: 'AI Purchase Bill Scanner', path: '/features/ai-invoice-scan', desc: 'Gemini vision OCR for Urdu & handwritten bills' },
    { title: 'Paint Token Safe Custody', path: '/features/token-management', desc: 'Brand token ledger & manufacturer reimbursement' },
    { title: 'Inter-Branch Stock Transfers', path: '/features/branch-transfers', desc: '4-stage multi-store requisition & dispatch ERP' },
    { title: 'CEO Executive Suite & Drawer', path: '/features/ceo-executive-suite', desc: 'Rupee cash drawer counter & remote store audits' },
    { title: 'Company Order Sheets', path: '/features/company-order-sheets', desc: 'Standardized procurement for paint reps' },
    { title: 'Sales & Contractor Khata', path: '/features/sales', desc: 'Customer ledgers, credit limits & WhatsApp slips' },
    { title: 'Reports & Margin Analytics', path: '/features/reports', desc: 'Daily daraz hisab & itemized profit margins' },
  ];

  return (
    <motion.header
      initial={{ y: 0 }}
      animate={{ y: isVisible ? 0 : -96 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 pt-3 pb-2"
    >
      <div
        className={`max-w-7xl mx-auto rounded-2xl transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/90 py-2.5 px-5 sm:px-6'
            : 'bg-white/80 backdrop-blur-sm border border-slate-200/70 py-3 px-5 sm:px-6'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <button
            onClick={() => handleLinkClick('/')}
            id="nav-brand-logo"
            className="flex items-center group focus:outline-none py-0.5 cursor-pointer"
            aria-label="Pyntflow Home"
          >
            <PyntflowLogo height={28} />
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs sm:text-sm font-semibold text-slate-600">
            {/* Features Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFeaturesDropdownOpen(!featuresDropdownOpen)}
                onMouseEnter={() => setFeaturesDropdownOpen(true)}
                className="flex items-center gap-1 hover:text-slate-900 transition-colors py-1 cursor-pointer"
              >
                <span>Features</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${featuresDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </button>

              <AnimatePresence>
                {featuresDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    onMouseLeave={() => setFeaturesDropdownOpen(false)}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 w-[420px]"
                  >
                    <div className="bg-white rounded-2xl p-3 shadow-xl border border-slate-200/90 max-h-[480px] overflow-y-auto">
                      <div className="grid grid-cols-1 gap-1">
                        {featureLinks.map((item) => (
                          <button
                            key={item.path}
                            onClick={() => handleLinkClick(item.path)}
                            className="flex flex-col text-left p-2.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
                          >
                            <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">
                              {item.desc}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between px-2">
                        <button
                          onClick={() => handleLinkClick('/features')}
                          className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Explore All Modules Hub</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => handleLinkClick('/pricing')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Pricing
            </button>

            <button
              onClick={() => handleLinkClick('/blog')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Blog
            </button>

            <button
              onClick={() => handleLinkClick('/faq')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              FAQ
            </button>

            <button
              onClick={() => handleLinkClick('/about')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              About
            </button>

            <button
              onClick={() => handleLinkClick('/contact')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => onOpenDemo()}
              id="nav-demo-btn"
              className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Interactive Demo
            </button>

            <button
              onClick={() => onOpenDemo('full-pos-ceo')}
              id="nav-get-started-btn"
              className="bg-[#0A0F1D] text-white px-4.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-[#FF6B00] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => onOpenDemo()}
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#0A0F1D] rounded-lg hover:bg-[#FF6B00] transition-colors cursor-pointer"
            >
              Demo
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-menu-toggle"
              aria-label="Toggle navigation menu"
              className="p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden pt-3 pb-2 border-t border-slate-200 mt-3 flex flex-col gap-1 max-h-[80vh] overflow-y-auto"
            >
              <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase font-mono">
                Features & Modules
              </div>
              {featureLinks.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleLinkClick(item.path)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-[#FF6B00] text-left"
                >
                  {item.title}
                </button>
              ))}

              <button
                onClick={() => handleLinkClick('/features')}
                className="px-3 py-1.5 text-xs font-bold text-[#FF6B00] hover:underline text-left"
              >
                View All Features Hub →
              </button>

              <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase font-mono mt-2">
                Pages & Guides
              </div>
              <button
                onClick={() => handleLinkClick('/pricing')}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg text-left"
              >
                Pricing & Editions
              </button>
              <button
                onClick={() => handleLinkClick('/blog')}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg text-left"
              >
                Knowledge Blog (15 Guides)
              </button>
              <button
                onClick={() => handleLinkClick('/faq')}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg text-left"
              >
                FAQ
              </button>
              <button
                onClick={() => handleLinkClick('/about')}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg text-left"
              >
                About Pyntflow
              </button>
              <button
                onClick={() => handleLinkClick('/contact')}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg text-left"
              >
                Contact
              </button>

              <div className="pt-2 mt-2 border-t border-slate-200 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDemo();
                  }}
                  className="w-full py-2.5 px-4 text-center text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Interactive Demo
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDemo('full-pos-ceo');
                  }}
                  className="w-full py-2.5 px-4 text-center text-sm font-bold text-white bg-[#0A0F1D] hover:bg-[#FF6B00] rounded-xl shadow-sm transition-colors"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};
