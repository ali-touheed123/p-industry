export interface PosFeature {
  id: string;
  title: string;
  tagline: string;
  description: string;
  iconName: string;
  badge?: string;
  highlight?: string;
  details: string[];
  gridSpan?: string; // for bento layout
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: string;
  priceAnnual: string;
  period: string;
  addonText?: string;
  priceNote?: string;
  isPopular?: boolean;
  features: string[];
  omittedFeatures?: string[];
  ctaText: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface PaintProduct {
  id: string;
  name: string;
  brand: string;
  category: 'Interior' | 'Exterior' | 'Enamel' | 'Primer' | 'Tinting Base' | 'Accessories';
  unit: '1L' | '4L (Gallon)' | '16L (Drum)' | 'Quarter' | 'Bottle';
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  colorCode?: string;
  baseType?: 'Base A' | 'Base B' | 'Base C' | 'Clear Base';
}
