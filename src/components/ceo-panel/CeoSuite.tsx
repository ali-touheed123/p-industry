'use client';

import React, { useState, useEffect } from 'react';
import { Branch } from '@/types/ceo';
import { Tenant } from '@/types';
import { BranchSelector } from './BranchSelector';
import { ExecutiveSidebar, CEOSection } from './ExecutiveSidebar';
import { ExecutiveHeader } from './ExecutiveHeader';
import { OverviewView } from './OverviewView';
import { SalesView } from './SalesView';
import { ReturnsView } from './ReturnsView';
import { DayCloseView } from './DayCloseView';
import { CustomersView } from './CustomersView';
import { PurchaseView } from './PurchaseView';
import { SettingsView } from './SettingsView';
import './ceo-panel.css';

interface CeoSuiteProps {
  tenant?: (Tenant & { users?: any[]; counters?: any[] }) | null;
  initialBranchSlug?: string;
  onLogout?: () => void;
}

export const CeoSuite: React.FC<CeoSuiteProps> = ({ tenant, initialBranchSlug, onLogout }) => {
  const [currentSection, setCurrentSection] = useState<CEOSection>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (!tenant) return;

    const baseName = tenant.name || 'Paint Enterprise';
    const city = tenant.city || 'Karachi';
    const ownerName = tenant.owner_name || 'Executive Lead';

    const staffCounters = (tenant.counters && tenant.counters.length > 0)
      ? tenant.counters
      : (tenant.users && tenant.users.filter((u: any) => u.role === 'staff' || u.role === 'godown_staff')) || [];

    if (staffCounters.length > 1) {
      const multiBranches: Branch[] = staffCounters.map((counter: any, idx: number) => {
        const counterName = counter.full_name || `Branch ${idx + 1} (${counter.username})`;
        return {
          id: `${tenant.id}-b${idx + 1}`,
          name: `${baseName} — ${counterName}`,
          shortName: counterName,
          city,
          region: `${city} • Reg ${idx + 1}`,
          code: `PK-${(idx + 1).toString().padStart(2, '0')}`,
          address: tenant.address || 'Commercial Area',
          manager: counter.full_name || ownerName,
          activeRegisters: 1,
          todaySales: 0,
          monthlySales: 0,
          totalReceivables: 0,
          healthStatus: 'Optimal',
          inventoryValue: 0,
          slug: tenant.slug,
        };
      });
      setBranches(multiBranches);
      if (!selectedBranch) {
        setSelectedBranch(multiBranches[0]);
      }
    } else {
      const singleBranch: Branch = {
        id: tenant.id || tenant.slug,
        name: baseName,
        shortName: baseName.split('—')[0].trim(),
        city,
        region: `${city} Main Hub`,
        code: 'PK-01',
        address: tenant.address || 'Commercial Market Area',
        manager: ownerName,
        activeRegisters: 1,
        todaySales: 0,
        monthlySales: 0,
        totalReceivables: 0,
        healthStatus: tenant.is_active ? 'Optimal' : 'Attention',
        inventoryValue: 0,
        slug: tenant.slug,
      };
      setBranches([singleBranch]);
      setSelectedBranch(singleBranch);
    }
  }, [tenant]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMobileSidebarOpen) {
          setIsMobileSidebarOpen(false);
        } else if (branches.length > 1 && selectedBranch) {
          setSelectedBranch(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBranch, isMobileSidebarOpen, branches]);

  if (!selectedBranch) {
    return (
      <BranchSelector
        branches={branches}
        onSelectBranch={(branch) => {
          setSelectedBranch(branch);
          setCurrentSection('overview');
        }}
      />
    );
  }

  return (
    // FIX: Use pure inline styles instead of Tailwind (Tailwind not compiled for this file)
    <div
      className="ceo-root"
      style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#12151B',
      }}
    >
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 40,
          }}
        />
      )}

      {/* Executive Sidebar — fixed width 260px */}
      <div style={{ width: '260px', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <ExecutiveSidebar
          currentSection={currentSection}
          onSelectSection={setCurrentSection}
          branch={selectedBranch}
          onLogout={() => {
            if (branches.length > 1) {
              setSelectedBranch(null);
            } else if (onLogout) {
              onLogout();
            }
          }}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content — flex:1, scrollable */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflowY: 'auto',
          backgroundColor: '#12151B',
        }}
      >
        {/* Sticky Executive Header */}
        <ExecutiveHeader
          branch={selectedBranch}
          branches={branches}
          onSwitchBranch={setSelectedBranch}
          onLogout={onLogout}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        {/* Dashboard Active View */}
        <main
          style={{
            flex: 1,
            padding: '24px',
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {currentSection === 'overview'  && <OverviewView branch={selectedBranch} />}
          {currentSection === 'sales'     && <SalesView branch={selectedBranch} />}
          {currentSection === 'returns'   && <ReturnsView branch={selectedBranch} />}
          {currentSection === 'day-close' && <DayCloseView branch={selectedBranch} />}
          {currentSection === 'customers' && <CustomersView branch={selectedBranch} />}
          {currentSection === 'purchase'  && <PurchaseView branch={selectedBranch} />}
          {currentSection === 'settings'  && <SettingsView tenant={tenant} />}
        </main>
      </div>
    </div>
  );
};
export default CeoSuite;
