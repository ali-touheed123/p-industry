// ─── Receipt Template Types ───────────────────────────────────────────────────

export type PaperSize = 'thermal_80' | 'thermal_58' | 'a4' | 'a5';

export type TableColumnId = 'name' | 'code' | 'qty' | 'rate' | 'discount' | 'amount';

export interface HeaderConfig {
  showLogo: boolean;
  logoUrl?: string;
  logoSize: number; // in px or %
  align: 'left' | 'center' | 'right';
  showShopName: boolean;
  customShopName?: string;
  shopNameSize?: number; // in px (default 15)
  shopNameUppercase?: boolean; // default true
  shopNameLetterSpacing?: number; // in px or em
  showAddress: boolean;
  customAddress?: string;
  addressSize?: number; // in px (default 10)
  showPhone: boolean;
  customPhone?: string;
  phonePrefix?: string; // default "Tel:"
  phoneSize?: number; // in px (default 10)
  separator: 'none' | 'solid' | 'dashed' | 'double';
}

export interface InvoiceInfoConfig {
  showInvoiceNo: boolean;
  invoiceLabel: string;
  showDate: boolean;
  dateLabel?: string;       // default "Date:"
  showCashier: boolean;
  cashierLabel?: string;    // default "Staff:"
  showCustomer: boolean;
  customerLabel?: string;   // default "Customer:"
  showPaymentMethod: boolean;
  paymentLabel?: string;    // default "Payment:"
  fontSize?: number;        // in px (default 10.5)
}

export interface ItemsTableConfig {
  columns: TableColumnId[];
  fontSize: number; // in px
  rowPadding: number; // in px
  compact: boolean;
  showBorders: boolean;
  // Column header label overrides
  colLabelCode?: string;    // default "Code"
  colLabelName?: string;    // default "Item"
  colLabelQty?: string;     // default "Qty"
  colLabelRate?: string;    // default "Rate"
  colLabelDiscount?: string;// default "Disc"
  colLabelAmount?: string;  // default "Total"
}

export interface TotalsConfig {
  showSubtotal: boolean;
  showDiscount: boolean;
  showGst: boolean;
  gstRate?: number;
  showGrandTotal: boolean;
  showPaid: boolean;
  showBalance: boolean;
  boldTotal: boolean;
  highlightBalanceDue: boolean;
  currencySymbol: string;
  fontSize?: number;           // base totals font size in px (default 11)
  grandTotalFontSize?: number; // grand total font size in px (default 13 or 11)
  // Row label overrides
  subtotalLabel?: string;      // default "Subtotal:"
  discountLabel?: string;      // default "Discount:"
  deliveryLabel?: string;      // default "Delivery:"
  netTotalLabel?: string;      // default "NET TOTAL:"
  paidLabel?: string;          // default "Paid:"
  changeLabel?: string;        // default "Change Returned:"
  balanceDueLabel?: string;    // default "Balance Due:"
}

export interface FooterConfig {
  line1: string;
  line1Size?: number; // in px (default 9.5)
  line2: string;
  line2Size?: number; // in px (default 9)
  align?: 'left' | 'center' | 'right'; // default "center"
  showWhatsapp: boolean;
  whatsappNumber: string;
  whatsappLabel?: string; // default "WhatsApp:"
  whatsappSize?: number;  // in px (default 9)
  showPoweredBy: boolean;
  poweredByText: string;
  showQrCode: boolean;
  qrCodeText?: string;
}

export interface LayoutConfig {
  marginTop: number; // in mm
  marginBottom: number; // in mm
  marginLeft: number; // in mm
  marginRight: number; // in mm
  fontSize: number; // base font size in px
  fontFamily: 'mono' | 'sans' | 'serif';
  scale: number; // 0.8 to 1.2
}

export interface TokenClaimSlipConfig {
  enabled: boolean; // show/hide slip on receipt
  title: string; // heading, e.g. "Token Claim Slip"
  instructions: string; // subtitle/instructions
  footerNotice: string; // disclaimer/notice
  showDetails: boolean; // show breakdown of items with tokens
}

export interface TemplateJson {
  header: HeaderConfig;
  invoiceInfo: InvoiceInfoConfig;
  itemsTable: ItemsTableConfig;
  totals: TotalsConfig;
  footer: FooterConfig;
  layout: LayoutConfig;
  tokenClaimSlip?: TokenClaimSlipConfig;
  locks: Record<string, boolean>; // locked field keys that tenants cannot override
}

export interface ReceiptTemplate {
  id: string;
  name: string;
  description?: string | null;
  paper_size: PaperSize;
  template_json: TemplateJson;
  is_default: boolean;
  is_deleted: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TenantReceiptTemplateAssignment {
  tenant_id: string;
  template_id: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    type: string;
  };
  template?: ReceiptTemplate | null;
}

