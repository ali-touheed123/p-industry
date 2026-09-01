import React from 'react';
import { ProductDetailView } from './ProductDetailView';

interface FeaturePageWrapperProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

// 1. POS Feature Page
export const PosFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="POS System for Paint Shops"
    seoTitle="POS System for Paint Shops | High-Speed Counter Billing"
    metaDescription="Fast keyboard-driven POS system for paint shops. Includes F2-F9 hotkeys, split payments, shade lookup, hold carts, and thermal receipts."
    canonical="https://pyntflow.com/features/pos"
    keywords={['POS system for paint shops', 'paint shop POS system', 'paint store point of sale', 'paint shop checkout software']}
    heroBadge="Module: Point of Sale"
    h1="High-Velocity POS System for Paint Shops"
    subtitle="Engineered for fast-paced paint counters: keyboard hotkeys, rapid shade lookup, split payments, and instant receipt printing."
    overviewHeading="Optimized for High-Volume Paint Checkout Counters"
    overviewParagraphs={[
      'The Pyntflow POS module empowers cashiers to ring up customers at maximum speed using keyboard shortcuts, barcode scanning, and fast shade lookup.',
      'Supports parked orders (F7 Hold), multiple payment tenders (Cash, Card, Bank Transfer, Khata), and automated customer balance stamping on receipts.'
    ]}
    keyFeatures={[
      { title: 'Keyboard Hotkeys (F2-F9)', description: 'Save, search, add, print, hold, and cancel bills without reaching for a mouse.' },
      { title: 'Split Tender Payments', description: 'Accept split payments across multiple methods on a single invoice.' },
      { title: 'Hold / Resume Invoices', description: 'Park active carts and resume them instantly when customers are ready.' }
    ]}
    whyItMatters={[
      { title: 'Fast Queue Processing', description: 'Process customer checkouts in seconds during peak hours.' },
      { title: 'Accurate Receipts', description: 'Eliminate manual calculation mistakes and provide clear documentation.' },
      { title: 'Seamless Khata Integration', description: 'Post credit sales directly to customer ledgers with automated balance tracking.' }
    ]}
    faqItems={[
      {
        question: 'How fast can a cashier generate a receipt in Pyntflow POS?',
        directAnswer: 'In under 5 seconds using keyboard shortcuts (F2 Save, F5 Print) and barcode scanning.',
        answer: 'The interface is specifically designed to eliminate unnecessary clicks during counter checkout.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'Inventory Management', url: '/features/inventory', category: 'Feature' }
    ]}
  />
);

// 2. Inventory Feature Page
export const InventoryFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop Inventory Management"
    seoTitle="Paint Shop Inventory Management | Stock & Vault Controls"
    metaDescription="Manage paint inventory across showroom shelves and central godowns. Track quarter, gallon, and drum packaging with automated reorder alerts."
    canonical="https://pyntflow.com/features/inventory"
    keywords={['paint shop inventory management', 'paint store inventory control', 'paint stock software', 'godown inventory tracking']}
    heroBadge="Module: Multi-Vault Inventory"
    h1="Multi-Vault Paint Shop Inventory Management"
    subtitle="Maintain complete visibility over base cans, colorants, packaging size variants, and godown transfers with automated reorder alerts."
    overviewHeading="Precision Control Over Paint Stock Dimensions"
    overviewParagraphs={[
      'Pyntflow Inventory Management tracks stock across front showroom shelves and back-room storage vaults with real-time balance updates on every sale and purchase.',
      'Includes packaging multipliers (quarter, gallon, drum), batch expiry tracking, and customizable safety stock reorder thresholds.'
    ]}
    keyFeatures={[
      { title: 'Multi-Vault Godown Management', description: 'Track separate balances for retail counters and storage warehouses.' },
      { title: 'Pack Size Multipliers', description: 'Automatic fractional stock deduction for quarter, gallon, and drum containers.' },
      { title: 'Low Stock Alerts', description: 'Automated notifications when fast-moving shades or bases drop below safety thresholds.' }
    ]}
    whyItMatters={[
      { title: 'Zero Inventory Leakage', description: 'Know exact stock counts at all times to prevent inventory shrinkage.' },
      { title: 'Eliminate Stockouts', description: 'Reorder critical bases and fast-moving colors before they run out.' },
      { title: 'Accurate Valuation', description: 'Real-time calculation of total inventory value based on landed purchase costs.' }
    ]}
    faqItems={[
      {
        question: 'Can I track stock in both the shop and a separate warehouse?',
        directAnswer: 'Yes, Pyntflow supports multi-location inventory with internal transfer documentation.',
        answer: 'You can monitor stock in the showroom and warehouse godown separately with full transfer history.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Inventory Software', url: '/paint-inventory-management-software', category: 'Product' },
      { title: 'Purchase Management', url: '/features/purchases', category: 'Feature' }
    ]}
  />
);

