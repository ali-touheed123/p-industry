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
import { BranchOrdersView } from './BranchOrdersView';
import { AuditLogsView } from './AuditLogsView';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  useEffect(() => {
    const fetchRealBranches = async () => {
      if (!tenant) return;

      const baseName = tenant.name || 'Paint Enterprise';
      const city = tenant.city || 'Karachi';
      const ownerName = tenant.owner_name || 'Executive Lead';

      try {
        const todayIso = new Date().toISOString().split('T')[0];

        // Fetch all active branches/godowns from database
        const res = await fetch('/api/tenants');
        const data = await res.json();

        if (data.success && Array.isArray(data.tenants) && data.tenants.length > 0) {
          // Filter branches belonging to this CEO (same email or owner_name) or all active
          const matchingTenants = data.tenants.filter(
            (t: any) =>
              t.id === tenant.id ||
              (tenant.email && t.email === tenant.email) ||
              (tenant.owner_name && t.owner_name === tenant.owner_name)
          );

          const finalTenants = matchingTenants.length > 0 ? matchingTenants : data.tenants;

          // Concurrently fetch invoices & client receivables for all sister branches
          const branchesWithKpis: Branch[] = await Promise.all(
            finalTenants.map(async (t: any, idx: number) => {
              let todaySales = 0;
              let monthlySales = 0;
              let totalReceivables = 0;

              try {
                const [invRes, clientsRes] = await Promise.all([
                  fetch(`/api/invoices?tenant_id=${t.id}`),
                  fetch(`/api/clients?tenant_id=${t.id}`),
                ]);
                const [invData, clientsData] = await Promise.all([invRes.json(), clientsRes.json()]);

                if (invData.success && Array.isArray(invData.invoices)) {
                  invData.invoices.forEach((inv: any) => {
                    const st = (inv.status || '').toLowerCase();
                    const isRet = (inv.invoice_type || '').toLowerCase() === 'return' || st === 'return';
                    const invDate = inv.date || (inv.created_at ? inv.created_at.split('T')[0] : '');
                    const amount = Number(inv.net_total || 0);

                    if (!isRet) {
                      if (invDate === todayIso) {
                        todaySales += amount;
                      }
                      if (invDate && invDate.substring(0, 7) === todayIso.substring(0, 7)) {
                        monthlySales += amount;
                      }
                    }
                  });
                }

                if (clientsData.success && Array.isArray(clientsData.clients)) {
                  clientsData.clients.forEach((c: any) => {
                    const bal = Number(c.current_balance || c.balance || 0);
                    if (bal > 0) totalReceivables += bal;
                  });
                }
              } catch (e) {
                console.error(`Failed to load KPIs for branch ${t.id}:`, e);
              }

              return {
                id: t.id,
                name: t.name,
                shortName: t.name.split('—')[0].trim(),
                city: t.city || city,
                region: `${t.city || city} • ${t.type?.toUpperCase() || 'BRANCH'}`,
                code: `PK-${(idx + 1).toString().padStart(2, '0')}`,
                address: t.address || 'Commercial Market Area',
                manager: t.owner_name || ownerName,
                activeRegisters: t.staffCount || 1,
                todaySales,
                monthlySales,
                totalReceivables,
                healthStatus: t.is_active ? 'Optimal' : 'Attention',
                inventoryValue: 0,
                slug: t.slug,
              };
            })
          );

          setBranches(branchesWithKpis);

          // If only 1 branch exists -> open directly!
          // If multiple branches exist -> show the Hub Selector page first!
          if (branchesWithKpis.length === 1) {
            setSelectedBranch(branchesWithKpis[0]);
          } else {
            setSelectedBranch(null);
          }
          return;
        }
      } catch (err) {
        console.error('Failed to fetch sister branches for CEO Suite:', err);
      }

      // Fallback single branch
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
    };

    fetchRealBranches();
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
        backgroundColor: '#F8FAFC',
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

      {/* Executive Sidebar — dynamic width */}
      <div style={{ width: isSidebarCollapsed ? '72px' : '260px', flexShrink: 0, position: 'relative', zIndex: 10, transition: 'width 0.2s ease' }}>
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
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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
          backgroundColor: '#F8FAFC',
        }}
      >
        {/* Sticky Executive Header */}
        <ExecutiveHeader
          branch={selectedBranch}
          branches={branches}
          onSwitchBranch={setSelectedBranch}
          onBackToHub={() => setSelectedBranch(null)}
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
          {currentSection === 'overview'      && <OverviewView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'sales'         && <SalesView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'returns'       && <ReturnsView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'day-close'     && <DayCloseView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'customers'     && <CustomersView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'purchase'      && <PurchaseView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'branch-orders' && <BranchOrdersView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'audit-logs'    && <AuditLogsView key={selectedBranch.id} branch={selectedBranch} />}
          {currentSection === 'settings'      && <SettingsView tenant={tenant} />}
        </main>
      </div>
    </div>
  );
};
export default CeoSuite;
