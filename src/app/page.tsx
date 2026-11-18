import type { Metadata } from 'next';
import Script from 'next/script';
import LandingApp from '@/components/landing/LandingApp';

export const metadata: Metadata = {
  title: 'Pyntflow | Paint Shop POS Software & Inventory Management',
  description:
    'Pyntflow is purpose-built paint shop POS software. Handle AI purchase invoice scanning, paint bucket token management, fast counter billing, contractor khata, multi-pack inventory, and silent thermal printing.',
  keywords: [
    'paint shop POS software',
    'paint shop software',
    'paint store software',
    'POS software for paint shops',
    'paint shop billing software',
    'paint inventory management software',
    'AI purchase invoice scanner',
    'paint token management software',
    'paint dealer software',
    'best POS for paint store',
  ],
  openGraph: {
    title: 'Pyntflow | Paint Shop POS Software & AI Inventory',
    description:
      'Purpose-built POS, AI supplier bill scanner & paint token management for paint shops, authorized dealers, and wholesale networks.',
    url: 'https://pyntflow.com/',
    siteName: 'Pyntflow',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pyntflow | Paint Shop POS Software & AI Inventory',
    description:
      'Purpose-built POS, AI supplier bill scanner & paint token management for paint shops, authorized dealers, and wholesale networks.',
  },
};

export default function RootHomePage() {
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtm.js?id=GTM-KGLX7DF3"
        strategy="afterInteractive"
      />
      <Script
        id="gtm-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          `,
        }}
      />
      <LandingApp />
    </>
  );
}