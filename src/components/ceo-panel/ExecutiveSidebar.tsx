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
  X,
} from 'lucide-react';

export type CEOSection = 'overview' | 'sales' | 'returns' | 'day-close' | 'customers' | 'purchase' | 'settings';

interface ExecutiveSidebarProps {
  currentSection: CEOSection;
  onSelectSection: (section: CEOSection) => void;
  branch: Branch;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: { id: CEOSection; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { id: 'overview',  label: 'Overview & P&L',         icon: LayoutDashboard },
  { id: 'sales',     label: 'Sales Register',          icon: TrendingUp },
  { id: 'returns',   label: 'Returns & Tinting Loss',  icon: RotateCcw },
  { id: 'day-close', label: 'Day Close & Variance',    icon: CalendarCheck },
  { id: 'customers', label: 'Customers & Udhaar',      icon: Users },
  { id: 'purchase',  label: 'Procurement & POs',       icon: ShoppingBag },
  { id: 'settings',  label: 'Branch & Commission',     icon: Settings },
];

const SidebarContent: React.FC<ExecutiveSidebarProps & { onCloseIfMobile?: () => void }> = ({
  currentSection,
  onSelectSection,
  branch,
  onLogout,
  onCloseIfMobile,
  onCloseMobile,
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
        backgroundColor: '#10141B',
        borderRight: '1px solid #2A2F38',
        overflow: 'hidden',
      }}
    >
      {/* ── Top: Brand + Branch Info ── */}
      <div style={{ flexShrink: 0 }}>
        {/* Brand Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #2A2F38',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#C6A15B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#12151B',
                fontWeight: 800,
                fontSize: '14px',
                flexShrink: 0,
              }}
              className="ceo-font-heading"
            >
              P
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="ceo-font-heading" style={{ fontWeight: 700, fontSize: '14px', color: '#E5E7EB', whiteSpace: 'nowrap' }}>
                  PaintERP
                </span>
                <span
                  className="ceo-font-mono"
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(198,161,91,0.12)',
                    color: '#C6A15B',
                    border: '1px solid rgba(198,161,91,0.25)',
                    flexShrink: 0,
                  }}
                >
                  CEO
                </span>
              </div>
              <div
                className="ceo-font-mono"
                style={{ fontSize: '10px', color: '#8B93A1', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {branch.code || 'PK-01'} • {branch.city || 'Karachi'}
              </div>
            </div>
          </div>

          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                padding: '4px',
                borderRadius: '6px',
                color: '#8B93A1',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Close navigation"
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          )}
        </div>

        {/* Active Enterprise Card */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #2A2F38',
            backgroundColor: '#12151B',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: '#8B93A1',
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
              color: '#E5E7EB',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {branch.name}
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {branch.city} • {branch.manager}
          </div>
        </div>
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
        <div
          style={{
            fontSize: '9px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#8B93A1',
            padding: '4px 8px 8px',
          }}
        >
          CEO Modules
        </div>

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
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                border: 'none',
                borderLeft: isActive ? '3px solid #C6A15B' : '3px solid transparent',
                backgroundColor: isActive ? '#1C2128' : 'transparent',
                color: isActive ? '#C6A15B' : '#8B93A1',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon
                style={{
                  width: '15px',
                  height: '15px',
                  color: isActive ? '#C6A15B' : '#6B7280',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#C6A15B',
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
          borderTop: '1px solid #2A2F38',
          backgroundColor: '#10141B',
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
            padding: '9px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#fca5a5',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <LogOut style={{ width: '14px', height: '14px' }} />
          Logout CEO Session
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
          width: '260px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
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
