'use client';

import React, { useState, useEffect, use } from 'react';
import { Item, Tenant, Shift, PettyExpense, AuditLog } from '@/types';
import PosBilling from '@/components/PosBilling';
import StockInventory from '@/components/StockInventory';
import GodownTransfers from '@/components/GodownTransfers';
import ShiftDrawer from '@/components/ShiftDrawer';
import CeoDashboard from '@/components/CeoDashboard';
import FinancialLedgers from '@/components/FinancialLedgers';
import ClientCreditRecovery from '@/components/ClientCreditRecovery';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function TenantAppPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRoleTab, setLoginRoleTab] = useState<'staff' | 'ceo'>('staff');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'pos' | 'stock' | 'ledgers' | 'credit' | 'transfers' | 'shift' | 'ceo_reports'>('pos');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('15000');
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<PettyExpense[]>([
    { id: '1', tenant_id: '', category: 'Staff', title: 'Tea & Snacks', amount: 450, created_at: '10:30 AM' },
    { id: '2', tenant_id: '', category: 'Office', title: 'Stationery (Pens)', amount: 250, created_at: '01:15 PM' },
    { id: '3', tenant_id: '', category: 'Operations', title: 'Labor (Unloading)', amount: 500, created_at: '03:00 PM' },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<any | null>(null);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await fetch(`/api/tenants?slug=${slug}`);
        const data = await res.json();
        if (data.error || !data.tenant) {
          setError(data.error || 'Branch not found');
        } else {
          setTenant(data.tenant);
          try {
            const itemsRes = await fetch(`/api/items?tenant_id=${data.tenant.id}`);
            const itemsData = await itemsRes.json();
            setItems(itemsData.items || []);
          } catch { setItems([]); }

          // Fetch active shift if any
          try {
            const shiftRes = await fetch(`/api/shifts?tenant_id=${data.tenant.id}&status=open`);
            const shiftData = await shiftRes.json();
            if (shiftData.success && shiftData.activeShift) {
              setActiveShift(shiftData.activeShift);
            }
          } catch {}
        }
      } catch { setError('Network error.'); } finally { setLoading(false); }
    };
    fetchTenant();
  }, [slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword, slug }),
      });
      const data = await res.json();
      if (data.error || !data.success) {
        setLoginError(data.error || 'Invalid credentials');
      } else {
        setCurrentUser(data.user);
        if (data.user.role !== 'ceo' && data.user.role !== 'developer') {
          if (!activeShift) {
            setShowOpenShiftModal(true);
          }
          setActiveTab('pos');
        } else {
          setActiveTab('ceo_reports');
        }
      }
    } catch { setLoginError('Login failed.'); }
  };

  const handleOpenShift = async () => {
    if (!tenant) return;
    const openingAmt = parseFloat(openingCashInput) || 15000;
    
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          opened_by: currentUser?.id,
          opening_cash: openingAmt,
          notes: `Opened by ${currentUser?.full_name || currentUser?.username}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.shift) {
        setActiveShift(data.shift);
      } else {
        setActiveShift({
          id: Date.now().toString(),
          tenant_id: tenant.id,
          staff_id: currentUser?.id,
          opening_cash: openingAmt,
          status: 'open',
          opened_at: new Date().toISOString(),
        });
      }
    } catch {
      setActiveShift({
        id: Date.now().toString(),
        tenant_id: tenant.id,
        staff_id: currentUser?.id,
        opening_cash: openingAmt,
        status: 'open',
        opened_at: new Date().toISOString(),
      });
    }
    setShowOpenShiftModal(false);
  };

  const refreshItems = async () => {
    if (tenant?.id) {
      try {
        const itemsRes = await fetch(`/api/items?tenant_id=${tenant.id}`);
        const itemsData = await itemsRes.json();
        if (itemsData.success) {
          setItems(itemsData.items || []);
        }
      } catch (err) {
        console.error('Failed to reload items', err);
      }
    }
  };

  const handleCompleteSale = async (inv: any) => {
    setInvoices(p => [inv, ...p]);
    setSelectedInvoiceForPrint(inv);
    await refreshItems();
  };

  const isCEO = currentUser?.role === 'ceo' || currentUser?.role === 'developer';
  const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);

  // Loading Screen
  if (loading) return (
    <div className="login-wrapper">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <p className="text-muted" style={{ fontSize: '13px' }}>Loading branch...</p>
      </div>
    </div>
  );

  // Error Screen
  if (error || !tenant) return (
    <div className="login-wrapper">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <span className="material-symbols-outlined filled" style={{ fontSize: 40, color: 'var(--error)', marginBottom: '0.75rem' }}>domain_disabled</span>
        <h2 className="headline-sm" style={{ marginBottom: '0.5rem' }}>Branch Not Found</h2>
        <p className="text-muted body-md" style={{ marginBottom: '1.25rem' }}>{error}</p>
        <a href="/" style={{ color: 'var(--secondary)', fontSize: '14px' }}>← Go back to home</a>
      </div>
    </div>
  );

  // Login Screen
  if (!currentUser) {
    const isShop = tenant.type === 'shop';
    return (
      <div className="login-wrapper">
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="login-brand-icon">
              <span className="material-symbols-outlined filled" style={{ fontSize: 32, color: 'var(--secondary)' }}>
                {isShop ? 'format_paint' : 'warehouse'}
              </span>
            </div>
            <h1 className="headline-md" style={{ marginBottom: '4px' }}>{tenant.name}</h1>
            <p className="text-muted body-md">{isShop ? 'PaintERP Retail & Wholesale POS' : 'Warehouse & Godown Management'}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem' }}>
              <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{isOnline ? 'wifi' : 'wifi_off'}</span>
                {isOnline ? 'Cloud Database Connected' : 'Offline Mode Active'}
              </span>
            </div>
          </div>

          {/* Role Tabs */}
          <div className="role-tabs">
            {(['staff', 'ceo'] as const).map(tab => (
              <button key={tab} onClick={() => setLoginRoleTab(tab)} className={`role-tab ${loginRoleTab === tab ? 'active' : ''}`}>
                {tab === 'staff' ? 'Counter Staff / POS' : 'CEO / Owner'}
              </button>
            ))}
          </div>

          {/* Login Card */}
          <div className="login-card">
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder={loginRoleTab === 'staff' ? 'counter1-mauripur' : 'asifkhan-ceo'}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {loginError && (
                <div style={{ background: 'var(--error-container)', border: '1px solid rgba(186,26,26,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '13px', color: 'var(--on-error-container)' }}>
                  {loginError}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.25rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock_open</span>
                Login to {tenant.name}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Navigation Items
  const navItems = [
    { id: 'pos',         label: 'POS',             icon: 'point_of_sale' },
    { id: 'stock',       label: 'Inventory',       icon: 'inventory_2' },
    { id: 'ledgers',     label: 'Ledgers',         icon: 'menu_book' },
    { id: 'credit',      label: 'Credit Recovery', icon: 'account_balance_wallet' },
    { id: 'transfers',   label: 'Production',      icon: 'factory' },
    { id: 'shift',       label: 'Day Close',       icon: 'payments' },
    { id: 'ceo_reports', label: 'Admin',           icon: 'settings' },
  ];

  return (
    <div className="app-shell">
      {/* ── Fixed Sidebar ── */}
      <aside className="sidebar">
        {/* Brand Logo Header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <span className="material-symbols-outlined filled" style={{ fontSize: 22 }}>format_paint</span>
          </div>
          <div>
            <div className="sidebar-brand-name">{tenant.name}</div>
            <div className="sidebar-brand-sub">{tenant.city || 'Pakistan'} Branch</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer Actions */}
        <div>
          <button
            onClick={() => window.location.href = '/dev'}
            className="sidebar-footer-btn"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>swap_horiz</span>
            Switch Tenant
          </button>
          <div className="sidebar-footer">
            <button
              onClick={() => setCurrentUser(null)}
              className="sidebar-link"
              style={{ color: 'var(--error)', opacity: 0.9 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="main-wrapper">
        {/* Sticky Topbar */}
        <header className="topbar">
          <div className="flex items-center gap-md">
            <span className="topbar-brand">PaintERP</span>
            <div className="topbar-search">
              <span className="material-symbols-outlined topbar-search-icon">search</span>
              <input type="text" placeholder="Search across branches..." />
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`status-pill ${isOnline ? 'online' : 'offline'}`} style={{ fontSize: 11 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{isOnline ? 'wifi' : 'wifi_off'}</span>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {totalSales > 0 && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--on-surface-variant)', background: 'var(--surface-container)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--outline-variant)' }}>
                Sales: <strong style={{ color: '#065f46' }}>Rs. {totalSales.toLocaleString()}</strong>
              </span>
            )}
            <div className="topbar-divider" />
            <button className="topbar-icon-btn" title="Notifications">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
            </button>
            <div className="topbar-user">
              <div className="topbar-user-info">
                <div className="topbar-user-name">{currentUser?.full_name || currentUser?.username}</div>
                <div className="topbar-user-role">{currentUser?.role === 'ceo' ? 'CEO / Owner' : 'Counter Staff'}</div>
              </div>
              <div className="topbar-avatar">
                <span className="material-symbols-outlined filled" style={{ fontSize: 22 }}>account_circle</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Screen View */}
        <main className="main-content">
          {activeTab === 'pos' && (
            <PosBilling
              items={items}
              tenantId={tenant.id}
              shiftId={activeShift?.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || 'Staff'}
              onCompleteSale={handleCompleteSale}
            />
          )}
          {activeTab === 'stock' && (
            <StockInventory
              items={items}
              tenantId={tenant.id}
              tenantName={tenant.name}
              onStockUpdated={refreshItems}
            />
          )}
          {activeTab === 'ledgers' && (
            <FinancialLedgers
              tenantId={tenant.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
            />
          )}
          {activeTab === 'credit' && (
            <ClientCreditRecovery
              tenantId={tenant.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
            />
          )}
          {activeTab === 'transfers' && (
            <GodownTransfers
              items={items}
              tenantId={tenant.id}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              onStockDispatched={refreshItems}
            />
          )}
          {activeTab === 'shift' && (
            <ShiftDrawer
              shift={activeShift}
              tenantId={tenant.id}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              tenantName={tenant.name}
              ownerPhone={tenant.phone || ''}
              expenses={expenses}
              invoices={invoices}
              totalSales={totalSales}
              onAddExpense={exp => setExpenses(p => [exp, ...p])}
              onShiftClosed={closedShift => {
                setActiveShift(null);
                alert('Shift closed and reconciled successfully!');
              }}
            />
          )}
          {activeTab === 'ceo_reports' && <CeoDashboard auditLogs={auditLogs} todaySales={totalSales} />}
        </main>
      </div>

      {/* ── Subah Ka Daraz Cash (Open Shift Modal) ── */}
      {showOpenShiftModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2000 }}>
          <div className="login-card" style={{ maxWidth: '400px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--secondary-fixed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem', color: 'var(--secondary)' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: 26 }}>payments</span>
              </div>
              <h3 className="headline-sm" style={{ marginBottom: '4px' }}>Subah Ka Daraz Cash</h3>
              <p className="text-muted" style={{ fontSize: '13px' }}>Aaj subah counter mein kitne khulay paise hain?</p>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Opening Cash (Rs.)</label>
              <input
                type="number"
                className="form-input"
                value={openingCashInput}
                onChange={e => setOpeningCashInput(e.target.value)}
                style={{ fontSize: '20px', height: '52px', fontWeight: '700', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: 'var(--secondary)' }}
                autoFocus
              />
            </div>
            <button onClick={handleOpenShift} className="btn btn-primary btn-lg btn-full">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock_open</span>
              Start Shift &amp; Unlock POS
            </button>
          </div>
        </div>
      )}

      {/* ── Print Receipt Modal ── */}
      {selectedInvoiceForPrint && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 3000 }}>
          <div style={{ width: '100%', maxWidth: '340px', padding: '1.5rem', background: '#fff', color: '#000', borderRadius: 'var(--radius-md)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '900' }}>{tenant.name}</h3>
              <p style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{tenant.address || 'Commercial Market'}</p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: '700', marginTop: '4px' }}>{selectedInvoiceForPrint.invoice_no}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{selectedInvoiceForPrint.date}</div>
            </div>
            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              {selectedInvoiceForPrint.items?.map((ci: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span>{ci.item?.name} x{ci.qty}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Rs. {(ci.qty * ci.price).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '14px', marginBottom: '1rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <span>NET TOTAL:</span>
              <span>Rs. {selectedInvoiceForPrint.grandTotal?.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '9px', background: '#0051d5', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                Print
              </button>
              <button onClick={() => setSelectedInvoiceForPrint(null)} style={{ flex: 1, padding: '9px', background: '#e2e8f0', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}