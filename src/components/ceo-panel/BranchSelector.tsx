'use client';

import React from 'react';
import { Branch } from '@/types/ceo';
import { formatCurrency } from '@/data/ceoMockData';
import { ChevronRight, ShieldCheck, MapPin } from 'lucide-react';

interface BranchSelectorProps {
  branches: Branch[];
  onSelectBranch: (branch: Branch) => void;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ branches, onSelectBranch }) => {
  return (
    <div
      id="branch-selector-screen"
      className="ceo-root"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Minimal Executive Header */}
      <header style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/logo.png" alt="Pyntflow" style={{ height: '28px', width: 'auto', display: 'block', objectFit: 'contain' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#D97706' }}>
                  CEO Executive Suite
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Enterprise Multi-Branch Operational Oversight</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '9999px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', fontSize: '12px', color: '#64748B' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: '#34D399' }} />
              <span>{branches.length} Operational Hubs Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Centered Grid Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', maxWidth: '1200px', width: '100%', margin: '24px auto' }}>
        {/* Title Section */}
        <div style={{ textAlign: 'center', maxWidth: '580px', margin: '0 auto 36px' }}>
          <h1 className="ceo-font-heading" style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Select Operational Branch
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '8px', lineHeight: 1.5 }}>
            Select a commercial location to inspect sales registers, day-close shift reconciliations, tinting returns, customer debt aging, and procurement.
          </p>
        </div>

        {/* Centered Grid of Branch Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', width: '100%' }}>
          {branches.map((branch) => (
            <div
              key={branch.id}
              id={`branch-card-${branch.id}`}
              onClick={() => onSelectBranch(branch)}
              className="ceo-card-interactive"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                {/* Branch Location Mark & Code */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="ceo-font-mono" style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#D97706' }}>
                    {branch.code}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin style={{ width: '12px', height: '12px', color: '#D97706' }} />
                    {branch.region}
                  </span>
                </div>

                {/* Branch Name */}
                <h3 className="ceo-font-heading" style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.3 }}>
                  {branch.name}
                </h3>

                {/* City & Manager */}
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                  {branch.city} • Lead: {branch.manager}
                </div>

                {/* Supporting KPIs */}
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', display: 'block' }}>Today's Sales</span>
                    <span className="ceo-font-mono" style={{ fontWeight: 700, color: '#D97706' }}>
                      {formatCurrency(branch.todaySales)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', display: 'block' }}>Receivables (Udhaar)</span>
                    <span className="ceo-font-mono" style={{ fontWeight: 700, color: '#F87171' }}>
                      {formatCurrency(branch.totalReceivables)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Link Footer */}
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
                <span style={{ fontWeight: 600, color: '#D97706' }}>Open Executive View</span>
                <ChevronRight style={{ width: '16px', height: '16px', color: '#D97706' }} />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #E2E8F0', padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: '#64748B', backgroundColor: '#FFFFFF' }}>
        PaintERP Executive Dashboard • Multi-Tenant Operational Authority
      </footer>
    </div>
  );
};
