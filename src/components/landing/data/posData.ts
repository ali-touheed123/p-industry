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
    title: 'Rapid POS Counter Sales & Hotkeys',
    tagline: 'Process customer & contractor orders in seconds',
    description: 'Built for high counter traffic. Search paint codes, scan barcodes, select gallon or drum sizes, add tinting charges, and print clean thermal receipts instantly using keyboard hotkeys (F2 Save, F5 Print, F7 Hold).',
    iconName: 'ReceiptText',
    badge: 'Core Engine',
    details: [
      'Instant barcode & color-code lookup with hotkeys (F2-F9)',
      'Gallon, drum, and quarter unit switching with live multipliers',
      'Split payments: Cash, Card, Bank Transfer & Contractor Khata',
      'Silent isolated iframe thermal receipt & 1-click WhatsApp invoice'
    ],
    gridSpan: 'col-span-1 md:col-span-2'
  },
  {
    id: 'offline-mode',
    title: 'Bulletproof Offline Mode & Auto-Sync',
    tagline: 'Zero downtime counter billing during internet or power outages',
    description: 'Broadband cuts and load-shedding will never halt your counter. Pyntflow stores transactions locally in native IndexedDB, locks stock overlays in real-time, and flushes sales in strict FIFO order the instant connectivity returns.',
    iconName: 'WifiOff',
    badge: 'Zero-Downtime Engine',
    details: [
      'Uninterrupted billing during internet & broadband drops',
      'Native IndexedDB queue with automated background sync',
      'Multi-tab synchronization locking via Web Locks API',
      'Clean official receipts with device codes (e.g. K7F2-0042)',
      'Local stock overlay prevents overselling while offline',
      'Karachi timezone transaction timestamp lock'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'receipt-customization',
    title: 'Regular Receipt Template Customization',
    tagline: '80mm thermal, 58mm & A4 layouts with visual designer & silent F5 printing',
    description: 'Customize every element of your customer receipts. Upload your store logo, add Urdu return policy terms, configure NTN/STRN tax details, toggle item columns (SKU, Qty, Rate, Discount), and print silently without popup dialogs.',
    iconName: 'Printer',
    badge: 'Thermal & A4 Designer',
    details: [
      'Visual designer for 80mm roll, 58mm thermal & A4 laser',
      'Custom store logo, address, phone & NTN/STRN tax headers',
      'Urdu return policy & warranty disclaimer footers',
      'Customizable table columns (SKU, Qty, Rate, Discount, Net)',
      'Silent isolated iframe printing (zero popup freezes, instant F5)'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'inventory-management',
    title: 'Paint & Tinting Multi-Vault Inventory',
    tagline: 'Multi-unit tracking designed for paint cans & colorants',
    description: 'Track bases, ready-mix cans, colorant dispensers (ml/fl oz), and accessories across showroom shelves and central godowns. Automatic low-stock warnings before you run out of essential bases.',
    iconName: 'Layers',
    badge: 'Paint-Optimized',
    details: [
      'Pack size tracking (1L, 4L Gallons, 16L Drums, 20KG)',
      'Base A, B, C & Colorant stock monitoring with batch codes',
      'Bulk product entry grid for fast shade cataloging',
      'Automated low-stock reorder thresholds and godown alerts'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'ai-invoice-scan',
    title: 'AI Purchase Invoice Scanning',
    tagline: 'Photograph a supplier invoice — AI reads every item in seconds',
    description: 'Upload a photo of any supplier invoice (handwritten, printed, Urdu or English) and Google Gemini AI extracts all line items automatically. What used to take 45 minutes now takes 10 seconds.',
    iconName: 'ScanLine',
    badge: 'Gemini AI Vision',
    details: [
      'Google Gemini 2.0 Flash Vision AI parsing',
      'Reads handwritten, dot-matrix & Urdu invoices',
      'Fuzzy-matches extracted items to your inventory',
      'Review & confirm before stock is committed'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'token-management',
    title: 'Paint Token Management & Safe Custody',
    tagline: 'Track paint brand tokens issued, redeemed & retained per shift',
    description: 'Paint products carry physical brand tokens worth hundreds of rupees. Pyntflow tracks every token — whether kept by the customer, removed by the shop, or redeemed for cash — prevents cashier theft via Safe Custody tracking, and produces manufacturer reimbursement summaries.',
    iconName: 'Ticket',
    badge: 'Token Ledger',
    details: [
      'Token issued / removed / redeemed workflows',
      'Safe custody audit prevents counter staff leakage',
      'Registered & walk-in customer partial redemptions',
      'Per-shift brand & quality category token summary',
      'Company reimbursement report by brand (Dulux, Berger, Nippon)'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'customer-contractor',
    title: 'Customer & Painter Accounts (Khata)',
    tagline: 'Contractor khata, credit limits & high-resolution WhatsApp statements',
    description: 'Maintain detailed ledger accounts for painters, interior designers, and construction contractors. Track running balances, credit limits, payments, and export crisp HTML5 Canvas PNG statements with zero font truncation.',
    iconName: 'Users',
    badge: 'Khata / Credit',
    details: [
      'Individual painter & contractor credit limit enforcement',
      'Running ledger balance statements with real aging (0-30, 31-60, 61+)',
      '1-Click WhatsApp Canvas PNG statement export with auto phone formatting',
      'Advance payments, credit notes & partial recovery tracking'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'branch-transfers',
    title: 'Inter-Branch Stock Transfers (IBT)',
    tagline: '4-stage requisition & dispatch across godowns and sister shops',
    description: 'Request, dispatch, and receive paint containers across multiple branches without telephone confusion. Pyntflow handles atomic multi-store stock deduction and creates mirrored inter-branch cost vouchers automatically.',
    iconName: 'GitBranch',
    badge: 'Multi-Store ERP',
    details: [
      '4-stage lifecycle: Pending ➔ Accepted ➔ Dispatched ➔ Received',
      'Zero-stock branch requisitions directly from central godown',
      'Atomic stock deduction at dispatch and injection at receipt',
      'Mirrored inter-branch accounting vouchers with cost prices'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'ceo-day-close',
    title: 'CEO Executive Suite & Rupee Day Close',
    tagline: 'Rs. 5000 to Rs. 10 denomination drawer counter & remote multi-branch audits',
    description: 'Reconcile your physical cash drawer using Pakistani Rupee denomination counters (Rs. 5000, 1000, 500, 100, 50, 20, 10). Detect cash shortages or overages instantly, view real COGS margins, and monitor sister branches from your phone.',
    iconName: 'Coins',
    badge: 'Executive Audit',
    details: [
      'Interactive Pakistani Rupee denomination counter (5000 to 10)',
      'Automated cash drawer variance flags (shortage/overage alerts)',
      'Token cash payouts automatically deducted from expected cash',
      'Consolidated multi-branch P&L and negative stock monitoring'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'company-order-sheets',
    title: 'Company Order Sheets & Procurement',
    tagline: 'Generate formal order sheets formatted for paint manufacturer reps',
    description: 'Generate standardized order sheets for sales officers at Dulux, Berger, Nippon, and Diamond Paints. Select required shade codes, drum/gallon pack sizes, export to thermal print, A4 or Excel, and keep purchase requisitions organized.',
    iconName: 'FileSpreadsheet',
    badge: 'Procurement Sheet',
    details: [
      'Manufacturer-specific templates (Dulux, Berger, Nippon, Diamond)',
      'Pack size variant aggregation (Quarters, Gallons, Drums)',
      'Direct thermal order slips, A4 purchase sheets & Excel export',
      'Fast requisition based on automated low-stock thresholds'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'hold-invoices',
    title: 'Parked Invoices & Carts (F7 Hold)',
    tagline: 'Park and resume active carts with zero lost counter speed',
    description: 'When a customer steps away to pick another shade or check with their painter, press F7 to park the entire cart. Serve waiting customers, then press F8 to restore the cart instantly with all items, sizes, and discounts intact.',
    iconName: 'PauseCircle',
    badge: 'Queue Speed',
    details: [
      'One-key cart parking (F7 Hold) and instant restoration (F8)',
      'Preserves selected contractor, line items, discounts & delivery charges',
      'Offline-safe hold storage via local hold store fallback',
      'Prevents counter congestion during peak contractor morning rushes'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'stock-adjustments',
    title: 'Damage, Leakage & Evaporation Logs',
    tagline: 'Accurate stock reconciliations for real paint shop shelf losses',
    description: 'Paint inventory faces real physical risks: dented cans, damaged seals, tinting machine calibration waste, and solvent evaporation. Pyntflow logs itemized adjustments with verified reason codes to keep book inventory truthful.',
    iconName: 'Sliders',
    badge: 'Stock Accuracy',
    details: [
      'Itemized stock adjustment grid with quantity and batch selection',
      'Audit reason classification: Damage, Leakage, Evaporation, Audit Count',
      'Automatic inventory ledger cost adjustments and journal logs',
      'Prevents phantom inventory from skewing reorder alerts'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'sales-returns',
    title: 'Effortless Sales Returns & Credit Notes',
    tagline: 'Hassle-free customer return handling and ledger adjustments',
    description: 'Manage unopened can returns and adjustments with complete ledger traceability. Reverse inventory automatically without messy manual accounting or balance mismatches.',
    iconName: 'RotateCcw',
    badge: 'Returns & Credit',
    details: [
      'Invoice-linked return processing with original price lock',
      'Instant customer ledger credit or cash refund options',
      'Automated inventory restock validation via atomic RPCs',
      'Return reason & seal verification logging'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  },
  {
    id: 'purchases-management',
    title: 'Supplier Purchases & Landed Cost History',
    tagline: 'Keep manufacturer orders and distributor payables organized',
    description: 'Record company shipments from Dulux, Berger, Nippon, and local distributors. Track purchase costs, discounts, freight, and payables with complete landed cost history.',
    iconName: 'Truck',
    badge: 'Vendor Payables',
    details: [
      'Record supplier bills with batch details and landed freight',
      'Track unpaid supplier balances, payables & due dates',
      'Cost price history & true margin calculations',
      'Direct stock injection upon goods arrival (GRN generation)'
    ],
    gridSpan: 'col-span-1 md:col-span-1'
  }
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'pos-only',
    name: 'POS Only',
    tagline: 'Complete store operations: billing, inventory, khatas, recovery & team management',
    priceMonthly: 'Rs. 14,999',
    priceAnnual: 'Rs. 14,999',
    period: '/month',
    priceNote: 'Flat monthly plan for full shop operations (excluding CEO Panel)',
    isPopular: false,
    ctaText: 'Get POS Only',
    features: [
      '100% Bulletproof Offline Counter Billing & Auto-Sync (Phase 10 Certified)',
      'High-Speed POS Counter Sales & Keyboard Hotkeys (F2-F9)',
      'Regular Thermal (80mm/58mm) & A4 Receipt Template Customization',
      'Silent Isolated Iframe Direct Printing (F5)',
      'Sales Return & Instant Invoice Adjustments',
      'Complete Paint Inventory (Gallons, Drums, Liters, Bases)',
      'Parked Invoices (F7 Hold & F8 Restore)',
      'Damage, Leakage & Evaporation Stock Adjustment Logs',
      'Supplier Purchase Logging & Landed Cost History',
      'Supplier Purchase Returns & Distributor Debit Notes',
      'Day Close & Cash Drawer Register Balancing',
      'Credit Customers & Painter Khata Ledgers',
      'Debt Recovery Management & Aging Due Alerts (0-30, 31-60, 61+)',
      '1-Click WhatsApp Canvas Ledger Statements',
      'Sales Team Quotas & Percentage Pool Commission System',
      'Company Order Sheets formatted for Paint Manufacturer Reps',
      'Branch Order & Inter-Branch Stock Transfers (IBT)',
      'AI Purchase Invoice Scanning (Gemini Vision AI)',
      'Paint Token Management (Issued, Redeemed, Retained & Safe Custody)'
    ],
    omittedFeatures: [
      'Full CEO Oversight & Executive Control Panel',
      'Pakistani Rupee Denomination Drawer Variance Grid',
      'Remote Multi-Store Mobile Audit Suite'
    ]
  },
  {
    id: 'full-pos-ceo',
    name: 'Full (POS + CEO)',
    tagline: 'Everything in POS Only + Executive CEO Control Panel & Remote Audit Dashboards',
    priceMonthly: 'Rs. 19,999',
    priceAnnual: 'Rs. 19,999',
    period: '/month base',
    addonText: '+ Rs. 2,999/mo per additional branch',
    priceNote: 'Includes full CEO suite + 1st branch; add branches as needed',
    isPopular: true,
    ctaText: 'Get Full (POS + CEO)',
    features: [
      'Everything in POS Only Plan included',
      '100% Bulletproof Offline Counter Billing & Auto-Sync across all branches',
      'Regular Thermal & A4 Receipt Designer with Multi-Branch Template Assignment',
      'Dedicated Executive CEO Control Panel with Instant Sister Store Switcher',
      'Remote Audits & Live Mobile Executive Dashboards',
      'Pakistani Rupee Denomination Cash Drawer Balancing (Rs. 5,000–Rs. 10 notes)',
      'Live Cash Shortage & Overage Variance Alerts at Day Close',
      'Multi-Branch Consolidated P&L & Inter-Branch Mirrored Ledgers',
      'Negative Stock Surveillance & Audit Logging',
      'Real-Time Margin & Hidden Expense Tracking',
      'Executive Security & Master Access Controls',
      'Per-Branch Add-on Option (Rs. 2,999/branch/mo)',
      'Priority Phone & WhatsApp Support with Free Onboarding'
    ]
  },
  {
    id: 'customized',
    name: 'Customized',
    tagline: 'Bespoke features beyond standard tiers: specialized market receipts, integrations & custom workflows',
    priceMonthly: 'Custom Quote',
    priceAnnual: 'Custom Quote',
    period: 'per feature',
    priceNote: 'Quoted separately based on feature scope',
    isPopular: false,
    ctaText: 'Request Custom Quote',
    features: [
      'All Standard Features (AI Scanning, Token Management, Offline Sync, etc.)',
      'Specialized Market Receipts & Dual-Receipt Sequencing (Gated CEO Audit)',
      'Shift-Independent Idempotency & Dedicated Market Print Audit Logs',
      'Regular & Specialized Receipt Template Customization with Multi-Layout Support',
      'One-Off Custom Features & Unique Shop Workflows',
      'New Custom Report Types & Proprietary Audit Statements',
      'Specialized Hardware & Barcode Scale Integrations',
      'Third-party ERP, Bank (Raast / 1Link) & Accounting Integrations',
      'Tailored Profit-Sharing & Multi-Tier Manager Incentive Logic',
      'Custom Accounting & Financial Formula Integrations',
      'Dedicated Developer Delivery & Architectural Support',
      'Lifetime Upgrade Compatibility & Warranty'
    ]
  }
];

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-offline',
    question: 'What happens if the internet or electricity drops during peak counter hours?',
    answer: 'Pyntflow continues billing at full speed without internet. Powered by our Phase 10 certified offline-first engine with native IndexedDB outbox queues, cashiers can search products, apply discounts, adjust quantities, process cash or painter khata credit sales, and print official receipts with unique device sequence codes (e.g. K7F2-0042). The local inventory view decrements immediately so products are never oversold. When broadband or mobile data reconnects, Pyntflow automatically synchronizes queued sales to the cloud in strict FIFO order using the Web Locks API, with zero duplicate invoices.'
  },
  {
    id: 'faq-receipt-customization',
    question: 'Can I customize my receipts with my shop logo, Urdu return policy terms, and tax NTN?',
    answer: 'Yes! Pyntflow includes a comprehensive visual Receipt Template Designer supporting 80mm roll thermal, 58mm roll, and A4/A5 laser formats. You can upload your paint shop logo, customize shop name and address, add NTN/STRN tax registration numbers, and write custom Urdu or English return policies and warranty disclaimers (e.g., regarding tinted paints or seal-broken cans). You can also toggle table columns (SKU, Qty, Rate, Discount, Net Amount) and print silently in under 1 second via isolated iframe printing without blank popup windows.'
  },
  {
    id: 'faq-special-receipt',
    question: 'Does Pyntflow support specialized market receipts or dual-receipt formats?',
    answer: 'Yes. For wholesale distributors and large paint dealers requiring tailored market receipts or dual numbering sequences for specific trade channels, Pyntflow provides a specialized market receipt engine. Because of financial compliance and market practices, this feature is offered under our Customized / Enterprise plan with strict CEO password gating, shift-independent idempotency, and immutable audit logging.'
  },
  {
    id: 'faq-ai-scan',
    question: 'Does Pyntflow support AI invoice scanning for purchases?',
    answer: 'Yes. Pyntflow uses Google Gemini 2.0 Flash Vision AI to read supplier invoice photos — including handwritten, dot-matrix printed, and mixed Urdu/English invoices. Simply upload a photo from your phone or scanner, and the AI extracts every line item (product name, code, quantity, unit, rate) in approximately 10 seconds. You review and confirm the results before stock is updated.'
  },
  {
    id: 'faq-token',
    question: 'What is the Paint Token Management feature?',
    answer: 'Many paint brands (Berger, Nippon, etc.) include physical tokens inside paint cans with monetary values of Rs. 200–1,000. Pyntflow tracks three token scenarios: (1) Token Issued — customer keeps the token inside the paint and receives the product at full price, their account is credited; (2) Token Removed — shop removes the token before sale, price is reduced by the token value, and the token is recorded for company reimbursement; (3) Token Redeemed — a customer returns to claim their token value in cash (partial redemptions supported). Pyntflow also maintains a Token Safe Custody audit to prevent counter staff theft and balances token cash payouts in the Day Close cash drawer.'
  },
  {
    id: 'faq-thermal-print',
    question: 'Can receipts print directly to a thermal printer without a preview dialog?',
    answer: 'Yes. For high-speed counter environments, Pyntflow supports silent direct printing using an isolated hidden iframe (printViaIframe) and Chrome Kiosk mode. Set your thermal printer (Xprinter, Rongta, Bixolon, Epson, Black Copper, etc.) as the Windows default printer. When a cashier presses F5 (Save & Print), the thermal receipt prints silently to the roll printer in under 1 second — no preview dialog, no popup freezes, no extra clicks.'
  },
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
    answer: 'Yes. You can record all incoming shipments and supplier purchase bills directly from company distributors. The software updates your stock levels immediately, records batch details, tracks landed cost price changes, and manages payable dues for every paint distributor.'
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
    answer: 'Yes. Pyntflow is built on a high-speed cloud database architecture with atomic RPC transactions. Your multi-branch stock levels, counter sales, and customer ledgers sync in real-time, allowing the owner/CEO to view live reports remotely from anywhere.'
  },
  {
    id: 'faq-7',
    question: 'What is the difference between POS Only and Full (POS + CEO)?',
    answer: 'POS Only (Rs. 14,999/mo) includes everything for complete shop operations: fast counter billing, 100% offline auto-sync, receipt customization, sales returns, inventory, supplier purchases/returns, credit customer khatas, debt recovery, sales team tracking, manager percentage pools, branch transfers, AI invoice scanning, and token management. The Full (POS + CEO) plan (Rs. 19,999/mo base) adds the dedicated Executive CEO Control Panel with live mobile dashboards, remote audit oversight, Pakistani Rupee cash drawer balancing, and consolidated multi-branch executive analytics.'
  },
  {
    id: 'faq-8',
    question: 'How do multi-branch add-ons and custom features work?',
    answer: 'With the Full (POS + CEO) plan, you can connect additional branches or store outlets for Rs. 2,999/month per branch with unified live inventory sync. If you require bespoke development—such as specialized market receipts, custom bank reconciliations, unique accounting formulas, or bespoke report formats—we scope and quote them separately under our Customized tier.'
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
    { title: 'Counter Freezes on Internet Outages', desc: 'Broadband cuts or load-shedding halts billing; cashiers are forced to write handwritten paper slips and long queues form.' },
    { title: 'Fixed Generic Thermal Slips', desc: 'Unable to print shop logo, custom Urdu return policy terms, or tax NTN/STRN, leading to customer disputes.' },
    { title: 'Manual Paper Khatas & Books', desc: 'Writing contractor bills and running balances by hand, leading to calculation mistakes and lost revenue.' },
    { title: 'Confusing Gallon vs Drum Stock', desc: 'No clear count of 4L gallons vs 16L drums, resulting in unexpected stockouts during busy hours.' },
    { title: 'Scattered Supplier Invoices', desc: 'Distributor delivery receipts piled up on the counter with no clear record of what is owed to paint companies.' },
    { title: 'Painful Return Adjustments', desc: 'Messy cross-outs on invoices when painters return unused buckets, destroying inventory accuracy.' },
    { title: 'Cash Drawer Shortages at Day Close', desc: 'Cashiers miscount notes or forget physical token cash payouts, causing stressful end-of-shift disputes.' },
    { title: '45-Minute Manual Invoice Entry', desc: 'Typing hundreds of purchase line items from paper supplier invoices by hand, prone to entry errors and stock discrepancies.' },
    { title: 'No Token Safe Custody', desc: 'Paint brand tokens (Rs. 200–1,000 each) tracked on paper scraps with no accountability and high counter staff leakage.' }
  ],
  after: [
    { title: '100% Bulletproof Offline Billing', desc: 'Keep scanning and billing with zero internet; transactions queue locally and sync automatically with device codes.' },
    { title: 'Visual Receipt Designer', desc: 'Easily customize 80mm roll and A4 layouts with your store logo, Urdu warranty terms, tax NTN, and silent F5 printing.' },
    { title: 'Instant 2-Second Digital Invoicing', desc: 'Scan or click paint codes, apply contractor discounts automatically, and print clean thermal receipts.' },
    { title: 'Real-Time Multi-Unit Inventory', desc: 'Accurate stock for every single can size (1L, 4L, 16L) plus separate Base-A, B, C and colorant tracking.' },
    { title: 'Organized Supplier Ledgers', desc: 'Every distributor invoice, payment, and pending balance tracked clearly in one centralized ledger.' },
    { title: '1-Click Linked Returns & Credits', desc: "Scan the old bill, select returned cans, and automatically credit the painter's running khata account." },
    { title: 'Pakistani Rupee Denomination Drawer', desc: 'Counter staff enter counted Rs. 5000 to Rs. 10 notes; software balances tokens and highlights exact variance.' },
    { title: '10-Second AI Purchase Entry', desc: 'Photograph a supplier invoice — AI reads all 50+ line items and updates stock automatically in seconds.' },
    { title: 'Token Ledger & Safe Custody', desc: 'Every token tracked from issue to redemption with an anti-theft Safe Custody ledger and manufacturer claim summaries.' }
  ]
};
