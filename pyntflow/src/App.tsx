import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { TrustStrip } from './components/TrustStrip';
import { ProblemSolution } from './components/ProblemSolution';
import { FeaturesBento } from './components/FeaturesBento';
import { HowItWorks } from './components/HowItWorks';
import { Pricing } from './components/Pricing';
import { FAQSection } from './components/FAQSection';
import { ContactUs } from './components/ContactUs';
import { Footer } from './components/Footer';
import { DemoModal } from './components/DemoModal';
import { MetaHead } from './components/seo/MetaHead';

// SEO & Content Pages
import { 
  PaintShopPosPage, 
  PaintStoreManagementPage, 
  PaintShopBillingPage, 
  PaintInventoryPage, 
  PaintDealerPage 
} from './components/pages/ProductPages';
import { PakistanLandingPage } from './components/pages/PakistanLandingPage';
import { 
  PosFeaturePage, 
  InventoryFeaturePage, 
  SalesFeaturePage, 
  SalesReturnsFeaturePage, 
  PurchasesFeaturePage, 
  PurchaseReturnsFeaturePage, 
  ReportsFeaturePage 
} from './components/pages/FeaturePages';
import { FeaturesHubView } from './components/pages/FeaturesHubView';
import { BlogHubView } from './components/pages/BlogHubView';
import { FaqPageView } from './components/pages/FaqPageView';
import { AboutPageView } from './components/pages/AboutPageView';
import { ContactPageView } from './components/pages/ContactPageView';
import { PricingPageView } from './components/pages/PricingPageView';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [selectedPlanForDemo, setSelectedPlanForDemo] = useState<string | undefined>(undefined);

  // Synchronize browser history and popstate navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (path === currentPath) return;
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const handleOpenDemo = (plan?: string) => {
    setSelectedPlanForDemo(plan);
    setDemoModalOpen(true);
  };

  const handleExploreFeatures = () => {
    if (currentPath !== '/') {
      navigateTo('/features');
    } else {
      const featuresElem = document.getElementById('features');
      if (featuresElem) {
        featuresElem.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Structured Schema for Homepage
  const homepageJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Pyntflow',
      'url': 'https://pyntflow.com',
      'logo': 'https://pyntflow.com/icon.svg',
      'description': 'Pyntflow is specialized point of sale and enterprise software for paint shops, retail paint stores, and authorized paint dealers.',
      'sameAs': []
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': 'Pyntflow',
      'url': 'https://pyntflow.com',
      'potentialAction': {
        '@type': 'SearchAction',
        'target': 'https://pyntflow.com/blog?q={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'Pyntflow Paint Shop POS Software',
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web, Windows, Android, macOS',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'description': 'Paint shop POS software engineered for paint retail counters, base-can tint inventory, contractor khata credit ledgers, and supplier procurement.'
    }
  ];

  // Route matching
  const renderCurrentView = () => {
    // 1. Product Pages
    if (currentPath === '/paint-shop-pos') {
      return <PaintShopPosPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/paint-store-management-software') {
      return <PaintStoreManagementPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/paint-shop-billing-software') {
      return <PaintShopBillingPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/paint-inventory-management-software') {
      return <PaintInventoryPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/paint-dealer-software') {
      return <PaintDealerPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }

    // 2. Regional / Pakistan Landing Page
    if (currentPath === '/pos-software-pakistan') {
      return <PakistanLandingPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }

    // 3. Feature Detail Pages
    if (currentPath === '/features/pos') {
      return <PosFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/features/inventory') {
      return <InventoryFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/features/sales') {
      return <SalesFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/features/sales-returns') {
      return <SalesReturnsFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/features/purchases') {
      return <PurchasesFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/features/purchase-returns') {
      return <PurchaseReturnsFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/features/reports') {
      return <ReportsFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }

    // 4. Hubs & General Pages
    if (currentPath === '/features') {
      return <FeaturesHubView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/pricing') {
      return <PricingPageView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/faq') {
      return <FaqPageView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/about') {
      return <AboutPageView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    }
    if (currentPath === '/contact') {
      return <ContactPageView onNavigate={navigateTo} />;
    }

    // 5. Blog Hub & Individual Article Pages
    if (currentPath.startsWith('/blog/')) {
      const slug = currentPath.replace('/blog/', '');
      return <BlogHubView onNavigate={navigateTo} selectedArticleSlug={slug} />;
    }
    if (currentPath === '/blog') {
      return <BlogHubView onNavigate={navigateTo} />;
    }

    // Default: Optimized Interactive Homepage
    return (
      <>
        <MetaHead
          metadata={{
            title: 'Pyntflow | Paint Shop POS Software & Inventory Management',
            description: 'Pyntflow is purpose-built paint shop POS software. Handle fast billing, tint shade lookup, contractor khata, multi-pack inventory, and sales returns.',
            h1: 'The Point of Sale Built for Paint Buckets, Bases & Khatas',
            canonical: 'https://pyntflow.com/',
            keywords: [
              'paint shop POS software',
              'paint shop software',
              'paint store software',
              'POS software for paint shops',
              'paint shop billing software',
              'paint inventory management software',
              'paint dealer software',
              'best POS for paint store'
            ],
            ogType: 'website'
          }}
          schema={homepageJsonLd}
        />

        {/* Hero Section */}
        <Hero
          onOpenDemo={() => handleOpenDemo()}
          onExploreFeatures={handleExploreFeatures}
        />

        {/* Trust & Value Strip */}
        <TrustStrip />

        {/* Problem -> Solution (Before & After) */}
        <ProblemSolution />

        {/* Features Bento Showcase */}
        <FeaturesBento />

        {/* How It Works (3-Step Roadmap) */}
        <HowItWorks onOpenDemo={() => handleOpenDemo()} />

        {/* Pricing Section */}
        <Pricing onSelectPlan={(planId) => handleOpenDemo(planId)} />

        {/* FAQ Accordion */}
        <FAQSection onOpenDemo={() => handleOpenDemo()} />

        {/* Contact Us Section */}
        <ContactUs onOpenDemo={handleOpenDemo} />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans relative overflow-x-hidden selection:bg-orange-100 selection:text-orange-900 bg-grid-pattern">
      
      {/* Top Navigation */}
      <Navbar 
        onOpenDemo={handleOpenDemo} 
        onNavigate={navigateTo} 
        currentPath={currentPath}
      />

      {/* Main Content View (Dynamic Routed) */}
      <main className="relative z-10">
        {renderCurrentView()}
      </main>

      {/* Footer */}
      <Footer 
        onOpenDemo={() => handleOpenDemo()} 
        onNavigate={navigateTo}
      />

      {/* Interactive Lead Generation & Live Demo Request Modal */}
      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        initialPlan={selectedPlanForDemo}
      />

    </div>
  );
}
