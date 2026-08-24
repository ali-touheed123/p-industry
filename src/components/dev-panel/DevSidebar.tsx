'use client';

import React from 'react';
import { 
  LayoutDashboard,
  Building2, 
  Users
} from 'lucide-react';
import { DevActiveTab } from '@/types/dev';

interface DevSidebarProps {
  activeTab: DevActiveTab;
  onTabChange: (tab: DevActiveTab) => void;
  counts: {
    branches: number;
    users: number;
  };
  primaryTenantSlug?: string;
}

export const DevSidebar: React.FC<DevSidebarProps> = ({
  activeTab,
  onTabChange,
  counts,
  primaryTenantSlug = '/tawakkal-paint-house',
}) => {
  const navItems: {
    id: DevActiveTab;
    label: string;
    description: string;
    icon: React.ElementType;
    count?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      description: 'System stats & facility matrix',
      icon: LayoutDashboard,
    },
    {
      id: 'branches',
      label: 'Branches & Godowns',
      description: 'Retail shops, godowns & factories',
      icon: Building2,
      count: counts.branches,
    },
    {
      id: 'users',
      label: 'All Users & Roles',
      description: 'Developers, CEOs, staff & incharges',
      icon: Users,
      count: counts.users,
    },
  ];

  return (
    <aside className="aura-sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Profile Card */}
        <div className="aura-user-card">
          <div className="aura-avatar">
            <span>AT</span>
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '9999px',
                backgroundColor: '#34d399',
                border: '2px solid #000',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Ali Touheed</p>
              <span
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(212, 175, 55, 0.2)',
                  color: '#D4AF37',
                  fontWeight: 700,
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                }}
              >
                SUPER DEV
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>ali.dev@painterp.com</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div>
          <p
            style={{
              padding: '0 12px',
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(212, 175, 55, 0.8)',
              fontWeight: 700,
              marginBottom: '8px',
            }}
          >
            Navigation Hub
          </p>
          <nav>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`aura-nav-btn ${isActive ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="aura-nav-icon">
                      <Icon style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: isActive ? '#F3E5AB' : '#e2e8f0',
                          display: 'block',
                        }}
                      >
                        {item.label}
                      </span>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {item.count !== undefined && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: isActive ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: isActive ? '#F3E5AB' : '#9ca3af',
                        border: isActive ? '1px solid rgba(212, 175, 55, 0.4)' : 'none',
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Panel Info */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Quick Primary Tenant info */}
        <div
          style={{
            padding: '12px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.08em',
                color: '#9ca3af',
              }}
            >
              Primary Tenant
            </span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: '#34d399',
              }}
            />
          </div>
          <p
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#D4AF37',
              fontFamily: "'JetBrains Mono', monospace",
              margin: 0,
            }}
          >
            {primaryTenantSlug.startsWith('/') ? primaryTenantSlug : `/${primaryTenantSlug}`}
          </p>
        </div>

        <div
          style={{
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#6b7280',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span>Aura Suite</span>
          <span style={{ color: '#D4AF37' }}>v2.4 Production</span>
        </div>
      </div>
    </aside>
  );
};
