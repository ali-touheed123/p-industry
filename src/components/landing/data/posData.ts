import { PosFeature, PricingPlan, FAQItem, PaintProduct } from '../types';

export const SAMPLE_PRODUCTS: PaintProduct[] = [
  {
    id: 'PNT-101',
    name: 'WeatherShield Max All-Weather',
    brand: 'Dulux',
    category: 'Exterior',
    unit: '16L (Drum)',
    stock: 14,
    minStock: 5,
    costPrice: 16800,
    salePrice: 19500,
    colorCode: '90GY 21/472',
    baseType: 'Base A',
  },
  {
    id: 'PNT-102',
    name: 'Silk Emulsion Brilliant White',
    brand: 'Berger',
    category: 'Interior',
    unit: '4L (Gallon)',
    stock: 38,
    minStock: 10,
    costPrice: 4200,
    salePrice: 4950,
    colorCode: 'Pure White 00NN',
    baseType: 'Base A',
  },
  {
    id: 'PNT-103',
    name: 'Super Gloss Synthetic Enamel',
    brand: 'Diamond Paints',
    category: 'Enamel',
    unit: '4L (Gallon)',
    stock: 4,
    minStock: 8,
    costPrice: 3800,
    salePrice: 4400,
    colorCode: 'Signal Red 505',
  },
  {
    id: 'PNT-104',
    name: 'Water-Based Wall Sealer Primer',
    brand: 'Nippon',
    category: 'Primer',
    unit: '16L (Drum)',
    stock: 22,
    minStock: 6,
    costPrice: 7200,
    salePrice: 8500,
  },
  {
    id: 'PNT-105',
    name: 'Machine Tinting Deep Base C',
    brand: 'Brighto',
    category: 'Tinting Base',
    unit: '4L (Gallon)',
    stock: 3,
    minStock: 12,
    costPrice: 3100,
    salePrice: 3650,
    baseType: 'Base C',
  },
  {
    id: 'PNT-106',
    name: 'Pro-Finish Microfiber Roller 9"',
    brand: 'Master Tools',
    category: 'Accessories',
    unit: 'Quarter',
    stock: 65,
    minStock: 20,
    costPrice: 450,
    salePrice: 700,
  }
];

