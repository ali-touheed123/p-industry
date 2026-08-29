'use client';

import React from 'react';
import { 
  Building2, 
  Store, 
  Warehouse, 
  Factory, 
  Users, 
  MapPin, 
  ExternalLink, 
  Plus, 
  ArrowRight, 
  Sparkles
} from 'lucide-react';
import { Tenant, UserItem, DevActiveTab } from '@/types/dev';

interface DevOverviewViewProps {
  branches: Tenant[];
  users: UserItem[];
  onAddBranch: () => void;
  onAddUser: () => void;
  onNavigateTab: (tab: DevActiveTab) => void;
  onOpenBranchPortal: (branch: Tenant) => void;
}

export const DevOverviewView: React.FC<DevOverviewViewProps> = ({
  branches,
  users,
  onAddBranch,
  onAddUser,
  onNavigateTab,
  onOpenBranchPortal,
}) => {
  const retailShops = branches.filter((b) => b.type === 'shop');
  const centralGodowns = branches.filter((b) => b.type === 'godown');
  const paintFactories = branches.filter((b) => b.type === 'factory');

  const distinctCities = Array.from(
    new Set(branches.map((b) => (b.city || '').trim()).filter(Boolean))
  );

  const developersCount = users.filter((u) => u.role === 'developer').length;
  const ceoCount = users.filter((u) => u.role === 'ceo').length;
  const staffCount = users.filter((u) => u.role === 'staff' || u.role === 'godown_staff').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Executive Welcome Header */}
      <div className="aura-banner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '10px',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                letterSpacing: '0.08em',
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                color: '#F3E5AB',
                border: '1px solid rgba(212, 175, 55, 0.4)',
              }}
            >
              <Sparkles style={{ width: '12px', height: '12px', color: '#D4AF37' }} />
              Executive Dashboard
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#34d399',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  backgroundColor: '#34d399',
                }}
              />
              Live Supabase Operational
            </span>
          </div>

          <h1
            style={{
              fontSize: '32px',
              fontWeight: 300,
              color: '#ffffff',
              letterSpacing: '-0.025em',
              margin: '4px 0 0',
            }}
          >
            Executive <span style={{ color: '#D4AF37', fontWeight: 700 }}>Overview</span>
          </h1>

          <p style={{ fontSize: '13px', color: '#9ca3af', maxWidth: '580px', margin: 0, lineHeight: 1.5 }}>
            Centralized multi-tenant management hub for retail distribution shops, central storage godowns, and role-based user access controls.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onAddUser}
            className="aura-btn-secondary"
          >
            <Users style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
            <span>Add User</span>
          </button>

          <button
            onClick={onAddBranch}
            className="aura-btn-gold"
          >
            <Plus style={{ width: '16px', height: '16px', strokeWidth: 3 }} />
            <span>+ Provision Shop / Godown</span>
          </button>
        </div>
      </div>

      {/* Key Metric Highlights Grid */}
      <div className="aura-grid-3">
        {/* Total Branches Card */}
        <div
          onClick={() => onNavigateTab('branches')}
          className="aura-card aura-card-hover"
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              style={{
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                fontWeight: 700,
              }}
            >
              Total Facilities
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
              }}
            >
              <Building2 style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff', margin: 0 }}>{branches.length}</p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '11px',
              color: '#9ca3af',
            }}
          >
            <span>{retailShops.length} Shops • {centralGodowns.length} Godowns • {paintFactories.length} Factories</span>
            <ArrowRight style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
          </div>
        </div>

        {/* System User Accounts Card */}
        <div
          onClick={() => onNavigateTab('users')}
          className="aura-card aura-card-hover"
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              style={{
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                fontWeight: 700,
              }}
            >
              System Accounts
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e2e8f0',
              }}
            >
              <Users style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#F3E5AB', margin: 0 }}>{users.length}</p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '11px',
              color: '#9ca3af',
            }}
          >
            <span>{developersCount} Dev • {ceoCount} CEO • {staffCount} Staff</span>
            <ArrowRight style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
          </div>
        </div>

        {/* Operating Cities Card */}
        <div className="aura-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              style={{
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                fontWeight: 700,
              }}
            >
              Active Regions
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
              }}
            >
              <MapPin style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#D4AF37', margin: 0 }}>{distinctCities.length || 1}</p>
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '11px',
              color: '#9ca3af',
            }}
          >
            <span>{distinctCities.join(', ') || 'Karachi'}</span>
          </div>
        </div>
      </div>

      {/* Facility Categories Breakdown */}
      <div className="aura-grid-3">
        {/* Retail Shops Box */}
        <div className="aura-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#fbbf24',
                }}
              >
                <Store style={{ width: '16px', height: '16px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Retail Shops</h3>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Point of sale & billing</p>
              </div>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', fontFamily: "'JetBrains Mono', monospace" }}>
              {retailShops.length}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {retailShops.slice(0, 2).map((shop) => (
              <div key={shop.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#d1d5db' }}>{shop.name}</span>
                <span style={{ color: '#D4AF37', fontFamily: "'JetBrains Mono', monospace" }}>/{shop.slug}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Central Godowns Box */}
        <div className="aura-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                }}
              >
                <Warehouse style={{ width: '16px', height: '16px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Central Godowns</h3>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Wholesale bulk & storage</p>
              </div>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#34d399', fontFamily: "'JetBrains Mono', monospace" }}>
              {centralGodowns.length}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {centralGodowns.slice(0, 2).map((godown) => (
              <div key={godown.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#d1d5db' }}>{godown.name}</span>
                <span style={{ color: '#34d399', fontFamily: "'JetBrains Mono', monospace" }}>/{godown.slug}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Paint Factories Box */}
        <div className="aura-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(234, 179, 8, 0.12)',
                  color: '#facc15',
                }}
              >
                <Factory style={{ width: '16px', height: '16px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Paint Factories</h3>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Chemical & batch units</p>
              </div>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#facc15', fontFamily: "'JetBrains Mono', monospace" }}>
              {paintFactories.length}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {paintFactories.slice(0, 2).map((factory) => (
              <div key={factory.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#d1d5db' }}>{factory.name}</span>
                <span style={{ color: '#facc15', fontFamily: "'JetBrains Mono', monospace" }}>/{factory.slug}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="aura-grid-2">
        {/* Left Column: Branch Directory */}
        <div className="aura-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Branch & Godown Directory</h3>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Active facility workspaces</p>
            </div>
            <button
              onClick={() => onNavigateTab('branches')}
              style={{
                background: 'none',
                border: 'none',
                color: '#D4AF37',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View All ({branches.length})</span>
              <ArrowRight style={{ width: '14px', height: '14px' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {branches.slice(0, 4).map((branch) => (
              <div
                key={branch.id}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#D4AF37',
                      flexShrink: 0,
                    }}
                  >
                    {branch.type === 'shop' ? (
                      <Store style={{ width: '16px', height: '16px' }} />
                    ) : branch.type === 'godown' ? (
                      <Warehouse style={{ width: '16px', height: '16px', color: '#34d399' }} />
                    ) : (
                      <Factory style={{ width: '16px', height: '16px', color: '#facc15' }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {branch.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#9ca3af' }}>
                      <span style={{ color: '#D4AF37', fontFamily: "'JetBrains Mono', monospace" }}>/{branch.slug}</span>
                      <span>•</span>
                      <span>{branch.city || 'Karachi'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onOpenBranchPortal(branch)}
                  className="aura-btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '11px' }}
                >
                  <ExternalLink style={{ width: '12px', height: '12px', color: '#D4AF37' }} />
                  <span>Open</span>
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onAddBranch}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: '#d1d5db',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            + Register New Facility
          </button>
        </div>

        {/* Right Column: User Accounts */}
        <div className="aura-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Users & Role Hierarchy</h3>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Access control & credentials</p>
            </div>
            <button
              onClick={() => onNavigateTab('users')}
              style={{
                background: 'none',
                border: 'none',
                color: '#D4AF37',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Manage Users ({users.length})</span>
              <ArrowRight style={{ width: '14px', height: '14px' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.slice(0, 4).map((user) => (
              <div
                key={user.id}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#D4AF37',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      fontSize: '12px',
                      flexShrink: 0,
                    }}
                  >
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", margin: 0 }}>
                        {user.username}
                      </p>
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '9999px',
                          backgroundColor: user.role === 'developer' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          color: user.role === 'developer' ? '#D4AF37' : '#e2e8f0',
                        }}
                      >
                        {user.role.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.full_name || '—'}
                    </p>
                  </div>
                </div>

                <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>
                  {user.tenants?.name || (user.role === 'developer' ? 'Global' : '—')}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onAddUser}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: '#d1d5db',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            + Create New User Account
          </button>
        </div>
      </div>
    </div>
  );
};
