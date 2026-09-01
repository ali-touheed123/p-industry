import React from 'react';
import { ProductDetailView } from './ProductDetailView';

interface ProductPageWrapperProps {
  onNavigate: (path: string) => void;
  onOpenDemo: () => void;
}

// 1. Paint Shop POS Software
export const PaintShopPosPage: React.FC<ProductPageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop POS Software"
    seoTitle="Paint Shop POS Software | Fast Billing & Inventory by Pyntflow"
    metaDescription="Pyntflow is purpose-built paint shop POS software. Handle fast billing, tint shade lookup, contractor khata, multi-pack inventory, and sales returns."
    canonical="https://pyntflow.com/paint-shop-pos"
    keywords={[
      'paint shop POS software',
      'paint shop software',
      'paint store POS software',
      'POS software for paint shops',
      'paint POS system',
      'paint billing software'
    ]}
    heroBadge="Dedicated Paint POS Architecture"
    h1="Paint Shop POS Software Built for Counter Speed"
    subtitle="Accelerate checkout rushes with keyboard hotkeys, multi-pack container unit conversions, painter contractor ledgers, and real-time inventory synchronization."
    overviewHeading="The Complete Point of Sale for Modern Paint Retailers"
    overviewParagraphs={[
      'Pyntflow Paint Shop POS Software is purpose-built to eliminate the bottlenecks unique to paint retail counters. Standard retail cash registers force operators to navigate cumbersome menus, losing precious time while lines form.',
      'With Pyntflow, counter staff use instant function keys (F2-F9) to scan barcodes, lookup custom shade recipes, switch packaging sizes (quarter, gallon, drum), and park orders on hold without disrupting customer service.',
      'Every transaction updates central warehouse balances and contractor ledger accounts instantaneously, providing complete operational transparency.'
    ]}
    keyFeatures={[
      {
        title: 'Keyboard-Driven Hotkey Checkout',
        description: 'Complete sales in seconds with F2 (Save), F3 (Shade Search), F4 (Add Item), F5 (Print Receipt), F7 (Hold Cart), and F9 (Cancel).'
      },
      {
        title: 'Contractor Khata & Credit Accounts',
        description: 'Maintain dedicated ledgers for painters and builders. Print outstanding balances on thermal receipts and send automated WhatsApp statements.'
      },
      {
        title: 'Multi-Pack Packaging Multipliers',
        description: 'Sell emulsions, enamels, and primers by the quarter can, gallon, or 16-liter drum with automatic master stock deduction.'
      },
      {
        title: 'Park & Resume Orders (F7 Hold)',
        description: 'Hold active shopping carts when customers step away to verify color shades, then restore them instantly.'
      },
      {
        title: 'Shift Closing & Daraz Hisab',
        description: 'Reconcile drawer cash with system sales at the end of each shift to prevent cash discrepancies.'
      },
      {
        title: 'Thermal & Laser Receipt Printing',
        description: 'Compatible with all 80mm and 58mm ESC/POS thermal printers as well as standard A4 laser printers.'
      }
    ]}
    whyItMatters={[
      {
        title: '90% Faster Counter Checkout',
        description: 'Cut customer wait times during peak renovation seasons with ergonomic keyboard-first billing.'
      },
      {
        title: 'Zero Unrecorded Credit Leakage',
        description: 'Automate contractor udhaar ledgers and maintain clear audit trails for every credit sale.'
      },
      {
        title: 'Accurate Base & Tint Stock Counts',
        description: 'Eliminate phantom stock with automated inventory deduction across packaging variants.'
      }
    ]}
    faqItems={[
      {
        question: 'What is paint shop POS software?',
        directAnswer: 'Paint shop POS software is specialized point-of-sale software engineered specifically for paint retail counters, base-can inventory, and contractor credit ledgers.',
        answer: 'Unlike generic POS tools, it natively supports tint recipes, pack conversions, painter commission tracking, and supplier return debits.'
      },
      {
        question: 'Can Pyntflow POS run offline?',
        directAnswer: 'Yes, Pyntflow supports local offline billing mode.',
        answer: 'Counter staff can continue generating invoices during internet disruptions, and data synchronizes automatically when the connection is restored.'
      },
      {
        question: 'Does Pyntflow support multiple billing counters?',
        directAnswer: 'Yes, Pyntflow supports multi-counter register configurations with centralized inventory controls.',
        answer: 'You can run Counter 01, Counter 02, and warehouse dispatch simultaneously from a single synchronized database.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Store Management Software', url: '/paint-store-management-software', category: 'Product' },
      { title: 'Paint Shop Billing Software', url: '/paint-shop-billing-software', category: 'Product' },
      { title: 'Paint Inventory Software', url: '/paint-inventory-management-software', category: 'Product' },
      { title: 'Software for Paint Dealers', url: '/paint-dealer-software', category: 'Product' },
      { title: 'POS Features Checklist', url: '/blog/paint-shop-pos-features', category: 'Guide' }
    ]}
  />
);

