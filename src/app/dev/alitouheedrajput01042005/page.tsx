'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, Trash2, Edit3, Store, Warehouse, Factory,
  Eye, Copy, CheckCheck, Users, Globe, RefreshCw,
  LogIn, LogOut, AlertTriangle, Activity, Database, CheckCircle2, XCircle, KeyRound, UserCheck
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: 'shop' | 'godown' | 'factory';
  owner_name?: string;
  city?: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

interface UserItem {
  id: string;
  username: string;
  full_name: string;
  role: string;
  tenant_id?: string;
  is_active: boolean;
  created_at: string;
  tenants?: { name: string; slug: string; type: string } | null;
}

const SECRET_DEV_PIN = 'dev2026';

export default function DevPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'tenants' | 'users' | 'logs'>('tenants');

  // Add / Edit branch form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'shop' as 'shop' | 'godown' | 'factory',
    owner_name: '',
    city: '',
    phone: '',
    address: '',
    ceo_username: '',
    ceo_password: '',
    staff_username: '',
    staff_password: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Add User modal state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'staff',
    tenant_id: '',
  });
  const [userFormError, setUserFormError] = useState('');
  const [userFormLoading, setUserFormLoading] = useState(false);

  const [copiedSlug, setCopiedSlug] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === SECRET_DEV_PIN) { 
      setAuthenticated(true); 
      setPinError(''); 
    } else { 
      setPinError('Wrong PIN. Access denied.'); 
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch { 
      showToast('Failed to load tenants'); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      showToast('Failed to load users');
    }
  };

  useEffect(() => { 
    if (authenticated) {
      fetchTenants(); 
      fetchUsers();
    }
  }, [authenticated]);

  const handleSlugify = (name: string) => {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const method = editingTenant ? 'PATCH' : 'POST';
      const body = editingTenant
        ? { ...formData, id: editingTenant.id }
        : formData;
      const res = await fetch('/api/tenants', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error || !data.success) { 
        setFormError(data.error || 'Failed to save branch'); 
      } else {
        showToast(editingTenant ? 'Branch updated successfully!' : 'New branch & accounts created!');
        setShowAddForm(false);
        setEditingTenant(null);
        setFormData({
          name: '',
          slug: '',
          type: 'shop',
          owner_name: '',
          city: '',
          phone: '',
          address: '',
          ceo_username: '',
          ceo_password: '',
          staff_username: '',
          staff_password: '',
        });
        fetchTenants();
        fetchUsers();
      }
    } catch { 
      setFormError('Request failed. Please check backend connection.'); 
    } finally { 
      setFormLoading(false); 
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData),
      });
      const data = await res.json();
      if (data.error || !data.success) {
        setUserFormError(data.error || 'Failed to create user');
      } else {
        showToast('User created successfully!');
        setShowAddUserModal(false);
        setUserFormData({ username: '', password: '', full_name: '', role: 'staff', tenant_id: '' });
        fetchUsers();
      }
    } catch {
      setUserFormError('Failed to create user');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/tenants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.error || !data.success) {
        showToast('Error: ' + (data.error || 'Delete failed'));
      } else { 
        showToast('Branch and associated records removed.'); 
        fetchTenants(); 
        fetchUsers();
      }
    } catch { 
      showToast('Delete failed.'); 
    } finally { 
      setDeleteConfirm(null); 
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
      if (data.error || !data.success) {
        showToast('Error: ' + (data.error || 'Failed to remove user'));
      } else {
        showToast('User removed.');
        fetchUsers();
      }
    } catch {
      showToast('Failed to delete user');
    } finally {
      setDeleteUserConfirm(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(!currentStatus ? 'Branch activated' : 'Branch suspended');
        fetchTenants();
      }
    } catch {
      showToast('Failed to toggle status');
    }
  };

  const handleEdit = (t: Tenant) => {
    setEditingTenant(t);
    setFormData({
      name: t.name,
      slug: t.slug,
      type: t.type,
      owner_name: t.owner_name || '',
      city: t.city || '',
      address: t.address || '',
      phone: t.phone || '',
      ceo_username: '',
      ceo_password: '',
      staff_username: '',
      staff_password: '',
    });
    setShowAddForm(true);
    setFormError('');
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(''), 2000);
  };

  const typeIcon = (type: string) => {
    if (type === 'shop') return <Store size={15} color="#60a5fa" />;
    if (type === 'godown') return <Warehouse size={15} color="#34d399" />;
    return <Factory size={15} color="#fbbf24" />;
  };

  const typeColor = (type: string) => {
    if (type === 'shop') return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', text: '#60a5fa' };
    if (type === 'godown') return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#34d399' };
    return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#fbbf24' };
  };

  // PIN Login Screen
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 30%, rgba(139,92,246,0.1), transparent 60%), #0a0f1e', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Shield size={28} color="#a78bfa" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '4px' }}>Developer Access</h1>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Restricted — Authorized Personnel Only</p>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(12px)' }}>
            <form onSubmit={handlePinLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Developer PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Enter secret PIN"
                  autoFocus
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${pinError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', color: '#f1f5f9', fontSize: '16px', letterSpacing: '4px', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }}
                />
              </div>
              {pinError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#f87171' }}>
                  <AlertTriangle size={14} /> {pinError}
                </div>
              )}
              <button
                type="submit"
                style={{ padding: '12px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s' }}
              >
                <LogIn size={15} /> Enter Developer Panel
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main Dev Panel
  return (
    <div style={{ minHeight: '100vh', background: '#080d1a', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', color: '#34d399', fontWeight: '600', zIndex: 9999, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCheck size={15} /> {toast}
        </div>
      )}

      {/* Main Layout */}
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{ width: '230px', background: 'rgba(10,15,30,0.98)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <div style={{ padding: '0 8px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Shield size={18} color="#a78bfa" />
              <span style={{ fontWeight: '800', fontSize: '15px', color: '#f1f5f9' }}>Super Admin</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Multi-Tenant Control Panel</span>
          </div>

          {[
            { key: 'tenants', label: 'Branches & Godowns', icon: <Globe size={15} /> },
            { key: 'users', label: 'All Users & Roles', icon: <Users size={15} /> },
            { key: 'logs', label: 'System Overview', icon: <Activity size={15} /> },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key as any)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s', background: activeSection === item.key ? 'rgba(139,92,246,0.2)' : 'transparent', color: activeSection === item.key ? '#c4b5fd' : '#64748b' }}
            >
              {item.icon} {item.label}
            </button>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setAuthenticated(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: 'transparent', color: '#ef4444', width: '100%' }}
            >
              <LogOut size={14} /> Lock Panel
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>

          {/* SECTION 1: TENANTS */}
          {activeSection === 'tenants' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '4px' }}>Branches &amp; Godowns</h2>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Manage shops, wholesale godowns, and manufacturing factories</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={fetchTenants} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                  <button onClick={() => { 
                    setEditingTenant(null); 
                    setFormData({ name: '', slug: '', type: 'shop', owner_name: '', city: '', phone: '', address: '', ceo_username: '', ceo_password: '', staff_username: '', staff_password: '' }); 
                    setFormError(''); 
                    setShowAddForm(true); 
                  }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>
                    <Plus size={14} /> Add New Branch
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Retail Shops', count: tenants.filter(t => t.type === 'shop').length, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
                  { label: 'Central Godowns', count: tenants.filter(t => t.type === 'godown').length, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                  { label: 'Paint Factories', count: tenants.filter(t => t.type === 'factory').length, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Add / Edit Branch Form */}
              {showAddForm && (
                <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '24px', backdropFilter: 'blur(12px)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#c4b5fd', marginBottom: '18px' }}>
                    {editingTenant ? `Edit Branch: ${editingTenant.name}` : 'Provision New Branch / Godown'}
                  </h3>
                  <form onSubmit={handleFormSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Branch / Business Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value, slug: editingTenant ? p.slug : handleSlugify(e.target.value) }))}
                        placeholder="e.g. Al-Madina Paint House"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>URL Identifier (Slug) *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '13px' }}>/</span>
                        <input
                          type="text"
                          required
                          value={formData.slug}
                          onChange={e => setFormData(p => ({ ...p, slug: handleSlugify(e.target.value) }))}
                          placeholder="al-madina-paints"
                          style={{ width: '100%', padding: '10px 14px 10px 24px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Branch Type *</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData(p => ({ ...p, type: e.target.value as any }))}
                        style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      >
                        <option value="shop">Shop (POS &amp; Retail Billing)</option>
                        <option value="godown">Godown (Bulk Stock &amp; Gate Pass)</option>
                        <option value="factory">Factory (Manufacturing &amp; Raw Material)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>City / Location</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                        placeholder="e.g. Lahore / Faisalabad"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Owner / Manager Name</label>
                      <input
                        type="text"
                        value={formData.owner_name}
                        onChange={e => setFormData(p => ({ ...p, owner_name: e.target.value }))}
                        placeholder="e.g. Haji Muhammad"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Phone Number</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                        placeholder="0300-1234567"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Physical Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                        placeholder="Shop #12, Commercial Paint Market..."
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Optional User Accounts for New Branch */}
                    {!editingTenant && (
                      <div style={{ gridColumn: '1/-1', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginTop: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <KeyRound size={15} /> Create Initial Login Accounts (Optional)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#a78bfa', marginBottom: '4px' }}>CEO Username</label>
                            <input
                              type="text"
                              value={formData.ceo_username}
                              onChange={e => setFormData(p => ({ ...p, ceo_username: e.target.value }))}
                              placeholder="e.g. tawakal_ceo"
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#a78bfa', marginBottom: '4px' }}>CEO Password</label>
                            <input
                              type="text"
                              value={formData.ceo_password}
                              onChange={e => setFormData(p => ({ ...p, ceo_password: e.target.value }))}
                              placeholder="e.g. ceo123"
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#60a5fa', marginBottom: '4px' }}>Staff Username</label>
                            <input
                              type="text"
                              value={formData.staff_username}
                              onChange={e => setFormData(p => ({ ...p, staff_username: e.target.value }))}
                              placeholder="e.g. counter1"
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#60a5fa', marginBottom: '4px' }}>Staff Password</label>
                            <input
                              type="text"
                              value={formData.staff_password}
                              onChange={e => setFormData(p => ({ ...p, staff_password: e.target.value }))}
                              placeholder="e.g. staff123"
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formError && (
                      <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#f87171' }}>
                        <AlertTriangle size={14} /> {formError}
                      </div>
                    )}

                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button type="button" onClick={() => { setShowAddForm(false); setEditingTenant(null); }} style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" disabled={formLoading} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '700', opacity: formLoading ? 0.6 : 1 }}>
                        {formLoading ? 'Provisioning...' : (editingTenant ? 'Save Changes' : 'Create & Provision Branch')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Branches List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>Loading branches...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tenants.map(t => {
                    const colors = typeColor(t.type);
                    return (
                      <div key={t.id} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', transition: 'border-color 0.15s' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {typeIcon(t.type)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                            <span style={{ fontWeight: '700', fontSize: '15px', color: '#f1f5f9' }}>{t.name}</span>
                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>{t.type}</span>
                            {t.city && <span style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {t.city}</span>}
                            {!t.is_active && <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>SUSPENDED</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>/{t.slug}</div>
                          {t.address && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{t.address} {t.phone && `• 📞 ${t.phone}`}</div>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {/* Toggle Status */}
                          <button 
                            onClick={() => handleToggleStatus(t.id, t.is_active)}
                            title={t.is_active ? 'Active - Click to Suspend' : 'Suspended - Click to Activate'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
                          >
                            {t.is_active ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                          </button>

                          {/* Copy URL */}
                          <button onClick={() => copyUrl(t.slug)} title="Copy Branch URL" style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: copiedSlug === t.slug ? '#34d399' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                            {copiedSlug === t.slug ? <CheckCheck size={13} /> : <Copy size={13} />}
                          </button>

                          {/* Open in App */}
                          <a href={`/${t.slug}`} target="_blank" rel="noopener noreferrer" title="Open Branch App" style={{ padding: '7px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
                            <Eye size={13} /> Open
                          </a>

                          {/* Edit */}
                          <button onClick={() => handleEdit(t)} title="Edit Details" style={{ padding: '7px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Edit3 size={13} />
                          </button>

                          {/* Delete */}
                          {deleteConfirm === t.id ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => handleDelete(t.id)} style={{ padding: '7px 12px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Confirm Delete</button>
                              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(t.id)} title="Delete Branch" style={{ padding: '7px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {tenants.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px', color: '#64748b' }}>
                      <Database size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>No branches currently exist</h4>
                      <p style={{ fontSize: '13px', marginBottom: '16px' }}>Click "Add New Branch" above to create and test your first shop or godown.</p>
                      <button onClick={() => { setShowAddForm(true); setFormError(''); }} style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>
                        + Add First Branch
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: ALL USERS & ROLES */}
          {activeSection === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '4px' }}>All System Accounts</h2>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Super Developer, CEO, Cashiers, and Godown Incharges</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={fetchUsers} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                  <button onClick={() => { setShowAddUserModal(true); setUserFormError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>
                    <Plus size={14} /> Add User Account
                  </button>
                </div>
              </div>

              {/* Add User Modal */}
              {showAddUserModal && (
                <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '24px', backdropFilter: 'blur(12px)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#c4b5fd', marginBottom: '18px' }}>Create User Account</h3>
                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Username *</label>
                      <input
                        type="text"
                        required
                        value={userFormData.username}
                        onChange={e => setUserFormData(p => ({ ...p, username: e.target.value }))}
                        placeholder="e.g. manager1"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Password *</label>
                      <input
                        type="text"
                        required
                        value={userFormData.password}
                        onChange={e => setUserFormData(p => ({ ...p, password: e.target.value }))}
                        placeholder="e.g. pass123"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Full Name</label>
                      <input
                        type="text"
                        value={userFormData.full_name}
                        onChange={e => setUserFormData(p => ({ ...p, full_name: e.target.value }))}
                        placeholder="e.g. Asad (Counter Staff)"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Account Role *</label>
                      <select
                        value={userFormData.role}
                        onChange={e => setUserFormData(p => ({ ...p, role: e.target.value }))}
                        style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      >
                        <option value="developer">Developer (Super Admin)</option>
                        <option value="ceo">CEO (Owner Multi-Branch)</option>
                        <option value="staff">Staff / Cashier (POS)</option>
                        <option value="godown_staff">Godown Staff (Stock Transfer)</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase' }}>Assigned Branch</label>
                      <select
                        value={userFormData.tenant_id}
                        onChange={e => setUserFormData(p => ({ ...p, tenant_id: e.target.value }))}
                        style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      >
                        <option value="">Global / No Specific Branch (e.g. Developer)</option>
                        {tenants.map(t => (
                          <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                        ))}
                      </select>
                    </div>

                    {userFormError && (
                      <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#f87171' }}>
                        <AlertTriangle size={14} /> {userFormError}
                      </div>
                    )}

                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setShowAddUserModal(false)} style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" disabled={userFormLoading} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>
                        {userFormLoading ? 'Creating...' : 'Create Account'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Users Table */}
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '14px 20px' }}>Username</th>
                      <th style={{ padding: '14px 20px' }}>Full Name</th>
                      <th style={{ padding: '14px 20px' }}>Role</th>
                      <th style={{ padding: '14px 20px' }}>Assigned Branch</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const roleBadgeColor = u.role === 'developer' ? '#a78bfa' : u.role === 'ceo' ? '#38bdf8' : u.role === 'godown_staff' ? '#34d399' : '#fbbf24';
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '14px 20px', fontWeight: '700', color: '#f1f5f9', fontFamily: 'monospace' }}>
                            {u.username}
                          </td>
                          <td style={{ padding: '14px 20px', color: '#cbd5e1' }}>
                            {u.full_name || '—'}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: `${roleBadgeColor}15`, border: `1px solid ${roleBadgeColor}30`, color: roleBadgeColor }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px', color: '#94a3b8' }}>
                            {u.tenants ? `${u.tenants.name} (/${u.tenants.slug})` : (u.role === 'developer' ? 'Global Access' : '—')}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            {u.role !== 'developer' && (
                              deleteUserConfirm === u.id ? (
                                <div style={{ display: 'inline-flex', gap: '4px' }}>
                                  <button onClick={() => handleDeleteUser(u.id)} style={{ padding: '5px 10px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Confirm</button>
                                  <button onClick={() => setDeleteUserConfirm(null)} style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteUserConfirm(u.id)} title="Delete user" style={{ padding: '6px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                                  <Trash2 size={14} />
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: SYSTEM OVERVIEW / LOGS */}
          {activeSection === 'logs' && (
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#f1f5f9', marginBottom: '4px' }}>System Overview</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Database connectivity, registered instances, and infrastructure status</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} /> Supabase PostgreSQL Database
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Connection Status:</span>
                      <span style={{ color: '#34d399', fontWeight: '700' }}>● Connected &amp; Operational</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Active Branches:</span>
                      <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{tenants.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Total User Accounts:</span>
                      <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{users.length}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#a78bfa', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} /> Developer Key Management
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Dev Secret PIN:</span>
                      <span style={{ color: '#a78bfa', fontFamily: 'monospace', fontWeight: '700' }}>dev2026</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Super User:</span>
                      <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>admin</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}