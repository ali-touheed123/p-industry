export type BranchType = 'shop' | 'godown' | 'factory';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: BranchType;
  owner_name?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
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
  is_active: boolean;
  created_at: string;
  tenants?: { name: string; slug: string; type: string } | null;
}

export interface InitialAccountsData {
  ceoUsername?: string;
  ceoPassword?: string;
  staffUsername?: string;
  staffPassword?: string;
}

export type DevActiveTab = 'overview' | 'branches' | 'users';
