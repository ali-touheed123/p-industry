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

// 8. AI Invoice Scan Feature Page
export const AiInvoiceScanFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="AI Purchase Invoice Scanner for Paint Shops"
    seoTitle="AI Purchase Invoice Scanner for Paint Shops | Pyntflow"
    metaDescription="Scan paper supplier purchase bills in seconds using Gemini Vision AI. Auto-extract items, quantities, wholesale prices, and taxes into Pyntflow."
    canonical="https://pyntflow.com/features/ai-invoice-scan"
    keywords={['AI purchase invoice scanner', 'OCR invoice entry paint shop', 'automated supplier bill entry', 'AI stock entry paint store']}
    heroBadge="Module: AI Automation"
    h1="AI Purchase Invoice Scanner for Paint Shops"
    subtitle="Eliminate manual stock entry. Upload or photograph paper supplier invoices and let Gemini Vision AI extract products, quantities, prices, and batch details in seconds."
    overviewHeading="Zero-Typing Stock Ingestion Powered by AI"
    overviewParagraphs={[
      'Receiving multi-page paper invoices from paint manufacturers (Dulux, Berger, Master, Brighto) used to take 20+ minutes of manual typing into POS stock ledgers.',
      'With Pyntflow AI Invoice Scanner, simply snap a photo or upload a photo/PDF of your supplier bill. Our vision AI automatically parses items, unit costs, discounts, and tax figures into draft purchase receipts ready for 1-click confirmation.'
    ]}
    keyFeatures={[
      { title: 'Instant OCR & Vision Parsing', description: 'Extract complex table structures from handwritten or printed paint supplier bills.' },
      { title: 'Automatic Item & Brand Matching', description: 'Matches scanned invoice line items against your existing inventory catalog automatically.' },
      { title: '1-Click Vault Ingestion', description: 'Review extracted quantities and prices, then approve to instantly update godown inventory.' }
    ]}
    whyItMatters={[
      { title: 'Save 90% Data Entry Time', description: 'Turn 20 minutes of manual purchase entry into a 15-second scan and click.' },
      { title: 'Zero Price & Quantity Errors', description: 'Prevent costly inventory balance mismatches caused by human entry typos.' },
      { title: 'Instant Cost Price Updates', description: 'Automatically update your landed purchase costs to keep profit margin calculations accurate.' }
    ]}
    faqItems={[
      {
        question: 'Does the AI scanner work with handwritten supplier bills in Pakistan?',
        directAnswer: 'Yes, Gemini 2.0 Flash Vision processes both printed thermal/A4 vendor invoices and legible handwritten wholesale slips.',
        answer: 'You can always review and edit the parsed line items before final submission to your inventory ledger.'
      }
    ]}
    relatedPages={[
      { title: 'Purchase Management', url: '/features/purchases', category: 'Feature' },
      { title: 'Paint Inventory Software', url: '/features/inventory', category: 'Feature' }
    ]}
  />
);

