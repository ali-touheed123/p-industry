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
  showAddress: boolean;
  customAddress?: string;
  showPhone: boolean;
  customPhone?: string;
  separator: 'none' | 'solid' | 'dashed' | 'double';
}

export interface InvoiceInfoConfig {
  showInvoiceNo: boolean;
  invoiceLabel: string;
  showDate: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  showPaymentMethod: boolean;
}

export interface ItemsTableConfig {
  columns: TableColumnId[];
  fontSize: number; // in px
  rowPadding: number; // in px
  compact: boolean;
  showBorders: boolean;
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
}

export interface FooterConfig {
  line1: string;
  line2: string;
  showWhatsapp: boolean;
  whatsappNumber: string;
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

export interface TemplateJson {
  header: HeaderConfig;
  invoiceInfo: InvoiceInfoConfig;
  itemsTable: ItemsTableConfig;
  totals: TotalsConfig;
  footer: FooterConfig;
  layout: LayoutConfig;
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
    showAddress: true,
    showPhone: true,
    separator: 'dashed',
  },
  invoiceInfo: {
    showInvoiceNo: true,
    invoiceLabel: 'Invoice #',
    showDate: true,
    showCashier: true,
    showCustomer: true,
    showPaymentMethod: true,
  },
  itemsTable: {
    columns: ['name', 'qty', 'rate', 'amount'],
    fontSize: 12,
    rowPadding: 3,
    compact: false,
    showBorders: true,
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
  },
  footer: {
    line1: 'Thank you for your business!',
    line2: 'Goods once sold cannot be returned without receipt.',
    showWhatsapp: true,
    whatsappNumber: '',
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
  locks: {},
};
