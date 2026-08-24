'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tenant, UserItem, DevActiveTab, InitialAccountsData } from '@/types/dev';
import { DevNavbar } from './DevNavbar';
import { DevSidebar } from './DevSidebar';
import { DevOverviewView } from './DevOverviewView';
import { DevBranchesView } from './DevBranchesView';
import { DevUsersView } from './DevUsersView';
import { DevBranchModal } from './DevBranchModal';
import { DevUserModal } from './DevUserModal';
import { DevBranchPortalModal } from './DevBranchPortalModal';
import { DevPinLogin } from './DevPinLogin';
import { CheckCheck, AlertCircle } from 'lucide-react';
import './aura-panel.css';

export default function AuraDevPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DevActiveTab>('overview');

  // Modals
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Tenant | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [preSelectedTenantId, setPreSelectedTenantId] = useState<string>('');

  const [previewBranch, setPreviewBranch] = useState<Tenant | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Check auth session
  useEffect(() => {
    const isAuth = sessionStorage.getItem('aura_dev_auth') === 'true';
    setIsAuthenticated(isAuth);
    setCheckingAuth(false);
  }, []);

  // Fetch Tenants from real Supabase API
  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
      } else {
        showToast(data.error || 'Failed to fetch branches', 'error');
      }
    } catch {
      showToast('Network error fetching branches', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Users from real Supabase API
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        showToast(data.error || 'Failed to fetch users', 'error');
      }
    } catch {
      showToast('Network error fetching users', 'error');
    }
  }, []);

  // Load data upon authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants();
      fetchUsers();
    }
  }, [isAuthenticated, fetchTenants, fetchUsers]);

  // Lock handler
  const handleLock = () => {
    sessionStorage.removeItem('aura_dev_auth');
    setIsAuthenticated(false);
  };

  // ----------------------------------------------------
  // BRANCH OPERATIONS (Real Supabase API)
  // ----------------------------------------------------
  const handleSaveBranch = async (
    branchData: Partial<Tenant>,
    initialAccounts?: InitialAccountsData
  ): Promise<boolean> => {
    try {
      const isEditing = !!editingBranch;
      const endpoint = '/api/tenants';
      const method = isEditing ? 'PATCH' : 'POST';

      const payload = isEditing
        ? { ...branchData, id: editingBranch.id }
        : {
            ...branchData,
            ceo_username: initialAccounts?.ceoUsername,
            ceo_password: initialAccounts?.ceoPassword,
            staff_username: initialAccounts?.staffUsername,
            staff_password: initialAccounts?.staffPassword,
            counters: (initialAccounts as any)?.counters,
          };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          isEditing ? 'Branch updated successfully!' : 'New branch & accounts provisioned in Supabase!'
        );
        fetchTenants();
        fetchUsers();
        setEditingBranch(null);
        return true;
      } else {
        showToast(data.error || 'Failed to save branch', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Request failed', 'error');
      return false;
    }
  };

  const handleDeleteBranch = async (id: string) => {
    try {
      const res = await fetch('/api/tenants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Branch and dependent records removed from Supabase.');
        fetchTenants();
        fetchUsers();
      } else {
        showToast(data.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Delete request failed', 'error');
    }
  };

  const handleToggleBranchStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(!currentStatus ? 'Branch activated' : 'Branch suspended');
        fetchTenants();
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch {
      showToast('Failed to toggle status', 'error');
    }
  };

  // ----------------------------------------------------
  // USER OPERATIONS (Real Supabase API)
  // ----------------------------------------------------
  const handleSaveUser = async (userData: {
    id?: string;
    username: string;
    password?: string;
    full_name?: string;
    role: any;
    tenant_id?: string;
    email?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (data.success) {
        showToast('User account successfully saved!');
        fetchUsers();
        setEditingUser(null);
        return true;
      } else {
        showToast(data.error || 'Failed to save user', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Request failed', 'error');
      return false;
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('User account removed.');
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to delete user', 'error');
      }
    } catch {
      showToast('Failed to delete user', 'error');
    }
  };

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
        Loading Developer Security Protocol...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <DevPinLogin onSuccess={() => setIsAuthenticated(true)} />;
  }

  const primarySlug = tenants[0]?.slug || 'tawakkal-paint-house';

  return (
    <div className="aura-container">
      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: '16px',
              backgroundColor: toast.type === 'success' ? 'rgba(6, 78, 59, 0.95)' : 'rgba(127, 29, 29, 0.95)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCheck style={{ width: '16px', height: '16px', color: '#34d399' }} />
            ) : (
              <AlertCircle style={{ width: '16px', height: '16px', color: '#f87171' }} />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Background Ambient Luxury Lighting */}
      <div className="aura-glow-top" />
      <div className="aura-glow-bottom" />

      {/* Top Navigation Bar */}
      <DevNavbar
        onAddBranch={() => {
          setEditingBranch(null);
          setIsBranchModalOpen(true);
        }}
        onAddUser={() => {
          setEditingUser(null);
          setIsUserModalOpen(true);
        }}
        onRefresh={() => {
          fetchTenants();
          fetchUsers();
          showToast('Syncing with Supabase...');
        }}
        onLock={handleLock}
        loading={loading}
      />

      {/* Main Layout Body */}
      <div className="aura-layout">
        {/* Left Sidebar */}
        <DevSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          counts={{
            branches: tenants.length,
            users: users.length,
          }}
          primaryTenantSlug={primarySlug}
        />

        {/* Dynamic Center Viewport */}
        <main className="aura-main">
          {activeTab === 'overview' && (
            <DevOverviewView
              branches={tenants}
              users={users}
              onAddBranch={() => {
                setEditingBranch(null);
                setIsBranchModalOpen(true);
              }}
              onAddUser={() => {
                setEditingUser(null);
                setIsUserModalOpen(true);
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenBranchPortal={(branch) => setPreviewBranch(branch)}
            />
          )}

          {activeTab === 'branches' && (
            <DevBranchesView
              branches={tenants}
              onAddBranch={() => {
                setEditingBranch(null);
                setIsBranchModalOpen(true);
              }}
              onEditBranch={(branch) => {
                setEditingBranch(branch);
                setIsBranchModalOpen(true);
              }}
              onDeleteBranch={handleDeleteBranch}
              onToggleStatus={handleToggleBranchStatus}
              onOpenBranchPortal={(branch) => setPreviewBranch(branch)}
              onAddCounterToBranch={(branch) => {
                setEditingUser(null);
                setPreSelectedTenantId(branch.id);
                setActiveTab('users');
                setIsUserModalOpen(true);
              }}
            />
          )}

          {activeTab === 'users' && (
            <DevUsersView
              users={users}
              onAddUser={() => {
                setEditingUser(null);
                setIsUserModalOpen(true);
              }}
              onEditUser={(user) => {
                setEditingUser(user);
                setIsUserModalOpen(true);
              }}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>

      {/* Modals Suite */}
      <DevBranchModal
        isOpen={isBranchModalOpen}
        onClose={() => {
          setIsBranchModalOpen(false);
          setEditingBranch(null);
        }}
        onSave={handleSaveBranch}
        editingBranch={editingBranch}
      />

      <DevUserModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(null);
          setPreSelectedTenantId('');
        }}
        onSave={handleSaveUser}
        editingUser={editingUser}
        branches={tenants}
        preSelectedTenantId={preSelectedTenantId}
      />

      <DevBranchPortalModal
        branch={previewBranch}
        onClose={() => setPreviewBranch(null)}
      />
    </div>
  );
}