// 9. Token Management Feature Page
export const TokenManagementFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Token Management & Painter Loyalty System"
    seoTitle="Paint Token Management & Painter Loyalty System | Pyntflow"
    metaDescription="Track paint bucket cash tokens, painter reward redemptions, and manufacturer rebate ledgers seamlessly in Pyntflow POS."
    canonical="https://pyntflow.com/features/token-management"
    keywords={['paint token management', 'painter token redemption software', 'paint bucket token tracking', 'paint loyalty program software']}
    heroBadge="Module: Token Ledger & Painter Loyalty"
    h1="Paint Token Management & Painter Loyalty System"
    subtitle="Track paint bucket tokens, record painter cash redemptions, adjust counter bills, and claim rebates back from paint companies with complete transparency."
    overviewHeading="Complete Financial Control Over Paint Bucket Tokens"
    overviewParagraphs={[
      'Paint manufacturers hide cash/reward tokens inside bucket lids for painters and contractors. Managing these tokens manually leads to lost cash, disputed painter balances, and unclaimed vendor rebates.',
      'Pyntflow Paint Token Ledger provides dedicated tracking for collected tokens. Cashiers can instantly accept tokens as partial invoice payment or pay painters cash out of drawer while logging full audit trails.'
    ]}
    keyFeatures={[
      { title: 'Token Acceptance at Checkout', description: 'Deduct token values directly from active billing invoices with instant receipt recording.' },
      { title: 'Painter Redemption History', description: 'Maintain clear individual redemption ledgers for painters and commercial contractors.' },
      { title: 'Vendor Rebate Tracking', description: 'Generate monthly token summaries to claim exact reimbursement amounts from paint manufacturers.' }
    ]}
    whyItMatters={[
      { title: 'Stop Cash Leakage', description: 'Track every single token collected at the counter to prevent cash drawer drift.' },
      { title: 'Build Painter Loyalty', description: 'Offer contractors fast, transparent token redemption to secure repeat commercial business.' },
      { title: '100% Vendor Claim Accuracy', description: 'Never miss out on claiming token reimbursements from Dulux, Berger, or Master Paints.' }
    ]}
    faqItems={[
      {
        question: 'Can painter tokens be deducted directly from customer counter invoices?',
        directAnswer: 'Yes! Cashiers can apply token redemptions as a payment tender or direct discount on active bills.',
        answer: 'The system logs the exact token brand, denomination, and painter profile associated with the transaction.'
      }
    ]}
    relatedPages={[
      { title: 'POS System for Paint Shops', url: '/features/pos', category: 'Feature' },
      { title: 'Customer & Painter Khata', url: '/features/sales', category: 'Feature' }
    ]}
  />
);

// 10. Offline Mode Feature Page
export const OfflineModeFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Offline POS Software for Paint Shops"
    seoTitle="Offline POS Software for Paint Shops | Zero-Downtime Billing | Pyntflow"
    metaDescription="Never halt paint counter sales during broadband drops or load-shedding. Native IndexedDB queue, local stock protection, device-coded receipts, and automatic cloud sync."
    canonical="https://pyntflow.com/features/offline-mode"
    keywords={['offline POS software', 'paint shop offline billing', 'zero downtime POS', 'offline point of sale pakistan', 'IndexedDB POS auto sync']}
    heroBadge="Module: Bulletproof Offline Engine"
    h1="100% Offline POS Billing & Automatic Cloud Sync"
    subtitle="Broadband cuts and power outages will never halt your counter. Bill customers, print official receipts, and let transactions sync automatically in the background when connectivity returns."
    overviewHeading="Built for Real-World Infrastructure in Emerging Markets"
    overviewParagraphs={[
      'In high-volume paint shops across Pakistan, unstable internet and sudden power outages are daily operational hazards. Generic cloud POS software locks up or shows network errors, creating long frustrated queues.',
      'Pyntflow features a Phase 10 certified offline-first architecture. When internet drops, the counter seamlessly switches to local IndexedDB storage. Cashiers can continue barcode scanning, pack unit switching, discount application, and receipt printing with zero downtime.',
      'Once connectivity is restored, the multi-tab Web Locks sync engine flushes all offline sales in strict FIFO order, locking original Karachi transaction times and updating cloud balances automatically.'
    ]}
    keyFeatures={[
      { title: 'Zero-Downtime Counter Billing', description: 'Complete sales, calculate taxes, and print receipts without an active internet connection.' },
      { title: 'Local Stock Overlay Protection', description: 'Inventory decrements immediately in the cashier view to prevent overselling while offline.' },
      { title: 'Device-Coded Official Receipts', description: 'Prints official customer slips with hardware sequence codes (e.g. K7F2-0042) without temporary watermarks.' },
      { title: 'Multi-Tab Web Locks Sync Engine', description: 'Automatic background synchronization with mutual exclusion locking to prevent duplicate invoice commits.' }
    ]}
    whyItMatters={[
      { title: 'Zero Lost Sales During Outages', description: 'Keep lines moving fast even during major ISP fiber breaks or routine load-shedding.' },
      { title: 'Complete Ledger Accuracy', description: 'Preserves the exact local offline transaction timestamp (Karachi time) in financial ledgers.' },
      { title: '24-Hour Auth Grace Window', description: 'Cached secure credentials allow continuous offline counter operation for up to 24 hours.' }
    ]}
    faqItems={[
      {
        question: 'What happens if two counters are billing offline at the same time?',
        directAnswer: 'Each counter registers sales under its unique device shortcode and syncs without collisions.',
        answer: 'Pyntflow assigns each terminal a distinct shortcode (e.g. K7F2, M3P1) and sequence number, ensuring receipts and ledger entries never conflict upon cloud synchronization.'
      },
      {
        question: 'Can cashiers process contractor khata (credit) sales while offline?',
        directAnswer: 'Yes! Contractor credit sales are queued locally and automatically post to customer ledgers upon reconnection.',
        answer: 'Customer balances are reconciled and updated in the central ledger the moment the terminal regains internet access.'
      }
    ]}
    relatedPages={[
      { title: 'POS System for Paint Shops', url: '/features/pos', category: 'Feature' },
      { title: 'Receipt Customization', url: '/features/receipt-customization', category: 'Feature' },
      { title: 'Paint Token Management', url: '/features/token-management', category: 'Feature' }
    ]}
  />
);