// 2. Paint Store Management Software
export const PaintStoreManagementPage: React.FC<ProductPageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Store Management Software"
    seoTitle="Paint Store Management Software | All-in-One Retail System"
    metaDescription="End-to-end paint store management software by Pyntflow. Manage POS billing, multi-vault godown inventory, supplier procurement, and financial reporting."
    canonical="https://pyntflow.com/paint-store-management-software"
    keywords={[
      'paint store management software',
      'paint shop management software',
      'paint retail management system',
      'software for paint stores',
      'paint shop software'
    ]}
    heroBadge="Unified Enterprise Operations"
    h1="End-to-End Paint Store Management Software"
    subtitle="Unify your entire paint business: front-of-house sales registers, back-room godown stock vaults, supplier purchase ledgers, and profit analytics."
    overviewHeading="Holistic Control Over Every Aspect of Paint Retail"
    overviewParagraphs={[
      'Managing a successful paint store requires continuous synchronization between checkout counters, warehouse inventory, contractor accounts, and manufacturer procurement.',
      'Pyntflow Paint Store Management Software bridges the gap between front-desk sales and back-office accounting, giving store owners real-time visibility over gross margins, dead stock, and aging customer credit.'
    ]}
    keyFeatures={[
      {
        title: 'Integrated Front & Back Office',
        description: 'Connect counter billing directly with warehouse replenishment, supplier payables, and customer receivables.'
      },
      {
        title: 'Multi-Vault Godown Control',
        description: 'Track inventory across showroom shelves and central warehouse facilities with internal transfer notes.'
      },
      {
        title: 'Comprehensive Customer CRM & Khata',
        description: 'Maintain detailed contractor profiles, credit limits, purchase histories, and automated payment receipts.'
      },
      {
        title: 'Real-Time Financial Reports',
        description: 'Analyze daily sales registers, category margins, top-performing paint brands, and cash drawer reconciliations.'
      }
    ]}
    whyItMatters={[
      {
        title: 'Unified Business Clarity',
        description: 'Eliminate disjointed spreadsheets and paper registers in favor of a single real-time dashboard.'
      },
      {
        title: 'Reduced Stockouts & Dead Stock',
        description: 'Maintain optimal inventory levels for fast-moving seasonal shades and base types.'
      },
      {
        title: 'Protected Profit Margins',
        description: 'Track landed costs accurately, including freight and loading expenses, to ensure healthy retail margins.'
      }
    ]}
    faqItems={[
      {
        question: 'What is paint store management software?',
        directAnswer: 'Paint store management software is an integrated business system that manages POS sales, inventory, purchasing, contractor credit, and accounting for paint retail businesses.',
        answer: 'It replaces fragmented manual records with automated, synchronized digital operations.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'Paint Inventory Management', url: '/paint-inventory-management-software', category: 'Product' },
      { title: 'Management Guide', url: '/blog/paint-shop-management-software-guide', category: 'Guide' }
    ]}
  />
);