// 3. Sales Feature Page
export const SalesFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop Sales Management Software"
    seoTitle="Paint Shop Sales Management Software | Pyntflow"
    metaDescription="Manage paint store sales, customer invoices, contractor payment terms, and daily sales registers with Pyntflow Sales Management."
    canonical="https://pyntflow.com/features/sales"
    keywords={['paint shop sales management software', 'paint store sales software', 'paint sales tracking', 'paint retail invoicing']}
    heroBadge="Module: Sales Management"
    h1="Complete Paint Shop Sales Management"
    subtitle="Track retail and contractor sales, invoice histories, payment receipts, and customer ledgers from a single dashboard."
    overviewHeading="End-to-End Sales Tracking for Paint Retailers"
    overviewParagraphs={[
      'The Pyntflow Sales module provides complete oversight of all counter transactions, credit bills, customer payment receipts, and historical invoices.',
      'Filter sales by date range, payment method, cashier, or customer account, and reprint invoices or export records with one click.'
    ]}
    keyFeatures={[
      { title: 'Comprehensive Invoice History', description: 'Search, filter, and review every sales transaction with itemized breakdowns.' },
      { title: 'Customer Ledger Integration', description: 'Credit sales post directly to customer accounts with real-time balance tracking.' },
      { title: 'Flexible Invoicing Formats', description: 'Generate 80mm thermal receipts or full A4/A5 laser invoices on demand.' }
    ]}
    whyItMatters={[
      { title: 'Complete Audit Trail', description: 'Every sale, discount, and return is permanently logged for accounting integrity.' },
      { title: 'Streamlined Customer Accounts', description: 'Track contractor credit balances and issue clear statement summaries.' },
      { title: 'Faster Reconciliation', description: 'Verify daily sales totals against cash drawer contents at shift close.' }
    ]}
    faqItems={[
      {
        question: 'Can I view sales performance by paint brand or category?',
        directAnswer: 'Yes, Pyntflow provides detailed sales breakdowns by brand, product category, and cashier.',
        answer: 'This helps store owners identify top-performing product lines and optimize inventory purchasing.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'Sales Returns Module', url: '/features/sales-returns', category: 'Feature' }
    ]}
  />
);

// 4. Sales Returns Feature Page
export const SalesReturnsFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop Sales Return Software"
    seoTitle="Paint Shop Sales Return Software | Credit Notes & Stock Re-entry"
    metaDescription="Handle customer returns, issue digital credit notes, and restore paint inventory automatically with Pyntflow Sales Return module."
    canonical="https://pyntflow.com/features/sales-returns"
    keywords={['paint shop sales return software', 'paint store credit notes', 'paint sales return management', 'paint return software']}
    heroBadge="Module: Sales Returns"
    h1="Paint Shop Sales Return Software"
    subtitle="Issue digital credit notes, restore returned paint containers to inventory, and adjust customer ledgers with full invoice traceability."
    overviewHeading="Streamlined Returns for Paint Retail Counters"
    overviewParagraphs={[
      'Contractors frequently return surplus unopened paint cans after completing painting projects. Pyntflow makes processing sales returns fast, accurate, and secure.',
      'Select the original sales invoice, specify returned items and quantities, and choose whether to issue a cash refund or credit the customer khata ledger. Returned items automatically restore to inventory.'
    ]}
    keyFeatures={[
      { title: 'Original Invoice Traceability', description: 'Link returns directly to original sales receipts to verify prices and return eligibility.' },
      { title: 'Automatic Inventory Re-entry', description: 'Returned items immediately restore to active showroom stock counts.' },
      { title: 'Credit Note Generation', description: 'Issue professional credit notes that adjust customer ledgers or provide cash refunds.' }
    ]}
    whyItMatters={[
      { title: 'Prevent Return Fraud', description: 'Verify purchase prices against original receipts before accepting returns.' },
      { title: 'Accurate Stock Counts', description: 'Returned items are instantly available for resale without manual adjustments.' },
      { title: 'Clear Customer Accounting', description: 'Credit notes update contractor khata balances automatically.' }
    ]}
    faqItems={[
      {
        question: 'How do returns affect customer credit ledgers?',
        directAnswer: 'The credit note amount is automatically deducted from the customer outstanding balance.',
        answer: 'An updated statement showing the revised balance can be printed or sent via WhatsApp.'
      }
    ]}
    relatedPages={[
      { title: 'Sales Management', url: '/features/sales', category: 'Feature' },
      { title: 'How to Manage Sales Returns', url: '/blog/how-to-manage-sales-returns-paint-shop', category: 'Guide' }
    ]}
  />
);

