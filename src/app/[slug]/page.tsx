'use client';

import React, { useState, useEffect, use } from 'react';
import { Item, Tenant, Shift, PettyExpense, AuditLog } from '@/types';
import PosBilling from '@/components/PosBilling';
import StockInventory from '@/components/StockInventory';
import ShiftDrawer from '@/components/ShiftDrawer';
import CeoDashboard from '@/components/CeoDashboard';
import FinancialLedgers from '@/components/FinancialLedgers';
import ClientCreditRecovery from '@/components/ClientCreditRecovery';
import SalesHistory from '@/components/SalesHistory';
import HoldInvoices from '@/components/HoldInvoices';
import PurchasesView from '@/components/PurchasesView';
import BranchOrders from '@/components/BranchOrders';

import {
  ShoppingCart,
  Boxes,
  ShoppingBag,
  TrendingUp,
  Users,
  RotateCcw,
  PauseCircle,
  Scale,
  BarChart3,
  CalendarCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowLeftRight,
  Search,
  Wifi,
  WifiOff,
  Bell,
  User,
  Layers,
  Lock,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<
    'pos' | 'inventory' | 'purchases' | 'sales' | 'customers' | 'returns' | 'orders' | 'hold_invoices' | 'credit_recovery' | 'reports' | 'day_close' | 'stock' | 'ledgers' | 'credit' | 'shift' | 'ceo_reports'
  >('pos');
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [lastClosedShift, setLastClosedShift] = useState<any | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<PettyExpense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<any | null>(null);
  const [restoringHeldOrder, setRestoringHeldOrder] = useState<any | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
          const targetTenantId = tenant?.id || data.user.tenant?.id || data.user.tenant_id || slug;
          if (!activeShift) {
            // Fetch last closed shift for handover display
            try {
              const tenantRes = await fetch(`/api/shifts?tenant_id=${targetTenantId}&last_closed=1`);
              const tenantData = await tenantRes.json();
              if (tenantData.success && tenantData.lastClosedShift) {
                setLastClosedShift(tenantData.lastClosedShift);
                // Pre-fill with previous closing cash
                setOpeningCashInput(String(tenantData.lastClosedShift.actual_cash || ''));
              } else {
                setLastClosedShift(null);
                setOpeningCashInput('');
              }
            } catch {
              setLastClosedShift(null);
              setOpeningCashInput('');
            }
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

    // Defensively ensure lastClosedShift is available if previous shifts exist
    let currentLastClosed = lastClosedShift;
    if (!currentLastClosed && tenant.id) {
      try {
        const lastRes = await fetch(`/api/shifts?tenant_id=${tenant.id}&last_closed=1`);
        const lastData = await lastRes.json();
        if (lastData.success && lastData.lastClosedShift) {
          currentLastClosed = lastData.lastClosedShift;
        }
      } catch {}
    }

    const openingAmt = parseFloat(openingCashInput) || 0;
    const prevClosing = currentLastClosed ? Number(currentLastClosed.actual_cash || 0) : 0;
    const handoverVariance = openingAmt - prevClosing;
    const handoverNotes = currentLastClosed
      ? `Handover: Prev shift closed Rs.${prevClosing.toLocaleString()}, Counted Rs.${openingAmt.toLocaleString()}, Variance ${handoverVariance >= 0 ? '+' : ''}Rs.${handoverVariance.toLocaleString()}`
      : 'First shift of the day';

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          opened_by: currentUser?.id,
          opening_cash: openingAmt,
          previous_closing_cash: prevClosing,
          handover_variance: handoverVariance,
          handover_notes: handoverNotes,
          notes: `Opened by ${currentUser?.full_name || currentUser?.username}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.shift) {
        setActiveShift(data.shift);
        setLastClosedShift(null);
      } else {
        setActiveShift({
          id: Date.now().toString(),
          tenant_id: tenant.id,
          staff_id: currentUser?.id,
          opening_cash: openingAmt,
          previous_closing_cash: prevClosing,
          handover_variance: handoverVariance,
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
        previous_closing_cash: prevClosing,
        handover_variance: handoverVariance,
        status: 'open',
        opened_at: new Date().toISOString(),
      });
    }
    setShowOpenShiftModal(false);
  };

  const fetchPendingOrdersCount = async () => {
    if (!tenant?.id) return;
    if (typeof window !== 'undefined' && !navigator.onLine) return;
    try {
      const counterParam = currentUser?.username ? `&counter=${encodeURIComponent(currentUser.username)}` : '';
      const res = await fetch(`/api/branch-orders?tenant_id=${tenant.id}${counterParam}&count_only=incoming`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        setPendingOrdersCount(data.pendingCount || 0);
      }
    } catch {
      // Silently ignore transient background polling network hiccups
    }
  };

  useEffect(() => {
    if (tenant?.id) {
      fetchPendingOrdersCount();
      const interval = setInterval(fetchPendingOrdersCount, 15000);
      return () => clearInterval(interval);
    }
  }, [tenant?.id, currentUser?.username]);

  const refreshItems = async () => {
    if (!tenant?.id) return;
    if (typeof window !== 'undefined' && !navigator.onLine) return;
    try {
      const itemsRes = await fetch(`/api/items?tenant_id=${tenant.id}`);
      if (!itemsRes.ok) return;
      const itemsData = await itemsRes.json();
      if (itemsData && itemsData.success) {
        setItems(itemsData.items || []);
      }
    } catch {
      // Silently ignore transient offline fetch failures
    }
  };

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleGlobalRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refreshItems();
      await fetchPendingOrdersCount();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500);
    }
  };

  const handleCompleteSale = async (inv: any) => {
    setInvoices(p => {
      const existingIdx = p.findIndex(existing => (inv.id && existing.id === inv.id) || (inv.invoice_no && existing.invoice_no === inv.invoice_no));
      if (existingIdx >= 0) {
        const updated = [...p];
        updated[existingIdx] = inv;
        return updated;
      }
      return [inv, ...p];
    });
    setSelectedInvoiceForPrint(inv);
    await refreshItems();
  };

  const isCEO = currentUser?.role === 'ceo' || currentUser?.role === 'developer';
  const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);

  // Automatic Redirect for Invalid / Non-existent Shop URL
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  useEffect(() => {
    if (!loading && (error || !tenant)) {
      const interval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            window.location.href = '/';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [loading, error, tenant]);

  // Loading Screen
  if (loading) return (
    <div className="login-wrapper">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: '#f97316', borderTopColor: 'transparent' }} />
        <p className="text-muted" style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>Loading PyntFlow branch...</p>
      </div>
    </div>
  );

  // Error / Invalid Shop Screen — Auto Redirect to Homepage
  if (error || !tenant) return (
    <div className="login-wrapper">
      <div className="login-card" style={{ textAlign: 'center', maxWidth: '420px', padding: '2rem' }}>
        <div style={{ width: 56, height: 56, borderRadius: '14px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <Layers style={{ width: 28, height: 28 }} />
        </div>
        <h2 className="headline-sm" style={{ marginBottom: '0.5rem', color: '#0F172A' }}>Shop Not Found</h2>
        <p className="text-muted body-md" style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
          The shop URL <strong>/{slug}</strong> is not registered on PyntFlow or has been modified.
        </p>
        <div style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#64748B', marginBottom: '1.25rem', fontFamily: 'JetBrains Mono, monospace' }}>
          Redirecting to PyntFlow Homepage in <strong style={{ color: '#F97316' }}>{redirectCountdown}s</strong>...
        </div>
        <a href="/" className="btn btn-primary btn-full" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          ← Return to PyntFlow Home
        </a>
      </div>
    </div>
  );

  // Login Screen
  if (!currentUser) {
    const isShop = tenant.type === 'shop';
    return (
      <div className="login-wrapper">
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Brand Header */}
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <img src="/logo.png" alt="Pyntflow" style={{ height: '36px', width: 'auto', margin: '0 auto 1rem', display: 'block', objectFit: 'contain' }} />
            <h1 className="headline-md" style={{ marginBottom: '4px', color: '#0F172A' }}>{tenant.name}</h1>
            <p className="text-muted body-md">{isShop ? 'Pyntflow Retail & Wholesale POS' : 'Warehouse & Godown Management'}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem' }}>
              <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? <Wifi style={{ width: 12, height: 12 }} /> : <WifiOff style={{ width: 12, height: 12 }} />}
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
                <div style={{ background: '#fee2e2', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '13px', color: '#991b1b' }}>
                  {loginError}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.25rem' }}>
                <Lock style={{ width: 16, height: 16 }} />
                Login to {tenant.name}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // When logged in as CEO or viewing Reports, render full-screen CEO Executive Suite scoped to this shop
  if (currentUser?.role === 'ceo' || activeTab === 'ceo_reports' || activeTab === 'reports') {
    return (
      <CeoDashboard
        tenant={tenant}
        slug={tenant.slug}
        todaySales={totalSales}
        auditLogs={auditLogs}
        onLogout={() => {
          if (currentUser?.role === 'ceo') {
            setCurrentUser(null);
          } else {
            setActiveTab('pos');
          }
        }}
      />
    );
  }

  // Navigation Items for Cashier / Staff POS Workspace
  const navItems = [
    { id: 'pos',             label: 'POS Billing',       icon: ShoppingCart },
    { id: 'inventory',       label: 'Inventory',         icon: Boxes },
    { id: 'purchases',       label: 'Purchases',         icon: ShoppingBag },
    { id: 'sales',           label: 'Sales',             icon: TrendingUp },
    { id: 'customers',       label: 'Customers',         icon: Users },
    { id: 'orders',          label: 'Branch Orders',     icon: PackagePlus, badgeCount: pendingOrdersCount },
    { id: 'hold_invoices',   label: 'Hold Invoices',     icon: PauseCircle },
    { id: 'credit_recovery', label: 'Credit & Recovery', icon: Scale },
    { id: 'day_close',       label: 'Day Close',         icon: CalendarCheck },
  ];

  return (
    <div className="app-shell">
      {/* ── Collapsible Dark Navy Sidebar ── */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {isSidebarCollapsed ? (
              <img src="/favicon.png" alt="Pyntflow" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            ) : (
              <div style={{ minWidth: 0 }}>
                <img src="/logo.png" alt="Pyntflow" style={{ height: '22px', width: 'auto', display: 'block', objectFit: 'contain' }} />
                <div className="sidebar-brand-sub" style={{ marginTop: '3px' }}>{tenant.city || 'Pakistan'} Branch</div>
              </div>
            )}
          </div>

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="sidebar-collapse-toggle"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight style={{ width: 16, height: 16 }} /> : <ChevronLeft style={{ width: 16, height: 16 }} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav no-scrollbar">
          {!isSidebarCollapsed && (
            <div className="sidebar-section-title">
              Workspace
            </div>
          )}
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasBadge = (item.badgeCount ?? 0) > 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                title={isSidebarCollapsed ? (hasBadge ? `${item.label} (${item.badgeCount} pending)` : item.label) : undefined}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                  {isSidebarCollapsed && hasBadge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#F97316',
                      }}
                    />
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {hasBadge && (
                      <span
                        style={{
                          background: '#F97316',
                          color: '#FFFFFF',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontFamily: 'JetBrains Mono, monospace',
                          flexShrink: 0,
                          marginRight: isActive ? '4px' : '0',
                        }}
                      >
                        {item.badgeCount}
                      </span>
                    )}
                    {isActive && <ChevronRight style={{ width: 14, height: 14, opacity: 0.9 }} />}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Switcher / Session Panel */}
        <div className="sidebar-footer">
          {!isSidebarCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div>
                <label style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Branch
                </label>
                <div style={{ background: '#1e293b', border: '1px solid rgba(51,65,85,0.6)', borderRadius: '6px', padding: '6px 8px', color: '#e2e8f0', fontSize: '11.5px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</span>
                  <a href="/dev" title="Switch Branch" style={{ color: '#F97316', display: 'flex', alignItems: 'center' }}>
                    <ArrowLeftRight style={{ width: 13, height: 13 }} />
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', background: '#16a34a', borderRadius: '50%' }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#94a3b8' }}>
                    T01 · Online
                  </span>
                </div>
                <button
                  onClick={() => setCurrentUser(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                  title="Logout Session"
                >
                  <LogOut style={{ width: 12, height: 12 }} />
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', background: '#16a34a', borderRadius: '50%' }} title="Terminal Online" />
              <button
                onClick={() => setCurrentUser(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                title="Logout"
              >
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="main-wrapper">
        {/* Sticky Topbar matching PaintERP exactly */}
        {activeTab !== 'pos' && activeTab !== 'sales' && activeTab !== 'returns' && activeTab !== 'hold_invoices' && activeTab !== 'purchases' && (
          <header className="pos-topbar" style={{ height: '56px', borderBottom: '1px solid #E2E8F0', background: '#FFFFFF', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 }}>
            {/* Left: Counter Staff / Active Register Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div
                style={{ width: '30px', height: '30px', background: '#F1F5F9', color: '#334155', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #CBD5E1', flexShrink: 0 }}
                title="Active Register: 01"
              >
                01
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                  {currentUser?.full_name || (currentUser?.role === 'ceo' ? 'CEO / Owner' : 'Counter Staff')}
                </span>
                <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>
                  Register: {currentUser?.username?.toUpperCase() || '01'}
                </span>
              </div>
            </div>

            {/* Right: Refresh, Online Status, Sales, Bell Notification */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleGlobalRefresh}
                disabled={isManualRefreshing}
                style={{
                  padding: '5px 10px',
                  color: '#475569',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isManualRefreshing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
                title="Refresh products, orders, and sales without reloading page"
              >
                <RefreshCw
                  style={{
                    width: 12,
                    height: 12,
                    color: '#F97316',
                    animation: isManualRefreshing ? 'spin 1s linear infinite' : 'none',
                  }}
                />
                {isManualRefreshing ? 'Syncing...' : 'Refresh'}
              </button>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: isOnline ? '#16A34A' : '#DC2626', background: isOnline ? '#DCFCE7' : '#FEE2E2', padding: '3px 9px', borderRadius: '6px', border: isOnline ? '1px solid #BBF7D0' : '1px solid #FECACA' }}>
                {isOnline ? <Wifi style={{ width: 12, height: 12 }} /> : <WifiOff style={{ width: 12, height: 12 }} />}
                {isOnline ? 'Online' : 'Offline'}
              </span>

              {totalSales > 0 && (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#0F172A', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  Sales: <strong style={{ color: '#16A34A' }}>Rs. {totalSales.toLocaleString()}</strong>
                </span>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                style={{ padding: '7px', color: '#64748B', background: 'transparent', border: 'none', borderRadius: '8px', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={pendingOrdersCount > 0 ? `${pendingOrdersCount} pending incoming order${pendingOrdersCount > 1 ? 's' : ''}` : 'Branch Orders'}
              >
                <Bell style={{ width: 16, height: 16 }} />
                {pendingOrdersCount > 0 && (
                  <span style={{ width: '8px', height: '8px', background: '#F97316', borderRadius: '50%', position: 'absolute', top: '5px', right: '5px' }} />
                )}
              </button>
            </div>
          </header>
        )}

        {/* Dynamic Screen View */}
        <main className={`main-content ${(activeTab === 'pos' || activeTab === 'sales' || activeTab === 'returns' || activeTab === 'purchases') ? 'no-pad' : ''}`}>
          {activeTab === 'orders' && (
            <BranchOrders
              items={items}
              tenantId={tenant.id}
              tenantSlug={tenant.slug}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              staffUsername={currentUser?.username}
              onOrderPlaced={fetchPendingOrdersCount}
            />
          )}
          {activeTab === 'purchases' && (
            <PurchasesView
              tenantId={tenant.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Purchase Officer'}
              items={items}
              onStockUpdated={refreshItems}
              pendingOrdersCount={pendingOrdersCount}
              onNavigateToOrders={() => setActiveTab('orders')}
            />
          )}
          {activeTab === 'sales' && (
            <SalesHistory
              tenantId={tenant.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              onNavigateToPos={() => setActiveTab('pos')}
              onEditInvoiceInPos={(inv) => {
                setEditingInvoice(inv);
                setActiveTab('pos');
              }}
            />
          )}
          {activeTab === 'hold_invoices' && (
            <HoldInvoices
              tenantId={tenant.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              onResumeOrder={(order) => {
                setRestoringHeldOrder(order);
                setActiveTab('pos');
              }}
              onNavigateToPos={() => setActiveTab('pos')}
            />
          )}
          {(activeTab === 'pos' || activeTab === 'returns') && (
            <PosBilling
              items={items}
              tenantId={tenant.id}
              shiftId={activeShift?.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || 'Staff'}
              restoringHeldOrder={restoringHeldOrder}
              onClearRestoringHeldOrder={() => setRestoringHeldOrder(null)}
              editingInvoice={editingInvoice}
              onClearEditingInvoice={() => setEditingInvoice(null)}
              onCompleteSale={handleCompleteSale}
              pendingOrdersCount={pendingOrdersCount}
              onNavigateToOrders={() => setActiveTab('orders')}
            />
          )}
          {(activeTab === 'inventory' || activeTab === 'stock') && (
            <StockInventory
              items={items}
              tenantId={tenant.id}
              tenantName={tenant.name}
              onStockUpdated={refreshItems}
            />
          )}
          {(activeTab === 'customers' || activeTab === 'ledgers') && (
            <FinancialLedgers
              tenantId={tenant.id}
              tenantSlug={slug}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              staffUsername={currentUser?.username}
            />
          )}
          {(activeTab === 'credit_recovery' || activeTab === 'credit') && (
            <ClientCreditRecovery
              tenantId={tenant.id}
              tenantName={tenant.name}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
            />
          )}
          {(activeTab === 'day_close' || activeTab === 'shift') && (
            <ShiftDrawer
              shift={activeShift}
              tenantId={tenant.id}
              tenant={tenant}
              staffName={currentUser?.full_name || currentUser?.username || 'Staff'}
              tenantName={tenant.name}
              ownerPhone={tenant.phone || ''}
              expenses={expenses}
              invoices={invoices}
              totalSales={totalSales}
              onAddExpense={exp => setExpenses(p => [exp, ...p])}
              onShiftClosed={closedShift => {
                setActiveShift(null);
              }}
              onLogout={() => {
                setCurrentUser(null);
                setActiveShift(null);
                setInvoices([]);
                setExpenses([]);
              }}
            />
          )}
        </main>
      </div>

      {/* ── Shift Handover / Open Shift Modal ── */}
      {showOpenShiftModal && (() => {
        const prevClosing = lastClosedShift ? Number(lastClosedShift.actual_cash || 0) : 0;
        const currentInput = parseFloat(openingCashInput) || 0;
        const liveVariance = currentInput - prevClosing;
        const isShort = liveVariance < 0;
        const isOver = liveVariance > 0;
        const isFirstShift = !lastClosedShift;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2000 }}>
            <div className="login-card" style={{ maxWidth: '440px', width: '100%' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'var(--secondary-fixed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem', color: 'var(--secondary)' }}>
                  <span className="material-symbols-outlined filled" style={{ fontSize: 28 }}>account_balance_wallet</span>
                </div>
                <h3 className="headline-sm" style={{ marginBottom: '4px' }}>
                  {isFirstShift ? 'Shift Open — Opening Cash' : `Shift ${(lastClosedShift?.shift_number || 2)} — Handover Verification`}
                </h3>
                <p className="text-muted" style={{ fontSize: '12px' }}>
                  {isFirstShift ? 'Pehli shift hai — counter mein kitne paise hain?' : 'Pichli shift se daraz mein kitne paise rehne chahiye the?'}
                </p>
              </div>

              {/* Previous Shift Info (if exists) */}
              {!isFirstShift && (
                <div style={{ marginBottom: '1.25rem', padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--outline-variant)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-surface-variant)', marginBottom: '10px' }}>
                    📋 Pichli Shift ka Hisaab
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--on-surface-variant)' }}>Closed by</span>
                    <span style={{ fontWeight: 600 }}>{lastClosedShift?.closed_by || 'Staff'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--on-surface-variant)' }}>Shift Close Time</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      {lastClosedShift?.end_time ? new Date(lastClosedShift.end_time).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, borderTop: '1px solid var(--outline-variant)', paddingTop: '8px', marginTop: '4px' }}>
                    <span>Daraz mein rehna chahiye tha</span>
                    <span style={{ color: 'var(--secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      Rs. {prevClosing.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Cash Input */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">
                  {isFirstShift ? 'Opening Cash (Rs.)' : 'Ab daraz mein actual kitne hain? (Rs.)'}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={openingCashInput}
                  onChange={e => setOpeningCashInput(e.target.value)}
                  style={{ fontSize: '22px', height: '56px', fontWeight: '700', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: 'var(--secondary)' }}
                  autoFocus
                />
              </div>

              {/* Live Variance (only if previous shift exists and user has typed) */}
              {!isFirstShift && openingCashInput !== '' && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: isShort ? 'rgba(239,68,68,0.08)' : isOver ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.08)',
                  border: `1px solid ${isShort ? '#FCA5A5' : '#86EFAC'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isShort ? '#DC2626' : '#16A34A' }}>
                    {isShort ? '⚠️ SHORT — Farq hai!' : isOver ? '✅ OVER — Extra cash' : '✅ MATCHED — Sab theek'}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '15px', color: isShort ? '#DC2626' : '#16A34A' }}>
                    {isShort ? '-' : '+'}Rs. {Math.abs(liveVariance).toLocaleString()}
                  </span>
                </div>
              )}

              {isShort && !isFirstShift && openingCashInput !== '' && (
                <div style={{ marginBottom: '1rem', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ⚠️ Yeh Rs. {Math.abs(liveVariance).toLocaleString()} ka farq CEO report mein <strong>Handover Variance</strong> ke tor par record hoga.
                </div>
              )}

              <button onClick={handleOpenShift} className="btn btn-primary btn-lg btn-full">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock_open</span>
                {isShort && !isFirstShift ? `Shift Open Karo (${Math.abs(liveVariance).toLocaleString()} short noted)` : 'Shift Open & POS Unlock'}
              </button>
            </div>
          </div>
        );
      })()}

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
              <button onClick={() => window.print()} style={{ flex: 1, padding: '9px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
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