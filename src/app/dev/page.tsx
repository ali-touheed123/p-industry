'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Warehouse, 
  Factory, 
  Plus, 
  Search, 
  ExternalLink, 
  KeyRound, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Sparkles, 
  Users, 
  Store,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: 'shop' | 'godown' | 'factory';
  owner_name?: string;
  phone?: string;
  city?: string;
  address?: string;
  is_active: boolean;
  usersCount?: number;
  ceo?: { username: string; name: string } | null;
  staffCount?: number;
  created_at: string;
}

export default function DeveloperPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [devUser, setDevUser] = useState('');
  const [devPass, setDevPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'shop' | 'godown' | 'factory'>('all');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<'shop' | 'godown' | 'factory'>('shop');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [ceoUsername, setCeoUsername] = useState('');
  const [ceoPassword, setCeoPassword] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  // Auto generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      const generated = val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setSlug(generated);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: devUser, password: devPass })
      });
      const data = await res.json();
      if (data.success && data.user?.role === 'developer') {
        setIsAuthenticated(true);
        sessionStorage.setItem('dev_auth', 'true');
        fetchTenants();
      } else {
        setLoginError(data.error || 'Invalid Developer credentials');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Connection error');
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('dev_auth') === 'true') {
      setIsAuthenticated(true);
      fetchTenants();
    }
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          type,
          owner_name: ownerName,
          phone,
          city,
          address,
          ceo_username: ceoUsername,
          ceo_password: ceoPassword,
          staff_username: staffUsername,
          staff_password: staffPassword,
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        // Reset form
        setName('');
        setSlug('');
        setOwnerName('');
        setPhone('');
        setCity('');
        setAddress('');
        setCeoUsername('');
        setCeoPassword('');
        setStaffUsername('');
        setStaffPassword('');
        fetchTenants();
      } else {
        setFormError(data.error || 'Failed to create tenant');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error creating tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTenant = async (id: string, tenantName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${tenantName}"? All invoices and items under this entity will be removed.`)) return;
    try {
      const res = await fetch(`/api/tenants?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchTenants();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
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
        fetchTenants();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyUrl = (tenantSlug: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${origin}/${tenantSlug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.city && t.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (t.owner_name && t.owner_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalShops = tenants.filter(t => t.type === 'shop').length;
  const totalGodowns = tenants.filter(t => t.type === 'godown').length;

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 40%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.12), transparent 40%), var(--bg-primary)',
        padding: '20px'
      }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '36px', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px', borderRadius: '12px', color: 'white', display: 'flex' }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>Developer Super Panel</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Master Tenant & Entity Management</p>
            </div>
          </div>

          {loginError && (
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '18px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleDevLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Super Admin Username</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. admin"
                value={devUser}
                onChange={e => setDevUser(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Developer Secret Key</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="������������"
                value={devPass}
                onChange={e => setDevPass(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '8px', padding: '12px' }}>
              <KeyRound size={16} /> Unlock Developer Panel
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Default credentials: <code style={{ color: 'var(--accent-blue)' }}>admin / admin123</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Developer Super Panel</h1>
            <span className="badge badge-active" style={{ fontSize: '10px' }}><Sparkles size={11} /> Master Hub</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Provision new retail shops, wholesale godowns, and manage access credentials.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={fetchTenants} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add New Shop / Godown
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>TOTAL TENANTS</span>
            <Building2 size={20} color="var(--accent-blue)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800' }}>{tenants.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Active database instances</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>RETAIL SHOPS</span>
            <Store size={20} color="#60a5fa" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#60a5fa' }}>{totalShops}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>POS & Fast Counter Billing</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>GODOWNS / WAREHOUSES</span>
            <Warehouse size={20} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#fbbf24' }}>{totalGodowns}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Bulk Inward/Outward & Bilty</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>SYSTEM STATUS</span>
            <CheckCircle2 size={20} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-emerald)' }}>Cloud & RLS Online</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Supabase PostgreSQL Connected</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by shop name, slug URL, city, or owner..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'shop', 'godown', 'factory'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                background: typeFilter === t ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.05)',
                color: typeFilter === t ? 'white' : 'var(--text-secondary)',
                border: '1px solid ' + (typeFilter === t ? 'var(--accent-blue)' : 'var(--border-subtle)'),
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t === 'all' ? 'All Entities' : t + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Loading shops and godowns...
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Building2 size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>No shops or godowns found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '18px' }}>Add your first client shop or wholesale godown to get started.</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add First Shop / Godown
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
          {filteredTenants.map(tenant => {
            const isShop = tenant.type === 'shop';
            const isGodown = tenant.type === 'godown';
            return (
              <div key={tenant.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {/* Top card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: isShop ? 'rgba(59, 130, 246, 0.15)' : isGodown ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isShop ? '#60a5fa' : isGodown ? '#fbbf24' : '#a78bfa',
                      }}>
                        {isShop ? <Store size={22} /> : isGodown ? <Warehouse size={22} /> : <Factory size={22} />}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '17px', fontWeight: '700' }}>{tenant.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span className="badge">
                            {tenant.type}
                          </span>
                          {tenant.city && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📍 {tenant.city}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleToggleStatus(tenant.id, tenant.is_active)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      title={tenant.is_active ? 'Active - Click to suspend' : 'Suspended - Click to activate'}
                    >
                      {tenant.is_active ? (
                        <CheckCircle2 size={20} color="var(--accent-emerald)" />
                      ) : (
                        <XCircle size={20} color="var(--accent-rose)" />
                      )}
                    </button>
                  </div>

                  {/* Slug / URL preview */}
                  <div style={{ 
                    background: 'var(--bg-input)', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '8px 12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    fontSize: '13px'
                  }}>
                    <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>URL: </span>
                      <span style={{ color: 'var(--accent-blue)', fontWeight: '600' }}>/{tenant.slug}</span>
                    </div>
                    <button 
                      onClick={() => copyUrl(tenant.slug, tenant.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Copy URL"
                    >
                      {copiedId === tenant.id ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* Details */}
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                    {tenant.owner_name && (
                      <div><strong style={{ color: 'var(--text-muted)' }}>Owner:</strong> {tenant.owner_name} {tenant.phone && `(${tenant.phone})`}</div>
                    )}
                    {tenant.ceo && (
                      <div><strong style={{ color: 'var(--text-muted)' }}>CEO Login:</strong> <code style={{ color: '#a78bfa' }}>{tenant.ceo.username}</code></div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a 
                      href={`/${tenant.slug}`} 
                      target="_blank"
                      className="btn-primary" 
                      style={{ padding: '7px 12px', fontSize: '12px' }}
                    >
                      <ExternalLink size={13} /> Open App
                    </a>
                  </div>

                  <button 
                    onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                    className="btn-danger"
                    title="Delete entity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Shop / Godown Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Provision New Client / Entity</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Create a retail shop or warehouse instance with URL and user credentials.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>?</button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '18px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Entity Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {[
                    { id: 'shop', label: 'Retail Shop', icon: Store },
                    { id: 'godown', label: 'Wholesale Godown', icon: Warehouse },
                    { id: 'factory', label: 'Factory / Plant', icon: Factory },
                  ].map(item => {
                    const Icon = item.icon;
                    const isSelected = type === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setType(item.id as any)}
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                          border: '1px solid ' + (isSelected ? 'var(--accent-blue)' : 'var(--border-subtle)'),
                          padding: '12px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: isSelected ? '#60a5fa' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          fontSize: '13px'
                        }}
                      >
                        <Icon size={20} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Business / Shop Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Tawakal Paints Bahria"
                    value={name}
                    onChange={e => handleNameChange(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>URL Slug *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. tawakal-bahria"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Owner, Phone, City */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Owner / CEO Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Haji Muhammad"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="0300-1234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>City</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Lahore"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' }}>Physical Address / Location</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Shop #14, Main Commercial Market..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>

              {/* Credentials Section */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '6px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>?? Initial User Access Setup</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#a78bfa', marginBottom: '4px' }}>CEO Username</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. tawakal_ceo"
                      value={ceoUsername}
                      onChange={e => setCeoUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#a78bfa', marginBottom: '4px' }}>CEO Password</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. ceo123"
                      value={ceoPassword}
                      onChange={e => setCeoPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#60a5fa', marginBottom: '4px' }}>Staff / Cashier Username</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. counter1"
                      value={staffUsername}
                      onChange={e => setStaffUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#60a5fa', marginBottom: '4px' }}>Staff Password</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. staff123"
                      value={staffPassword}
                      onChange={e => setStaffPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating Instance...' : 'Create & Provision Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
