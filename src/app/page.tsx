import type { Metadata } from 'next';
import LandingApp from '@/components/landing/LandingApp';

export const metadata: Metadata = {
  title: 'Pyntflow | Paint Shop POS Software & Inventory Management',
  description:
    'Pyntflow is purpose-built paint shop POS software. Handle fast billing, tint shade lookup, contractor khata, multi-pack inventory, multi-branch transfers, and CEO oversight — all in one system.',
  keywords: [
    'paint shop POS software',
    'paint shop software',
    'paint store software',
    'POS software for paint shops',
    'paint shop billing software',
    'paint inventory management software',
    'paint dealer software',
    'best POS for paint store',
  ],
  openGraph: {
    title: 'Pyntflow | Paint Shop POS Software',
    description:
      'Purpose-built POS & inventory management for paint shops, authorized dealers, and multi-branch paint networks.',
    url: 'https://pyntflow.com/',
    siteName: 'Pyntflow',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pyntflow | Paint Shop POS Software',
    description:
      'Purpose-built POS & inventory management for paint shops, authorized dealers, and multi-branch paint networks.',
  },
};

export default function RootHomePage() {
  return <LandingApp />;
}