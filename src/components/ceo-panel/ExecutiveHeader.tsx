'use client';

import React, { useState, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { Menu, ShieldCheck } from 'lucide-react';

interface ExecutiveHeaderProps {
  branch: Branch;
  branches: Branch[];
  onSwitchBranch: (branch: Branch) => void;
  onBackToHub?: () => void;
  onLogout?: () => void;
  onOpenMobileMenu?: () => void;
}

export const ExecutiveHeader: React.FC<ExecutiveHeaderProps> = ({
  branch,
  branches,
  onSwitchBranch,
  onBackToHub,
  onLogout,
  onOpenMobileMenu,
}) => {
  const [now, setNow] = useState(new Date());

  // Live clock — ticks every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <header
      style={{
        minHeight: '60px',
        backgroundColor: '#10141B',
        borderBottom: '1px solid #2A2F38',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        gap: '12px',
        flexShrink: 0,
      }}
    >
      {/* Left: Mobile Hamburger + Branch Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        {/* Mobile Hamburger */}
        <button
          id="mobile-sidebar-toggle-btn"
          onClick={onOpenMobileMenu}
          style={{
            padding: '6px',
            borderRadius: '6px',
            backgroundColor: 'rgba(198,161,91,0.1)',
            border: '1px solid rgba(198,161,91,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Open navigation"
        >
          <Menu style={{ width: '18px', height: '18px', color: '#C6A15B' }} />
        </button>

        {/* Branch Name + Code */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              className="ceo-font-heading"
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#E5E7EB',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '220px',
              }}
            >
              {branch.name}
            </span>
            <span
              className="ceo-font-mono"
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#1C2128',
                border: '1px solid #2A2F38',
                color: '#C6A15B',
                flexShrink: 0,
              }}
            >
              {branch.code || 'PK-01'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#8B93A1', marginTop: '2px', whiteSpace: 'nowrap' }}>
            Lead: {branch.manager || 'Executive Lead'} &nbsp;•&nbsp;
            <span style={{ color: '#34D399', fontWeight: 600 }}>{branch.activeRegisters || 2} Active Registers</span>
          </div>
        </div>

        {/* Branch Switcher (only if multi-branch) */}
        {branches.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {onBackToHub && (
              <button
                type="button"
                onClick={onBackToHub}
                style={{
                  backgroundColor: '#1C2128',
                  border: '1px solid #2A2F38',
                  color: '#C6A15B',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Return to Multi-Branch Overview Hub"
              >
                ← All Branches
              </button>
            )}
            <select
              value={branch.id}
              onChange={(e) => {
                const found = branches.find((b) => b.id === e.target.value);
                if (found) onSwitchBranch(found);
              }}
              style={{
                backgroundColor: '#1C2128',
                border: '1px solid #2A2F38',
                color: '#E5E7EB',
                fontSize: '12px',
                borderRadius: '6px',
                padding: '6px 10px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} style={{ backgroundColor: '#1C2128' }}>
                  Branch: {b.shortName || b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Live Clock + CEO Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Live Date & Time */}
        <div
          className="ceo-font-mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1C2128',
            border: '1px solid #2A2F38',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#8B93A1',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{formattedDate}</span>
          <span style={{ color: '#4B5563' }}>|</span>
          <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{formattedTime} PKT</span>
        </div>

        {/* CEO Badge */}
        <div
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            backgroundColor: 'rgba(198,161,91,0.12)',
            border: '1px solid rgba(198,161,91,0.3)',
            color: '#C6A15B',
            fontWeight: 700,
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck style={{ width: '14px', height: '14px' }} />
          CEO Executive Panel
        </div>
      </div>
    </header>
  );
};
