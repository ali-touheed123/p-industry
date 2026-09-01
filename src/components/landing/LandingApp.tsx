'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { TrustStrip } from './TrustStrip';
import { ProblemSolution } from './ProblemSolution';
import { FeaturesBento } from './FeaturesBento';
import { HowItWorks } from './HowItWorks';
import { Pricing } from './Pricing';
import { FAQSection } from './FAQSection';
import { ContactUs } from './ContactUs';
import { Footer } from './Footer';
import { DemoModal } from './DemoModal';

// SEO & Content Pages
import {
  PaintShopPosPage,
  PaintStoreManagementPage,
  PaintShopBillingPage,
  PaintInventoryPage,
  PaintDealerPage,
} from './pages/ProductPages';
import { PakistanLandingPage } from './pages/PakistanLandingPage';
import {
  PosFeaturePage,
  InventoryFeaturePage,
  SalesFeaturePage,
  SalesReturnsFeaturePage,
  PurchasesFeaturePage,
  PurchaseReturnsFeaturePage,
  ReportsFeaturePage,
} from './pages/FeaturePages';
import { FeaturesHubView } from './pages/FeaturesHubView';
import { BlogHubView } from './pages/BlogHubView';
import { FaqPageView } from './pages/FaqPageView';
import { AboutPageView } from './pages/AboutPageView';
import { ContactPageView } from './pages/ContactPageView';
import { PricingPageView } from './pages/PricingPageView';

export default function LandingApp() {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [selectedPlanForDemo, setSelectedPlanForDemo] = useState<string | undefined>(undefined);

  // Only read window.location on client
  useEffect(() => {
    setCurrentPath(window.location.pathname || '/');
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

  const renderCurrentView = () => {
    if (currentPath === '/paint-shop-pos')
      return <PaintShopPosPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/paint-store-management-software')
      return <PaintStoreManagementPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/paint-shop-billing-software')
      return <PaintShopBillingPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/paint-inventory-management-software')
      return <PaintInventoryPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/paint-dealer-software')
      return <PaintDealerPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/pos-software-pakistan')
      return <PakistanLandingPage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/pos')
      return <PosFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/inventory')
      return <InventoryFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/sales')
      return <SalesFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/sales-returns')
      return <SalesReturnsFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/purchases')
      return <PurchasesFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/purchase-returns')
      return <PurchaseReturnsFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features/reports')
      return <ReportsFeaturePage onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/features')
      return <FeaturesHubView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/pricing')
      return <PricingPageView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/faq')
      return <FaqPageView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/about')
      return <AboutPageView onNavigate={navigateTo} onOpenDemo={() => handleOpenDemo()} />;
    if (currentPath === '/contact')
      return <ContactPageView onNavigate={navigateTo} />;
    if (currentPath.startsWith('/blog/')) {
      const slug = currentPath.replace('/blog/', '');
      return <BlogHubView onNavigate={navigateTo} selectedArticleSlug={slug} />;
    }
    if (currentPath === '/blog')
      return <BlogHubView onNavigate={navigateTo} />;

    // Default: Homepage
    return (
      <>
        <Hero onOpenDemo={() => handleOpenDemo()} onExploreFeatures={handleExploreFeatures} />
        <TrustStrip />
        <ProblemSolution />
        <FeaturesBento />
        <HowItWorks onOpenDemo={() => handleOpenDemo()} />
        <Pricing onSelectPlan={(planId) => handleOpenDemo(planId)} />
        <FAQSection onOpenDemo={() => handleOpenDemo()} />
        <ContactUs onOpenDemo={handleOpenDemo} />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans relative overflow-x-hidden selection:bg-orange-100 selection:text-orange-900 bg-grid-pattern">
      <Navbar onOpenDemo={handleOpenDemo} onNavigate={navigateTo} currentPath={currentPath} />
      <main className="relative z-10">{renderCurrentView()}</main>
      <Footer onOpenDemo={() => handleOpenDemo()} onNavigate={navigateTo} />
      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        initialPlan={selectedPlanForDemo}
      />
    </div>
  );
}