// 5. Purchases Feature Page
export const PurchasesFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop Purchase Management Software"
    seoTitle="Paint Shop Purchase Management Software | Supplier Invoicing"
    metaDescription="Track supplier purchase orders, incoming shipments, landed costs, and vendor payables with Pyntflow Purchase Management Software."
    canonical="https://pyntflow.com/features/purchases"
    keywords={['paint shop purchase management software', 'paint store purchasing system', 'paint supplier invoice tracking', 'paint procurement software']}
    heroBadge="Module: Purchases & Procurement"
    h1="Paint Shop Purchase Management Software"
    subtitle="Track supplier purchase orders, incoming manufacturer shipments, landed costs, and vendor payables from a unified procurement module."
    overviewHeading="Streamlined Supplier Procurement for Paint Retailers"
    overviewParagraphs={[
      'Pyntflow Purchase Management simplifies buying from paint manufacturers and distributors. Log purchase invoices with itemized container quantities, batch numbers, and landed cost factors.',
      'Incoming deliveries update inventory balances across showroom and godown vaults while posting directly to supplier payable accounts.'
    ]}
    keyFeatures={[
      { title: 'Supplier Invoicing & Challans', description: 'Log vendor invoices with container quantities, rates, tax, and delivery details.' },
      { title: 'Landed Cost Factoring', description: 'Incorporate freight, carriage, and unloading costs into average unit valuations.' },
      { title: 'Vendor Payable Ledgers', description: 'Track payment terms, due dates, partial payments, and outstanding balances.' }
    ]}
    whyItMatters={[
      { title: 'Accurate Cost Accounting', description: 'Know true landed costs to set profitable retail margins.' },
      { title: 'Strong Supplier Relations', description: 'Keep vendor payables reconciled with detailed transaction histories.' },
      { title: 'Automated Stock Updates', description: 'Received quantities immediately increase available inventory.' }
    ]}
    faqItems={[
      {
        question: 'Can I factor shipping and freight into purchase costs?',
        directAnswer: 'Yes, Pyntflow allows you to add freight, carriage, and loading expenses to purchase entries.',
        answer: 'This ensures inventory valuation and profit margins reflect true landed costs.'
      }
    ]}
    relatedPages={[
      { title: 'Purchase Returns Module', url: '/features/purchase-returns', category: 'Feature' },
      { title: 'Inventory Management', url: '/features/inventory', category: 'Feature' }
    ]}
  />
);

