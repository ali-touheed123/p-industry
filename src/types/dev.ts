export type BranchType = 'shop' | 'godown' | 'factory';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: BranchType;
  owner_id?: string;
  owner_name?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  require_ceo_pass?: boolean;
  allow_negative_stock?: boolean;
  usersCount?: number;
  ceo?: { username: string; name: string } | null;
  staffCount?: number;
  created_at?: string;
}

export type UserRole = 'developer' | 'ceo' | 'staff' | 'godown_staff';

export interface UserItem {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  role: UserRole;
  tenant_id?: string;
  owner_id?: string;
  is_active: boolean;
  can_use_special_receipt?: boolean;
  created_at: string;
  tenants?: { name: string; slug: string; type: string } | null;
}

export interface CounterRegisterInput {
  username: string;
  password: string;
  name: string;
}

export interface InitialAccountsData {
  ceoUsername?: string;
  ceoPassword?: string;
  staffUsername?: string;
  staffPassword?: string;
  counters?: CounterRegisterInput[];
}

export type DevActiveTab = 'overview' | 'branches' | 'users' | 'receipt-templates' | 'ai-control';
