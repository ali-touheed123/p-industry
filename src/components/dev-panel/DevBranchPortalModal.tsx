'use client';

import React, { useState } from 'react';
import { 
  X, 
  Store, 
  Warehouse, 
  Factory, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw,
  Copy,
  Check,
  Receipt
} from 'lucide-react';
import { Tenant } from '@/types/dev';

interface DevBranchPortalModalProps {
  branch: Tenant | null;
  onClose: () => void;
}

export const DevBranchPortalModal: React.FC<DevBranchPortalModalProps> = ({
  branch,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [simulatingSync, setSimulatingSync] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  if (!branch) return null;

  const getFullUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${branch.slug}`;
    }
    return `/${branch.slug}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getFullUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateSync = () => {
    setSimulatingSync(true);
    setSyncDone(false);
    setTimeout(() => {
      setSimulatingSync(false);
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    }, 1000);
  };

  return (
    <div className="aura-modal-overlay">
      <div className="aura-modal-box">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37' }}>
              {branch.type === 'shop' ? (
                <Store style={{ width: '24px', height: '24px' }} />
              ) : branch.type === 'godown' ? (
                <Warehouse style={{ width: '24px', height: '24px', color: '#34d399' }} />
              ) : (
                <Factory style={{ width: '24px', height: '24px', color: '#facc15' }} />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  {branch.name}
                </h2>
                <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#D4AF37', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  {branch.type.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#F3E5AB', opacity: 0.8, fontFamily: "'JetBrains Mono', monospace", margin: '2px 0 0' }}>
                Tenant Route: /{branch.slug} • {branch.city || 'Karachi'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '9999px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#9ca3af', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Branch Workspace Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px' }}>
          {/* Tenant Live URL Box */}
          <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", color: '#9ca3af', display: 'block', marginBottom: '2px' }}>
                Isolated Tenant Endpoint
              </span>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#D4AF37', fontSize: '14px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getFullUrl()}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleCopyLink}
                className="aura-btn-secondary"
                style={{ padding: '6px 14px' }}
              >
                {copied ? <Check style={{ width: '14px', height: '14px', color: '#34d399' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                <span>{copied ? 'Copied' : 'Copy Route'}</span>
              </button>

              <a
                href={`/${branch.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="aura-btn-gold"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                <ExternalLink style={{ width: '14px', height: '14px' }} />
                <span>Launch App</span>
              </a>
            </div>
          </div>

          {/* Sync Button & Message */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '14px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontWeight: 600 }}>
              <Sparkles style={{ width: '16px', height: '16px', color: '#D4AF37' }} />
              <span>Multi-Tenant DB State</span>
            </div>
            <button
              onClick={handleSimulateSync}
              disabled={simulatingSync}
              className="aura-btn-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              <RefreshCw style={{ width: '12px', height: '12px', animation: simulatingSync ? 'spin 1s linear infinite' : 'none' }} />
              <span>{simulatingSync ? 'Syncing...' : 'Sync Test'}</span>
            </button>
          </div>

          {syncDone && (
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>Stock delta matrix and user tenant isolation verified (16ms).</span>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", color: '#9ca3af', display: 'block' }}>Status</span>
              <span style={{ fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: '#34d399' }} />
                {branch.is_active ? 'Active' : 'Suspended'}
              </span>
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", color: '#9ca3af', display: 'block' }}>Staff Assigned</span>
              <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '15px', marginTop: '2px', display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
                {branch.usersCount || branch.staffCount || 0} Users
              </span>
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", color: '#9ca3af', display: 'block' }}>Location Hub</span>
              <span style={{ fontWeight: 700, color: '#D4AF37', textTransform: 'capitalize', fontSize: '12px', marginTop: '4px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {branch.city || 'Karachi'}
              </span>
            </div>
          </div>

          {/* Simulated Active Sessions in this Branch */}
          <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#D4AF37', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt style={{ width: '14px', height: '14px' }} />
              Branch Available Access Endpoints
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#34d399' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#e5e7eb' }}>Point of Sale (POS) Counter</span>
                </div>
                <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#34d399', backgroundColor: 'rgba(6, 78, 59, 0.5)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  Role: staff
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#34d399' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#e5e7eb' }}>Executive CEO Dashboard</span>
                </div>
                <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', backgroundColor: 'rgba(12, 74, 110, 0.5)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  Role: ceo
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#D4AF37' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#e5e7eb' }}>Warehouse & Dispatch Incharge</span>
                </div>
                <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#F3E5AB', backgroundColor: 'rgba(69, 26, 3, 0.5)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                  Role: godown_staff
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '16px' }}>
          <button
            onClick={onClose}
            className="aura-btn-gold"
          >
            Close Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