export const PAPER_SIZE_CONFIG: Record<PaperSize, { label: string; widthMm: number; defaultWidthPx: number }> = {
  thermal_80: { label: 'Thermal 80mm', widthMm: 80, defaultWidthPx: 302 },
  thermal_58: { label: 'Thermal 58mm', widthMm: 58, defaultWidthPx: 219 },
  a4: { label: 'A4 Sheet', widthMm: 210, defaultWidthPx: 794 },
  a5: { label: 'A5 Half Sheet', widthMm: 148, defaultWidthPx: 559 },
};

export const DEFAULT_TEMPLATE_JSON: TemplateJson = {
  header: {
    showLogo: true,
    logoUrl: '',
    logoSize: 56,
    align: 'center',
    showShopName: true,
    shopNameSize: 15,
    shopNameUppercase: true,
    shopNameLetterSpacing: 0.05,
    showAddress: true,
    addressSize: 10,
    showPhone: true,
    phonePrefix: 'Tel:',
    phoneSize: 10,
    separator: 'dashed',
  },
  invoiceInfo: {
    showInvoiceNo: true,
    invoiceLabel: 'Invoice #',
    showDate: true,
    dateLabel: 'Date:',
    showCashier: true,
    cashierLabel: 'Staff:',
    showCustomer: true,
    customerLabel: 'Customer:',
    showPaymentMethod: true,
    paymentLabel: 'Payment:',
    fontSize: 10.5,
  },
  itemsTable: {
    columns: ['name', 'qty', 'rate', 'amount'],
    fontSize: 12,
    rowPadding: 3,
    compact: false,
    showBorders: true,
    colLabelCode: 'Code',
    colLabelName: 'Item',
    colLabelQty: 'Qty',
    colLabelRate: 'Rate',
    colLabelDiscount: 'Disc',
    colLabelAmount: 'Total',
  },
  totals: {
    showSubtotal: true,
    showDiscount: true,
    showGst: false,
    showGrandTotal: true,
    showPaid: true,
    showBalance: true,
    boldTotal: true,
    highlightBalanceDue: true,
    currencySymbol: 'Rs.',
    fontSize: 11,
    grandTotalFontSize: 13,
    subtotalLabel: 'Subtotal:',
    discountLabel: 'Discount:',
    deliveryLabel: 'Delivery:',
    netTotalLabel: 'NET TOTAL:',
    paidLabel: 'Paid:',
    changeLabel: 'Change Returned:',
    balanceDueLabel: 'Balance Due:',
  },
  footer: {
    line1: 'Thank you for your business!',
    line1Size: 9.5,
    line2: 'Goods once sold cannot be returned without receipt.',
    line2Size: 9,
    align: 'center',
    showWhatsapp: true,
    whatsappNumber: '',
    whatsappLabel: 'WhatsApp:',
    whatsappSize: 9,
    showPoweredBy: true,
    poweredByText: 'Powered by Pyntflow ERP',
    showQrCode: false,
  },
  layout: {
    marginTop: 4,
    marginBottom: 6,
    marginLeft: 4,
    marginRight: 4,
    fontSize: 12,
    fontFamily: 'mono',
    scale: 1,
  },
  tokenClaimSlip: {
    enabled: true,
    title: 'Token Claim Slip',
    instructions: 'Present this code on your next visit to redeem your token',
    footerNotice: 'Keep this receipt — code cannot be reissued',
    showDetails: true,
  },
  locks: {},
};

export const BLANK_SPECIAL_TEMPLATE_JSON: TemplateJson = {
  ...DEFAULT_TEMPLATE_JSON,
  header: {
    ...DEFAULT_TEMPLATE_JSON.header,
    showLogo: false,
    logoUrl: '',
    showShopName: false,
    customShopName: '',
    showAddress: false,
    customAddress: '',
    showPhone: false,
    customPhone: '',
    separator: 'dashed',
  },
  invoiceInfo: {
    ...DEFAULT_TEMPLATE_JSON.invoiceInfo,
    showCashier: false,
    showCustomer: true,
  },
  footer: {
    ...DEFAULT_TEMPLATE_JSON.footer,
    showPoweredBy: false,
    poweredByText: '',
    showWhatsapp: false,
    whatsappNumber: '',
  },
  tokenClaimSlip: {
    enabled: false,
    title: 'Token Claim Slip',
    instructions: 'Present this code on your next visit to redeem your token',
    footerNotice: 'Keep this receipt — code cannot be reissued',
    showDetails: false,
  },
  locks: {},
};

