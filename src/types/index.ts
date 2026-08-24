export type TenantType = 'shop' | 'godown' | 'factory';
export type UserRole = 'developer' | 'ceo' | 'staff' | 'godown_staff';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: TenantType;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  logo_url?: string;
  is_active: boolean;
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
  is_active: boolean;
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
  notes?: string;
  status: 'open' | 'closed';
  created_at?: string;
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
  item_type?: 'finish_goods' | 'raw_material';
  unit: string;
  pack_size?: string;
  shade_code?: string;
  shade_hex?: string;
  cost_price: number;
  retail_price: number;
  wholesale_price: number;
  trade_price: number;
  stock_qty: number;
  min_stock_alert?: number;
  min_stock?: number;
  is_active?: boolean;
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
  created_by?: string;
  created_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  item_id?: string;
  item_code?: string;
  item_name: string;
  shade_code?: string;
  shade_hex?: string;
  pack_size?: string;
  unit?: string;
  qty: number;
  unit_price: number;
  discount: number;
  discount_percent?: number;
  total_price: number;
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

export interface StockTransfer {
  id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  transfer_no: string;
  date: string;
  transporter_name?: string;
  vehicle_no?: string;
  bilty_no?: string;
  driver_name?: string;
  driver_phone?: string;
  status: 'in_transit' | 'received' | 'cancelled';
  notes?: string;
  created_by?: string;
  created_at: string;
  from_tenant?: Tenant;
  to_tenant?: Tenant;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id?: string;
  transfer_id?: string;
  item_id?: string;
  item_code?: string;
  item_name: string;
  unit?: string;
  qty: number;
}