// 3. Paint Shop Billing Software
export const PaintShopBillingPage: React.FC<ProductPageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Shop Billing Software"
    seoTitle="Paint Shop Billing Software | Fast Invoicing & Receipts | Pyntflow"
    metaDescription="High-speed paint shop billing software with keyboard hotkeys, thermal receipt printing, split payment modes, and contractor credit tracking."
    canonical="https://pyntflow.com/paint-shop-billing-software"
    keywords={[
      'paint shop billing software',
      'paint store billing software',
      'paint shop invoicing software',
      'paint billing system',
      'paint POS billing'
    ]}
    heroBadge="Rapid Counter Invoicing"
    h1="High-Speed Paint Shop Billing Software"
    subtitle="Generate professional invoices in under 5 seconds with keyboard hotkeys, split payment processing, and instant thermal printing."
    overviewHeading="Fast, Accurate Counter Billing for Paint Shops"
    overviewParagraphs={[
      'During morning contractor rushes and weekend home-improvement peaks, your billing counter needs to move at top speed. Pyntflow Paint Shop Billing Software is optimized for rapid checkout.',
      'Cashiers can search products by shade code, adjust container sizes, apply role-authorized discounts, split payments across cash and card, and print receipts without touching a mouse.'
    ]}
    keyFeatures={[
      {
        title: 'Sub-5-Second Invoicing',
        description: 'Process standard sales quickly with keyboard shortcuts and instant barcode scanning.'
      },
      {
        title: 'Split & Partial Payments',
        description: 'Accept split payments across Cash, Card, Bank Transfer, and Contractor Khata credit on a single invoice.'
      },
      {
        title: 'Customizable Thermal Invoices',
        description: 'Print 80mm and 58mm receipts with store logo, tax registration number, and clear return policies.'
      },
      {
        title: 'Contractor Balance Stamping',
        description: 'Automatically print the customer previous balance, current bill amount, and updated total on credit invoices.'
      }
    ]}
    whyItMatters={[
      {
        title: 'Shorter Counter Queues',
        description: 'Serve more customers in less time with ergonomic hotkey billing workflows.'
      },
      {
        title: 'Eliminate Math Errors',
        description: 'Automated discount and tax calculations prevent costly cash drawer discrepancies.'
      },
      {
        title: 'Professional Receipts',
        description: 'Deliver clean, branded invoices that build customer trust and provide clear return documentation.'
      }
    ]}
    faqItems={[
      {
        question: 'Does Pyntflow support 80mm thermal printers?',
        directAnswer: 'Yes, Pyntflow natively supports standard 80mm and 58mm ESC/POS thermal printers as well as A4/A5 laser printers.',
        answer: 'You can customize receipt headers, footers, tax IDs, and warranty/return terms.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'Billing Software Guide', url: '/blog/paint-shop-billing-software-guide', category: 'Guide' }
    ]}
  />
);

// 4. Paint Inventory Management Software
export const PaintInventoryPage: React.FC<ProductPageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Paint Inventory Management Software"
    seoTitle="Paint Inventory Management Software | Batch & Stock Control"
    metaDescription="Manage paint stock, base cans, colorants, pack variants (quarter, gallon, drum), and multi-vault godowns with Pyntflow inventory software."
    canonical="https://pyntflow.com/paint-inventory-management-software"
    keywords={[
      'paint inventory management software',
      'paint shop inventory management',
      'paint store inventory software',
      'paint stock control software',
      'paint inventory software'
    ]}
    heroBadge="Multi-Vault Stock Control"
    h1="Paint Inventory Management Software"
    subtitle="Track base cans, pack size variants, and multi-location godown balances with real-time stock valuation and low-inventory alerts."
    overviewHeading="Complete Precision Over Paint Stock Dimensions"
    overviewParagraphs={[
      'Paint inventory involves complex SKU dimensions that generic inventory software cannot handle: tinting bases, colorants, multiple pack sizes per product line, and batch expiration dates.',
      'Pyntflow Paint Inventory Management Software structures your paint catalogue logically, ensuring every sales transaction, purchase delivery, and warehouse transfer updates stock levels accurately.'
    ]}
    keyFeatures={[
      {
        title: 'Multi-Pack Unit Conversions',
        description: 'Link quarter cans, gallons, and 16L drums to a master SKU for automatic fractional stock deduction.'
      },
      {
        title: 'Showroom vs Godown Vaults',
        description: 'Maintain separate balances for front showroom shelves and back-room storage warehouses with transfer notes.'
      },
      {
        title: 'Low Stock & Reorder Alerts',
        description: 'Receive automated notifications when fast-moving shades or base cans fall below safety thresholds.'
      },
      {
        title: 'Batch & Expiry Tracking',
        description: 'Monitor manufacturing batches for sealants, putty, and chemical bases to enforce FIFO stock rotation.'
      }
    ]}
    whyItMatters={[
      {
        title: 'Zero Phantom Inventory',
        description: 'Maintain exact alignment between digital system records and physical shelf counts.'
      },
      {
        title: 'Prevent Stockouts During Peak Season',
        description: 'Automated reorder alerts ensure you never run out of critical white bases and top-selling shades.'
      },
      {
        title: 'Accurate Asset Valuation',
        description: 'View real-time inventory valuations based on landed purchase costs.'
      }
    ]}
    faqItems={[
      {
        question: 'How does Pyntflow handle paint base and tint conversions?',
        directAnswer: 'Pyntflow manages base cans as master inventory items and deducts colorants based on formula requirements.',
        answer: 'This keeps both base container stock and colorant consumables accurately balanced.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'How to Manage Paint Inventory', url: '/blog/how-to-manage-paint-shop-inventory', category: 'Guide' }
    ]}
  />
);