// 11. Receipt Customization Feature Page
export const ReceiptCustomizationFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Regular Receipt Template Customization & Silent Print"
    seoTitle="Receipt Template Customization & Silent Thermal Print | Pyntflow"
    metaDescription="Visual receipt designer for 80mm roll, 58mm & A4 layouts. Customize store logo, Urdu terms, NTN/STRN tax ID, and enjoy silent F5 isolated iframe printing."
    canonical="https://pyntflow.com/features/receipt-customization"
    keywords={['thermal receipt template designer', 'paint shop receipt customization', '80mm thermal receipt software', 'A4 paint invoice format', 'silent thermal print POS']}
    heroBadge="Module: Receipt Customization & Silent Print"
    h1="Visual Receipt Designer & Silent Thermal Printing"
    subtitle="Design professional 80mm thermal, 58mm roll, and A4 receipts with your shop logo, Urdu warranty policy, tax NTN, customizable columns, and instant F5 silent printing."
    overviewHeading="Tailor Every Receipt to Your Shop Identity & Policies"
    overviewParagraphs={[
      'Every paint retailer has unique branding and customer policy requirements. Pyntflow provides an interactive visual Receipt Template Designer that lets you control every pixel of your customer invoices.',
      'Upload your high-contrast paint shop logo, configure phone numbers, address, and official NTN/STRN tax registration headers. Craft custom Urdu or English policy terms—such as "Tinted paints are non-returnable" or "Returns accepted within 7 days with original seal".',
      'For maximum counter speed, Pyntflow uses isolated hidden iframe printing (printViaIframe). Cashiers can press F5 (Save & Print) and get an immediate printout in under 1 second without popup window freezes or browser print dialog delays.'
    ]}
    keyFeatures={[
      { title: 'Multi-Format Support (80mm, 58mm & A4)', description: 'Switch easily between standard thermal roll paper and full A4/A5 laser invoices.' },
      { title: 'Custom Store Branding & Urdu Terms', description: 'Upload store logos, tax NTN/STRN details, and write bilingual return policies.' },
      { title: 'Customizable Table Columns', description: 'Toggle SKU code, pack size, unit rate, item discount, and total amount columns.' },
      { title: 'Silent Isolated Iframe Print (F5)', description: 'Fast 1-second thermal printing with zero blank browser tabs or UI stalls.' }
    ]}
    whyItMatters={[
      { title: 'Zero Customer Disputes', description: 'Clear return terms and broken-seal disclaimers printed on every slip protect your shop from unfair claims.' },
      { title: 'Professional Brand Image', description: 'Replace generic, blurry POS slips with crisp, custom-branded receipts featuring your logo.' },
      { title: 'Faster Counter Checkouts', description: 'Silent iframe printing saves 3 to 5 seconds on every single customer transaction.' }
    ]}
    faqItems={[
      {
        question: 'Which thermal receipt printer brands are supported?',
        directAnswer: 'All standard ESC/POS 80mm and 58mm thermal printers (Xprinter, Rongta, Epson, Bixolon, Black Copper, POS-58/80).',
        answer: 'Pyntflow connects seamlessly to any printer installed as the Windows default or USB receipt device.'
      },
      {
        question: 'Can I print Urdu warranty terms at the bottom of the receipt?',
        directAnswer: 'Yes! The receipt designer fully supports Urdu typography and custom disclaimer notes.',
        answer: 'You can input standard paint trade clauses such as "Machine se banwaya gaya color wapis nahi hoga" directly in the template designer.'
      }
    ]}
    relatedPages={[
      { title: 'Offline Mode & Auto-Sync', url: '/features/offline-mode', category: 'Feature' },
      { title: 'POS System for Paint Shops', url: '/features/pos', category: 'Feature' },
      { title: 'CEO Executive Suite', url: '/features/ceo-executive-suite', category: 'Feature' }
    ]}
  />
);