// 6. Purchase Returns Feature Page
export const PurchaseReturnsFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop Purchase Return Software"
    seoTitle="Paint Shop Purchase Return Software | Supplier Debit Notes"
    metaDescription="Manage damaged cans and factory returns, issue supplier debit notes, and adjust vendor payables with Pyntflow Purchase Return module."
    canonical="https://pyntflow.com/features/purchase-returns"
    keywords={['paint shop purchase return software', 'supplier debit notes', 'paint vendor return software', 'factory return management']}
    heroBadge="Module: Purchase Returns"
    h1="Paint Shop Purchase Return Software"
    subtitle="Generate itemized supplier debit notes for damaged or surplus paint stock, deduct inventory, and reconcile vendor payables automatically."
    overviewHeading="Structured Supplier Return Workflows"
    overviewParagraphs={[
      'When paint containers arrive damaged, leaking, or with incorrect shade batches, store operators need a structured way to return them and receive credit from the manufacturer.',
      'Pyntflow Purchase Return module generates itemized supplier debit notes referencing original purchase invoices, deducting returned units from stock and adjusting vendor balances.'
    ]}
    keyFeatures={[
      { title: 'Supplier Debit Notes', description: 'Generate professional debit notes with batch numbers, quantities, and return reasons.' },
      { title: 'Automatic Inventory Deduction', description: 'Returned items are removed from warehouse stock to keep records accurate.' },
      { title: 'Vendor Payable Adjustment', description: 'Debit note values automatically reduce outstanding supplier balances.' }
    ]}
    whyItMatters={[
      { title: 'Protect Working Capital', description: 'Ensure your business receives full credit for damaged or defective stock.' },
      { title: 'Flawless Stock Records', description: 'Prevent damaged goods from remaining on active inventory records.' },
      { title: 'Audit-Ready Documentation', description: 'Permanent digital records of all supplier returns and debit notes.' }
    ]}
    faqItems={[
      {
        question: 'How do purchase returns affect supplier payables?',
        directAnswer: 'The debit note value automatically reduces the outstanding balance owed to that vendor.',
        answer: 'This keeps accounts payable accurate and ensures you only pay for accepted inventory.'
      }
    ]}
    relatedPages={[
      { title: 'Purchases Module', url: '/features/purchases', category: 'Feature' },
      { title: 'How to Manage Purchase Returns', url: '/blog/how-to-manage-purchase-returns-paint-store', category: 'Guide' }
    ]}
  />
);

// 7. Reports Feature Page
export const ReportsFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop POS Reports & Business Analytics"
    seoTitle="Paint Shop POS Reports & Business Analytics | Pyntflow"
    metaDescription="Access real-time sales registers, gross margin analytics, inventory valuations, contractor aging, and shift closing reports with Pyntflow."
    canonical="https://pyntflow.com/features/reports"
    keywords={['paint shop POS reports', 'paint store business analytics', 'paint shop profit reports', 'paint store financial reporting']}
    heroBadge="Module: Reports & Analytics"
    h1="Paint Shop POS Reports & Business Analytics"
    subtitle="Make data-driven business decisions with real-time sales registers, margin analytics, inventory valuations, and shift reconciliation logs."
    overviewHeading="Clear Business Intelligence for Paint Store Owners"
    overviewParagraphs={[
      'Pyntflow provides comprehensive, real-time reporting across sales, inventory, contractor credit, supplier purchases, and cashier shifts.',
      'Identify top-selling paint brands, monitor gross profit margins by category, track overdue contractor balances, and review shift-end drawer cash reconciliations.'
    ]}
    keyFeatures={[
      { title: 'Daily Sales & Cash Registers', description: 'Detailed shift breakdowns with payment method splits and cashier audits.' },
      { title: 'Gross Margin & Profit Analytics', description: 'Analyze profitability by brand, product category, and individual SKU.' },
      { title: 'Contractor Aging & Khata Reports', description: 'Monitor outstanding balances, credit limits, and collection velocity.' },
      { title: 'Inventory Valuation Summaries', description: 'Real-time stock value calculations based on latest landed purchase costs.' }
    ]}
    whyItMatters={[
      { title: 'Data-Driven Purchasing', description: 'Know which shades and bases drive the highest margins to optimize reorders.' },
      { title: 'Eliminate Cash Discrepancies', description: 'Shift-end reports verify physical drawer cash against recorded transactions.' },
      { title: 'Faster Debt Recovery', description: 'Identify overdue contractor balances early to protect store cash flow.' }
    ]}
    faqItems={[
      {
        question: 'Can I export reports to Excel or PDF?',
        directAnswer: 'Yes, all reports can be exported to Excel/CSV or printed as clean PDF summaries.',
        answer: 'You can also filter reports by custom date ranges, cashier, customer, or product category.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'Paint Store Management Software', url: '/paint-store-management-software', category: 'Product' }
    ]}
  />
);