// 5. Software for Paint Dealers
export const PaintDealerPage: React.FC<ProductPageWrapperProps> = ({ onNavigate, onOpenDemo }) => (
  <ProductDetailView
    onNavigate={onNavigate}
    onOpenDemo={onOpenDemo}
    title="Software for Paint Dealers"
    seoTitle="Software for Paint Dealers | Multi-Counter & Wholesale System"
    metaDescription="Enterprise software for authorized paint dealers. Manage wholesale distribution, manufacturer purchase ledgers, contractor rebates, and branch godowns."
    canonical="https://pyntflow.com/paint-dealer-software"
    keywords={[
      'software for paint dealers',
      'paint dealer software',
      'paint dealer POS software',
      'paint distributor software',
      'paint wholesale software'
    ]}
    heroBadge="Authorized Dealership Scale"
    h1="Specialized Software for Paint Dealers"
    subtitle="Built for authorized paint dealerships and wholesale distributors managing multiple counters, bulk contractor discounts, and manufacturer accounts."
    overviewHeading="Enterprise-Grade Tools for High-Volume Paint Dealers"
    overviewParagraphs={[
      'Authorized paint dealers operate at a much larger scale than single retail counters. They manage large shipments from manufacturers (Berger, Dulux, Diamond, Brighto, Master, etc.), supply sub-dealers, and handle high contractor credit volumes.',
      'Pyntflow Software for Paint Dealers provides the multi-register coordination, vendor debit reconciliation, and bulk margin analytics required to run high-volume dealership operations profitably.'
    ]}
    keyFeatures={[
      {
        title: 'Multi-Counter Synchronization',
        description: 'Run multiple sales registers and warehouse dispatch stations simultaneously with unified stock data.'
      },
      {
        title: 'Manufacturer Purchasing & Debit Notes',
        description: 'Reconcile factory shipments against purchase orders and issue debit notes for damaged stock or discrepancies.'
      },
      {
        title: 'Contractor Volume Rebates & Tiers',
        description: 'Automate tiered contractor pricing and incentive schemes based on cumulative monthly purchase volumes.'
      },
      {
        title: 'Branch & Godown Requisitions',
        description: 'Enable branch locations to submit digital inventory requests directly to the central warehouse.'
      }
    ]}
    whyItMatters={[
      {
        title: 'Scalable Distribution',
        description: 'Manage multiple retail counters and branch outlets from a single centralized management platform.'
      },
      {
        title: 'Accurate Supplier Accounting',
        description: 'Keep vendor payables strictly reconciled with itemized debit note tracking for factory returns.'
      },
      {
        title: 'Stronger Contractor Relationships',
        description: 'Provide clear, professional ledger statements and automated monthly volume rebates.'
      }
    ]}
    faqItems={[
      {
        question: 'Can Pyntflow handle multi-branch paint dealerships?',
        directAnswer: 'Yes, Pyntflow supports multi-counter and multi-branch operations with central warehouse inventory management.',
        answer: 'Branch outlets can place internal stock transfer requests, and management can view unified reports across all locations.'
      }
    ]}
    relatedPages={[
      { title: 'Paint Shop POS Software', url: '/paint-shop-pos', category: 'Product' },
      { title: 'POS Features for Paint Dealers', url: '/blog/best-pos-features-paint-dealers', category: 'Guide' }
    ]}
  />
);