export const POS_FEATURES: PosFeature[] = [
  {
    id: 'pos-sales',
    title: 'Rapid POS Sales & Invoicing',
    tagline: 'Process customer & contractor orders in seconds',
    description: 'Built for high counter traffic. Search paint codes, scan barcodes, select gallon or drum sizes, add tinting charges, and print clean thermal receipts instantly.',
    iconName: 'ReceiptText',
    badge: 'Core Engine',
    details: [
      'Instant barcode & color-code lookup',
      'Gallon, drum, and quarter unit switching',
      'Split payments: Cash, Card, Bank & Credit',
      'Direct thermal receipt & WhatsApp invoice'
    ],
    gridSpan: 'col-span-1 md:col-span-2'
  },
  {
    id: 'inventory-management',
    title: 'Paint & Tinting Inventory',
    tagline: 'Multi-unit tracking designed for paint cans & colorants',
    description: 'Track bases, ready-mix cans, colorant dispensers (ml/fl oz), and accessories. Automatic low-stock warnings before you run out of essential bases.',
    iconName: 'Layers',
    badge: 'Paint-Optimized',
    details: [
      'Pack size tracking (1L, 4L Gallons, 16L Drums, 20KG)',
      'Base A, B, C & Colorant stock monitoring',
      'Batch numbering and shade code cataloging',
      'Automated low-stock reorder thresholds'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'sales-returns',
    title: 'Effortless Sales Returns',
    tagline: 'Hassle-free customer return handling',
    description: 'Manage unopened can returns and adjustments with complete ledger traceability. Reverse inventory automatically without messy manual accounting.',
    iconName: 'RotateCcw',
    details: [
      'Invoice-linked return processing',
      'Instant customer ledger credit or cash refund',
      'Automated inventory restock validation',
      'Return reason & seal verification logging'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'purchases-management',
    title: 'Supplier Purchases & Invoices',
    tagline: 'Keep manufacturer orders completely organized',
    description: 'Record company shipments from Dulux, Berger, Nippon, and local distributors. Track purchase costs, discounts, freight, and payables.',
    iconName: 'Truck',
    details: [
      'Record supplier bills with batch details',
      'Track unpaid supplier balances & dues',
      'Cost price history & margin calculation',
      'Direct stock injection upon goods arrival'
    ],
    gridSpan: 'col-span-1 md:col-span-2'
  },
  {
    id: 'purchase-returns',
    title: 'Supplier Purchase Returns',
    tagline: 'Handle damaged cans and distributor claims',
    description: 'Easily return leaking or mismatched cans back to paint manufacturers with automated debit notes and balance deduction.',
    iconName: 'CornerUpLeft',
    details: [
      'Debit note generation for paint distributors',
      'Vendor balance automatic reconciliation',
      'Damaged / expired batch isolation',
      'Track return claim resolution status'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'customer-contractor',
    title: 'Customer & Painter Accounts',
    tagline: 'Contractor khata & credit management',
    description: 'Maintain detailed ledger accounts for painters, interior designers, and construction contractors. Track running balances, credit limits, and payments.',
    iconName: 'Users',
    badge: 'Khata / Credit',
    details: [
      'Individual painter & contractor credit limits',
      'Running ledger balance statements',
      'Payment collection receipts',
      '1-Click WhatsApp ledger statements & receipts'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'business-reports',
    title: 'Smart Paint Shop Reports',
    tagline: 'Know your true profits, top brands, and cashflow',
    description: 'Gain instant visibility into daily sales, brand-wise margins (Dulux vs Berger vs Local), fast-moving paint shades, and net tax liabilities.',
    iconName: 'BarChart3',
    details: [
      'Daily register closing & cash drawer count',
      'Brand & category profitability analytics',
      'Fast-moving vs slow-moving paint analysis',
      'Export to PDF and Excel in one click'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  }
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'pos-only',
    name: 'POS Only',
    tagline: 'Sales, sales returns, basic inventory, purchase/returns & day close',
    priceMonthly: 'Rs. 14,999',
    priceAnnual: 'Rs. 14,999',
    period: '/month',
    priceNote: 'Flat monthly plan for counter operations',
    isPopular: false,
    ctaText: 'Get POS Only',
    features: [
      'High-Speed POS Counter Sales & Billing',
      'Sales Return & Instant Invoice Adjustments',
      'Basic Paint Inventory (Gallons, Drums, Liters)',
      'Supplier Purchase Logging & Cost History',
      'Supplier Purchase Returns & Distributor Debit Notes',
      'Day Close & Cash Drawer Register Balancing',
      'Thermal Receipt & Standard Invoice Printing',
      'Cloud Sync & Resilient Counter Operation'
    ],
    omittedFeatures: [
      'Branch Order & Central Stock Transfer',
      'Sales Management & Team Tracking',
      'Credit Customers & Painter Khata Ledgers',
      'Customer Debt Recovery System',
      'Percentage Pool for Managers',
      'Full CEO Oversight & Executive Control'
    ]
  },
  {
    id: 'full-pos-ceo',
    name: 'Full (POS + CEO)',
    tagline: 'Everything above + Branch Order, Sales Mgmt, Credit customers, Recovery, percentage pool & full CEO oversight',
    priceMonthly: 'Rs. 19,999',
    priceAnnual: 'Rs. 19,999',
    period: '/month base',
    addonText: '+ Rs. 2,999/mo per additional branch',
    priceNote: 'Includes full CEO suite + 1st branch; add branches as needed',
    isPopular: true,
    ctaText: 'Get Full (POS + CEO)',
    features: [
      'Everything in POS Only Plan included',
      'Branch Order & Inter-Branch Stock Transfers',
      'Complete Sales Management & Rep Performance',
      'Credit Customers & Contractor Khata Accounts',
      'Debt Recovery Management & Aging Due Alerts',
      'Percentage Pool Commission System for Managers',
      'Full CEO Oversight, Remote Audits & Executive Dashboards',
      'Per-Branch Add-on Option (Rs. 2,999/branch/mo)',
      'Priority Phone & WhatsApp Support with Free Onboarding'
    ]
  },
  {
    id: 'customized',
    name: 'Customized',
    tagline: 'One-off features beyond standard tiers (new report types, integrations, unique workflows)',
    priceMonthly: 'Custom Quote',
    priceAnnual: 'Custom Quote',
    period: 'per feature',
    priceNote: 'Quoted separately based on feature scope',
    isPopular: false,
    ctaText: 'Request Custom Quote',
    features: [
      'One-Off Custom Features & Unique Shop Workflows',
      'New Custom Report Types & Audit Statements',
      'Specialized Hardware & Barcode Scale Integrations',
      'Third-party ERP, Bank & Accounting Integrations',
      'Tailored Profit-Sharing & Manager Incentive Logic',
      'Custom Accounting & Financial Formula Integrations',
      'Dedicated Developer Delivery & Architectural Support',
      'Lifetime Upgrade Compatibility & Warranty'
    ]
  }
];

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'Is pyntflow specifically designed for paint shops?',
    answer: 'Yes, 100%. Generic retail or grocery POS systems do not understand how paint shops operate. pyntflow handles paint container units (1L, 4L Gallons, 16L Drums, Quarters), tracks machine tinting bases (Base A, Base B, Base C, Clear Base), manages painter credit khata, and calculates profit margins for major paint brands like Dulux, Berger, Nippon, and Diamond.'
  },
  {
    id: 'faq-2',
    question: 'Can I manage inventory for paint buckets, drums, and colorants?',
    answer: 'Absolutely. You can maintain complete inventory for all paint categories including ready-mixed paints, tinting bases, colorant dispensers, primers, wall putties, thinners, and painting tools. The software automatically alerts you when essential bases or fast-moving shades fall below your minimum reorder limit.'
  },
  {
    id: 'faq-3',
    question: 'Can I record purchases and manage paint supplier bills?',
    answer: 'Yes. You can record all incoming shipments and supplier purchase bills directly from company distributors. The software updates your stock levels immediately, records batch details, tracks cost price changes, and manages payable dues for every paint distributor.'
  },
  {
    id: 'faq-4',
    question: 'Can I process sales returns when customers bring back unused paint?',
    answer: 'Yes. Sales returns are built directly into the POS. You can pull up the original invoice in seconds, verify returned items (such as unopened buckets), and choose whether to issue a cash refund, adjust their painter credit khata balance, or perform a direct product exchange.'
  },
  {
    id: 'faq-5',
    question: 'Can I manage purchase returns for damaged or leaking cans?',
    answer: 'Yes. If a distributor delivers dented cans, wrong color bases, or leaking buckets, you can generate an official Purchase Return and Debit Note. The system automatically reconciles the balance with your paint supplier.'
  },
  {
    id: 'faq-6',
    question: 'Does the software support real-time cloud sync?',
    answer: 'Yes. Pyntflow is built on a high-speed cloud database architecture. Your multi-branch stock levels, counter sales, and customer ledgers sync in real-time, allowing the owner/CEO to view live reports remotely from anywhere.'
  },
  {
    id: 'faq-7',
    question: 'What is the difference between POS Only and Full (POS + CEO)?',
    answer: 'POS Only (Rs. 14,999/mo) covers complete single-counter operational essentials: fast billing, sales returns, gallon/drum inventory, purchase logging, purchase returns, and daily register close. Full (POS + CEO) (Rs. 19,999/mo base) adds inter-branch orders, sales rep management, contractor credit accounts, debt recovery workflows, manager percentage pools, and complete executive audit dashboards.'
  },
  {
    id: 'faq-8',
    question: 'How do multi-branch add-ons and custom features work?',
    answer: 'With the Full (POS + CEO) plan, you can connect additional branches or store outlets for Rs. 2,999/month per branch with unified live inventory sync. If you require one-off bespoke development—such as specialized tinting integrations, custom bank reconciliations, unique accounting formulas, or bespoke report formats—we scope and quote them separately per feature.'
  },
  {
    id: 'faq-9',
    question: 'Can I request a live demo before purchasing?',
    answer: 'Yes! We provide free live remote demonstrations and video walkthroughs. You can click the "Request a Demo" button anywhere on this website to test the interface, ask questions about your specific shop workflow, and see it in action.'
  },
  {
    id: 'faq-10',
    question: 'How do I purchase the software and get it installed?',
    answer: 'You can contact our sales team via WhatsApp, phone, or by submitting the contact form on this website. We provide step-by-step setup assistance, remote installation on your counter PC/laptop, database configuration with standard paint catalogs, and staff training.'
  }
];

export const BEFORE_AFTER_ITEMS = {
  before: [
    { title: 'Manual Paper Khatas & Books', desc: 'Writing contractor bills and running balances by hand, leading to calculation mistakes and lost revenue.' },
    { title: 'Confusing Gallon vs Drum Stock', desc: 'No clear count of 4L gallons vs 16L drums, resulting in unexpected stockouts during busy hours.' },
    { title: 'Scattered Supplier Invoices', desc: 'Distributor delivery receipts piled up on the counter with no clear record of what is owed to paint companies.' },
    { title: 'Painful Return Adjustments', desc: 'Messy cross-outs on invoices when painters return unused buckets, destroying inventory accuracy.' },
    { title: 'Unknown Daily Profit Margins', desc: 'No idea how much money was actually made today after deducting paint cost, discounts, and tinting fees.' }
  ],
  after: [
    { title: 'Instant 2-Second Digital Invoicing', desc: 'Scan or click paint codes, apply contractor discounts automatically, and print clean thermal receipts.' },
    { title: 'Real-Time Multi-Unit Inventory', desc: 'Accurate stock for every single can size (1L, 4L, 16L) plus separate Base-A, B, C and colorant tracking.' },
    { title: 'Organized Supplier Ledgers', desc: 'Every distributor invoice, payment, and pending balance tracked clearly in one centralized ledger.' },
    { title: '1-Click Linked Returns & Credits', desc: 'Scan the old bill, select returned cans, and automatically credit the painter’s running khata account.' },
    { title: 'Instant Daily Profit & Sales Reports', desc: 'At shop closing, see exact revenue, cash in drawer, contractor debt, and brand-by-brand gross profit.' }
  ]
};