// 12. Branch Transfers Feature Page
export const BranchTransfersFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Inter-Branch Stock Transfers & Multi-Godown ERP"
    seoTitle="Inter-Branch Stock Transfers & Multi-Godown ERP | Pyntflow"
    metaDescription="Seamlessly manage multi-branch paint inventory with 4-stage transfer workflows (Pending to Received), zero-stock requisitions, and mirrored accounting vouchers."
    canonical="https://pyntflow.com/features/branch-transfers"
    keywords={['inter branch stock transfer POS', 'paint multi godown inventory', 'store to store transfer ERP', 'central godown requisition']}
    heroBadge="Module: Multi-Store ERP & Transfers"
    h1="Inter-Branch Stock Transfers & Multi-Godown ERP"
    subtitle="Request, dispatch, and receive paint stock across multiple showrooms and central warehouses with automated 4-stage transfer tracking and mirrored cost accounting."
    overviewHeading="End Stock Discrepancies Between Godowns and Retail Outlets"
    overviewParagraphs={[
      'Operating multiple paint shops or a central storage godown usually involves hectic phone calls, lost transfer slips, and mismatched inventory registers.',
      'Pyntflow Inter-Branch Orders provides a formal 4-stage transfer lifecycle: Pending ➔ Accepted ➔ Dispatched ➔ Received. Out-of-stock retail branches can requisition zero-stock paint shades directly from the main godown.',
      'Stock deduction is atomic: units leave the supplying warehouse at dispatch and safely inject into the destination store upon receipt confirmation, generating mirrored cost vouchers in the background.'
    ]}
    keyFeatures={[
      { title: '4-Stage Transfer Lifecycle', description: 'Full accountability: Pending ➔ Accepted ➔ Dispatched ➔ Received with driver/dispatch notes.' },
      { title: 'Zero-Stock Requisitions', description: 'Counter staff can request shades they currently have 0 stock of directly from other branches.' },
      { title: 'Atomic Inventory Posting', description: 'Stock decrements from source and increments at destination upon verified physical arrival.' },
      { title: 'Mirrored Inter-Branch Vouchers', description: 'Automates internal cost-price journal entries between separate store tax entities.' }
    ]}
    whyItMatters={[
      { title: 'Zero Lost Stock in Transit', description: 'Every container leaving the godown is tracked until the destination counter clicks receive.' },
      { title: 'Never Lose a Customer to Out-of-Stock', description: 'Instantly check sister branch stock and requisition gallons or drums before the customer leaves.' },
      { title: 'Consolidated Multi-Store Audit', description: 'The CEO can see inventory moving across all branch locations on a single live dashboard.' }
    ]}
    faqItems={[
      {
        question: 'Can a branch receive partial quantities if some cans were damaged in transit?',
        directAnswer: 'Yes. The receiving branch can adjust received quantities and flag variances before confirming receipt.',
        answer: 'Any discrepancy generates an audit log and adjusts the inter-branch transfer balance accordingly.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Inventory Software', url: '/features/inventory', category: 'Feature' },
      { title: 'CEO Executive Suite', url: '/features/ceo-executive-suite', category: 'Feature' }
    ]}
  />
);

