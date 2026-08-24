'use client';

import React from 'react';
import { 
  Shield, 
  Building2, 
  UserPlus,
  LogOut,
  RefreshCw
} from 'lucide-react';

interface DevNavbarProps {
  onAddBranch: () => void;
  onAddUser: () => void;
  onRefresh: () => void;
  onLock: () => void;
  loading?: boolean;
}

export const DevNavbar: React.FC<DevNavbarProps> = ({
  onAddBranch,
  onAddUser,
  onRefresh,
  onLock,
  loading = false,
}) => {
  return (
    <header className="aura-navbar">
      <div className="aura-navbar-inner">
        {/* Left Brand Badge */}
        <div className="aura-brand">
          <div className="aura-emblem">
            <div className="aura-emblem-inner">
              <Shield style={{ width: '20px', height: '20px', color: '#D4AF37' }} />
            </div>
            <span className="aura-emblem-dot" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 300, letterSpacing: '-0.02em', color: '#ffffff' }}>
                SUPER <span style={{ color: '#D4AF37', fontWeight: 700 }}>ADMIN</span>
              </span>
              <span
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(212, 175, 55, 0.15)',
                  color: '#D4AF37',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                }}
              >
                AURA DEV HUB
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontWeight: 500 }}>
              Multi-Tenant Branches & Access Management Suite
            </p>
          </div>
        </div>

        {/* Right Tools & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Refresh Data */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="aura-btn-secondary"
            title="Refresh database records"
          >
            <RefreshCw
              style={{
                width: '14px',
                height: '14px',
                color: '#D4AF37',
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Refresh</span>
          </button>

          {/* Quick Action Button - Add Branch */}
          <button
            onClick={onAddBranch}
            className="aura-btn-gold"
            title="Provision new branch or godown"
          >
            <Building2 style={{ width: '14px', height: '14px' }} />
            <span>Add Branch</span>
          </button>

          {/* Quick Action - Add User Account */}
          <button
            onClick={onAddUser}
            className="aura-btn-secondary"
            title="Create system user account"
          >
            <UserPlus style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
            <span>Add User</span>
          </button>

          {/* Lock Panel */}
          <button
            onClick={onLock}
            className="aura-btn-danger"
            title="Lock Developer Panel"
          >
            <LogOut style={{ width: '14px', height: '14px', color: '#f87171' }} />
            <span>Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
};
