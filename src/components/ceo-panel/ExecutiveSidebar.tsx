'use client';

import React from 'react';
import { Branch } from '@/types/ceo';
import {
  LayoutDashboard,
  TrendingUp,
  RotateCcw,
  CalendarCheck,
  Users,
  ShoppingBag,
  Settings,
  LogOut,
  Truck,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export type CEOSection = 'overview' | 'sales' | 'returns' | 'day-close' | 'customers' | 'purchase' | 'branch-orders' | 'audit-logs' | 'settings';

interface ExecutiveSidebarProps {
  currentSection: CEOSection;
  onSelectSection: (section: CEOSection) => void;
  branch: Branch;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_ITEMS: { id: CEOSection; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { id: 'overview',      label: 'Overview & P&L',         icon: LayoutDashboard },
  { id: 'sales',         label: 'Sales Register',          icon: TrendingUp },
  { id: 'returns',       label: 'Returns & Tinting Loss',  icon: RotateCcw },
  { id: 'day-close',     label: 'Day Close & Variance',    icon: CalendarCheck },
  { id: 'customers',     label: 'Customers & Udhaar',      icon: Users },
  { id: 'purchase',      label: 'Procurement & POs',       icon: ShoppingBag },
  { id: 'branch-orders', label: 'Branch Transfers',        icon: Truck },
  { id: 'audit-logs',    label: 'Audit & Activity Log',    icon: ShieldCheck },
  { id: 'settings',      label: 'Branch & Commission',     icon: Settings },
];

const SidebarContent: React.FC<ExecutiveSidebarProps & { onCloseIfMobile?: () => void }> = ({
  currentSection,
  onSelectSection,
  branch,
  onLogout,
  onCloseIfMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
}) => {
  const handleSelect = (id: CEOSection) => {
    onSelectSection(id);
    if (onCloseIfMobile) onCloseIfMobile();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        overflow: 'hidden',
      }}
    >
      {/* ── Top: Brand + Branch Info ── */}
      <div style={{ flexShrink: 0 }}>
        {/* Brand Header */}
        <div
          style={{
            padding: isCollapsed ? '16px 0' : '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            flexDirection: isCollapsed ? 'column' : 'row',
            gap: isCollapsed ? '16px' : '10px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'flex-start', gap: '6px', minWidth: 0 }}>
            <img
              src={isCollapsed ? "/favicon.png" : "/logo.png"}
              alt="Pyntflow"
              style={{
                height: isCollapsed ? '32px' : '36px',
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
                flexShrink: 0,
                margin: '0',
              }}
            />
            {!isCollapsed && (
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span
                  className="ceo-font-mono"
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(198,161,91,0.12)',
                    color: '#D97706',
                    border: '1px solid rgba(198,161,91,0.25)',
                    flexShrink: 0,
                  }}
                >
                  CEO SUITE
                </span>
              </div>
              <div
                className="ceo-font-mono"
                style={{ fontSize: '10px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {branch.code || 'PK-01'} • {branch.city || 'Karachi'}
              </div>
            </div>
            )}
          </div>

          {/* Toggle/Close Button */}
          <button
            onClick={isMobileOpen ? onCloseMobile : onToggleCollapse}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
              color: '#64748B',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            aria-label={isMobileOpen ? "Close navigation" : "Toggle Sidebar"}
          >
            {isMobileOpen ? (
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
            ) : isCollapsed ? (
              <ChevronRight style={{ width: 16, height: 16 }} />
            ) : (
              <ChevronLeft style={{ width: 16, height: 16 }} />
            )}
          </button>
        </div>

        {/* Active Enterprise Card */}
        {!isCollapsed && (
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: '#64748B',
              marginBottom: '4px',
            }}
          >
            Active Enterprise
          </div>
          <div
            className="ceo-font-heading"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {branch.name}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {branch.city} • {branch.manager}
          </div>
        </div>
        )}
      </div>

      {/* ── Middle: Nav Items ── (scrollable if needed) */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {!isCollapsed && (
        <div
          style={{
            fontSize: '9px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#64748B',
            padding: '4px 8px 8px',
            textAlign: isCollapsed ? 'center' : 'left',
          }}
        >
          CEO Modules
        </div>
        )}

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              id={`ceo-nav-${item.id}`}
              onClick={() => handleSelect(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                border: 'none',
                borderLeft: isActive ? '3px solid #D97706' : (isCollapsed ? '3px solid transparent' : '3px solid transparent'),
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#D97706' : '#64748B',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                style={{
                  width: '15px',
                  height: '15px',
                  color: isActive ? '#D97706' : '#6B7280',
                  flexShrink: 0,
                }}
              />
              {!isCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              {!isCollapsed && isActive && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#D97706',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Bottom: Logout ── fixed at bottom */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        }}
      >
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: isCollapsed ? '9px' : '9px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#fca5a5',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title={isCollapsed ? "Logout CEO Session" : undefined}
        >
          <LogOut style={{ width: '14px', height: '14px' }} />
          {!isCollapsed && "Logout CEO Session"}
        </button>
      </div>
    </div>
  );
};

export const ExecutiveSidebar: React.FC<ExecutiveSidebarProps> = (props) => {
  const { isMobileOpen, onCloseMobile } = props;

  return (
    <>
      {/* Desktop Sidebar — always visible, fixed height */}
      <aside
        id="executive-sidebar"
        style={{
          width: props.isCollapsed ? '72px' : '260px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}
      >
        <SidebarContent {...props} />
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {isMobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onCloseMobile} />
          <div
            id="mobile-sidebar-drawer"
            style={{
              position: 'relative',
              width: '280px',
              maxWidth: '80vw',
              height: '100%',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SidebarContent {...props} onCloseIfMobile={onCloseMobile} />
          </div>
        </div>
      )}
    </>
  );
};