// 13. CEO Executive Suite Feature Page
export const CeoExecutiveFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="CEO Executive Suite & Rupee Cash Register"
    seoTitle="CEO Executive Suite & Rupee Cash Drawer Balancing | Pyntflow"
    metaDescription="Balance cash registers with Pakistani Rupee denomination counters (Rs. 5000 to Rs. 10), monitor multi-store profits, and catch cash shortages remotely."
    canonical="https://pyntflow.com/features/ceo-executive-suite"
    keywords={['paint shop CEO dashboard', 'cash drawer denomination counter', 'multi branch POS audit', 'pakistani rupee register close']}
    heroBadge="Module: CEO Executive Suite"
    h1="CEO Executive Suite & Pakistani Rupee Cash Register"
    subtitle="Reconcile daily cash drawers with Pakistani Rupee denomination counters (Rs. 5000 to Rs. 10), audit multi-branch profits remotely, and detect cash shortages live."
    overviewHeading="Complete Operational Command for Paint Store Owners"
    overviewParagraphs={[
      'Paint shop owners cannot spend every hour behind the counter. The Pyntflow CEO Executive Suite gives owners instant remote visibility into store sales, true gross margins, petty expenses, and daily shift closes.',
      'Our Day Close module includes a specialized Pakistani Rupee denomination counter (Rs. 5000, 1000, 500, 100, 50, 20, 10). Cashiers count physical notes, and Pyntflow automatically calculates expected cash—factoring in cash sales, returns, petty expenses, and tokens redeemed cash—highlighting exact overages or shortages.',
      'CEOs can toggle between sister branches in one click, monitor negative stock alerts, and verify cashier day-close handovers from their mobile phones.'
    ]}
    keyFeatures={[
      { title: 'Pakistani Rupee Denomination Grid', description: 'Interactive note counter (5000, 1000, 500, etc.) auto-calculates counted cash vs expected cash.' },
      { title: 'Instant Sister Store Switcher', description: 'Switch between authorized branches seamlessly without logging in and out.' },
      { title: 'True Margin & Profit Engine', description: 'Computes real gross and net margins by deducting supplier costs, discounts, and petty expenses.' },
      { title: 'Negative Stock Surveillance', description: 'Instant audit alerts for products being sold below zero stock to catch unrecorded purchases.' }
    ]}
    whyItMatters={[
      { title: 'End Cashier Drawer Discrepancies', description: 'Automated reconciliation eliminates end-of-shift confusion and cashier shortage disputes.' },
      { title: 'Remote Freedom for Owners', description: 'Verify daily closing numbers, gross profits, and branch stock from anywhere in the world.' },
      { title: 'Anti-Theft Audit Trail', description: 'Every discount override, token payout, and stock adjustment is permanently timestamped.' }
    ]}
    faqItems={[
      {
        question: 'How does Pyntflow handle physical token payouts in the cash drawer reconciliation?',
        directAnswer: 'Cash paid out to painters for tokens is automatically deducted from the expected cash calculation.',
        answer: 'This ensures the cashier drawer does not show a false shortage when legitimate cash was disbursed for bucket tokens.'
      }
    ]}
    relatedPages={[
      { title: 'Offline Mode & Auto-Sync', url: '/features/offline-mode', category: 'Feature' },
      { title: 'Paint Token Management', url: '/features/token-management', category: 'Feature' },
      { title: 'Reports & Analytics', url: '/features/reports', category: 'Feature' }
    ]}
  />
);

