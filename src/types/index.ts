export type TenantType = 'shop' | 'godown' | 'factory';
export type UserRole = 'developer' | 'ceo' | 'staff' | 'godown_staff';

export interface Owner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: TenantType;
  owner_id?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  logo_url?: string;
  is_active: boolean;
  require_ceo_pass?: boolean;
  commission_enabled?: boolean;
  commission_rate?: number;
  commission_split_lead?: number;
  commission_split_staff?: number;
  commission_split_reserve?: number;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email?: string;
  role: UserRole;
  tenant_id?: string;
  owner_id?: string;
  is_active: boolean;
  can_use_special_receipt?: boolean;
  created_at: string;
  tenants?: Tenant;
}

export interface Shift {
  id: string;
  tenant_id: string;
  staff_id?: string;
  opened_by?: string;
  closed_by?: string;
  start_time?: string;
  end_time?: string;
  opened_at?: string;
  opening_cash: number;
  expected_cash?: number;
  actual_cash?: number;
  difference?: number;
  previous_closing_cash?: number | null;
  handover_variance?: number | null;
  handover_notes?: string;
  notes?: string;
  status: 'open' | 'closed';
  created_at?: string;
  cash_breakdown?: any;
}

export interface PettyExpense {
  id: string;
  tenant_id: string;
  shift_id?: string;
  category: string;
  title: string;
  amount: number;
  paid_by?: string;
  notes?: string;
  created_at: string;
}

export interface Item {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category?: string;
  brand?: string;
  brand_id?: string;
  series_id?: string;
  series_name?: string;
  unit: string;
  pack_size?: string;
  shade_code?: string;
  cost_price: number;
  retail_price: number;
  stock_qty: number;
  min_stock_alert?: number;
  has_token?: boolean;
  token_value?: number;
  created_at?: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  code?: string;
  name: string;
  phone?: string;
  city?: string;
  area?: string;
  address?: string;
  credit_limit: number;
  current_balance: number;
  token_balance?: number;
  reference?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  code?: string;
  name: string;
  phone?: string;
  city?: string;
  address?: string;
  current_balance: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_no: string;
  client_id?: string;
  client_name?: string;
  shift_id?: string;
  date: string;
  subtotal: number;
  discount: number;
  delivery_charge?: number;
  remarks?: string;
  invoice_type?: 'sales' | 'return';
  net_total: number;
  paid_amount: number;
  due_amount: number;
  payment_type: 'cash' | 'credit' | 'card' | 'bank' | 'others' | 'split';
  cash_paid?: number;
  card_paid?: number;
  bank_paid?: number;
  others_paid?: number;
  status: 'completed' | 'cancelled' | 'return';
  printed_as?: 'regular' | 'special';
  original_invoice_id?: string;
  created_by?: string;
  created_at: string;
  items?: InvoiceItem[];
  invoice_items?: InvoiceItem[];
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  original_invoice_item_id?: string;
  item_id?: string;
  item_code?: string;
  item_name: string;
  brand?: string;
  category?: string;
  shade_code?: string;
  pack_size?: string;
  unit?: string;
  qty: number;
  unit_price: number;
  cost_price?: number;
  discount: number;
  discount_percent?: number;
  total_price: number;
  has_token?: boolean;
  token_value?: number;
  token_action?: 'keep' | 'remove';
}

export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  brand_series?: BrandSeries[];
}

export interface BrandSeries {
  id: string;
  tenant_id: string;
  brand_id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  brands?: Brand;
  series_token_configs?: SeriesTokenConfig[];
}

export interface CustomUnit {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
}

export interface SeriesTokenConfig {
  id: string;
  tenant_id: string;
  series_id: string;
  unit_name: string;
  is_enabled: boolean;
  token_value: number;
  is_drum_auto: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenRedemption {
  id: string;
  tenant_id: string;
  redemption_no: string;
  client_id?: string;
  client_name: string;
  total_tokens: number;
  total_amount: number;
  payout_method: 'cash';
  shift_id?: string;
  created_by?: string;
  created_at: string;
  items?: TokenRedemptionItem[];
}

export interface TokenRedemptionItem {
  id: string;
  redemption_id: string;
  brand_id?: string;
  brand_name: string;
  series_id?: string;
  series_name: string;
  unit_name: string;
  token_value: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface TokenTransaction {
  id: string;
  tenant_id: string;
  // Canonical type field — use this; transaction_type is removed
  type?: 'issued' | 'shop_retained' | 'redeemed' | 'opening_stock' | 'settle_vendor' | 'write_off' | 'used_purchase' | 'reversal';
  invoice_id?: string;
  redemption_id?: string;
  client_id?: string;
  client_name?: string;
  // 4-part identity — canonical fields
  brand_id?: string;
  brand_name?: string;
  series_id?: string;
  series_name?: string;
  unit_name?: string;
  token_value?: number;
  quantity?: number;
  remaining_quantity?: number;
  total_amount?: number;
  usage_status?: 'available' | 'settled' | 'used' | 'written_off' | 'reversed' | 'n_a' | null;
  shift_id?: string;
  notes?: string;
  write_off_reason?: 'Damaged' | 'Lost' | 'Invalid' | 'Other' | string | null;
  settled_vendor_name?: string;
  used_against_purchase_id?: string | null;
  used_against_voucher_id?: string | null;
  used_date?: string | null;
  parent_transaction_id?: string | null;
  created_by?: string;
  created_at: string;
  // Legacy fields preserved for incremental compatibility until Task 6.6 components migrated
  transaction_type?: string;
  item_id?: string;
  item_name?: string;
  brand?: string;
  category?: string;
  token_count?: number;
  unit_token_value?: number;
  remaining_count?: number;
  is_external?: boolean;
  redeemed_amount?: number;
  remaining_balance?: number;
  claim_status?: 'pending' | 'claimed' | null;
  claimed_date?: string | null;
  claim_reference?: string | null;
  settlement_type?: 'purchase' | 'voucher' | 'vendor_rep_cash' | 'vendor_rep_credit' | null;
  purchases?: {
    id?: string;
    purchase_no?: string;
    supplier_name?: string;
    date?: string;
  } | null;
  vouchers?: {
    id?: string;
    voucher_no?: string;
    party_name?: string;
    date?: string;
  } | null;
}

export interface HeldInvoice {
  id: string;
  tenant_id: string;
  hold_no: string;
  client_id?: string;
  client_name?: string;
  invoice_type: 'sales' | 'return';
  items_json: any[];
  subtotal: number;
  discount: number;
  delivery_charge: number;
  net_total: number;
  remarks?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  action_type?: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  created_at: string;
}


export interface BranchOrder {
  id: string;
  order_no: string;
  from_tenant_id: string;
  to_tenant_id: string;
  from_counter?: string;
  target_counter?: string;
  status: 'pending' | 'accepted' | 'dispatched' | 'received' | 'rejected';
  notes?: string;
  created_by?: string;
  created_at: string;
  from_tenant?: Tenant;
  to_tenant?: Tenant;
  items?: BranchOrderItem[];
}

export interface BranchOrderItem {
  id?: string;
  order_id?: string;
  item_code?: string;
  item_name: string;
  unit?: string;
  qty: number;
}