// 14. Company Order Sheets Feature Page
export const CompanyOrderSheetsFeaturePage: React.FC<FeaturePageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Company Order Sheets & Distributor Procurement"
    seoTitle="Company Order Sheets & Distributor Procurement | Pyntflow"
    metaDescription="Generate standardized purchase order sheets formatted for paint company sales officers (Dulux, Berger, Nippon, Diamond) with thermal, A4, and Excel export."
    canonical="https://pyntflow.com/features/company-order-sheets"
    keywords={['paint company order sheet', 'dulux berger order generator', 'paint procurement software', 'paint dealer purchase order']}
    heroBadge="Module: Procurement Sheets"
    h1="Company Order Sheets & Distributor Procurement"
    subtitle="Generate formal, standardized purchase order sheets formatted for paint company sales officers (Dulux, Berger, Nippon, Diamond) with thermal, A4, and Excel export."
    overviewHeading="Standardize Your Orders for Paint Manufacturer Sales Officers"
    overviewParagraphs={[
      'Ordering paint shipments from major manufacturers (Dulux, Berger, Nippon, Diamond, Brighto) traditionally requires cashiers to jot down shade codes and drum quantities on loose sheets of paper for visiting sales reps.',
      'Pyntflow Company Order Sheets automates this entire procurement workflow. Based on automated low-stock thresholds, Pyntflow generates clean, brand-segregated purchase sheets grouped by pack sizes (Quarters, Gallons, Drums).',
      'Print order sheets directly on your 80mm thermal roll, generate formal A4 purchase documents, or export directly to Excel to send via WhatsApp to company distributors.'
    ]}
    keyFeatures={[
      { title: 'Brand-Specific Order Templates', description: 'Pre-formatted layouts tailored for Dulux, Berger, Nippon, Diamond, and local paint brands.' },
      { title: 'Pack Size Aggregation', description: 'Aggregates required shades into Quarters, Gallons, and 16L Drums for clear distributor processing.' },
      { title: 'Multi-Format Export', description: 'Print on 80mm thermal slip, full A4 purchase order, or export to Excel and WhatsApp.' },
      { title: 'Low-Stock Auto-Requisition', description: 'Automatically populate order sheets based on fast-moving shade minimum stock thresholds.' }
    ]}
    whyItMatters={[
      { title: 'Zero Order Miscommunications', description: 'Clear shade codes, base types, and drum counts prevent distributors from shipping wrong bases.' },
      { title: 'Faster Delivery Turnaround', description: 'Sales officers receive standardized, legible order sheets that can be processed into factory batches immediately.' },
      { title: 'Never Run Out of Fast-Moving Shades', description: 'Automated reorder triggers ensure your best-selling whites, off-whites, and bases stay in stock.' }
    ]}
    faqItems={[
      {
        question: 'Can I export the company order sheet to send to my distributor rep via WhatsApp?',
        directAnswer: 'Yes! You can export clean A4 PDF or Excel files, or copy the formatted text directly to WhatsApp.',
        answer: 'Sales reps can review and commit your order directly into the manufacturer ordering system.'
      }
    ]}
    relatedPages={[
      { title: 'Purchase Management', url: '/features/purchases', category: 'Feature' },
      { title: 'Paint Inventory Software', url: '/features/inventory', category: 'Feature' },
      { title: 'AI Invoice Scanning', url: '/features/ai-invoice-scan', category: 'Feature' }
    ]}
  />
);
